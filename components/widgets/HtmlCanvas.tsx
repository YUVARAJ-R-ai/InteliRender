import { HtmlCanvasParams } from '@/types/widget';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Code2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';

function ensureFullDocument(html: string): string {
  const trimmed = html.trim();
  if (/^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return html;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base target="_blank">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: system-ui, sans-serif; overflow: auto; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

export function HtmlCanvas({ params }: { params: HtmlCanvasParams }) {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [collapsed, setCollapsed] = useState(false);
  const srcDoc = useMemo(() => ensureFullDocument(params.html), [params.html]);

  return (
    <Card
      className="w-full bg-zinc-950/80 border-white/10 shadow-2xl backdrop-blur-xl mt-4"
      style={{ isolation: 'isolate', contain: 'layout paint' }}
    >
      <CardHeader className="border-b border-white/5 py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-zinc-100">
          <Code2 className="w-4 h-4 text-emerald-400" />
          Interactive Canvas
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setView('preview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                view === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Play className="w-3 h-3" /> Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                view === 'code' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3 h-3" /> Code
            </button>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="p-0">
          {view === 'preview' ? (
            <div className="w-full bg-white relative" style={{ height: 'min(420px, 55vh)' }}>
              <iframe
                srcDoc={srcDoc}
                className="w-full h-full border-0 absolute inset-0"
                title="HTML Canvas"
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div
              className="w-full overflow-auto bg-[#0d1117] p-4 text-sm font-mono text-zinc-300"
              style={{ maxHeight: 'min(420px, 55vh)' }}
            >
              <pre className="whitespace-pre-wrap break-words">
                <code>{params.html}</code>
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
