import type { McpServiceConfig } from '@/lib/mcp/types';

export const githubConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  envKey: 'GITHUB_PERSONAL_ACCESS_TOKEN',
};
