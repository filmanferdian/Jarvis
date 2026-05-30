// Markdown-to-HTML for valuation memos. Handles headings, bold, bullets, quotes,
// dividers, and paragraphs.
//
// Security: the text content of every line is HTML-escaped BEFORE any markup is
// produced, so raw HTML in the Notion-sourced memo is rendered inert, not executed.

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c]);
}

function inline(escaped: string): string {
  return escaped.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-jarvis-text-primary">$1</strong>',
  );
}

export function renderMemo(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length) {
      out.push(
        `<ul class="my-2 space-y-1 list-disc pl-5 text-[13px] leading-relaxed text-jarvis-text-secondary">${bullets.join('')}</ul>`,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      out.push(
        `<h3 class="text-[13px] font-semibold text-jarvis-text-secondary mt-4 mb-1">${inline(escapeHtml(line.slice(4)))}</h3>`,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      out.push(
        `<h2 class="text-[15px] font-semibold text-jarvis-text-primary mt-5 mb-1.5" style="font-family:var(--font-display)">${inline(escapeHtml(line.slice(3)))}</h2>`,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      out.push(
        `<h1 class="text-[20px] font-semibold text-jarvis-text-primary mt-1 mb-2" style="font-family:var(--font-display)">${inline(escapeHtml(line.slice(2)))}</h1>`,
      );
      continue;
    }
    if (line.startsWith('- ')) {
      bullets.push(`<li>${inline(escapeHtml(line.slice(2)))}</li>`);
      continue;
    }
    if (line === '---') {
      flush();
      out.push('<hr class="border-jarvis-border my-3" />');
      continue;
    }
    if (line.startsWith('> ')) {
      flush();
      out.push(
        `<p class="text-[12.5px] italic leading-relaxed text-jarvis-text-dim border-l-2 border-jarvis-border pl-3 my-2">${inline(escapeHtml(line.slice(2)))}</p>`,
      );
      continue;
    }
    flush();
    out.push(
      `<p class="text-[13px] leading-relaxed text-jarvis-text-secondary mb-2">${inline(escapeHtml(line))}</p>`,
    );
  }
  flush();
  return out.join('\n');
}
