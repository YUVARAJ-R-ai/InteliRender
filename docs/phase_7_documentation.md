# Phase 7 — Integrations, Widgets, UX & Bug Fixes

This document records every change made during Phase 7 of IntelliRender development. Phase 7 covered six major areas: per-user Google Forms architecture, Google OAuth UI flow, new MCP integrations and built-in tools, new widget types and skills, critical bug fixes, and a full UX navigation overhaul.

---

## 1. Per-User Google Forms Architecture

### Problem
All users shared a single `GOOGLE_REFRESH_TOKEN` stored in `.env`. Every form created went into the same Google account — the one that ran `get-refresh-token.js` during server setup.

### Solution
Google Forms moved from the global env model to the per-user DB-backed model already used by GitHub/Linear/Notion.

**Files changed:**
- `app/api/chat/agent/route.ts` — added `google_forms` to `DB_MCP_SERVICE_CONFIGS` with `envKey: 'GOOGLE_REFRESH_TOKEN'` and `appConfigEnv` for CLIENT_ID/SECRET
- `app/api/settings/mcp/[service]/route.ts` — added `'google_forms'` to `SUPPORTED_SERVICES` (it was missing, causing silent 400 on connect)
- `app/api/settings/google-oauth/route.ts` *(new)* — `GET` returns `{ configured: bool }`, `POST` accepts and stores encrypted `client_id` + `client_secret` from the JSON file
- `lib/app-config.ts` *(new)* — `getAppConfig` / `setAppConfig` / `hasAppConfig` helpers for app-level encrypted key-value storage
- `lib/db/schema.ts` — added `appConfig` table (key, encryptedValue, updatedAt)
- `components/SettingsModal.tsx` — `GoogleOAuthCard` component: file upload for `client_secret_*.json`, stores credentials in DB, shows configured/not-configured status

**How it works at runtime:**
At request time `loadDbMcpServers(userId)` decrypts only that user's refresh token and injects it as `GOOGLE_REFRESH_TOKEN` when spawning the MCP subprocess. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` come from DB (appConfig) or fall back to `process.env`.

---

## 2. Google Forms OAuth UI Flow

### Problem
Users had to run `node get-refresh-token.js` locally, copy the token, and paste it manually — a developer-only workflow incompatible with multi-user hosting.

### Solution
A proper OAuth 2.0 authorization code flow implemented entirely within the app.

**Files created:**
- `app/api/auth/google-forms/route.ts` — generates random CSRF state, sets `gf_oauth_state` httpOnly cookie, redirects to Google consent screen
- `app/api/auth/google-forms/callback/route.ts` — verifies state cookie, exchanges code for tokens via `POST https://oauth2.googleapis.com/token`, encrypts and upserts `refresh_token` into `mcp_connections`, redirects to `/?settings=Integrations&connected=google_forms`

**SettingsModal changes:**
- `IntegrationDef` type changed to a discriminated union: `authType: 'pat'` (password input) or `authType: 'oauth'` (OAuth button)
- Google Forms entry changed to `authType: 'oauth'`, `oauthPath: '/api/auth/google-forms'`
- `IntegrationsSection` renders "Connect with Google" anchor for OAuth services
- `oauthResult` prop surfaces success/error banners after redirect
- `SettingsModal` accepts `initialSection` and `oauthResult` props

**`UserMenu.tsx`** (later moved to `Sidebar.tsx`):
- `useEffect` on mount detects `?settings=Integrations` URL param, auto-opens Settings/Integrations, cleans URL with `history.replaceState`

**Prerequisite:** `http://localhost:3000/api/auth/google-forms/callback` must be registered as an authorized redirect URI in the Google Cloud Console OAuth client.

---

## 3. New MCP Integrations

Six new services added to the `DB_MCP_SERVICE_CONFIGS` pattern.

### Google Services (OAuth — same flow as Google Forms)

| Service | npm Package | OAuth Scope | Callback Route |
|---|---|---|---|
| **Gmail** | `mcp-gmail` | `gmail.modify` | `/api/auth/gmail/callback` |
| **Google Drive** | `mcp-google-drive` | `drive` | `/api/auth/google-drive/callback` |
| **Google Calendar** | `google-calendar-mcp` | `calendar` | `/api/auth/google-calendar/callback` |

