import { generateText } from 'ai';
import { getModel } from '@/lib/ai';
import { getSiliconFlowKey } from '@/lib/user-settings';
import {
  GravityParamsSchema,
  KanbanParamsSchema,
  DashboardParamsSchema,
} from '@/types/widget';
import { db } from '@/lib/db';
import { messages as messagesTable, chats } from '@/lib/db/schema';
import { auth } from '@/auth';

export const maxDuration = 60;

const DECISION_PROMPT = `You are IntelliRender AI — a versatile assistant that can chat, answer questions, AND generate interactive visual widgets.

Decide the best response type for the user's message:
- "text": general conversation, explanations, answers, code reviews, any topic.
- "gravity": physics / orbital / gravity simulations.
- "kanban": task boards, project planning, sprint planning.
- "dashboard": KPIs, charts, metrics, financial data.
- "html-canvas": interactive UI, games, visualizers, calculators, animations — anything that needs running code.

You MUST respond with ONLY a valid JSON object (no markdown fences, no extra text) in this exact format:
{"type": "<type>", "text": "<your response>"}

For "text" type: the "text" field IS your full answer. Make it thorough and helpful.
For "gravity"/"kanban"/"dashboard": include a "params" field with realistic data.
For "html-canvas": just include "type" and "text" (a one-liner description). The HTML will be generated separately.

For "kanban", params MUST use this exact shape (a flat "columns" array — do NOT nest by sprint):
{"columns":[{"title":"Backlog","color":"#888","tasks":[{"title":"Task name","priority":"high"}]},{"title":"In Progress","color":"#888","tasks":[]}]}
priority is one of: "low" | "medium" | "high". For multi-sprint projects, prefix the task title with the sprint, e.g. "[Sprint 1] Define app goals".

Examples:
User: "hello" → {"type":"text","text":"Hello! How can I help you today?"}
User: "create a kanban board" → {"type":"kanban","text":"Here's your project board.","params":{...}}
User: "build a calculator" → {"type":"html-canvas","text":"Here's an interactive calculator for you."}`;

const HTML_GEN_PROMPT = `You are a frontend developer. Output ONLY a complete, standalone HTML document — no explanation, no markdown fences, no JSON wrapper.

Rules:
- Start with <!DOCTYPE html> on the first line.
- Include all CSS in a <style> tag and all JS in a <script> tag inside the document.
- Scripts must be self-executing: define functions AND call them. Use DOMContentLoaded if you need the DOM ready.
- Make the UI fill the full viewport (use width:100%; height:100vh or similar).
- Use a dark background (#1a1a2e or similar) unless the content requires white.
- For canvas-based apps: set canvas.width = window.innerWidth and canvas.height = window.innerHeight - controlsHeight.`;

function buildAiMessages(messages: any[]) {
  return messages.map((m: any) => {
    if (m.role === 'assistant' && m.widget && m.widget.type !== 'text') {
      const prev = m.widget.type === 'html-canvas'
        ? `\n\n[Previous HTML — modify this if the user asks for changes]\n${(m.widget.params?.html ?? '').slice(0, 2000)}`
        : `\n\n[Previous widget params]\n${JSON.stringify(m.widget.params, null, 2).slice(0, 1500)}`;
      return { role: m.role as 'user' | 'assistant', content: m.content + prev };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });
}

function extractJSON(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Strip markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Find first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  // Fallback: treat entire response as text
  return { type: 'text', text: text.trim() };
}

export async function POST(req: Request) {
  try {
    const { messages, chatId, model } = await req.json();

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const apiKey = userId ? await getSiliconFlowKey(userId) : undefined;

    // Create chat on first message
    let activeChatId = chatId;
    if (!activeChatId) {
      const title = messages[messages.length - 1]?.content?.slice(0, 40) + '...' || 'New Chat';
      const [newChat] = await db.insert(chats).values({ title, userId }).returning();
      activeChatId = newChat.id;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      await db.insert(messagesTable).values({
        chatId: activeChatId,
        role: 'user',
        content: lastMessage.content,
      });
    }

    const aiMessages = buildAiMessages(messages);

    // ── Step 1: decide widget type via generateText ──────────────────────
    const decisionResult = await generateText({
      model: getModel(apiKey, model),
      maxOutputTokens: 2000,
      maxRetries: 2,
      messages: aiMessages.map(m => ({ role: m.role, content: m.content })),
      system: DECISION_PROMPT,
    });

    const d = extractJSON(decisionResult.text);
    let aiResponse: { text: string; widget: any };

    if (d.type === 'html-canvas') {
      // ── Step 2: generate the HTML with generateText ──────
      const htmlResult = await generateText({
        model: getModel(apiKey, model),
        maxOutputTokens: 4096,
        maxRetries: 1,
        messages: aiMessages.map(m => ({ role: m.role, content: m.content })),
        system: HTML_GEN_PROMPT,
      });

      // Strip any accidental markdown fences the model might add
      const raw = htmlResult.text.trim();
      const html = raw.startsWith('```')
        ? raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
        : raw;

      aiResponse = {
        text: d.text || 'Here is your interactive widget.',
        widget: { type: 'html-canvas', params: { html } },
      };
    } else if (d.type === 'text' || !d.type) {
      aiResponse = {
        text: d.text || decisionResult.text,
        widget: { type: 'text', params: { content: d.text || decisionResult.text } },
      };
    } else {
      // gravity / kanban / dashboard
      aiResponse = {
        text: d.text || 'Here is your widget.',
        widget: { type: d.type, params: d.params || {} },
      };
    }

    // Persist the full HTML of an html-canvas widget so it survives a reload.
    const widgetHtml = aiResponse.widget?.type === 'html-canvas'
      ? (aiResponse.widget.params?.html ?? null)
      : null;

    await db.insert(messagesTable).values({
      chatId: activeChatId,
      role: 'assistant',
      content: aiResponse.text,
      widget: aiResponse.widget,
      widgetHtml,
    });

    return Response.json({ ...aiResponse, chatId: activeChatId });
  } catch (error: any) {
    console.error('Chat route error:', error);
    return Response.json({ error: error.message ?? String(error) }, { status: 500 });
  }
}
