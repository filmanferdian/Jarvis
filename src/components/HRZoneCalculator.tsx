'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Cell,
} from 'recharts';

interface HRDefaults {
  age: number;
  restingHR: number;
  lthr: number;
  maxHR: number;
  maxHrSource: 'measured' | 'formula';
}

type Category = 'formula' | 'lthr' | 'expert';

interface ZoneMethod {
  name: string;
  short: string;
  low: number;
  high: number;
  expert: string;
  rationale: string;
  category: Category;
  color: string;
}

type ZoneMode = 'z2' | 'z5';
type ConsensusRule = 'median' | 'strict';

const CATEGORY_LABEL: Record<Category, string> = {
  formula: 'Formulas',
  lthr: 'LTHR-based',
  expert: 'Experts',
};

const CATEGORY_ORDER: Category[] = ['formula', 'lthr', 'expert'];

function clampHigh(value: number, max: number): number {
  return Math.min(value, max);
}

function computeZones(age: number, rhr: number, lthr: number, maxHR: number, mode: ZoneMode): ZoneMethod[] {
  const hrr = maxHR - rhr;

  if (mode === 'z5') {
    const rows: ZoneMethod[] = [
      {
        name: 'Age-based',
        short: 'Age',
        low: Math.round(maxHR * 0.90),
        high: maxHR,
        expert: 'Traditional (90-100% maxHR)',
        rationale: 'Standard 90-100% of max HR. Easy to compute but ignores individual physiology.',
        category: 'formula',
        color: '#6b7280',
      },
      {
        name: 'Karvonen',
        short: 'Karvonen',
        low: Math.round(hrr * 0.90 + rhr),
        high: Math.round(hrr * 1.00 + rhr),
        expert: 'HRR method (90-100%)',
        rationale: 'Heart Rate Reserve accounts for resting HR variation between individuals.',
        category: 'formula',
        color: '#3b82f6',
      },
      {
        name: 'LTHR-Friel',
        short: 'Friel',
        low: clampHigh(Math.round(lthr * 1.06), maxHR),
        high: clampHigh(Math.round(lthr * 1.10), maxHR),
        expert: 'Friel Z5 (≥106% LTHR)',
        rationale: 'Joe Friel anchors Z5 above lactate threshold HR. Sensitive to LTHR accuracy.',
        category: 'lthr',
        color: '#8b5cf6',
      },
      {
        name: 'Coggan',
        short: 'Coggan',
        low: clampHigh(Math.round(lthr * 1.10), maxHR),
        high: maxHR,
        expert: 'Coggan VO2 (110%+ LTHR)',
        rationale: 'Andy Coggan VO2 zone: above 110% LTHR up to max. Hidden when LTHR is too high.',
        category: 'lthr',
        color: '#ec4899',
      },
      {
        name: 'Attia',
        short: 'Attia',
        low: Math.round(maxHR * 0.90),
        high: maxHR,
        expert: 'Peter Attia (90-100% max)',
        rationale: 'VO2 max for longevity; cites San Millán methodology.',
        category: 'expert',
        color: '#ef4444',
      },
      {
        name: 'Galpin Red',
        short: 'Galpin',
        low: Math.round(maxHR * 0.90),
        high: maxHR,
        expert: 'Galpin Red (90-100% peak)',
        rationale: "Galpin's color framework: Red = maximal effort, 90-100% peak HR.",
        category: 'expert',
        color: '#10b981',
      },
      {
        name: 'San Millán',
        short: 'San Millán',
        low: Math.round(maxHR * 0.95),
        high: maxHR,
        expert: 'San Millán 4×4 (~95% max)',
        rationale: '4-minute intervals at highest sustained intensity; HR drifts to ~95% by interval 2-4.',
        category: 'expert',
        color: '#f97316',
      },
      {
        name: 'Lyon',
        short: 'Lyon',
        low: Math.round(maxHR * 0.85),
        high: Math.round(maxHR * 0.95),
        expert: 'Lyon VO2 max (85-95% max)',
        rationale: 'VO2 max band for "raise the ceiling" work; RPE 10. Lower floor than other experts.',
        category: 'expert',
        color: '#14b8a6',
      },
      {
        name: 'Patrick',
        short: 'Patrick',
        low: Math.round(maxHR * 0.95),
        high: maxHR,
        expert: 'Patrick (≥95% max)',
        rationale: 'Near-maximal Z5 per her co-authored guide; ≥1 HIIT/week.',
        category: 'expert',
        color: '#d946ef',
      },
      {
        name: 'Huberman',
        short: 'Huberman',
        low: Math.round(maxHR * 0.80),
        high: maxHR,
        expert: 'Huberman (80-100% max)',
        rationale: 'Foundational Fitness Protocol: 30+ min/week in top 10% of HR.',
        category: 'expert',
        color: '#06b6d4',
      },
    ];
    return rows.filter(r => r.low < r.high);
  }

  // Z2 mode
  const rows: ZoneMethod[] = [
    {
      name: 'Age-based',
      short: 'Age',
      low: Math.round(maxHR * 0.60),
      high: Math.round(maxHR * 0.70),
      expert: 'Traditional (60-70% maxHR)',
      rationale: '220-age max with 60-70% band. Simple but ignores individual physiology.',
      category: 'formula',
      color: '#6b7280',
    },
    {
      name: 'Karvonen',
      short: 'Karvonen',
      low: Math.round(hrr * 0.60 + rhr),
      high: Math.round(hrr * 0.70 + rhr),
      expert: 'HRR method (60-70%)',
      rationale: 'Heart Rate Reserve accounts for resting HR variation between individuals.',
      category: 'formula',
      color: '#3b82f6',
    },
    {
      name: 'MAF',
      short: 'MAF',
      low: 180 - age - 10,
      high: 180 - age,
      expert: 'Maffetone (180-age)',
      rationale: 'Conservative aerobic ceiling; popular in endurance world (Nick Bare uses this).',
      category: 'formula',
      color: '#f59e0b',
    },
    {
      name: 'LTHR-Friel',
      short: 'Friel',
      low: clampHigh(Math.round(lthr * 0.85), maxHR),
      high: clampHigh(Math.round(lthr * 0.89), maxHR),
      expert: 'Friel Z2 (85-89% LTHR)',
      rationale: 'LTHR-anchored Z2; closer to true LT1 for experienced athletes.',
      category: 'lthr',
      color: '#8b5cf6',
    },
    {
      name: 'Attia',
      short: 'Attia',
      low: Math.round(maxHR * 0.70),
      high: Math.round(maxHR * 0.80),
      expert: 'Peter Attia (70-80% max)',
      rationale: 'Cites San Millán methodology; "costly conversation" RPE.',
      category: 'expert',
      color: '#ef4444',
    },
    {
      name: 'Galpin Blue',
      short: 'Galpin',
      low: Math.round(maxHR * 0.60),
      high: Math.round(maxHR * 0.80),
      expert: 'Galpin Blue (60-80% peak)',
      rationale: "Galpin's color framework: Blue = easy aerobic, broad 60-80% band.",
      category: 'expert',
      color: '#10b981',
    },
    {
      name: 'San Millán',
      short: 'San Millán',
      low: Math.round(maxHR * 0.70),
      high: Math.round(maxHR * 0.80),
      expert: 'San Millán (70-80% max)',
      rationale: 'Lactate 1.7-1.9 mmol/L; "costly conversation" talk test. Original Z2 source.',
      category: 'expert',
      color: '#f97316',
    },
    {
      name: 'Lyon',
      short: 'Lyon',
      low: Math.round(maxHR * 0.60),
      high: Math.round(maxHR * 0.65),
      expert: 'Lyon (60-65% max)',
      rationale: 'Conversational pace; muscle-first framing with cardio layered on.',
      category: 'expert',
      color: '#14b8a6',
    },
    {
      name: 'Patrick',
      short: 'Patrick',
      low: Math.round(maxHR * 0.70),
      high: Math.round(maxHR * 0.80),
      expert: 'Patrick (70-80% max)',
      rationale: '80/20 split with HIIT; cites Levine/Gibala. Talk test for confirmation.',
      category: 'expert',
      color: '#d946ef',
    },
    {
      name: 'Huberman',
      short: 'Huberman',
      low: Math.round(maxHR * 0.55),
      high: Math.round(maxHR * 0.70),
      expert: 'Huberman (55-70% max)',
      rationale: 'Foundational Fitness Protocol; "just barely have a conversation."',
      category: 'expert',
      color: '#06b6d4',
    },
  ];
  return rows.filter(r => r.low < r.high);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function computeConsensus(zones: ZoneMethod[], rule: ConsensusRule, mode: ZoneMode): { min: number; max: number } {
  if (rule === 'median') {
    return {
      min: median(zones.map(z => z.low)),
      max: median(zones.map(z => z.high)),
    };
  }
  if (mode === 'z5') {
    return {
      min: Math.min(...zones.map(z => z.low)),
      max: Math.max(...zones.map(z => z.low)),
    };
  }
  return {
    min: Math.max(...zones.map(z => z.low)),
    max: Math.max(...zones.map(z => z.high)),
  };
}

function InputField({ label, value, onChange, onCommit, suffix, badge }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  suffix?: string;
  badge?: { text: string; tone: 'measured' | 'formula' };
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="block text-[11px] text-jarvis-text-dim uppercase tracking-wider">{label}</label>
        {badge && (
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
            style={{
              background: badge.tone === 'measured' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              color: badge.tone === 'measured' ? '#22c55e' : '#f59e0b',
            }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={(e) => onCommit?.(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-20 px-2 py-1.5 rounded-md bg-jarvis-bg-main border border-jarvis-border text-jarvis-text-primary text-[13px] font-mono focus:outline-none focus:border-jarvis-accent"
        />
        {suffix && <span className="text-[11px] text-jarvis-text-dim">{suffix}</span>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; low: number; high: number; expert: string; rationale: string; category: Category } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-jarvis-border bg-jarvis-bg-card px-3 py-2 shadow-lg max-w-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[12px] font-medium text-jarvis-text-primary">{d.name}</p>
        <span className="text-[9px] uppercase tracking-wider text-jarvis-text-dim">{CATEGORY_LABEL[d.category]}</span>
      </div>
      <p className="text-[12px] text-jarvis-text-muted font-mono">{d.low} – {d.high} bpm</p>
      <p className="text-[11px] text-jarvis-text-dim mt-0.5">{d.expert}</p>
      <p className="text-[11px] text-jarvis-text-faint mt-1 leading-snug">{d.rationale}</p>
    </div>
  );
}

export default function HRZoneCalculator() {
  const [age, setAge] = useState(35);
  const [rhr, setRhr] = useState(52);
  const [lthr, setLthr] = useState(164);
  const [maxHR, setMaxHR] = useState(185);
  const [maxHrSource, setMaxHrSource] = useState<'measured' | 'formula'>('formula');
  const [savingMaxHr, setSavingMaxHr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<ZoneMode>('z2');
  const [rule, setRule] = useState<ConsensusRule>('median');

  useEffect(() => {
    fetchAuth<HRDefaults>('/api/cardio/hr-zones')
      .then((d) => {
        setAge(d.age);
        setRhr(d.restingHR);
        setLthr(d.lthr);
        setMaxHR(d.maxHR);
        setMaxHrSource(d.maxHrSource);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function persistMaxHr(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    if (maxHrSource === 'measured' && value === maxHR) return;
    if (maxHrSource === 'formula' && value === 220 - age) return;
    setSavingMaxHr(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/health/measurements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement_type: 'max_hr',
          value,
          date: today,
          source: 'manual',
        }),
      });
      if (res.ok) setMaxHrSource('measured');
    } catch {
      // Best-effort persistence; UI value still reflects the user's input.
    } finally {
      setSavingMaxHr(false);
    }
  }

  const zones = useMemo(() => {
    const all = computeZones(age, rhr, lthr, maxHR, mode);
    return all.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  }, [age, rhr, lthr, maxHR, mode]);

  const chartData = useMemo(() =>
    zones.map((z) => ({
      name: z.short,
      fullName: z.name,
      low: z.low,
      high: z.high,
      range: z.high - z.low,
      expert: z.expert,
      rationale: z.rationale,
      category: z.category,
      color: z.color,
    })),
    [zones],
  );

  const medianConsensus = useMemo(() => computeConsensus(zones, 'median', mode), [zones, mode]);
  const strictConsensus = useMemo(() => computeConsensus(zones, 'strict', mode), [zones, mode]);
  const activeConsensus = rule === 'median' ? medianConsensus : strictConsensus;
  const inactiveConsensus = rule === 'median' ? strictConsensus : medianConsensus;

  const yDomain = useMemo<[number, number]>(() => {
    if (zones.length === 0) return mode === 'z5' ? [150, 200] : [90, 170];
    const lows = zones.map(z => z.low);
    const highs = zones.map(z => z.high);
    const dataMin = Math.min(...lows);
    const dataMax = Math.max(...highs);
    return [Math.max(0, dataMin - 5), dataMax + 5];
  }, [zones, mode]);

  const zonesByCategory = useMemo(() => {
    const grouped: Record<Category, ZoneMethod[]> = { formula: [], lthr: [], expert: [] };
    for (const z of zones) grouped[z.category].push(z);
    return grouped;
  }, [zones]);

  if (!loaded) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
        <div className="h-4 w-48 bg-jarvis-border rounded animate-pulse" />
      </div>
    );
  }

  const ruleHint = rule === 'median'
    ? `Median of ${zones.length} methods (robust to outliers).`
    : mode === 'z5'
      ? 'Spread of Z5 entry floors across methods.'
      : 'Highest floor and highest ceiling across methods (strictest read).';

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            HR Zone {mode === 'z5' ? '5' : '2'} Calculator
          </h2>
          <p className="text-[12px] text-jarvis-text-dim mt-1">
            {mode === 'z5'
              ? 'Zone 5 (VO2 max) ranges across formulas + experts.'
              : 'Zone 2 ranges across formulas + experts.'}{' '}
            <span className="text-jarvis-text-faint">Hover a bar for the source rationale.</span>
          </p>
        </div>
        <div className="flex items-center rounded-md border border-jarvis-border bg-jarvis-bg-main p-0.5 flex-shrink-0">
          {(['z2', 'z5'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                mode === m
                  ? 'bg-jarvis-accent text-white'
                  : 'text-jarvis-text-dim hover:text-jarvis-text-primary'
              }`}
            >
              {m === 'z2' ? 'Zone 2' : 'Zone 5'}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-4">
        <InputField
          label="Age"
          value={age}
          onChange={(v) => {
            setAge(v);
            if (maxHrSource === 'formula') setMaxHR(220 - v);
          }}
          suffix="yrs"
        />
        <InputField label="Resting HR" value={rhr} onChange={setRhr} suffix="bpm" />
        <InputField label="LTHR" value={lthr} onChange={setLthr} suffix="bpm" />
        <InputField
          label="Max HR"
          value={maxHR}
          onChange={setMaxHR}
          onCommit={persistMaxHr}
          suffix={savingMaxHr ? 'saving…' : 'bpm'}
          badge={{
            text: maxHrSource === 'measured' ? 'measured' : 'formula',
            tone: maxHrSource,
          }}
        />
      </div>
      {maxHrSource === 'formula' && (
        <p className="text-[11px] text-jarvis-text-faint -mt-2">
          Max HR is using the age-based 220 − age estimate. Enter a tested max from a race or Garmin lab test to tighten every method.
        </p>
      )}

      {/* Chart */}
      <div className="w-full" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 60, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              label={{ value: 'bpm', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Active (selected rule) consensus band — filled */}
            <ReferenceArea
              y1={activeConsensus.min}
              y2={activeConsensus.max}
              fill={rule === 'median' ? '#3b82f6' : '#f59e0b'}
              fillOpacity={0.1}
              strokeOpacity={0}
            />

            {/* Inactive rule — dashed outline only */}
            <ReferenceLine
              y={inactiveConsensus.min}
              stroke={rule === 'median' ? '#f59e0b' : '#3b82f6'}
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            <ReferenceLine
              y={inactiveConsensus.max}
              stroke={rule === 'median' ? '#f59e0b' : '#3b82f6'}
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              strokeWidth={1}
            />

            {/* Active min/max */}
            <ReferenceLine
              y={activeConsensus.min}
              stroke="#22c55e"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `${activeConsensus.min}`,
                position: 'right',
                fill: '#22c55e',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <ReferenceLine
              y={activeConsensus.max}
              stroke="#ef4444"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `${activeConsensus.max}`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
              }}
            />

            {/* Stacked bars: invisible base + visible range */}
            <Bar dataKey="low" stackId="zone" fill="transparent" />
            <Bar dataKey="range" stackId="zone" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend grouped by category */}
      <div className="space-y-2">
        {CATEGORY_ORDER.filter(cat => zonesByCategory[cat].length > 0).map(cat => (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-wider text-jarvis-text-dim mb-1.5">
              {CATEGORY_LABEL[cat]}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {zonesByCategory[cat].map((z) => (
                <div key={z.name} className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: z.color }} />
                  <div>
                    <p className="text-[12px] text-jarvis-text-secondary font-medium">
                      {z.name}: <span className="font-mono">{z.low}–{z.high}</span>
                    </p>
                    <p className="text-[11px] text-jarvis-text-dim">{z.expert}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Consensus block with rule toggle */}
      <div className="rounded-lg bg-jarvis-bg-main border border-jarvis-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12px] text-jarvis-text-secondary">
            <span className="font-medium text-jarvis-text-primary">Target Zone {mode === 'z5' ? '5' : '2'}:</span>{' '}
            <span className="font-mono text-jarvis-text-primary">{activeConsensus.min}–{activeConsensus.max} bpm</span>
          </p>
          <div className="flex items-center rounded-md border border-jarvis-border bg-jarvis-bg-card p-0.5">
            {(['median', 'strict'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRule(r)}
                className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded transition-colors ${
                  rule === r
                    ? 'bg-jarvis-accent text-white'
                    : 'text-jarvis-text-dim hover:text-jarvis-text-primary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-jarvis-text-faint">
          {ruleHint} Dashed faint lines show the {rule === 'median' ? 'strict' : 'median'} band for reference.
        </p>
      </div>
    </div>
  );
}
