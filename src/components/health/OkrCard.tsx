'use client';

import { useEffect, useRef } from 'react';

export interface RidgelineObjective {
  name: string;
  krs: number;
  current: number;
  history: number[];
}

interface OkrCardProps {
  objectives: RidgelineObjective[];
}

export default function OkrCard({ objectives }: OkrCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || objectives.length === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function draw() {
      if (!canvas || !wrap) return;
      const cssW = wrap.clientWidth;
      const cssH = 360;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      const margin = { l: 200, r: 32, t: 16, b: 30 };
      const plotW = cssW - margin.l - margin.r;
      const rowH = (cssH - margin.t - margin.b) / objectives.length;

      ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(12,15,36,0.38)';
      ctx.textAlign = 'left';
      const dayCount = Math.max(...objectives.map((o) => o.history.length), 14);
      for (let d = 0; d < dayCount - 1; d += 7) {
        const x = margin.l + (d / (dayCount - 1)) * plotW;
        ctx.fillText(`−${dayCount - 1 - d}d`, x, cssH - 8);
      }
      ctx.textAlign = 'right';
      ctx.fillText('Today', margin.l + plotW, cssH - 8);

      objectives.forEach((o, i) => {
        const y0 = margin.t + i * rowH + rowH;
        const peak = rowH * 0.85;

        ctx.fillStyle = '#0c0f24';
        ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        const label = o.name.length > 32 ? o.name.slice(0, 30) + '…' : o.name;
        ctx.fillText(label, margin.l - 14, y0 - rowH / 2);

        ctx.fillStyle = 'rgba(12,15,36,0.38)';
        ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
        const krText = `${o.krs} KR${o.krs === 1 ? '' : 's'} · ${Math.round(o.current)}%`;
        ctx.fillText(krText, margin.l - 14, y0 - rowH / 2 + 14);

        ctx.strokeStyle = 'rgba(12,15,36,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(margin.l, y0);
        ctx.lineTo(margin.l + plotW, y0);
        ctx.stroke();

        const data = o.history.length > 0 ? o.history : [o.current];
        const n = data.length;

        ctx.beginPath();
        ctx.moveTo(margin.l, y0);
        data.forEach((v, j) => {
          const x = margin.l + (n === 1 ? 1 : j / (n - 1)) * plotW;
          const y = y0 - (Math.max(0, Math.min(100, v)) / 100) * peak;
          ctx.lineTo(x, y);
        });
        ctx.lineTo(margin.l + plotW, y0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, y0 - peak, 0, y0);
        grad.addColorStop(0, 'rgba(74,93,207,0.35)');
        grad.addColorStop(1, 'rgba(74,93,207,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        data.forEach((v, j) => {
          const x = margin.l + (n === 1 ? 1 : j / (n - 1)) * plotW;
          const y = y0 - (Math.max(0, Math.min(100, v)) / 100) * peak;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#4a5dcf';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.stroke();

        const last = data[data.length - 1];
        const lx = margin.l + plotW;
        const ly = y0 - (Math.max(0, Math.min(100, last)) / 100) * peak;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    draw();

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [objectives]);

  return (
    <div
      className="rounded-[14px] border bg-[var(--color-jarvis-bg-card)] p-6"
      style={{ borderColor: 'var(--color-jarvis-border)' }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-[family-name:var(--font-display)] text-[18px] font-medium tracking-tight text-[var(--color-jarvis-text-primary)]">
          OKR Ridgeline
        </h2>
        <span className="font-mono text-[11px] text-[var(--color-jarvis-text-faint)]">
          14-day trajectory · {objectives.length} objective{objectives.length === 1 ? '' : 's'}
        </span>
      </div>
      <div ref={wrapRef} className="w-full">
        <canvas ref={canvasRef} aria-label="OKR ridgeline: 14-day progress trajectory across objectives" />
      </div>
    </div>
  );
}
