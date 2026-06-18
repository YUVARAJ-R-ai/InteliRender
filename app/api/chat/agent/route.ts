import { streamText, tool, convertToModelMessages, jsonSchema, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai';
import { getSiliconFlowKey } from '@/lib/user-settings';
import { decrypt } from '@/lib/encryption';
import { mcpConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { db } from '@/lib/db';
import { messages as messagesTable, chats } from '@/lib/db/schema';
import { getAppConfig } from '@/lib/app-config';

export const maxDuration = 60;

// Maps service name → the stdio command + env var setup for that MCP server
const DB_MCP_SERVICE_CONFIGS: Record<string, {
  command: string;
  args: string[];
  envKey: string; // env var name for the per-user token
  envTransform?: (token: string) => string;
  // app-level env vars to pull from appConfig (DB key → env var name)
  appConfigEnv?: Record<string, string>;
  // secondary env vars read from conn.metadata JSON (metadata key → env var name)
  metadataEnv?: Record<string, string>;
}> = {
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envKey: 'GITHUB_PERSONAL_ACCESS_TOKEN',
  },
  notion: {
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    envKey: 'OPENAPI_MCP_HEADERS',
    envTransform: (token) => JSON.stringify({ Authorization: `Bearer ${token}` }),
  },
  linear: {
    command: 'npx',
    args: ['-y', '@linear/mcp-server'],
    envKey: 'LINEAR_API_KEY',
  },
  // TODO(#41): google_forms removed — replace with custom MCP server (see issue #42)
  gmail: {
    command: 'npx',
    args: ['-y', 'mcp-gmail'],
    envKey: 'GMAIL_REFRESH_TOKEN',
    appConfigEnv: {
      google_client_id: 'GOOGLE_CLIENT_ID',
      google_client_secret: 'GOOGLE_CLIENT_SECRET',
    },
  },
  google_drive: {
    command: 'npx',
    args: ['-y', 'mcp-google-drive'],
    envKey: 'GOOGLE_REFRESH_TOKEN',
    appConfigEnv: {
      google_client_id: 'GOOGLE_CLIENT_ID',
      google_client_secret: 'GOOGLE_CLIENT_SECRET',
    },
  },
  google_calendar: {
    command: 'npx',
    args: ['-y', 'google-calendar-mcp'],
    envKey: 'GOOGLE_REFRESH_TOKEN',
    appConfigEnv: {
      google_client_id: 'GOOGLE_CLIENT_ID',
      google_client_secret: 'GOOGLE_CLIENT_SECRET',
    },
  },
  stripe: {
    command: 'npx',
    args: ['-y', '@stripe/agent-toolkit'],
    envKey: 'STRIPE_SECRET_KEY',
  },
  postgres: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envKey: 'POSTGRES_CONNECTION_STRING',
  },
  slack: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    envKey: 'SLACK_BOT_TOKEN',
    // SLACK_TEAM_ID is non-secret; stored in mcpConnections.metadata as { teamId }
    metadataEnv: { teamId: 'SLACK_TEAM_ID' },
  },
};

/** Loads connected MCP services from the DB and converts them to server descriptors */
async function loadDbMcpServers(userId: string) {
  const connections = await db
    .select({ service: mcpConnections.service, accessToken: mcpConnections.accessToken, status: mcpConnections.status, metadata: mcpConnections.metadata })
    .from(mcpConnections)
    .where(eq(mcpConnections.userId, userId));

  const servers = [];
  for (const conn of connections) {
    if (conn.status !== 'connected' || !conn.accessToken) continue;
    const cfg = DB_MCP_SERVICE_CONFIGS[conn.service];
    if (!cfg) continue;

    let token: string;
    try { token = decrypt(conn.accessToken); } catch { continue; }

    const envValue = cfg.envTransform ? cfg.envTransform(token) : token;

    // Resolve app-level credentials from DB (overrides process.env)
    const appEnv: Record<string, string> = {};
    if (cfg.appConfigEnv) {
      for (const [dbKey, envVarName] of Object.entries(cfg.appConfigEnv)) {
        const val = await getAppConfig(dbKey);
        if (val) appEnv[envVarName] = val;
      }
    }

    // Resolve secondary non-secret config from conn.metadata (e.g. SLACK_TEAM_ID)
    if (cfg.metadataEnv && conn.metadata) {
      const meta = conn.metadata as Record<string, string>;
      for (const [metaKey, envVarName] of Object.entries(cfg.metadataEnv)) {
        if (meta[metaKey]) appEnv[envVarName] = meta[metaKey];
      }
    }

    servers.push({
      name: conn.service,
      command: cfg.command,
      args: cfg.args,
      isEnabled: true,
      env: { ...appEnv, [cfg.envKey]: envValue },
    });
  }
  return servers;
}

