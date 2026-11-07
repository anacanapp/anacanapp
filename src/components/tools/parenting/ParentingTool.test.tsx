import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ premium: false, birth: '2024-07-07' as string | null }));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium }) }));
vi.mock('@/hooks/useEmergencyNumber', () => ({ useEmergencyNumber: () => '103' }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (sel: (s: { language: string }) => unknown) => sel({ language: 'az' }) }));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => {
    const child = mocks.birth ? { id: 'c1', name: 'Aysel', birth_date: mocks.birth, gender: 'girl' } : null;
    return { selectedChild: child, children: child ? [child] : [] };
  },
}));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/lib/scroll', () => ({ resetAppScrollPosition: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ analytics: { logToolUsed: vi.fn() } }));
vi.mock('@/components/premium/PremiumBlurGate', () => ({
  default: ({ title }: { title: string }) => <div data-testid="premium-gate">{title}</div>,
}));
vi.mock('@/components/tools/anacan/ToolKit', () => ({
  ToolPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: ({ title, eyebrow, onBack, actions }: { title: string; eyebrow?: string; onBack: () => void; actions?: React.ReactNode }) =>
    <header><button onClick={onBack}>back</button><p>{eyebrow}</p><h1>{title}</h1>{actions}</header>,
}));

import ParentingTool from './ParentingTool';
import content from '@/data/parenting/az';

const NOW = new Date(2026, 10, 7, 10); // Aysel is 2 years 4 months
const KEY = 'anacan.parenting.v1.u1';
const stored = () => JSON.parse(localStorage.getItem(KEY) || 'null');
const open = () => render(<ParentingTool onBack={vi.fn()} now={NOW} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  mocks.premium = false;
  mocks.birth = '2024-07-07';
});
afterEach(cleanup);

