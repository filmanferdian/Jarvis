'use client';

import { useState } from 'react';

/* ── Design Tokens ── */
const t = {
  bg: '#0f1729',
  surface: '#162036',
  elevated: '#1c2a44',
  accent: '#2563eb',
  accentLight: '#3b82f6',
  accentMuted: 'rgba(37,99,235,0.12)',
  neon: '#39ff14',
  neonMuted: 'rgba(57,255,20,0.1)',
  success: '#34d399',
  warn: '#f59e0b',
  danger: '#f87171',
  text1: '#f8fafc',
  text2: '#cbd5e1',
  text3: '#64748b',
  text4: '#475569',
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(37,99,235,0.3)',
};

/* ── Sections ── */
const SECTIONS = [
  'overview',
  'buttons',
  'cards',
  'forms',
  'badges-status',
  'data-display',
  'navigation',
  'patterns',
] as const;

const LABELS: Record<string, string> = {
  overview: 'Overview',
  buttons: 'Buttons',
  cards: 'Cards',
  forms: 'Forms & Inputs',
  'badges-status': 'Badges & Status',
  'data-display': 'Data Display',
  navigation: 'Navigation',
  patterns: 'Patterns',
};

/* ── Mini Reactor ── */
function Reactor({ size = 32 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Green ambient glow behind reactor */}
      <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, rgba(57,255,20,0.08) 0%, transparent 70%)` }} />
      <svg viewBox="0 0 200 200" width={size} height={size} className="relative">
        <defs>
          <radialGradient id="st-core">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#93c5fd" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g style={{ transformOrigin: '100px 100px', animation: 'spin 20s linear infinite' }}>
          <circle cx="100" cy="100" r="85" fill="none" stroke="#2563eb" strokeWidth="0.8" opacity="0.3" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30) * Math.PI / 180;
            return <line key={i} x1={100 + 75 * Math.cos(a)} y1={100 + 75 * Math.sin(a)} x2={100 + 88 * Math.cos(a)} y2={100 + 88 * Math.sin(a)} stroke={i % 4 === 0 ? '#39ff14' : '#2563eb'} strokeWidth="1" opacity={i % 4 === 0 ? 0.7 : 0.4} />;
          })}
        </g>
        <g style={{ transformOrigin: '100px 100px', animation: 'spin 12s linear infinite reverse' }}>
          <circle cx="100" cy="100" r="60" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.3" strokeDasharray="8 6" />
        </g>
        {/* Green spark particles on outer ring */}
        {[0, 120, 240].map((deg) => {
          const a = deg * Math.PI / 180;
          return <circle key={deg} cx={100 + 72 * Math.cos(a)} cy={100 + 72 * Math.sin(a)} r="2" fill="#39ff14" opacity="0.8" />;
        })}
        <circle cx="100" cy="100" r="24" fill="url(#st-core)" />
        <circle cx="100" cy="100" r="10" fill="white" opacity="0.85" />
      </svg>
    </div>
  );
}

export default function StyleTile() {
  const [section, setSection] = useState<string>('overview');
  const [toggleOn, setToggleOn] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(0);

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.text1, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(15,23,41,0.85)', borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-widest">JARVIS</h1>
            <p className="text-xs" style={{ color: t.text3 }}>Style Tile — Step 7</p>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button key={s} onClick={() => setSection(s)}
                className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors"
                style={{
                  background: section === s ? t.elevated : 'transparent',
                  color: section === s ? t.text1 : t.text3,
                  border: section === s ? `1px solid ${t.borderActive}` : '1px solid transparent',
                }}>
                {LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ═══ OVERVIEW ═══ */}
        {section === 'overview' && (
          <div className="space-y-10">
            <div className="text-center space-y-4 mb-12">
              <p className="text-sm tracking-wider uppercase" style={{ color: t.accent }}>Style Tile</p>
              <h2 className="text-3xl md:text-4xl font-semibold">JARVIS Component Language</h2>
              <p className="max-w-xl mx-auto" style={{ color: t.text2 }}>
                Concrete UI patterns that bring the brand guidelines and mood board to life. Every component follows the same design DNA.
              </p>
            </div>

            {/* Token summary grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: t.text3 }}>Radius</p>
                <div className="flex items-end gap-3">
                  <div className="w-8 h-8 rounded" style={{ background: t.elevated, border: `1px solid ${t.border}` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ background: t.elevated, border: `1px solid ${t.border}` }} />
                  <div className="w-8 h-8 rounded-xl" style={{ background: t.elevated, border: `1px solid ${t.border}` }} />
                  <div className="w-8 h-8 rounded-full" style={{ background: t.elevated, border: `1px solid ${t.border}` }} />
                </div>
                <p className="text-[10px] font-mono mt-2" style={{ color: t.text4 }}>4 · 8 · 12 · full</p>
              </div>
              <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: t.text3 }}>Spacing</p>
                <div className="flex items-end gap-1">
                  {[4, 8, 12, 16, 20, 24, 32].map((s) => (
                    <div key={s} className="rounded" style={{ width: 8, height: s, background: t.accent, opacity: 0.4 }} />
                  ))}
                </div>
                <p className="text-[10px] font-mono mt-2" style={{ color: t.text4 }}>4px base scale</p>
              </div>
              <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: t.text3 }}>Border</p>
                <div className="space-y-2">
                  <div className="h-6 rounded-lg" style={{ border: `1px solid ${t.border}` }} />
                  <div className="h-6 rounded-lg" style={{ border: `1px solid ${t.borderActive}` }} />
                </div>
                <p className="text-[10px] font-mono mt-2" style={{ color: t.text4 }}>default · active</p>
              </div>
              <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: t.text3 }}>Transitions</p>
                <div className="space-y-1 text-[10px] font-mono" style={{ color: t.text2 }}>
                  <p>150ms <span style={{ color: t.text4 }}>micro</span></p>
                  <p>200ms <span style={{ color: t.text4 }}>standard</span></p>
                  <p>300ms <span style={{ color: t.text4 }}>smooth</span></p>
                </div>
              </div>
            </div>

            {/* Quick component sampler */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Component Sampler</p>
              <div className="rounded-xl p-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-4 mb-6">
                  <Reactor size={32} />
                  <div>
                    <p className="text-sm font-medium">Good morning, Filman</p>
                    <p className="text-xs" style={{ color: t.text4 }}>Standing by...</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)' }}>
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full" style={{ background: t.neon, boxShadow: `0 0 6px ${t.neon}, 0 0 14px rgba(57,255,20,0.4)` }} />
                      <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: t.neon, opacity: 0.3 }} />
                    </div>
                    <span className="text-[10px] font-mono font-medium" style={{ color: t.neon }}>ONLINE</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Sleep', val: '7h 12m', color: t.success, meaning: 'Good — above 7h target' },
                    { label: 'Battery', val: '71%', color: t.warn, meaning: 'Moderate — lighter training' },
                    { label: 'Tasks', val: '6/9', color: t.accent, meaning: '3 remaining today' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-lg p-3" style={{ background: t.elevated }}>
                      <p className="text-[10px]" style={{ color: t.text3 }}>{k.label}</p>
                      <p className="text-lg font-mono font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: k.color }}>{k.val}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: t.text3 }}>{k.meaning}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: t.accent, color: 'white' }}>Generate Briefing</button>
                  <button className="px-4 py-2 rounded-lg text-sm transition-colors" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.text2 }}>View Schedule</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BUTTONS ═══ */}
        {section === 'buttons' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Buttons</p>
              <h2 className="text-2xl font-semibold mb-2">Actions & Controls</h2>
              <p style={{ color: t.text2 }}>Three tiers: primary (blue fill), secondary (border), ghost (transparent). All 200ms transition.</p>
            </div>

            {/* Button variants */}
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Primary</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: t.accent, color: 'white' }}>Generate Briefing</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium opacity-80" style={{ background: t.accent, color: 'white' }}>Hover State</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" style={{ background: t.accent, color: 'white' }}>Disabled</button>
                  <button className="px-3 py-2.5 rounded-lg text-sm font-medium" style={{ background: t.accent, color: 'white' }}>
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      Add Task
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Secondary</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${t.border}`, color: t.text2 }}>View Details</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm" style={{ border: `1px solid ${t.borderActive}`, color: t.text1, background: t.elevated }}>Hover State</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed" style={{ border: `1px solid ${t.border}`, color: t.text3 }}>Disabled</button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Ghost</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text2 }}>Cancel</button>
                  <button className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text1, background: 'rgba(255,255,255,0.04)' }}>Hover State</button>
                  <button className="px-4 py-2 rounded-lg text-sm" style={{ color: t.accent }}>Link Style</button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Danger</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(248,113,113,0.12)', color: t.danger, border: '1px solid rgba(248,113,113,0.2)' }}>Delete Task</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: t.danger, color: 'white' }}>Confirm Delete</button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Icon Buttons</p>
                <div className="flex flex-wrap gap-3">
                  {['play', 'refresh', 'settings', 'close'].map((icon) => (
                    <button key={icon} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text3 }}>
                      {icon === 'play' && <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                      {icon === 'refresh' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>}
                      {icon === 'settings' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>}
                      {icon === 'close' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Sizes</p>
                <div className="flex items-center gap-3">
                  <button className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: t.accent, color: 'white' }}>Small</button>
                  <button className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: t.accent, color: 'white' }}>Medium (default)</button>
                  <button className="px-6 py-3 rounded-xl text-base font-medium" style={{ background: t.accent, color: 'white' }}>Large</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CARDS ═══ */}
        {section === 'cards' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Cards</p>
              <h2 className="text-2xl font-semibold mb-2">Containers & Surfaces</h2>
              <p style={{ color: t.text2 }}>Surface background + hair-thin border + 12px radius. Content breathes with 20px padding.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Standard card */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Standard Card</p>
                <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[15px] font-medium">Morning Briefing</p>
                    <span className="text-[10px] font-mono" style={{ color: t.text4 }}>07:30 WIB</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: t.text2 }}>
                    You slept 7h 12m with a score of 82. Body battery is at 71%. 3 meetings today, calendar clears after 14:00.
                  </p>
                  <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
                    <button className="text-xs" style={{ color: t.accent }}>Regenerate</button>
                    <span style={{ color: t.text4 }}>·</span>
                    <button className="text-xs flex items-center gap-1" style={{ color: t.text3 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      Listen
                    </button>
                  </div>
                </div>
              </div>

              {/* Metric card */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Metric Card</p>
                <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: t.text3 }}>Body Battery</p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-mono font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.warn }}>71%</span>
                    <span className="text-xs font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.danger }}>-8</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: t.elevated }}>
                    <div className="h-full rounded-full" style={{ width: '71%', background: `linear-gradient(90deg, ${t.warn}, ${t.accent})` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text4 }}>
                    <span>Sleep: 7h 12m</span>
                    <span>HR: 62 bpm</span>
                    <span>Steps: 2,840</span>
                  </div>
                </div>
              </div>

              {/* Interactive card */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Interactive Card (hover)</p>
                <div className="rounded-xl p-5 cursor-pointer transition-colors" style={{ background: t.elevated, border: `1px solid ${t.borderActive}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.accent }} />
                    <p className="text-sm font-medium">Sprint Planning</p>
                    <span className="text-[10px] font-mono ml-auto" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>10:00</span>
                  </div>
                  <p className="text-xs" style={{ color: t.text2 }}>1 hour · Google Meet · 4 attendees</p>
                </div>
              </div>

              {/* Nested card */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Nested Elements</p>
                <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <p className="text-sm font-medium mb-3">Tasks</p>
                  <div className="space-y-1.5">
                    {['Review PR #42', 'Update deployment docs', 'Fix auth redirect'].map((task, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: i === 1 ? t.elevated : 'transparent' }}>
                        <div className="w-4 h-4 rounded border flex items-center justify-center" style={{ borderColor: i === 0 ? t.success : t.border }}>
                          {i === 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                        <span className={`text-sm ${i === 0 ? 'line-through' : ''}`} style={{ color: i === 0 ? t.text3 : t.text1 }}>{task}</span>
                        {i === 2 && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: t.danger }}>overdue</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ FORMS & INPUTS ═══ */}
        {section === 'forms' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Forms & Inputs</p>
              <h2 className="text-2xl font-semibold mb-2">User Input</h2>
              <p style={{ color: t.text2 }}>Clean, minimal inputs. Blue focus ring. Elevated background on focus.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Text inputs */}
              <div className="space-y-4">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Text Inputs</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text2 }}>Task name</label>
                    <input type="text" value="Review PR #42" readOnly className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: t.elevated, border: `1px solid ${t.border}`, color: t.text1 }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text2 }}>Focused</label>
                    <input type="text" placeholder="Enter task name..." readOnly className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: t.elevated, border: `1px solid ${t.borderActive}`, color: t.text1, boxShadow: '0 0 0 2px rgba(37,99,235,0.1)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text3 }}>Disabled</label>
                    <input type="text" value="Read only value" readOnly className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-not-allowed opacity-50" style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text3 }} />
                  </div>
                </div>
              </div>

              {/* Select & toggle */}
              <div className="space-y-4">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Controls</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text2 }}>Select</label>
                    <div className="w-full px-3 py-2.5 rounded-lg text-sm flex items-center justify-between" style={{ background: t.elevated, border: `1px solid ${t.border}`, color: t.text1 }}>
                      <span>High priority</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text2 }}>Toggle</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setToggleOn(!toggleOn)} className="relative w-10 h-6 rounded-full transition-colors" style={{ background: toggleOn ? t.accent : t.elevated }}>
                        <div className="absolute w-4 h-4 rounded-full bg-white top-1 transition-transform" style={{ left: toggleOn ? '22px' : '4px' }} />
                      </button>
                      <span className="text-sm" style={{ color: t.text2 }}>{toggleOn ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: t.text2 }}>Textarea</label>
                    <textarea readOnly rows={3} placeholder="Add notes..." className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: t.elevated, border: `1px solid ${t.border}`, color: t.text1 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BADGES & STATUS ═══ */}
        {section === 'badges-status' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Badges & Status</p>
              <h2 className="text-2xl font-semibold mb-2">Visual Indicators</h2>
              <p style={{ color: t.text2 }}>Small, contextual signals. Semantic colors for meaning, neon green for life.</p>
            </div>

            {/* Status dots */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Status Dots</p>
              <div className="flex flex-wrap gap-6 p-5 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                {[
                  { label: 'Online', color: t.neon, glow: true, big: true },
                  { label: 'Healthy', color: t.success, glow: false },
                  { label: 'Aging', color: t.warn, glow: false },
                  { label: 'Neglected', color: t.danger, glow: false },
                  { label: 'Inactive', color: t.text4, glow: false, big: false },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="relative">
                      <div className={`rounded-full ${(s as {big?: boolean}).big ? 'w-2.5 h-2.5' : 'w-2 h-2'}`} style={{ background: s.color, boxShadow: s.glow ? `0 0 8px ${s.color}, 0 0 16px rgba(57,255,20,0.3)` : 'none' }} />
                      {s.glow && <div className="absolute inset-0 rounded-full animate-ping" style={{ background: s.color, opacity: 0.25 }} />}
                    </div>
                    <span className="text-xs" style={{ color: s.glow ? s.color : t.text2, fontWeight: s.glow ? 500 : 400 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Badges</p>
              <div className="flex flex-wrap gap-3 p-5 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: t.accentMuted, color: t.accent }}>3 meetings</span>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(52,211,153,0.1)', color: t.success }}>8 healthy</span>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.1)', color: t.warn }}>1 aging</span>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(248,113,113,0.1)', color: t.danger }}>2 overdue</span>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(57,255,20,0.12)', color: t.neon, border: '1px solid rgba(57,255,20,0.25)', boxShadow: '0 0 8px rgba(57,255,20,0.15)' }}>LIVE</span>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: t.elevated, color: t.text3 }}>v2.0.0</span>
              </div>
            </div>

            {/* Domain health strip */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Domain Health Strip</p>
              <div className="p-5 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { name: 'Work', color: t.success }, { name: 'Wealth', color: t.success }, { name: 'Side Projects', color: t.warn },
                    { name: 'Health', color: t.success }, { name: 'Fitness', color: t.success }, { name: 'Spiritual', color: t.danger },
                    { name: 'Family', color: t.success }, { name: 'Learning', color: t.success }, { name: 'Networking', color: t.warn },
                    { name: 'Branding', color: t.success },
                  ].map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: t.elevated }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-[11px]" style={{ color: t.text2 }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Toast notifications */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Toasts</p>
              <div className="space-y-2 max-w-sm">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.success }} />
                  <span className="text-sm" style={{ color: t.text2 }}>Briefing generated.</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: t.surface, border: '1px solid rgba(248,113,113,0.2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.danger }} />
                  <span className="text-sm" style={{ color: t.text2 }}>Sync failed. Retry in 30s.</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.neonMuted}` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.neon, boxShadow: `0 0 4px ${t.neon}` }} />
                  <span className="text-sm" style={{ color: t.text2 }}>Garmin data synced.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATA DISPLAY ═══ */}
        {section === 'data-display' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Data Display</p>
              <h2 className="text-2xl font-semibold mb-2">Numbers & Tables</h2>
              <p style={{ color: t.text2 }}>JetBrains Mono for all data. Clean tables with row hover. Sparklines for trends.</p>
            </div>

            {/* KPI row */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>KPI Row</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Sleep Score', value: '82', unit: 'pts', trend: '+5', trendColor: t.success, meaning: 'Good — well rested' },
                  { label: 'Body Battery', value: '71', unit: '%', trend: '-8', trendColor: t.danger, meaning: 'Moderate — go easy today' },
                  { label: 'Resting HR', value: '62', unit: 'bpm', trend: '-2', trendColor: t.success, meaning: 'Normal — healthy range' },
                  { label: 'Steps', value: '2,840', unit: '', trend: '', trendColor: '', meaning: '28% of 10k goal' },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <p className="text-[11px] mb-2" style={{ color: t.text3 }}>{k.label}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</span>
                      {k.unit && <span className="text-[10px]" style={{ color: t.text4 }}>{k.unit}</span>}
                    </div>
                    {k.trend && <span className="text-[10px] font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: k.trendColor }}>{k.trend}</span>}
                    <p className="text-[10px] mt-1" style={{ color: t.text3 }}>{k.meaning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Simple table */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Table</p>
              <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <th className="text-left px-5 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: t.text3 }}>Integration</th>
                      <th className="text-left px-5 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: t.text3 }}>Status</th>
                      <th className="text-right px-5 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: t.text3 }}>Last Sync</th>
                      <th className="text-right px-5 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: t.text3 }}>API Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Google Calendar', status: 'connected', sync: '2m ago', calls: '142' },
                      { name: 'Garmin Connect', status: 'syncing', sync: 'now', calls: '89' },
                      { name: 'Gmail', status: 'connected', sync: '5m ago', calls: '67' },
                      { name: 'ClickUp', status: 'error', sync: '1h ago', calls: '23' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < 3 ? `1px solid ${t.border}` : 'none' }}>
                        <td className="px-5 py-3" style={{ color: t.text1 }}>{row.name}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{
                              background: row.status === 'connected' ? t.neon : row.status === 'syncing' ? t.accent : t.danger,
                              boxShadow: row.status === 'connected' ? `0 0 4px ${t.neon}` : row.status === 'syncing' ? `0 0 4px ${t.accent}` : 'none',
                            }} />
                            <span className="text-xs" style={{ color: row.status === 'error' ? t.danger : t.text2 }}>{row.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>{row.sync}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>{row.calls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Progress Bars</p>
              <div className="rounded-xl p-5 space-y-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                {[
                  { label: 'OKR: Ship v2.0', pct: 35, color: t.accent },
                  { label: 'Weekly training', pct: 80, color: t.success },
                  { label: 'Reading goal', pct: 12, color: t.danger },
                ].map((p) => (
                  <div key={p.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs" style={{ color: t.text2 }}>{p.label}</span>
                      <span className="text-[10px] font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: p.color }}>{p.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.elevated }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ NAVIGATION ═══ */}
        {section === 'navigation' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Navigation</p>
              <h2 className="text-2xl font-semibold mb-2">Wayfinding</h2>
              <p style={{ color: t.text2 }}>Sidebar nav, tabs, and breadcrumbs. Active states use blue accent + elevated background.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sidebar nav */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Sidebar Navigation</p>
                <div className="rounded-xl p-3 w-56" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  {[
                    { label: 'Dashboard', active: true },
                    { label: 'Health & Fitness', active: false },
                    { label: 'Utilities', active: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5" style={{
                      background: item.active ? t.elevated : 'transparent',
                      color: item.active ? t.text1 : t.text3,
                    }}>
                      {item.active && <div className="w-0.5 h-4 rounded-full" style={{ background: t.accent }} />}
                      <span className="text-[13px] font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="space-y-3">
                <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Tabs</p>
                <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: t.bg }}>
                    {['Overview', 'Details', 'History'].map((tab, i) => (
                      <button key={tab} onClick={() => setSelectedTab(i)}
                        className="flex-1 py-2 rounded-md text-xs font-medium transition-colors"
                        style={{
                          background: selectedTab === i ? t.elevated : 'transparent',
                          color: selectedTab === i ? t.text1 : t.text3,
                          border: selectedTab === i ? `1px solid ${t.border}` : '1px solid transparent',
                        }}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm" style={{ color: t.text2 }}>
                    {selectedTab === 0 && 'Overview tab content — summary view.'}
                    {selectedTab === 1 && 'Details tab content — detailed breakdown.'}
                    {selectedTab === 2 && 'History tab content — past entries.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Accordion */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Accordion / Collapsible</p>
              <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                {[
                  { title: 'Work & Productivity', content: 'Sprint 8 planning complete. 3 PRs merged today. Focus time scheduled 14:00–16:00.' },
                  { title: 'Health & Fitness', content: 'Body battery recovering. Recommend Zone 2 cardio today. Protein intake on track.' },
                  { title: 'Personal Growth', content: 'Reading streak: 12 days. Networking event Thursday. Blog post draft pending review.' },
                ].map((item, i) => (
                  <div key={i} style={{ borderBottom: i < 2 ? `1px solid ${t.border}` : 'none' }}>
                    <button onClick={() => setExpandedAccordion(expandedAccordion === i ? null : i)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-left">
                      <span className="text-sm font-medium">{item.title}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="2"
                        style={{ transform: expandedAccordion === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {expandedAccordion === i && (
                      <div className="px-5 pb-4 text-sm" style={{ color: t.text2 }}>{item.content}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PATTERNS ═══ */}
        {section === 'patterns' && (
          <div className="space-y-10">
            <div>
              <p className="text-sm tracking-wider uppercase mb-4" style={{ color: t.accent }}>Patterns</p>
              <h2 className="text-2xl font-semibold mb-2">Composite Patterns</h2>
              <p style={{ color: t.text2 }}>Common layouts and component combinations as they appear in JARVIS.</p>
            </div>

            {/* TopBar pattern */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>TopBar</p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(15,23,41,0.9)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${t.border}` }}>
                  <div className="flex items-center gap-3">
                    <Reactor size={24} />
                    <span className="text-sm font-semibold tracking-widest">JARVIS</span>
                    <span className="text-[10px]" style={{ color: t.text4 }}>v2.0.0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)' }}>
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.neon, boxShadow: `0 0 6px ${t.neon}, 0 0 14px rgba(57,255,20,0.3)` }} />
                      </div>
                      <span className="text-[10px] font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.neon }}>All systems</span>
                    </div>
                    <span className="text-xs font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>14:32 WIB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty state */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Empty State</p>
              <div className="rounded-xl p-12 text-center" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="flex justify-center mb-4">
                  <Reactor size={48} />
                </div>
                <p className="text-sm font-medium mb-1">No briefing yet</p>
                <p className="text-xs mb-4" style={{ color: t.text3 }}>Generate one or check back after 07:30.</p>
                <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: t.accent, color: 'white' }}>Generate Briefing</button>
              </div>
            </div>

            {/* Loading skeleton */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Loading Skeleton</p>
              <div className="rounded-xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="space-y-3">
                  <div className="h-4 w-32 rounded" style={{ background: t.elevated }} />
                  <div className="h-3 w-full rounded" style={{ background: t.elevated, opacity: 0.7 }} />
                  <div className="h-3 w-4/5 rounded" style={{ background: t.elevated, opacity: 0.5 }} />
                  <div className="h-3 w-3/5 rounded" style={{ background: t.elevated, opacity: 0.3 }} />
                </div>
              </div>
            </div>

            {/* Full dashboard card mock */}
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase" style={{ color: t.text3 }}>Dashboard Composition</p>
              <div className="rounded-2xl p-6" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
                {/* Greeting */}
                <div className="flex items-center gap-3 mb-6">
                  <Reactor size={32} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Good morning, Filman</p>
                    <p className="text-xs" style={{ color: t.text4 }}>Friday, 20 March 2026</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.neon, boxShadow: `0 0 4px ${t.neon}` }} />
                    <span className="text-[10px] font-mono" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.neon }}>ONLINE</span>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { l: 'Sleep', v: '82', c: t.success, m: 'Good' },
                    { l: 'Battery', v: '71%', c: t.warn, m: 'Moderate' },
                    { l: 'Tasks', v: '6/9', c: t.accent, m: '3 left' },
                    { l: 'Meetings', v: '3', c: t.text2, m: 'today' },
                  ].map((k) => (
                    <div key={k.l} className="rounded-lg p-3" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                      <p className="text-[10px]" style={{ color: t.text3 }}>{k.l}</p>
                      <p className="text-lg font-mono font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: k.c }}>{k.v}</p>
                      <p className="text-[9px]" style={{ color: t.text4 }}>{k.m}</p>
                    </div>
                  ))}
                </div>

                {/* Briefing + Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium">Briefing</p>
                      <button className="text-[10px]" style={{ color: t.accent }}>Listen</button>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: t.text2 }}>Good morning. Sleep score is 82, body battery 71%. 3 meetings today...</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <p className="text-xs font-medium mb-3">Schedule</p>
                    <div className="space-y-1.5">
                      {[
                        { time: '09:00', title: 'Standup' },
                        { time: '10:00', title: 'Sprint Planning' },
                        { time: '14:00', title: 'Design Review' },
                      ].map((e) => (
                        <div key={e.time} className="flex items-center gap-2 text-xs">
                          <span className="font-mono w-10" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text4 }}>{e.time}</span>
                          <span style={{ color: t.text2 }}>{e.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