const SYSTEM_PROMPT = `
You are IntelliRender, an agentic visual response engine.

TOOL SELECTION RULES:
- Kanban boards: use render_widget with type kanban. Pass columns under params.columns. Each column needs title, color, and tasks array. Each task needs title and priority (high/medium/low). Example: { type: "kanban", title: "Sprint Board", reasoning: "...", params: { columns: [{ title: "To Do", color: "#6366f1", tasks: [{ title: "Task 1", priority: "high" }] }] } }
- Dashboards: use render_widget with type dashboard and pass params.kpis / params.chart.
- Custom visuals (timelines, mindmaps, flowcharts, simulations, gravity, pomodoro, games): use render_widget with type html-canvas and generate self-contained HTML/CSS/JS.
- Web lookups: use web_search.
- Browser automation: use browser_task whenever the user says "open", "go to", "visit", "log in to", "click", "fill", or "scrape" a website — ANY request to interact with or look at a live page in a browser. When credentials are needed, ask the user for them in-chat first and explain they are used only for this session and never stored.
- Fetch full page content: use fetch_url ONLY when the user asks to read/summarize the text of an article or documentation page and no interaction is needed. If the request says open/go to/visit a site, that is browser_task — never fetch_url.
- Math / financial calculations: use calculate before building a widget with numbers.
- Export data as CSV: use generate_csv, then reply with the returned dataUrl as a markdown download link.
- Complex reasoning: use think before acting.
`;

