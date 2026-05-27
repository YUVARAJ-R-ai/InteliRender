import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai';
import {
  AIResponseSchema,
  GravityParamsSchema,
  KanbanParamsSchema,
  DashboardParamsSchema,
} from '@/types/widget';
import { db } from '@/lib/db';
import { messages as messagesTable, chats } from '@/lib/db/schema';

export const maxDuration = 60;

// Step 1 schema: decide widget type + produce all non-HTML params in one shot.
// html-canvas is intentionally excluded — HTML is generated separately in step 2.
const DecisionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'),      text: z.string() }),
  z.object({ type: z.literal('gravity'),   text: z.string(), params: GravityParamsSchema }),
  z.object({ type: z.literal('kanban'),    text: z.string(), params: KanbanParamsSchema }),
  z.object({ type: z.literal('dashboard'), text: z.string(), params: DashboardParamsSchema }),
  z.object({ type: z.literal('html-canvas'), text: z.string() }),
]);

const DECISION_PROMPT = `
You are IntelliRender AI — a versatile assistant that can chat, answer questions, AND generate interactive visual widgets.

Decide the best response type:
- "text": general conversation, explanations, answers, code reviews, any topic. Give a complete, helpful, thorough answer in the "text" field.
- "gravity": physics / orbital / gravity simulations.
- "kanban": task boards, project planning, sprint planning.
- "dashboard": KPIs, charts, metrics, financial data.
- "html-canvas": interactive UI, games, visualizers, calculators, animations — anything that needs running code.

Output a JSON object with:
- "type": one of the above
- "text": your full response (for "text" type this IS the answer; for widgets this is a one-liner like "Here is your bubble sort visualizer.")
- "params": required only for gravity / kanban / dashboard — populate with realistic data.

For "html-canvas" and "text" types, omit "params".
`;

const HTML_GEN_PROMPT = `
You are a frontend developer. Output ONLY a complete, standalone HTML document — no explanation, no markdown fences, no JSON.

Rules:
- Start with <!DOCTYPE html> on the first line.
- Include all CSS in a <style> tag and all JS in a <script> tag inside the document.
- Scripts must be self-executing: define functions AND call them. Use DOMContentLoaded if you need the DOM ready.
- Make the UI fill the full viewport (use width:100%; height:100vh or similar).
- Use a dark background (#1a1a2e or similar) unless the content requires white.
- For canvas-based apps: set canvas.width = window.innerWidth and canvas.height = window.innerHeight - controlsHeight.
`;

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

export async function POST(req: Request) {
  try {
    const { messages, chatId } = await req.json();

    // Create chat on first message
    let activeChatId = chatId;
    if (!activeChatId) {
      const title = messages[messages.length - 1]?.content?.slice(0, 40) + '...' || 'New Chat';
      const [newChat] = await db.insert(chats).values({ title }).returning();
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

    // ── Step 1: decide widget type (small schema, fast) ──────────────────────
    const decision = await generateObject({
      model: getModel(),
      maxOutputTokens: 1500,
      maxRetries: 1,
      messages: aiMessages,
      system: DECISION_PROMPT,
      schema: DecisionSchema,
    });

    const d = decision.object;
    let aiResponse: { text: string; widget: any };

    if (d.type === 'html-canvas') {
      // ── Step 2: generate the HTML with generateText (no JSON escaping) ──────
      const htmlResult = await generateText({
        model: getModel(),
        maxOutputTokens: 4096,
        maxRetries: 1,
        messages: aiMessages,
        system: HTML_GEN_PROMPT,
      });

      // Strip any accidental markdown fences the model might add
      const raw = htmlResult.text.trim();
      const html = raw.startsWith('```')
        ? raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
        : raw;

      aiResponse = {
        text: d.text,
        widget: { type: 'html-canvas', params: { html } },
      };
    } else if (d.type === 'text') {
      aiResponse = {
        text: d.text,
        widget: { type: 'text', params: { content: d.text } },
      };
    } else {
      aiResponse = {
        text: d.text,
        widget: { type: d.type, params: (d as any).params },
      };
    }

    await db.insert(messagesTable).values({
      chatId: activeChatId,
      role: 'assistant',
      content: aiResponse.text,
      widget: aiResponse.widget,
    });

    return Response.json({ ...aiResponse, chatId: activeChatId });
  } catch (error: any) {
    console.error('Chat route error:', error);
    return Response.json({ error: error.message ?? String(error) }, { status: 500 });
  }
}
