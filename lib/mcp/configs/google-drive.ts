import type { McpServiceConfig } from '@/lib/mcp/types';

// Custom Node stdio server (like Gmail/Forms) — the public mcp-google-drive
// package only supports a shared service account, not per-user OAuth tokens.
export const googleDriveConfig: McpServiceConfig = {
  command: 'node',
  args: ['services/mcp-stdio/google-drive.mjs'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
