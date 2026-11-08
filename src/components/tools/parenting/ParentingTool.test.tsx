import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  premium: false,
  birth: '2024-07-07' as string | null,
  kids: null as { id: string; name: string; birth_date: string }[] | null,
  selected: null as string | null,
  due: null as string | null,
  profile: null as { user_id: string; linked_partner_id: string | null } | null,
  syncReminders: vi.fn(),
  sendToPartner: vi.fn(async (_a: unknown, _t: string) => true),
  shareSheet: vi.fn(async (_t: string, _title: string) => true),
  partnerShares: [] as { kind: 'sos' | 'article'; id: string; messageId: string; at: string; read: boolean }[],
}));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: mocks.profile, isAdmin: false }) }));
vi.mock('@/lib/parenting-share', async (orig) => ({
  ...(await orig<typeof import('@/lib/parenting-share')>()),
  sendParentingToPartner: mocks.sendToPartner,
  shareParentingItem: mocks.shareSheet,
  readPartnerShares: vi.fn(async () => mocks.partnerShares),
  markPartnerShareRead: vi.fn(async () => {}),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium, loading: false }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => 'on' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/parenting-sync', async (orig) => ({
  ...(await orig<typeof import('@/lib/parenting-sync')>()),
  syncParenting: vi.fn(async (_uid: string, s: unknown) => ({ state: s, ok: false })),
}));
vi.mock('@/lib/parenting-reminders', async (orig) => ({
  ...(await orig<typeof import('@/lib/parenting-reminders')>()),
  syncParentingReminders: mocks.syncReminders,
}));
vi.mock('@/hooks/useEmergencyNumber', () => ({ useEmergencyNumber: () => '103' }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (sel: (s: { language: string }) => unknown) => sel({ language: 'az' }) }));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => {
    if (mocks.kids) return { selectedChild: mocks.kids.find((k) => k.id === mocks.selected) ?? mocks.kids[0], children: mocks.kids };
    const child = mocks.birth ? { id: 'c1', name: 'Aysel', birth_date: mocks.birth, due_date: mocks.due, gender: 'girl' } : null;
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

import ParentingTool, { ParentingToolView } from './ParentingTool';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';
import content from '@/data/parenting/az';
import { loadParentingContent } from '@/data/parenting';
import { openParentingTool } from '@/lib/parenting-nav';

beforeAll(async () => { await loadParentingContent('az', { overrides: false }); });

const NOW = new Date(2026, 10, 7, 10); // Aysel is 2 years 4 months
const KEY = 'anacan.parenting.v1.u1';
const stored = () => JSON.parse(localStorage.getItem(KEY) || 'null');
const open = () => render(<ParentingTool onBack={vi.fn()} now={NOW} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const INTRO = 'anacan.parenting.intro.v1.u1';
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(INTRO, '1'); // the first-run intro has its own tests below
  mocks.premium = false;
  mocks.birth = '2024-07-07';
  mocks.kids = null;
  mocks.selected = null;
  mocks.due = null;
  mocks.profile = null;
  mocks.partnerShares = [];
  mocks.syncReminders.mockClear();
  mocks.sendToPartner.mockClear();
  mocks.shareSheet.mockClear();
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

  it('opens directly on the item an Anacan.AI card points to; back returns to the tool home', () => {
    openParentingTool({ kind: 'sos', id: 'shop-tantrum' });
    open();
    expect(screen.getByText('Əvvəlcə özünü sakitləşdir')).toBeInTheDocument();
    click('back');
    expect(screen.getByText('Günün məsləhəti')).toBeInTheDocument();
  });

  it('searches the library diacritic-insensitively with grouped results and lock state', () => {
    open();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tərbiyədə axtar' }), { target: { value: 'yatmaq istemir' } });
    expect(screen.getByText('SOS kartları')).toBeInTheDocument();
    expect(screen.queryByText('Günün məsləhəti')).toBeNull();
    const row = screen.getByRole('button', { name: /Yatmaq istəmir/ });
    expect(row.querySelector('.lk')).not.toBeNull(); // Premium card keeps its lock
    fireEvent.click(row);
    expect(screen.getByTestId('premium-gate')).toBeInTheDocument();
    click('back');
    expect(screen.getByRole('searchbox', { name: 'Tərbiyədə axtar' })).toHaveValue('yatmaq istemir');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tərbiyədə axtar' }), { target: { value: 'zzqqxx' } });
    expect(screen.getByText('Heç nə tapılmadı. Başqa sözlə yoxla.')).toBeInTheDocument();
    click('Axtarışı təmizlə');
    expect(screen.getByText('Günün məsləhəti')).toBeInTheDocument();
  });

  it('Premium: turns the daily programme reminder on (default 20:30), keeps it on the phone and pauses with the programme', () => {
    mocks.premium = true;
    const p = content.programmes[2];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: { [p.id]: { startedAt: '2026-11-06', done: ['2026-11-06'], updatedAt: '2026-11-06T08:00:00.000Z' } } }));
    open();
    click(new RegExp(p.title));
    const sw = screen.getByRole('switch', { name: 'Gündəlik xatırlatma' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(stored().reminder).toEqual({ on: true, time: '20:30' });
    expect(screen.getByDisplayValue('20:30')).toBeInTheDocument();
    const last = () => mocks.syncReminders.mock.calls[mocks.syncReminders.mock.calls.length - 1][0] as { dayIndex: number; at: Date }[];
    expect(last()[0]).toMatchObject({ dayIndex: 1, at: new Date(2026, 10, 7, 20, 30) });
    fireEvent.change(screen.getByDisplayValue('20:30'), { target: { value: '21:15' } });
    expect(stored().reminder.time).toBe('21:15');
    expect(last()[0].at).toEqual(new Date(2026, 10, 7, 21, 15));
    click('Fasilə ver');
    expect(stored().programmes[p.id].paused).toBe(true);
    expect(last()).toEqual([]);
    expect(screen.getByText('Proqram fasilədədir — xatırlatma göndərilmir.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bunu etdim ✓' })).toBeNull();
    click('Davam et');
    expect(last().length).toBeGreaterThan(0);
  });

  it('free users can turn the reminder on for the free days (1–3) only', () => {
    const p = content.programmes[2];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: { [p.id]: { startedAt: '2026-11-07', done: [], updatedAt: '2026-11-07' } } }));
    open();
    click(new RegExp(p.title));
    const card = screen.getByTestId('parenting-reminder');
    expect(within(card).getByText('İlk 3 gün üçün xatırlatma pulsuzdur.')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('switch', { name: 'Gündəlik xatırlatma' }));
    expect(stored().reminder).toEqual({ on: true, time: '20:30' });
    const last = mocks.syncReminders.mock.calls[mocks.syncReminders.mock.calls.length - 1][0] as { dayIndex: number }[];
    expect(last.map((s) => s.dayIndex)).toEqual([0, 1, 2]);
  });

  it('free users see the reminder as a Premium feature once the free days are done', () => {
    const p = content.programmes[2];
    localStorage.setItem(KEY, JSON.stringify({
      v: 1, band: null, quizzes: {}, saved: [], reminder: { on: true, time: '20:30' },
      programmes: { [p.id]: { startedAt: '2026-11-04', done: ['2026-11-04', '2026-11-05', '2026-11-06'], updatedAt: '2026-11-06' } },
    }));
    open();
    click(new RegExp(p.title));
    expect(screen.queryByRole('switch')).toBeNull();
    expect(within(screen.getByTestId('parenting-reminder')).getByText('Xatırlatmalar Premium ilə')).toBeInTheDocument();
    // Nothing is scheduled for Premium days (an older list would be cancelled).
    expect(mocks.syncReminders.mock.calls.every((c) => (c[0] as unknown[]).length === 0)).toBe(true);
  });
});

