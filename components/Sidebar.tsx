'use client';

import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';

type Chat = {
  id: number;
  title: string;
  createdAt: string;
};

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
  const [chats, setChats] = useState<Chat[]>([]);

  const loadChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) setChats(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const deleteChat = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation(); // don't trigger onSelectChat
    setChats(prev => prev.filter(c => c.id !== chatId)); // optimistic
    try {
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      onChatDeleted(chatId);
    } catch (err) {
      console.error('Failed to delete chat:', err);
      loadChats(); // revert on error
    }
  };

  useEffect(() => {
    loadChats();
  }, [activeChatId]);

  return (
    <div className="w-64 h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col text-zinc-100 shrink-0 relative z-50">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white py-2 px-4 rounded-lg font-medium shadow-md shadow-indigo-900/20"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2">
          Recent Chats
        </div>
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`group flex items-center gap-1 rounded-md transition-colors ${
              activeChatId === chat.id
                ? 'bg-zinc-800'
                : 'hover:bg-zinc-800/50'
            }`}
          >
            <button
              onClick={() => onSelectChat(chat.id)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm text-left flex-1 min-w-0 ${
                activeChatId === chat.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">{chat.title}</span>
            </button>
            <button
              onClick={e => deleteChat(e, chat.id)}
              title="Delete chat"
              className="shrink-0 mr-1 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {chats.length === 0 && (
          <div className="px-3 py-4 text-sm text-zinc-500 text-center">
            No chats yet.
          </div>
        )}
      </div>
    </div>
  );
}
