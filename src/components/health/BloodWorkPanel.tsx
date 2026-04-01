'use client';

import { useState } from 'react';

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

const CATEGORIES: { label: string; markers: string[] }[] = [
  { label: 'Lipid Panel', markers: ['Cholesterol Total', 'LDL Direct', 'HDL', 'Trigliserida', 'Non-HDL Cholesterol', 'Apo-B'] },
  { label: 'Ratios', markers: ['Rasio LDL/Apo-B', 'Rasio TG/HDL'] },
  { label: 'Metabolic', markers: ['HbA1c', 'Glukosa Puasa', 'Asam Urat'] },
  { label: 'Liver', markers: ['GOT (AST)', 'GPT (ALT)', 'Gamma GT'] },
  { label: 'Kidney', markers: ['Kreatinin', 'eGFR (CKD-EPI)'] },
  { label: 'Inflammation', markers: ['hs-CRP'] },
  { label: 'CBC', markers: ['Hemoglobin', 'Hematokrit', 'Eritrosit', 'Leukosit', 'Trombosit', 'MCV', 'MCH', 'MCHC', 'RDW-CV', 'Eosinofil'] },
];

function getStatus(entry: BloodWorkEntry): 'normal' | 'borderline' | 'out_of_range' {
  if (entry.reference_low == null && entry.reference_high == null) return 'normal';
  if (entry.reference_low != null && entry.value < entry.reference_low) return 'out_of_range';
  if (entry.reference_high != null && entry.value > entry.reference_high) return 'out_of_range';
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
  normal: 'text-jarvis-success',
  borderline: 'text-jarvis-warn',
  out_of_range: 'text-jarvis-danger',
};

export default function BloodWorkPanel({ entries, lastTestDate }: BloodWorkPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const entryMap = new Map<string, BloodWorkEntry>();
  for (const e of entries) {
    if (!entryMap.has(e.marker_name)) entryMap.set(e.marker_name, e);
  }

  const outOfRange = entries.filter((e) => getStatus(e) === 'out_of_range').length;

  const categorized = CATEGORIES.map((cat) => ({
    label: cat.label,
    entries: cat.markers
      .map((m) => ({ label: m, entry: entryMap.get(m) }))
      .filter((r): r is { label: string; entry: BloodWorkEntry } => r.entry != null),
  })).filter((cat) => cat.entries.length > 0);

  const allCategorized = new Set(CATEGORIES.flatMap((c) => c.markers));
  const uncategorized = entries.filter((e) => !allCategorized.has(e.marker_name));
  if (uncategorized.length > 0) {
    categorized.push({
      label: 'Other',
      entries: uncategorized.map((e) => ({ label: e.marker_name, entry: e })),
    });
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-jarvis-text-muted hover:text-jarvis-text-secondary transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">Full Blood Panel</span>
          <span className="text-jarvis-text-dim">
            {entries.length} markers{outOfRange > 0 ? ` \u00B7 ${outOfRange} flagged` : ''}
            {lastTestDate ? ` \u00B7 ${lastTestDate}` : ''}
          </span>
        </span>
        <span className="text-[10px]">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-jarvis-border/50">
          {categorized.map((cat) => (
            <div key={cat.label}>
              <div className="text-[10px] font-mono text-jarvis-text-muted uppercase tracking-wider mb-1 mt-2">
                {cat.label}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {cat.entries.map(({ label, entry }) => {
                    const status = getStatus(entry);
                    return (
                      <tr key={label} className="border-b border-jarvis-border/30">
                        <td className="py-1.5 text-jarvis-text-secondary w-[40%]">{label}</td>
                        <td className={`py-1.5 text-right font-mono ${STATUS_CLASSES[status]} w-[25%]`}>
                          {entry.value} {entry.unit}
                        </td>
                        <td className="py-1.5 text-right text-jarvis-text-dim font-mono w-[25%]">
                          {entry.reference_low != null && entry.reference_high != null
                            ? `${entry.reference_low}\u2013${entry.reference_high}`
                            : entry.reference_low != null
                              ? `>${entry.reference_low}`
                              : entry.reference_high != null
                                ? `<${entry.reference_high}`
                                : '\u2014'}
                        </td>
                        <td className="py-1.5 text-right w-[10%]">
                          <span className={STATUS_CLASSES[status]}>
                            {status === 'normal' ? '\u2713' : status === 'borderline' ? '\u26A0' : '\u2717'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
