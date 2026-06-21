import type { McpServiceConfig } from '@/lib/mcp/types';

export const slackConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-slack'],
  envKey: 'SLACK_BOT_TOKEN',
  // SLACK_TEAM_ID is non-secret; stored in mcpConnections.metadata as { teamId }
  metadataEnv: { teamId: 'SLACK_TEAM_ID' },
};
