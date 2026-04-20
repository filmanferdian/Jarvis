'use client';

import { useState } from 'react';

/* ── Colors ── */
const bg = '#0f1729';
const surface = '#162036';
const elevated = '#1c2a44';
const accent = '#2563eb';
const accentLight = '#3b82f6';
const textPrimary = '#f8fafc';
const textSecondary = '#cbd5e1';
const textMuted = '#64748b';
const textDim = '#475569';
const neonGreen = '#39ff14';
const border = 'rgba(255,255,255,0.08)';

/* ── Mini Arc Reactor for mood pieces ── */
function MiniReactor({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <radialGradient id="mr-core">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mr-outer">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#mr-outer)" />
      <g style={{ transformOrigin: '100px 100px', animation: 'spin 25s linear infinite' }}>
        {Array.from({ length: 36 }).map((_, i) => {
          const a = (i * 10) * Math.PI / 180;
          return (
            <line key={i} x1={100 + 78 * Math.cos(a)} y1={100 + 78 * Math.sin(a)}
              x2={100 + 88 * Math.cos(a)} y2={100 + 88 * Math.sin(a)}
              stroke={i % 3 === 0 ? '#2563eb' : '#1e3a5f'} strokeWidth={i % 3 === 0 ? 1.5 : 0.5} opacity="0.6" />
          );
        })}
        <circle cx="100" cy="100" r="85" fill="none" stroke="#2563eb" strokeWidth="0.5" opacity="0.25" />
      </g>
      <g style={{ transformOrigin: '100px 100px', animation: 'spin 15s linear infinite reverse' }}>
        <circle cx="100" cy="100" r="65" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.3" strokeDasharray="8 4 2 4" />
      </g>
      <g style={{ transformOrigin: '100px 100px', animation: 'spin 12s linear infinite' }}>
        <circle cx="100" cy="100" r="48" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" strokeDasharray="10 6" />
      </g>
      <circle cx="100" cy="100" r="26" fill="url(#mr-core)" />
      <circle cx="100" cy="100" r="12" fill="white" opacity="0.85" />
      <circle cx="100" cy="100" r="18" fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 45) * Math.PI / 180;
        return (
          <line key={i} x1={100 + 20 * Math.cos(a)} y1={100 + 20 * Math.sin(a)}
            x2={100 + 32 * Math.cos(a)} y2={100 + 32 * Math.sin(a)}
            stroke={i % 3 === 0 ? '#39ff14' : '#60a5fa'} strokeWidth="1" opacity={i % 3 === 0 ? 0.8 : 0.5} />
        );
      })}
      {/* Neon green spark particles */}
      {[30, 150, 270].map((deg) => {
        const a = deg * Math.PI / 180;
        return <circle key={`spark-${deg}`} cx={100 + 72 * Math.cos(a)} cy={100 + 72 * Math.sin(a)} r="2.5" fill="#39ff14" opacity="0.85" />;
      })}
    </svg>
  );
}

/* ── Mood Board Sections ── */
const SECTIONS = [
  'overview',
  'atmosphere',
  'reactor-cinema',
  'data-elegance',
  'interaction',
  'reference-apps',
] as const;

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  atmosphere: 'Atmosphere & Depth',
  'reactor-cinema': 'Cinematic Reactor',
  'data-elegance': 'Data Elegance',
  interaction: 'Micro-interactions',
  'reference-apps': 'Reference Apps',
};

