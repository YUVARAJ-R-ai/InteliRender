'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';

const ACTIVE_CHAT_KEY = 'active_chat_id';

export default function Home() {
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_CHAT_KEY);
    if (stored) {
      const id = parseInt(stored);
      if (!isNaN(id)) setActiveChatId(id);
    }
  }, []);

  useEffect(() => {
    if (activeChatId === null) localStorage.removeItem(ACTIVE_CHAT_KEY);
    else localStorage.setItem(ACTIVE_CHAT_KEY, String(activeChatId));
  }, [activeChatId]);

  const handleChatDeleted = (deletedId: number) => {
    if (activeChatId === deletedId) setActiveChatId(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#1a1a1a] overflow-hidden font-sans max-w-[2400px] mx-auto">
      {/* Mobile overlay — tapping it closes the sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static flex child on md+ */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out
        md:static md:translate-x-0 md:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          activeChatId={activeChatId}
          onSelectChat={(id) => { setActiveChatId(id); setSidebarOpen(false); }}
          onNewChat={() => { setActiveChatId(null); setSidebarOpen(false); }}
          onChatDeleted={handleChatDeleted}
        />
      </div>

      <main className="flex-1 h-full min-w-0">
        <ChatWindow
          chatId={activeChatId}
          onChatCreated={setActiveChatId}
          onMenuClick={() => setSidebarOpen(true)}
        />
      </main>
    </div>
  );
}
