import { describe, expect, it } from 'vitest';
import { PLAY_GAMES_AZ } from './az';
import { PLAY_UI_AZ } from './ui-az';
import { PLAY_CONTENT_LANGUAGES, PLAY_TILE_TEXT } from './tile';
import { PLAY_LANGUAGE_LOADERS } from './index';
import type { PlayLocale } from './types';

const files = import.meta.glob<{ default: PlayLocale }>('./[a-z][a-z].ts', { eager: true });
// ə exists only in Azerbaijani (and Kazakh/Kyrgyz Cyrillic use ә, a different letter): a leftover source string.
const AZ_ONLY = /[əƏ]/u;
const flat = (v: unknown): string[] => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];
const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');

describe('Uşaqla oyun translations', () => {
  const langs = Object.keys(files).map((f) => f.slice(2, 4)).filter((l) => l !== 'az');

  it('tile language list matches the loaders', () => {
    expect([...PLAY_CONTENT_LANGUAGES].sort()).toEqual(Object.keys(PLAY_LANGUAGE_LOADERS).sort());
  });

  it('every registered language has a file', () => {
    for (const lang of Object.keys(PLAY_LANGUAGE_LOADERS)) if (lang !== 'az') expect(langs, lang).toContain(lang);
  });

  for (const lang of langs) {
    describe(lang, () => {
      const loc = files[`./${lang}.ts`].default;
      it('has every UI string with the same placeholders', () => {
        const walk = (src: unknown, dst: unknown, path: string) => {
          if (typeof src === 'string') { expect(typeof dst, path).toBe('string'); expect((dst as string).trim().length, path).toBeGreaterThan(0); expect(holes(dst as string), path).toBe(holes(src)); return; }
          for (const k of Object.keys(src as object)) walk((src as Record<string, unknown>)[k], (dst as Record<string, unknown>)?.[k], `${path}.${k}`);
        };
        walk(PLAY_UI_AZ, loc.ui, 'ui');
        expect(PLAY_TILE_TEXT[lang], 'tile.ts').toEqual({ name: loc.ui.tileName, description: loc.ui.tileDesc });
      });
      it('translates every game with the same shape', () => {
        expect(Object.keys(loc.games).sort()).toEqual(PLAY_GAMES_AZ.map((g) => g.id).sort());
        for (const g of PLAY_GAMES_AZ) {
          const t = loc.games[g.id];
          expect(t.materials.length, `${g.id}.materials`).toBe(g.materials.length);
          expect(t.steps.length, `${g.id}.steps`).toBe(g.steps.length);
          expect(!!t.tip, `${g.id}.tip`).toBe(!!g.tip);
          expect(!!t.safety, `${g.id}.safety`).toBe(!!g.safety);
          for (const s of flat(t)) expect(s.trim().length, g.id).toBeGreaterThan(0);
        }
      });
      it('has no long dashes and no Azerbaijani leftovers', () => {
        for (const s of flat(loc)) {
          expect(s, lang).not.toContain('—');
          expect(AZ_ONLY.test(s), `${lang}: ${s}`).toBe(false);
        }
      });
    });
  }
});