export default function MoodBoard() {
  const [activeSection, setActiveSection] = useState<string>('overview');

  return (
    <div className="min-h-screen" style={{ background: bg, color: textPrimary, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(15,23,41,0.85)', borderBottom: `1px solid ${border}` }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-widest">JARVIS</h1>
            <p className="text-xs" style={{ color: textMuted }}>Mood Board — Step 6</p>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors"
                style={{
                  background: activeSection === s ? elevated : 'transparent',
                  color: activeSection === s ? textPrimary : textMuted,
                  border: activeSection === s ? `1px solid rgba(37,99,235,0.3)` : '1px solid transparent',
                }}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ═══ OVERVIEW ═══ */}
        {activeSection === 'overview' && (
          <div className="space-y-10">
            <div className="text-center space-y-4 mb-12">
              <p className="text-sm tracking-wider uppercase" style={{ color: accent }}>Mood Board</p>
              <h2 className="text-3xl md:text-4xl font-semibold">The JARVIS Aesthetic</h2>
              <p className="max-w-xl mx-auto" style={{ color: textSecondary }}>
                Dark, layered, cinematic. Intelligence that feels alive. Data presented with calm precision.
              </p>
            </div>

            {/* Three keywords */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  word: 'Cinematic',
                  desc: 'The reactor fills the screen when JARVIS speaks. Dramatic presence, not a widget.',
                  visual: (
                    <div className="relative h-40 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `radial-gradient(circle at center, rgba(37,99,235,0.15) 0%, ${bg} 70%)` }}>
                      <MiniReactor size={100} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(15,23,41,0.9))' }} />
                    </div>
                  ),
                },
                {
                  word: 'Layered',
                  desc: 'Depth through color stepping. Background, surface, elevated. No shadows needed.',
                  visual: (
                    <div className="h-40 rounded-xl overflow-hidden flex items-stretch gap-0">
                      <div className="flex-1 flex items-center justify-center text-[10px] font-mono" style={{ background: bg, color: textDim }}>bg</div>
                      <div className="flex-1 flex items-center justify-center text-[10px] font-mono" style={{ background: surface, color: textDim }}>surface</div>
                      <div className="flex-1 flex items-center justify-center text-[10px] font-mono" style={{ background: elevated, color: textDim }}>elevated</div>
                    </div>
                  ),
                },
                {
                  word: 'Precise',
                  desc: 'Monospace numbers, clean grids, calm data. Information without noise.',
                  visual: (
                    <div className="h-40 rounded-xl p-5 flex flex-col justify-center gap-3" style={{ background: surface, border: `1px solid ${border}` }}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs" style={{ color: textMuted }}>Body Battery</span>
                        <span className="text-lg font-mono font-semibold" style={{ color: '#34d399' }}>78%</span>
                      </div>
                      <p className="text-[10px] -mt-0.5 mb-1" style={{ color: textDim }}>Good — ready for intense training</p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: elevated }}>
                        <div className="h-full rounded-full" style={{ width: '78%', background: 'linear-gradient(90deg, #34d399, #2563eb)' }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono" style={{ color: textDim }}>
                        <span>6h 42m sleep</span>
                        <span>62 bpm resting</span>
                        <span>2,840 steps</span>
                      </div>
                    </div>
                  ),
                },
              ].map((item) => (
                <div key={item.word} className="space-y-4">
                  {item.visual}
                  <div>
                    <h3 className="text-lg font-semibold">{item.word}</h3>
                    <p className="text-sm" style={{ color: textSecondary }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Color mood strip */}
            <div className="space-y-3 mt-8">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Color Mood</p>
              <div className="flex h-20 rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                {[bg, surface, elevated, '#1e3a5f', accent, accentLight, '#93c5fd', neonGreen, '#ffffff'].map((c, i) => (
                  <div key={i} className="flex-1 transition-all hover:flex-[2]" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs" style={{ color: textDim }}>Navy depth → Blue energy → Green pulse → White clarity</p>
            </div>
          </div>
        )}

        {/* ═══ ATMOSPHERE & DEPTH ═══ */}
        {activeSection === 'atmosphere' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: accent }}>Atmosphere & Depth</p>
              <h2 className="text-2xl font-semibold mb-2">Navy, not black. Warm, not cold.</h2>
              <p style={{ color: textSecondary }}>The background has life. Subtle gradients and depth layers give the interface warmth and dimension.</p>
            </div>

            {/* Depth layering demo */}
            <div className="space-y-4">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Depth Layering</p>
              <div className="relative rounded-2xl p-8 h-80" style={{ background: bg, border: `1px solid ${border}` }}>
                {/* Subtle radial glow in center */}
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.06) 0%, transparent 60%)' }} />

                <div className="relative grid grid-cols-2 gap-4 h-full">
                  <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="text-xs mb-2" style={{ color: textMuted }}>Surface card</div>
                    <div className="rounded-lg p-3 mt-2" style={{ background: elevated, border: `1px solid ${border}` }}>
                      <div className="text-xs" style={{ color: textMuted }}>Elevated element</div>
                      <div className="mt-2 h-6 rounded flex items-center justify-center text-[10px] font-mono" style={{ background: 'rgba(37,99,235,0.1)', color: accent }}>
                        hover state
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="text-xs mb-2" style={{ color: textMuted }}>Surface card</div>
                    <div className="space-y-2 mt-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-8 rounded-lg flex items-center px-3 text-xs" style={{ background: i === 2 ? elevated : 'transparent', color: i === 2 ? textPrimary : textMuted }}>
                          {i === 2 ? 'Active row' : `Row ${i}`}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow effects */}
            <div className="space-y-4">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Ambient Glow</p>
              <p className="text-sm" style={{ color: textSecondary }}>Subtle blue radial glows behind key elements. Never harsh — like moonlight on water.</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-48 rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 50%, rgba(37,99,235,0.08) 0%, ${bg} 70%)`, border: `1px solid ${border}` }}>
                  <span className="text-xs" style={{ color: textMuted }}>Subtle center glow</span>
                </div>
                <div className="h-48 rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 0%, rgba(37,99,235,0.12) 0%, ${bg} 60%)`, border: `1px solid ${border}` }}>
                  <span className="text-xs" style={{ color: textMuted }}>Top glow (reactor)</span>
                </div>
                <div className="h-48 rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 100%, rgba(37,99,235,0.06) 0%, ${bg} 50%)`, border: `1px solid ${border}` }}>
                  <span className="text-xs" style={{ color: textMuted }}>Bottom ambient</span>
                </div>
              </div>
            </div>

            {/* Border philosophy */}
            <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
              <p className="text-sm font-medium mb-3">Border philosophy</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="rounded-lg p-4 mb-2" style={{ background: bg, border: `1px solid ${border}` }}>
                    <span className="text-xs" style={{ color: textMuted }}>Hair-thin dividers, barely there</span>
                  </div>
                  <p className="text-xs" style={{ color: '#34d399' }}>This — subtle separation</p>
                </div>
                <div>
                  <div className="rounded-lg p-4 mb-2" style={{ background: bg, border: '2px solid rgba(255,255,255,0.2)' }}>
                    <span className="text-xs" style={{ color: textMuted }}>Heavy visible borders</span>
                  </div>
                  <p className="text-xs line-through" style={{ color: '#f87171' }}>Not this — too prominent</p>
                </div>
              </div>
            </div>

            {/* Neon green: the heartbeat */}
            <div className="space-y-4">
              <p className="text-xs tracking-wider uppercase" style={{ color: neonGreen }}>Neon Green — The Heartbeat</p>
              <p className="text-sm" style={{ color: textSecondary }}>Blue is the brain. Green is the heartbeat. A neon pulse that signals JARVIS is alive and connected.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Live status */}
                <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-xs mb-3" style={{ color: textMuted }}>System status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: neonGreen, boxShadow: `0 0 6px ${neonGreen}, 0 0 12px rgba(57,255,20,0.2)` }} />
                    <span className="text-xs font-mono" style={{ color: neonGreen, fontFamily: "'JetBrains Mono', monospace" }}>ONLINE</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: textDim }} />
                    <span className="text-xs font-mono" style={{ color: textDim, fontFamily: "'JetBrains Mono', monospace" }}>OFFLINE</span>
                  </div>
                </div>
                {/* Sync pulse */}
                <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-xs mb-3" style={{ color: textMuted }}>Live sync indicator</p>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full" style={{ background: neonGreen }} />
                      <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: neonGreen, opacity: 0.4 }} />
                    </div>
                    <span className="text-xs" style={{ color: textSecondary }}>Syncing Garmin data...</span>
                  </div>
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: elevated }}>
                    <div className="h-full rounded-full" style={{ width: '65%', background: `linear-gradient(90deg, ${neonGreen}, ${accent})` }} />
                  </div>
                </div>
                {/* Reactor spark */}
                <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-xs mb-3" style={{ color: textMuted }}>Reactor energy accent</p>
                  <div className="flex items-center justify-center h-20">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full" style={{ background: `radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)` }} />
                      {/* Green sparks */}
                      {[0, 72, 144, 216, 288].map((deg) => (
                        <div key={deg} className="absolute w-1 h-1 rounded-full" style={{
                          background: neonGreen,
                          boxShadow: `0 0 3px ${neonGreen}`,
                          top: `${50 + 40 * Math.sin(deg * Math.PI / 180)}%`,
                          left: `${50 + 40 * Math.cos(deg * Math.PI / 180)}%`,
                          transform: 'translate(-50%, -50%)',
                        }} />
                      ))}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full" style={{ background: 'white', boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-center" style={{ color: textDim }}>Green sparks in reactor rings</p>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(57,255,20,0.03)', border: '1px solid rgba(57,255,20,0.1)' }}>
                <p className="text-xs" style={{ color: textSecondary }}>
                  <span className="font-medium" style={{ color: neonGreen }}>Rule:</span> Neon green is always small — dots, pulses, sparks. Never backgrounds, never text blocks. It&apos;s the heartbeat, not the body.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CINEMATIC REACTOR ═══ */}
        {activeSection === 'reactor-cinema' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: accent }}>Cinematic Reactor</p>
              <h2 className="text-2xl font-semibold mb-2">The signature JARVIS moment</h2>
              <p style={{ color: textSecondary }}>When JARVIS speaks, the reactor takes over. Full screen. No text overlay. Pure cinematic energy.</p>
            </div>

            {/* Full-screen speaking mock */}
            <div className="relative rounded-2xl overflow-hidden h-[420px] flex items-center justify-center" style={{ background: `radial-gradient(circle at center, rgba(37,99,235,0.2) 0%, rgba(30,58,95,0.1) 40%, ${bg} 70%)`, border: `1px solid ${border}` }}>
              {/* Atmospheric glow layers */}
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(37,99,235,0.15) 0%, transparent 50%)' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(147,197,253,0.05) 0%, transparent 30%)' }} />

              <div className="relative flex flex-col items-center gap-6">
                <MiniReactor size={200} />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2.5 mb-1 px-4 py-1.5 rounded-full mx-auto w-fit" style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)' }}>
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: neonGreen, boxShadow: `0 0 10px ${neonGreen}, 0 0 20px rgba(57,255,20,0.4)` }} />
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping" style={{ background: neonGreen, opacity: 0.3 }} />
                    </div>
                    <p className="text-sm tracking-widest uppercase font-medium" style={{ color: neonGreen }}>Speaking</p>
                  </div>
                  <p className="text-xs mt-1" style={{ color: textDim }}>Reading your morning briefing...</p>
                </div>
              </div>

              {/* Vignette */}
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(15,23,41,0.6) 100%)' }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Idle state */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Idle — Compact</p>
                <div className="rounded-xl p-6 flex items-center gap-4" style={{ background: surface, border: `1px solid ${border}` }}>
                  <MiniReactor size={36} />
                  <div className="flex-1">
                    <p className="text-sm">Good morning, Filman</p>
                    <p className="text-xs" style={{ color: textDim }}>Standing by...</p>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)' }}>
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full" style={{ background: neonGreen, boxShadow: `0 0 8px ${neonGreen}, 0 0 16px rgba(57,255,20,0.4)` }} />
                      <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: neonGreen, opacity: 0.3 }} />
                    </div>
                    <span className="text-[10px] font-mono font-medium" style={{ color: neonGreen, fontFamily: "'JetBrains Mono', monospace" }}>ONLINE</span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: textSecondary }}>Small reactor in TopBar. Minimal. Present but quiet.</p>
              </div>

              {/* Thinking state */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Thinking — Processing</p>
                <div className="rounded-xl p-6 flex items-center justify-center" style={{ background: surface, border: `1px solid rgba(37,99,235,0.2)` }}>
                  <div className="flex flex-col items-center gap-3">
                    <MiniReactor size={64} />
                    <p className="text-xs" style={{ color: accent }}>Processing...</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: textSecondary }}>Medium reactor. Rings spin faster, particles accelerate.</p>
              </div>
            </div>

            {/* Canvas/WebGL note */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: accent }}>Production: Canvas / WebGL</p>
              <p className="text-sm" style={{ color: textSecondary }}>
                The production reactor will use Canvas/WebGL for organic particle trails, smooth energy flow, and fluid ring rotation.
                The SVG previews here capture the composition and feel — the final will have much more life and subtlety.
              </p>
            </div>
          </div>
        )}

        {/* ═══ DATA ELEGANCE ═══ */}
        {activeSection === 'data-elegance' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: accent }}>Data Elegance</p>
              <h2 className="text-2xl font-semibold mb-2">Information without noise</h2>
              <p style={{ color: textSecondary }}>Monospace for precision. White for content. Blue for interaction. Every pixel has purpose.</p>
            </div>

            {/* KPI strip */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>KPI Display</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Sleep Score', value: '82', unit: 'pts', trend: '+5', color: '#34d399', meaning: 'Good — well rested' },
                  { label: 'Body Battery', value: '71', unit: '%', trend: '-8', color: '#f59e0b', meaning: 'Moderate — go easy' },
                  { label: 'Tasks Done', value: '6', unit: '/9', trend: '', color: accent, meaning: '3 remaining today' },
                  { label: 'Meetings', value: '3', unit: 'today', trend: '', color: textSecondary, meaning: 'Next at 10:00' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl p-4" style={{ background: surface, border: `1px solid ${border}` }}>
                    <p className="text-[11px] mb-2" style={{ color: textMuted }}>{kpi.label}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-mono font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</span>
                      <span className="text-xs" style={{ color: textMuted }}>{kpi.unit}</span>
                    </div>
                    {kpi.trend && (
                      <span className="text-[10px] font-mono mt-1 inline-block" style={{ color: kpi.color }}>{kpi.trend}</span>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: textDim }}>{kpi.meaning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule strip */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Schedule Timeline</p>
              <div className="rounded-xl p-5" style={{ background: surface, border: `1px solid ${border}` }}>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {[
                    { time: '09:00', title: 'Standup', dur: '15m', active: false },
                    { time: '10:00', title: 'Sprint Planning', dur: '1h', active: true },
                    { time: '12:00', title: 'Lunch', dur: '1h', active: false },
                    { time: '14:00', title: 'Design Review', dur: '30m', active: false },
                    { time: '16:00', title: 'Focus Time', dur: '2h', active: false },
                  ].map((evt) => (
                    <div key={evt.time} className="flex-shrink-0 w-36 rounded-lg p-3 transition-colors" style={{
                      background: evt.active ? elevated : 'transparent',
                      border: `1px solid ${evt.active ? 'rgba(37,99,235,0.3)' : border}`,
                    }}>
                      <p className="text-[10px] font-mono mb-1" style={{ color: evt.active ? accent : textDim, fontFamily: "'JetBrains Mono', monospace" }}>{evt.time}</p>
                      <p className="text-xs font-medium">{evt.title}</p>
                      <p className="text-[10px]" style={{ color: textDim }}>{evt.dur}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Typography specimen */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Typography in action</p>
              <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
                <p className="text-xs font-medium tracking-wider uppercase mb-4" style={{ color: accent }}>Morning Briefing</p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: textSecondary }}>
                  Good morning, Filman. You slept <span className="font-mono" style={{ color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>7h 12m</span> with
                  a score of <span className="font-mono" style={{ color: '#34d399', fontFamily: "'JetBrains Mono', monospace" }}>82</span>. Body battery
                  is at <span className="font-mono" style={{ color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>71%</span>, down from yesterday.
                  Consider lighter training today.
                </p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: textSecondary }}>
                  You have <span className="font-mono font-medium" style={{ color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>3</span> meetings
                  and <span className="font-mono" style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>2</span> overdue tasks.
                  Calendar clears after <span className="font-mono" style={{ color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>14:00</span>.
                </p>
                <div className="flex items-center gap-2.5 pt-3" style={{ borderTop: `1px solid ${border}` }}>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full" style={{ background: neonGreen, boxShadow: `0 0 8px ${neonGreen}, 0 0 16px rgba(57,255,20,0.3)` }} />
                    <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: neonGreen, opacity: 0.25 }} />
                  </div>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded" style={{ color: neonGreen, background: 'rgba(57,255,20,0.08)', fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
                  <span className="text-[10px] font-mono" style={{ color: textDim, fontFamily: "'JetBrains Mono', monospace" }}>Generated 07:30 WIB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MICRO-INTERACTIONS ═══ */}
        {activeSection === 'interaction' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: accent }}>Micro-interactions</p>
              <h2 className="text-2xl font-semibold mb-2">Smooth, purposeful, composed</h2>
              <p style={{ color: textSecondary }}>Every transition communicates. No bounce, no flash. Calm intelligence in motion.</p>
            </div>

            {/* Hover states */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Hover & Active States</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="group rounded-xl p-5 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
                  style={{ background: surface, border: `1px solid ${border}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = elevated; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = surface; e.currentTarget.style.borderColor = border; }}
                >
                  <p className="text-xs mb-1" style={{ color: textMuted }}>Card hover</p>
                  <p className="text-sm">Background shifts to elevated. Blue border hint.</p>
                </div>
                <button className="rounded-xl p-5 text-left transition-all duration-200"
                  style={{ background: accent, color: 'white' }}>
                  <p className="text-xs mb-1 opacity-70">Primary button</p>
                  <p className="text-sm font-medium">Generate Briefing</p>
                </button>
                <button className="rounded-xl p-5 text-left transition-all duration-200"
                  style={{ background: 'transparent', border: `1px solid ${border}`, color: textSecondary }}>
                  <p className="text-xs mb-1" style={{ color: textMuted }}>Ghost button</p>
                  <p className="text-sm">Transparent with border</p>
                </button>
              </div>
            </div>

            {/* Timing tokens visual */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Timing Tokens</p>
              <div className="space-y-2">
                {[
                  { name: 'Micro', ms: 150, desc: 'Hover states, focus rings', width: '10%' },
                  { name: 'Standard', ms: 200, desc: 'Color transitions, opacity', width: '15%' },
                  { name: 'Smooth', ms: 300, desc: 'Entry animations, reveals', width: '22%' },
                  { name: 'Cinematic', ms: 800, desc: 'Reactor expand/collapse', width: '55%' },
                  { name: 'Breathing', ms: 4000, desc: 'Reactor idle pulse', width: '100%' },
                ].map((t) => (
                  <div key={t.name} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: surface }}>
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-medium">{t.name}</p>
                      <p className="text-[10px] font-mono" style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{t.ms}ms</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: elevated }}>
                        <div className="h-full rounded-full transition-all" style={{ width: t.width, background: `linear-gradient(90deg, ${accent}, ${accentLight})` }} />
                      </div>
                    </div>
                    <p className="text-[10px] w-36 shrink-0" style={{ color: textMuted }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Content entry */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: textMuted }}>Content Entry</p>
              <p className="text-sm" style={{ color: textSecondary }}>Fade in + slight upward drift. 300ms ease-out. Staggered for lists.</p>
              <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded-lg flex items-center px-4 text-xs" style={{
                      background: elevated,
                      opacity: 1 - i * 0.2,
                      transform: `translateY(${i * 2}px)`,
                    }}>
                      <span style={{ color: textSecondary }}>Item fades in with {i * 50}ms stagger</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ REFERENCE APPS ═══ */}
        {activeSection === 'reference-apps' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: accent }}>Reference Apps</p>
              <h2 className="text-2xl font-semibold mb-2">Inspired by the best dark UIs</h2>
              <p style={{ color: textSecondary }}>These apps nail what JARVIS aims for: dark, clean, data-rich, and alive.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: 'Linear',
                  takeaway: 'Clean data density. Subtle hover states. Keyboard-first interactions. The gold standard for dark app UI.',
                  qualities: ['Typography hierarchy', 'Subtle borders', 'Clean density'],
                },
                {
                  name: 'Raycast',
                  takeaway: 'Ambient glow effects. Cinematic landing page. Premium feel through restraint and polish.',
                  qualities: ['Ambient glow', 'Cinematic moments', 'Premium restraint'],
                },
                {
                  name: 'Arc Browser',
                  takeaway: 'Living sidebar. Color as identity. The interface feels personal and alive, not generic.',
                  qualities: ['Living chrome', 'Personal feel', 'Color identity'],
                },
                {
                  name: 'Iron Man HUD',
                  takeaway: 'The JARVIS reactor DNA. Concentric rings, blue energy, technical overlays. The reactor IS our brand.',
                  qualities: ['Arc reactor', 'Blue energy', 'Technical detail'],
                },
              ].map((ref) => (
                <div key={ref.name} className="rounded-xl p-6 space-y-4" style={{ background: surface, border: `1px solid ${border}` }}>
                  <h3 className="text-lg font-semibold">{ref.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{ref.takeaway}</p>
                  <div className="flex gap-2 flex-wrap">
                    {ref.qualities.map((q) => (
                      <span key={q} className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(37,99,235,0.1)', color: accent }}>
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* What we take */}
            <div className="rounded-xl p-6" style={{ background: elevated, border: `1px solid ${border}` }}>
              <p className="text-sm font-medium mb-4">What JARVIS takes from each</p>
              <div className="space-y-3 text-sm" style={{ color: textSecondary }}>
                <p><span style={{ color: textPrimary }}>From Linear:</span> Data density without clutter, subtle hover states, typography as hierarchy</p>
                <p><span style={{ color: textPrimary }}>From Raycast:</span> Ambient glow effects, the feeling of premium polish, cinematic hero moments</p>
                <p><span style={{ color: textPrimary }}>From Arc:</span> A living UI that feels personal, not a generic dashboard</p>
                <p><span style={{ color: textPrimary }}>From Iron Man:</span> The arc reactor as visual identity, blue energy language, technical detail in the rings</p>
              </div>
            </div>
          </div>
        )}
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
