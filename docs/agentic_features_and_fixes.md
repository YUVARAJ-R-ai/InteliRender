# Agentic Features, MCP Integration & Bug Fixes

This document outlines the agentic features of the IntelliRender platform, the integration with the Google Forms Model Context Protocol (MCP) server, the core issues identified, and the engineering solutions applied to enable robust multi-step agentic capabilities.

---

## 1. Core Agentic Architecture & Features

IntelliRender supports a fully autonomous, loop-based execution environment (Agentic Mode) that interfaces with external tools registered dynamically via the Model Context Protocol (MCP).

### A. Dynamic MCP Registration & Stdio Transport
- **UI Configuration**: Users can register MCP servers in the web interface by providing a server name, execution command (e.g., `node`), and path parameters.
- **Dynamic Hot-loading**: On each message submission in Agent Mode, the backend endpoint (`app/api/chat/agent/route.ts`) reads the active MCP servers from the client request payload.
- **Process Spawning**: The backend spawns the MCP servers in separate subprocesses using the `StdioClientTransport` protocol.

### B. Multi-Step Execution Loop (Agentic Loop)
- **Vercel AI SDK Integration**: Built using `streamText` from `ai` with `maxSteps` set to `5`.
- **Sequential Tool Chain**: Enables the LLM (DeepSeek-V4-Flash) to execute a tool, capture its return values (such as a generated `formId`), and feed those values directly into subsequent tool calls within a single request context.

---

## 2. Identified Bugs & Engineering Fixes

During the integration and testing of the Google Forms MCP server, two critical bugs were diagnosed and resolved.

### Bug A: Google Forms Initial Creation Payload Limit (400 Bad Request)
- **Problem**: When triggering form creation, the Google Forms API threw a `400 Bad Request` error if the creation payload included the form `description` or `documentTitle`.
- **Cause**: The Google Forms API strictly limits initial creation payloads to `info.title`. Additional metadata and structure must be applied afterward via a `batchUpdate` operation using the generated `formId`.
- **Solution**: 
  We modified the `createForm` function in `google-forms-mcp/src/index.ts` to separate the creation payload from metadata updates:
  ```typescript
  // 1. Create the form with only the title
  const newForm = await forms.create({
    requestBody: {
      info: {
        title: title,
      },
    },
  });
  
  // 2. Perform metadata updates (e.g., description) using batchUpdate
  const formId = newForm.data.formId;
  if (description) {
    await forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateFormInfo: {
              info: {
                description: description,
              },
              updateMask: 'description',
            },
          },
        ],
      },
    });
  }
  ```

---

### Bug B: Dynamic Tool Schema Incompatibility (SiliconFlow/DeepSeek 400 Bad Request)
- **Problem**: When executing sequential tool chains, the agent failed to generate tool parameters or chain subsequent calls, and the gateway threw the following error on SiliconFlow:
  ```json
  {"code":20015,"message":"Invalid schema for function 'googleforms_create_form': schema must be a JSON Schema of 'type: \"object\"', got 'type: null'.","data":null}
  ```
- **Cause**: 
  1. The API route (`app/api/chat/agent/route.ts`) was using `parameters: z.record(z.string(), z.any())` to define dynamic MCP tools.
  2. The Vercel AI SDK (v4+) uses the **`inputSchema`** property instead of the deprecated `parameters` property. Because `parameters` was used, the AI SDK compiled the tool's JSON Schema to empty (`properties: {}`), stripping all input fields.
  3. Strict API gateways like SiliconFlow rejected these empty definitions or parsed them as `type: null`, throwing a 400 error. It also prevented the LLM from understanding which arguments (e.g., `formId`, `questionTitle`) were required, halting the agentic loop after step 1.
- **Solution**:
  We updated `app/api/chat/agent/route.ts` to import `jsonSchema` and register tools using `inputSchema` wrapped in the `jsonSchema` helper:
  ```typescript
  import { streamText, tool, convertToModelMessages, jsonSchema } from 'ai';

  // Inside listTools loop:
  dynamicTools[toolName] = tool({
    description: mcpTool.description || '',
    inputSchema: jsonSchema(mcpTool.inputSchema as any),
    execute: async (args: any) => {
      return await client.callTool({
        name: mcpTool.name,
        arguments: args
      });
    }
  });
  ```
  This guarantees that raw JSON schemas parsed from MCP servers are serialized as standard, strongly-typed OpenAPI properties, allowing the DeepSeek model to accurately construct tool inputs and execute sequential multi-step tasks.

---

## 3. Verified Workflow Efficacy

