#!/usr/bin/env node
/**
 * Standalone Google Drive MCP server (stdio transport). Mirrors gmail.mjs — the
 * public `mcp-google-drive` package only supports a shared service account, not
 * the per-user OAuth refresh-token model this app uses.
 *
 * Spawned per-request by the Next.js agent (see lib/mcp/configs/google-drive.ts)
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
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

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

async function api(url, accessToken, init = {}, raw = false) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
  if (raw) {
    if (!res.ok) throw new Error(`Drive API ${res.status}`);
    return res.text();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Drive API ${res.status}`);
  return data;
}

const FILE_FIELDS = 'files(id,name,mimeType,modifiedTime,size,webViewLink)';

async function listFiles({ query, pageSize = 20 }, token) {
  const params = new URLSearchParams({
    pageSize: String(Math.min(pageSize || 20, 100)),
    fields: FILE_FIELDS,
    orderBy: 'modifiedTime desc',
  });
  if (query) params.set('q', `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`);
  else params.set('q', 'trashed = false');
  const data = await api(`${API}/files?${params}`, token);
  return data.files ?? [];
}

const GOOGLE_EXPORT = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

async function readFile({ fileId }, token) {
  const meta = await api(`${API}/files/${fileId}?fields=id,name,mimeType`, token);
  const mime = meta.mimeType ?? '';
  let content;
  if (GOOGLE_EXPORT[mime]) {
    content = await api(`${API}/files/${fileId}/export?mimeType=${encodeURIComponent(GOOGLE_EXPORT[mime])}`, token, {}, true);
  } else if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
    content = await api(`${API}/files/${fileId}?alt=media`, token, {}, true);
  } else {
    return { id: fileId, name: meta.name, mimeType: mime, content: `[binary file — ${mime} — open via webViewLink]` };
  }
  return { id: fileId, name: meta.name, mimeType: mime, content: String(content).slice(0, 8000) };
}

async function createFile({ name, content = '', mimeType = 'text/plain' }, token) {
  const boundary = '-------ir' + Date.now();
  const metadata = { name, mimeType };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
  const file = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return { id: file.id, name: file.name, webViewLink: file.webViewLink, status: 'created' };
}

async function updateFile({ fileId, content, mimeType = 'text/plain' }, token) {
  const file = await api(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id,name,webViewLink`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': mimeType },
    body: content ?? '',
  });
  return { id: file.id, name: file.name, webViewLink: file.webViewLink, status: 'updated' };
}

const TOOLS = [
  {
    name: 'list_files',
    description: 'List the most recently modified files in the user’s Google Drive.',
    inputSchema: { type: 'object', properties: { pageSize: { type: 'number', description: 'Max files (default 20, max 100)' } }, additionalProperties: false },
    handler: (a, t) => listFiles(a, t),
  },
  {
    name: 'search_files',
    description: 'Search Drive files by name. Returns matching files with id, name, mimeType and link.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Text to match in the file name' }, pageSize: { type: 'number' } }, required: ['query'], additionalProperties: false },
    handler: (a, t) => listFiles(a, t),
  },
  {
    name: 'read_file',
    description: 'Read the text content of a Drive file by id (Google Docs/Sheets/Slides are exported to text/csv).',
    inputSchema: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'], additionalProperties: false },
    handler: (a, t) => readFile(a, t),
  },
  {
    name: 'create_file',
    description: 'Create a new file in Drive with text content. Returns the file id and link.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' }, mimeType: { type: 'string', description: 'Default text/plain' } }, required: ['name', 'content'], additionalProperties: false },
    handler: (a, t) => createFile(a, t),
  },
  {
    name: 'update_file',
    description: 'Replace the content of an existing Drive file by id.',
    inputSchema: { type: 'object', properties: { fileId: { type: 'string' }, content: { type: 'string' }, mimeType: { type: 'string' } }, required: ['fileId', 'content'], additionalProperties: false },
    handler: (a, t) => updateFile(a, t),
  },
];

const server = new Server({ name: 'google-drive', version: '1.0.0' }, { capabilities: { tools: {} } });

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
