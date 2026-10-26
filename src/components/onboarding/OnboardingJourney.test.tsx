import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '@/store/userStore';
import { ONBOARDING_LANGUAGES, onboardingText } from '@/lib/onboarding-i18n';
import { newOnboardingDraft, writeOnboardingDraft, readOnboardingDraft, onboardingDraftKey, isQuestion, type OnboardingDraft } from '@/lib/onboarding-model';
import { ONBOARDING_OFFERING, ONBOARDING_OFFER_PRODUCT } from '@/lib/onboarding-billing';
import OnboardingJourney from './OnboardingJourney';

const mocks = vi.hoisted(() => ({ native: false, premium: false, profile: {} as any, save: vi.fn(), claim: vi.fn(), complete: vi.fn(), refresh: vi.fn(),
  update: vi.fn(), purchase: vi.fn(), restore: vi.fn(), permission: vi.fn(), purchaseStatus: 'idle', actor: '11111111-1111-4111-8111-111111111111', backend: 'https://api.anacan.az' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.actor }, profile: mocks.profile, refreshProfile: mocks.refresh, updateProfile: mocks.update }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useLifeStageEnabled: () => true }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ useAdSafetyBlock: () => {} }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: mocks.backend }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => mocks.native, getPlatform: () => mocks.native ? 'ios' : 'web' }));
vi.mock('@/lib/onboarding-persistence', () => ({ saveOnboardingSetup: mocks.save, claimOnboardingOffer: mocks.claim, completeOnboarding: mocks.complete, adoptLegacyOnboarding: vi.fn() }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium, loading: false }) }));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: { checkPermissions: async () => ({ receive: 'prompt' }), requestPermissions: mocks.permission } }));
vi.mock('@/components/LegalScreen', () => ({ default: ({ onBack }: any) => <button onClick={onBack}>legal-back</button> }));
vi.mock('@/hooks/useInAppPurchase', async () => {
  const { useState } = await import('react');
  return { useInAppPurchase: () => {
  const [purchaseStatus, setPurchaseStatus] = useState(mocks.purchaseStatus);
  const product = { identifier: 'com.atlasoon.anacan.premium.yearly', price: 29.99, priceString: '$29.99', currencyCode: 'USD', subscriptionPeriod: 'P1Y',
    introPrice: { price: 19.99, priceString: '$19.99', period: 'P1Y', cycles: 1 } };
  const map = (raw: any) => ({ ...raw, _raw: raw });
  return { packages: [map({ identifier: '$rc_annual', packageType: 'ANNUAL', product }), map({ identifier: '$rc_monthly', packageType: 'MONTHLY',
    product: { ...product, identifier: 'com.atlasoon.anacan.premium.monthly', price: 3.99, priceString: '$3.99', subscriptionPeriod: 'P1M', introPrice: null } })],
    offerings: { [ONBOARDING_OFFERING]: [map({ identifier: '$rc_annual', packageType: 'ANNUAL', product: { ...product, identifier: ONBOARDING_OFFER_PRODUCT,
      introPrice: { price: 14.99, priceString: '$14.99', period: 'P1Y', cycles: 1 } } })] }, introEligibility: { [product.identifier]: 2, [ONBOARDING_OFFER_PRODUCT]: 2 },
    isLoading: false, isPurchasing: false, isSupported: mocks.native, purchaseStatus,
    purchaseExact: async (...args: any[]) => { const result = await mocks.purchase(...args); setPurchaseStatus(mocks.purchaseStatus); return result; },
    restorePurchases: mocks.restore, retryActivation: mocks.restore, reloadOfferings: async () => {},
  };
} }; });

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T12:00:00Z'));
  mocks.native = false; mocks.premium = false; mocks.purchaseStatus = 'idle';
  mocks.profile = { user_id: mocks.actor, name: 'Aysel', life_stage: null, country_code: 'AZ', onboarding_answers: null };
  useUserStore.setState({ userId: mocks.actor, isAuthenticated: true, isOnboarded: false, hasSeenIntro: false, language: 'az', hasCompletedFunnel: false });
  mocks.save.mockImplementation(async (draft: OnboardingDraft, _lang: string, progress: (n: number) => void) => {
    progress(100); mocks.profile = { ...mocks.profile, name: draft.name, life_stage: draft.stage, baby_count: draft.babyCount,
      last_period_date: draft.stage === 'bump' ? draft.pregnancyDate : draft.lastPeriodDate,
      onboarding_answers: { ...draft.answers, journey: { version: 3, id: draft.id, revision: 'saved', setupCompletedAt: '2026-09-22', completedAt: null, offerSeenAt: null, plan: draft.plan } } };
    return mocks.profile;
  });
  mocks.claim.mockImplementation(async () => { mocks.profile.onboarding_answers.journey.offerSeenAt = '2026-09-22'; return { changed: true, profile: mocks.profile }; });
  mocks.complete.mockImplementation(async (_actor: string, _backend: string, outcome: string) => {
    mocks.profile.onboarding_answers.journey.completedAt = '2026-09-22';
    mocks.profile.onboarding_answers.journey.outcome = outcome;
    return { changed: true, profile: mocks.profile };
  });
  mocks.purchase.mockResolvedValue(true); mocks.restore.mockResolvedValue(true); mocks.permission.mockResolvedValue({ receive: 'granted' });
  mocks.update.mockImplementation(async (updates: any) => { mocks.profile = { ...mocks.profile, ...updates }; return { data: mocks.profile, error: null }; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });
const step = () => document.querySelector('[data-onboarding-step]')?.getAttribute('data-onboarding-step');
async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => { fireEvent.click(element!); await vi.advanceTimersByTimeAsync(230); });
}
async function fill(selector: string, value: string) { await act(async () => { fireEvent.change(document.querySelector(selector)!, { target: { value } }); }); }
async function travel(stage: 'bump' | 'mommy' | 'flow', stop = 'paywall') {
  for (let count = 0; count < 40 && step() !== stop; count++) {
    const current = step()!;
    if (current === 'stage') { await click(document.querySelector(`[data-stage="${stage}"]`)); continue; }
    if (current === 'data') {
      if (stage === 'bump') await fill('#onb-pregnancy-date', '2026-06-01');
      if (stage === 'flow') await fill('#onb-last-period', '2026-09-01');
      if (stage === 'mommy') {
        await fill('#onb-child-name-0', 'Leyla'); await fill('#onb-birth-0', '2026-08-01');
        const gender = document.querySelector('[data-testid="child-0"] .onb-chips button'); await click(gender);
      }
    }
    if (isQuestion(current)) {
      await click(document.querySelector('[data-answer]'));
      if (step() !== current) continue;
    }
    await click(document.querySelector('.onb-footer .onb-primary'));
  }
  expect(step()).toBe(stop);
}