Following these modifications:
1. **Tool Parameter Mapping**: Tool schemas are fully exposed to the model.
2. **Sequential Chaining**: The model successfully executes `googleforms_create_form` and uses the returned `formId` to invoke `googleforms_add_text_question` and `googleforms_add_multiple_choice_question` automatically.
3. **TypeScript Integrity**: Compiles successfully with zero warnings or errors.

---

## 4. Session Updates — Per-User Architecture & OAuth Flow

This section documents all changes made to migrate Google Forms from a shared global credential model to a fully per-user, database-backed OAuth model.

---

### 4.1 Bug Fix: JSX Syntax Error in `SettingsModal.tsx`

**File**: `components/SettingsModal.tsx`

**Problem**: Build error — `Unexpected token. Did you mean '{'}'}' or '&rbrace;'?` at line 359, column 14.

**Cause**: The false branch of the `isConnected` ternary (line 322) opened two `<div>` elements:
- `<div className="mt-3 space-y-2">` (outer wrapper)
- `<div className="flex gap-2">` (inner flex row)

Only one `</div>` was present before the closing `)}`, leaving `mt-3 space-y-2` unclosed. The JSX parser encountered `}` while still inside an open element, causing the parse error.

**Fix**: Added the missing `</div>` to close `<div className="mt-3 space-y-2">` after the inner flex div closes.

---

### 4.2 Per-User Google Forms: DB Service Config

**File**: `app/api/chat/agent/route.ts`

**Change**: Added `google_forms` entry to `DB_MCP_SERVICE_CONFIGS`.

```typescript
google_forms: {
  command: 'node',
  args: ['/mnt/drive1/projects/google-forms-mcp/build/index.js'],
  envKey: 'GOOGLE_REFRESH_TOKEN',
  // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET remain global in process.env
},
```

**How it works**: At request time, `loadDbMcpServers(userId)` decrypts only that user's stored refresh token and injects it as `GOOGLE_REFRESH_TOKEN` into the subprocess environment. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are already present globally via `...process.env` spread in the transport options. Each user's MCP subprocess authenticates as their own Google account.

**Also updated**: The `create_google_form` tool's error message was changed to direct users to Settings → Integrations rather than the legacy MCP Configuration sidebar.

---

### 4.3 Bug Fix: `google_forms` Missing from `SUPPORTED_SERVICES`

**File**: `app/api/settings/mcp/[service]/route.ts`

**Problem**: The `POST /api/settings/mcp/google_forms` endpoint returned `400 Unsupported service` because `google_forms` was not in the `SUPPORTED_SERVICES` allowlist, even though the Integrations UI allowed the user to submit a token.

**Fix**: Added `'google_forms'` to the array:

```typescript
const SUPPORTED_SERVICES = ['github', 'linear', 'notion', 'google_forms', 'google_drive', 'gmail', 'google_calendar'];
```

---

### 4.4 Google Forms OAuth Initiation Route

**File**: `app/api/auth/google-forms/route.ts` *(new)*

Handles `GET /api/auth/google-forms`. Requires an active session (redirects to `/auth/login` otherwise).

**Flow**:
1. Generates a cryptographically random 16-byte hex `state` token for CSRF protection.
2. Builds a Google OAuth 2.0 authorization URL with scopes `forms` and `drive`, `access_type: offline`, and `prompt: consent` (forces refresh token issuance on every authorization).
3. Sets a `gf_oauth_state` httpOnly cookie (TTL 10 minutes) containing the state value.
4. Redirects the browser to Google's consent screen.

**Environment variables required**:
- `GOOGLE_CLIENT_ID` — already used by the MCP server
- `NEXT_PUBLIC_APP_URL` (optional) — base URL for the callback URI; falls back to the request origin

---

### 4.5 Google Forms OAuth Callback Route

**File**: `app/api/auth/google-forms/callback/route.ts` *(new)*

Handles `GET /api/auth/google-forms/callback?code=...&state=...`.

**Flow**:
1. Verifies the `state` param matches the `gf_oauth_state` cookie (CSRF check). Redirects to Settings → Integrations with `?error=google_forms_state` on mismatch.
2. Exchanges the `code` for tokens via a direct `POST` to `https://oauth2.googleapis.com/token` (no `googleapis` SDK dependency in IntelliRender).
3. Verifies a `refresh_token` was returned. If not (e.g., user already authorized without revocation), redirects with `?error=google_forms_no_refresh`.
4. Encrypts the `refresh_token` with the existing `encrypt()` utility and upserts it into the `mcp_connections` table keyed by `(userId, 'google_forms')`.
5. Deletes the state cookie and redirects to `/?settings=Integrations&connected=google_forms`.

