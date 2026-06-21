#!/usr/bin/env node
/**
 * Standalone Gmail MCP server (stdio transport), written in Node so it runs via
 * `node` in the same image as the other integrations — no extra npm package
 * needed (the public `mcp-gmail` package is a library with no CLI bin, so it
 * cannot be spawned via npx).
 *
 * The Next.js agent spawns this per-request via StdioClientTransport
 * (see lib/mcp/configs/gmail.ts), injecting the per-user OAuth credentials
 * through env vars:
 *
 *   GMAIL_REFRESH_TOKEN | GOOGLE_REFRESH_TOKEN — the user's refresh token (decrypted from DB)
 *   GOOGLE_CLIENT_ID      — app OAuth client id
 *   GOOGLE_CLIENT_SECRET  — app OAuth client secret
 *
 * Uses only @modelcontextprotocol/sdk (already a repo dependency) + global fetch.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function getAccessToken() {
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // The agent injects the token under GMAIL_REFRESH_TOKEN; fall back to the
      // shared GOOGLE_REFRESH_TOKEN name for safety.
      refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Google access token');
  }
  return data.access_token;
}

async function gmailFetch(path, accessToken, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Gmail API ${res.status}`);
  }
  return data;
}

function header(payload, name) {
  const h = payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

/** Recursively pull the first text/plain body (falls back to text/html, tags stripped). */
function extractBody(payload) {
  if (!payload) return '';
  if (payload.body?.data && (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html')) {
    const text = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    return payload.mimeType === 'text/html' ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : text;
  }
  for (const part of payload.parts ?? []) {
    const found = extractBody(part);
    if (found) return found;
  }
  return '';
}

/** List message summaries (id, from, subject, date, snippet) for a Gmail search query. */
async function listSummaries(query, max, accessToken) {
  const params = new URLSearchParams({ maxResults: String(Math.min(max || 10, 50)) });
  if (query) params.set('q', query);
  const list = await gmailFetch(`/messages?${params}`, accessToken);
  const ids = (list.messages ?? []).map((m) => m.id);
  const summaries = await Promise.all(
    ids.map(async (id) => {
      const msg = await gmailFetch(
        `/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        accessToken,
      );
      return {
        id,
        from: header(msg.payload, 'From'),
        subject: header(msg.payload, 'Subject'),
        date: header(msg.payload, 'Date'),
        snippet: msg.snippet ?? '',
      };
    }),
  );
  return summaries;
}

async function readEmail(id, accessToken) {
  const msg = await gmailFetch(`/messages/${id}?format=full`, accessToken);
  return {
    id,
    from: header(msg.payload, 'From'),
    to: header(msg.payload, 'To'),
    subject: header(msg.payload, 'Subject'),
    date: header(msg.payload, 'Date'),
    body: extractBody(msg.payload).slice(0, 8000),
  };
}

function buildRaw({ to, subject, body, cc, bcc }) {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: ${subject ?? ''}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ].filter(Boolean).join('\r\n');
  return Buffer.from(`${lines}\r\n\r\n${body ?? ''}`).toString('base64url');
}

async function createDraft(args, accessToken) {
  const draft = await gmailFetch('/drafts', accessToken, {
    method: 'POST',
    body: JSON.stringify({ message: { raw: buildRaw(args) } }),
  });
  return { draftId: draft.id, messageId: draft.message?.id, status: 'draft created' };
}

async function sendEmail(args, accessToken) {
  const sent = await gmailFetch('/messages/send', accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw: buildRaw(args) }),
  });
  return { messageId: sent.id, status: 'sent' };
}

const RECIPIENT_PROPS = {
  to: { type: 'string', description: 'Recipient email address(es), comma-separated' },
  subject: { type: 'string', description: 'Email subject' },
  body: { type: 'string', description: 'Plain-text email body' },
  cc: { type: 'string', description: 'Optional CC address(es)' },
  bcc: { type: 'string', description: 'Optional BCC address(es)' },
};

const TOOLS = [
  {
    name: 'list_recent_emails',
    description: 'List the most recent emails in the inbox with sender, subject, date and a snippet. Use this to read and summarize the user’s inbox.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'How many recent emails to return (default 10, max 50)' },
        query: { type: 'string', description: 'Optional Gmail search filter, e.g. "is:unread" or "in:inbox"' },
      },
      additionalProperties: false,
    },
    handler: (args, token) => listSummaries(args.query ?? 'in:inbox', args.count ?? 10, token),
  },
  {
    name: 'search_emails',
    description: 'Search emails using Gmail search syntax (e.g. "from:alice is:unread", "subject:invoice newer_than:7d"). Returns matching message summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query' },
        count: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: (args, token) => listSummaries(args.query, args.count ?? 10, token),
  },
  {
    name: 'read_email',
    description: 'Read the full content (headers + body) of a single email by its message id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Gmail message id (from list/search results)' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args, token) => readEmail(args.id, token),
  },
  {
    name: 'create_draft',
    description: 'Create a draft email in the user’s Gmail (not sent). Returns the draft id.',
    inputSchema: { type: 'object', properties: RECIPIENT_PROPS, required: ['to', 'subject', 'body'], additionalProperties: false },
    handler: (args, token) => createDraft(args, token),
  },
  {
    name: 'send_email',
    description: 'Send an email immediately from the user’s Gmail account. This is irreversible — confirm intent before using.',
    inputSchema: { type: 'object', properties: RECIPIENT_PROPS, required: ['to', 'subject', 'body'], additionalProperties: false },
    handler: (args, token) => sendEmail(args, token),
  },
];

const server = new Server({ name: 'gmail', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find((t) => t.name === request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  try {
    const accessToken = await getAccessToken();
    const result = await tool.handler(request.params.arguments ?? {}, accessToken);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], structuredContent: { error: message }, isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
