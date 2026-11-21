import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import az from './az.json';
import { KIDEX_LANGUAGE_LOADERS, loadKidExContent } from './index';
import { KIDEX_CONTENT_LANGUAGES, KIDEX_TILE_TEXT } from './tile';
import { KIDEX_UI_AZ } from './ui-az';
import type { KidExLocale } from './types';

const dir = join(process.cwd(), 'src/data/kid-exercises');
const localeFiles = readdirSync(dir).filter((f) => /^[a-z]{2}\.json$/.test(f) && f !== 'az.json').map((f) => f.slice(0, 2));
const groups = [...new Set(az.exercises.map((e) => e.group))];

describe('Uşaq məşqləri languages', () => {
  it('registry, tile text and locale files list the same languages', () => {
    expect(Object.keys(KIDEX_LANGUAGE_LOADERS).sort()).toEqual([...KIDEX_CONTENT_LANGUAGES].sort());
    expect(Object.keys(KIDEX_TILE_TEXT).sort()).toEqual([...KIDEX_CONTENT_LANGUAGES].sort());
    expect(['az', ...localeFiles].sort()).toEqual([...KIDEX_CONTENT_LANGUAGES].sort());
  });

  it.each(localeFiles)('%s covers every UI key, set, group and exercise', (lang) => {
    const loc = JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as KidExLocale;
    expect(Object.keys(loc.ui).sort()).toEqual(Object.keys(KIDEX_UI_AZ).sort());
    expect(loc.ui.count).toContain('{n}');
    expect(loc.ui.doneCount).toContain('{n}');
    expect(loc.ui.ageFor).toContain('{name}');
    expect(KIDEX_TILE_TEXT[lang]).toEqual({ name: loc.ui.tileName, description: loc.ui.tileDesc });
    for (const s of az.sets) expect(loc.sets[s.id]?.rules).toHaveLength(s.rules.length);
    for (const g of groups) expect(loc.groups[g]?.length).toBeGreaterThan(0);
    for (const e of az.exercises) {
      const t = loc.exercises[e.id];
      expect(t, e.id).toBeTruthy();
      expect(Boolean(t.caution), e.id).toBe(Boolean((e as { caution?: string }).caution));
    }
    expect(JSON.stringify(loc)).not.toContain('—');
  });

  it('loads Azerbaijani with the source text', async () => {
    const c = await loadKidExContent('az');
    expect(c.exercises).toHaveLength(141);
    expect(c.exercises[0].title).toBe('Qarın üstə uzanma');
  });
});
