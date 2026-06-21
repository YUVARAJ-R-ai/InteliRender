import type { McpServiceConfig } from '@/lib/mcp/types';

export const gmailConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', 'mcp-gmail'],
  envKey: 'GMAIL_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
