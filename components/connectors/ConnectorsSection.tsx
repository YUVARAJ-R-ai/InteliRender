'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, FlaskConical, Wrench } from 'lucide-react';
import { CONNECTORS, type Connector } from '@/lib/connectors';

interface ConnState { status: string; lastSynced: string | null }

/**
 * Connectors master/detail UI, designed to live inside the settings overlay.
 * oauthResult is passed in by the overlay when returning from an OAuth flow.
 */
export function ConnectorsSection({ oauthResult }: { oauthResult?: { connected?: string; error?: string } }) {
  const [connections, setConnections] = useState<Record<string, ConnState>>({});
  const [selected, setSelected] = useState<string>(oauthResult?.connected ?? CONNECTORS[0].service);
  const [tokenInput, setTokenInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/mcp');
    if (res.ok) {
      const data: { service: string; status: string; lastSynced: string | null }[] = await res.json();
      const map: Record<string, ConnState> = {};
      data.forEach(c => { map[c.service] = { status: c.status, lastSynced: c.lastSynced }; });
      setConnections(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (oauthResult?.connected) {
      setBanner({ kind: 'ok', text: `${oauthResult.connected} connected successfully.` });
    } else if (oauthResult?.error) {
      setBanner({ kind: 'err', text: oauthResult.error.includes('no_refresh')
        ? 'No refresh token received. Revoke the app in your Google account settings and reconnect.'
        : oauthResult.error.includes('denied') ? 'Authorization was cancelled.' : 'Connection failed. Please try again.' });
    }
  }, [oauthResult]);

  const conn = CONNECTORS.find(c => c.service === selected)!;
  const isConnected = connections[conn.service]?.status === 'connected';

  async function handleConnectPat() {
    if (!tokenInput.trim()) return;
    setBusy(true);
    await fetch(`/api/settings/mcp/${conn.service}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.trim() }),
    });
    setTokenInput('');
    await load();
    setBusy(false);
  }

  async function handleDisconnect() {
    setBusy(true);
    await fetch(`/api/settings/mcp/${conn.service}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  const connectedList = CONNECTORS.filter(c => connections[c.service]?.status === 'connected');
  const notConnectedList = CONNECTORS.filter(c => connections[c.service]?.status !== 'connected');

  const renderRow = (c: Connector) => {
    const active = c.service === selected;
    const connected = connections[c.service]?.status === 'connected';
    const Icon = c.icon;
    return (
      <button
        key={c.service}
        onClick={() => { setSelected(c.service); setTokenInput(''); }}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
          active ? 'bg-[#242424] text-[#E8EDF2]' : 'text-[#9CA3AF] hover:bg-[#1c1c1c] hover:text-[#E8EDF2]'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-[12.5px] font-medium truncate flex-1">{c.label}</span>
        {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
      </button>
    );
  };

  const DetailIcon = conn.icon;

  return (
    <div className="pb-2">
      {banner && (
        <div className={`mb-4 px-3.5 py-2.5 rounded-lg text-[12px] border ${
          banner.kind === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {banner.text}
        </div>
      )}

      <div className="grid grid-cols-[190px_1fr] gap-4 min-h-[400px]">
        {/* ── Left: connector list ── */}
        <div className="border border-[#242424] rounded-xl bg-[#141414] p-1.5 overflow-y-auto max-h-[460px]">
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280] p-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {connectedList.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.12em] px-2.5 py-1.5">Connected</div>
                  {connectedList.map(renderRow)}
                </>
              )}
              <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.12em] px-2.5 py-1.5 mt-1">
                {connectedList.length > 0 ? 'Available' : 'Connectors'}
              </div>
              {notConnectedList.map(renderRow)}
            </>
          )}
        </div>

        {/* ── Right: detail ── */}
        <div className="border border-[#242424] rounded-xl bg-[#141414] p-5 overflow-y-auto max-h-[460px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#242424] border border-[#2e2e2e] flex items-center justify-center shrink-0">
                <DetailIcon className="w-4.5 h-4.5 text-[#9CA3AF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-[#E8EDF2]">{conn.label}</h3>
                  {conn.readiness === 'experimental' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <FlaskConical className="w-2.5 h-2.5" /> Experimental
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#6B7280] mt-0.5">{conn.description}</p>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#242424] text-[#6B7280] border border-[#2e2e2e]'
            }`}>
              {isConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {conn.readiness === 'experimental' && conn.note && (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-300/80 leading-relaxed">
              {conn.note}
            </div>
          )}

          {/* Connect / disconnect controls */}
          <div className="mt-5">
            {isConnected ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-[#4B5563]">
                  {connections[conn.service]?.lastSynced
                    ? `Connected ${new Date(connections[conn.service].lastSynced!).toLocaleDateString()}`
                    : 'Connected'}
                </span>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="px-3.5 py-1.5 rounded-lg bg-[#242424] hover:bg-red-500/10 border border-[#3a3a3a] hover:border-red-500/30 text-[12px] text-[#9CA3AF] hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
                </button>
              </div>
            ) : conn.authType === 'oauth' ? (
              <a
                href={conn.oauthPath}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8AB4F8] hover:bg-white text-[#1a1a1a] text-[13px] font-semibold transition-colors"
              >
                Connect with Google
              </a>
            ) : (
              <div className="space-y-2.5">
                {conn.hint && (
                  <p className="text-[11px] text-[#6B7280] leading-relaxed bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2">{conn.hint}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder={conn.placeholder}
                    className="flex-1 bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-2 text-[12px] text-[#E8EDF2] placeholder-[#4B5563] focus:outline-none focus:border-[#8AB4F8] transition-colors"
                  />
                  <button
                    onClick={handleConnectPat}
                    disabled={!tokenInput.trim() || busy}
                    className="px-4 py-2 rounded-lg bg-[#8AB4F8] hover:bg-white disabled:opacity-40 text-[#1a1a1a] text-[12px] font-semibold transition-colors shrink-0"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tools list */}
          <div className="mt-6 pt-5 border-t border-[#242424]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.12em] mb-3">
              <Wrench className="w-3 h-3" /> Tools ({conn.tools.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {conn.tools.map(t => (
                <div key={t} className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
                  <Check className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                  <code className="font-mono text-[11.5px]">{t}</code>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#4B5563] mt-4 leading-relaxed">
              Once connected, these tools are automatically available to the agent in Agent Loop mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
