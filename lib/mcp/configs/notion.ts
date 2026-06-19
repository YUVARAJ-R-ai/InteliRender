import type { McpServiceConfig } from '@/lib/mcp/types';

export const notionConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@notionhq/notion-mcp-server'],
  envKey: 'OPENAPI_MCP_HEADERS',
  envTransform: (token) => JSON.stringify({ Authorization: `Bearer ${token}` }),
};
