import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lifeStage: 'mommy' as string,
  language: 'az' as string,
  setting: 'on' as unknown,
  disabled: [] as string[],
  birth: '2024-07-07' as string | null,
  logEvent: vi.fn(),
}));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: (key: string) => (key === 'parenting_tool' ? mocks.setting : undefined) }));
vi.mock('@/hooks/useDisabledTools', () => ({
  useDisabledTools: () => ({ disabledTools: mocks.disabled, isToolDisabled: (id: string) => mocks.disabled.includes(id) }),
}));
vi.mock('@/store/userStore', () => ({
  useUserStore: (sel: (s: { language: string; lifeStage: string }) => unknown) => sel({ language: mocks.language, lifeStage: mocks.lifeStage }),
}));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => {
    const child = mocks.birth ? { id: 'c1', name: 'Aysel', birth_date: mocks.birth, gender: 'girl' } : null;
    return { selectedChild: child, children: child ? [child] : [] };
  },
}));
vi.mock('@/lib/analytics', () => ({ logEvent: mocks.logEvent }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/parenting-reminders', async (orig) => ({ ...(await orig<typeof import('@/lib/parenting-reminders')>()), syncParentingReminders: vi.fn() }));

import ParentingHomeCard from './tools/parenting/ParentingHomeCard';
import BooksHomeCarousel from './books/BooksHomeCarousel';
import { TIPS } from '@/data/parenting/az/tips';
import { BOOKS } from '@/lib/books/catalog';
import { loadParentingContent } from '@/data/parenting';

// The tool content is a lazy chunk: load it once so the card renders in the first pass, as after any earlier visit.
beforeAll(async () => { await loadParentingContent('az', { overrides: false }); });

const NOW = new Date(2026, 10, 7, 10); // Aysel (2024-07-07) is 2 years 4 months → band 1–3

beforeEach(() => {
  localStorage.clear();
  Object.assign(mocks, { lifeStage: 'mommy', language: 'az', setting: 'on', disabled: [], birth: '2024-07-07' });
  mocks.logEvent.mockClear();
});
afterEach(cleanup);

describe('Tərbiyə home card', () => {
  it('shows today’s 1–3 tip for the active child and opens the tool', () => {
    const onOpen = vi.fn();
    render(<ParentingHomeCard onOpen={onOpen} now={NOW} />);
    const card = screen.getByTestId('parenting-home-card');
    expect(within(card).getByText('Tərbiyə · Günün məsləhəti')).toBeInTheDocument();
    expect(within(card).getByText('1–3 yaş')).toBeInTheDocument();
    expect(TIPS['1-3'].some((t) => within(card).queryByText(t.title))).toBe(true);
    fireEvent.click(within(card).getAllByRole('button').at(-1)!);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('follows the band the parent picked inside the tool', () => {
    localStorage.setItem('anacan.parenting.v1.u1', JSON.stringify({ v: 1, band: '6-12' }));
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    expect(screen.getByText('6–12 yaş')).toBeInTheDocument();
    expect(TIPS['6-12'].some((t) => screen.queryByText(t.title))).toBe(true);
  });

  it('shows a "Continue" line for a running programme that opens that programme', async () => {
    const { PROGRAMMES } = await import('@/data/parenting/az/programmes');
    const { peekParentingTarget, clearParentingTarget } = await import('@/lib/parenting-target');
    clearParentingTarget();
    const p = PROGRAMMES[0];
    localStorage.setItem('anacan.parenting.v1.u1', JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [],
      programmes: { [p.id]: { startedAt: '2026-11-05', done: ['2026-11-05', '2026-11-06'], updatedAt: '2026-11-06T09:00:00.000Z' } } }));
    const onOpen = vi.fn();
    render(<ParentingHomeCard onOpen={onOpen} now={NOW} />);
    const row = screen.getByTestId('parenting-home-continue');
    expect(row).toHaveTextContent(`Davam et: ${p.title}`);
    expect(row).toHaveTextContent(`Gün 3/${p.days.length}`);
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(peekParentingTarget()).toEqual({ kind: 'programme', id: p.id });
    clearParentingTarget();
  });

  it('has no "Continue" line without a running programme', () => {
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    expect(screen.queryByTestId('parenting-home-continue')).toBeNull();
  });

  it.each([
    ['the admin switch is off', { setting: 'off' }],
    ['the switch is missing', { setting: undefined }],
    ['the app language is not az', { language: 'en' }],
    ['the module is not Ana', { lifeStage: 'bump' }],
    ['the child is 13 or older', { birth: '2013-01-01' }],
    ['the tool is disabled for the language', { disabled: ['parenting'] }],
  ])('is hidden when %s', (_name, patch) => {
    Object.assign(mocks, patch);
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    expect(screen.queryByTestId('parenting-home-card')).toBeNull();
  });
});

describe('Books home carousel', () => {
  it('shows the 10 books of the child’s age group with cover, title and age', () => {
    render(<BooksHomeCarousel childMonths={28} onOpen={vi.fn()} />);
    const rail = screen.getByTestId('books-home-carousel');
    expect(rail).toHaveAttribute('data-age', '2y');
    expect(within(rail).getByText('Yaşına uyğun kitablar')).toBeInTheDocument();
    const slides = within(rail).getAllByRole('listitem');
    expect(slides).toHaveLength(10);
    const expected = BOOKS.filter((b) => b.age === '2y');
    expected.forEach((book) => expect(within(rail).getByText(book.title)).toBeInTheDocument());
    expect(slides[0].querySelector('img')?.getAttribute('src')).toBe(`/books/covers/${expected[0].id}.webp`);
    expect(within(slides[0]).getByText('2+ yaş')).toBeInTheDocument();
    expect(rail.textContent).not.toMatch(/₼/);
  });

  it('falls back to the youngest group without a child age', () => {
    render(<BooksHomeCarousel childMonths={null} onOpen={vi.fn()} />);
    expect(screen.getByTestId('books-home-carousel')).toHaveAttribute('data-age', '6m');
  });

  it('opens the book store from a slide and from the header', () => {
    const onOpen = vi.fn();
    render(<BooksHomeCarousel childMonths={8} onOpen={onOpen} />);
    fireEvent.click(screen.getAllByRole('listitem')[3].querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: /Hamısı/ }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(mocks.logEvent).toHaveBeenCalledWith('books_reco_clicked', expect.objectContaining({ mode: 'mommy_carousel', age: '6m' }));
  });
});