Each has a pair of route files: `app/api/auth/[service]/route.ts` (initiate) and `app/api/auth/[service]/callback/route.ts` (exchange code, upsert token). All reuse the same `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from appConfig.

### PAT/Connection-String Services

| Service | npm Package | Primary Env Var | Extra Config |
|---|---|---|---|
| **Stripe** | `@stripe/agent-toolkit` | `STRIPE_SECRET_KEY` | — |
| **PostgreSQL** | `@modelcontextprotocol/server-postgres` | `POSTGRES_CONNECTION_STRING` | — |
| **Slack** | `@modelcontextprotocol/server-slack` | `SLACK_BOT_TOKEN` | `SLACK_TEAM_ID` from `conn.metadata` |

### Metadata Forwarding Extension

Slack and future multi-env MCPs use a new `metadataEnv?: Record<string, string>` field in `DB_MCP_SERVICE_CONFIGS`. `loadDbMcpServers` reads secondary non-secret values from `mcpConnections.metadata` (already a JSONB column) and injects them as env vars. No schema migration needed.

**Files changed:**
- `app/api/chat/agent/route.ts` — 6 new entries in `DB_MCP_SERVICE_CONFIGS`, `metadataEnv` field in type, metadata resolution loop in `loadDbMcpServers`
- `app/api/settings/mcp/[service]/route.ts` — `SUPPORTED_SERVICES` extended with all 6 new services
- `components/SettingsModal.tsx` — new icons imported, 6 new entries in `INTEGRATION_DEFS`
- `app/api/auth/gmail/`, `app/api/auth/google-drive/`, `app/api/auth/google-calendar/` *(new route pairs)*

---

## 4. New Built-In Tools

Three new tools added directly to `dynamicTools` in `app/api/chat/agent/route.ts`. Zero new infrastructure.

| Tool | Schema | What it does |
|---|---|---|
| `fetch_url` | `{ url }` | Fetches any URL, strips HTML tags, returns up to 8k chars of text |
| `calculate` | `{ expression, description? }` | Safe math evaluator (restricted `Function` constructor); returns `{ expression, result }` |
| `generate_csv` | `{ headers, rows, filename? }` | Builds a `data:text/csv` URI — model replies with it as a markdown download link |

`SYSTEM_PROMPT` updated with selection rules for all three tools.

### `stopWhen: stepCountIs(15)` Fix

**Critical fix:** AI SDK v6 replaced `maxSteps` with `stopWhen`. The codebase still used `maxSteps: 15` which was silently ignored. The model defaulted to `stepCountIs(1)` — it called the tool and stopped, never generating the follow-up text reply (the clickable form link). Changed to `stopWhen: stepCountIs(15)` which allows the multi-step loop to continue after tool calls.

---

## 5. New Skills

Five new entries in `lib/skills.ts` (`BUILTIN_SKILLS`), all rendered as `html-canvas` widgets:

| Trigger | Name | Template |
|---|---|---|
| `@timeline` | Timeline / Gantt | `"Create a project timeline for "` |
| `@mindmap` | Mind Map | `"Create a mind map for "` |
| `@matrix` | Decision Matrix | `"Create a decision matrix comparing "` |
| `@flowchart` | Flowchart | `"Create a flowchart for "` |
| `@pomodoro` | Pomodoro Timer | `"Create a pomodoro timer for "` |

---

## 6. New Widget Types

Four new widget types added end-to-end (schema → component → registry → tool enum).

### 6.1 `treemap` — Hierarchical Area Chart

- **Component:** `components/widgets/TreemapWidget.tsx`
- **Uses:** `recharts` `<Treemap>` (already installed — zero new deps)
- **Schema:** `{ title: string, data: [{ name, value, color? }] }`
- **Use cases:** Budget breakdown, portfolio allocation, code complexity, disk usage

### 6.2 `code-diff` — Side-by-Side Diff

- **Component:** `components/widgets/CodeDiffWidget.tsx`
- **Uses:** Pure React (no new deps)
- **Schema:** `{ language, before, after, filename? }`
- **Use cases:** Code review (from GitHub MCP), refactoring comparison
- **Rendering:** Line-by-line diff with red/green highlighting for changed lines

### 6.3 `timeline` — Gantt-Style Timeline

- **Component:** `components/widgets/TimelineWidget.tsx`
- **Uses:** Pure CSS — no dependencies
- **Schema:** `{ title, items: [{ id, label, start, end, color?, group? }] }`
- **Use cases:** Project planning, sprint visualization, event scheduling
- **Features:** Hover tooltips with date ranges, group color coding, date ruler

### 6.4 `network-graph` — Force-Directed Node/Edge Diagram

- **Component:** `components/widgets/NetworkGraphWidget.tsx`
- **Uses:** Pure `<canvas>` + `requestAnimationFrame` — no new deps
- **Schema:** `{ nodes: [{ id, label, group?, size? }], edges: [{ source, target, label?, weight? }] }`
- **Use cases:** Org charts, dependency graphs, social networks, knowledge graphs
- **Physics:** Force simulation runs for 180 frames then settles; hover highlights nodes

**All four widgets wired into:**
- `types/widget.ts` — Zod schemas + exported types + discriminated union extended
- `components/widgets/WidgetRenderer.tsx` — registry entries added
- `app/api/chat/agent/route.ts` — `render_widget` type enum extended, `execute` handler cases added

### Bug Fix: Double-Nesting Widget Data

**Problem:** The four new widgets returned `{ type, params: {...} }`. `MessageBubble` wraps the entire tool result as the widget's `params`, producing `params = { type, params }` — so `params.data` was `undefined`. Feeding `undefined` to recharts `<Treemap>` triggered a layout-state thrash loop → "Maximum update depth exceeded".

**Fix:** Changed all four widget execute branches to return **flat** data (`{ type, ...params.params }`) matching the kanban/dashboard/gravity convention. Added `?? []` defensive guards in each component for malformed/missing data.

---

## 7. Critical Bug Fixes

### 7.1 Chat Switching to Wrong Chat Mid-Session (Bug 1)

**Root cause:** `new DefaultChatTransport({...})` was created on every render, giving `useChat` a new transport reference each render. The transport's `fetch` callback captured `chatId` from a stale closure. When a response came back for an old session, `idNum !== chatId` evaluated against the *current* (new) chatId, triggering `onChatCreated` with the wrong id and switching the user back to a previous chat.

**Fix in `components/chat/ChatWindow.tsx`:**
- Added `chatIdRef`, `onChatCreatedRef`, `sessionRef` (increments on every chatId change)
- Memoized the transport with `useMemo([], [])` — created once, uses refs for live values
- Session guard in the fetch callback: `sessionRef.current === sessionAtSend` prevents stale responses from calling `onChatCreated`

### 7.2 Maximum Update Depth Exceeded (Bug 2)

**Root cause:** `new DefaultChatTransport({...})` on every render destabilized `setAgentMessages` from `useChat`. This was in the dep array of the chat-loading `useEffect`, causing it to re-run every render, calling `setAgentMessages([])`, which triggered the sync effect (`agentMessages → messages`), which called `setMessages`, triggering another render — infinite loop.

**Fixes:**
- Transport memoization (same fix as Bug 1) stabilized `setAgentMessages`
- Chat-loading `useEffect` dep array changed from `[chatId, setAgentMessages]` to `[chatId]`
- Sync effect (`agentMessages → messages`) now only fires during `agentStatus === 'submitted' | 'streaming'` — prevents DB-loaded messages from being overwritten on chat switch

### 7.3 Chat Disappearing After Reload

**Root cause:** The agent route's new-chat insertion was `db.insert(chats).values({ title })` — no `userId`. `GET /api/chats` filters by `eq(chats.userId, session.user.id)`, so orphaned chats were invisible after reload.

**Fix in `app/api/chat/agent/route.ts`:**
```typescript
const [newChat] = await db.insert(chats).values({ title, userId }).returning();
```

### 7.4 Empty-State Flash on First Message

**Root cause:** When `onChatCreated(id)` fired, `chatId` changed from `null` → real id, triggering the DB-load `useEffect` which immediately called `setMessages([])` — the empty-state "What shall we build today?" screen flashed back for a frame.

**Fix in `components/chat/ChatWindow.tsx`:**
- Added `locallyCreatedChatIdRef`
- Set before calling `onChatCreated` in both agent transport and standard `handleSubmit`
- Load effect skips the clear+reload when `chatId === locallyCreatedChatIdRef.current`

### 7.5 Google Forms Link Not Rendering (AI SDK v6)

**Root cause:** `stopWhen` was missing (former `maxSteps: 15` silently ignored in SDK v6). Model stopped after tool call, never producing the text reply with the link. JSON blob showed in tool result panel but no clickable link appeared.

**Fix:** `stopWhen: stepCountIs(15)` imported from `'ai'` and used in `streamText`.

### 7.6 Sidebar Effect Loading Chats on Every Chat Switch

**Root cause:** `useEffect([ activeChatId ])` in `Sidebar.tsx` triggered `loadChats()` + MCP server re-read on every chat selection (5 → 7, etc.), making unnecessary network requests that could race with state.

**Fix:** Split into two effects — MCP servers load once on `[]`, chat list reloads only when `prevActiveChatIdRef.current === null` (mount + new chat creation).

---

## 8. Google Forms Form Link Fix

**Problem:** After form creation, the model output showed raw JSON from the tool result with no clickable link.

**Two-part fix:**

1. **`SYSTEM_PROMPT` strengthened** — replaced the soft hint with a hard requirement specifying the exact output format the model must produce after `create_google_form` completes.

2. **Tool return value** — added a `message` field containing pre-formatted markdown: `✅ Your form is ready!\n\n**[Open Form →](url)**\n[Edit Form](editUrl)`. The model sees this in the tool result and has clear instruction to use it.

3. **`MessageBubble.tsx`** — added a custom `a` component renderer so markdown links open in a new tab (`target="_blank"`) with blue accent styling.

---

## 9. Sidebar Navigation Overhaul (UX)

### Problem
Three separate paths to related settings (Settings modal tabs vs. sidebar "MCP Configuration" item), deeply buried behind avatar → modal → tab. Duplicate entry for MCP.

### Solution: Right-Side Drawers

**New `components/Drawer.tsx`:**
A reusable right-side drawer (420px, full height, dark themed). On mobile `< 768px` becomes a full-width bottom sheet. Features:
- Backdrop overlay (does not push main content)
- Slide-in animation (`ir-drawer-in` keyframe added to `globals.css`)
- Dismissible via Escape key or backdrop click
- Single `activeDrawer` state — opening one closes any other

**Sidebar layout after fix:**

```
+ New Chat
─────────────────
RECENT CHATS
[chat list]
─────────────────
TOOLS
⚡ Integrations    → opens Integrations drawer
🔑 API Keys        → opens API Keys drawer
🔧 MCP Servers     → opens MCP Servers drawer
─────────────────
SYSTEM
⎇ Workflow
🗄 Archive
─────────────────
[user avatar]
```

**`SettingsModal.tsx` reduced** to three tabs: Appearance, Workspace, Behavior. `ApiKeysSection` and `IntegrationsSection` exported and reused directly in the Sidebar drawers.

**OAuth-return handler moved** from `UserMenu.tsx` to `Sidebar.tsx` — now opens the Integrations drawer instead of the Settings modal when returning from a Google OAuth flow.

**`UserMenu.tsx` simplified** — removed OAuth-return state, Integrations-specific props, and `settingsSection` state. Settings button opens the modal at the default (Appearance) tab.

---

## 10. HTML Widget Persistence

### Problem
Agent-generated HTML canvas widgets (`html-canvas` type) were lost on page reload. The message text persisted in the DB, but the iframe content was never saved.

### Solution

**Schema change** (`lib/db/schema.ts`):
```typescript
widgetHtml: text('widget_html'),  // nullable, persisted HTML payload
```

**Migration** (idempotent, run at deploy):
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS widget_html TEXT;
```

