'use client';

import { useEffect, useRef } from 'react';

export type MindmapState = 'idle' | 'thinking' | 'speaking' | 'listening';
export type MindmapDensity = 'sparse' | 'normal' | 'dense';

type Props = {
  size: number;
  state?: MindmapState;
  density?: MindmapDensity;
  className?: string;
};

const STATE_PARAMS: Record<MindmapState, { intensity: number; rotSpeed: number }> = {
  idle:      { intensity: 0.15, rotSpeed: 0.18 },
  thinking:  { intensity: 0.5,  rotSpeed: 0.3  },
  speaking:  { intensity: 0.85, rotSpeed: 0.2  },
  listening: { intensity: 0.4,  rotSpeed: 0.1  },
};

const PALETTE = {
  core: '#4a5dcf',
  edgeBase: 'rgba(74,93,207,0.45)',
  glow: 'rgba(74,93,207,0.22)',
};

function densityFromSize(size: number): MindmapDensity {
  if (size < 64) return 'sparse';
  if (size < 240) return 'normal';
  return 'dense';
}

export default function Mindmap({ size, state = 'idle', density, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const effectiveDensity = density ?? densityFromSize(size);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const count = effectiveDensity === 'sparse' ? 42 : effectiveDensity === 'dense' ? 120 : 78;
    const nodes: Array<{
      ox: number; oy: number; oz: number;
      size: number; phase: number; speed: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 0.55 + 0.35 * Math.pow(Math.random(), 1.4);
      nodes.push({
        ox: Math.cos(theta) * Math.sin(phi) * r,
        oy: Math.sin(theta) * Math.sin(phi) * r,
        oz: Math.cos(phi) * r,
        size: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.6,
      });
    }

    const edges: Array<{ a: number; b: number; strength: number }> = [];
    for (let i = 0; i < nodes.length; i++) {
      const ds: Array<{ j: number; d: number }> = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].ox - nodes[j].ox;
        const dy = nodes[i].oy - nodes[j].oy;
        const dz = nodes[i].oz - nodes[j].oz;
        ds.push({ j, d: dx * dx + dy * dy + dz * dz });
      }
      ds.sort((a, b) => a.d - b.d);
      const k = 2 + Math.floor(Math.random() * 2);
      for (let n = 0; n < k; n++) {
        if (ds[n].j > i) edges.push({ a: i, b: ds[n].j, strength: 0.3 + Math.random() * 0.7 });
      }
    }

    const pulses: Array<{ e: typeof edges[number]; t: number }> = [];

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let t0 = performance.now();
    let tt = 0;
    let rafId = 0;

    function frame(now: number) {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      tt += dt;
      ctx!.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.42;

      const current = STATE_PARAMS[stateRef.current] ?? STATE_PARAMS.idle;
      const active = stateRef.current !== 'idle';
      const intensity = current.intensity;

      const rotY = tt * current.rotSpeed;
      const rotX = Math.sin(tt * 0.15) * 0.22;
      const cY = Math.cos(rotY);
      const sY = Math.sin(rotY);
      const cX = Math.cos(rotX);
      const sX = Math.sin(rotX);
      const breath = 1 + (active ? intensity * 0.12 : 0.04) * Math.sin(tt * 1.4);

      const P = nodes.map((n) => {
        const wx = Math.sin(tt * n.speed + n.phase) * 0.03;
        const wy = Math.cos(tt * n.speed * 0.8 + n.phase) * 0.03;
        const ax = (n.ox + wx) * breath;
        const ay = (n.oy + wy) * breath;
        const az = n.oz * breath;
        let rx = ax * cY + az * sY;
        let rz = -ax * sY + az * cY;
        const ry = ay * cX - rz * sX;
        rz = ay * sX + rz * cX;
        const per = 2.6 / (2.6 - rz);
        return { sx: cx + rx * R * per, sy: cy + ry * R * per, depth: (rz + 1) / 2, n };
      });

      if (active && Math.random() < 0.12 + intensity * 0.3) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        if (e) pulses.push({ e, t: 0 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += dt * (1.2 + intensity * 0.8);
        if (pulses[i].t >= 1) pulses.splice(i, 1);
      }

      const eds = edges
        .map((e) => ({ e, a: P[e.a], b: P[e.b], depth: (P[e.a].depth + P[e.b].depth) / 2 }))
        .sort((x, y) => x.depth - y.depth);

      for (const { e, a, b, depth } of eds) {
        const alpha = (0.1 + depth * 0.4) * e.strength;
        ctx!.strokeStyle = PALETTE.edgeBase.replace(/[\d.]+\)$/, alpha.toFixed(3) + ')');
        ctx!.lineWidth = 0.4 + depth * 0.5;
        ctx!.beginPath();
        ctx!.moveTo(a.sx, a.sy);
        ctx!.lineTo(b.sx, b.sy);
        ctx!.stroke();
      }

      for (const p of pulses) {
        const a = P[p.e.a];
        const b = P[p.e.b];
        const px = a.sx + (b.sx - a.sx) * p.t;
        const py = a.sy + (b.sy - a.sy) * p.t;
        const fade = 1 - p.t;
        ctx!.globalAlpha = fade * 0.9;
        ctx!.fillStyle = PALETTE.core;
        ctx!.beginPath();
        ctx!.arc(px, py, 1.5 + fade * 1.3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = fade * 0.3;
        ctx!.fillStyle = PALETTE.glow;
        ctx!.beginPath();
        ctx!.arc(px, py, 3 + fade * 4, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      const ns = P.slice().sort((a, b) => a.depth - b.depth);
      for (const p of ns) {
        const pulse = active ? 1 + Math.sin(tt * 2 + p.n.phase) * 0.3 * intensity : 1;
        const r = p.n.size * (0.8 + p.depth * 1.5) * pulse;
        ctx!.globalAlpha = (0.2 + p.depth * 0.5) * (active ? 0.8 + intensity * 0.4 : 0.7);
        ctx!.fillStyle = PALETTE.glow;
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, r * 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 0.5 + p.depth * 0.5;
        ctx!.fillStyle = PALETTE.core;
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      if (!reduceMotion) rafId = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      // Freeze on a single idle snapshot
      frame(performance.now());
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [size, density]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
