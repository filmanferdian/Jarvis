/**
 * Lightweight markdown-to-HTML for synthesis text.
 * Handles: **bold**, bullet lists (- ), numbered lists (1. ), and section spacing.
 */
export function renderMarkdown(text: string): string {
  return text
    // Collapse blank lines between consecutive bullet items so they group into one list
    .replace(/(^- .+$)\n{2,}(^- )/gm, '$1\n$2')
    // Collapse blank lines between consecutive numbered items
    .replace(/(^\d+\.\s+.+$)\n{2,}(^\d+\.\s+)/gm, '$1\n$2')
    // Bold: **text** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-jarvis-text-primary">$1</strong>')
    // Bullet list items: "- text" → <li>
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered list items: "1. text" → <li>
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Wrap consecutive <li class="ml-4 list-disc"> in <ul>
    .replace(/((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="my-2">$1</ul>')
    // Wrap consecutive <li class="ml-4 list-decimal"> in <ol>
    .replace(/((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="my-2">$1</ol>')
    // Merge adjacent list blocks that got split by blank lines in source
    .replace(/<\/ul>\s*<ul class="my-2">/g, '')
    .replace(/<\/ol>\s*<ol class="my-2">/g, '')
    // Strip all whitespace between list items (must run after merge to catch new adjacencies)
    .replace(/<\/li>\s*<li/g, '</li><li')
    // Source attribution: (Bloomberg), (NYT), (Bloomberg, NYT)
    .replace(/\(([A-Z][A-Za-z0-9,\s]+?)\)\s*$/gm, '<span class="text-jarvis-text-muted text-sm">($1)</span>');
}
