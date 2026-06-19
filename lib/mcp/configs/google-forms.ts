import type { McpServiceConfig } from '@/lib/mcp/types';

// Google Forms runs as a standalone Node stdio MCP server (not the persistent
// HTTP server) so the per-user OAuth refresh token can be injected per-request.
// Node (not Python) so it runs in the same image as the npx-based integrations.
export const googleFormsConfig: McpServiceConfig = {
  command: 'node',
  args: ['services/mcp-stdio/google-forms.mjs'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
