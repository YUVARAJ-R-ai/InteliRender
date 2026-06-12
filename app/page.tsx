'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';

const ACTIVE_CHAT_KEY = 'active_chat_id';

export default function Home() {
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  // Restore the last-open chat on reload (activeChatId is otherwise lost on refresh,
  // dropping the user into a brand-new chat).
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_CHAT_KEY);
    if (stored) {
      const id = parseInt(stored);
      if (!isNaN(id)) setActiveChatId(id);
    }
  }, []);

  // Persist the active chat so it survives reloads.
  useEffect(() => {
    if (activeChatId === null) localStorage.removeItem(ACTIVE_CHAT_KEY);
    else localStorage.setItem(ACTIVE_CHAT_KEY, String(activeChatId));
  }, [activeChatId]);

  const handleChatDeleted = (deletedId: number) => {
    if (activeChatId === deletedId) setActiveChatId(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#1a1a1a] overflow-hidden font-sans">
      <Sidebar
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={() => setActiveChatId(null)}
        onChatDeleted={handleChatDeleted}
      />
      <main className="flex-1 h-full">
        <ChatWindow chatId={activeChatId} onChatCreated={setActiveChatId} />
      </main>
    </div>
  );
}