function getMessageContent(m: any): string {
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

export async function POST(req: Request) {
  const mcpClients: Client[] = [];
  // Maps server name → connected client so compound tools can reuse them
  const mcpClientMap: Record<string, Client> = {};
  try {
    const { messages, chatId, mcpServers, model } = await req.json();

    // Inject per-user SiliconFlow API key from DB (falls back to env if not set)
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const apiKey = userId ? await getSiliconFlowKey(userId) : undefined;

    // Auto-load MCP connections from DB so the agent can use them without manual registration
    const dbMcpServers = userId ? await loadDbMcpServers(userId) : [];
    const allMcpServers = [...(mcpServers ?? []), ...dbMcpServers];

    // 1. Create chat on first message if needed
    let activeChatId = chatId;
    if (!activeChatId) {
      const lastMsgText = getMessageContent(messages[messages.length - 1]);
      const title = lastMsgText.slice(0, 40) + '...' || 'New Chat';
      // Associate the chat with the user so it appears in their list on reload.
      // Without userId the chat is orphaned and filtered out by GET /api/chats.
      const [newChat] = await db.insert(chats).values({ title, userId }).returning();
      activeChatId = newChat.id;
    }

    // 2. Save user message to database
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      await db.insert(messagesTable).values({
        chatId: activeChatId,
        role: 'user',
        content: getMessageContent(lastMessage),
      });
    }

    // All built-in tools use inputSchema: jsonSchema(...) — raw JSON Schema guaranteed
    // to be valid for strict gateways like SiliconFlow/DeepSeek (avoids Zod compilation issues).
    const dynamicTools: Record<string, any> = {
      render_widget: tool({
        description: 'Render an interactive visual widget. Use treemap/code-diff/timeline/network-graph for structured data; html-canvas for custom visuals (timelines, mindmaps, flowcharts, pomodoro).',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            title:       { type: 'string', description: 'Widget title' },
            type:        { type: 'string', enum: ['chart','kanban','dashboard','table','form','custom','html-canvas','treemap','code-diff','timeline','network-graph'] },
            html:        { type: 'string', description: 'Full HTML/CSS/JS for html-canvas type' },
            jsx_or_html: { type: 'string', description: 'Alias for html' },
            params:      { type: 'object', description: 'Structured data for kanban/dashboard/gravity/treemap/code-diff/timeline/network-graph widgets', additionalProperties: true },
            reasoning:   { type: 'string', description: 'Why this widget type was chosen' },
          },
          required: ['title', 'type', 'reasoning'],
          additionalProperties: false,
        } as any),
        execute: async (params: any) => {
          if (params.type === 'kanban') {
            // Accept columns at params.params.columns (nested) OR params.columns (flat)
            const rawColumns: any[] = params.params?.columns ?? (params as any).columns ?? [];
            // Normalise the tasks key — model may use items/cards/todos instead of tasks
            const columns = rawColumns.map((col: any) => ({
              ...col,
              tasks: col.tasks ?? col.items ?? col.cards ?? col.todos ?? [],
            }));
            return { type: 'kanban', columns };
          }
          if (params.type === 'dashboard' && params.params) {
            return { type: 'dashboard', kpis: params.params.kpis, chart: params.params.chart, table: params.params.table };
          }
          if (params.type === 'gravity' && params.params) {
            return { type: 'gravity', bodies: params.params.bodies, showForceArrows: params.params.showForceArrows, showOrbitalPaths: params.params.showOrbitalPaths };
          }
          if (params.type === 'html-canvas' && (params.html || params.jsx_or_html)) {
            return { type: 'html-canvas', html: params.html || params.jsx_or_html };
          }
          // Return FLAT data (spread params.params) to match the kanban/dashboard/gravity
          // convention. MessageBubble wraps the whole tool result as the widget's `params`,
          // so nesting under a `params` key here would double-nest and break the widget
          // (and crash recharts with undefined data → "Maximum update depth exceeded").
          if (params.type === 'treemap' && params.params) {
            return { type: 'treemap', ...params.params };
          }
          if (params.type === 'code-diff' && params.params) {
            return { type: 'code-diff', ...params.params };
          }
          if (params.type === 'timeline' && params.params) {
            return { type: 'timeline', ...params.params };
          }
          if (params.type === 'network-graph' && params.params) {
            return { type: 'network-graph', ...params.params };
          }
          return params;
        }
      } as any),
      web_search: tool({
        description: 'Search the web for up-to-date information.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
          additionalProperties: false,
        } as any),
        execute: async ({ query }: any) => {
          if (!process.env.EXA_API_KEY) {
            return [{ title: "Mock Result", snippet: "Add EXA_API_KEY to .env for real search results." }];
          }
          try {
            const res = await fetch('https://api.exa.ai/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.EXA_API_KEY
              },
              body: JSON.stringify({ query, numResults: 3 })
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            return data.results.map((r: any) => ({ title: r.title, snippet: r.text || r.snippet }));
          } catch (err) {
            return [{ title: "Error", snippet: "Search failed to execute." }];
          }
        }
      } as any),
      browser_task: tool({
        description: 'Control a real browser to perform web tasks: navigate to URLs, click elements, fill forms, extract text, take screenshots. ALWAYS use this when the user says open, go to, visit, browse, log in to, scrape, or automate a website — even if they only want the page title or content. Ask the user for credentials in-chat when required — they are passed per-request and never stored.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            url:   { type: 'string', description: 'The starting URL' },
            task:  { type: 'string', description: 'Plain-English description of what to do' },
            steps: {
              type: 'array',
              description: 'Ordered list of browser actions',
              items: {
                type: 'object',
                properties: {
                  action:   { type: 'string', enum: ['click','fill','wait','extract','submit'], description: 'Action to perform' },
                  selector: { type: 'string', description: 'CSS selector for the target element' },
                  value:    { type: 'string', description: 'Value for fill action' },
                },
                required: ['action'],
                additionalProperties: false,
              },
            },
            credentials: {
              type: 'object',
              description: 'Login credentials — only include when the user explicitly provided them',
              properties: {
                username: { type: 'string' },
                password: { type: 'string' },
              },
              required: ['username', 'password'],
              additionalProperties: false,
            },
          },
          required: ['url', 'task'],
          additionalProperties: false,
        } as any),
        execute: async (params: any) => {
          const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
          try {
            const res = await fetch(`${fastApiUrl}/api/v1/browser/run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
              signal: AbortSignal.timeout(65_000),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ detail: res.statusText }));
              return { error: err.detail || 'Browser task failed' };
            }
            const data = await res.json();
            // Strip screenshot from agent context — too large for model context
            return { result: data.result, has_screenshot: !!data.screenshot };
          } catch (err: any) {
            const msg = String(err?.message ?? err);
            const cause = String((err?.cause as any)?.code ?? '');
            if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
              return { error: 'Browser task timed out after 65s — the page may be too slow or the task too complex.' };
            }
            if (cause === 'ECONNREFUSED' || msg.includes('fetch failed')) {
              return {
                error: `Browser service is not running at ${fastApiUrl}. Start it with \`docker compose up api\` (or \`make dev\`) and try again.`,
              };
            }
            return { error: msg || 'Browser task failed' };
          }
        }
      } as any),
      think: tool({
        description: 'Think through complex problems step-by-step before responding or calling other tools.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            thought: { type: 'string', description: 'Your internal reasoning' },
          },
          required: ['thought'],
          additionalProperties: false,
        } as any),
        execute: async ({ thought }: any) => {
          return { thought, acknowledged: true };
        }
      } as any),

      fetch_url: tool({
        description: 'Fetch the raw text of a static page when the user asks to read or summarize an article/documentation and no browser interaction is needed. NEVER use this when the user says open, go to, visit, log in, or click — those are browser_task.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to fetch' },
          },
          required: ['url'],
          additionalProperties: false,
        } as any),
        execute: async ({ url }: any) => {
          try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelliRender/1.0)' } });
            if (!res.ok) return { error: `HTTP ${res.status}` };
            const html = await res.text();
            // Strip tags and collapse whitespace
            const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
            return { url, text, truncated: html.length > 8000 };
          } catch (err: any) {
            return { error: err.message };
          }
        }
      } as any),

      calculate: tool({
        description: 'Evaluate a mathematical expression safely. Use for financial calculations, percentages, or any numeric computation before building a widget.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression e.g. "50000 * Math.pow(1.07, 15)"' },
            description: { type: 'string', description: 'What this calculation represents' },
          },
          required: ['expression'],
          additionalProperties: false,
        } as any),
        execute: async ({ expression, description }: any) => {
          try {
            // Restrict to safe math — only allow numbers, operators, Math.*, and parens
            if (/[^0-9+\-*/().,\s%MathPIEabcdefghijklmnopqrstuvwxyz]/.test(expression)) {
              return { error: 'Expression contains unsafe characters' };
            }
            // eslint-disable-next-line no-new-func
            const result = Function(`'use strict'; return (${expression})`)();
            return { expression, result, description: description || '' };
          } catch (err: any) {
            return { error: err.message };
          }
        }
      } as any),

      generate_csv: tool({
        description: 'Generate a downloadable CSV from structured data. Returns a data URI — reply with it as a markdown link: [Download CSV](dataUrl).',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            headers: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
            rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Data rows' },
            filename: { type: 'string', description: 'Optional suggested filename (without .csv)' },
          },
          required: ['headers', 'rows'],
          additionalProperties: false,
        } as any),
        execute: async ({ headers, rows, filename }: any) => {
          const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const csv = [headers, ...rows].map((row: string[]) => row.map(escape).join(',')).join('\n');
          const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
          return { dataUrl, rowCount: rows.length, filename: (filename || 'export') + '.csv' };
        }
      } as any),

    };

    // Load custom MCP servers (UI-registered + DB-connected)
    if (Array.isArray(allMcpServers)) {
      for (const server of allMcpServers) {
        if (!server.isEnabled || !server.command) continue;
        try {
          const transport = new StdioClientTransport({
            command: server.command,
            args: server.args || [],
            env: {
              ...process.env,
              PATH: process.env.PATH || '',
              // DB-loaded servers carry their own env overrides (tokens, etc.)
              ...(server.env ?? {}),
            },
          });
          const client = new Client(
            { name: server.name || 'custom-mcp-client', version: '1.0.0' },
            { capabilities: {} }
          );
          await client.connect(transport);
          mcpClients.push(client);
          mcpClientMap[server.name] = client;

          const toolsResult = await client.listTools();
          for (const mcpTool of toolsResult.tools) {
            const cleanServerName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const toolName = `${cleanServerName}_${mcpTool.name}`;
            dynamicTools[toolName] = tool({
              description: mcpTool.description || '',
              inputSchema: jsonSchema(mcpTool.inputSchema as any),
              execute: async (args: any) => {
                // Call the corresponding tool on the active MCP subprocess
                const callResult = await client.callTool({
                  name: mcpTool.name,
                  arguments: args
                });
                return callResult;
              }
            });
          }
        } catch (mcpErr) {
          console.error(`Failed to load MCP server ${server.name}:`, mcpErr);
        }
      }
    }

    // Strip large render_widget results from message history before sending to the model.
    // useChat includes previous turns' full tool results (kanban columns, html, etc.)
    // in every follow-up request — these exceed SiliconFlow's payload limit → 400 Bad Request.
    const sanitisedMessages = messages.map((msg: any) => {
      if (!msg.toolInvocations?.length) return msg;
      return {
        ...msg,
        toolInvocations: msg.toolInvocations.map((ti: any) => {
          if (ti.toolName === 'render_widget' && ti.result && ti.state === 'result') {
            return { ...ti, result: { type: ti.result.type, rendered: true } };
          }
          if (ti.toolName === 'browser_task' && ti.result && ti.state === 'result') {
            return { ...ti, result: { result: ti.result.result, has_screenshot: ti.result.has_screenshot } };
          }
          if (ti.toolName === 'fetch_url' && ti.result?.text && ti.state === 'result') {
            return { ...ti, result: { url: ti.result.url, text: ti.result.text.slice(0, 500), truncated: true } };
          }
          return ti;
        }),
      };
    });
    const sdkMessages = await convertToModelMessages(sanitisedMessages);

    const result = streamText({
      model: getModel(apiKey, model),
      messages: sdkMessages,
      system: SYSTEM_PROMPT,
      // AI SDK v6 replaced `maxSteps` with `stopWhen`. Without this the model
      // defaults to stepCountIs(1): it makes the tool call and stops, never
      // producing the follow-up text reply with the form link.
      stopWhen: stepCountIs(15),
      tools: dynamicTools,
      onFinish: async (info: any) => {
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

        // Strip render_widget payloads before saving to DB — the full kanban/dashboard/html
        // data must not be re-sent to the model on follow-up turns (causes 400 Bad Request
        // from SiliconFlow when the serialised tool result exceeds the payload size limit).
        const sanitisedToolInvocations = toolInvocations.map((ti: any) => {
          if (ti.toolName === 'render_widget' && ti.result) {
            return { ...ti, result: { type: ti.result.type, rendered: true } };
          }
          if (ti.toolName === 'browser_task' && ti.result) {
            // Strip screenshot (base64) from DB — only keep the text result
            return { ...ti, result: { result: ti.result.result, has_screenshot: ti.result.has_screenshot } };
          }
          if (ti.toolName === 'fetch_url' && ti.result?.text) {
            // Keep only an excerpt — the full 8000-char page text re-sent on
            // follow-up turns exceeds SiliconFlow's payload limit (400 Bad Request)
            return { ...ti, result: { url: ti.result.url, text: ti.result.text.slice(0, 500), truncated: true } };
          }
          return ti;
        });

        // Save assistant message to DB
        await db.insert(messagesTable).values({
          chatId: activeChatId,
          role: 'assistant',
          content: info.text || '',
          toolInvocations: sanitisedToolInvocations,
          widget,
          widgetHtml,
        });

        // Disconnect MCP clients
        for (const client of mcpClients) {
          try {
            await client.close();
          } catch (e) {
            console.error('Failed to close MCP client', e);
          }
        }
      }
    } as any);

    const response = result.toUIMessageStreamResponse();
    // Pass custom header with activeChatId so client can update its activeChatId!
    response.headers.set('x-chat-id', activeChatId.toString());
    return response;
  } catch (error: any) {
    console.error('Agent route error:', error);
    // Cleanup on error
    for (const client of mcpClients) {
      try {
        await client.close();
      } catch (e) {
        // Ignore
      }
    }
    return new Response(JSON.stringify({ error: error.message ?? String(error) }), { status: 500 });
  }
}
