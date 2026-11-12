import { describe, expect, it } from 'vitest';
import { mergeStories, parseServerStories, sanitizeSlide, sanitizeStory } from './server-stories';
import type { Story } from './stories';

const bundled: Story[] = [
  { id: 'aa', module: 'bump', title: 'A', theme: 'coral', illus: 'fruit', slides: [{ t: 'cover', title: 'A' }] },
  { id: 'bb', module: 'all', title: 'B', theme: 'lime', illus: 'heart', slides: [{ t: 'cover', title: 'B' }] },
];
const row = (id: string, story: unknown, extra: object = {}) => ({ id, action: 'show', story, ...extra });

describe('server stories', () => {
  it('keeps a valid story and drops unknown fields', () => {
    const s = sanitizeStory('new-one', { module: 'mommy', title: 'Yeni', theme: 'nope', illus: 'x', evil: '<script>', slides: [{ t: 'fact', value: '7', body: 'ok', html: '<b>' }] });
    expect(s).toMatchObject({ id: 'new-one', module: 'mommy', theme: 'coral', slides: [{ t: 'fact', value: '7', body: 'ok' }] });
    expect(JSON.stringify(s)).not.toContain('script');
    expect(JSON.stringify(s)).not.toContain('html');
  });
  it('rejects bad ids, modules and empty slide lists', () => {
    expect(sanitizeStory('Bad ID', { module: 'all', title: 'x', slides: [{ t: 'cover', title: 'x' }] })).toBeNull();
    expect(sanitizeStory('ok-id', { module: 'boss', title: 'x', slides: [{ t: 'cover', title: 'x' }] })).toBeNull();
    expect(sanitizeStory('ok-id', { module: 'all', title: 'x', slides: [{ t: 'video', title: 'x' }] })).toBeNull();
  });
  it('drops broken quiz and cta slides and unsafe navigation', () => {
    expect(sanitizeSlide({ t: 'quiz', title: 'q', options: ['a', 'b'], correct: 5 })).toBeNull();
    expect(sanitizeSlide({ t: 'cta', title: 'c', cta: { label: 'Go', nav: { tool: 'javascript:alert(1)' } } })).toBeNull();
    expect(sanitizeSlide({ t: 'cta', title: 'c', cta: { label: 'Go', nav: { tool: 'fetal-growth' } } })?.cta?.nav.tool).toBe('fetal-growth');
  });
  it('merges: replace in place, hide, new ones first by sort', () => {
    const server = parseServerStories([
      row('bb', { module: 'all', title: 'B2', slides: [{ t: 'cover', title: 'B2' }] }),
      { id: 'aa', action: 'hide' },
      row('n1', { module: 'all', title: 'N1', slides: [{ t: 'cover', title: 'N1' }] }, { sort: 1 }),
      row('n2', { module: 'all', title: 'N2', slides: [{ t: 'cover', title: 'N2' }] }, { sort: 5 }),
      row('bad', { module: 'all' }),
    ]);
    expect(mergeStories(bundled, server).map((s) => s.title)).toEqual(['N2', 'N1', 'B2']);
  });
  it('falls back to bundled stories without server data', () => {
    expect(mergeStories(bundled, null)).toBe(bundled);
    expect(mergeStories(bundled, parseServerStories('nonsense'))).toEqual(bundled);
  });
});
