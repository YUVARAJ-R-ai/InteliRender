'use client';

import { TreemapParams } from '@/types/widget';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#8AB4F8', '#A78BFA', '#34D399', '#F87171', '#FBBF24', '#38BDF8', '#F472B6', '#A3E635'];

function CustomContent(props: any) {
  const { x, y, width, height, name, value, index } = props;
  const color = COLORS[index % COLORS.length];
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} rx={4}
        fill={color} fillOpacity={0.85} stroke="#1a1a1a" strokeWidth={1} />
      {width > 60 && height > 30 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={Math.min(13, width / 6)} fontWeight={500}>
          {name}
        </text>
      )}
      {width > 60 && height > 48 && (
        <text x={x + width / 2} y={y + height / 2 + 16} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.7)" fontSize={Math.min(11, width / 7)}>
          {value.toLocaleString()}
        </text>
      )}
    </g>
  );
}

export function TreemapWidget({ params }: { params: TreemapParams }) {
  if (!params.data?.length) return null;
  return (
    <div className="bg-[#141618] border border-white/5 rounded-xl p-4 w-full">
      <h3 className="text-[13px] font-semibold text-[#E8EDF2] mb-3">{params.title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <Treemap data={params.data} dataKey="value" content={<CustomContent />}>
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
            formatter={((value: any, name: any) => [Number(value).toLocaleString(), name]) as any}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
