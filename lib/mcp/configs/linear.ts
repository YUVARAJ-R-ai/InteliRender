import type { McpServiceConfig } from '@/lib/mcp/types';

export const linearConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@linear/mcp-server'],
  envKey: 'LINEAR_API_KEY',
};
