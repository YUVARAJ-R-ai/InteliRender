import { ChatMessage } from '@/types/widget';
import { Card } from '@/components/ui/card';
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer';
import { Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  message: ChatMessage;
  onDelete?: (id: string) => void;
}

export function MessageBubble({ message, onDelete }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-8 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col ${isUser ? 'max-w-[70%] items-end' : 'w-full max-w-[95%] items-start'}`}>
        <div className="flex items-center justify-between w-full mb-1.5 px-1">
          <span className={`text-xs font-semibold tracking-wide uppercase ${isUser ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {isUser ? 'You' : 'IntelliRender AI'}
          </span>
          {isUser && onDelete && (
            <button 
              onClick={() => onDelete(message.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Unsend</span>
            </button>
          )}
        </div>
        <div className={`p-5 rounded-2xl w-full backdrop-blur-md border ${
          isUser 
            ? 'bg-emerald-600/20 text-emerald-50 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
            : 'bg-zinc-900/60 border-white/5 shadow-lg overflow-x-auto'
        }`}>
          <div className="leading-relaxed prose prose-invert max-w-none w-full">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="rounded-lg overflow-hidden my-4 border border-white/10 w-full max-w-full">
                        <SyntaxHighlighter
                          {...props}
                          style={atomDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, padding: '1rem', background: '#0d1117' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code {...props} className={`${className} bg-white/10 rounded px-1.5 py-0.5 text-sm`}>
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
          {message.widget && message.widget.type !== 'text' && message.content && (
            <div className="mt-6 pt-6 border-t border-white/10 w-full overflow-hidden">
              <WidgetRenderer widget={message.widget} />
            </div>
          )}
          {message.widget && message.widget.type !== 'text' && !message.content && (
            <WidgetRenderer widget={message.widget} />
          )}
        </div>
      </div>
    </div>
  );
}
