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

export default function ManualEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [type, setType] = useState(MEASUREMENT_TYPES[0].value);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      <h3 className="text-sm font-semibold text-jarvis-text-primary mb-3">Manual Entry</h3>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
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
    </div>
  );
}
