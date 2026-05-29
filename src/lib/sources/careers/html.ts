// Convert a job-description HTML blob (Greenhouse `content` is entity-encoded
// HTML; scraped listings may carry raw tags) into plain text suitable for the
// LLM and for storage. Decodes the common named/numeric entities, drops tags,
// collapses whitespace.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#34': '"',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const cp = code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? m;
    });
}

export function htmlToText(html: string | null | undefined, maxLen = 8000): string {
  if (!html) return '';
  // Entity-encoded blobs (Greenhouse) need one decode pass to expose tags.
  const decoded = decodeEntities(String(html));
  return decodeEntities(
    decoded
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}