describe('Tərbiyə tool', () => {
  it('opens on the child’s age band with the daily tip and the child chip', () => {
    open();
    expect(screen.getAllByText('Aysel · 2 yaş 4 ay').length).toBeGreaterThan(0);
    expect(screen.getByText('Günün məsləhəti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1–3 yaş' })).toHaveAttribute('aria-pressed', 'true');
    const tipTitles = content.tips['1-3'].map((t) => t.title);
    expect(tipTitles.some((t) => screen.queryByText(t))).toBe(true);
    expect(screen.getByText('Aysel üçün seçildi')).toBeInTheDocument();
  });

  it('switches the age band and remembers the choice', () => {
    open();
    click('6–12 yaş');
    expect(stored().band).toBe('6-12');
    expect(screen.getByText('6–12 yaş: bacarıq, dostluq, özünəinam')).toBeInTheDocument();
    click('1–3 yaş');
    expect(stored().band).toBeNull();
  });

  it('lets the parent pick a band when there is no child', () => {
    mocks.birth = null;
    open();
    expect(screen.getByRole('button', { name: '1–3 yaş' })).toHaveAttribute('aria-pressed', 'true');
    click('0–1 yaş');
    expect(screen.getByText('İlk il: güvən təməli')).toBeInTheDocument();
  });

  it('shows a free article in full and gates a Premium one, keeping specialist signals free', () => {
    open();
    click(/Emosiyalar və tantrumlar/);
    click(/Tantrum: beyində nə baş verir\?/);
    expect(screen.getByText(/Bu gün sına/)).toBeInTheDocument();
    expect(screen.queryByTestId('premium-gate')).toBeNull();
    click('back');
    click(/Mızıldanma və nazlanma/);
    expect(screen.getByTestId('premium-gate')).toHaveTextContent('Davamı Premium-dadır');
    expect(screen.queryByText(/Bu gün sına/)).toBeNull();
    expect(screen.getByText(/Nə vaxt mütəxəssisə müraciət etməli/)).toBeInTheDocument();
    expect(screen.getAllByText('Elmi mənbələr').length).toBe(1);
  });

  it('shows Premium articles in full for Premium users', () => {
    mocks.premium = true;
    open();
    click(/Emosiyalar və tantrumlar/);
    click(/Mızıldanma və nazlanma/);
    expect(screen.queryByTestId('premium-gate')).toBeNull();
    expect(screen.getByText(/Bu gün sına/)).toBeInTheDocument();
  });

  it('opens a free SOS card with 3 steps, the script and an age switch; Premium cards are gated', () => {
    open();
    click(/Mağazada yerə yıxılıb ağlayır/);
    expect(screen.getByText('Əvvəlcə özünü sakitləşdir')).toBeInTheDocument();
    expect(screen.getByText('Belə deyə bilərsən')).toBeInTheDocument();
    expect(screen.getByText(/Yayındırmaq çox işləyir/)).toBeInTheDocument();
    click('3–6 yaş');
    expect(screen.getByText(/siyahını tutan köməkçimsən/)).toBeInTheDocument();
    click('back');
    click(/Yatmaq istəmir/);
    expect(screen.getByTestId('premium-gate')).toBeInTheDocument();
  });

  it('fills the emergency number from the country helper in red-flag boxes', () => {
    open();
    expect(screen.getByRole('link', { name: /Zəng et: 103/ })).toHaveAttribute('href', 'tel:103');
  });

  it('bookmarks an article and lists it under saved', () => {
    open();
    click(/Emosiyalar və tantrumlar/);
    click(/Tantrum: beyində nə baş verir\?/);
    click('Yadda saxla');
    expect(stored().saved).toEqual(['a:tantrum-brain']);
    click('back');
    click('back');
    click('Saxlanılanlar');
    expect(screen.getByText('Tantrum: beyində nə baş verir?')).toBeInTheDocument();
  });

  it('runs a programme: one day per calendar day, free days then a Premium gate', () => {
    const p = content.programmes[0];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: {} }));
    open();
    click(new RegExp(p.title));
    click('Proqrama başla');
    expect(stored().programmes[p.id].done).toEqual([]);
    click('Bunu etdim ✓');
    expect(stored().programmes[p.id].done).toEqual(['2026-11-07']);
    expect(screen.queryByRole('button', { name: 'Bunu etdim ✓' })).toBeNull();
    expect(screen.getByText(/Sabah növbəti gün açılacaq/)).toBeInTheDocument();
    cleanup();
    // Three free days done → day 4 is behind the Premium gate.
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: { [p.id]: { startedAt: '2026-11-01', done: ['2026-11-01', '2026-11-02', '2026-11-03'], updatedAt: '2026-11-03' } } }));
    open();
    click(new RegExp(p.title));
    expect(screen.getByText('3/21')).toBeInTheDocument();
    expect(screen.getByTestId('premium-gate')).toHaveTextContent('Proqramlar Premium-dadır');
    expect(screen.queryByRole('button', { name: 'Bunu etdim ✓' })).toBeNull();
  });

  it('lets Premium users continue the programme past the free days', () => {
    mocks.premium = true;
    const p = content.programmes[0];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: { [p.id]: { startedAt: '2026-11-01', done: ['2026-11-01', '2026-11-02', '2026-11-03'], updatedAt: '2026-11-03' } } }));
    open();
    click(new RegExp(p.title));
    click('Bunu etdim ✓');
    expect(stored().programmes[p.id].done).toHaveLength(4);
  });

  it('scores the style quiz; the short result is free and the detail is Premium', () => {
    open();
    click(/Mənim tərbiyə üslubum/);
    click('Testə başla');
    for (let i = 0; i < content.styleQuiz.items.length; i += 1) {
      const isHarshOrGiveIn = ['harsh', 'giveIn'].includes(content.styleQuiz.items[i].dim);
      click(isHarshOrGiveIn ? 'Demək olar ki, heç vaxt' : 'Demək olar ki, həmişə');
    }
    expect(screen.getByText('İsti və aydın')).toBeInTheDocument();
    expect(screen.getByTestId('premium-gate')).toBeInTheDocument();
    expect(stored().quizzes.style.result).toBe('balanced');
  });

  it('sends a flagged milestone answer to the doctor for free', () => {
    open();
    click(/Uşağım bu yaşda nə bacarmalıdır\?/);
    expect(screen.getByText('18 ay')).toBeInTheDocument(); // 28 months → the 18-month checkpoint
    click('Testə başla');
    const cp = content.milestoneQuiz.checkpoints.find((x) => x.id === 'm18')!;
    cp.items.forEach((it) => click(it.text === 'Dəstəksiz yeriyir.' ? 'Hələ yox' : 'Bəli'));
    expect(screen.getByText(content.milestoneQuiz.regression)).toBeInTheDocument();
    click('Hələ yox');
    expect(screen.getByText('Pediatrla danışmağı tövsiyə edirik')).toBeInTheDocument();
    expect(screen.getByText('Dəstəksiz yeriyir.')).toBeInTheDocument();
    expect(stored().quizzes.milestones.result).toBe('talk');
  });
});
