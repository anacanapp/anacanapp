import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ONBOARDING_LANGUAGES, onboardingText } from '@/lib/onboarding-i18n';
import AdFreePremiumOffer from './AdFreePremiumOffer';

const mocks = vi.hoisted(() => ({ language: 'az', lifeStage: 'mommy', userId: 'reader', backend: 'https://api.anacan.az', premium: false, loading: false }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium, loading: mocks.loading }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: mocks.backend }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: mocks.language, lifeStage: mocks.lifeStage }) }));
vi.mock('@/components/PremiumModal', () => ({ PremiumModal: ({ feature, onClose }: any) => <div role="dialog" data-feature={feature}><button onClick={onClose}>Close</button></div> }));
let account = 0;
beforeEach(() => { Object.assign(mocks, { language: 'az', lifeStage: 'mommy', userId: `reader-${++account}`, backend: 'https://api.anacan.az', premium: false, loading: false }); localStorage.clear(); vi.stubGlobal('IntersectionObserver', undefined); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const dashboard = () => <><AdFreePremiumOffer position="top" /><div>Dashboard content</div><AdFreePremiumOffer position="bottom" /></>;
it.each(ONBOARDING_LANGUAGES)('%s offers ad-free Premium with translated copy', async language => {
  mocks.language = language; render(dashboard());
  expect(screen.getByText(onboardingText(language, 'remove_ads_premium'))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: onboardingText(language, 'premium_cta') }));
  expect(await screen.findByRole('dialog')).toHaveAttribute('data-feature', 'ad_free');
});
it('hides the offer for active or household Premium and while entitlement is unknown', () => {
  mocks.loading = true; const view = render(dashboard());
  expect(screen.queryByTestId('ad-free-premium-offer')).toBeNull();
  mocks.loading = false; mocks.premium = true; view.rerender(dashboard());
  expect(screen.queryByTestId('ad-free-premium-offer')).toBeNull();
  mocks.premium = false; view.rerender(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toBeInTheDocument();
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'top');
});
it('keeps the first visible card at the top for that visit, then permanently uses the bottom on return', () => {
  const first = render(dashboard());
  expect(screen.getAllByTestId('ad-free-premium-offer')).toHaveLength(1);
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'top');
  mocks.language = 'en'; first.rerender(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'top');
  first.unmount();
  const second = render(dashboard());
  expect(screen.getAllByTestId('ad-free-premium-offer')).toHaveLength(1);
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'bottom');
  expect(second.container.lastElementChild).toBe(screen.getByTestId('ad-free-premium-offer'));
  mocks.lifeStage = 'flow'; second.rerender(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'bottom');
});
it.each(['userId', 'backend'] as const)('does not reuse another %s scope, and restores the returning scope at the bottom', boundary => {
  const original = mocks[boundary], first = render(dashboard());
  mocks[boundary] = boundary === 'userId' ? `${original}-other` : 'https://source.example';
  first.rerender(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'top');
  mocks[boundary] = original; first.rerender(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'bottom');
});
it('does not consume the top introduction until the card is actually visible', () => {
  let observed: IntersectionObserverCallback;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { observed = callback; }
    observe() {} disconnect() {}
  });
  const unseen = render(dashboard()); unseen.unmount();
  const visible = render(dashboard()), card = screen.getByTestId('ad-free-premium-offer');
  expect(card).toHaveAttribute('data-offer-position', 'top');
  act(() => observed([{ target: card, isIntersecting: true, intersectionRatio: 1, boundingClientRect: card.getBoundingClientRect(), intersectionRect: card.getBoundingClientRect(), rootBounds: null, time: 0 }], {} as IntersectionObserver));
  visible.unmount(); render(dashboard());
  expect(screen.getByTestId('ad-free-premium-offer')).toHaveAttribute('data-offer-position', 'bottom');
});
