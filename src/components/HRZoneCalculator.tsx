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
}

interface ZoneMethod {
  name: string;
  short: string;
  low: number;
  high: number;
  expert: string;
  color: string;
}

function computeZones(age: number, rhr: number, lthr: number, maxHR: number): ZoneMethod[] {
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

function InputField({ label, value, onChange, suffix }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] text-jarvis-text-dim uppercase tracking-wider mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAuth<HRDefaults>('/api/cardio/hr-zones')
      .then((d) => {
        setAge(d.age);
        setRhr(d.restingHR);
        setLthr(d.lthr);
        setMaxHR(d.maxHR);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const zones = useMemo(() => computeZones(age, rhr, lthr, maxHR), [age, rhr, lthr, maxHR]);

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

  // Consensus band: min floor from personalized methods (Karvonen, LTHR, Attia), max ceiling from all
  const personalizedMethods = zones.filter((z) => ['Karvonen', 'LTHR-based', 'Attia'].includes(z.name));
  const consensusMin = Math.min(...personalizedMethods.map((z) => z.low));
  const consensusMax = Math.max(...personalizedMethods.map((z) => z.high));

  if (!loaded) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
        <div className="h-4 w-48 bg-jarvis-border rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-4">
      <div>
        <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
          HR Zone 2 Calculator
        </h2>
        <p className="text-[12px] text-jarvis-text-dim mt-1">
          Zone 2 ranges across expert methods. Consensus band derived from Karvonen, LTHR, and Attia.
        </p>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-4">
        <InputField label="Age" value={age} onChange={(v) => { setAge(v); setMaxHR(220 - v); }} suffix="yrs" />
        <InputField label="Resting HR" value={rhr} onChange={setRhr} suffix="bpm" />
        <InputField label="LTHR" value={lthr} onChange={setLthr} suffix="bpm" />
        <InputField label="Max HR" value={maxHR} onChange={setMaxHR} suffix="bpm" />
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              domain={[90, 170]}
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
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Min ${consensusMin}`,
                position: 'right',
                fill: '#22c55e',
                fontSize: 10,
              }}
            />

            {/* Max ceiling reference line */}
            <ReferenceLine
              y={consensusMax}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Max ${consensusMax}`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 10,
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
          <span className="font-medium text-jarvis-text-primary">Expert Consensus Zone 2:</span>{' '}
          <span className="font-mono">{consensusMin}–{consensusMax} bpm</span>{' '}
          <span className="text-jarvis-text-dim">
            (derived from Karvonen, LTHR, and Attia methods)
          </span>
        </p>
      </div>
    </div>
  );
}