**Save (atomic with the message):**
- `app/api/chat/agent/route.ts` — `onFinish` reads the completed `html-canvas` tool result after all steps complete (never streaming HTML) and writes it as `widgetHtml`
- `app/api/chat/route.ts` — standard mode writes `widgetHtml` from `aiResponse.widget.params.html` in the same DB insert

**Render after reload** (`components/chat/MessageBubble.tsx`):
New `PersistedHtmlWidget` component:
```tsx
<iframe
  srcDoc={html}
  sandbox="allow-scripts allow-same-origin"
  onLoad={() => { ref.current.style.height = `${doc.body.scrollHeight}px`; }}
/>
```
- Takes precedence over the live render path when `message.widgetHtml` is non-null
- Height auto-sets to content's `scrollHeight` on load
- Non-widget messages completely unaffected

**`ChatWindow.tsx`** — maps `widgetHtml` from the DB response into the `ChatMessage` state.

**`types/widget.ts`** — `ChatMessage` type extended with `widgetHtml?: string | null`.

---

## 11. File Index

### New Files

| File | Purpose |
|---|---|
| `components/Drawer.tsx` | Reusable right-side drawer / bottom sheet |
| `components/widgets/TreemapWidget.tsx` | Treemap widget (recharts) |
| `components/widgets/CodeDiffWidget.tsx` | Side-by-side diff widget |
| `components/widgets/TimelineWidget.tsx` | Gantt-style timeline widget |
| `components/widgets/NetworkGraphWidget.tsx` | Force-directed network graph |
| `lib/app-config.ts` | App-level encrypted key-value store helpers |
| `app/api/settings/google-oauth/route.ts` | Store/query Google OAuth app credentials |
| `app/api/auth/google-forms/route.ts` | Google Forms OAuth initiation |
| `app/api/auth/google-forms/callback/route.ts` | Google Forms OAuth callback |
| `app/api/auth/gmail/route.ts` | Gmail OAuth initiation |
| `app/api/auth/gmail/callback/route.ts` | Gmail OAuth callback |
| `app/api/auth/google-drive/route.ts` | Google Drive OAuth initiation |
| `app/api/auth/google-drive/callback/route.ts` | Google Drive OAuth callback |
| `app/api/auth/google-calendar/route.ts` | Google Calendar OAuth initiation |
| `app/api/auth/google-calendar/callback/route.ts` | Google Calendar OAuth callback |

