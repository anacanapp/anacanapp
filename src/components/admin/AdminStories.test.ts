import { describe, expect, it } from 'vitest';
import { SLIDE_TEMPLATES, storyRowProblems, type StoryRow } from './AdminStories';
import { sanitizeSlide } from '@/lib/server-stories';

const row = (patch: Partial<StoryRow> = {}): StoryRow => ({
  id: 'winter-tips', language: 'az', action: 'show', story: {}, audience: 'test', enabled: false,
  starts_at: null, ends_at: null, sort_order: 0, note: null, ...patch,
});
const json = (o: object) => JSON.stringify(o);

describe('admin story validation', () => {
  it('every slide template is a valid slide', () => {
    for (const s of Object.values(SLIDE_TEMPLATES)) expect(sanitizeSlide(s)).not.toBeNull();
  });
  it('accepts a complete story', () => {
    const r = storyRowProblems(row(), json({ module: 'all', title: 'Qış', slides: [SLIDE_TEMPLATES.cover, SLIDE_TEMPLATES.quiz] }));
    expect(r.problems).toEqual([]);
    expect(r.story?.slides).toHaveLength(2);
  });
  it('reports bad id, bad JSON, long dash, broken slides and bad window', () => {
    expect(storyRowProblems(row({ id: 'Qış!' }), json({ module: 'all', title: 'x', slides: [SLIDE_TEMPLATES.cover] })).problems[0]).toMatch(/ID/);
    expect(storyRowProblems(row(), '{').problems).toContain('JSON düzgün deyil.');
    expect(storyRowProblems(row(), json({ module: 'all', title: 'x — y', slides: [SLIDE_TEMPLATES.cover] })).problems.join()).toMatch(/tire/);
    expect(storyRowProblems(row(), json({ module: 'all', title: 'x', slides: [SLIDE_TEMPLATES.cover, { t: 'quiz', options: ['a'] }] })).dropped).toBe(1);
    expect(storyRowProblems(row({ starts_at: '2026-12-02T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' }), json({ module: 'all', title: 'x', slides: [SLIDE_TEMPLATES.cover] })).problems).toHaveLength(1);
  });
  it('hide only applies to bundled stories', () => {
    expect(storyRowProblems(row({ action: 'hide', id: 'not-bundled' }), '{}').problems).toHaveLength(1);
    expect(storyRowProblems(row({ action: 'hide', id: 'bump-this-week' }), '{}').problems).toEqual([]);
  });
});
