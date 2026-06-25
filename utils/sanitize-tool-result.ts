/**
 * Strips large/oversized tool-call payloads from message history before they are
 * (a) re-sent to the model on follow-up turns, or (b) saved to the DB.
 *
 * useChat replays previous turns' full tool results in every follow-up request,
 * and the full kanban/html/screenshot/page-text payloads exceed SiliconFlow's
 * payload limit → 400 Bad Request. This collapses them to a minimal marker.
 *
 * Returns the SAME reference when nothing needs stripping, so callers can cheaply
 * detect whether a change occurred (`sanitizeToolResult(...) === original`).
 *
 * Note: `render_widget` is a native Next.js tool (plain dict result), while
 * `browser_task` / `fetch_url` are now served by the Python MCP server — their
 * results arrive as an MCP CallToolResult ({ content: [...], structuredContent }).
 * We read `structuredContent` when present, falling back to the raw shape (which
 * is what DB-loaded follow-up turns carry).
 */
export function sanitizeToolResult(toolName: string, result: any): any {
  if (!result) return result;

  if (toolName === 'render_widget') {
    return { type: result.type, rendered: true };
  }

  const data = result.structuredContent ?? result;

  if (toolName === 'browser_task') {
    // Strip the screenshot bytes but KEEP the tiny screenshotUrl so the image
    // still renders from history/after reload — the base64 never reaches the model.
    return { result: data.result, has_screenshot: data.has_screenshot, screenshotUrl: data.screenshotUrl };
  }

  if (toolName === 'fetch_url' && data?.text) {
    // Keep only an excerpt — the full 8000-char page text re-sent on
    // follow-up turns exceeds SiliconFlow's payload limit (400 Bad Request)
    return { url: data.url, text: data.text.slice(0, 500), truncated: true };
  }

  return result;
}
