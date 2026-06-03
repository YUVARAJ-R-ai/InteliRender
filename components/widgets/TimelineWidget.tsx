'use client';

import { TimelineParams } from '@/types/widget';
import { useState } from 'react';

const COLORS = ['#8AB4F8', '#A78BFA', '#34D399', '#F87171', '#FBBF24', '#38BDF8', '#F472B6', '#A3E635'];

export function TimelineWidget({ params }: { params: TimelineParams }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!params.items?.length) return null;

  const dates = params.items.flatMap(i => [new Date(i.start).getTime(), new Date(i.end).getTime()]);
  const minTs = Math.min(...dates);
  const maxTs = Math.max(...dates);
  const range = maxTs - minTs || 1;

  const groups = [...new Set(params.items.map(i => i.group ?? 'default'))];
  const groupColors: Record<string, string> = {};
  groups.forEach((g, idx) => { groupColors[g] = COLORS[idx % COLORS.length]; });

  const toPercent = (ts: number) => ((ts - minTs) / range) * 100;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="bg-[#141618] border border-white/5 rounded-xl p-4 w-full">
      <h3 className="text-[13px] font-semibold text-[#E8EDF2] mb-4">{params.title}</h3>

      {/* Date ruler */}
      <div className="relative mb-1 h-5">
        {[0, 25, 50, 75, 100].map(pct => {
          const ts = minTs + (range * pct) / 100;
          return (
            <span key={pct}
              className="absolute text-[10px] text-[#4B5563] -translate-x-1/2"
              style={{ left: `${pct}%` }}>
              {new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          );
        })}
      </div>

      {/* Grid line */}
      <div className="relative mb-2">
        <div className="absolute inset-0 flex justify-between">
          {[0, 25, 50, 75, 100].map(p => (
            <div key={p} className="w-px bg-white/5 h-full" />
          ))}
        </div>
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {params.items.map((item) => {
          const startPct = toPercent(new Date(item.start).getTime());
          const endPct = toPercent(new Date(item.end).getTime());
          const widthPct = Math.max(endPct - startPct, 0.5);
          const color = item.color ?? groupColors[item.group ?? 'default'];
          const isHovered = hovered === item.id;

          return (
            <div key={item.id} className="relative h-8 flex items-center"
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}>
              {/* Row label */}
              <div className="absolute -left-[0px] w-0 overflow-visible z-10">
                <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">{item.label}</span>
              </div>
              {/* Bar — shifted right to leave room for labels */}
              <div className="absolute inset-y-1 rounded-md transition-all duration-150 flex items-center px-2 overflow-hidden cursor-default"
                style={{
                  left: `${startPct}%`,
                  width: `${widthPct}%`,
                  background: color,
                  opacity: isHovered ? 1 : 0.75,
                  boxShadow: isHovered ? `0 0 0 2px ${color}40` : undefined,
                }}>
                <span className="text-[10px] text-white font-medium truncate">{item.label}</span>
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-20 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-[#C8CDD3] shadow-xl pointer-events-none"
                  style={{ left: `${startPct + widthPct / 2}%`, top: '-40px', transform: 'translateX(-50%)' }}>
                  <div className="font-medium text-[#E8EDF2]">{item.label}</div>
                  <div className="text-[#6B7280]">{fmt(item.start)} → {fmt(item.end)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {groups.map(g => (
            <div key={g} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: groupColors[g] }} />
              <span className="text-[11px] text-[#6B7280]">{g}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
