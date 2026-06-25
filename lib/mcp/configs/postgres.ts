import type { McpServiceConfig } from '@/lib/mcp/types';

export const postgresConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres'],
  envKey: 'POSTGRES_CONNECTION_STRING',
};