describe('complete localized journeys', () => {
  it.each(ONBOARDING_LANGUAGES.flatMap(language => (['bump','mommy','flow'] as const).map(stage => ({ language, stage }))))('$language / $stage: all questions, saved data and free continuation', async ({ language, stage }) => {
    useUserStore.setState({ language }); const done = vi.fn();
    render(<OnboardingJourney onComplete={done} />);
    expect(screen.getByRole('heading', { name: onboardingText(language, 'welcome_title') })).toBeInTheDocument();
    await travel(stage);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ actor: mocks.actor, backend: mocks.backend, stage,
      answers: { sleep: 'rested', supportLevel: 'supported', duration: 'months', budget: 'value' } });
    expect(mocks.save.mock.calls[0][1]).toBe(language);
    expect(document.querySelector('.onboarding')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    expect(screen.getByText(onboardingText(language, 'mobile_purchase'))).toBeInTheDocument();
    await click(screen.getByRole('button', { name: onboardingText(language, 'continue_free') }));
    expect(step()).toBe('free');
    await click(screen.getByRole('button', { name: onboardingText(language, 'continue_free') }));
    expect(done).toHaveBeenCalledTimes(1); expect(mocks.complete).toHaveBeenCalledWith(mocks.actor, mocks.backend, 'free', undefined, 'yearly');
    expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
    expect(localStorage.getItem(onboardingDraftKey(mocks.actor, mocks.backend))).toBeNull();
  });
});
it.each([
  { stage: 'mommy' as const,
    plan: ['Yuxu rejimi izləmə', 'Qidalanma izləmə', 'İnkişaf mərhələləri', 'Ağlama analizi', 'Hava və geyim'],
    support: ['Anacan AI', 'Həkim PDF', 'Partnyor hesabı', 'Bəyaz səslər və ağıllı nağıllar', 'Peyvənd təqvimi', 'Sağlam reseptlər', 'Diş çıxarma izləyicisi', 'Mental sağlamlıq və məşqlər', 'Reklamsız təcrübə'],
    mental: 'Mental sağlamlıq və məşqlər' },
  { stage: 'bump' as const,
    plan: ['Fetal böyümə izləyici', 'Qidalanmaya nəzarət', 'Təhlükəsizlik sorğusu', 'Təpik və sancı ölçən', 'Çəki, qan təzyiqi və şəkəri izləyicisi'],
    support: ['Anacan AI', 'Həkim PDF', 'Partnyor hesabı', 'Sağlam reseptlər', 'Xəstəxana çantası və ortaq alış-veriş', 'Hamiləlik albomu, vitamin izləyici', 'Mental sağlamlıq və idman', 'Reklamsız təcrübə'],
    mental: 'Mental sağlamlıq və idman' },
  { stage: 'flow' as const,
    plan: ['Əhval gündəliyi', 'Qidalanmaya nəzarət', 'Vitamin izləyicisi', 'Sağlam reseptlər', 'Mental sağlamlıq və idman'],
    support: ['Anacan AI', 'Həkim PDF', 'Partnyor hesabı', 'Sağlam reseptlər', 'Qidalanmaya nəzarət', 'Vitamin izləyicisi', 'Mental sağlamlıq və idman', 'Reklamsız təcrübə'],
    mental: 'Mental sağlamlıq və idman' },
])('$stage shows the requested benefits through results, support, Premium and monthly offer', async ({ stage, plan, support, mental }) => {
  mocks.native = true;
  render(<OnboardingJourney />); await travel(stage, 'results');
  const benefits = () => within(screen.getByTestId('onboarding-benefits')).getAllByRole('listitem').map(item => item.textContent);
  expect(benefits()).toEqual(plan);
  await click(screen.getByRole('button', { name: onboardingText('az', 'view_plan') }));
  expect(step()).toBe('features'); expect(benefits()).toEqual(support);
  await click(document.querySelector('.onb-footer .onb-primary'));
  expect(step()).toBe('paywall');
  const premium = ['Anacan AI', 'Həkim PDF', 'Partnyor hesabı', mental, 'Reklamsız təcrübə'];
  expect(benefits()).toEqual(premium);
  expect(screen.getByText(onboardingText('az', 'charged_today', { price: '$19.99' }))).toBeInTheDocument();
  expect(screen.getByText(onboardingText('az', 'renewal_year', { price: '$29.99' }))).toBeInTheDocument();
  await click(screen.getByRole('button', { name: onboardingText('az', 'close') }));
  expect(step()).toBe('offer'); expect(benefits()).toEqual(premium);
  const progress = screen.getByRole('progressbar');
  expect(progress).toHaveAttribute('aria-valuenow', progress.getAttribute('aria-valuemax'));
  expect(screen.getByText(onboardingText('az', 'renewal_month', { price: '$3.99' }))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: onboardingText('az', 'restore') })).toBeEnabled();
  expect(screen.getByRole('button', { name: onboardingText('az', 'terms') })).toBeEnabled();
  expect(screen.getByRole('button', { name: onboardingText('az', 'privacy') })).toBeEnabled();
  expect(mocks.save).toHaveBeenCalledTimes(1); expect(mocks.claim).toHaveBeenCalledTimes(1);
  expect(mocks.purchase).not.toHaveBeenCalled();
});
it('stays on an unsuccessful save, keeps answers, and recovers on retry', async () => {
  mocks.save.mockRejectedValueOnce(new Error('ONBOARDING_CHILD_SAVE_FAILED'));
  render(<OnboardingJourney />); await travel('mommy', 'value');
  await click(document.querySelector('.onb-footer .onb-primary'));
  expect(step()).toBe('analysis'); expect(screen.getByRole('alert')).toHaveTextContent(onboardingText('az', 'save_failed'));
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(readOnboardingDraft(mocks.actor, mocks.backend)?.children[0].name).toBe('Leyla');
  await click(screen.getByRole('button', { name: onboardingText('az', 'retry') })); expect(step()).toBe('results');
});
it('keeps results continuation busy until the profile refresh finishes', async () => {
  let finishRefresh!: () => void;
  mocks.refresh.mockImplementationOnce(() => new Promise<void>(resolve => { finishRefresh = resolve; }));
  render(<OnboardingJourney />); await travel('flow', 'value');
  await click(document.querySelector('.onb-footer .onb-primary'));
  expect(step()).toBe('results');
  expect(screen.getByRole('button', { name: onboardingText('az', 'view_plan') })).toBeDisabled();
  await act(async () => { finishRefresh(); });
  await click(screen.getByRole('button', { name: onboardingText('az', 'view_plan') }));
  expect(step()).toBe('features');
});
it('resumes drafts and cancels auto-advance when navigating back', async () => {
  const view = render(<OnboardingJourney />); await travel('flow', 'flowGoal');
  fireEvent.click(document.querySelector('[data-answer]')!);
  fireEvent.click(screen.getByRole('button', { name: onboardingText('az', 'back') }));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); }); expect(step()).toBe('data');
  view.unmount(); render(<OnboardingJourney />); expect(step()).toBe('data');
  expect(document.querySelector('#onb-last-period')).toHaveValue('2026-09-01');
});
it('repairs an existing name without changing dates or enrolling a new funnel', async () => {
  mocks.profile = { ...mocks.profile, name: 'İstifadəçi', life_stage: 'bump', last_period_date: '2026-07-10' };
  const done = vi.fn(); render(<OnboardingJourney onComplete={done} />);
  expect(step()).toBe('name'); await fill('#onb-name', 'Leyla'); await click(document.querySelector('.onb-footer .onb-primary'));
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ name: 'Leyla' }); expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.profile.last_period_date).toBe('2026-07-10'); expect(done).toHaveBeenCalledOnce();
  expect(readOnboardingDraft(mocks.actor, mocks.backend)).toBeNull();
});
it.each(['granted','denied'])('native notification %s is captured without trapping the journey', async permission => {
  mocks.native = true; mocks.permission.mockResolvedValue({ receive: permission });
  render(<OnboardingJourney />); await travel('bump', 'notifications');
  await click(screen.getByRole('button', { name: onboardingText('az', 'allow_notifications') }));
  expect(step()).toBe('results'); expect(mocks.save.mock.calls[0][0].notifications).toBe(permission);
});
it('keeps the annual discount and offers only monthly coffee pricing after closing it', async () => {
  mocks.native = true;
  const draft = { ...newOnboardingDraft(mocks.actor, mocks.backend, 'Aysel'), stage: 'bump' as const, pregnancyDate: '2026-06-01', setupComplete: true, step: 'paywall' as const };
  await mocks.save(draft, 'az', () => {}); writeOnboardingDraft(draft);
  const done = vi.fn(); render(<OnboardingJourney onComplete={done} />);
  expect(document.querySelector('[data-plan="yearly"] del')).toHaveTextContent('$29.99');
  expect(document.querySelector('[data-plan="yearly"]')).toHaveTextContent('$19.99');
  expect(within(screen.getByTestId('onboarding-benefits')).getByText('Reklamsız təcrübə')).toBeInTheDocument();
  await click(screen.getByRole('button', { name: onboardingText('az', 'close') }));
  expect(step()).toBe('offer'); expect(mocks.claim).toHaveBeenCalledOnce();
  expect(document.querySelector('.onb-offer strong')).toHaveTextContent('$3.99');
  expect(screen.getByRole('heading', { name: onboardingText('az', 'coffee_title') })).toBeInTheDocument();
  expect(document.querySelector('.onb-offer del')).toBeNull();
  await click(screen.getByRole('button', { name: onboardingText('az', 'buy_monthly', { price: '$3.99' }) }));
  expect(mocks.purchase.mock.calls[0][1]).toMatchObject({ productId: 'com.atlasoon.anacan.premium.monthly', price: 3.99, currency: 'USD' });
  expect(step()).toBe('success'); await click(screen.getByRole('button', { name: onboardingText('az', 'open_app') }));
  expect(mocks.complete).toHaveBeenCalledWith(mocks.actor, mocks.backend, 'purchased', undefined, 'monthly'); expect(done).toHaveBeenCalledOnce();
});
it('opens the monthly offer after an annual store cancellation and does not loop on its close', async () => {
  mocks.native = true;
  const draft = { ...newOnboardingDraft(mocks.actor, mocks.backend, 'Aysel'), stage: 'bump' as const, pregnancyDate: '2026-06-01', setupComplete: true, step: 'paywall' as const };
  await mocks.save(draft, 'az', () => {}); writeOnboardingDraft(draft);
  mocks.purchase.mockImplementation(async () => { mocks.purchaseStatus = 'cancelled'; return false; });
  render(<OnboardingJourney />);
  await click(screen.getByRole('button', { name: onboardingText('az', 'buy', { price: '$19.99' }) }));
  expect(mocks.purchase).toHaveBeenCalledOnce();
  expect(mocks.purchaseStatus).toBe('cancelled');
  expect(step()).toBe('offer'); expect(mocks.claim).toHaveBeenCalledOnce();
  await click(screen.getByRole('button', { name: onboardingText('az', 'close') }));
  expect(step()).toBe('free'); expect(mocks.claim).toHaveBeenCalledOnce();
});
it('closes a selected monthly plan without offering a second monthly screen', async () => {
  mocks.native = true;
  const draft = { ...newOnboardingDraft(mocks.actor, mocks.backend, 'Aysel'), stage: 'bump' as const, pregnancyDate: '2026-06-01', setupComplete: true, step: 'paywall' as const };
  await mocks.save(draft, 'az', () => {}); writeOnboardingDraft(draft);
  render(<OnboardingJourney />); await click(document.querySelector('[data-plan="monthly"]'));
  await click(screen.getByRole('button', { name: onboardingText('az', 'close') }));
  expect(step()).toBe('free'); expect(mocks.claim).not.toHaveBeenCalled();
});
it('preserves a pending transaction across restart and only retries activation', async () => {
  mocks.native = true;
  const draft = { ...newOnboardingDraft(mocks.actor, mocks.backend, 'Aysel'), stage: 'flow' as const, lastPeriodDate: '2026-09-01', setupComplete: true, purchasePending: true, step: 'paywall' as const };
  await mocks.save(draft, 'az', () => {}); writeOnboardingDraft(draft);
  render(<OnboardingJourney />);
  expect(screen.getByText(onboardingText('az', 'purchase_pending'))).toBeInTheDocument();
  await click(screen.getByRole('button', { name: onboardingText('az', 'refresh_status') }));
  expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.restore).toHaveBeenCalledOnce(); expect(step()).toBe('success');
});
