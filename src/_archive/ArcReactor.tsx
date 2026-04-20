'use client';

import { useRef, useEffect, useCallback } from 'react';

export type ReactorState = 'idle' | 'speaking' | 'listening' | 'thinking';
export type ReactorSize = 'sm' | 'md' | 'lg' | 'full';

interface ArcReactorProps {
  state?: ReactorState;
  size?: ReactorSize;
  className?: string;
}

const SIZE_MAP: Record<ReactorSize, number> = {
  sm: 32,
  md: 64,
  lg: 160,
  full: 400,
};

const STATE_CONFIG: Record<ReactorState, {
  ringSpeed: number;
  coreIntensity: number;
  glowRadius: number;
  sparkCount: number;
  sparkSpeed: number;
  pulseSpeed: number;
}> = {
  idle: {
    ringSpeed: 0.15,
    coreIntensity: 0.7,
    glowRadius: 0.25,
    sparkCount: 3,
    sparkSpeed: 0.5,
    pulseSpeed: 0.25,
  },
  speaking: {
    ringSpeed: 0.8,
    coreIntensity: 1.0,
    glowRadius: 0.4,
    sparkCount: 8,
    sparkSpeed: 2.0,
    pulseSpeed: 0.6,
  },
  listening: {
    ringSpeed: 0.4,
    coreIntensity: 0.85,
    glowRadius: 0.32,
    sparkCount: 5,
    sparkSpeed: 1.0,
    pulseSpeed: 0.4,
  },
  thinking: {
    ringSpeed: 1.5,
    coreIntensity: 0.9,
    glowRadius: 0.3,
    sparkCount: 6,
    sparkSpeed: 3.0,
    pulseSpeed: 0.8,
  },
};

// Colors from brand guidelines
const BLUE = { r: 37, g: 99, b: 235 };       // #2563eb
const BLUE_LIGHT = { r: 59, g: 130, b: 246 }; // #3b82f6
const BLUE_PALE = { r: 147, g: 197, b: 253 }; // #93c5fd
const WHITE = { r: 220, g: 235, b: 255 };     // blue-white
const NEON = { r: 57, g: 255, b: 20 };        // #39ff14

// Dark metallic colors for the housing
const METAL_DARK = { r: 20, g: 30, b: 50 };
const METAL_MID = { r: 35, g: 50, b: 75 };

interface Spark {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  isGreen: boolean;
  opacity: number;
}

