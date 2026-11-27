import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  premium: false,
  birth: '2025-09-09',
  gender: 'girl' as string,
  share: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'az-AZ' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium }) }));
vi.mock('@/hooks/useEmergencyNumber', () => ({ useEmergencyNumber: () => '911' }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn() }));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => {
    const child = { id: 'c1', name: 'Nərmin', birth_date: mocks.birth, gender: mocks.gender };
    return { selectedChild: child, children: [child] };
  },
}));
vi.mock('@/lib/native', () => ({ nativeShare: mocks.share }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/lib/scroll', () => ({ resetAppScrollPosition: vi.fn() }));
vi.mock('@/lib/weaning-reminders', () => ({ syncWeaningReminders: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));
vi.mock('@/components/premium/PremiumBlurGate', () => ({
  default: ({ title }: { title: string }) => <div data-testid="premium-gate">{title}</div>,
}));
vi.mock('@/components/tools/anacan/ToolKit', () => ({
  ToolPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: ({ title, eyebrow, onBack }: { title: string; eyebrow: string; onBack: () => void }) =>
    <header><button onClick={onBack}>back</button><p>{eyebrow}</p><h1>{title}</h1></header>,
}));
vi.mock('@/integrations/supabase/client', () => {
  // Thenable query chain: every filter returns the chain, awaiting it yields an empty result.
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { supabase: { from: () => ({ ...chain, upsert: (...a: unknown[]) => { mocks.upsert(...a); return Promise.resolve({ error: null }); } }) } };
});

import WeaningTool from './WeaningTool';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';
import { createPlan, DEFAULT_FEEDS } from '@/lib/weaning';
import { EMPTY_LOCAL } from '@/lib/weaning-sync';

const NOW = new Date(2026, 10, 9, 10);
const KEY = 'anacan.weaning.v1.u1';
const stored = () => JSON.parse(localStorage.getItem(KEY) || 'null');
const seedPlan = (start: string, extra: Partial<ReturnType<typeof EMPTY_LOCAL>> = {}) => {
  const plan = createPlan({ feeds: DEFAULT_FEEDS, pace: 'gentle', nightMode: 'last', start, childId: 'c1', now: NOW });
  localStorage.setItem(KEY, JSON.stringify({ ...EMPTY_LOCAL(), plan, planDirty: false, ...extra }));
  return plan;
};
const open = () => render(<WeaningTool onBack={vi.fn()} now={NOW} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const answerCheckin = () => {
  click('Şən');
  click('5 və çox');
  click('Normal');
  click('Yaxşı');
};

beforeEach(() => {
  localStorage.clear();
  mocks.premium = false;
  mocks.birth = '2025-09-09';
  mocks.gender = 'girl';
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('Süddən ayırma screens', () => {
  it('shows the intro and remembers "continue breastfeeding"', () => {
    open();
    expect(screen.getByText('Tələsmədən, zərərsiz, sevgi ilə')).toBeInTheDocument();
    click('Yadda saxla, sonra soruşma');
    expect(stored().continueBF).toBe(true);
    expect(screen.getByText('Əmizdirməyə davam edirsiniz 🤍')).toBeInTheDocument();
    cleanup();
    open();
    expect(screen.getByText('Əmizdirməyə davam edirsiniz 🤍')).toBeInTheDocument();
  });

  it('builds no plan under 12 months', () => {
    mocks.birth = '2026-01-09';
    open();
    click('Plan quraq');
    expect(screen.getByText('12 aydan kiçik uşaq üçün plan qurmuruq')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bəli' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Davam et/ })).toBeNull();
    click('Qidalanma haqqında oxu');
    expect(screen.getByText('12–23 ay: adi pasterizə olunmuş süd')).toBeInTheDocument();
  });

  it('suggests a delay for a sick child that the mother can override', () => {
    open();
    click('Plan quraq');
    for (const group of ['Uşaq hazırda xəstədir və ya diş çıxarır?', 'Yaxın 2–3 həftədə böyük dəyişiklik var?', 'İnək südünə allergiya var və ya şübhə edilir?']) {
      fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: group.startsWith('Uşaq') ? 'Bəli' : 'Xeyr' }));
    }
    expect(screen.getByText('Uşaq sağalana qədər gözləmək daha rahat olar')).toBeInTheDocument();
    click('Planı qur, başlanğıcı sonraya qoy');
    expect(screen.getByText(/tövsiyə edilən gecikmə/)).toBeInTheDocument();
    click('Bu gün başlayıram');
    expect(screen.queryByText(/tövsiyə edilən gecikmə/)).toBeNull();
    click('Planı yarat');
    expect(stored().plan.steps[0].start).toBe('2026-11-09');
  });

  it('builds a plan (no one-day pace) and locks the timeline for free users', () => {
    open();
    click('Plan quraq');
    for (const b of screen.getAllByRole('button', { name: 'Xeyr' })) fireEvent.click(b);
    expect(screen.getByText('Başlamaq üçün yaxşı vaxtdır')).toBeInTheDocument();
    click('Davam et');
    expect(screen.getByRole('button', { name: /Yumşaq/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Orta/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1 gün|bir gün/i })).toBeNull();
    click('Planı yarat');
    const plan = stored().plan;
    expect(plan.steps.map((s: { type: string }) => s.type)).toEqual(['day', 'day', 'nap', 'morning', 'night', 'bedtime']);
    expect(screen.getByTestId('weaning-today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bu addım rahat keçdi' })).toBeDisabled();
    expect(screen.getByTestId('premium-gate')).toHaveTextContent('Fərdi təqvim və xatırlatmalar');
    expect(screen.queryByTestId('weaning-timeline')).toBeNull();
    expect(screen.getByText(/Xatırlatmalar · Premium/)).toBeInTheDocument();
  });

  it('shows the timeline to Premium users and opens "done" from day 3', () => {
    mocks.premium = true;
    seedPlan('2026-11-07');
    open();
    expect(screen.getByTestId('weaning-timeline')).toBeInTheDocument();
    expect(screen.queryByTestId('premium-gate')).toBeNull();
    expect(screen.getByText(/Xatırlatmalar açıq/)).toBeInTheDocument();
    const done = screen.getByRole('button', { name: 'Bu addım rahat keçdi' });
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(stored().plan.steps[0].status).toBe('done');
    expect(screen.getByText(/Ən tez/)).toBeInTheDocument();
  });

  it('opens a step with swap, tips, crying help, partner hint and the 3-day extension', () => {
    mocks.premium = true;
    seedPlan('2026-11-08');
    open();
    click('Necə edim?');
    expect(screen.getByText('Uşaq ağlayıb istəsə?')).toBeInTheDocument();
    expect(screen.getByText('Bu saatda uşaqla gəzintiyə çıxsın və ya oyun qursun.')).toBeInTheDocument();
    click('Partnyora tapşırıq göndər');
    expect(mocks.share).toHaveBeenCalled();
    click('Bu addımı 3 gün uzat');
    expect(stored().plan.steps[0].len).toBe(10);
  });

  it('pauses the plan and sends to a doctor for lump + fever', () => {
    seedPlan('2026-11-08');
    open();
    click(/Bugünkü check-in/);
    answerCheckin();
    click('Bərk, ağrılı düyün');
    click('Qızdırma 38°C və yuxarı');
    click('Yadda saxla');
    expect(screen.getByText('Mastit əlamətləri ola bilər · planı dayandırdıq')).toBeInTheDocument();
    expect(stored().plan).toMatchObject({ status: 'paused', pauseReason: 'doctor' });
    expect(stored().checkins[0]).toMatchObject({ tone: 'red', planId: stored().plan.id });
    click('Plana qayıt');
    expect(screen.getByText('Plan dayandırılıb')).toBeInTheDocument();
  });

  it('uses the country emergency number for dehydration and links low mood to the Mood diary', () => {
    open();
    click(/Ana üçün/);
    expect(screen.getByText(/Təcili: 911\./)).toBeInTheDocument();
    cleanup();
    seedPlan('2026-11-08');
    open();
    click(/Bugünkü check-in/);
    click('Şən');
    click('4-dən az');
    click('Normal');
    click('Kədərli, ağlamaqlı');
    click('Xəstədir (qızdırma, ishal, qusma)');
    click('Yadda saxla');
    expect(screen.getByText('Uşaqda susuzlaşma riski · həkimə müraciət edin')).toBeInTheDocument();
    expect(screen.getByText(/Təcili hallarda: 911\./)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/(^|\D)103(\D|$)/);
    expect(screen.getByRole('link', { name: /911/ })).toHaveAttribute('href', 'tel:911');
    const nav = vi.fn();
    window.addEventListener(PUSH_NAV_EVENT, nav);
    click('Əhval Gündəliyində qeyd et');
    window.removeEventListener(PUSH_NAV_EVENT, nav);
    expect((nav.mock.calls[0][0] as CustomEvent).detail).toEqual({ tool: 'mood-diary' });
  });

  it('extends the step for very full breasts', () => {
    seedPlan('2026-11-08');
    open();
    click(/Bugünkü check-in/);
    click('Şən');
    click('5 və çox');
    click('Çox dolğun, ağrılı');
    click('Yaxşı');
    click('Xəstədir (qızdırma, ishal, qusma)');
    click('Yadda saxla');
    expect(screen.getByText('Döş çox dolğundur · addımı 2 gün uzadırıq')).toBeInTheDocument();
    expect(screen.getByText(/Xəstə uşağı əmizdirmək olar/)).toBeInTheDocument();
    expect(stored().plan.steps[0].len).toBe(9);
    expect(screen.getByText('Plan yeniləndi')).toBeInTheDocument();
  });

  it('offers a pause for a sick child', () => {
    seedPlan('2026-11-08');
    open();
    click(/Bugünkü check-in/);
    answerCheckin();
    click('Xəstədir (qızdırma, ishal, qusma)');
    click('Yadda saxla');
    expect(screen.getByText('Uşaq xəstədir · fasilə təklif edirik')).toBeInTheDocument();
    click('Planı sağalana qədər dayandır');
    expect(stored().plan).toMatchObject({ status: 'paused', pauseReason: 'manual' });
    expect(screen.getByText('Plan fasilədədir')).toBeInTheDocument();
  });

  it('hides the cow-milk advice when an allergy was reported and counts milk cups', () => {
    open();
    click('Süd yerinə nə? Qidalanma');
    expect(screen.getByTestId('weaning-cow-milk')).toBeInTheDocument();
    for (let i = 0; i < 6; i++) click('+ 120 ml');
    expect(screen.getByText('Bu gün: 720 ml')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Çoxdur');
    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ ...EMPTY_LOCAL(), readiness: { sick: false, change: false, allergy: true, reasons: [] } }));
    open();
    click('Süd yerinə nə? Qidalanma');
    expect(screen.queryByTestId('weaning-cow-milk')).toBeNull();
    expect(screen.getByText('Süd allergiyası qeyd etmisiniz')).toBeInTheDocument();
  });

  it('shows the seven myths and the finish card', () => {
    open();
    click('Etməyin: miflər və faktlar');
    expect(screen.getAllByTestId('weaning-myth')).toHaveLength(7);
    cleanup();
    mocks.gender = 'boy';
    const plan = seedPlan('2026-10-01');
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), plan: { ...plan, status: 'finished', steps: plan.steps.map((s) => ({ ...s, status: 'done' })) } }));
    open();
    click('Sonluq kartı');
    expect(screen.getByText('Nərmin artıq böyük oğlandır 🤍')).toBeInTheDocument();
  });

  it('queues changes and pushes the plan to the server', async () => {
    seedPlan('2026-11-08');
    open();
    click(/Fasilə/);
    expect(stored().plan.status).toBe('paused');
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalled(), { timeout: 2000 });
    const [row] = mocks.upsert.mock.calls.find((c) => !Array.isArray(c[0]))!;
    expect(row).toMatchObject({ user_id: 'u1', child_id: 'c1', status: 'paused', pause_reason: 'manual' });
    await vi.waitFor(() => expect(stored().planDirty).toBe(false));
  });
});
