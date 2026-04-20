// Shared helpers for rendering briefing text in the UI and sanitizing it
// before it hits TTS. Used by BriefingHero (preview subtitle),
// BriefingOverlay (current-line subtitle + line tracking), and the
// briefing regenerate route (pre-store cleanup of the voiceover script).

/**
 * Strip markdown markers and drop heading-only or label-only lines.
 * Output is plain prose suitable for display subtitles and TTS.
 */
export function sanitizeBriefing(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1') // italic
        .replace(/^#{1,6}\s+/, '') // heading prefix
        .replace(/^\s*[-•]\s+/, '') // bullet marker
        .replace(/^\s*\d+\.\s+/, '') // numbered marker
        .replace(/^\[[A-Z ]+\]\s*/, '') // written-briefing section markers like [SCHEDULE]
        .trim(),
    )
    .filter((line) => line.length > 0)
    // Drop lines that read as labels: ≤4 words AND no sentence punctuation.
    // Keeps "All clear today." (has period) but drops "Calendar Overview".
    .filter((line) => !(line.split(/\s+/).length <= 4 && !/[.!?]/.test(line)))
    .join('\n');
}

/** Split already-sanitized text into playable lines (sentences or short paragraphs). */
export function splitBriefingLines(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** First content paragraph of the written briefing, stripped and truncated. */
export function briefingPreview(briefing: string, maxLen = 200): string {
  const paragraphs = briefing
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const firstContent =
    paragraphs.find((p) => !/^\*\*[^*]+\*\*$/.test(p)) ?? paragraphs[0] ?? '';
  const stripped = firstContent
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\[[A-Z ]+\]\s*/, '');
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}
