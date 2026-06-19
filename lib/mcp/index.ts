import type { McpServiceConfig } from '@/lib/mcp/types';
import { githubConfig } from '@/lib/mcp/configs/github';
import { notionConfig } from '@/lib/mcp/configs/notion';
import { linearConfig } from '@/lib/mcp/configs/linear';
import { gmailConfig } from '@/lib/mcp/configs/gmail';
import { googleDriveConfig } from '@/lib/mcp/configs/google-drive';
import { googleCalendarConfig } from '@/lib/mcp/configs/google-calendar';
import { googleFormsConfig } from '@/lib/mcp/configs/google-forms';
import { stripeConfig } from '@/lib/mcp/configs/stripe';
import { postgresConfig } from '@/lib/mcp/configs/postgres';
import { slackConfig } from '@/lib/mcp/configs/slack';

export type { McpServiceConfig } from '@/lib/mcp/types';

// Maps service name → the stdio command + env var setup for that MCP server
export const MCP_SERVICE_CONFIGS: Record<string, McpServiceConfig> = {
  github: githubConfig,
  notion: notionConfig,
  linear: linearConfig,
  gmail: gmailConfig,
  google_drive: googleDriveConfig,
  google_calendar: googleCalendarConfig,
  google_forms: googleFormsConfig,
  stripe: stripeConfig,
  postgres: postgresConfig,
  slack: slackConfig,
};
