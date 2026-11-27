/** Prose wraps to the phone width; tables keep readable words and scroll sideways in their own box. */
export const LEGAL_PROSE_CLASS = [
  'a-card prose prose-xs dark:prose-invert max-w-none min-w-0 w-full text-sm break-words',
  '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm',
  '[&_img]:max-w-full [&_img]:h-auto [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap',
  '[&_.legal-table-scroll]:overflow-x-auto [&_.legal-table-scroll]:my-3 [&_.legal-table-scroll]:max-w-full',
  '[&_table]:[overflow-wrap:normal] [&_table]:max-w-none [&_table]:my-0',
].join(' ');

/** HTML legal documents: give each table its own horizontal scroller (Markdown tables already get one). */
export function wrapLegalTables(html: string): string {
  return html
    .replace(/<table\b/gi, '<div class="legal-table-scroll"><table')
    .replace(/<\/table>/gi, '</table></div>');
}
