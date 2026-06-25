import type { McpServiceConfig } from '@/lib/mcp/types';

// Gmail runs as a standalone Node stdio MCP server (like Google Forms) so the
// per-user OAuth refresh token can be injected per-request. The public npm
// `mcp-gmail` package is a library with no CLI bin and cannot be spawned.
export const gmailConfig: McpServiceConfig = {
  command: 'node',
  args: ['services/mcp-stdio/gmail.mjs'],
  envKey: 'GMAIL_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
