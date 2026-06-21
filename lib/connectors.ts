import {
  Mail, HardDrive, Calendar, ClipboardList, GitBranch, Layers,
  FileText, CreditCard, Database, MessageSquare,
} from 'lucide-react';

export type ConnectorReadiness = 'ready' | 'experimental';

export interface Connector {
  service: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  authType: 'oauth' | 'pat';
  oauthPath?: string;     // oauth only
  placeholder?: string;   // pat only
  hint?: string;          // pat only — how to get the token
  /** Representative tools this connector exposes (informational). */
  tools: string[];
  /** 'experimental' connectors are shown but flagged as not yet fully working. */
  readiness: ConnectorReadiness;
  /** Optional note shown on experimental connectors. */
  note?: string;
}

export const CONNECTORS: Connector[] = [
  // ── Google services (OAuth) ──
  {
    service: 'gmail',
    label: 'Gmail',
    icon: Mail,
    description: 'Read, search, draft and send emails from your Gmail account.',
    authType: 'oauth',
    oauthPath: '/api/auth/gmail',
    tools: ['list_recent_emails', 'search_emails', 'read_email', 'create_draft', 'send_email'],
    readiness: 'ready',
  },
  {
    service: 'google_forms',
    label: 'Google Forms',
    icon: ClipboardList,
    description: 'Create complete Google Forms in your own account.',
    authType: 'oauth',
    oauthPath: '/api/auth/google-forms',
    tools: ['create_google_form'],
    readiness: 'ready',
  },
  {
    service: 'google_drive',
    label: 'Google Drive',
    icon: HardDrive,
    description: 'List, read, create and manage Drive files.',
    authType: 'oauth',
    oauthPath: '/api/auth/google-drive',
    tools: ['list_files', 'read_file', 'create_file'],
    readiness: 'experimental',
    note: 'Drive’s MCP server doesn’t yet support per-user login — connecting works but tool calls may fail until its custom server is built.',
  },
  {
    service: 'google_calendar',
    label: 'Google Calendar',
    icon: Calendar,
    description: 'Read and create calendar events.',
    authType: 'oauth',
    oauthPath: '/api/auth/google-calendar',
    tools: ['list_events', 'create_event'],
    readiness: 'experimental',
    note: 'Calendar’s MCP server doesn’t yet support per-user login — connecting works but tool calls may fail until its custom server is built.',
  },
  // ── Dev tools (PAT) ──
  { service: 'github', label: 'GitHub', icon: GitBranch, description: 'Repos, issues, PRs, workflow dispatch.', authType: 'pat', placeholder: 'ghp_...', tools: ['search_repositories', 'create_issue', 'get_file_contents'], readiness: 'experimental' },
  { service: 'linear', label: 'Linear', icon: Layers, description: 'Issues, projects, team management.', authType: 'pat', placeholder: 'lin_api_...', tools: ['list_issues', 'create_issue'], readiness: 'experimental' },
  { service: 'notion', label: 'Notion', icon: FileText, description: 'Pages, databases, search.', authType: 'pat', placeholder: 'secret_...', tools: ['search', 'query_database'], readiness: 'experimental' },
  { service: 'stripe', label: 'Stripe', icon: CreditCard, description: 'Revenue dashboards, payments, subscriptions.', authType: 'pat', placeholder: 'sk_live_...', tools: ['list_charges', 'list_subscriptions'], readiness: 'experimental' },
  { service: 'postgres', label: 'PostgreSQL', icon: Database, description: 'Query your Postgres database live.', authType: 'pat', placeholder: 'postgresql://user:pass@host/db', tools: ['query'], readiness: 'experimental' },
  { service: 'slack', label: 'Slack', icon: MessageSquare, description: 'Read channels, send messages, search.', authType: 'pat', placeholder: 'xoxb-...', hint: 'Create a Bot token at api.slack.com/apps → OAuth & Permissions, then paste it here.', tools: ['list_channels', 'post_message'], readiness: 'experimental' },
];
