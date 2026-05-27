'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/types/widget';
import { Send, Loader2, AlertCircle } from 'lucide-react';

interface ChatWindowProps {
  chatId: number | null;
  onChatCreated: (id: number) => void;
}

export function ChatWindow({ chatId, onChatCreated }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setMessages([]);
    setIsLoading(true);
    fetch(`/api/chats/${chatId}/messages`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data.map((m: any) => ({
            id: m.id.toString(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            widget: m.widget,
          })));
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load messages:', err);
        }
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistically update UI
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      setMessages(messages.slice(0, index));
    }
    
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setError(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          chatId,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error ${response.status}`);
      }

      const data = await response.json();
      
      if (data.chatId && data.chatId !== chatId) {
        onChatCreated(data.chatId);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
        widget: data.widget,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const msg = err?.message || 'Unexpected error';
      setError(msg);
      console.error('Chat error:', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 backdrop-blur-sm bg-zinc-950/50 shrink-0">
        <h1 className="text-sm font-medium text-zinc-200 tracking-wide">IntelliRender Workspace</h1>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-500 font-medium tracking-widest uppercase">System Online</span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 p-6 relative w-full">
        <div className="w-full pb-8 max-w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
              <div className="w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10 flex items-center justify-center shadow-2xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 animate-pulse shadow-inner" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">What shall we build today?</h2>
              <p className="text-zinc-400 max-w-md text-lg">Send a prompt to generate interactive widgets, dashboards, or simulations.</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onDelete={handleDeleteMessage} />
              ))}
              
              {isLoading && (
                <div className="flex w-full mb-8 justify-start">
                  <div className="flex flex-col max-w-[85%] items-start">
                    <div className="flex items-center space-x-2 mb-1.5 px-1">
                      <span className="text-xs font-semibold tracking-wide uppercase text-zinc-400">IntelliRender AI</span>
                    </div>
                    <div className="bg-zinc-900/60 border border-white/5 p-5 rounded-2xl flex items-center gap-3 shadow-lg">
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                      <span className="text-sm text-zinc-400 font-medium tracking-wide">Processing query...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="mx-6 mb-2 px-4 py-2.5 rounded-lg bg-red-900/30 border border-red-500/30 flex items-start gap-2 text-sm text-red-400 shrink-0">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}
      <div className="p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 shrink-0 w-full">
        <div className="w-full mx-auto relative group px-2 lg:px-8">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl opacity-20 group-focus-within:opacity-40 transition duration-500 blur"></div>
          <form onSubmit={handleSubmit} className="relative flex space-x-3 items-end">
            <div className="flex-1 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden focus-within:border-emerald-500/50 transition-colors shadow-inner">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for a simulation, a dashboard, or a plan..."
                className="w-full bg-transparent border-0 focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-500 py-6 px-5 text-base"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="h-[52px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 font-medium transition-all"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
