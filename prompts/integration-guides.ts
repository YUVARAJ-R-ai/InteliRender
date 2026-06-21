import { BASE_PROMPT } from '@/prompts/base';
import { TOOL_SELECTION_RULES } from '@/prompts/tool-selection';

// Per-service guidance appended to the system prompt ONLY when that integration is
// connected. Keys match service names in lib/mcp (and the `<service>_` tool prefix).
const INTEGRATION_GUIDES: Record<string, string> = {
  github: `- GitHub: the github_* tools manage repositories, issues, and pull requests. Prefer searching/listing before creating, and confirm the target repo with the user when ambiguous.`,
  notion: `- Notion: the notion_* tools read and write pages and databases. Search for the parent page/database first, then create or update content under it.`,
  linear: `- Linear: the linear_* tools manage issues, projects, and cycles. Resolve the team/project before creating an issue, and set a sensible priority and status.`,
  gmail: `- Gmail: the gmail_* tools read, search, and send email. Draft messages for the user to review before sending unless they explicitly ask you to send immediately.`,
  google_drive: `- Google Drive: the google_drive_* tools search, read, and manage files. Search by name before opening, and prefer linking the file rather than dumping its full contents.`,
  google_calendar: `- Google Calendar: the google_calendar_* tools read and create events. Confirm the date, time, and timezone with the user before creating or modifying an event.`,
  google_forms: `- Google Forms: use create_google_form to build a form with a title, description, and a list of questions. Confirm the questions with the user, then reply with the returned form link.`,
  stripe: `- Stripe: the stripe_* tools manage customers, products, prices, and payment links. Treat all actions as production unless told otherwise — confirm amounts and currency before creating anything.`,
  postgres: `- Postgres: the postgres_* tools run SQL queries. Inspect the schema before querying, prefer read-only SELECTs, and confirm with the user before any write or destructive statement.`,
  slack: `- Slack: the slack_* tools read channels and post messages. Confirm the target channel before posting, and keep messages concise.`,
};

/**
 * Composes the full system prompt: base identity + tool selection rules, plus a
 * guidance block for every connected integration. `activeTools` is the set of
 * registered tool names (e.g. "github_create_issue", "create_google_form") — a
 * service's guide is included when any tool matches its name or `<service>_` prefix.
 */
export function buildSystemPrompt(activeTools: Set<string>): string {
  let prompt = `\n${BASE_PROMPT}\n\n${TOOL_SELECTION_RULES}\n`;

  const tools = [...activeTools];
  const guides: string[] = [];
  for (const [service, guide] of Object.entries(INTEGRATION_GUIDES)) {
    const isActive = tools.some((t) => t === service || t.startsWith(`${service}_`));
    if (isActive) guides.push(guide);
  }

  if (guides.length > 0) {
    prompt += `\nCONNECTED INTEGRATIONS — you have live access to these. Use them when relevant:\n${guides.join('\n')}\n`;
  }

  return prompt;
}
