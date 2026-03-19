'use client';

interface BloodWorkEntry {
  marker_name: string;
  value: number;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  test_date: string;
}

interface BloodWorkPanelProps {
  entries: BloodWorkEntry[];
  lastTestDate: string | null;
}

const MARKER_LABELS: Record<string, string> = {
  hba1c: 'HbA1c',
  fasting_glucose: 'Fasting Glucose',
  triglycerides: 'Triglycerides',
  hdl: 'HDL Cholesterol',
  ldl: 'LDL Cholesterol',
  total_cholesterol: 'Total Cholesterol',
  testosterone: 'Testosterone',
};

function getStatus(entry: BloodWorkEntry): 'normal' | 'borderline' | 'out_of_range' {
  if (entry.reference_low == null && entry.reference_high == null) return 'normal';
  if (entry.reference_low != null && entry.value < entry.reference_low) return 'out_of_range';
  if (entry.reference_high != null && entry.value > entry.reference_high) return 'out_of_range';
  // Borderline: within 10% of range boundary
  if (entry.reference_low != null) {
    const margin = entry.reference_low * 0.1;
    if (entry.value < entry.reference_low + margin) return 'borderline';
  }
  if (entry.reference_high != null) {
    const margin = entry.reference_high * 0.1;
    if (entry.value > entry.reference_high - margin) return 'borderline';
  }
  return 'normal';
}

const STATUS_CLASSES = {
  normal: 'text-emerald-400',
  borderline: 'text-jarvis-warn',
  out_of_range: 'text-red-400',
};

export default function BloodWorkPanel({ entries, lastTestDate }: BloodWorkPanelProps) {
  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-mono text-jarvis-accent uppercase tracking-wider">O4</span>
          <h3 className="text-sm font-semibold text-jarvis-text-primary">Metabolic & Hormonal</h3>
        </div>
        {lastTestDate && (
          <span className="text-xs text-jarvis-text-dim">Last panel: {lastTestDate}</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-jarvis-text-dim py-4 text-center">
          No blood work recorded yet. Next due: quarterly Prodia HL II panel.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-jarvis-text-muted border-b border-jarvis-border">
                <th className="text-left py-1 font-normal">Marker</th>
                <th className="text-right py-1 font-normal">Value</th>
                <th className="text-right py-1 font-normal">Range</th>
                <th className="text-right py-1 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const status = getStatus(entry);
                return (
                  <tr key={entry.marker_name} className="border-b border-jarvis-border/50">
                    <td className="py-1.5 text-jarvis-text-secondary">
                      {MARKER_LABELS[entry.marker_name] || entry.marker_name}
                    </td>
                    <td className={`py-1.5 text-right font-mono ${STATUS_CLASSES[status]}`}>
                      {entry.value} {entry.unit}
                    </td>
                    <td className="py-1.5 text-right text-jarvis-text-dim font-mono">
                      {entry.reference_low != null && entry.reference_high != null
                        ? `${entry.reference_low}–${entry.reference_high}`
                        : entry.reference_low != null
                          ? `>${entry.reference_low}`
                          : entry.reference_high != null
                            ? `<${entry.reference_high}`
                            : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className={`${STATUS_CLASSES[status]}`}>
                        {status === 'normal' ? '✓' : status === 'borderline' ? '⚠' : '✗'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
