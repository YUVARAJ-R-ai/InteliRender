#!/usr/bin/env node
/**
 * Standalone Google Forms MCP server (stdio transport), written in Node so it runs
 * via `node` in the same image as the npx-based integrations — no Python needed.
 *
 * The Next.js agent spawns this per-request via StdioClientTransport
 * (see lib/mcp/configs/google-forms.ts), injecting the per-user OAuth credentials
 * through env vars:
 *
 *   GOOGLE_REFRESH_TOKEN  — the user's refresh token (decrypted from the DB)
 *   GOOGLE_CLIENT_ID      — app OAuth client id
 *   GOOGLE_CLIENT_SECRET  — app OAuth client secret
 *
 * Uses only @modelcontextprotocol/sdk (already a repo dependency) + global fetch,
 * so there are no extra packages to install or bundle.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const TOOL_NAME = 'create_google_form';

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Form title' },
    description: { type: 'string', description: 'Optional form description' },
    questions: {
      type: 'array',
      description: 'All questions to add to the form',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Question text' },
          type: { type: 'string', description: 'text | paragraph | multiple_choice | checkbox | dropdown' },
          options: { type: 'array', items: { type: 'string' }, description: 'Required for multiple_choice/checkbox/dropdown' },
          required: { type: 'boolean' },
        },
        required: ['title'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'questions'],
  additionalProperties: false,
};

const TOKEN_URI = 'https://oauth2.googleapis.com/token';

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
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Google access token');
  }
  return data.access_token;
}

function buildItem(question) {
  const type = String(question.type ?? 'text').toLowerCase();
  const required = Boolean(question.required ?? false);
  const options = (question.options ?? []).map((o) => ({ value: String(o) }));

  let q;
  if (type === 'multiple_choice' || type === 'radio' || type === 'choice') {
    q = { required, choiceQuestion: { type: 'RADIO', options } };
  } else if (type === 'checkbox') {
    q = { required, choiceQuestion: { type: 'CHECKBOX', options } };
  } else if (type === 'dropdown') {
    q = { required, choiceQuestion: { type: 'DROP_DOWN', options } };
  } else if (type === 'paragraph') {
    q = { required, textQuestion: { paragraph: true } };
  } else {
    q = { required, textQuestion: { paragraph: false } };
  }

  return { title: question.title ?? '', questionItem: { question: q } };
}

async function createGoogleForm({ title, questions = [], description }) {
  const accessToken = await getAccessToken();
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // Step 1: create the form (title only — description/items go via batchUpdate)
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers,
    body: JSON.stringify({ info: { title } }),
  });
  const form = await createRes.json();
  if (!form.formId) {
    throw new Error(form.error?.message || 'Failed to create form');
  }
  const formId = form.formId;

  // Step 2: set description (if any) and add all questions in one batch
  const requests = [];
  if (description) {
    requests.push({ updateFormInfo: { info: { description }, updateMask: 'description' } });
  }
  questions.forEach((question, index) => {
    requests.push({ createItem: { item: buildItem(question), location: { index } } });
  });

  if (requests.length > 0) {
    const batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
    });
    const batch = await batchRes.json();
    if (batch.error) {
      throw new Error(batch.error.message || 'Failed to add questions');
    }
  }

  const finalRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, { headers });
  const final = await finalRes.json();

  return {
    formId,
    responderUri: final.responderUri,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
    questionsAdded: questions.map((q) => q.title),
  };
}

const server = new Server(
  { name: 'google-forms', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: TOOL_NAME,
      description:
        'Create a complete Google Form with all fields/questions in one call. ' +
        'questions is a list of { title, type, options?, required? } where type is ' +
        'text | paragraph | multiple_choice | checkbox | dropdown (options required for ' +
        'choice types). Reply to the user with the returned responderUri.',
      inputSchema: INPUT_SCHEMA,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== TOOL_NAME) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  try {
    const result = await createGoogleForm(request.params.arguments ?? {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      structuredContent: { error: message },
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