export default function ArcReactor({ state = 'idle', size = 'md', className = '' }: ArcReactorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const sparksRef = useRef<Spark[]>([]);
  const timeRef = useRef(0);
  const stateRef = useRef(state);
  const isMobileRef = useRef(false);
  const pixelSize = SIZE_MAP[size];

  // Update state ref
  stateRef.current = state;

  const initSparks = useCallback((count: number) => {
    const sparks: Spark[] = [];
    for (let i = 0; i < count; i++) {
      sparks.push({
        angle: (Math.PI * 2 * i) / count + Math.random() * 0.5,
        radius: 0.55 + Math.random() * 0.3,
        speed: 0.3 + Math.random() * 0.7,
        size: 0.5 + Math.random() * 1.5,
        isGreen: i % 3 === 0,
        opacity: 0.4 + Math.random() * 0.6,
      });
    }
    return sparks;
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const config = STATE_CONFIG[stateRef.current];
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) * 0.88;
    // Simplified rendering for small canvas OR mobile screens (saves battery)
    const isSmall = w <= 40 || (w <= 80 && isMobileRef.current);

    ctx.clearRect(0, 0, w, h);

    const pulse = Math.sin(t * config.pulseSpeed) * 0.08 + 0.92;

    // ── Outer ambient glow (subtle) ──
    if (!isSmall) {
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.4);
      outerGlow.addColorStop(0, `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.08 * config.coreIntensity * pulse})`);
      outerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, w, h);
    }

    // ── Outer housing ring (thick solid ring — the "metal casing") ──
    const outerR = r * 0.95;
    const outerWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${METAL_MID.r},${METAL_MID.g},${METAL_MID.b},0.8)`;
    ctx.lineWidth = outerWidth;
    ctx.stroke();

    // Outer ring highlight (thin bright line on top edge)
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + outerWidth * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.3 * pulse})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ── Segmented outer ring (10 panels with gaps) ──
    const segCount = 10;
    const segGap = 0.06; // gap in radians
    const segInnerR = r * 0.72;
    const segOuterR = r * 0.88;
    const ring1Angle = t * config.ringSpeed * 0.3;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ring1Angle);

    for (let i = 0; i < segCount; i++) {
      const segAngle = (Math.PI * 2) / segCount;
      const startA = segAngle * i + segGap;
      const endA = segAngle * (i + 1) - segGap;
      const isHighlighted = i % 5 === 0;

      // Segment panel (filled arc)
      ctx.beginPath();
      ctx.arc(0, 0, segOuterR, startA, endA);
      ctx.arc(0, 0, segInnerR, endA, startA, true);
      ctx.closePath();

      // Gradient fill for each segment
      const midA = (startA + endA) / 2;
      const gx = Math.cos(midA) * segInnerR * 0.5;
      const gy = Math.sin(midA) * segInnerR * 0.5;
      const segGrad = ctx.createRadialGradient(gx, gy, 0, 0, 0, segOuterR);
      segGrad.addColorStop(0, `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${(isHighlighted ? 0.25 : 0.12) * pulse})`);
      segGrad.addColorStop(1, `rgba(${METAL_DARK.r},${METAL_DARK.g},${METAL_DARK.b},${isHighlighted ? 0.6 : 0.4})`);
      ctx.fillStyle = segGrad;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = `rgba(${BLUE_LIGHT.r},${BLUE_LIGHT.g},${BLUE_LIGHT.b},${isHighlighted ? 0.5 : 0.2})`;
      ctx.lineWidth = isSmall ? 0.3 : 0.8;
      ctx.stroke();
    }

    ctx.restore();

    // ── Middle structural ring (connector ring between outer and inner) ──
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.70, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.35 * pulse})`;
    ctx.lineWidth = isSmall ? 0.5 : 1.5;
    ctx.stroke();

    // ── Segmented inner ring (8 panels, counter-rotating) ──
    if (!isSmall) {
      const innerSegCount = 8;
      const innerSegGap = 0.08;
      const innerSegInnerR = r * 0.48;
      const innerSegOuterR = r * 0.66;
      const ring2Angle = -t * config.ringSpeed * 0.5;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring2Angle);

      for (let i = 0; i < innerSegCount; i++) {
        const segAngle = (Math.PI * 2) / innerSegCount;
        const startA = segAngle * i + innerSegGap;
        const endA = segAngle * (i + 1) - innerSegGap;
        const isGreen = i % 4 === 0;

        // Segment panel
        ctx.beginPath();
        ctx.arc(0, 0, innerSegOuterR, startA, endA);
        ctx.arc(0, 0, innerSegInnerR, endA, startA, true);
        ctx.closePath();

        ctx.fillStyle = `rgba(${METAL_DARK.r},${METAL_DARK.g},${METAL_DARK.b},0.35)`;
        ctx.fill();

        ctx.strokeStyle = isGreen
          ? `rgba(${NEON.r},${NEON.g},${NEON.b},${0.4 * pulse})`
          : `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.25 * pulse})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // Inner edge glow line for green segments
        if (isGreen) {
          ctx.beginPath();
          ctx.arc(0, 0, innerSegInnerR + 1, startA + 0.02, endA - 0.02);
          ctx.strokeStyle = `rgba(${NEON.r},${NEON.g},${NEON.b},${0.3 * pulse})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // ── Inner structural ring ──
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${BLUE_LIGHT.r},${BLUE_LIGHT.g},${BLUE_LIGHT.b},${0.3 * pulse})`;
    ctx.lineWidth = isSmall ? 0.5 : 1;
    ctx.stroke();

    // ── Radial connectors (structural bridges from core to outer ring) ──
    const connectorCount = isSmall ? 4 : 10;
    for (let i = 0; i < connectorCount; i++) {
      const a = (Math.PI * 2 * i) / connectorCount;
      const isGreenConnector = !isSmall && i % 5 === 0;
      const isMajor = i % 2 === 0;
      const innerR = r * 0.28;
      const outerR = r * (isMajor ? 0.46 : 0.42);

      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(a), cy + innerR * Math.sin(a));
      ctx.lineTo(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a));

      if (isGreenConnector) {
        ctx.strokeStyle = `rgba(${NEON.r},${NEON.g},${NEON.b},${0.6 * pulse})`;
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = `rgba(${BLUE_PALE.r},${BLUE_PALE.g},${BLUE_PALE.b},${isMajor ? 0.35 : 0.15})`;
        ctx.lineWidth = isMajor ? 1 : 0.5;
      }
      ctx.stroke();
    }

    // ── Core housing ring (thick ring around the core) ──
    const coreHousingR = r * 0.26;
    ctx.beginPath();
    ctx.arc(cx, cy, coreHousingR, 0, Math.PI * 2);
    const coreHousingGrad = ctx.createRadialGradient(cx, cy, coreHousingR * 0.8, cx, cy, coreHousingR * 1.2);
    coreHousingGrad.addColorStop(0, `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.4 * pulse})`);
    coreHousingGrad.addColorStop(1, `rgba(${METAL_MID.r},${METAL_MID.g},${METAL_MID.b},0.6)`);
    ctx.strokeStyle = coreHousingGrad;
    ctx.lineWidth = isSmall ? 1.5 : 3;
    ctx.stroke();

    // ── Triangular center element (the iconic arc reactor triangle) ──
    if (!isSmall) {
      const triR = r * 0.18;
      const triAngle = t * config.ringSpeed * 0.8;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(triAngle);

      // Draw triangle
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        const x = triR * Math.cos(a);
        const y = triR * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${BLUE_PALE.r},${BLUE_PALE.g},${BLUE_PALE.b},${0.5 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Triangle vertices — small bright dots
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        const x = triR * Math.cos(a);
        const y = triR * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${WHITE.r},${WHITE.g},${WHITE.b},${0.8 * config.coreIntensity * pulse})`;
        ctx.fill();
      }

      ctx.restore();
    }

    // ── Core glow (contained, not blobby) ──
    const coreR = r * 0.18;
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * pulse);
    coreGlow.addColorStop(0, `rgba(255,255,255,${0.9 * config.coreIntensity})`);
    coreGlow.addColorStop(0.3, `rgba(${BLUE_PALE.r},${BLUE_PALE.g},${BLUE_PALE.b},${0.5 * config.coreIntensity})`);
    coreGlow.addColorStop(0.7, `rgba(${BLUE_LIGHT.r},${BLUE_LIGHT.g},${BLUE_LIGHT.b},${0.15 * config.coreIntensity})`);
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * pulse, 0, Math.PI * 2);
    ctx.fill();

    // ── Bright core center dot ──
    const dotR = r * (isSmall ? 0.12 : 0.07);
    const coreDot = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR);
    coreDot.addColorStop(0, `rgba(255,255,255,${0.95 * config.coreIntensity})`);
    coreDot.addColorStop(0.6, `rgba(${BLUE_PALE.r},${BLUE_PALE.g},${BLUE_PALE.b},${0.6 * config.coreIntensity})`);
    coreDot.addColorStop(1, `rgba(${BLUE.r},${BLUE.g},${BLUE.b},${0.2 * config.coreIntensity})`);
    ctx.fillStyle = coreDot;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();

    // ── Energy sparks (orbiting along rings) ──
    if (!isSmall) {
      const sparks = sparksRef.current;
      for (const spark of sparks) {
        const sparkAngle = spark.angle + t * spark.speed * config.sparkSpeed;
        const sparkR = r * spark.radius;
        const sx = cx + sparkR * Math.cos(sparkAngle);
        const sy = cy + sparkR * Math.sin(sparkAngle);
        const color = spark.isGreen ? NEON : BLUE_LIGHT;

        // Glow
        const sparkGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, spark.size * 2.5);
        sparkGlow.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${spark.opacity * 0.6 * pulse})`);
        sparkGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = sparkGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, spark.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright dot
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${spark.opacity * config.coreIntensity})`;
        ctx.beginPath();
        ctx.arc(sx, sy, spark.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMobile = window.innerWidth < 768;
    isMobileRef.current = isMobile;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = pixelSize;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Initialize sparks — fewer on mobile to reduce GPU load
    const sparkCount = isMobile && size !== 'full'
      ? Math.min(2, STATE_CONFIG[stateRef.current].sparkCount)
      : STATE_CONFIG[stateRef.current].sparkCount;
    sparksRef.current = initSparks(sparkCount);

    // Throttle to ~30fps on mobile for non-fullscreen sizes (saves battery)
    const frameInterval = (isMobile && size !== 'full') ? 33 : 16;
    let lastFrame = 0;

    const animate = (now: number) => {
      animRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      timeRef.current += frameInterval / 1000;
      const config = STATE_CONFIG[stateRef.current];

      // Adjust spark count dynamically
      const targetSparks = isMobile && size !== 'full'
        ? Math.min(2, config.sparkCount)
        : config.sparkCount;
      if (sparksRef.current.length !== targetSparks) {
        sparksRef.current = initSparks(targetSparks);
      }

      draw(ctx, displaySize, displaySize, timeRef.current);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [pixelSize, size, draw, initSparks]);

  // Check reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return (
      <div
        className={`rounded-full ${className}`}
        style={{
          width: pixelSize,
          height: pixelSize,
          background: `radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.3) 30%, rgba(20,30,50,0.8) 60%, transparent 80%)`,
          boxShadow: `0 0 ${pixelSize * 0.15}px rgba(37,99,235,0.3)`,
          border: '1px solid rgba(37,99,235,0.3)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: pixelSize, height: pixelSize }}
    />
  );
}
