/**
 * Lightweight markdown-to-HTML for synthesis text.
 * Handles: **bold**, bullet lists (- ), numbered lists (1. ), and section spacing.
 */
export function renderMarkdown(text: string): string {
  return text
    // Bold: **text** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-jarvis-text-primary">$1</strong>')
    // Bullet list items: "- text" → <li>
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered list items: "1. text" → <li>
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Wrap consecutive <li class="ml-4 list-disc"> in <ul>
    .replace(/((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="space-y-1 my-2">$1</ul>')
    // Wrap consecutive <li class="ml-4 list-decimal"> in <ol>
    .replace(/((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="space-y-1 my-2">$1</ol>')
    // Source attribution: (Bloomberg), (NYT), (Bloomberg, NYT)
    .replace(/\(([A-Z][A-Za-z0-9,\s]+?)\)\s*$/gm, '<span class="text-jarvis-text-muted text-sm">($1)</span>');
}