**Error states surfaced to UI**:
| Param | Cause |
|---|---|
| `error=google_forms_denied` | User cancelled the Google consent screen |
| `error=google_forms_state` | CSRF state mismatch |
| `error=google_forms_no_refresh` | No refresh token returned (already authorized) |
| `error=google_forms_failed` | Token exchange or DB write threw an exception |

---

### 4.6 SettingsModal: OAuth Button & Discriminated Union Type

**File**: `components/SettingsModal.tsx`

#### Exported `Section` type
Changed `type Section` to `export type Section` so `UserMenu` can import it without re-declaring.

#### `IntegrationDef` discriminated union
Replaced the untyped `INTEGRATION_DEFS` array with an explicitly typed discriminated union:

```typescript
type IntegrationDef =
  | { service: string; label: string; icon: React.ElementType; description: string; authType: 'pat'; placeholder: string; hint?: string }
  | { service: string; label: string; icon: React.ElementType; description: string; authType: 'oauth'; oauthPath: string };
```

Google Forms entry changed from `authType: 'pat'` (manual token paste) to `authType: 'oauth'` with `oauthPath: '/api/auth/google-forms'`. The `placeholder` and `hint` fields are removed from the Google Forms entry.

#### Render logic
The `IntegrationsSection` map callback now uses `(def) =>` with `authType` narrowing:

```
isConnected  → shows Last synced + Disconnect button (unchanged)
authType === 'oauth'  → shows "Connect with Google" anchor tag linking to oauthPath
authType === 'pat'    → shows existing password input + Connect button
```

#### `oauthResult` prop
`IntegrationsSection` now accepts `oauthResult?: { connected?: string; error?: string }`. When present, a banner is shown at the top of the section:
- Green banner for `connected === 'google_forms'`
- Red banner for any `error` value, with human-readable messages per error code

#### `SettingsModal` props extended
```typescript
export function SettingsModal({ onClose, initialSection, oauthResult }: {
  onClose: () => void;
  initialSection?: Section;
  oauthResult?: { connected?: string; error?: string };
})
```
`section` state is initialized to `initialSection ?? 'Appearance'`. `oauthResult` is passed through to `IntegrationsSection`.

---

### 4.7 UserMenu: OAuth Redirect Detection

**File**: `components/UserMenu.tsx`

Added URL param detection so the Settings modal auto-opens on the Integrations tab after returning from the Google OAuth flow.

**New state**:
```typescript
const [settingsSection, setSettingsSection] = useState<Section>('Appearance');
const [oauthResult, setOauthResult] = useState<{ connected?: string; error?: string } | undefined>();
```

**New `useEffect`** (runs once on mount):
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('settings') === 'Integrations') {
    setSettingsSection('Integrations');
    setOauthResult({ connected: params.get('connected') ?? undefined, error: params.get('error') ?? undefined });
    setShowSettings(true);
    window.history.replaceState({}, '', window.location.pathname); // clean URL
  }
}, []);
```

When the user manually opens Settings via the menu, `settingsSection` resets to `'Appearance'` and `oauthResult` clears to `undefined`.

---

### 4.8 End-to-End User Flow (New)

```
Settings → Integrations → "Connect with Google"
  → GET /api/auth/google-forms
      sets gf_oauth_state cookie, redirects to Google consent
  → Google consent screen (user approves)
  → GET /api/auth/google-forms/callback?code=...&state=...
      verifies CSRF state, exchanges code for refresh_token,
      encrypts + stores in mcp_connections table
  → redirect to /?settings=Integrations&connected=google_forms
  → UserMenu.useEffect detects params, opens modal on Integrations tab
  → IntegrationsSection shows green "connected" banner, status shows "Connected"

Next agent request:
  → loadDbMcpServers(userId) decrypts user's refresh_token
  → spawns google-forms-mcp subprocess with GOOGLE_REFRESH_TOKEN=<user token>
  → create_google_form tool creates form in user's own Google Drive
```

---

### 4.9 Prerequisites for Production

1. **Google Cloud Console**: Register `<APP_URL>/api/auth/google-forms/callback` as an authorized redirect URI for the OAuth client. The current client JSON only lists `http://localhost` which does not match the full callback path.
2. **Environment variable**: Set `NEXT_PUBLIC_APP_URL` to the deployed app's base URL (e.g., `https://intellirender.example.com`) so the callback URI is constructed correctly in both the initiation and callback routes.
3. **MCP server path**: Replace the hardcoded `/mnt/drive1/projects/google-forms-mcp/build/index.js` in `DB_MCP_SERVICE_CONFIGS` with a path-relative or env-var-driven reference before deploying to a server.
