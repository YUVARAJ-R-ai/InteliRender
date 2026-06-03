'use client';

import { CodeDiffParams } from '@/types/widget';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function diffLines(before: string, after: string) {
  const a = before.split('\n');
  const b = after.split('\n');
  const maxLen = Math.max(a.length, b.length);
  const result: { before: string | null; after: string | null; changed: boolean }[] = [];
  for (let i = 0; i < maxLen; i++) {
    const bLine = a[i] ?? null;
    const aLine = b[i] ?? null;
    result.push({ before: bLine, after: aLine, changed: bLine !== aLine });
  }
  return result;
}

export function CodeDiffWidget({ params }: { params: CodeDiffParams }) {
  const lines = diffLines(params.before, params.after);
  const changedCount = lines.filter(l => l.changed).length;

  return (
    <div className="bg-[#141618] border border-white/5 rounded-xl overflow-hidden w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1A1C1E] border-b border-white/5">
        <span className="text-[12px] font-mono text-[#A5A299]">{params.filename || 'diff'}</span>
        <span className="text-[11px] text-[#6B7280]">{changedCount} line{changedCount !== 1 ? 's' : ''} changed</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/5">
        {/* Before */}
        <div>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-red-400 bg-red-500/5 border-b border-white/5">Before</div>
          <div className="overflow-x-auto">
            {lines.map((line, i) => (
              <div key={i} className={`flex ${line.changed && line.before !== null ? 'bg-red-500/10' : ''}`}>
                <span className="w-8 shrink-0 text-right text-[10px] text-[#4B5563] pr-2 py-0.5 select-none">{i + 1}</span>
                <pre className="text-[11px] font-mono text-[#C8CDD3] py-0.5 whitespace-pre overflow-hidden">
                  {line.before ?? <span className="text-[#4B5563]">{'  '}</span>}
                </pre>
              </div>
            ))}
          </div>
        </div>
        {/* After */}
        <div>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/5 border-b border-white/5">After</div>
          <div className="overflow-x-auto">
            {lines.map((line, i) => (
              <div key={i} className={`flex ${line.changed && line.after !== null ? 'bg-emerald-500/10' : ''}`}>
                <span className="w-8 shrink-0 text-right text-[10px] text-[#4B5563] pr-2 py-0.5 select-none">{i + 1}</span>
                <pre className="text-[11px] font-mono text-[#C8CDD3] py-0.5 whitespace-pre overflow-hidden">
                  {line.after ?? <span className="text-[#4B5563]">{'  '}</span>}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
