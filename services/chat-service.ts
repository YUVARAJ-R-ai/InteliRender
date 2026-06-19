import { db } from '@/lib/db';
import { messages as messagesTable, chats } from '@/lib/db/schema';
import { sanitizeToolResult } from '@/utils/sanitize-tool-result';

export function getMessageContent(m: any): string {
  if (typeof m.content === 'string' && m.content) {
    return m.content;
  }
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
  }
  return '';
}

/** Create the chat on the first message if it doesn't exist yet; returns the active chat id. */
export async function getOrCreateChat(
  chatId: number | null | undefined,
  userId: string | null,
  messages: any[],
): Promise<number> {
  let activeChatId = chatId;
  if (!activeChatId) {
    const lastMsgText = getMessageContent(messages[messages.length - 1]);
    const title = lastMsgText.slice(0, 40) + '...' || 'New Chat';
    // Associate the chat with the user so it appears in their list on reload.
    // Without userId the chat is orphaned and filtered out by GET /api/chats.
    const [newChat] = await db.insert(chats).values({ title, userId }).returning();
    activeChatId = newChat.id;
  }
  return activeChatId;
}

/** Persist the latest user message (no-op if the last message isn't from the user). */
export async function saveUserMessage(chatId: number, message: any): Promise<void> {
  if (message?.role === 'user') {
    await db.insert(messagesTable).values({
      chatId,
      role: 'user',
      content: getMessageContent(message),
    });
  }
}

/**
 * Persist the assistant message from a streamText onFinish payload — aggregates
 * tool calls/results across all steps, extracts re-renderable widgets, and saves
 * a sanitised copy of the tool invocations.
 */
export async function saveAssistantMessage(chatId: number, info: any): Promise<void> {
  // Aggregate tool calls/results across ALL steps. The top-level
  // info.toolCalls only holds the FINAL step's calls — a multi-step agent
  // that renders a widget in step 1 then writes a summary in a later step
  // would otherwise lose the widget entirely (final step has no tool calls).
  // AI SDK v6 also renamed the fields: tool calls use `.input` (was `.args`)
  // and results use `.output` (was `.result`).
  const allToolCalls: any[] = [];
  const allToolResults: any[] = [];
  for (const step of (info.steps ?? [])) {
    if (step.toolCalls) allToolCalls.push(...step.toolCalls);
    if (step.toolResults) allToolResults.push(...step.toolResults);
  }
  if (allToolCalls.length === 0 && info.toolCalls) allToolCalls.push(...info.toolCalls);
  if (allToolResults.length === 0 && info.toolResults) allToolResults.push(...info.toolResults);

  const toolInvocations = allToolCalls.map((call: any) => {
    const res = allToolResults.find((r: any) => r.toolCallId === call.toolCallId);
    return {
      state: 'result',
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.input,
      result: res ? res.output : undefined,
    };
  });

  // Extract the full HTML of any generated html-canvas widget so it can be
  // re-rendered after reload. Only the completed result is read here (onFinish),
  // never partial/streaming HTML.
  const htmlWidget = toolInvocations.find(
    (ti: any) => ti.toolName === 'render_widget' && ti.result?.type === 'html-canvas' && ti.result?.html
  );
  const widgetHtml = htmlWidget ? htmlWidget.result.html : null;

  // Persist structured widgets (kanban/dashboard/treemap/etc.) so they can be
  // re-rendered after a reload. The full result is kept in the dedicated
  // `widget` column (NOT in toolInvocations, which is sanitised below and re-sent
  // to the model). Shape matches MessageBubble's live-render path:
  // { type, params: <full tool result> }. html-canvas is handled via widgetHtml.
  const structuredWidgetCall = toolInvocations.find(
    (ti: any) =>
      ti.toolName === 'render_widget' &&
      ti.result?.type &&
      ti.result.type !== 'html-canvas' &&
      ti.result.type !== 'text'
  );
  const widget = structuredWidgetCall
    ? { type: structuredWidgetCall.result.type, params: structuredWidgetCall.result }
    : null;

  // Strip render_widget/browser_task/fetch_url payloads before saving to DB — the
  // full data must not be re-sent to the model on follow-up turns (causes 400 Bad
  // Request from SiliconFlow when the serialised tool result exceeds the limit).
  const sanitisedToolInvocations = toolInvocations.map((ti: any) => {
    const sanitized = sanitizeToolResult(ti.toolName, ti.result);
    return sanitized === ti.result ? ti : { ...ti, result: sanitized };
  });

  // Save assistant message to DB
  await db.insert(messagesTable).values({
    chatId,
    role: 'assistant',
    content: info.text || '',
    toolInvocations: sanitisedToolInvocations,
    widget,
    widgetHtml,
  });
}