### Modified Files

| File | What changed |
|---|---|
| `app/api/chat/agent/route.ts` | `DB_MCP_SERVICE_CONFIGS` (9 services), metadata forwarding, 3 new tools, `stopWhen`, widget HTML persistence, `userId` on chat insert |
| `app/api/chat/route.ts` | `widgetHtml` persisted on insert |
| `app/api/settings/mcp/[service]/route.ts` | `SUPPORTED_SERVICES` extended |
| `lib/db/schema.ts` | `appConfig` table, `widgetHtml` column on messages |
| `lib/skills.ts` | 5 new skills added |
| `types/widget.ts` | 4 new widget schemas/types, `widgetHtml` on `ChatMessage` |
| `components/SettingsModal.tsx` | `ApiKeysSection`/`IntegrationsSection` exported; tabs reduced to 3; `GoogleOAuthCard`; OAuth discriminated union; `oauthResult` banners |
| `components/Sidebar.tsx` | Tools drawers, OAuth-return handler, removed duplicate MCP modal |
| `components/UserMenu.tsx` | Removed OAuth-return logic, simplified |
| `components/chat/ChatWindow.tsx` | Stable transport (useMemo + refs), session guard, sync effect guard, local chat id guard, `widgetHtml` mapped |
| `components/chat/MessageBubble.tsx` | `PersistedHtmlWidget`, `a` tag renderer, `widgetHtml` render path |
| `components/widgets/WidgetRenderer.tsx` | 4 new widget registrations |
| `app/globals.css` | `ir-drawer-in` keyframe + class |
