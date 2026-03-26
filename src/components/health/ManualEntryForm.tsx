'use client';

import { useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';

const MEASUREMENT_TYPES = [
  { value: 'waist_circumference', label: 'Waist (cm)' },
  { value: 'body_fat', label: 'Body Fat (%)' },
  { value: 'dead_hang_seconds', label: 'Dead Hang (seconds)' },
  { value: 'overhead_squat_compensations', label: 'Overhead Squat (compensations)' },
  { value: 'blood_pressure_systolic', label: 'BP Systolic (mmHg)' },
  { value: 'blood_pressure_diastolic', label: 'BP Diastolic (mmHg)' },
  { value: 'lean_body_mass', label: 'Lean Body Mass (kg)' },
  { value: 'run_10k_seconds', label: '10k Run Time (seconds)' },
];

const BLOOD_MARKERS = [
  { value: 'hba1c', label: 'HbA1c', unit: '%', refLow: 4.0, refHigh: 5.6 },
  { value: 'fasting_glucose', label: 'Fasting Glucose', unit: 'mg/dL', refLow: 70, refHigh: 100 },
  { value: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: 0, refHigh: 150 },
  { value: 'hdl', label: 'HDL Cholesterol', unit: 'mg/dL', refLow: 40, refHigh: 999 },
  { value: 'testosterone', label: 'Testosterone', unit: 'ng/dL', refLow: 300, refHigh: 1000 },
];

type Tab = 'measurement' | 'bloodwork';

export default function ManualEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [tab, setTab] = useState<Tab>('measurement');
  const [type, setType] = useState(MEASUREMENT_TYPES[0].value);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Blood work state
  const [bwMarker, setBwMarker] = useState(BLOOD_MARKERS[0].value);
  const [bwValue, setBwValue] = useState('');
  const [bwDate, setBwDate] = useState(() => {
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return wib.toISOString().split('T')[0];
  });
  const [bwLab, setBwLab] = useState('');

  async function handleMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;

    setSaving(true);
    setMessage(null);
    try {
      await fetchAuth('/api/health/measurements');
      const res = await fetch('/api/health/measurements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurement_type: type, value: parseFloat(value), source: 'manual' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setMessage('Saved!');
      setValue('');
      onSaved?.();
    } catch (err) {
      setMessage(`Error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleBloodWork(e: React.FormEvent) {
    e.preventDefault();
    if (!bwValue) return;

    const markerDef = BLOOD_MARKERS.find((m) => m.value === bwMarker)!;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/health/blood-work', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_date: bwDate,
          lab_name: bwLab || undefined,
          markers: [{
            name: bwMarker,
            value: parseFloat(bwValue),
            unit: markerDef.unit,
            reference_low: markerDef.refLow,
            reference_high: markerDef.refHigh,
          }],
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setMessage('Saved!');
      setBwValue('');
      onSaved?.();
    } catch (err) {
      setMessage(`Error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-jarvis-text-primary">Manual Entry</h3>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => { setTab('measurement'); setMessage(null); }}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${tab === 'measurement' ? 'bg-jarvis-accent text-jarvis-bg' : 'bg-jarvis-border text-jarvis-text-dim hover:text-jarvis-text-secondary'}`}
          >
            Measurement
          </button>
          <button
            onClick={() => { setTab('bloodwork'); setMessage(null); }}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${tab === 'bloodwork' ? 'bg-jarvis-accent text-jarvis-bg' : 'bg-jarvis-border text-jarvis-text-dim hover:text-jarvis-text-secondary'}`}
          >
            Blood Work
          </button>
        </div>
      </div>

      {tab === 'measurement' ? (
        <form onSubmit={handleMeasurement} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            >
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Value</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !value}
            className="px-3 py-1.5 bg-jarvis-accent text-jarvis-bg text-xs font-semibold rounded hover:bg-jarvis-accent/80 disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : 'Save'}
          </button>
          {message && (
            <span className={`text-xs ${message.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {message}
            </span>
          )}
        </form>
      ) : (
        <form onSubmit={handleBloodWork} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Marker</label>
            <select
              value={bwMarker}
              onChange={(e) => setBwMarker(e.target.value)}
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            >
              {BLOOD_MARKERS.map((m) => (
                <option key={m.value} value={m.value}>{m.label} ({m.unit})</option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Value</label>
            <input
              type="number"
              step="any"
              value={bwValue}
              onChange={(e) => setBwValue(e.target.value)}
              placeholder="0"
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            />
          </div>
          <div className="w-28">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Date</label>
            <input
              type="date"
              value={bwDate}
              onChange={(e) => setBwDate(e.target.value)}
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            />
          </div>
          <div className="w-24">
            <label className="text-[10px] text-jarvis-text-muted uppercase block mb-1">Lab</label>
            <input
              type="text"
              value={bwLab}
              onChange={(e) => setBwLab(e.target.value)}
              placeholder="Prodia"
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-xs text-jarvis-text-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !bwValue}
            className="px-3 py-1.5 bg-jarvis-accent text-jarvis-bg text-xs font-semibold rounded hover:bg-jarvis-accent/80 disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : 'Save'}
          </button>
          {message && (
            <span className={`text-xs ${message.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {message}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
