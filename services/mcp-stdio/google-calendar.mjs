#!/usr/bin/env node
/**
 * Standalone Google Calendar MCP server (stdio transport). Mirrors gmail.mjs —
 * the public `google-calendar-mcp` package uses its own file-based OAuth flow and
 * can't consume the per-user refresh token this app injects.
 *
 * Spawned per-request by the Next.js agent (see lib/mcp/configs/google-calendar.ts)
 * with env vars:
 *   GOOGLE_REFRESH_TOKEN  — the user's refresh token (decrypted from DB)
 *   GOOGLE_CLIENT_ID      — app OAuth client id
 *   GOOGLE_CLIENT_SECRET  — app OAuth client secret
 *
 * Uses only @modelcontextprotocol/sdk + global fetch.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

async function getAccessToken() {
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Failed to refresh Google access token');
  return data.access_token;
}

async function api(path, accessToken, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Calendar API ${res.status}`);
  return data;
}

/** Accept an ISO datetime ("2026-06-21T15:00:00") or a date ("2026-06-21"). */
function toTimePoint(value) {
  if (!value) return undefined;
  return value.includes('T') ? { dateTime: value } : { date: value };
}

async function listEvents({ timeMin, timeMax, maxResults = 10, calendarId = 'primary' }, token) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(Math.min(maxResults || 10, 50)),
    timeMin: timeMin ?? new Date().toISOString(),
  });
  if (timeMax) params.set('timeMax', timeMax);
  const data = await api(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`, token);
  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    description: e.description,
    htmlLink: e.htmlLink,
  }));
}

async function createEvent({ summary, start, end, description, location, attendees, calendarId = 'primary' }, token) {
  const body = {
    summary,
    description,
    location,
    start: toTimePoint(start),
    end: toTimePoint(end),
    ...(Array.isArray(attendees) && attendees.length ? { attendees: attendees.map((email) => ({ email })) } : {}),
  };
  const e = await api(`/calendars/${encodeURIComponent(calendarId)}/events`, token, { method: 'POST', body: JSON.stringify(body) });
  return { id: e.id, summary: e.summary, start: e.start?.dateTime ?? e.start?.date, htmlLink: e.htmlLink, status: 'created' };
}

async function updateEvent({ eventId, summary, start, end, description, location, calendarId = 'primary' }, token) {
  const body = {};
  if (summary !== undefined) body.summary = summary;
  if (description !== undefined) body.description = description;
  if (location !== undefined) body.location = location;
  if (start) body.start = toTimePoint(start);
  if (end) body.end = toTimePoint(end);
  const e = await api(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, token, { method: 'PATCH', body: JSON.stringify(body) });
  return { id: e.id, summary: e.summary, start: e.start?.dateTime ?? e.start?.date, htmlLink: e.htmlLink, status: 'updated' };
}

async function deleteEvent({ eventId, calendarId = 'primary' }, token) {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 410) throw new Error(`Calendar API ${res.status}`);
  return { eventId, status: 'deleted' };
}

const TOOLS = [
  {
    name: 'list_events',
    description: 'List upcoming calendar events. Optional ISO timeMin/timeMax window; defaults to events from now.',
    inputSchema: { type: 'object', properties: { timeMin: { type: 'string', description: 'ISO datetime lower bound' }, timeMax: { type: 'string', description: 'ISO datetime upper bound' }, maxResults: { type: 'number' } }, additionalProperties: false },
    handler: (a, t) => listEvents(a, t),
  },
  {
    name: 'create_event',
    description: 'Create a calendar event. start/end are ISO datetimes ("2026-06-21T15:00:00") or dates ("2026-06-21") for all-day.',
    inputSchema: { type: 'object', properties: {
      summary: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
      description: { type: 'string' }, location: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
    }, required: ['summary', 'start', 'end'], additionalProperties: false },
    handler: (a, t) => createEvent(a, t),
  },
  {
    name: 'update_event',
    description: 'Update fields of an existing calendar event by id.',
    inputSchema: { type: 'object', properties: {
      eventId: { type: 'string' }, summary: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
      description: { type: 'string' }, location: { type: 'string' },
    }, required: ['eventId'], additionalProperties: false },
    handler: (a, t) => updateEvent(a, t),
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event by id. Irreversible.',
    inputSchema: { type: 'object', properties: { eventId: { type: 'string' } }, required: ['eventId'], additionalProperties: false },
    handler: (a, t) => deleteEvent(a, t),
  },
];

const server = new Server({ name: 'google-calendar', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find((t) => t.name === request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  try {
    const token = await getAccessToken();
    const result = await tool.handler(request.params.arguments ?? {}, token);
    const structuredContent = Array.isArray(result) ? { results: result } : result;
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], structuredContent: { error: message }, isError: true };
  }
});

await server.connect(new StdioServerTransport());
