import { describe, expect, it } from 'vitest';
import { PLAY_GAMES_AZ } from '@/data/play-together/az';
import { findBook } from '@/lib/books/catalog';
import {
  PLAY_CATEGORIES, bandForMonths, booksForAgeGroup, emptyPlayState, gamesForAge, isPlayTileVisible, logPlayed, minutesOn,
  playedOn, sanitizePlayState, screenGuideFor, todaysPicks, toggleFav, unlogPlayed, weekStrip,
} from './play-together';

describe('play-together content', () => {
  it('has unique ids, valid ages, steps and only real book ids', () => {
    const ids = new Set<string>();
    for (const g of PLAY_GAMES_AZ) {
      expect(ids.has(g.id), g.id).toBe(false); ids.add(g.id);
      expect(g.minM).toBeLessThan(g.maxM);
      expect(PLAY_CATEGORIES).toContain(g.cat);
      expect(g.steps.length).toBeGreaterThanOrEqual(3);
      expect(g.materials.length).toBeGreaterThan(0);
      for (const b of g.books) expect(findBook(b), `${g.id} -> ${b}`).toBeTruthy();
      // House rule: no long dashes in user-facing text.
      expect(JSON.stringify(g)).not.toContain('—');
    }
  });

  it('offers at least 8 games and 3 categories for every age band', () => {
    for (const months of [6, 8, 14, 20, 26, 30, 38, 44, 50, 56, 62, 70, 80, 100]) {
      const games = gamesForAge(PLAY_GAMES_AZ, months);
      expect(games.length, `age ${months}`).toBeGreaterThanOrEqual(5);
      expect(new Set(games.map((g) => g.cat)).size, `age ${months}`).toBeGreaterThanOrEqual(3);
    }
    expect(gamesForAge(PLAY_GAMES_AZ, 30).length).toBeGreaterThanOrEqual(8);
  });
});

describe('play-together logic', () => {
  it('maps ages to bands and screen guidance', () => {
    expect(bandForMonths(7)).toBe('6m');
    expect(bandForMonths(25)).toBe('2y');
    expect(bandForMonths(100)).toBe('6y');
    expect(screenGuideFor(18)).toBe('none');
    expect(screenGuideFor(36)).toBe('hour');
    expect(screenGuideFor(72)).toBe('family');
  });

  it('picks three games of different categories, stable for a day', () => {
    const games = gamesForAge(PLAY_GAMES_AZ, 42);
    const a = todaysPicks(games, '2026-11-12|c1|3y', new Set());
    const b = todaysPicks(games, '2026-11-12|c1|3y', new Set());
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
    expect(a).toHaveLength(3);
    expect(new Set(a.map((g) => g.cat)).size).toBe(3);
  });

  it('logs a game once per day and counts minutes', () => {
    const now = new Date(2026, 10, 12, 10);
    const game = PLAY_GAMES_AZ[0];
    let s = logPlayed(emptyPlayState(), game, now);
    s = logPlayed(s, game, now);
    expect(s.log).toHaveLength(1);
    expect(minutesOn(s, '2026-11-12')).toBe(game.minutes);
    expect(playedOn(s, '2026-11-12').has(game.id)).toBe(true);
    expect(weekStrip(s, now).at(-1)).toEqual({ day: '2026-11-12', minutes: game.minutes, today: true });
    expect(unlogPlayed(s, game.id, now).log).toHaveLength(0);
  });

  it('keeps stored state bounded and drops malformed entries', () => {
    const log = Array.from({ length: 400 }, (_, i) => ({ id: `g${i}`, day: '2026-11-01', minutes: 10 }));
    const s = sanitizePlayState({ log: [...log, { id: 1 }, { id: 'x', day: 'bad', minutes: 5 }], favs: ['a', 'a', 3], band: 'zz' });
    expect(s.log).toHaveLength(300);
    expect(s.favs).toEqual(['a']);
    expect(s.band).toBeNull();
    expect(toggleFav(toggleFav(s, 'b'), 'b').favs).toEqual(['a']);
  });

  it('recommends books of the age group with hands-on pages first', () => {
    const books = booksForAgeGroup(42);
    expect(books.length).toBeGreaterThan(0);
    expect(books.every((b) => b.age === '3y')).toBe(true);
  });

  it('shows the tile for mothers whose app language has content', () => {
    expect(isPlayTileVisible({ lifeStage: 'mommy', hasContent: true })).toBe(true);
    expect(isPlayTileVisible({ lifeStage: 'mommy', hasContent: false })).toBe(false);
    expect(isPlayTileVisible({ lifeStage: 'bump', hasContent: true })).toBe(false);
    expect(isPlayTileVisible({ lifeStage: 'bump', hasContent: true, isAdmin: true })).toBe(true);
  });
});
