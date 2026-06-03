'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MessageBubble } from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/types/widget';
import { Send, AlertCircle, Sparkles, HelpCircle, LayoutGrid, BarChart2, GitMerge, CheckCircle, ChevronDown } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { useChat } from '@ai-sdk/react';
import { BUILTIN_SKILLS, Skill } from '@/lib/skills';
import { DefaultChatTransport } from 'ai';

interface ChatWindowProps {
  chatId: number | null;
  onChatCreated: (id: number) => void;
}

export function ChatWindow({ chatId, onChatCreated }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStandardLoading, setIsStandardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Agent Mode State
  const [isAgentMode, setIsAgentMode] = useState(false);
  
  // Mention State
  const [mentionState, setMentionState] = useState<{ query: string; index: number } | null>(null);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs so the memoized transport can always read the latest values without
  // being recreated (recreation every render is the root cause of both bugs).
  const chatIdRef = useRef(chatId);
  const onChatCreatedRef = useRef(onChatCreated);
  // Incremented whenever chatId changes so stale in-flight responses can be
  // detected and ignored — prevents them from calling onChatCreated.
  const sessionRef = useRef(0);
  // Holds the id of a chat that was just created from the CURRENT conversation.
  // When chatId transitions null → this id, the load-from-DB effect must NOT
  // clear/reload — the messages are already in local state (and streaming).
  // Without this guard the empty state flickers back for a frame on first send.
  const locallyCreatedChatIdRef = useRef<number | null>(null);

  useEffect(() => {
    chatIdRef.current = chatId;
    sessionRef.current += 1;
  }, [chatId]);

  useEffect(() => {
    onChatCreatedRef.current = onChatCreated;
  }, [onChatCreated]);

  // Initialize preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('chat_mode');
      if (mode === 'agent') setIsAgentMode(true);
    }
  }, []);

  // Sync mode choice
  const toggleAgentMode = (val: boolean) => {
    setIsAgentMode(val);
    localStorage.setItem('chat_mode', val ? 'agent' : 'standard');
  };

  // Created once — uses refs so it never needs to be recreated when chatId or
  // callbacks change. Recreating on every render (the previous behaviour) was
  // the direct cause of the "Maximum update depth exceeded" loop and the
  // stale-closure chat-switching bug.
  const agentTransport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat/agent',
    body: () => ({
      chatId: chatIdRef.current,
      mcpServers: typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('mcp_servers') || '[]').filter((s: any) => s.isEnabled)
        : []
    }),
    fetch: async (url, init) => {
      // Capture session BEFORE the await so we can detect navigation-away.
      const sessionAtSend = sessionRef.current;
      const response = await fetch(url, init);
      const returnedChatId = response.headers.get('x-chat-id');
      if (returnedChatId) {
        const idNum = parseInt(returnedChatId);
        // Only act if we are still in the same navigation session and the
        // server assigned a new chatId (i.e. a new chat was created).
        if (!isNaN(idNum) && sessionRef.current === sessionAtSend && idNum !== chatIdRef.current) {
          // Mark as locally created so the load effect skips the clear+reload.
          locallyCreatedChatIdRef.current = idNum;
          onChatCreatedRef.current(idNum);
          try {
            const bodyText = typeof init?.body === 'string' ? init.body : '';
            if (bodyText) {
              const bodyObj = JSON.parse(bodyText);
              const lastMsg = bodyObj.messages?.[bodyObj.messages.length - 1]?.content || '';
              fetch(`/api/chats/${idNum}/title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstMessage: lastMsg })
              }).catch(err => console.error('Error generating title in background', err));
            }
          } catch {
            // Ignore title-generation errors
          }
        }
      }
      return response;
    }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally stable

  // Vercel AI SDK useChat Hook for Agent mode
  const {
    messages: agentMessages,
    setMessages: setAgentMessages,
    sendMessage: sendMessageAgent,
    status: agentStatus,
  } = useChat({
    transport: agentTransport,
    onError: (err) => {
      setError(err.message || 'Agent error occurred');
    }
  });

  // Sync messages from useChat only while the agent is actively generating.
  // Skipping when status === 'ready' prevents the DB-seeded agentMessages from
  // overwriting freshly loaded messages on chat switch (Pattern C/D feedback loop).
  useEffect(() => {
    if (isAgentMode && (agentStatus === 'submitted' || agentStatus === 'streaming') && agentMessages.length > 0) {
      setMessages(
        agentMessages.map((m) => {
          const content = m.parts
            ?.filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('\n') || '';

          const toolInvocations: any[] = m.parts
            ?.filter((part: any) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
            .map((part: any) => {
              let toolName = part.toolName;
              if (!toolName && part.type.startsWith('tool-')) {
                toolName = part.type.substring(5);
              }
              
              let state: 'call' | 'result' = 'call';
              if (part.state === 'output-available' || part.state === 'output-error') {
                state = 'result';
              }
              
              return {
                state,
                toolCallId: part.toolCallId,
                toolName,
                args: part.input,
                result: part.output || part.errorText
              };
            }) || [];

          // Include reasoning parts as a mock think tool call so MessageBubble displays it
          const reasoningParts = m.parts?.filter((part: any) => part.type === 'reasoning');
          if (reasoningParts && reasoningParts.length > 0) {
            const thought = reasoningParts.map((p: any) => p.text).join('\n');
            toolInvocations.unshift({
              state: 'result',
              toolCallId: 'reasoning-' + m.id,
              toolName: 'think',
              args: { thought },
              result: { thought, acknowledged: true }
            });
          }

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content,
            createdAt: (m.metadata as any)?.createdAt || new Date().toISOString(),
            toolInvocations
          };
        })
      );
    }
  }, [agentMessages, isAgentMode, agentStatus]);

  // Load chat messages from DB when chatId changes
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setAgentMessages([]);
      return;
    }
    // Skip when this chatId was just created from the current conversation —
    // the messages are already in state, so clearing + reloading would only
    // flash the empty state and re-fetch what we already have.
    if (chatId === locallyCreatedChatIdRef.current) {
      locallyCreatedChatIdRef.current = null;
      return;
    }
    const controller = new AbortController();
    setMessages([]);
    setAgentMessages([]);
    setIsStandardLoading(true);
    fetch(`/api/chats/${chatId}/messages`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          const dbMessages = data.map((m: any) => ({
            id: m.id.toString(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            widget: m.widget,
            widgetHtml: m.widgetHtml ?? null,
            toolInvocations: m.toolInvocations,
            createdAt: m.createdAt,
          }));
          setMessages(dbMessages);
          
           // Seed the agent messages state so standard & agent modes align
          setAgentMessages(
            dbMessages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: [
                { type: 'text', text: m.content },
                ...(m.toolInvocations || []).map((inv: any) => {
                  return {
                    type: 'dynamic-tool',
                    toolName: inv.toolName,
                    toolCallId: inv.toolCallId,
                    state: inv.state === 'result' ? 'output-available' : 'input-available',
                    input: inv.args,
                    output: inv.result
                  };
                })
              ],
              metadata: { createdAt: m.createdAt },
            })) as any
          );
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load messages:', err);
        }
      })
      .finally(() => setIsStandardLoading(false));
    return () => controller.abort();
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps -- setAgentMessages is a stable dispatch

  const isAgentLoading = agentStatus === 'submitted' || agentStatus === 'streaming';

  // Auto-scroll to bottom
  const isLoading = isStandardLoading || isAgentLoading;
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Parse @mention query
  useEffect(() => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = input.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx === -1) {
      setMentionState(null);
      return;
    }

    const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
    // If there's a space or newline after @, it's not a mention query
    if (/\s/.test(textAfterAt)) {
      setMentionState(null);
      return;
    }

    setMentionState({
      query: textAfterAt.toLowerCase(),
      index: lastAtIdx
    });
    setSelectedMentionIdx(0);
  }, [input]);

  // Get active list of filtered mentions
  const getFilteredMentions = () => {
    if (!mentionState) return [];
    
    const mcpServers = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('mcp_servers') || '[]').filter((s: any) => s.isEnabled)
      : [];

    const builtins = BUILTIN_SKILLS.map(skill => ({
      name: skill.trigger,
      displayName: skill.name,
      description: skill.description,
      isSkill: true,
      template: skill.template
    }));

    const mcps = mcpServers.map((server: any) => ({
      name: server.name,
      displayName: `@${server.name}`,
      description: `Active MCP: ${server.command} ${server.args.join(' ')}`,
      isSkill: false,
      template: `@${server.name} `
    }));

    const allOptions = [...builtins, ...mcps];
    return allOptions.filter(opt => opt.name.toLowerCase().includes(mentionState.query));
  };

  const filteredMentions = getFilteredMentions();

  const handleSelectMention = (item: any) => {
    if (!textareaRef.current || !mentionState) return;
    
    const cursor = textareaRef.current.selectionStart;
    const textBeforeAt = input.slice(0, mentionState.index);
    const textAfterCursor = input.slice(cursor);
    
    const insertedText = item.isSkill ? item.template : `@${item.name} `;
    const newInput = textBeforeAt + insertedText + textAfterCursor;
    
    setInput(newInput);
    setMentionState(null);

    // Focus & move cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionState.index + insertedText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handlePillClick = (template: string) => {
    setInput(prev => {
      const space = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + space + template;
    });
    textareaRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      setMessages(messages.slice(0, index));
      setAgentMessages(agentMessages.slice(0, index));
    }
    
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleRegenerate = async () => {
    const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIndex === -1 || isLoading) return;
    
    const actualIndex = messages.length - 1 - lastUserIndex;
    const lastUserMessage = messages[actualIndex];
    
    const prunedMessages = messages.slice(0, actualIndex + 1);
    setMessages(prunedMessages);
    setError(null);

    if (isAgentMode) {
      // For agent mode regeneration, re-seed the agentMessages without the last user message,
      // and call sendMessageAgent to append/send it.
       const messagesWithoutLastUser = prunedMessages.slice(0, -1);
      setAgentMessages(
        messagesWithoutLastUser.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [
            { type: 'text', text: m.content },
            ...(m.toolInvocations || []).map((inv: any) => {
              return {
                type: 'dynamic-tool',
                toolName: inv.toolName,
                toolCallId: inv.toolCallId,
                state: inv.state === 'result' ? 'output-available' : 'input-available',
                input: inv.args,
                output: inv.result
              };
            })
          ],
          metadata: { createdAt: m.createdAt },
        })) as any
      );
      await sendMessageAgent({
        text: lastUserMessage.content
      });
    } else {
      setIsStandardLoading(true);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: prunedMessages,
            chatId,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${response.status}`);
        }

        const data = await response.json();
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text,
          widget: data.widget,
          createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (err: any) {
        const msg = err?.message || 'Unexpected error';
        setError(msg);
        console.error('Chat error:', msg);
      } finally {
        setIsStandardLoading(false);
      }
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
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const textToSend = input;
    setInput('');

    if (isAgentMode) {
      // Trigger Vercel AI SDK useChat workflow
      await sendMessageAgent({
        text: textToSend,
      });
    } else {
      setIsStandardLoading(true);
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
          // Mark as locally created so the load effect skips the clear+reload.
          locallyCreatedChatIdRef.current = data.chatId;
          onChatCreated(data.chatId);
          if (!chatId) {
            fetch(`/api/chats/${data.chatId}/title`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ firstMessage: textToSend })
            }).catch(err => console.error("Error generating title in background", err));
          }
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text,
          widget: data.widget,
          createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (err: any) {
        const msg = err?.message || 'Unexpected error';
        setError(msg);
        console.error('Chat error:', msg);
      } finally {
        setIsStandardLoading(false);
      }
    }
  };

  const handleChipClick = (text: string) => {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentions[selectedMentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const exampleChips = [
    { label: "Build a kanban board",         icon: LayoutGrid  },
    { label: "Create a sales dashboard",     icon: BarChart2   },
    { label: "Visualize sorting algorithms", icon: GitMerge    },
    { label: "Design a habit tracker",       icon: CheckCircle },
  ];

  const showLoaderAvatar = messages.length === 0 || messages[messages.length - 1].role === 'user';

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Header */}
      <div className="h-14 border-b border-[#2a2a2a] flex items-center justify-between px-6 bg-[#1a1a1a] shrink-0">
        <h1 className="text-sm font-medium text-[#E8EDF2] tracking-wide">IntelliRender Workspace</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8AB4F8] animate-pulse" />
            <span className="text-xs text-[#6B7280] font-medium tracking-widest uppercase hidden sm:block">Online</span>
          </div>
          <UserMenu />
        </div>
      </div>

      {/* Main Chat Area */}
      <ScrollArea className="flex-1 min-h-0 relative w-full bg-[#1a1a1a]">
        <div className="w-full max-w-[48rem] mx-auto px-4 py-6 max-sm:max-w-full max-sm:px-3 max-sm:py-4 flex flex-col min-h-full">
          {messages.length === 0 ? (
            /* Empty state: grounded card, positioned at ~45% from top */
            <div className="flex flex-col items-center select-none" style={{ paddingTop: 'max(48px, calc(45vh - 220px))' }}>
              <div className="ir-fade-slide-up w-full max-w-[480px] bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-8 flex flex-col items-center text-center shadow-lg">
                {/* Logo */}
                <div className="w-12 h-12 bg-[#242424] rounded-xl border border-[rgba(138,180,248,0.18)] flex items-center justify-center text-[#8AB4F8] shadow">
                  <Sparkles className="w-6 h-6" />
                </div>

                <h2 className="text-[1.375rem] font-semibold text-[#E8EDF2] tracking-tight mt-4">
                  What shall we build today?
                </h2>
                <p className="text-[#9CA3AF] text-[0.8125rem] mt-1.5 leading-relaxed max-w-[340px]">
                  Send a prompt to generate interactive widgets, dashboards, or simulations.
                </p>

                {/* 2×2 suggestion grid — staggered fade-in */}
                <div className="grid grid-cols-2 gap-2 mt-5 w-full">
                  {exampleChips.map(({ label, icon: Icon }, i) => (
                    <button
                      key={i}
                      onClick={() => handleChipClick(label)}
                      className={`ir-fade-in ir-stagger-${i + 1} group flex items-center gap-2.5 bg-[#242424] border border-[#333] rounded-xl px-3.5 py-2.5 text-left text-[0.8rem] text-[#9CA3AF] hover:border-[rgba(138,180,248,0.5)] hover:text-[#E8EDF2] hover:bg-[#2a2a2a] active:scale-[0.98] cursor-pointer transition-all duration-150`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 text-[#8AB4F8] opacity-70 group-hover:opacity-100 transition-opacity" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Quick-chips: muted, smaller, icon-prefix style */}
                <div className="flex items-center gap-1.5 mt-4 flex-wrap justify-center">
                  {['Kanban Board', 'Dashboard', 'Gravity Sim', 'Canvas Game'].map((label) => (
                    <button
                      key={label}
                      onClick={() => handleChipClick(`Create a ${label.toLowerCase()}`)}
                      className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2e2e2e] rounded-full px-2.5 py-1 text-[0.7rem] text-[#6B7280] hover:text-[#9CA3AF] hover:border-[#3a3a3a] transition-all duration-150 cursor-pointer"
                    >
                      <span className="text-[#8AB4F8] font-bold leading-none">+</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {messages.map((m, index) => {
                const isFirstInGroup = index === 0 || messages[index - 1].role !== m.role;
                const isLastInGroup = index === messages.length - 1 || messages[index + 1].role !== m.role;
                return (
                  <MessageBubble 
                    key={m.id} 
                    message={m} 
                    onDelete={handleDeleteMessage} 
                    onRegenerate={handleRegenerate}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                  />
                );
              })}
              
              {/* Bot typing loading indicator */}
              {isLoading && (
                <div className="flex w-full mt-[0.375rem] justify-start relative pl-[2.5rem]">
                  {showLoaderAvatar && (
                    <div className="absolute left-0 top-[4px] w-[24px] h-[24px] rounded-full bg-[#8AB4F8] flex items-center justify-center text-[10px] font-bold text-[#1A1C1E] select-none">
                      IR
                    </div>
                  )}
                  <div className="flex flex-col items-start">
                    <div className="flex space-x-1.5 items-center justify-center py-2 px-3 bg-[#2D2F33] rounded-full">
                      <div className="w-1.5 h-1.5 bg-[#8AB4F8] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-[#8AB4F8] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-[#8AB4F8] rounded-full animate-bounce" />
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
        <div className="w-full max-w-[48rem] mx-auto mb-2 px-4 max-sm:max-w-full max-sm:px-3">
          <div className="px-4 py-2.5 rounded-lg bg-red-900/30 border border-red-500/30 flex items-start gap-2 text-sm text-red-400 shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="w-full max-w-[48rem] mx-auto mb-6 px-4 max-sm:max-w-full max-sm:px-3 shrink-0 relative">

        {/* Quick-chips skill bar — muted pill style with right-edge fade mask */}
        <div className="relative mb-2">
          <div className="chips-fade-mask flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {BUILTIN_SKILLS.map((skill) => (
              <button
                key={skill.trigger}
                type="button"
                onClick={() => handlePillClick(skill.template)}
                className="shrink-0 flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#242424] border border-[#2e2e2e] hover:border-[#3a3a3a] rounded-full px-2.5 py-0.5 text-[0.7rem] text-[#6B7280] hover:text-[#9CA3AF] transition-all duration-150 cursor-pointer"
              >
                <span className="text-[#8AB4F8] font-bold leading-none">+</span>
                {skill.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mentions Popover */}
        {mentionState && filteredMentions.length > 0 && (
          <div className="absolute left-4 right-4 bottom-full mb-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl overflow-hidden z-50 max-h-[220px] overflow-y-auto">
            <div className="px-3 py-1.5 border-b border-[#2a2a2a] text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
              Mentions & Skills
            </div>
            <div className="flex flex-col">
              {filteredMentions.map((item, idx) => {
                const isActive = idx === selectedMentionIdx;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectMention(item)}
                    onMouseEnter={() => setSelectedMentionIdx(idx)}
                    className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 border-b border-[#2a2a2a] last:border-0 transition-colors cursor-pointer ${
                      isActive ? 'bg-[rgba(138,180,248,0.08)]' : 'hover:bg-[#242424]'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isActive ? 'text-[#8AB4F8]' : 'text-[#E8EDF2]'}`}>
                      {item.displayName}
                    </span>
                    <span className="text-[10px] text-[#6B7280]">{item.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-3 px-4 focus-within:border-[rgba(138,180,248,0.35)] transition-all duration-150 shadow-lg"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a simulation, a dashboard, or use @ to trigger tools..."
            className="w-full bg-transparent border-0 focus:outline-none text-[#E8EDF2] placeholder:text-[#6B7280] text-[0.9375rem] resize-none min-h-[24px] max-h-[120px] leading-relaxed py-1"
            disabled={isLoading}
          />

          {/* Toolbar: left group | divider | right group */}
          <div className="mt-2 flex items-center justify-between border-t border-[#2a2a2a] pt-2 gap-2">

            {/* ── LEFT: mode toggles + tools ── */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Standard / Agent Loop toggle */}
              <div className="flex items-center bg-[#161616] border border-[#2a2a2a] rounded-lg p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleAgentMode(false)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded transition-all duration-150 cursor-pointer ${
                    !isAgentMode
                      ? 'bg-[#2a2a2a] text-[#8AB4F8] border border-[rgba(138,180,248,0.2)] shadow'
                      : 'text-[#6B7280] hover:text-[#C8CDD3]'
                  }`}
                >
                  Standard
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleAgentMode(true)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded transition-all duration-150 cursor-pointer ${
                      isAgentMode
                        ? 'bg-[#2a2a2a] text-[#8AB4F8] border border-[rgba(138,180,248,0.2)] shadow'
                        : 'text-[#6B7280] hover:text-[#C8CDD3]'
                    }`}
                  >
                    Agent Loop
                  </button>
                  {/* Agent Loop tooltip */}
                  <div className="relative group/tt1 shrink-0">
                    <HelpCircle className="w-3 h-3 text-[#4B5563] hover:text-[#9CA3AF] cursor-help transition-colors" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-[10px] text-[#C8CDD3] leading-relaxed opacity-0 group-hover/tt1:opacity-100 transition-opacity duration-150 z-50 text-center shadow-xl">
                      Runs multiple reasoning steps with tool calls until the task is complete.
                    </div>
                  </div>
                </div>
              </div>

              {/* Tools Enabled badge + tooltip */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="bg-[rgba(138,180,248,0.07)] text-[#8AB4F8]/80 border border-[rgba(138,180,248,0.15)] rounded px-2 py-0.5 text-[0.7rem] font-medium select-none">
                  Tools Enabled
                </span>
                <div className="relative group/tt2 shrink-0">
                  <HelpCircle className="w-3 h-3 text-[#4B5563] hover:text-[#9CA3AF] cursor-help transition-colors" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-[10px] text-[#C8CDD3] leading-relaxed opacity-0 group-hover/tt2:opacity-100 transition-opacity duration-150 z-50 text-center shadow-xl">
                    MCP tools and built-in skills are available to the model.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Vertical divider ── */}
            <div className="w-px h-4 bg-[#2e2e2e] shrink-0" />

            {/* ── RIGHT: model selector + send ── */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="flex items-center gap-1 text-[#6B7280] hover:text-[#C8CDD3] text-[0.7rem] font-medium transition-colors duration-150 cursor-pointer select-none"
              >
                DeepSeek-V4-Flash
                <ChevronDown className="w-3 h-3" />
              </button>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="ir-send-pulse w-[34px] h-[34px] bg-[#8AB4F8] hover:bg-white text-[#1a1a1a] flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-35 disabled:hover:bg-[#8AB4F8] cursor-pointer shrink-0"
              >
                <Send className="w-[15px] h-[15px]" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
