import { describe, expect, it } from 'vitest';
import { LEGAL_PROSE_CLASS, wrapLegalTables } from './legalProse';

describe('legal document layout', () => {
  it('wraps every HTML table in its own horizontal scroller', () => {
    const html = '<p>Intro</p><table class="x"><tr><td>a</td></tr></table><TABLE><tr><td>b</td></tr></TABLE>';
    const out = wrapLegalTables(html);
    expect(out.match(/<div class="legal-table-scroll"><table/gi)).toHaveLength(2);
    expect(out.match(/<\/table><\/div>/gi)).toHaveLength(2);
  });
  it('lets prose wrap to the viewport and keeps table words intact', () => {
    expect(LEGAL_PROSE_CLASS).toContain('min-w-0');
    expect(LEGAL_PROSE_CLASS).toContain('[&_.legal-table-scroll]:overflow-x-auto');
    expect(LEGAL_PROSE_CLASS).toContain('[&_table]:[overflow-wrap:normal]');
  });
});
