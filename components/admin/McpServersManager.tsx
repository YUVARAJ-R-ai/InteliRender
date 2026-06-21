'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash, Server, Plus } from 'lucide-react';

interface CustomMcpServer {
  id: number;
  name: string;
  command: string;
  args: string[];
  isEnabled: boolean;
}

export function McpServersManager() {
  const [servers, setServers] = useState<CustomMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/mcp-servers');
    if (res.ok) setServers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;
    setAdding(true);
    const res = await fetch('/api/admin/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, command, args }),
    });
    if (res.ok) {
      setName(''); setCommand(''); setArgs('');
      await load();
    }
    setAdding(false);
  }

  async function handleToggle(server: CustomMcpServer) {
    setBusyId(server.id);
    await fetch(`/api/admin/mcp-servers/${server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !server.isEnabled }),
    });
    await load();
    setBusyId(null);
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    await fetch(`/api/admin/mcp-servers/${id}`, { method: 'DELETE' });
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-[#6B7280] leading-relaxed">
        Configure Model Context Protocol (MCP) servers over Stdio. These run as local child
        processes during Agent Loop sessions and expose custom tools to the model. Stored in the
        database — shared across all your devices.
      </p>

      {/* Configured servers */}
      <div className="space-y-2.5">
        <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.12em]">
          Configured Servers
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280] py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-8 px-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#141414]">
            <Server className="w-5 h-5 text-[#3a3a3a]" />
            <p className="text-[12px] text-[#6B7280]">No custom servers yet. Add one below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map(server => (
              <div
                key={server.id}
                className="flex items-center justify-between gap-4 bg-[#161616] border border-[#242424] rounded-xl p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
                    <span className="text-[13px] font-semibold text-[#E8EDF2] truncate">{server.name}</span>
                  </div>
                  <div className="text-[11px] text-[#6B7280] font-mono truncate mt-1 pl-[22px]">
                    {server.command} {server.args.join(' ')}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleToggle(server)}
                    disabled={busyId === server.id}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50 ${
                      server.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15'
                        : 'bg-[#242424] text-[#6B7280] border border-[#3a3a3a] hover:text-[#9CA3AF]'
                    }`}
                  >
                    {busyId === server.id ? <Loader2 className="w-3 h-3 animate-spin" /> : server.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    disabled={busyId === server.id}
                    className="text-[#6B7280] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    title="Delete server"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add server */}
      <form onSubmit={handleAdd} className="bg-[#161616] border border-[#242424] rounded-xl p-4 space-y-3">
        <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.12em]">
          Add Local Server
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#9CA3AF] font-medium">Server Name</label>
            <input
              type="text" required placeholder="e.g. Memory Server"
              value={name} onChange={e => setName(e.target.value)}
              className="bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[12px] text-[#E8EDF2] focus:outline-none focus:border-[#8AB4F8] placeholder:text-[#4B5563] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#9CA3AF] font-medium">Executable</label>
            <input
              type="text" required placeholder="e.g. npx, node"
              value={command} onChange={e => setCommand(e.target.value)}
              className="bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[12px] text-[#E8EDF2] focus:outline-none focus:border-[#8AB4F8] placeholder:text-[#4B5563] transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#9CA3AF] font-medium">Arguments (space separated)</label>
          <input
            type="text" placeholder="e.g. -y @modelcontextprotocol/server-memory"
            value={args} onChange={e => setArgs(e.target.value)}
            className="bg-[#242424] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[12px] text-[#E8EDF2] focus:outline-none focus:border-[#8AB4F8] placeholder:text-[#4B5563] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !command.trim() || adding}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#8AB4F8] hover:bg-white disabled:opacity-40 text-[#1a1a1a] text-[12px] font-semibold py-2 rounded-lg transition-colors cursor-pointer"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add MCP Server
        </button>
      </form>
    </div>
  );
}
