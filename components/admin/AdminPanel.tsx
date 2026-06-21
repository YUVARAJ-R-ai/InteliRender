'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Server, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { ApiKeysSection, GoogleOAuthCard } from '@/components/SettingsModal';
import { McpServersManager } from '@/components/admin/McpServersManager';

type Tab = 'mcp' | 'config';

const TABS: { id: Tab; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { id: 'mcp', label: 'MCP Servers', icon: Server, description: 'Manage custom stdio MCP server processes (shared across all users)' },
  { id: 'config', label: 'App Config', icon: SlidersHorizontal, description: 'Global credentials and API keys (Google OAuth, provider keys)' },
];

export function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>('mcp');
  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen w-full bg-[#1a1a1a] text-[#E8EDF2] flex justify-center">
      <div className="w-full max-w-[860px] px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#9CA3AF] transition-colors mb-5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to chat
          </Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[#E8EDF2]">Admin Panel</h1>
              <p className="text-[13px] text-[#6B7280] mt-1">
                App-level MCP servers and global credentials. Per-user integrations live in Connectors.
              </p>
            </div>
            <span className="text-[11px] text-[#4B5563] bg-[#161616] border border-[#242424] rounded-full px-3 py-1">
              {adminEmail}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#141414] border border-[#242424] rounded-xl mb-7">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium py-2.5 px-3 rounded-lg transition-all duration-150 ${
                tab === id
                  ? 'bg-[#242424] text-[#E8EDF2] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#1c1c1c]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Section heading */}
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-[#E8EDF2]">{active.label}</h2>
          <p className="text-[12px] text-[#6B7280] mt-0.5">{active.description}</p>
        </div>

        {/* Content */}
        <div className="ir-fade-in">
          {tab === 'mcp' && <McpServersManager />}
          {tab === 'config' && (
            <div className="space-y-6">
              <GoogleOAuthCard />
              <ApiKeysSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
