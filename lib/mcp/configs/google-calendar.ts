import type { McpServiceConfig } from '@/lib/mcp/types';

// Custom Node stdio server (like Gmail/Forms) — the public google-calendar-mcp
// package uses its own file-based OAuth flow, not per-user injected tokens.
export const googleCalendarConfig: McpServiceConfig = {
  command: 'node',
  args: ['services/mcp-stdio/google-calendar.mjs'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
