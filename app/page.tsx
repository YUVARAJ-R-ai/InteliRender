'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function Home() {
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const handleChatDeleted = (deletedId: number) => {
    if (activeChatId === deletedId) setActiveChatId(null);
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden font-sans">
      <Sidebar
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={() => setActiveChatId(null)}
        onChatDeleted={handleChatDeleted}
      />
      <main className="flex-1 h-full relative">
        {/* Subtle background gradient for a more premium look */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-zinc-950 to-zinc-950 z-0 pointer-events-none" />
        
        <div className="relative z-10 h-full">
          <ChatWindow chatId={activeChatId} onChatCreated={setActiveChatId} />
        </div>
      </main>
    </div>
  );
}
