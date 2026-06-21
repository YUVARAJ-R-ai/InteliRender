import { tool, jsonSchema } from 'ai';
import { eq } from 'drizzle-orm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { db } from '@/lib/db';
import { mcpConnections, customMcpServers } from '@/lib/db/schema';
import { decrypt } from '@/lib/encryption';
import { getAppConfig } from '@/lib/app-config';
import { MCP_SERVICE_CONFIGS } from '@/lib/mcp';

/**
 * Loads admin-managed custom MCP servers (stdio) from the DB. These replace the
 * old per-browser localStorage list — every Agent Loop session spawns the
 * enabled ones as stdio child processes.
 */
async function loadCustomMcpServers() {
  const rows = await db
    .select({
      name: customMcpServers.name,
      command: customMcpServers.command,
      args: customMcpServers.args,
    })
    .from(customMcpServers)
    .where(eq(customMcpServers.isEnabled, true));

  return rows.map((s) => ({
    name: s.name,
    command: s.command,
    args: s.args ?? [],
    isEnabled: true,
  }));
}

/** Loads connected MCP services from the DB and converts them to server descriptors */
async function loadDbMcpServers(userId: string) {
  const connections = await db
    .select({ service: mcpConnections.service, accessToken: mcpConnections.accessToken, status: mcpConnections.status, metadata: mcpConnections.metadata })
    .from(mcpConnections)
    .where(eq(mcpConnections.userId, userId));

  const servers = [];
  for (const conn of connections) {
    if (conn.status !== 'connected' || !conn.accessToken) continue;
    const cfg = MCP_SERVICE_CONFIGS[conn.service];
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

/**
 * Loads all MCP servers (UI-registered + DB-connected + the internal HTTP server),
 * connects to them, and returns the connected clients plus the tools they expose.
 */
export async function loadServers(
  userId: string | null,
  clientMcpServers: any[] | undefined,
): Promise<{ clients: Client[]; dynamicTools: Record<string, any> }> {
  const clients: Client[] = [];
  const dynamicTools: Record<string, any> = {};

  // Auto-load MCP connections from DB so the agent can use them without manual registration
  const dbMcpServers = userId ? await loadDbMcpServers(userId) : [];
  // Admin-managed custom stdio servers (replaces the old localStorage list)
  const customServers = await loadCustomMcpServers();
  const allMcpServers = [...(clientMcpServers ?? []), ...customServers, ...dbMcpServers];

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
        clients.push(client);

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

  // Auto-connect to the internal MCP server (services/mcp-server) when MCP_SERVER_URL is set.
  // No manual drawer registration needed — tools appear automatically in every chat session.
  if (process.env.MCP_SERVER_URL) {
    try {
      const transport = new StreamableHTTPClientTransport(new URL(process.env.MCP_SERVER_URL));
      const client = new Client({ name: 'intellirender-mcp-server', version: '1.0.0' }, { capabilities: {} });
      await client.connect(transport);
      clients.push(client);

      const toolsResult = await client.listTools();
      for (const mcpTool of toolsResult.tools) {
        dynamicTools[mcpTool.name] = tool({
          description: mcpTool.description || '',
          inputSchema: jsonSchema(mcpTool.inputSchema as any),
          execute: async (args: any) => client.callTool({ name: mcpTool.name, arguments: args }),
        });
      }
    } catch (err) {
      console.error('Failed to connect to internal MCP server:', err);
    }
  }

  return { clients, dynamicTools };
}

/** Disconnect all MCP clients, ignoring individual close failures. */
export async function cleanupClients(clients: Client[]): Promise<void> {
  for (const client of clients) {
    try {
      await client.close();
    } catch (e) {
      console.error('Failed to close MCP client', e);
    }
  }
}
