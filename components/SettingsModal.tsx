'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Monitor, Sun, Moon, Type, LayoutGrid, Zap, Key, Plug, Eye, EyeOff, CheckCircle, Circle, Loader2, Trash2, GitBranch, FileText, Layers, Upload, ShieldCheck, Mail, HardDrive, Calendar, CreditCard, Database, MessageSquare } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';

const ACCENT_SWATCHES = [
  { color: '#8AB4F8', label: 'Blue'    },
  { color: '#A78BFA', label: 'Violet'  },
  { color: '#34D399', label: 'Emerald' },
  { color: '#F87171', label: 'Coral'   },
  { color: '#FBBF24', label: 'Amber'   },
  { color: '#38BDF8', label: 'Sky'     },
  { color: '#F472B6', label: 'Pink'    },
  { color: '#A3E635', label: 'Lime'    },
];

const MODELS = ['DeepSeek-V4-Flash', 'DeepSeek-R1', 'Claude 3.5 Sonnet', 'GPT-4o'];

export type Section = 'Appearance' | 'Workspace' | 'Behavior';

const NAV: { label: Section; icon: React.ComponentType<any> }[] = [
  { label: 'Appearance',   icon: Monitor    },
  { label: 'Workspace',    icon: LayoutGrid },
  { label: 'Behavior',     icon: Zap        },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]/40 shrink-0 ${
        value ? 'bg-[#8AB4F8]' : 'bg-[#3a3a3a]'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-[19px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
  icons,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  icons?: React.ElementType[];
}) {
  return (
    <div className="flex bg-[#161616] border border-[#2a2a2a] rounded-lg p-0.5 gap-0.5">
      {options.map((opt, i) => {
        const Icon = icons?.[i] as React.ComponentType<any> | undefined;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-1.5 px-2 rounded transition-all duration-150 capitalize ${
              value === opt
                ? 'bg-[#2a2a2a] text-[#E8EDF2] shadow-sm'
                : 'text-[#6B7280] hover:text-[#9CA3AF]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1e1e1e] last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#C8CDD3]">{label}</div>
        {description && <div className="text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── API Keys section ──────────────────────────────────────────────────────────

const API_KEY_DEFS = [
  { key: 'api_key_siliconflow', label: 'SiliconFlow', description: 'Used for DeepSeek-V4-Flash (main model)', placeholder: 'sk-...' },
  { key: 'api_key_openai',      label: 'OpenAI',      description: 'Optional — for GPT models',              placeholder: 'sk-proj-...' },
  { key: 'api_key_anthropic',   label: 'Anthropic',   description: 'Optional — for Claude models',           placeholder: 'sk-ant-...' },
  { key: 'api_key_custom',      label: 'Custom MCP Token', description: 'Auth token for custom MCP servers', placeholder: 'Token...' },
];

export function ApiKeysSection() {
  const [statuses, setStatuses] = useState<Record<string, { saved: boolean; hint: string }>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/keys');
    if (res.ok) setStatuses(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(key: string) {
    const val = inputs[key]?.trim();
    if (!val) return;
    setBusy(b => ({ ...b, [key]: 'saving' }));
    await fetch('/api/settings/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: val }) });
    setInputs(i => ({ ...i, [key]: '' }));
    await load();
    setBusy(b => ({ ...b, [key]: null }));
  }

  async function handleDelete(key: string) {
    setBusy(b => ({ ...b, [key]: 'deleting' }));
    await fetch(`/api/settings/keys/${key}`, { method: 'DELETE' });
    await load();
    setBusy(b => ({ ...b, [key]: null }));
  }

  async function handleTest(key: string) {
    setBusy(b => ({ ...b, [key]: 'testing' }));
    const res = await fetch(`/api/settings/keys/${key}`, { method: 'POST' });
    const data = await res.json();
    setBusy(b => ({ ...b, [key]: data.valid ? 'ok' : 'fail' }));
    setTimeout(() => setBusy(b => ({ ...b, [key]: null })), 2500);
  }

  return (
    <div className="space-y-4 pb-2">
      <p className="text-[11px] text-[#6B7280] leading-relaxed">
        Keys are encrypted (AES-256-GCM) before storage. Values are write-only — they cannot be retrieved after saving.
      </p>
      {API_KEY_DEFS.map(({ key, label, description, placeholder }) => {
        const st = statuses[key];
        const b = busy[key];
        return (
          <div key={key} className="bg-[#161616] border border-[#242424] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              {st?.saved
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <Circle className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />}
              <span className="text-[13px] font-medium text-[#C8CDD3]">{label}</span>
              <span className={`text-[10px] ml-auto ${st?.saved ? 'text-emerald-400' : 'text-[#6B7280]'}`}>
                {st?.saved ? `Saved  ${st.hint}` : 'Not configured'}
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280]">{description}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={visible[key] ? 'text' : 'password'}
                  value={inputs[key] ?? ''}
                  onChange={e => setInputs(i => ({ ...i, [key]: e.target.value }))}
                  placeholder={st?.saved ? '••••••••  (enter new value to replace)' : placeholder}
                  className="w-full bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 pr-8 py-1.5 text-[12px] text-[#C8CDD3] placeholder-[#4B5563] focus:outline-none focus:border-[#8AB4F8] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#9CA3AF] transition-colors"
                >
                  {visible[key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={() => handleSave(key)}
                disabled={!inputs[key]?.trim() || b === 'saving'}
                className="px-3 py-1.5 rounded-lg bg-[#8AB4F8] hover:bg-white disabled:opacity-40 text-[#1a1a1a] text-[12px] font-semibold transition-colors shrink-0"
              >
                {b === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
              {st?.saved && (
                <>
                  <button
                    onClick={() => handleTest(key)}
                    disabled={!!b}
                    className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] border border-[#3a3a3a] text-[12px] text-[#9CA3AF] transition-colors shrink-0"
                  >
                    {b === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : b === 'ok' ? '✓ Valid' : b === 'fail' ? '✗ Invalid' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDelete(key)}
                    disabled={!!b}
                    className="px-2 py-1.5 rounded-lg bg-[#242424] hover:bg-red-500/10 border border-[#3a3a3a] hover:border-red-500/30 text-[#6B7280] hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Google OAuth app credentials card ────────────────────────────────────────

function GoogleOAuthCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings/google-oauth')
      .then(r => r.json())
      .then(d => setConfigured(d.configured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess(false);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await save(json);
    } catch {
      setError('Invalid JSON file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save(payload: object) {
    setSaving(true);
    const res = await fetch('/api/settings/google-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { setConfigured(true); setSuccess(true); }
    else { const d = await res.json(); setError(d.error ?? 'Save failed.'); }
  }

  return (
    <div className="bg-[#161616] border border-[#242424] rounded-xl p-4 mb-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#242424] border border-[#2e2e2e] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#9CA3AF]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#C8CDD3]">Google OAuth App</div>
            <div className="text-[11px] text-[#6B7280]">App-level credentials shared by all users</div>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
          configured
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-[#242424] text-[#6B7280] border border-[#2e2e2e]'
        }`}>
          {configured === null ? '...' : configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {success && (
          <p className="text-[11px] text-emerald-400">Credentials saved successfully.</p>
        )}
        {error && (
          <p className="text-[11px] text-red-400">{error}</p>
        )}
        <p className="text-[10px] text-[#4B5563] leading-relaxed">
          Upload the <code className="text-[#8AB4F8]">client_secret_*.json</code> file downloaded from Google Cloud Console.
          Supports both Desktop and Web app credential types.
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] border border-[#3a3a3a] text-[12px] text-[#C8CDD3] font-medium transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : configured ? 'Replace credentials' : 'Upload JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Integrations section ──────────────────────────────────────────────────────

type IntegrationDef =
  | { service: string; label: string; icon: React.ComponentType<any>; description: string; authType: 'pat'; placeholder: string; hint?: string }
  | { service: string; label: string; icon: React.ComponentType<any>; description: string; authType: 'oauth'; oauthPath: string };

const INTEGRATION_DEFS: IntegrationDef[] = [
  // ── Google services (OAuth) ──
  {
    service: 'gmail',
    label: 'Gmail',
    icon: Mail,
    description: 'Read, search, draft and send emails.',
    authType: 'oauth',
    oauthPath: '/api/auth/gmail',
  },
  {
    service: 'google_drive',
    label: 'Google Drive',
    icon: HardDrive,
    description: 'List, read, create and manage Drive files.',
    authType: 'oauth',
    oauthPath: '/api/auth/google-drive',
  },
  {
    service: 'google_calendar',
    label: 'Google Calendar',
    icon: Calendar,
    description: 'Read and create calendar events.',
    authType: 'oauth',
    oauthPath: '/api/auth/google-calendar',
  },
  // ── Dev tools (PAT) ──
  { service: 'github', label: 'GitHub',  icon: GitBranch,    description: 'Repos, issues, PRs, workflow dispatch', authType: 'pat', placeholder: 'ghp_...' },
  { service: 'linear', label: 'Linear',  icon: Layers,        description: 'Issues, projects, team management',      authType: 'pat', placeholder: 'lin_api_...' },
  { service: 'notion', label: 'Notion',  icon: FileText,      description: 'Pages, databases, search',               authType: 'pat', placeholder: 'secret_...' },
  // ── Data & comms (PAT) ──
  { service: 'stripe',   label: 'Stripe',   icon: CreditCard,   description: 'Revenue dashboards, payments, subscriptions', authType: 'pat', placeholder: 'sk_live_...' },
  { service: 'postgres', label: 'PostgreSQL', icon: Database,   description: 'Query your Postgres database live',           authType: 'pat', placeholder: 'postgresql://user:pass@host/db' },
  { service: 'slack',    label: 'Slack',    icon: MessageSquare, description: 'Read channels, send messages, search',        authType: 'pat', placeholder: 'xoxb-...', hint: 'Create a Bot token at api.slack.com/apps → OAuth & Permissions. Also paste your Team ID (Settings tab) in the field below.' },
];

export function IntegrationsSection({ oauthResult }: { oauthResult?: { connected?: string; error?: string } }) {
  const [connections, setConnections] = useState<Record<string, { status: string; lastSynced: string | null }>>({});
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/mcp');
    if (res.ok) {
      const data: { service: string; status: string; lastSynced: string | null }[] = await res.json();
      const map: Record<string, { status: string; lastSynced: string | null }> = {};
      data.forEach(c => { map[c.service] = { status: c.status, lastSynced: c.lastSynced }; });
      setConnections(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConnect(service: string) {
    const token = tokenInputs[service]?.trim();
    if (!token) return;
    setConnecting(c => ({ ...c, [service]: true }));
    await fetch(`/api/settings/mcp/${service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    setTokenInputs(t => ({ ...t, [service]: '' }));
    await load();
    setConnecting(c => ({ ...c, [service]: false }));
  }

  async function handleDisconnect(service: string) {
    setConnecting(c => ({ ...c, [service]: true }));
    await fetch(`/api/settings/mcp/${service}`, { method: 'DELETE' });
    await load();
    setConnecting(c => ({ ...c, [service]: false }));
  }

  return (
    <div className="space-y-3 pb-2">
      {oauthResult?.error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">
          Connection failed. Please try again.
        </div>
      )}
      <GoogleOAuthCard />
      <p className="text-[11px] text-[#6B7280] leading-relaxed">
        Connected services are automatically available as tools in Agent Loop mode — no manual MCP registration needed.
      </p>
      {INTEGRATION_DEFS.map((def) => {
        const { service, label, icon: Icon, description, authType } = def;
        const conn = connections[service];
        const isConnected = conn?.status === 'connected';
        const isBusy = connecting[service];
        return (
          <div key={service} className="bg-[#161616] border border-[#242424] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#242424] border border-[#2e2e2e] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#9CA3AF]" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#C8CDD3]">{label}</div>
                  <div className="text-[11px] text-[#6B7280]">{description}</div>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#242424] text-[#6B7280] border border-[#2e2e2e]'
              }`}>
                {isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>

            {isConnected ? (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[#4B5563]">
                  {conn?.lastSynced ? `Last synced ${new Date(conn.lastSynced).toLocaleDateString()}` : ''}
                </span>
                <button
                  onClick={() => handleDisconnect(service)}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-red-500/10 border border-[#3a3a3a] hover:border-red-500/30 text-[12px] text-[#9CA3AF] hover:text-red-400 transition-colors"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
                </button>
              </div>
            ) : authType === 'oauth' ? (
              <div className="mt-3">
                <a
                  href={def.oauthPath}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8AB4F8] hover:bg-white text-[#1a1a1a] text-[12px] font-semibold transition-colors"
                >
                  Connect with Google
                </a>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {def.hint && (
                  <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#6B7280] mb-1 font-medium uppercase tracking-wider">How to get your token</p>
                    <code className="text-[10px] text-[#8AB4F8] font-mono break-all">{def.hint}</code>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInputs[service] ?? ''}
                    onChange={e => setTokenInputs(t => ({ ...t, [service]: e.target.value }))}
                    placeholder={def.placeholder}
                    className="flex-1 bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[12px] text-[#C8CDD3] placeholder-[#4B5563] focus:outline-none focus:border-[#8AB4F8] transition-colors"
                  />
                  <button
                    onClick={() => handleConnect(service)}
                    disabled={!tokenInputs[service]?.trim() || isBusy}
                    className="px-3 py-1.5 rounded-lg bg-[#8AB4F8] hover:bg-white disabled:opacity-40 text-[#1a1a1a] text-[12px] font-semibold transition-colors shrink-0"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SettingsModal({ onClose, initialSection }: {
  onClose: () => void;
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection ?? 'Appearance');
  const { settings, set } = useSettings();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 ir-fade-in"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="ir-fade-slide-up bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl w-full max-w-[660px] max-h-[80vh] flex overflow-hidden shadow-2xl">

        {/* Left nav */}
        <div className="w-[168px] shrink-0 border-r border-[#242424] flex flex-col bg-[#141414]">
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-[13px] font-semibold text-[#E8EDF2]">Settings</h2>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setSection(label)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors duration-150 ${
                  section === label
                    ? 'bg-[#2a2a2a] text-[#E8EDF2]'
                    : 'text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#1e1e1e]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="px-4 pb-4 text-[10px] text-[#4B5563]">IntelliRender v0.1</div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#242424] shrink-0">
            <h3 className="text-[14px] font-semibold text-[#E8EDF2]">{section}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[#4B5563] hover:text-[#9CA3AF] p-1 rounded-lg hover:bg-[#242424] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {section === 'Appearance' && (
              <div>
                <Row label="Theme" description="Choose your preferred color scheme.">
                  <Segment
                    options={['dark', 'light', 'system'] as const}
                    value={settings.theme}
                    onChange={v => set('theme', v)}
                    icons={[Moon, Sun, Monitor]}
                  />
                </Row>
                <Row label="Accent color" description="Highlight color used across the UI.">
                  <div className="flex items-center gap-1.5">
                    {ACCENT_SWATCHES.map(({ color, label }) => (
                      <button
                        key={color}
                        type="button"
                        title={label}
                        onClick={() => set('accentColor', color)}
                        className="w-5 h-5 rounded-full transition-all duration-150 ring-offset-[#1a1a1a] ring-offset-2 hover:scale-110"
                        style={{
                          backgroundColor: color,
                          boxShadow: settings.accentColor === color ? `0 0 0 2px ${color}` : undefined,
                          outline: settings.accentColor === color ? `2px solid ${color}` : '2px solid transparent',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                </Row>
                <Row label="Font size" description="Controls text size in the chat area.">
                  <Segment
                    options={['sm', 'md', 'lg'] as const}
                    value={settings.fontSize}
                    onChange={v => set('fontSize', v)}
                    icons={[Type, Type, Type]}
                  />
                </Row>
              </div>
            )}

            {section === 'Workspace' && (
              <div>
                <Row label="Default model" description="Model used for new conversations.">
                  <select
                    value={settings.defaultModel}
                    onChange={e => set('defaultModel', e.target.value)}
                    className="bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[12px] text-[#C8CDD3] focus:outline-none focus:border-[#8AB4F8] transition-colors cursor-pointer"
                  >
                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Row>
                <Row label="Default mode" description="Mode applied when starting a new chat.">
                  <Segment
                    options={['standard', 'agent'] as const}
                    value={settings.defaultMode}
                    onChange={v => set('defaultMode', v)}
                  />
                </Row>
                <Row label="Show quick chips" description="Display skill shortcut chips above the input.">
                  <Toggle value={settings.showQuickChips} onChange={v => set('showQuickChips', v)} />
                </Row>
                <Row label="Sidebar collapsed by default" description="Start with the sidebar hidden.">
                  <Toggle value={settings.sidebarCollapsed} onChange={v => set('sidebarCollapsed', v)} />
                </Row>
              </div>
            )}

            {section === 'Behavior' && (
              <div>
                <Row label="Auto-run on suggestion click" description="Immediately send the prompt when you click a suggestion chip.">
                  <Toggle value={settings.autoRun} onChange={v => set('autoRun', v)} />
                </Row>
                <Row label="Stream responses" description="Show the AI response token-by-token as it generates.">
                  <Toggle value={settings.streamResponses} onChange={v => set('streamResponses', v)} />
                </Row>
                <Row label="Show token count" description="Display input/output token usage below each response.">
                  <Toggle value={settings.showTokenCount} onChange={v => set('showTokenCount', v)} />
                </Row>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
