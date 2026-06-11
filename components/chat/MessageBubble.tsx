import { useState, useRef, useMemo } from 'react';
import { ChatMessage } from '@/types/widget';
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer';
import { Trash2, Copy, Check, ThumbsUp, ThumbsDown, RotateCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Renders a persisted HTML widget (loaded from `widget_html` after a reload) inside
 * a sandboxed iframe. The iframe height is set to the content's scrollHeight on load.
 */
function PersistedHtmlWidget({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      title="Saved widget"
      style={{ width: '100%', border: 'none', borderRadius: '8px', minHeight: 120 }}
      onLoad={() => {
        try {
          const doc = ref.current?.contentDocument;
          if (doc?.body) ref.current!.style.height = `${doc.body.scrollHeight}px`;
        } catch {
          /* cross-origin guard — ignore */
        }
      }}
    />
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onDelete?: (id: string) => void;
  onRegenerate?: () => void;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export function MessageBubble({
  message,
  onDelete,
  onRegenerate,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  // Stable reference — prevents widget components with params-dependent hooks
  // (e.g. recharts internals) from re-triggering on every parent re-render,
  // which caused "Maximum update depth exceeded".
  const widgetToRender = useMemo(() => {
    if (message.widgetHtml) return null; // handled separately by PersistedHtmlWidget
    const widgetCall = message.toolInvocations?.find(
      (ti: any) => ti.toolName === 'render_widget' && ti.state === 'result'
    );
    const result = message.widget || (widgetCall?.result ? { type: widgetCall.result.type, params: widgetCall.result } : null);
    if (!result || result.type === 'text') return null;
    return result;
  }, [message.toolInvocations, message.widget, message.widgetHtml]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = message.createdAt
    ? (new Date(message.createdAt).getTime() > Date.now() - 1000 * 60 * 60 * 24 
      ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
      : format(new Date(message.createdAt), 'MMM d, h:mm a'))
    : 'just now';

  // Determine border radius class for user bubbles based on consecutive messages
  const userBorderRadiusClass = isFirstInGroup && isLastInGroup
    ? 'rounded-[18px_18px_4px_18px]'
    : isFirstInGroup
    ? 'rounded-[18px_18px_4px_18px]'
    : isLastInGroup
    ? 'rounded-[18px_4px_18px_18px]'
    : 'rounded-[18px_4px_4px_18px]';

  return (
    <div 
      className={`flex w-full group relative transition-all duration-150 ${
        isUser ? 'justify-end' : 'justify-start'
      } ${isFirstInGroup ? 'mt-[1.5rem]' : 'mt-[0.375rem]'}`}
    >
      {/* Bot Avatar (only shown on the first message of a bot group) */}
      {!isUser && isFirstInGroup && (
        <div className="absolute left-0 top-[4px] w-[24px] h-[24px] rounded-full bg-[#8AB4F8] flex items-center justify-center text-[10px] font-bold text-[#1A1C1E] select-none">
          IR
        </div>
      )}

      {/* Message action container */}
      <div 
        className={`absolute top-[-12px] bg-[#1F2226] border border-white/8 rounded-lg p-[4px_6px] flex gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 shadow-lg ${
          isUser ? 'right-0' : 'left-[2.5rem]'
        }`}
      >
        {isUser ? (
          <>
            <button
              onClick={handleCopy}
              className="w-[24px] h-[24px] rounded flex items-center justify-center text-[#A5A299] hover:bg-[#8AB4F8]/10 hover:text-[#8AB4F8] transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onDelete && (
              <button 
                onClick={() => onDelete(message.id)}
                className="w-[24px] h-[24px] rounded flex items-center justify-center text-[#A5A299] hover:bg-red-400/10 hover:text-red-400 transition-colors"
                title="Unsend"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handleCopy}
              className="w-[24px] h-[24px] rounded flex items-center justify-center text-[#A5A299] hover:bg-[#8AB4F8]/10 hover:text-[#8AB4F8] transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button 
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')} 
              className={`w-[24px] h-[24px] rounded flex items-center justify-center hover:bg-[#8AB4F8]/10 hover:text-[#8AB4F8] transition-colors ${
                feedback === 'up' ? 'text-[#8AB4F8]' : 'text-[#A5A299]'
              }`}
              title="Helpful"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')} 
              className={`w-[24px] h-[24px] rounded flex items-center justify-center hover:bg-[#8AB4F8]/10 hover:text-[#8AB4F8] transition-colors ${
                feedback === 'down' ? 'text-[#8AB4F8]' : 'text-[#A5A299]'
              }`}
              title="Not helpful"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            {onRegenerate && (
              <button 
                onClick={onRegenerate}
                className="w-[24px] h-[24px] rounded flex items-center justify-center text-[#A5A299] hover:bg-[#8AB4F8]/10 hover:text-[#8AB4F8] transition-colors"
                title="Regenerate"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Bubble Container */}
      <div 
        className={`flex flex-col ${
          isUser ? 'max-w-[70%] items-end' : 'w-full items-start'
        }`}
      >
        <div 
          className={`text-[#E8EDF2] text-[0.9375rem] leading-[1.6] transition-all duration-150 ${
            isUser 
              ? `bg-[#2D2F33] p-[0.625rem_1rem] ${userBorderRadiusClass} border-0 shadow-none` 
              : 'bg-transparent border-0 shadow-none pl-[2.5rem] w-full'
          }`}
        >
          <div className="prose prose-invert max-w-none w-full">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children, ...props }: any) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8AB4F8] underline underline-offset-2 hover:text-white transition-colors"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    
                    if (!inline && match) {
                      return (
                        <div className="rounded-lg overflow-hidden my-4 border border-white/5 w-full max-w-full relative group/code bg-[#141618]">
                          <div className="flex items-center justify-between px-4 py-2 bg-[#1A1C1E] border-b border-white/5 text-xs text-[#A5A299] font-mono">
                            <span>{match[1]}</span>
                            <button
                                onClick={() => {
                                  navigator.clipboard.writeText(codeString);
                                }}
                                className="hover:text-[#E8EDF2] opacity-0 group-hover/code:opacity-100 transition-opacity"
                                title="Copy code"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <SyntaxHighlighter
                              {...props}
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        );
                      }
                      return (
                        <code 
                          {...props} 
                          className={`${className} bg-[#141618] text-[#8AB4F8] rounded px-1 py-[1px] text-[0.875em]`}
                        >
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : null}
            </div>
  
            {/* Tool Invocations Display */}
            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="flex flex-col gap-2 my-4 w-full">
                {message.toolInvocations.map((ti: any) => {
                  const isCall = ti.state === 'call';
                  const isThink = ti.toolName === 'think';
                  const isSearch = ti.toolName === 'web_search';
                  const isWidget = ti.toolName === 'render_widget';
                  const isCustomMcp = !isThink && !isSearch && !isWidget;
  
                  if (isThink) {
                    return (
                      <div key={ti.toolCallId} className="bg-[#1F2226] border border-white/5 rounded-xl p-3 flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8AB4F8]">
                          <div className={`w-1.5 h-1.5 rounded-full ${isCall ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                          <span>{isCall ? 'Thinking...' : 'Thought process complete'}</span>
                        </div>
                        {!isCall && ti.result?.thought && (
                          <p className="text-xs text-[#A5A299] italic leading-relaxed">
                            "{ti.result.thought}"
                          </p>
                        )}
                      </div>
                    );
                  }
  
                  if (isSearch) {
                    return (
                      <div key={ti.toolCallId} className="bg-[#1F2226] border border-white/5 rounded-xl p-3 flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8AB4F8]">
                          <div className={`w-1.5 h-1.5 rounded-full ${isCall ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
                          <span>
                            {isCall 
                              ? `Searching the web for "${ti.args.query || ''}"...` 
                              : `Web search complete for "${ti.args.query || ''}"`}
                          </span>
                        </div>
                        {!isCall && Array.isArray(ti.result) && (
                          <div className="flex flex-col gap-1.5 pl-2 border-l border-white/10 mt-1">
                            {ti.result.map((res: any, idx: number) => (
                              <div key={idx} className="text-xs text-[#A5A299]">
                                <span className="font-semibold text-[#E8EDF2] block">{res.title}</span>
                                <span className="line-clamp-2">{res.snippet}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
  
                  if (isCustomMcp) {
                    const displayName = ti.toolName.split('_').pop() || ti.toolName;
                    const prefix = ti.toolName.split('_').slice(0, -1).join(' ') || 'MCP';
                    return (
                      <div key={ti.toolCallId} className="bg-[#1F2226] border border-white/5 rounded-xl p-3 flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8AB4F8]">
                          <div className={`w-1.5 h-1.5 rounded-full ${isCall ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'}`} />
                          <span className="capitalize">
                            {isCall 
                              ? `Calling ${prefix}: ${displayName}...` 
                              : `Called ${prefix}: ${displayName}`}
                          </span>
                        </div>
                        {!isCall && ti.result && (
                          <pre className="text-[10px] text-[#A5A299] bg-[#141618] p-2 rounded overflow-x-auto max-h-[150px] font-mono">
                            {JSON.stringify(ti.result, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  }
  
                  return null;
                })}
              </div>
            )}
            
            {/* Widget rendering */}
            {message.widgetHtml ? (
              <div className={`w-full overflow-hidden ${message.content ? 'mt-6 pt-6 border-t border-white/5' : ''}`}>
                <PersistedHtmlWidget html={message.widgetHtml} />
              </div>
            ) : widgetToRender ? (
              <div className={`w-full overflow-hidden ${message.content ? 'mt-6 pt-6 border-t border-white/5' : ''}`}>
                <WidgetRenderer widget={widgetToRender as any} />
              </div>
            ) : null}
        </div>

        {/* Footer (Timestamp) — only shown for the last message in a consecutive group */}
        {isLastInGroup && (
          <div 
            className={`w-full mt-[4px] text-[11px] text-[#A5A299] ${
              isUser ? 'text-right' : 'text-left pl-[2.5rem]'
            }`}
          >
            {isUser ? `you · ${formattedTime}` : `IntelliRender · ${formattedTime}`}
          </div>
        )}
      </div>
    </div>
  );
}
