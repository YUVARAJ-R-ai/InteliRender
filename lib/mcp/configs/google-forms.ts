import type { McpServiceConfig } from '@/lib/mcp/types';

// Google Forms runs as a standalone Python stdio MCP server (not the persistent
// HTTP server) so the per-user OAuth refresh token can be injected per-request.
export const googleFormsConfig: McpServiceConfig = {
  command: 'python',
  args: ['services/mcp-server/tools/google_forms_stdio.py'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
