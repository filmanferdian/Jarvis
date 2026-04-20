'use client';

import { useState } from 'react';

const SLIDES = [
  'cover',
  'essence',
  'personality',
  'colors-bg',
  'colors-accent',
  'colors-semantic',
  'colors-text',
  'typography',
  'type-scale',
  'reactor',
  'reactor-states',
  'tone',
  'motion',
  'layout',
  'questions',
] as const;

/* ── Inline Arc Reactor SVG ── */
function ArcReactor({ size = 200, state = 'idle' }: { size?: number; state?: string }) {
  const isActive = state === 'speaking';
  const coreOpacity = isActive ? 1 : 0.8;
  const ringSpeed = isActive ? '4s' : '20s';
  const ringSpeed2 = isActive ? '6s' : '30s';
  const glowSize = isActive ? size * 0.6 : size * 0.4;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className={`absolute rounded-full ${isActive ? 'animate-pulse' : ''}`}
        style={{
          width: glowSize * 2,
          height: glowSize * 2,
          background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, rgba(37,99,235,0.05) 60%, transparent 80%)',
          filter: `blur(${size * 0.15}px)`,
        }}
      />

      <svg viewBox="0 0 200 200" width={size} height={size} className="relative z-10">
        {/* Outer ring 3 — rotating slow */}
        <g style={{ transformOrigin: '100px 100px', animation: `spin ${ringSpeed2} linear infinite` }}>
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10) * Math.PI / 180;
            const x1 = 100 + 90 * Math.cos(angle);
            const y1 = 100 + 90 * Math.sin(angle);
            const x2 = 100 + 95 * Math.cos(angle);
            const y2 = 100 + 95 * Math.sin(angle);
            return (
              <line key={`tick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 3 === 0 ? '#2563eb' : '#1e3a5f'}
                strokeWidth={i % 3 === 0 ? 1.5 : 0.5}
                opacity={0.7}
              />
            );
          })}
          <circle cx="100" cy="100" r="92" fill="none" stroke="#2563eb" strokeWidth="0.5" opacity="0.3" />
        </g>

        {/* Outer ring 2 — rotating */}
        <g style={{ transformOrigin: '100px 100px', animation: `spin ${ringSpeed} linear infinite reverse` }}>
          <circle cx="100" cy="100" r="75" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.4"
            strokeDasharray="8 4 2 4" />
          {/* Segment markers */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45) * Math.PI / 180;
            const x1 = 100 + 70 * Math.cos(angle);
            const y1 = 100 + 70 * Math.sin(angle);
            const x2 = 100 + 80 * Math.cos(angle);
            const y2 = 100 + 80 * Math.sin(angle);
            return (
              <line key={`seg-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#3b82f6" strokeWidth="2" opacity="0.6"
              />
            );
          })}
        </g>

        {/* Inner ring — rotating */}
        <g style={{ transformOrigin: '100px 100px', animation: `spin ${ringSpeed} linear infinite` }}>
          <circle cx="100" cy="100" r="55" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.5"
            strokeDasharray="12 6" />
          {/* Arc segments */}
          {Array.from({ length: 4 }).map((_, i) => {
            const startAngle = i * 90 + 10;
            const endAngle = i * 90 + 70;
            const r = 55;
            const x1 = 100 + r * Math.cos(startAngle * Math.PI / 180);
            const y1 = 100 + r * Math.sin(startAngle * Math.PI / 180);
            const x2 = 100 + r * Math.cos(endAngle * Math.PI / 180);
            const y2 = 100 + r * Math.sin(endAngle * Math.PI / 180);
            return (
              <path key={`arc-${i}`}
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                fill="none" stroke="#60a5fa" strokeWidth="3" opacity="0.3"
              />
            );
          })}
        </g>

        {/* Inner detail ring */}
        <g style={{ transformOrigin: '100px 100px', animation: `spin ${ringSpeed2} linear infinite` }}>
          <circle cx="100" cy="100" r="38" fill="none" stroke="#2563eb" strokeWidth="1" opacity="0.5"
            strokeDasharray="4 8" />
        </g>

        {/* Core glow */}
        <defs>
          <radialGradient id="core-glow">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={coreOpacity} />
            <stop offset="30%" stopColor="#93c5fd" stopOpacity={coreOpacity * 0.8} />
            <stop offset="60%" stopColor="#3b82f6" stopOpacity={coreOpacity * 0.4} />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="core-center">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#bfdbfe" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core glow circle */}
        <circle cx="100" cy="100" r="28" fill="url(#core-glow)" />

        {/* Core bright center */}
        <circle cx="100" cy="100" r="14" fill="url(#core-center)" />

        {/* Core ring */}
        <circle cx="100" cy="100" r="20" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />

        {/* Energy lines from core */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30) * Math.PI / 180;
          const x1 = 100 + 22 * Math.cos(angle);
          const y1 = 100 + 22 * Math.sin(angle);
          const x2 = 100 + 35 * Math.cos(angle);
          const y2 = 100 + 35 * Math.sin(angle);
          return (
            <line key={`energy-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={i % 4 === 0 ? '#39ff14' : '#60a5fa'} strokeWidth="1" opacity={i % 4 === 0 ? 0.8 : i % 2 === 0 ? 0.6 : 0.25}
            />
          );
        })}

        {/* Neon green spark particles */}
        {[45, 165, 285].map((deg) => {
          const a = deg * Math.PI / 180;
          return <circle key={`spark-${deg}`} cx={100 + 68 * Math.cos(a)} cy={100 + 68 * Math.sin(a)} r="2" fill="#39ff14" opacity="0.85" />;
        })}
      </svg>
    </div>
  );
}

export default function BrandDeck() {
  const [slide, setSlide] = useState(0);
  const [reactorDemo, setReactorDemo] = useState('idle');
  const current = SLIDES[slide];
  const total = SLIDES.length;

  const next = () => setSlide((s) => Math.min(s + 1, total - 1));
  const prev = () => setSlide((s) => Math.max(s - 1, 0));

  // Colors from updated brand guidelines
  const bg = '#0f1729';
  const surface = '#162036';
  const elevated = '#1c2a44';
  const accent = '#2563eb';
  const accentLight = '#3b82f6';
  const textPrimary = '#f8fafc';
  const textSecondary = '#cbd5e1';
  const textMuted = '#64748b';
  const textDim = '#475569';
  const border = 'rgba(255,255,255,0.08)';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, color: textPrimary, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-4xl">

          {/* ═══ COVER ═══ */}
          {current === 'cover' && (
            <div className="flex flex-col items-center text-center gap-8">
              <ArcReactor size={180} state="idle" />
              <div>
                <h1 className="text-4xl md:text-5xl font-semibold tracking-widest mb-3">JARVIS</h1>
                <p className="text-lg" style={{ color: textSecondary }}>Brand Guidelines — Draft v0.3</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: textMuted }}>
                <span>Use buttons to navigate</span>
                <span>·</span>
                <span>{total} slides</span>
              </div>
            </div>
          )}

          {/* ═══ ESSENCE ═══ */}
          {current === 'essence' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>01 — Brand Essence</p>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
                The calm, competent intelligence<br />
                <span style={{ color: textSecondary }}>behind the scenes.</span>
              </h2>
              <p className="text-lg leading-relaxed max-w-2xl" style={{ color: textSecondary }}>
                Jarvis is a personal AI command center that helps one person stay on top of
                10 life domains. It makes your life feel <em className="not-italic font-medium" style={{ color: textPrimary }}>orchestrated</em> rather
                than <em className="not-italic" style={{ color: textMuted }}>chaotic</em>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                {['Work & Wealth', 'Health & Fitness', 'Growth & Relationships'].map((group) => (
                  <div key={group} className="rounded-xl p-4" style={{ background: surface, border: `1px solid ${border}` }}>
                    <p className="text-sm" style={{ color: textSecondary }}>{group}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ PERSONALITY ═══ */}
          {current === 'personality' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>02 — Personality</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { trait: 'Composed', desc: 'Never frantic. Quiet confidence. Even urgency is delivered with measured calm.' },
                  { trait: 'Perceptive', desc: 'Connects dots across domains. Your sleep affects training readiness. Calendar density affects stress.' },
                  { trait: 'Present', desc: 'Feels alive, not static. It breathes, it responds, it has a visual heartbeat.' },
                ].map((t) => (
                  <div key={t.trait} className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
                    <h3 className="text-xl font-semibold mb-3">{t.trait}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{t.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-5 rounded-xl" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.1)' }}>
                <p className="text-sm font-medium mb-2" style={{ color: '#f87171' }}>What Jarvis is NOT</p>
                <div className="flex gap-6 text-sm" style={{ color: textSecondary }}>
                  <span>Not playful or cute</span>
                  <span>·</span>
                  <span>Not corporate or sterile</span>
                  <span>·</span>
                  <span>Not aggressive or flashy</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ COLORS: BACKGROUNDS ═══ */}
          {current === 'colors-bg' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>03 — Color Palette: Backgrounds</p>
              <p style={{ color: textSecondary }} className="max-w-xl">Dark navy blue — warmer and richer than pure black. Depth through layering.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {[
                  { name: 'Background', hex: bg, desc: 'Page base layer' },
                  { name: 'Surface', hex: surface, desc: 'Cards, panels' },
                  { name: 'Elevated', hex: elevated, desc: 'Hover, active, nested' },
                ].map((c) => (
                  <div key={c.name} className="space-y-3">
                    <div className="rounded-xl h-32 flex items-end p-4" style={{ background: c.hex, border: `1px solid ${border}` }}>
                      <span className="text-xs font-mono" style={{ color: textMuted }}>{c.hex}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs" style={{ color: textMuted }}>{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-16 rounded-xl flex overflow-hidden" style={{ border: `1px solid ${border}` }}>
                  <div className="flex-1 flex items-center justify-center text-xs" style={{ background: bg, color: textMuted }}>Base</div>
                  <div className="flex-1 flex items-center justify-center text-xs" style={{ background: surface, color: textMuted }}>Surface</div>
                  <div className="flex-1 flex items-center justify-center text-xs" style={{ background: elevated, color: textMuted }}>Elevated</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ COLORS: ACCENTS ═══ */}
          {current === 'colors-accent' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>04 — Color Palette: Accents</p>
              <p style={{ color: textSecondary }} className="max-w-xl">Pure blue. No cyan. No violet. Bold and confident.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {[
                  { name: 'Bold Blue', hex: '#2563eb', desc: 'Primary accent — links, actions, highlights' },
                  { name: 'Bright Blue', hex: '#3b82f6', desc: 'Hover states, secondary highlights' },
                  { name: 'Neon Green', hex: '#39ff14', desc: 'Live indicators, system status, reactor sparks' },
                  { name: 'Reactor Glow', hex: '#2563eb → #1d4ed8', desc: 'Arc reactor, premium moments' },
                ].map((c) => (
                  <div key={c.name} className="space-y-3">
                    <div
                      className="rounded-xl h-32 flex items-end p-4 relative overflow-hidden"
                      style={{
                        background: c.name === 'Reactor Glow'
                          ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                          : c.name === 'Neon Green'
                          ? '#0a1a0a'
                          : c.hex,
                      }}
                    >
                      {c.name === 'Neon Green' && (
                        <>
                          <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)' }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: '#39ff14', boxShadow: '0 0 8px #39ff14, 0 0 20px rgba(57,255,20,0.4)' }} />
                            <span className="text-[10px] font-mono font-medium" style={{ color: '#39ff14' }}>ONLINE</span>
                          </div>
                          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 80%, rgba(57,255,20,0.15) 0%, transparent 60%)' }} />
                        </>
                      )}
                      <span className="text-xs font-mono relative z-10" style={{ color: c.name === 'Neon Green' ? '#39ff14' : 'rgba(255,255,255,0.7)' }}>{c.hex}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs" style={{ color: textMuted }}>{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl mt-4" style={{ background: 'rgba(57,255,20,0.03)', border: '1px solid rgba(57,255,20,0.1)' }}>
                <p className="text-xs" style={{ color: textSecondary }}>
                  <span className="font-medium" style={{ color: '#39ff14' }}>Blue is the brain, green is the heartbeat.</span> Blue dominates the palette. Green punctuates — always small: dots, pulses, sparks. The green glow is the signal that JARVIS is alive.
                </p>
              </div>
            </div>
          )}

          {/* ═══ COLORS: SEMANTIC ═══ */}
          {current === 'colors-semantic' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>05 — Color Palette: Semantic</p>
              <p style={{ color: textSecondary }} className="max-w-xl">Status colors are small and contextual — dots, badges, indicators. Never large blocks.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {[
                  { name: 'Success', hex: '#34d399', example: 'Healthy domains, positive trends' },
                  { name: 'Warning', hex: '#f59e0b', example: 'Aging domains, approaching limits' },
                  { name: 'Danger', hex: '#f87171', example: 'Neglected domains, overdue tasks' },
                ].map((c) => (
                  <div key={c.name} className="rounded-xl p-5 space-y-4" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: c.hex }} />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs font-mono" style={{ color: textMuted }}>{c.hex}</span>
                    </div>
                    <p className="text-sm" style={{ color: textSecondary }}>{c.example}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.hex }} />
                      <span style={{ color: c.hex }}>
                        {c.name === 'Success' ? '8 healthy' : c.name === 'Warning' ? '1 aging' : '1 neglected'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ COLORS: TEXT ═══ */}
          {current === 'colors-text' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>06 — Text Hierarchy</p>
              <p style={{ color: textSecondary }} className="max-w-xl">White text + bold blue accents. High contrast against navy backgrounds.</p>
              <div className="space-y-4 mt-6">
                {[
                  { name: 'Primary', hex: textPrimary, sample: 'Good morning, Filman. Here\'s your briefing.', usage: 'Headings, body text, primary content' },
                  { name: 'Accent', hex: accent, sample: 'Generate now · View details · 3 tasks overdue', usage: 'Interactive text, key highlights, links' },
                  { name: 'Secondary', hex: textSecondary, sample: 'Sleep score dropped 15 pts from yesterday.', usage: 'Supporting text, labels, descriptions' },
                  { name: 'Muted', hex: textMuted, sample: 'Last synced 3 minutes ago', usage: 'Timestamps, inactive states, tertiary info' },
                  { name: 'Dim', hex: textDim, sample: 'v2.0.0', usage: 'Placeholders, disabled text, version numbers' },
                ].map((t) => (
                  <div key={t.name} className="flex items-start gap-6 p-4 rounded-xl" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs font-mono" style={{ color: textMuted }}>{t.hex}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-base leading-relaxed" style={{ color: t.hex }}>{t.sample}</p>
                      <p className="text-xs mt-1" style={{ color: textMuted }}>{t.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TYPOGRAPHY ═══ */}
          {current === 'typography' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>07 — Typography</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-xs mb-4 font-mono" style={{ color: textMuted }}>BODY — Inter</p>
                  <p className="text-3xl font-semibold mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Aa Bb Cc
                  </p>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", color: textSecondary }}>
                    The quick brown fox jumps over the lazy dog. Jarvis delivers your morning briefing with calm precision.
                  </p>
                  <p className="text-xs mt-4" style={{ color: textMuted }}>All UI text, labels, paragraphs, navigation</p>
                </div>
                <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-xs mb-4 font-mono" style={{ color: textMuted }}>DATA — JetBrains Mono</p>
                  <p className="text-3xl font-semibold mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    01:23:45
                  </p>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace", color: textSecondary }}>
                    78% · 2,450 steps · 7h 32m · 64 bpm
                  </p>
                  <p className="text-xs mt-4" style={{ color: textMuted }}>Numbers, metrics, timestamps, KPIs</p>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: elevated, border: `1px solid ${border}` }}>
                <p className="text-xs mb-2" style={{ color: textMuted }}>Principle</p>
                <p className="text-sm" style={{ color: textSecondary }}>White text for content. <span className="font-medium" style={{ color: accent }}>Bold blue</span> for emphasis and interaction. No cyan.</p>
              </div>
            </div>
          )}

          {/* ═══ TYPE SCALE ═══ */}
          {current === 'type-scale' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>08 — Type Scale</p>
              <div className="space-y-3">
                {[
                  { label: 'Page title', size: '20px', weight: '600', sample: 'Health & Fitness' },
                  { label: 'Section header', size: '15px', weight: '500', sample: 'Morning Briefing' },
                  { label: 'Body', size: '14px', weight: '400', sample: 'Your calendar has 3 meetings today. Training readiness is moderate.' },
                  { label: 'Label', size: '13px', weight: '500', sample: 'Dashboard · Health & Fitness · Utilities' },
                  { label: 'Caption', size: '12px', weight: '400', sample: 'Generated at 07:30 WIB · Last synced 2m ago' },
                  { label: 'Micro', size: '11px', weight: '500', sample: 'LIFE DOMAINS · v2.0.0 · 3 neglected' },
                ].map((t) => (
                  <div key={t.label} className="flex items-baseline gap-6 p-4 rounded-xl transition-colors" style={{ ['--hover-bg' as string]: surface }}>
                    <div className="w-28 shrink-0">
                      <p className="text-xs" style={{ color: textMuted }}>{t.label}</p>
                      <p className="text-[10px] font-mono" style={{ color: textDim }}>{t.size} / {t.weight}</p>
                    </div>
                    <p style={{ fontSize: t.size, fontWeight: Number(t.weight) }}>{t.sample}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ THE REACTOR ═══ */}
          {current === 'reactor' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>09 — The Arc Reactor: Visual Identity</p>
              <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="shrink-0">
                  <ArcReactor size={180} state="idle" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold">JARVIS&apos;s face</h3>
                  <p className="leading-relaxed" style={{ color: textSecondary }}>
                    Inspired by the Iron Man arc reactor. Concentric rings, energy lines, and a glowing core
                    that communicates JARVIS&apos;s state and presence.
                  </p>
                  <div className="space-y-2 text-sm" style={{ color: textSecondary }}>
                    <p>• Glowing white-blue core at the center</p>
                    <p>• Concentric rotating rings with geometric segments</p>
                    <p>• Radial energy lines emanating outward</p>
                    <p>• <span className="font-medium" style={{ color: textPrimary }}>Near full-screen</span> when JARVIS speaks</p>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-center gap-16 mt-8 p-6 rounded-xl" style={{ background: surface, border: `1px solid ${border}` }}>
                <div className="flex flex-col items-center gap-3">
                  <ArcReactor size={32} state="idle" />
                  <span className="text-xs" style={{ color: textMuted }}>Small — TopBar</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <ArcReactor size={64} state="idle" />
                  <span className="text-xs" style={{ color: textMuted }}>Medium — Dashboard</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <ArcReactor size={120} state="idle" />
                  <span className="text-xs" style={{ color: textMuted }}>Large — Hero</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ REACTOR STATES ═══ */}
          {current === 'reactor-states' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>10 — The Arc Reactor: States</p>
              <p style={{ color: textSecondary }}>Click each state to see the reactor respond.</p>
              <div className="flex justify-center mb-4">
                <ArcReactor size={200} state={reactorDemo} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { state: 'idle', label: 'Idle', desc: 'Slow rotation, gentle pulse. Present but quiet.' },
                  { state: 'speaking', label: 'Speaking', desc: 'Faster spin, brighter core. Near full-screen takeover.' },
                  { state: 'listening', label: 'Listening', desc: 'Rings expand, core brightens. Voice input active.' },
                  { state: 'thinking', label: 'Thinking', desc: 'Fast spin, particles accelerate. Processing.' },
                ].map((s) => (
                  <button
                    key={s.state}
                    onClick={() => setReactorDemo(s.state)}
                    className="p-4 rounded-xl text-left transition-colors"
                    style={{
                      background: reactorDemo === s.state ? elevated : surface,
                      border: `1px solid ${reactorDemo === s.state ? 'rgba(37,99,235,0.3)' : border}`,
                    }}
                  >
                    <p className="text-sm font-medium mb-1">{s.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TONE ═══ */}
          {current === 'tone' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>11 — Tone of Voice</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Direct', 'Informed', 'Calm', 'Human enough'].map((t) => (
                  <div key={t} className="rounded-xl p-4 text-center" style={{ background: surface, border: `1px solid ${border}` }}>
                    <p className="text-sm font-medium">{t}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 mt-4">
                {[
                  { ctx: 'Greeting', good: 'Good morning, Filman', bad: 'Welcome back, User!' },
                  { ctx: 'Empty', good: 'No briefing yet. Generate or check after 07:30.', bad: 'Oops! Nothing here yet 😅' },
                  { ctx: 'Alert', good: '2 tasks overdue', bad: '⚠️ WARNING: Overdue tasks!!!' },
                  { ctx: 'Insight', good: 'Battery at 28. Lighter training today.', bad: 'Battery is critically low!!!' },
                  { ctx: 'Success', good: 'Briefing generated.', bad: '✅ Success! Generated!' },
                ].map((t) => (
                  <div key={t.ctx} className="grid grid-cols-[80px_1fr_1fr] gap-4 p-3 rounded-xl text-sm" style={{ background: surface, border: `1px solid ${border}` }}>
                    <span style={{ color: textMuted }}>{t.ctx}</span>
                    <span style={{ color: '#34d399' }}>{t.good}</span>
                    <span className="line-through" style={{ color: '#f87171', textDecorationColor: 'rgba(248,113,113,0.3)' }}>{t.bad}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ MOTION ═══ */}
          {current === 'motion' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>12 — Motion Principles</p>
              <h3 className="text-2xl font-semibold">Smooth, purposeful, never frantic.</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Micro', time: '150ms', use: 'Hover states, focus rings' },
                  { name: 'Standard', time: '200ms', use: 'Color transitions, opacity' },
                  { name: 'Smooth', time: '300ms', use: 'Entry animations, content reveals' },
                  { name: 'Breathing', time: '4000ms', use: 'Reactor idle cycle — the UI heartbeat' },
                  { name: 'Cinematic', time: '800ms', use: 'Reactor expand/collapse to full-screen' },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs font-mono" style={{ color: accent }}>{m.time}</p>
                    </div>
                    <p className="text-sm" style={{ color: textMuted }}>{m.use}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.1)' }}>
                <p className="text-sm" style={{ color: textSecondary }}>
                  <span className="font-medium" style={{ color: '#f87171' }}>No bouncing.</span> Never use spring/bounce. Jarvis is composed, not playful.
                </p>
              </div>
            </div>
          )}

          {/* ═══ LAYOUT ═══ */}
          {current === 'layout' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>13 — Layout Principles</p>
              <div className="space-y-6">
                <div>
                  <p className="text-sm mb-3" style={{ color: textMuted }}>Depth model</p>
                  <div className="flex rounded-xl overflow-hidden h-24" style={{ border: `1px solid ${border}` }}>
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ background: bg }}>
                      <p className="text-xs font-medium">Background</p>
                      <p className="text-[10px] font-mono" style={{ color: textMuted }}>{bg}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ background: surface, borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}` }}>
                      <p className="text-xs font-medium">Surface</p>
                      <p className="text-[10px] font-mono" style={{ color: textMuted }}>{surface}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ background: elevated }}>
                      <p className="text-xs font-medium">Elevated</p>
                      <p className="text-[10px] font-mono" style={{ color: textMuted }}>{elevated}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-3" style={{ color: textMuted }}>Desktop grid</p>
                  <div className="flex rounded-xl overflow-hidden h-48" style={{ border: `1px solid ${border}` }}>
                    <div className="w-[180px] flex items-center justify-center" style={{ background: surface, borderRight: `1px solid ${border}` }}>
                      <p className="text-xs" style={{ color: textMuted }}>Sidebar 260px</p>
                    </div>
                    <div className="flex-1 p-4" style={{ background: bg }}>
                      <div className="grid grid-cols-2 gap-3 h-full">
                        <div className="rounded-lg" style={{ background: surface, border: `1px solid ${border}` }} />
                        <div className="rounded-lg" style={{ background: surface, border: `1px solid ${border}` }} />
                        <div className="rounded-lg col-span-2" style={{ background: surface, border: `1px solid ${border}` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-3" style={{ color: textMuted }}>Spacing scale</p>
                  <div className="flex items-end gap-2">
                    {[4, 8, 12, 16, 20, 24, 32, 48].map((s) => (
                      <div key={s} className="flex flex-col items-center gap-1">
                        <div className="rounded" style={{ width: `${s}px`, height: `${s}px`, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.3)' }} />
                        <span className="text-[10px] font-mono" style={{ color: textMuted }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ QUESTIONS ═══ */}
          {current === 'questions' && (
            <div className="space-y-8">
              <p className="text-sm font-medium tracking-wider uppercase" style={{ color: accent }}>14 — Open Questions</p>
              <h3 className="text-2xl font-semibold">Remaining decisions</h3>
              <div className="space-y-4">
                {[
                  { q: 'Reactor complexity', desc: 'Canvas/WebGL — invest in organic, particle-heavy reactor.', resolved: true },
                  { q: 'Greeting tone', desc: 'Time-based: "Good morning/afternoon/evening, Filman".', resolved: true },
                  { q: 'Speaking UX', desc: 'Reactor goes full-screen with no briefing text overlay — pure cinematic moment.', resolved: true },
                  { q: 'Accent color', desc: 'Bold blue (#2563eb), no cyan, no violet.', resolved: true },
                  { q: 'Name styling', desc: '"JARVIS" (all caps).', resolved: true },
                  { q: 'Brand gradient', desc: 'Blue only. No violet, no cyan.', resolved: true },
                ].map((q, i) => (
                  <div key={i} className="rounded-xl p-5" style={{
                    background: q.resolved ? 'rgba(52,211,153,0.05)' : surface,
                    border: `1px solid ${q.resolved ? 'rgba(52,211,153,0.15)' : border}`,
                    opacity: q.resolved ? 0.6 : 1,
                  }}>
                    <div className="flex items-center gap-2 mb-1">
                      {q.resolved && <span style={{ color: '#34d399' }}>✓</span>}
                      <p className={`font-medium ${q.resolved ? 'line-through' : ''}`}>{q.q}</p>
                    </div>
                    <p className="text-sm" style={{ color: textSecondary }}>{q.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-8 py-4" style={{ borderTop: `1px solid ${border}` }}>
        <button
          onClick={prev}
          disabled={slide === 0}
          className="px-4 py-2 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          ← Previous
        </button>
        <span className="text-xs font-mono" style={{ color: textMuted }}>
          {slide + 1} / {total}
        </span>
        <button
          onClick={next}
          disabled={slide === total - 1}
          className="px-4 py-2 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          Next →
        </button>
      </div>

      {/* CSS for SVG spin */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
