# MCP Service Integrations

This document covers all connected MCP (Model Context Protocol) services: how authentication works for each, where credentials are stored, which environment variables are injected into subprocesses at runtime, and step-by-step setup guides.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Patterns](#authentication-patterns)
   - [PAT Flow](#pat-flow)
   - [OAuth 2.0 Flow](#oauth-20-flow)
   - [Special Patterns: metadataEnv and appConfigEnv](#special-patterns)
3. [Service Reference](#service-reference)
   - [GitHub](#github)
   - [Notion](#notion)
   - [Linear](#linear)
   - [Gmail](#gmail)
   - [Google Drive](#google-drive)
   - [Google Calendar](#google-calendar)
   - [Google Forms](#google-forms)
   - [Slack](#slack)
   - [Stripe](#stripe)
   - [PostgreSQL](#postgresql)
4. [Google OAuth Setup (Prerequisite)](#google-oauth-setup-prerequisite)
5. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Each MCP service runs as a child process (stdio transport) launched by `app/api/chat/agent/route.ts` when the agent loop starts. The service registry is the `DB_MCP_SERVICE_CONFIGS` map in that file — it controls the command, arguments, and env var names for each service.

At runtime, `loadDbMcpServers(userId)` queries `mcp_connections` for all rows where `status = 'connected'` and `accessToken IS NOT NULL`, decrypts each token, and builds a list of server descriptors with the appropriate env vars populated.

**Key files:**

| File | Purpose |
|------|---------|
| `app/api/chat/agent/route.ts` | Service registry (`DB_MCP_SERVICE_CONFIGS`) and `loadDbMcpServers` |
| `app/api/settings/mcp/[service]/route.ts` | PAT connect/disconnect endpoint |
| `app/api/auth/[service]/route.ts` | OAuth 2.0 consent URL initiation (one per Google service) |
| `app/api/auth/[service]/callback/route.ts` | OAuth 2.0 token exchange and storage |
| `app/api/settings/google-oauth/route.ts` | Admin upload of Google OAuth client credentials |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt (key derived from `AUTH_SECRET`) |
| `lib/app-config.ts` | Read/write app-level secrets from the `app_config` table |
| `lib/db/schema.ts` | `mcp_connections` and `app_config` table definitions |

**Database tables:**

- `mcp_connections` — one row per user per service. Stores encrypted `accessToken`, optional `refreshToken`, `status`, and a `metadata` JSONB column for non-secret supplementary data.
- `app_config` — app-level key/value store for shared secrets (e.g. Google OAuth client credentials uploaded once by the admin).

---

## Authentication Patterns

### PAT Flow

Used by: GitHub, Linear, Notion, Stripe, PostgreSQL, Slack (bot token part)

```
User opens Settings → Integrations
         │
         ▼
Pastes PAT / API key / connection string into the UI
         │
         ▼
Frontend: POST /api/settings/mcp/[service]  { token: "..." }
         │
         ▼
Server: encrypt(token)  →  upsert into mcp_connections.accessToken
        status set to 'connected'
         │
         ▼
Agent loop starts: loadDbMcpServers()
         │
         ▼
decrypt(accessToken)  →  envTransform (if any)
         │
         ▼
MCP subprocess launched with  { ENV_VAR_NAME: decryptedToken }
```

The `envTransform` field wraps the raw token before injection. Notion uses it to serialize the token into a JSON `Authorization` header string.

---

### OAuth 2.0 Flow

Used by: Gmail, Google Drive, Google Calendar, Google Forms

```
User clicks "Connect" in Settings → Integrations
         │
         ▼
Browser: GET /api/auth/[service]
         │  generates random state, stores in cookie (gmail_oauth_state etc.)
         ▼
Redirect to Google consent screen
  https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=...&scope=...&access_type=offline&prompt=consent
         │
         ▼  (user approves)
Google redirects to:
  /api/auth/[service]/callback?code=...&state=...
         │
         ▼
Server validates state cookie (CSRF protection)
         │
         ▼
POST https://oauth2.googleapis.com/token  { code, client_id, client_secret, redirect_uri }
         │
         ▼
Google returns { access_token, refresh_token, expires_in, ... }
         │
         ▼
encrypt(refresh_token)  →  upsert mcp_connections.accessToken
status set to 'connected'
         │
         ▼
Agent loop starts: loadDbMcpServers()
         │
         ▼
decrypt(accessToken)  →  ENV_VAR_NAME=<refresh_token>
appConfigEnv resolved (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
         │
         ▼
MCP subprocess launched with all three env vars
```

The `client_id` and `client_secret` are resolved first from the `app_config` table (uploaded via Settings), falling back to `process.env.GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**Important:** Google only returns a `refresh_token` on the first consent or when `prompt=consent` is forced. The callback returns a `gmail_no_refresh` error if the token is missing — this usually means the app was already authorised. Revoke access in your [Google Account permissions](https://myaccount.google.com/permissions) and reconnect to get a fresh token.

---

### Special Patterns

#### `appConfigEnv`

For services that need app-level credentials (not per-user), the registry entry has an `appConfigEnv` map:

```typescript
appConfigEnv: {
  google_client_id: 'GOOGLE_CLIENT_ID',      // DB key → env var name
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
}
```

At runtime `loadDbMcpServers` calls `getAppConfig(dbKey)` for each entry and injects the value into the subprocess env. The admin sets these once via `POST /api/settings/google-oauth`.

#### `metadataEnv`

For non-secret supplementary data that must be passed to a subprocess alongside the main token. Example from Slack:

```typescript
slack: {
  envKey: 'SLACK_BOT_TOKEN',          // encrypted in accessToken
  metadataEnv: {
    teamId: 'SLACK_TEAM_ID',          // metadata.teamId → SLACK_TEAM_ID env var
  },
}
```

When the user connects Slack they provide both the bot token and the workspace team ID. The token is encrypted into `accessToken`; the team ID is stored as plain JSON in `metadata: { teamId: "T01234..." }`. At runtime both are injected:

```
SLACK_BOT_TOKEN=<decrypted token>
SLACK_TEAM_ID=<metadata.teamId>
```

---

## Service Reference

### GitHub

| Field | Value |
|-------|-------|
| Package | `@modelcontextprotocol/server-github` |
| Auth type | PAT |
| Credential | GitHub Personal Access Token |
| Stored in | `mcp_connections.accessToken` (AES-256-GCM encrypted) |
| Env var injected | `GITHUB_PERSONAL_ACCESS_TOKEN` |

**Setup:**
1. Go to [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Select scopes: `repo`, `read:org`, `read:user` (add more as needed for your use case).
4. Copy the token.
5. In IntelliRender: Settings → Integrations → GitHub → paste the token → Connect.

---

### Notion

| Field | Value |
|-------|-------|
| Package | `@notionhq/notion-mcp-server` |
| Auth type | PAT (Integration token) |
| Credential | Notion Internal Integration Token |
| Stored in | `mcp_connections.accessToken` (encrypted) |
| Env var injected | `OPENAPI_MCP_HEADERS` |
| Transform | Token is wrapped as `{"Authorization":"Bearer <token>"}` before injection |

**Setup:**
1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Click **+ New integration**, give it a name, select the workspace.
3. Under Capabilities, enable **Read content**, **Update content**, **Insert content** as needed.
4. Copy the **Internal Integration Token** (starts with `secret_`).
5. In your Notion pages/databases: open the page → click `···` → **Add connections** → select your integration.
6. In IntelliRender: Settings → Integrations → Notion → paste the token → Connect.

---

### Linear

| Field | Value |
|-------|-------|
| Package | `@linear/mcp-server` |
| Auth type | PAT |
| Credential | Linear API Key |
| Stored in | `mcp_connections.accessToken` (encrypted) |
| Env var injected | `LINEAR_API_KEY` |

**Setup:**
1. Go to [Linear → Settings → API](https://linear.app/settings/api).
2. Click **Create key**, give it a label.
3. Copy the key.
4. In IntelliRender: Settings → Integrations → Linear → paste the key → Connect.

---

### Gmail

| Field | Value |
|-------|-------|
| Package | `mcp-gmail` (npx) |
| Auth type | OAuth 2.0 |
| Credential | Google refresh token (obtained via consent flow) |
| Stored in | `mcp_connections.accessToken` (encrypted refresh token) |
| Env vars injected | `GMAIL_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OAuth scopes | `gmail.modify`, `gmail.settings.basic` |
| Callback route | `/api/auth/gmail/callback` |

**Prerequisites:** [Google OAuth credentials must be configured](#google-oauth-setup-prerequisite) first.

**Setup:**
1. Ensure Google OAuth credentials are uploaded in Settings → Integrations → Google OAuth.
2. In IntelliRender: Settings → Integrations → Gmail → click **Connect with Google**.
3. Approve the consent screen.
4. You will be redirected back and Gmail will show as connected.

---

### Google Drive

| Field | Value |
|-------|-------|
| Package | `mcp-google-drive` (npx) |
| Auth type | OAuth 2.0 |
| Credential | Google refresh token |
| Stored in | `mcp_connections.accessToken` (encrypted refresh token) |
| Env vars injected | `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OAuth scopes | `drive` |
| Callback route | `/api/auth/google-drive/callback` |

**Prerequisites:** [Google OAuth credentials must be configured](#google-oauth-setup-prerequisite) first.

**Setup:** Same as Gmail — Settings → Integrations → Google Drive → **Connect with Google**.

---

### Google Calendar

| Field | Value |
|-------|-------|
| Package | `google-calendar-mcp` (npx) |
| Auth type | OAuth 2.0 |
| Credential | Google refresh token |
| Stored in | `mcp_connections.accessToken` (encrypted refresh token) |
| Env vars injected | `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OAuth scopes | `calendar` |
| Callback route | `/api/auth/google-calendar/callback` |

**Prerequisites:** [Google OAuth credentials must be configured](#google-oauth-setup-prerequisite) first.

**Setup:** Settings → Integrations → Google Calendar → **Connect with Google**.

---

### Google Forms

| Field | Value |
|-------|-------|
| Command | `node /mnt/drive1/projects/google-forms-mcp/build/index.js` (local build) |
| Auth type | OAuth 2.0 |
| Credential | Google refresh token |
| Stored in | `mcp_connections.accessToken` (encrypted refresh token) |
| Env vars injected | `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OAuth scopes | `forms`, `drive` |
| Callback route | `/api/auth/google-forms/callback` |

> **Note:** Google Forms uses a locally built MCP server (`google-forms-mcp`) rather than an npm package. The server must be built and present at the path above before the integration will work.

**Prerequisites:** [Google OAuth credentials must be configured](#google-oauth-setup-prerequisite) first.

**Setup:** Settings → Integrations → Google Forms → **Connect with Google**.

---

### Slack

| Field | Value |
|-------|-------|
| Package | `@modelcontextprotocol/server-slack` |
| Auth type | PAT (Bot Token) + metadata (Team ID) |
| Credentials | Slack Bot Token + Workspace Team ID |
| Token stored in | `mcp_connections.accessToken` (encrypted) |
| Team ID stored in | `mcp_connections.metadata` as `{ "teamId": "T01234..." }` |
| Env vars injected | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |

**Setup:**
1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Under **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:
   - `channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `mpim:history`, `users:read`
3. Click **Install to Workspace** and approve.
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`).
5. Find your Team ID: in Slack web, click the workspace name → the URL contains `/client/T01234...` — that `T...` string is the team ID. Alternatively use `https://slack.com/api/auth.test?token=<your-bot-token>`.
6. In IntelliRender: Settings → Integrations → Slack → paste the bot token and team ID → Connect.

---

### Stripe

| Field | Value |
|-------|-------|
| Package | `@stripe/agent-toolkit` |
| Auth type | API Key |
| Credential | Stripe Secret Key |
| Stored in | `mcp_connections.accessToken` (encrypted) |
| Env var injected | `STRIPE_SECRET_KEY` |

**Setup:**
1. Log into [https://dashboard.stripe.com](https://dashboard.stripe.com).
2. Go to **Developers → API keys**.
3. Copy the **Secret key** (starts with `sk_live_` or `sk_test_` for test mode).
4. In IntelliRender: Settings → Integrations → Stripe → paste the secret key → Connect.

> Use test mode keys (`sk_test_...`) during development to avoid live charges.

---

### PostgreSQL

| Field | Value |
|-------|-------|
| Package | `@modelcontextprotocol/server-postgres` |
| Auth type | Connection string |
| Credential | PostgreSQL connection URI |
| Stored in | `mcp_connections.accessToken` (encrypted) |
| Env var injected | `POSTGRES_CONNECTION_STRING` |

**Setup:**
1. Obtain a connection string for your database in the form:
   `postgresql://user:password@host:5432/dbname`
2. For cloud providers: Supabase → Project Settings → Database → Connection string (URI); Neon → Dashboard → Connection Details; Railway → service Variables tab.
3. In IntelliRender: Settings → Integrations → PostgreSQL → paste the connection string → Connect.

> The MCP server gets read/write access to the database. Use a read-only role in production unless writes are needed.

---

## Google OAuth Setup (Prerequisite)

All four Google services (Gmail, Drive, Calendar, Forms) share a single OAuth 2.0 client. You must configure it once before any Google service can be connected.

### Create OAuth credentials in Google Cloud Console

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com) and select or create a project.
2. Enable the APIs you need:
   - Gmail API, Google Drive API, Google Calendar API, Google Forms API
   - Navigate to **APIs & Services → Library** and enable each one.
3. Go to **APIs & Services → OAuth consent screen**:
   - Choose **External** (unless using Google Workspace).
   - Fill in App name, support email, and developer contact.
   - Add scopes: `.../auth/gmail.modify`, `.../auth/gmail.settings.basic`, `.../auth/drive`, `.../auth/calendar`, `.../auth/forms`
   - Add test users (your own email) while in testing mode.
4. Go to **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Add Authorized redirect URIs — one per Google service:
     ```
     https://your-app-url.com/api/auth/gmail/callback
     https://your-app-url.com/api/auth/google-drive/callback
     https://your-app-url.com/api/auth/google-calendar/callback
     https://your-app-url.com/api/auth/google-forms/callback
     ```
   - Replace `your-app-url.com` with the value of `NEXT_PUBLIC_APP_URL` in your `.env`.
   - For local development use `http://localhost:3000`.
5. Click **Create** and download the JSON file (it will look like `client_secret_....json`).

### Upload credentials to IntelliRender

1. In IntelliRender: Settings → Integrations → Google OAuth.
2. Either upload the downloaded JSON file or paste the `client_id` and `client_secret` directly.
3. The app stores them encrypted in the `app_config` table under the keys `google_client_id` and `google_client_secret`.

Once uploaded, all four Google service "Connect" buttons will work.

---

## Troubleshooting

### `gmail_no_refresh` / `gdrive_no_refresh` / similar

**Cause:** Google only returns a `refresh_token` on the very first authorization (or when `prompt=consent` is forced). If you previously authorized the app, subsequent flows don't return a new refresh token.

**Fix:** Revoke the app's access at [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions), then reconnect from Settings → Integrations.

---

### `gmail_state` / `gcal_state` / `gdrive_state`

**Cause:** The `state` parameter in the OAuth callback did not match the cookie. This can happen if the cookie expired (10 minute TTL), the browser blocked cookies, or the request came from a different origin.

**Fix:** Retry the connection flow. Make sure the browser allows cookies for your IntelliRender origin. Check that `NEXT_PUBLIC_APP_URL` exactly matches the origin you are accessing the app from.

---

### Google OAuth credentials not configured

**Symptom:** Clicking "Connect" on any Google service returns a 500 with "Google OAuth credentials are not configured."

**Fix:** Upload your OAuth JSON (or paste `clientId` / `clientSecret`) via Settings → Integrations → Google OAuth before connecting any Google service.

---

### Service connects but the agent doesn't use it

**Cause:** The agent only loads services where `mcp_connections.status = 'connected'` and `accessToken IS NOT NULL`. If a connection exists but the token is invalid or the service is disconnected, it is silently skipped.

**Fix:** Go to Settings → Integrations and verify the service shows as connected. If it shows an error state, disconnect and reconnect.

---

### Decryption error / `Invalid ciphertext format`

**Cause:** The `AUTH_SECRET` environment variable changed after tokens were encrypted. Because `lib/encryption.ts` derives the AES key from `AUTH_SECRET`, changing it invalidates all previously encrypted values.

**Fix:** Do not rotate `AUTH_SECRET` without also clearing all encrypted fields in `mcp_connections` and `app_config`. If you need to rotate, disconnect all services, update `AUTH_SECRET`, then reconnect each service.

---

### Slack: agent can't see channels

**Cause:** The bot was not invited to private channels, or the token is missing required scopes.

**Fix:** Invite the bot to channels with `/invite @<your-bot-name>`. Verify the bot token has `channels:history`, `channels:read`, `groups:history`, `groups:read` scopes in the Slack app settings.

---

### PostgreSQL: connection refused

**Cause:** The connection string points to `localhost`, which resolves to the Next.js server container — not the database host.

**Fix:** Use the fully qualified hostname or IP of the database server in the connection string, not `localhost`.

---

### Google Forms: MCP server not found

**Cause:** The Google Forms MCP server runs from a local path (`/mnt/drive1/projects/google-forms-mcp/build/index.js`) rather than an npm package. If this path doesn't exist, the subprocess fails to start.

**Fix:** Clone and build the `google-forms-mcp` project at that path before connecting the service.