describe('Tərbiyə first-run intro', () => {
  it('shows a skippable 3-step intro once per device and account', () => {
    localStorage.removeItem(INTRO);
    open();
    const intro = screen.getByTestId('parenting-intro');
    expect(within(intro).getByText('Yaşa görə bələdçi')).toBeInTheDocument();
    expect(within(intro).getByText('Addım 1/3')).toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('button', { name: 'Növbəti' }));
    expect(within(intro).getByText('Çətin anlar üçün SOS')).toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('button', { name: 'Növbəti' }));
    expect(within(intro).getByText('Qısa proqramlar və testlər')).toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('button', { name: 'Başla' }));
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
    expect(localStorage.getItem(INTRO)).toBe('1');
    cleanup();
    open();
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
  });

  it('asks for the age band when there is no birth date instead of defaulting to 1–3', () => {
    localStorage.removeItem(INTRO);
    mocks.birth = null;
    open();
    const intro = screen.getByTestId('parenting-intro');
    fireEvent.click(within(intro).getByRole('button', { name: 'Növbəti' }));
    fireEvent.click(within(intro).getByRole('button', { name: 'Növbəti' }));
    fireEvent.click(within(intro).getByRole('button', { name: 'Növbəti' }));
    expect(within(intro).getByText('Uşağın neçə yaşındadır?')).toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('button', { name: '3–6 yaş' }));
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
    expect(stored().band).toBe('3-6');
    expect(screen.getByRole('button', { name: '3–6 yaş' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('can be skipped at once; never shown to a parent who already used the tool or on a deep link', () => {
    localStorage.removeItem(INTRO);
    open();
    fireEvent.click(within(screen.getByTestId('parenting-intro')).getByRole('button', { name: 'Keç' }));
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
    expect(localStorage.getItem(INTRO)).toBe('1');
    cleanup();
    localStorage.clear();
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: ['a:lying'], programmes: {} }));
    open();
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
    expect(localStorage.getItem(INTRO)).toBe('1');
    cleanup();
    localStorage.clear();
    openParentingTool({ kind: 'sos', id: 'shop-tantrum' });
    open();
    expect(screen.queryByTestId('parenting-intro')).toBeNull();
  });
});

