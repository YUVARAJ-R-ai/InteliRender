'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  Plus, MessageSquare, Trash2, GitBranch, Archive,
  ChevronUp, LogOut, Pencil, Shield, Plug,
} from 'lucide-react';

type Chat = { id: number; title: string; createdAt: string };

export function Sidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  onChatDeleted,
}: {
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewChat: () => void;
  onChatDeleted: (id: number) => void;
}) {
  const { data: session } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Rename state
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ chatId: number; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) setChats(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const deleteChat = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== chatId));
    try {
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      onChatDeleted(chatId);
    } catch {
      loadChats();
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Close context menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setContextMenu(null); setRenamingChatId(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingChatId !== null) {
      setTimeout(() => renameInputRef.current?.select(), 30);
    }
  }, [renamingChatId]);

  const startRename = (chat: Chat) => {
    setContextMenu(null);
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const commitRename = async (chatId: number) => {
    const trimmed = renameValue.trim().slice(0, 60);
    if (trimmed) {
      await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: trimmed } : c));
    }
    setRenamingChatId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, chat: Chat) => {
    e.preventDefault();
    setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY });
  };

  // Refresh the chat list on mount (prev is null) and when a new chat is
  // created (activeChatId transitions null → real id). Skip re-fetching on
  // ordinary chat switches (5 → 7) since the list hasn't changed.
  const prevActiveChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevActiveChatIdRef.current;
    prevActiveChatIdRef.current = activeChatId;
    if (prev === null) {
      loadChats();
    }
  }, [activeChatId]);

  const userName = session?.user?.name ?? session?.user?.email ?? 'User';
  const userInitial = userName[0].toUpperCase();

  return (
    <div className="w-[240px] h-screen bg-[#111214] border-r border-[#2a2a2a] flex flex-col text-[#E8EDF2] shrink-0 relative z-40 select-none">

      {/* New Chat */}
      <div className="p-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[rgba(138,180,248,0.07)] border border-[rgba(138,180,248,0.22)] hover:border-[rgba(138,180,248,0.45)] transition-all duration-150 rounded-lg text-sm font-medium py-2 px-3 text-[#E8EDF2]"
        >
          <Plus className="w-[14px] h-[14px] text-[#8AB4F8]" />
          New Chat
        </button>
      </div>

      {/* Scrollable nav + chats */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">

        {/* Recent Chats */}
        <div>
          <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.1em] px-2 py-1.5">
            Recent Chats
          </div>
          <div className="space-y-0.5 mt-1">
            {chats.map(chat => {
              const isActive = activeChatId === chat.id;
              const isRenaming = renamingChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  onContextMenu={e => handleContextMenu(e, chat)}
                  className={`group flex items-center gap-1 rounded-md transition-all duration-150 ${
                    isActive
                      ? 'bg-[rgba(138,180,248,0.09)] border-l-2 border-[#8AB4F8] -ml-[12px] pl-[10px] rounded-l-none'
                      : 'hover:bg-[#1e2023]'
                  }`}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      maxLength={60}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(chat.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(chat.id); }
                        if (e.key === 'Escape') { e.preventDefault(); setRenamingChatId(null); }
                      }}
                      className="flex-1 mx-2 my-1 px-2 py-0.5 bg-[#2a2a2a] border border-[#8AB4F8]/40 rounded text-[13px] text-[#E8EDF2] focus:outline-none"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className={`flex items-center gap-2 px-2 py-1.75 text-[13px] text-left flex-1 min-w-0 transition-colors duration-150 ${
                          isActive ? 'text-[#E8EDF2]' : 'text-[#9CA3AF] hover:text-[#E8EDF2]'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{chat.title}</span>
                      </button>
                      <button
                        onClick={e => deleteChat(e, chat.id)}
                        title="Delete chat"
                        className="shrink-0 mr-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[#6B7280] hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {chats.length === 0 && (
              <div className="px-2 py-3 text-xs text-[#6B7280] italic">No chats yet</div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div>
          <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.1em] px-2 py-1.5">
            Tools
          </div>
          <div className="space-y-0.5 mt-1">
            <Link
              href="/connectors"
              className="w-full flex items-center gap-2.5 px-2 py-1.75 rounded-md text-[13px] text-left text-[#9CA3AF] hover:bg-[#1e2023] hover:text-[#E8EDF2] transition-all duration-150"
            >
              <Plug className="w-[15px] h-[15px] shrink-0 text-[#8AB4F8]" />
              <span>Connectors</span>
            </Link>
            <Link
              href="/admin"
              className="w-full flex items-center gap-2.5 px-2 py-1.75 rounded-md text-[13px] text-left text-[#9CA3AF] hover:bg-[#1e2023] hover:text-[#E8EDF2] transition-all duration-150"
            >
              <Shield className="w-[15px] h-[15px] shrink-0 text-[#8AB4F8]" />
              <span>Admin Panel</span>
            </Link>
          </div>
        </div>

        {/* System */}
        <div>
          <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.1em] px-2 py-1.5">
            System
          </div>
          <div className="space-y-0.5 mt-1">
            <button className="w-full flex items-center gap-2.5 px-2 py-1.75 rounded-md text-[13px] text-left text-[#9CA3AF] hover:bg-[#1e2023] hover:text-[#E8EDF2] transition-all duration-150">
              <GitBranch className="w-[15px] h-[15px] shrink-0 text-[#8AB4F8]" />
              <span>Workflow</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-2 py-1.75 rounded-md text-[13px] text-left text-[#9CA3AF] hover:bg-[#1e2023] hover:text-[#E8EDF2] transition-all duration-150">
              <Archive className="w-[15px] h-[15px] shrink-0 text-[#8AB4F8]" />
              <span>Archive</span>
            </button>
          </div>
        </div>
      </div>

      {/* User section with popover hint */}
      <div className="border-t border-[#2a2a2a] shrink-0 relative">
        {/* Mini popover */}
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl overflow-hidden z-50">
            <button
              onClick={() => signOut({ redirectTo: '/auth/login' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#9CA3AF] hover:bg-[#242424] hover:text-red-400 transition-colors duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}

        <button
          onClick={() => setShowUserMenu(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition-colors duration-150 group"
        >
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={userName}
              className="w-[28px] h-[28px] rounded-full shrink-0"
            />
          ) : (
            <div className="w-[28px] h-[28px] rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center text-[11px] font-semibold text-[#8AB4F8] shrink-0">
              {userInitial}
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13px] font-medium text-[#C8CDD3] truncate group-hover:text-[#E8EDF2] transition-colors">
              {userName}
            </div>
          </div>
          <ChevronUp
            className={`w-3.5 h-3.5 text-[#6B7280] shrink-0 transition-transform duration-150 ${showUserMenu ? '' : 'rotate-180'}`}
          />
        </button>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const chat = chats.find(c => c.id === contextMenu.chatId);
        if (!chat) return null;
        return (
          <div
            ref={contextMenuRef}
            style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 200 }}
            className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl overflow-hidden py-1 min-w-[140px] ir-fade-scale-in"
          >
            <button
              onClick={() => startRename(chat)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#9CA3AF] hover:bg-[#242424] hover:text-[#E8EDF2] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              onClick={e => { setContextMenu(null); deleteChat(e as any, chat.id); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#9CA3AF] hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
}
