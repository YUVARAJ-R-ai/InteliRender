import type { McpServiceConfig } from '@/lib/mcp/types';

export const stripeConfig: McpServiceConfig = {
  command: 'npx',
  args: ['-y', '@stripe/agent-toolkit'],
  envKey: 'STRIPE_SECRET_KEY',
};
