import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai';
import { getSiliconFlowKey } from '@/lib/user-settings';
import { auth } from '@/auth';
import { agentTools } from '@/tools';
import { buildSystemPrompt } from '@/prompts/integration-guides';
import { getOrCreateChat, saveUserMessage, saveAssistantMessage } from '@/services/chat-service';
import { loadServers, cleanupClients } from '@/services/mcp-service';
import { sanitizeToolResult } from '@/utils/sanitize-tool-result';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const maxDuration = 60;

export async function POST(req: Request) {
  const mcpClients: Client[] = [];
  try {
    const { messages, chatId, mcpServers, model } = await req.json();

    // Inject per-user SiliconFlow API key from DB (falls back to env if not set)
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const apiKey = userId ? await getSiliconFlowKey(userId) : undefined;

    // 1. Create chat on first message if needed
    const activeChatId = await getOrCreateChat(chatId, userId, messages);

    // 2. Save user message to database
    await saveUserMessage(activeChatId, messages[messages.length - 1]);

    // 3. Load all MCP servers (UI-registered + DB-connected + internal HTTP server)
    const { clients, dynamicTools } = await loadServers(userId, mcpServers);
    mcpClients.push(...clients);

    // Built-in tools + dynamically discovered MCP tools
    const tools = { ...agentTools, ...dynamicTools };

    // Append per-integration guidance for every connected service
    const systemPrompt = buildSystemPrompt(new Set(Object.keys(dynamicTools)));

    // Strip large render_widget/browser_task/fetch_url results from message history
    // before sending to the model. useChat includes previous turns' full tool results
    // (kanban columns, html, etc.) in every follow-up request — these exceed
    // SiliconFlow's payload limit → 400 Bad Request.
    const sanitisedMessages = messages.map((msg: any) => {
      if (!msg.toolInvocations?.length) return msg;
      return {
        ...msg,
        toolInvocations: msg.toolInvocations.map((ti: any) => {
          if (ti.state !== 'result' || !ti.result) return ti;
          const sanitized = sanitizeToolResult(ti.toolName, ti.result);
          return sanitized === ti.result ? ti : { ...ti, result: sanitized };
        }),
      };
    });
    const sdkMessages = await convertToModelMessages(sanitisedMessages);

    const result = streamText({
      model: getModel(apiKey, model),
      messages: sdkMessages,
      system: systemPrompt,
      // AI SDK v6 replaced `maxSteps` with `stopWhen`. Without this the model
      // defaults to stepCountIs(1): it makes the tool call and stops, never
      // producing the follow-up text reply with the form link.
      stopWhen: stepCountIs(15),
      tools,
      onFinish: async (info: any) => {
        await saveAssistantMessage(activeChatId, info);
        await cleanupClients(mcpClients);
      },
    } as any);

    const response = result.toUIMessageStreamResponse();
    // Pass custom header with activeChatId so client can update its activeChatId!
    response.headers.set('x-chat-id', activeChatId.toString());
    return response;
  } catch (error: any) {
    console.error('Agent route error:', error);
    // Cleanup on error
    await cleanupClients(mcpClients);
    return new Response(JSON.stringify({ error: error.message ?? String(error) }), { status: 500 });
  }
}
