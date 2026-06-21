'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Settings, LogOut, User, Sparkles, ChevronRight,
  HelpCircle, Palette, Crown,
} from 'lucide-react';
import type { Section } from './SettingsModal';
import { useSettingsUI } from '@/lib/settings-ui-context';

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const { openSettings: openSettingsOverlay } = useSettingsUI();
  const containerRef = useRef<HTMLDivElement>(null);

  const openSettings = (section: Section) => {
    openSettingsOverlay(section);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!session?.user) return null;

  const name = session.user.name ?? session.user.email ?? 'User';
  const email = session.user.email ?? '';
  const initial = name[0].toUpperCase();

  function MenuItem({
    icon: Icon,
    label,
    onClick,
    hasArrow = false,
    danger = false,
  }: {
    icon: React.ComponentType<any>;
    label: string;
    onClick?: () => void;
    hasArrow?: boolean;
    danger?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 text-left ${
          danger
            ? 'text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/8'
            : 'text-[#9CA3AF] hover:text-[#E8EDF2] hover:bg-[#2a2a2a]'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {hasArrow && <ChevronRight className="w-3.5 h-3.5 text-[#4B5563]" />}
      </button>
    );
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Avatar button */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all duration-150 ring-2 ring-transparent hover:ring-[rgba(138,180,248,0.4)] focus:outline-none focus-visible:ring-[rgba(138,180,248,0.5)] ${
            open ? 'ring-[rgba(138,180,248,0.4)]' : ''
          } overflow-hidden`}
          aria-label="Open user menu"
        >
          {session.user.image ? (
            <img src={session.user.image} alt={name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#8AB4F8]/20 border border-[rgba(138,180,248,0.3)] flex items-center justify-center text-[#8AB4F8] font-semibold text-[12px]">
              {initial}
            </div>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="ir-fade-scale-in absolute right-0 top-full mt-2 w-[240px] bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl z-50 overflow-hidden"
            style={{ transformOrigin: 'top right' }}
          >
            {/* User info */}
            <div className="px-3 pt-3 pb-2.5">
              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <img src={session.user.image} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#8AB4F8]/20 border border-[rgba(138,180,248,0.3)] flex items-center justify-center text-[#8AB4F8] font-semibold text-[14px] shrink-0">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#E8EDF2] truncate">{name}</div>
                  <div className="text-[11px] text-[#6B7280] truncate">{email}</div>
                </div>
                <span className="text-[10px] font-semibold bg-[#8AB4F8]/10 text-[#8AB4F8] border border-[rgba(138,180,248,0.2)] rounded-full px-2 py-0.5 shrink-0">
                  Free
                </span>
              </div>
            </div>

            <div className="h-px bg-[#2a2a2a] mx-3" />

            {/* Menu items */}
            <div className="p-1.5 space-y-0.5">
              <MenuItem icon={Crown} label="Upgrade plan" hasArrow />
              <MenuItem
                icon={Palette}
                label="Personalization"
                hasArrow
                onClick={() => openSettings('Appearance')}
              />
              <MenuItem icon={User} label="Profile" hasArrow />
              <MenuItem
                icon={Settings}
                label="Settings"
                onClick={() => openSettings('Workspace')}
              />
            </div>

            <div className="h-px bg-[#2a2a2a] mx-3" />

            <div className="p-1.5 space-y-0.5">
              <MenuItem icon={HelpCircle} label="Help" hasArrow />
              <MenuItem
                icon={LogOut}
                label="Log out"
                danger
                onClick={() => signOut({ redirectTo: '/auth/login' })}
              />
            </div>

            <div className="h-2" />
          </div>
        )}
      </div>
    </>
  );
}