describe('Tərbiyə with several children', () => {
  const KIDS = [
    { id: 'teen', name: 'Ali', birth_date: '2010-02-01' },
    { id: 'kid-a', name: 'Aysel', birth_date: '2024-07-07' },
    { id: 'kid-b', name: 'Nur', birth_date: '2020-03-01' },
  ];

  it('offers a switcher for the children under 13 and follows the selected child’s band', () => {
    mocks.kids = KIDS;
    mocks.selected = 'teen'; // 13+: the tool starts on the first younger sibling
    open();
    const sw = screen.getByTestId('parenting-child-switch') as HTMLSelectElement;
    expect([...sw.options].map((o) => o.textContent)).toEqual(['Aysel', 'Nur']);
    expect(sw.value).toBe('kid-a');
    expect(screen.getByRole('button', { name: '1–3 yaş' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(sw, { target: { value: 'kid-b' } });
    expect(screen.getByRole('button', { name: '6–12 yaş' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Nur · 6 yaş').length).toBeGreaterThan(0);
  });

  it('keeps quiz results and programme progress per child; old account data becomes the first child’s', () => {
    mocks.kids = KIDS.slice(1);
    const p = content.programmes[0];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, saved: [], quizzes: { style: { at: '2026-11-01', result: 'gentle' } },
      programmes: { [p.id]: { startedAt: '2026-11-01', done: ['2026-11-01'], updatedAt: '2026-11-01' } } }));
    open();
    expect(stored().rootChild).toBe('kid-a');
    expect(screen.getByText(/Son nəticə:/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('parenting-child-switch'), { target: { value: 'kid-b' } });
    expect(screen.queryByText(/Son nəticə:/)).toBeNull();
    click(/Mənim tərbiyə üslubum/);
    click('Testə başla');
    content.styleQuiz.items.forEach(() => click('Bəzən'));
    expect(stored().children['kid-b'].quizzes.style).toBeDefined();
    expect(stored().quizzes.style.result).toBe('gentle'); // the first child's result is untouched
  });

  it('a manual band chosen for a child expires when the child has moved to another band', () => {
    mocks.kids = [KIDS[1]];
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: '6-12', bandAt: '2026-01-01T00:00:00.000Z', bandFor: '0-1', saved: [], quizzes: {}, programmes: {} }));
    open();
    expect(screen.getByRole('button', { name: '1–3 yaş' })).toHaveAttribute('aria-pressed', 'true');
    expect(stored()).toMatchObject({ band: null, bandFor: '1-3' });
  });
});

describe('Tərbiyə quiz back and programme completion', () => {
  it('style quiz: the previous question keeps the answers', () => {
    open();
    click(/Mənim tərbiyə üslubum/);
    click('Testə başla');
    expect(screen.queryByRole('button', { name: 'Əvvəlki sual' })).toBeNull();
    click('Demək olar ki, həmişə');
    expect(screen.getByText(`Sual 2/${content.styleQuiz.items.length}`)).toBeInTheDocument();
    click('Əvvəlki sual');
    expect(screen.getByText(`Sual 1/${content.styleQuiz.items.length}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demək olar ki, həmişə' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('milestone check: back from the regression question returns to the last item with its answer', () => {
    open();
    click(/Uşağım bu yaşda nə bacarmalıdır\?/);
    click('Testə başla');
    const cp = content.milestoneQuiz.checkpoints.find((x) => x.id === 'm18')!;
    cp.items.forEach(() => click('Bəli'));
    expect(screen.getByText(content.milestoneQuiz.regression)).toBeInTheDocument();
    click('Əvvəlki sual');
    expect(screen.getByText(cp.items[cp.items.length - 1].text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bəli' })).toHaveAttribute('aria-pressed', 'true');
    click('Hələ yox');
    click('Hələ yox');
    expect(stored().quizzes.milestones).toBeDefined();
  });

  it('free users see "first days free" on programme rows instead of a bare Premium badge', () => {
    open();
    const rows = content.programmes.filter((p) => p.bands.includes('1-3'));
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) {
      const row = screen.getByRole('button', { name: new RegExp(p.title) });
      expect(row).toHaveTextContent('İlk 3 gün pulsuz');
      expect(row).not.toHaveTextContent('Premium');
    }
  });

  it('a finished programme shows a summary with the days and a next programme suggestion', () => {
    mocks.premium = true;
    const p = content.programmes[2];
    const done = Array.from({ length: p.days.length }, (_, i) => `2026-10-${String(10 + i).padStart(2, '0')}`);
    localStorage.setItem(KEY, JSON.stringify({ v: 1, band: null, quizzes: {}, saved: [], programmes: { [p.id]: { startedAt: done[0], done, updatedAt: '2026-10-20' } } }));
    open();
    click(new RegExp(p.title));
    const sum = screen.getByTestId('par-programme-summary');
    expect(sum).toHaveTextContent(`${p.days.length} gün tamamlandı`);
    const next = within(sum).getByRole('button');
    expect(content.programmes.some((x) => x.id !== p.id && next.textContent?.includes(x.title))).toBe(true);
    fireEvent.click(next);
    expect(screen.getByRole('button', { name: 'Proqrama başla' })).toBeInTheDocument();
  });
});

describe('Tərbiyə milestone check limits and corrected age', () => {
  const MILESTONE = /Uşağım bu yaşda nə bacarmalıdır\?/;

  it('offers no milestone check for a child older than the last checkpoint + 12 months (8 years)', () => {
    mocks.birth = '2018-05-01';
    open();
    expect(screen.queryByRole('button', { name: MILESTONE })).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(content.styleQuiz.title.replace(/[?()]/g, '.')) })).toBeInTheDocument();
  });

  it('offers no milestone check to a 6-year-old (6–12 band, owner decision)', () => {
    mocks.birth = '2020-03-01';
    open();
    expect(screen.queryByRole('button', { name: MILESTONE })).toBeNull();
  });

  it('opened directly for an older child it shows a short note instead of the quiz', async () => {
    const { QuizScreen } = await import('./ParentingScreens');
    const ctx = {
      content, band: '6-12', childBand: '6-12', childName: 'Aysel', childAgeLabel: null, ageMonths: 100, milestoneMonths: 100, isPremium: false,
      emergency: '103', today: '2026-11-07', local: { v: 1, band: null, programmes: {}, quizzes: {}, saved: [] },
      slot: { band: null, programmes: {}, quizzes: {} }, updateSlot: vi.fn(), update: vi.fn(), updateLocal: vi.fn(), go: vi.fn(), track: vi.fn(),
      query: '', setQuery: vi.fn(), reminderAllowed: true,
    } as unknown as Parameters<typeof QuizScreen>[0]['ctx'];
    render(<QuizScreen ctx={ctx} id="milestones" />);
    expect(screen.getByTestId('par-milestone-late')).toHaveTextContent('Bu yoxlama 7 yaşa qədər olan uşaqlar üçündür.');
    expect(screen.queryByRole('button', { name: 'Testə başla' })).toBeNull();
  });

  it('uses the corrected age for a preterm baby (10 months, born ~31 weeks → the 4-month checkpoint)', () => {
    mocks.birth = '2026-01-08';
    mocks.due = '2026-03-15';
    open();
    click(MILESTONE);
    expect(screen.getByText('4 ay')).toBeInTheDocument();
    expect(screen.getByTestId('par-milestone-corrected')).toHaveTextContent('düzəldilmiş yaşa görə aparılır: 7 ay');
  });

  it('a term baby of the same age gets the 9-month checkpoint and no correction note', () => {
    mocks.birth = '2026-01-08';
    mocks.due = '2026-01-10';
    open();
    click(MILESTONE);
    expect(screen.getByText('9 ay')).toBeInTheDocument();
    expect(screen.queryByTestId('par-milestone-corrected')).toBeNull();
  });
});

describe('Tərbiyə sources, support cards and sharing', () => {
  it('shows the SOS card’s sources from the shared list', () => {
    open();
    click(/Mağazada yerə yıxılıb ağlayır/);
    const src = screen.getByText('Elmi mənbələr').closest('footer')!;
    expect(src.querySelectorAll('li')).toHaveLength(3);
    expect(src).toHaveTextContent('AAP — HealthyChildren.org');
  });

  it('the daily tip links to the band overview’s sources', () => {
    open();
    click('Mənbələr');
    expect(screen.getByText('Elmi mənbələr')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bu yaşda nə baş verir?');
  });

  it('shows the mental-health support card with the mood tool and the emergency call on “about to lose it”', () => {
    mocks.birth = '2026-03-01';
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(PUSH_NAV_EVENT, on);
    openParentingTool({ kind: 'sos', id: 'about-to-lose-it' });
    open();
    const card = screen.getByTestId('par-support-mental-health');
    expect(card).toHaveTextContent('Sənin üçün də dəstək var');
    expect(within(card).getByRole('link')).toHaveAttribute('href', 'tel:103');
    fireEvent.click(within(card).getByRole('button', { name: 'Əhval testi və dəstək' }));
    window.removeEventListener(PUSH_NAV_EVENT, on);
    expect(seen).toContainEqual({ tool: 'mental-health' });
  });

  it('shows the child-safety card on the body-safety article; no support card on ordinary articles', () => {
    openParentingTool({ kind: 'article', id: 'body-safety' });
    open();
    expect(screen.getByTestId('par-support-child-safety')).toHaveTextContent('dərhal 103 nömrəsinə zəng et');
    cleanup();
    openParentingTool({ kind: 'article', id: 'whining' });
    open();
    expect(screen.queryByTestId('par-support-child-safety')).toBeNull();
    expect(screen.queryByTestId('par-support-mental-health')).toBeNull();
  });

  it('a mother with a linked partner sends an SOS card to him; the message links to the card', async () => {
    mocks.profile = { user_id: 'u1', linked_partner_id: 'partner-profile' };
    openParentingTool({ kind: 'sos', id: 'shop-tantrum' });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Partnyora göndər' }));
    expect(await screen.findByText('Partnyoruna göndərildi ✓')).toBeInTheDocument();
    const [actor, text] = mocks.sendToPartner.mock.calls[0] as [unknown, string];
    expect(actor).toEqual({ userId: 'u1', partnerProfileId: 'partner-profile' });
    expect(text).toContain('Mağazada yerə yıxılıb ağlayır');
    expect(text).toContain('https://app.anacan.az/parenting/sos/shop-tantrum');
  });

  it('without a linked partner only the share sheet is offered (title + summary)', () => {
    openParentingTool({ kind: 'article', id: 'whining' });
    open();
    expect(screen.queryByRole('button', { name: 'Partnyora göndər' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Paylaş' }));
    const [text, title] = mocks.shareSheet.mock.calls[0] as [string, string];
    const article = content.articles.find((a) => a.id === 'whining')!;
    expect(title).toBe(article.title);
    expect(text).toContain(article.summary);
  });

  it('the partner sees the items she sent him and opens one in his Tərbiyə screen', async () => {
    mocks.partnerShares = [{ kind: 'sos', id: 'shop-tantrum', messageId: 'm1', at: '2026-11-07T10:00:00Z', read: false }];
    render(<ParentingToolView onBack={vi.fn()} now={NOW} child={{ id: 'c1', name: 'Aysel', birth_date: '2024-07-07' }} partner />);
    const list = await screen.findByTestId('par-partner-shares');
    expect(list).toHaveTextContent('Sənə göndərilənlər');
    fireEvent.click(within(list).getByRole('button', { name: /Mağazada yerə yıxılıb ağlayır/ }));
    expect(screen.getByText('Əvvəlcə özünü sakitləşdir')).toBeInTheDocument();
    // His screen: no "send to partner" and no Tools-tab mood tool button.
    expect(screen.queryByRole('button', { name: 'Partnyora göndər' })).toBeNull();
  });
});
