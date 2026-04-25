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

interface ZoneMethod {
  name: string;
  short: string;
  low: number;
  high: number;
  expert: string;
  color: string;
}

type ZoneMode = 'z2' | 'z5';

function computeZones(age: number, rhr: number, lthr: number, maxHR: number, mode: ZoneMode): ZoneMethod[] {
  if (mode === 'z5') {
    return [
      {
        name: 'Age-based',
        short: 'Age',
        low: Math.round(maxHR * 0.90),
        high: Math.round(maxHR * 1.00),
        expert: 'Traditional (90-100% maxHR)',
        color: '#6b7280',
      },
      {
        name: 'Karvonen',
        short: 'Karvonen',
        low: Math.round((maxHR - rhr) * 0.90 + rhr),
        high: Math.round((maxHR - rhr) * 1.00 + rhr),
        expert: 'HRR method (90-100%)',
        color: '#3b82f6',
      },
      {
        name: 'LTHR-based',
        short: 'LTHR',
        low: Math.round(lthr * 1.06),
        high: Math.round(lthr * 1.10),
        expert: 'Friel Z5 (≥106% LTHR)',
        color: '#8b5cf6',
      },
      {
        name: 'Attia',
        short: 'Attia',
        low: Math.round(maxHR * 0.90),
        high: Math.round(maxHR * 1.00),
        expert: 'Peter Attia (90-100% actual max)',
        color: '#ef4444',
      },
      {
        name: 'Coggan Z5',
        short: 'Coggan',
        low: Math.round(lthr * 1.10),
        high: maxHR,
        expert: 'Coggan VO2 (110%+ LTHR)',
        color: '#ec4899',
      },
      {
        name: 'Galpin Red',
        short: 'Galpin',
        low: Math.round(maxHR * 0.90),
        high: Math.round(maxHR * 1.00),
        expert: 'Andy Galpin (90-100% peak)',
        color: '#10b981',
      },
    ];
  }
  return [
    {
      name: 'Age-based',
      short: 'Age',
      low: Math.round(maxHR * 0.60),
      high: Math.round(maxHR * 0.70),
      expert: 'Traditional (220-age)',
      color: '#6b7280',
    },
    {
      name: 'Karvonen',
      short: 'Karvonen',
      low: Math.round((maxHR - rhr) * 0.60 + rhr),
      high: Math.round((maxHR - rhr) * 0.70 + rhr),
      expert: 'Heart Rate Reserve method',
      color: '#3b82f6',
    },
    {
      name: 'LTHR-based',
      short: 'LTHR',
      low: Math.round(lthr * 0.85),
      high: Math.round(lthr * 0.89),
      expert: 'Joe Friel (85-89% LTHR)',
      color: '#8b5cf6',
    },
    {
      name: 'Attia',
      short: 'Attia',
      low: Math.round(maxHR * 0.70),
      high: Math.round(maxHR * 0.80),
      expert: 'Peter Attia (70-80% actual max)',
      color: '#ef4444',
    },
    {
      name: 'Galpin Blue',
      short: 'Galpin',
      low: Math.round(maxHR * 0.60),
      high: Math.round(maxHR * 0.80),
      expert: 'Andy Galpin (60-80% HR peak)',
      color: '#10b981',
    },
    {
      name: 'MAF',
      short: 'MAF',
      low: 180 - age - 10,
      high: 180 - age,
      expert: 'Maffetone (180-age)',
      color: '#f59e0b',
    },
  ];
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

// Custom tooltip for the chart
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; low: number; high: number; expert: string } }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-jarvis-border bg-jarvis-bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-jarvis-text-primary">{d.name}</p>
      <p className="text-[12px] text-jarvis-text-muted font-mono">{d.low} – {d.high} bpm</p>
      <p className="text-[11px] text-jarvis-text-dim mt-0.5">{d.expert}</p>
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

  const zones = useMemo(() => computeZones(age, rhr, lthr, maxHR, mode), [age, rhr, lthr, maxHR, mode]);

  // Chart data: each bar shows the range from low to high
  const chartData = useMemo(() =>
    zones.map((z) => ({
      name: z.short,
      fullName: z.name,
      low: z.low,
      high: z.high,
      range: z.high - z.low,
      expert: z.expert,
      color: z.color,
    })),
    [zones],
  );

  // Consensus band:
  //  Z2 — min = highest lower bound, max = highest upper bound (keeps you from drifting too low)
  //  Z5 — min = lowest floor, max = highest floor across methods (target is the *entry* to Z5,
  //       ceilings are too close to max HR to be meaningful)
  const consensusMin = mode === 'z5'
    ? Math.min(...zones.map((z) => z.low))
    : Math.max(...zones.map((z) => z.low));
  const consensusMax = mode === 'z5'
    ? Math.max(...zones.map((z) => z.low))
    : Math.max(...zones.map((z) => z.high));

  if (!loaded) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
        <div className="h-4 w-48 bg-jarvis-border rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            HR Zone {mode === 'z5' ? '5' : '2'} Calculator
          </h2>
          <p className="text-[12px] text-jarvis-text-dim mt-1">
            {mode === 'z5'
              ? 'Zone 5 (VO2 max) ranges across expert methods. Target band = spread of Z5 floors.'
              : 'Zone 2 ranges across expert methods. Min = highest lower bound, Max = highest upper bound.'}
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
          Max HR is using the age-based 220 − age estimate. Enter a tested max from a race or Garmin lab test to tighten the Z5 consensus band.
        </p>
      )}

      {/* Chart */}
      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 60, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              domain={mode === 'z5' ? [150, 200] : [90, 170]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              label={{ value: 'bpm', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Consensus band (shaded area between min and max) */}
            <ReferenceArea
              y1={consensusMin}
              y2={consensusMax}
              fill="#3b82f6"
              fillOpacity={0.08}
              strokeOpacity={0}
            />

            {/* Min floor reference line */}
            <ReferenceLine
              y={consensusMin}
              stroke="#22c55e"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `${consensusMin} bpm`,
                position: 'right',
                fill: '#22c55e',
                fontSize: 12,
                fontWeight: 600,
              }}
            />

            {/* Max ceiling reference line */}
            <ReferenceLine
              y={consensusMax}
              stroke="#ef4444"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `${consensusMax} bpm`,
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

      {/* Legend / Expert attribution */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {zones.map((z) => (
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

      {/* Consensus summary */}
      <div className="rounded-lg bg-jarvis-bg-main border border-jarvis-border px-4 py-3">
        <p className="text-[12px] text-jarvis-text-secondary">
          <span className="font-medium text-jarvis-text-primary">Target Zone {mode === 'z5' ? '5' : '2'}:</span>{' '}
          <span className="font-mono">{consensusMin}–{consensusMax} bpm</span>{' '}
          <span className="text-jarvis-text-dim">
            {mode === 'z5'
              ? '(min = lowest Z5 floor, max = highest Z5 floor across methods)'
              : '(min = highest floor across all methods, max = highest ceiling)'}
          </span>
        </p>
      </div>
    </div>
  );
}
