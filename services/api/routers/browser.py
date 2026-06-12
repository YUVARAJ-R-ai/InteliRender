import asyncio
import base64
from fastapi import APIRouter, HTTPException
from schemas.browser import BrowserRunRequest, BrowserRunResponse

router = APIRouter()

# One concurrent browser session at a time (prevents resource exhaustion)
_semaphore = asyncio.Semaphore(1)
TIMEOUT_SECONDS = 60


@router.post("/browser/run", response_model=BrowserRunResponse)
async def browser_run(req: BrowserRunRequest) -> BrowserRunResponse:
    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async with _semaphore:
                return await _execute(req)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Browser task timed out after 60 seconds")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


async def _execute(req: BrowserRunRequest) -> BrowserRunResponse:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()

        # Inject credentials into HTTP auth if provided
        if req.credentials:
            context = await browser.new_context(
                http_credentials={
                    "username": req.credentials.username,
                    "password": req.credentials.password,
                }
            )

        page = await context.new_page()
        result_lines: list[str] = []

        await page.goto(req.url, wait_until="domcontentloaded")

        for step in req.steps:
            action = step.action.lower()
            if action == "click" and step.selector:
                await page.click(step.selector)
            elif action == "fill" and step.selector and step.value is not None:
                await page.fill(step.selector, step.value)
            elif action == "wait":
                await page.wait_for_load_state("networkidle")
            elif action == "extract" and step.selector:
                text = await page.inner_text(step.selector)
                result_lines.append(text)
            elif action == "submit" and step.selector:
                await page.locator(step.selector).press("Enter")

        # Capture page text as result if no explicit extract steps
        if not result_lines:
            result_lines.append(await page.title())
            body_text = await page.inner_text("body")
            result_lines.append(body_text[:2000])

        screenshot_bytes = await page.screenshot(type="png")
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

        await browser.close()

        return BrowserRunResponse(
            result="\n".join(result_lines),
            screenshot=screenshot_b64,
        )
