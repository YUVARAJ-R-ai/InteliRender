"""
Web tools served over the persistent HTTP MCP server: browser_task, fetch_url,
web_search. These are stateless (no per-user secrets) so they live here rather
than in a per-request stdio server.

Ported from the previous Next.js inline tools + the FastAPI browser router so
behaviour is unchanged: browser_task uses one Chromium session at a time with a
60s timeout, and returns only { result, has_screenshot } (the screenshot bytes
are never sent back to the model context — matching the old agent route).
"""
import asyncio
import base64
import os
import re
import uuid
from typing import Any, Optional

import httpx

from main import mcp

# One concurrent browser session at a time (prevents resource exhaustion)
_browser_semaphore = asyncio.Semaphore(1)
_BROWSER_TIMEOUT_SECONDS = 60

# Screenshots are stashed in redis under a random id with a TTL and surfaced to
# the chat via a short URL (/api/screenshots/<id>). The base64 PNG never enters
# the model's text context — only the tiny URL does.
_SCREENSHOT_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


async def _store_screenshot(png_bytes: bytes) -> Optional[str]:
    """Store a PNG in redis under a random id; return /api/screenshots/<id>.

    Returns None when REDIS_URL is unset or redis is unavailable, so the caller
    can gracefully degrade to has_screenshot only.
    """
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis.asyncio as redis  # redis>=4.2 ships asyncio support

        client = redis.from_url(redis_url)
        screenshot_id = uuid.uuid4().hex
        encoded = base64.b64encode(png_bytes).decode("ascii")
        await client.set(f"screenshot:{screenshot_id}", encoded, ex=_SCREENSHOT_TTL_SECONDS)
        await client.aclose()
        return f"/api/screenshots/{screenshot_id}"
    except Exception:
        return None


@mcp.tool()
async def web_search(query: str) -> list[dict]:
    """Search the web for up-to-date information. Returns a list of {title, snippet}."""
    tavily_key = os.environ.get("TAVILY_API_KEY")
    exa_key = os.environ.get("EXA_API_KEY")

    if tavily_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.post(
                    "https://api.tavily.com/search",
                    headers={
                        "Authorization": f"Bearer {tavily_key}",
                        "Content-Type": "application/json",
                    },
                    json={"query": query, "max_results": 5, "search_depth": "basic"},
                )
                if res.status_code != 200:
                    raise RuntimeError(f"Tavily HTTP {res.status_code}: {res.text[:200]}")
                data = res.json()
                return [
                    {"title": r.get("title"), "snippet": r.get("content"), "url": r.get("url")}
                    for r in data.get("results", [])
                ]
        except Exception as err:
            return [{"title": "Error", "snippet": f"Tavily search failed: {err}"}]

    if exa_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.post(
                    "https://api.exa.ai/search",
                    headers={"Content-Type": "application/json", "x-api-key": exa_key},
                    json={"query": query, "numResults": 3},
                )
                if res.status_code != 200:
                    raise RuntimeError("Search failed")
                data = res.json()
                return [{"title": r.get("title"), "snippet": r.get("text") or r.get("snippet")} for r in data.get("results", [])]
        except Exception:
            return [{"title": "Error", "snippet": "Search failed to execute."}]

    return [{"title": "Mock Result", "snippet": "Add TAVILY_API_KEY (or EXA_API_KEY) to the mcp-server env for real search results."}]


@mcp.tool()
async def fetch_url(url: str) -> dict:
    """
    Fetch the raw text of a static page when the user asks to read or summarize an
    article/documentation and no browser interaction is needed. NEVER use this when
    the user says open, go to, visit, log in, or click — those are browser_task.
    """
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; IntelliRender/1.0)"})
            if res.status_code != 200:
                return {"error": f"HTTP {res.status_code}"}
            html = res.text
            # Strip tags and collapse whitespace
            text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()[:8000]
            return {"url": url, "text": text, "truncated": len(html) > 8000}
    except Exception as err:
        return {"error": str(err)}


@mcp.tool()
async def browser_task(
    url: str,
    task: str,
    steps: Optional[list[dict[str, Any]]] = None,
    credentials: Optional[dict[str, str]] = None,
) -> dict:
    """
    Control a real browser to perform web tasks: navigate to URLs, click elements,
    fill forms, extract text. ALWAYS use this when the user says open, go to, visit,
    browse, log in to, scrape, or automate a website — even if they only want the
    page title or content. Ask the user for credentials in-chat when required — they
    are passed per-request and never stored.

    `steps` is an ordered list of actions, each { action, selector?, value? } where
    action is one of click | fill | wait | extract | submit.
    `credentials` is { username, password } and is only used as HTTP auth for this run.
    """
    try:
        async with asyncio.timeout(_BROWSER_TIMEOUT_SECONDS):
            async with _browser_semaphore:
                return await _run_browser(url, steps or [], credentials)
    except TimeoutError:
        return {"error": "Browser task timed out after 60s — the page may be too slow or the task too complex."}
    except Exception as exc:
        return {"error": str(exc)}


async def _run_browser(url: str, steps: list[dict[str, Any]], credentials: Optional[dict[str, str]]) -> dict:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()

        # Inject credentials into HTTP auth if provided
        if credentials and credentials.get("username") and credentials.get("password"):
            context = await browser.new_context(
                http_credentials={
                    "username": credentials["username"],
                    "password": credentials["password"],
                }
            )

        page = await context.new_page()
        result_lines: list[str] = []

        await page.goto(url, wait_until="domcontentloaded")

        for step in steps:
            action = str(step.get("action", "")).lower()
            selector = step.get("selector")
            value = step.get("value")
            if action == "click" and selector:
                await page.click(selector)
            elif action == "fill" and selector and value is not None:
                await page.fill(selector, value)
            elif action == "wait":
                await page.wait_for_load_state("networkidle")
            elif action == "extract" and selector:
                result_lines.append(await page.inner_text(selector))
            elif action == "submit" and selector:
                await page.locator(selector).press("Enter")

        # Capture page text as result if no explicit extract steps
        if not result_lines:
            result_lines.append(await page.title())
            body_text = await page.inner_text("body")
            result_lines.append(body_text[:2000])

        # Capture the screenshot and stash it in redis; the chat renders it from
        # the returned short URL. Falls back to has_screenshot only if redis is
        # unavailable — the bytes never reach the model context either way.
        png_bytes = await page.screenshot(type="png")
        screenshot_url = await _store_screenshot(png_bytes)

        await browser.close()

        result = {"result": "\n".join(result_lines), "has_screenshot": True}
        if screenshot_url:
            result["screenshotUrl"] = screenshot_url
        return result
