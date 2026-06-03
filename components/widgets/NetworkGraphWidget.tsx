'use client';

import { NetworkGraphParams } from '@/types/widget';
import { useEffect, useRef, useState } from 'react';

const COLORS = ['#8AB4F8', '#A78BFA', '#34D399', '#F87171', '#FBBF24', '#38BDF8', '#F472B6', '#A3E635'];

interface NodeState {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function NetworkGraphWidget({ params }: { params: NetworkGraphParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodeState[]>([]);
  const animRef = useRef<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const nodes = params.nodes ?? [];
  const groups = [...new Set(nodes.map(n => n.group ?? 'default'))];
  const groupColor: Record<string, string> = {};
  groups.forEach((g, i) => { groupColor[g] = COLORS[i % COLORS.length]; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nodeList = params.nodes ?? [];
    const edgeList = params.edges ?? [];
    if (!nodeList.length) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    // Initialize node positions
    nodesRef.current = nodeList.map((n, i) => {
      const angle = (i / nodeList.length) * Math.PI * 2;
      const r = Math.min(W, H) * 0.3;
      return {
        id: n.id,
        label: n.label,
        group: n.group ?? 'default',
        x: W / 2 + r * Math.cos(angle),
        y: H / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        size: n.size ?? 8,
      };
    });

    const edgeMap: Record<string, string[]> = {};
    edgeList.forEach(e => {
      (edgeMap[e.source] ??= []).push(e.target);
      (edgeMap[e.target] ??= []).push(e.source);
    });

    function tick() {
      const nodes = nodesRef.current;
      const k = 0.05;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1500 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      edgeList.forEach(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 80) * k;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      });

      // Center gravity
      nodes.forEach(n => {
        n.vx += (W / 2 - n.x) * 0.005;
        n.vy += (H / 2 - n.y) * 0.005;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.size + 5, Math.min(W - n.size - 5, n.x));
        n.y = Math.max(n.size + 5, Math.min(H - n.size - 5, n.y));
      });
    }

    function draw() {
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      const nodes = nodesRef.current;

      ctx.clearRect(0, 0, W, H);

      // Edges
      edgeList.forEach(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = e.weight ?? 1;
        ctx.stroke();
        if (e.label) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.font = '9px sans-serif';
          ctx.fillText(e.label, (s.x + t.x) / 2, (s.y + t.y) / 2);
        }
      });

      // Nodes
      nodes.forEach(n => {
        const color = groupColor[n.group];
        const isHov = n.id === hovered;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size + (isHov ? 3 : 0), 0, Math.PI * 2);
        ctx.fillStyle = color + (isHov ? 'ff' : 'cc');
        ctx.fill();
        ctx.strokeStyle = isHov ? color : 'rgba(0,0,0,0.3)';
        ctx.lineWidth = isHov ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `${isHov ? 'bold ' : ''}11px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.size + 14);
      });
    }

    let frame = 0;
    function loop() {
      if (frame < 180) tick(); // run physics for first 180 frames then settle
      draw();
      frame++;
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [params, hovered]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < n.size + 4);
    setHovered(hit?.id ?? null);
  }

  return (
    <div className="bg-[#141618] border border-white/5 rounded-xl overflow-hidden w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 360 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      />
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-3 px-4 pb-3">
          {groups.map(g => (
            <div key={g} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: groupColor[g] }} />
              <span className="text-[11px] text-[#6B7280]">{g}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
