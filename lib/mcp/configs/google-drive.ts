import type { McpServiceConfig } from '@/lib/mcp/types';

export const googleDriveConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', 'mcp-google-drive'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  appConfigEnv: {
    google_client_id: 'GOOGLE_CLIENT_ID',
    google_client_secret: 'GOOGLE_CLIENT_SECRET',
  },
};
