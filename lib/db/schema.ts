import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  primaryKey,
  boolean,
  unique,
} from 'drizzle-orm/pg-core';

// ── Auth tables (required by @auth/drizzle-adapter) ──────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').unique().notNull(),
  password: text('password'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ── App tables ────────────────────────────────────────────────────────────────

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  isManuallyTitled: boolean('is_manually_titled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  chatId: serial('chat_id').references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  widget: jsonb('widget'),
  toolInvocations: jsonb('tool_invocations'),
  // Full HTML payload of a generated html-canvas widget, persisted so it can be
  // re-rendered after a page reload (the live render comes from widget/toolInvocations).
  widgetHtml: text('widget_html'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── User settings — encrypted key/value store ─────────────────────────────────

export const userSettings = pgTable(
  'user_settings',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique('user_settings_user_key').on(t.userId, t.key)],
);

// ── MCP service connections — OAuth tokens and PATs ───────────────────────────

export const mcpConnections = pgTable(
  'mcp_connections',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    service: text('service').notNull(), // 'github' | 'linear' | 'notion' | 'google_drive' | 'gmail' | 'google_calendar'
    accessToken: text('access_token'),  // AES-256-GCM encrypted
    refreshToken: text('refresh_token'), // AES-256-GCM encrypted
    tokenExpiry: timestamp('token_expiry'),
    status: text('status').notNull().default('not_connected'), // 'connected' | 'not_connected' | 'error' | 'expired'
    metadata: jsonb('metadata'), // display name, scopes, org, etc.
    lastSynced: timestamp('last_synced'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique('mcp_connections_user_service').on(t.userId, t.service)],
);

// ── App-level config (not per-user) ──────────────────────────────────────────
// Stores global settings like Google OAuth client credentials uploaded by admin.
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  encryptedValue: text('encrypted_value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Custom MCP servers — admin-managed stdio server configs ───────────────────
// Replaces the per-browser localStorage list. These are app-level: every Agent
// Loop session loads the enabled ones as stdio child processes. userId records
// who created the entry (nullable for seeded/global defaults).
export const customMcpServers = pgTable('custom_mcp_servers', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  command: text('command').notNull(),
  args: jsonb('args').$type<string[]>().notNull().default([]),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
