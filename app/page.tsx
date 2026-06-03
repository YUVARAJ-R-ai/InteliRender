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
