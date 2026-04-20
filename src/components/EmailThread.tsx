'use client';

import { useState } from 'react';

export type Tone = 'direct' | 'warm' | 'brief';

export interface ThreadMessage {
  from_name: string | null;
  from_address: string;
  subject: string;
  received_at: string;
  body_snippet: string | null;
  source: string;
}

export interface Thread {
  key: string;
  from_name: string | null;
  from_address: string;
  subject: string;
  source: string;
  messages: ThreadMessage[];
  draft_snippet: string | null;
  draft_skipped_reason: string | null;
  draft_tone?: Tone;
}

function formatWibTime(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const h = String(wib.getUTCHours()).padStart(2, '0');
  const m = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function initials(name: string | null, address: string): string {
  const base = (name && name.trim()) || address.split('@')[0];
  const parts = base.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function sourceHref(source: string): string | null {
  if (source === 'outlook') return 'https://outlook.office.com/mail/drafts';
  if (source.startsWith('gmail:')) return 'https://mail.google.com/mail/u/0/#drafts';
  return null;
}

interface Props {
  thread: Thread;
}

export default function EmailThread({ thread }: Props) {
  const [tone, setTone] = useState<Tone>(thread.draft_tone ?? 'warm');
  const latest = thread.messages[thread.messages.length - 1];
  const earlier = thread.messages.slice(0, -1);
  const draftHref = sourceHref(thread.source);

  return (
    <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card overflow-hidden">
      {/* Head */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-jarvis-border">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-semibold shrink-0"
          style={{
            background:
              'linear-gradient(135deg, var(--color-jarvis-ambient), var(--color-jarvis-aurora))',
            fontFamily: 'var(--font-display)',
          }}
        >
          {initials(thread.from_name, thread.from_address)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] text-jarvis-text-primary truncate">
            {thread.from_name || thread.from_address}
          </h3>
          <p className="text-[12px] text-jarvis-text-faint truncate">
            {thread.subject}
          </p>
        </div>
      </div>

      {/* Thread */}
      <div className="px-6 py-5">
        {earlier.map((m, i) => (
          <div key={i} className="py-3.5 border-b border-dashed border-jarvis-border last:border-b-0">
            <div
              className="flex justify-between mb-1.5 text-[11.5px] text-jarvis-text-faint"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <span>{m.from_name || m.from_address}</span>
              <span>{formatWibTime(m.received_at)} WIB</span>
            </div>
            <p className="text-[13.5px] text-jarvis-text-dim leading-relaxed whitespace-pre-wrap">
              {m.body_snippet || <span className="italic text-jarvis-text-faint">No preview available.</span>}
            </p>
          </div>
        ))}

        {/* Current message */}
        <div className="my-2.5 -mx-3 px-3 py-3.5 rounded-[10px] bg-jarvis-bg-deep">
          <div
            className="flex justify-between mb-1.5 text-[11.5px] text-jarvis-text-faint"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <span>{latest.from_name || latest.from_address}</span>
            <span>{formatWibTime(latest.received_at)} WIB</span>
          </div>
          <p className="text-[13.5px] text-jarvis-text-primary leading-relaxed whitespace-pre-wrap">
            {latest.body_snippet || <span className="italic text-jarvis-text-faint">No preview available.</span>}
          </p>
        </div>

        {/* Draft */}
        {thread.draft_snippet && (
          <div
            className="mt-3.5 rounded-[12px] px-[18px] py-4"
            style={{
              background: 'var(--color-jarvis-ambient-soft)',
              border: '1px solid var(--color-jarvis-ambient-soft)',
            }}
          >
            <p
              className="mb-2 text-[10px] uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.15em',
                color: 'var(--color-jarvis-ambient)',
              }}
            >
              Draft reply · {tone}
            </p>
            <p className="text-[13.5px] text-jarvis-text-primary whitespace-pre-wrap leading-relaxed mb-3.5">
              {thread.draft_snippet}
            </p>
            <div className="flex gap-2 items-center flex-wrap">
              <a
                href={draftHref ?? '#'}
                target={draftHref ? '_blank' : undefined}
                rel={draftHref ? 'noopener noreferrer' : undefined}
                className="px-3.5 py-1.5 text-[12px] rounded-[8px] text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--color-jarvis-cta)' }}
              >
                Send as-is
              </a>
              <a
                href={draftHref ?? '#'}
                target={draftHref ? '_blank' : undefined}
                rel={draftHref ? 'noopener noreferrer' : undefined}
                className="px-3.5 py-1.5 text-[12px] rounded-[8px] border border-jarvis-border text-jarvis-text-dim hover:bg-jarvis-bg-deep transition-colors"
              >
                Edit draft
              </a>
              <div className="flex gap-1.5 ml-auto">
                {(['direct', 'warm', 'brief'] as Tone[]).map((t) => {
                  const active = tone === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className="px-2.5 py-1 text-[11px] rounded-full border transition-all capitalize"
                      style={{
                        background: active ? 'var(--color-jarvis-ambient)' : 'var(--color-jarvis-bg-card)',
                        color: active ? '#fff' : 'var(--color-jarvis-text-dim)',
                        borderColor: active
                          ? 'var(--color-jarvis-ambient)'
                          : 'var(--color-jarvis-border)',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {!thread.draft_snippet && thread.draft_skipped_reason && (
          <p className="mt-3.5 text-[12px] text-jarvis-warn">
            Draft skipped — {thread.draft_skipped_reason}. Action likely happens inside the email.
          </p>
        )}
      </div>
    </div>
  );
}
