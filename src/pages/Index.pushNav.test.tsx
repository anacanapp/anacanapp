import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index';
import { consumePendingPushNav, navigateFromPush } from '@/lib/pushNav';
import { analytics } from '@/lib/analytics';

const mocks = vi.hoisted(() => ({
  store: {
    isAuthenticated: true, isOnboarded: true, role: 'woman', hasSeenIntro: true,
    hasSelectedLanguage: true, lifeStage: 'mommy', hasCompletedFunnel: true,
    language: 'en', countryCode: 'AZ',
    setHasSeenIntro: () => {}, setHasSelectedLanguage: () => {}, setFunnelCompleted: () => {},
  },
  auth: {
    isAdmin: false, loading: false, profileLoaded: true, user: { id: 'current-user' },
    profile: { name: 'Fixture User', country_code: 'AZ', linked_partner_id: 'partner-profile-id' },
  },
  deeplink: (_parsed: any) => {},
  swipe: { onSwipeBack: () => {}, onSwipeForward: () => {} },
}));
const SENDER = '01234567-89ab-4cde-8fab-0123456789ab';

vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector(mocks.store) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => false }));
vi.mock('@/hooks/useDeviceToken', () => ({ useDeviceToken: () => {} }));
vi.mock('@/hooks/usePendingTimerStops', () => ({ usePendingTimerStops: () => {} }));
vi.mock('@/hooks/useForceUpdate', () => ({ useForceUpdate: () => ({ forceUpdate: null, isLoading: false }) }));
vi.mock('@/hooks/useUserBlock', () => ({ useActiveBlock: () => ({ data: null }) }));
vi.mock('@/hooks/useSwipeNavigation', () => ({ useSwipeNavigation: (options: any) => { mocks.swipe = options; } }));
vi.mock('@/lib/native', () => ({ isNative: false }));
vi.mock('@/lib/deeplink', () => ({ initDeeplinkListener: (handler: any) => { mocks.deeplink = handler; return () => {}; } }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/lib/scroll', () => ({ resetAppScrollPosition: () => {} }));
vi.mock('@/lib/scrollMemory', () => ({ saveScroll: () => {}, restoreScroll: () => {} }));
vi.mock('@/lib/analytics', () => ({ analytics: { logScreenView: vi.fn() } }));
vi.mock('@/components/ErrorBoundary', () => ({ default: ({ children }: any) => children }));
vi.mock('@/components/SplashScreen', () => ({ needsBrandSplash: () => true, default: ({ onComplete }: any) => <button onClick={onComplete}>Finish splash</button> }));
vi.mock('@/components/AppIntroduction', () => ({ default: () => null }));
vi.mock('@/components/InitialLanguageScreen', () => ({ default: () => null }));
vi.mock('@/components/AuthScreen', () => ({ default: () => null }));
vi.mock('@/components/OnboardingScreen', () => ({ default: () => null }));
vi.mock('@/components/BlockedScreen', () => ({ default: () => null }));
vi.mock('@/components/CountryGate', () => ({ default: () => null }));
vi.mock('@/components/AppRatingPrompt', () => ({ default: () => null }));
vi.mock('@/components/FloatingTimerWidget', () => ({ default: () => null }));
vi.mock('@/components/BottomNav', () => ({ default: ({ onTabChange }: any) =>
  <button onClick={() => onTabChange('home')}>Home tab</button>,
}));
vi.mock('@/components/Dashboard', () => ({ default: () => <div data-testid="home" data-role="woman" /> }));
vi.mock('@/components/partner/v2/PartnerHomeScreen', () => ({ default: () => <div data-testid="home" data-role="partner" /> }));
vi.mock('@/components/partner/v2/AlertReceiver', () => ({ default: ({ isPartner }: any) =>
  <div data-testid="alert-receiver" data-partner={String(isPartner)} />,
}));
vi.mock('@/components/ToolsHub', async () => {
  const { useState } = await import('react');
  return { default: ({ initialTool, onBack }: any) => {
    // Like the real ToolsHub, this only reads initialTool on mount.
    const [tool] = useState(initialTool);
    return <div data-testid="tools" data-tool={tool || ''}><button onClick={onBack}>Tool back</button></div>;
  } };
});
vi.mock('@/components/SettingsScreen', () => ({ default: ({ onBack }: any) =>
  <div data-testid="settings"><button onClick={onBack}>Screen back</button></div>,
}));
vi.mock('@/components/BillingScreen', () => ({ default: ({ onBack }: any) =>
  <div data-testid="billing"><button onClick={onBack}>Screen back</button></div>,
}));
vi.mock('@/components/MessagesScreen', () => ({ default: ({ partnerProfileId, onBack }: any) =>
  <div data-testid="messages" data-partner-profile={partnerProfileId}><button onClick={onBack}>Chat back</button></div>,
}));
vi.mock('@/components/partner/PartnerChatScreen', () => ({ default: ({ onBack }: any) =>
  <div data-testid="partner-chat"><button onClick={onBack}>Chat back</button></div>,
}));
vi.mock('@/components/community/CommunityScreen', () => ({ default: ({ deepLinkTarget, onDeepLinkConsumed }: any) =>
  <div data-testid="community" data-target={JSON.stringify(deepLinkTarget)}>
    <button onClick={onDeepLinkConsumed}>Consume community link</button>
  </div>,
}));
vi.mock('@/components/community/UserProfileScreen', () => ({ default: () => <div data-testid="user-profile" /> }));
vi.mock('@/components/AdminPanel', () => ({ default: () => <div data-testid="admin" /> }));
vi.mock('@/components/partner/v2/PartnerShoppingScreen', () => ({ default: ({ onBack }: any) =>
  <div data-testid="partner-shopping"><button onClick={onBack}>Shopping back</button></div>,
}));
vi.mock('@/components/NotificationsScreen', () => ({ default: ({ onNavigateToCommunity }: any) =>
  <div data-testid="notifications">
    <button onClick={() => onNavigateToCommunity({ postId: 'post' })}>Notification post</button>
    <button onClick={() => onNavigateToCommunity({ postId: 'post', commentId: 'comment' })}>Notification comment</button>
    <button onClick={() => onNavigateToCommunity({ storyId: 'story' })}>Notification story</button>
  </div>,
}));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  return { motion: { div: forwardRef((props: any, ref) => {
    const { initial, animate, exit, variants, ...rest } = props;
    return createElement('div', { ...rest, ref });
  }) } };
});

beforeEach(() => {
  consumePendingPushNav();
  vi.mocked(analytics.logScreenView).mockClear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Unexpected network request in navigation test'))));
  mocks.store.role = 'woman';
  mocks.auth.loading = false;
  mocks.auth.profileLoaded = true;
  mocks.auth.isAdmin = false;
});
afterEach(async () => {
  cleanup();
  await vi.dynamicImportSettled();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  consumePendingPushNav();
});

async function openApp() {
  const view = render(<Index />);
  fireEvent.click(screen.getByText('Finish splash'));
  await screen.findByTestId('home');
  return view;
}

function push(data: Record<string, unknown>) {
  act(() => { navigateFromPush(data); });
}

function openScreen(name: string) {
  act(() => { mocks.deeplink({ action: 'screen', params: { screen: name } }); });
}

async function stackConflictingScreens() {
  mocks.auth.isAdmin = true;
  act(() => {
    mocks.deeplink({ action: 'tool', params: { tool_id: 'weight' } });
    mocks.deeplink({ action: 'messages', params: {} });
    mocks.deeplink({ action: 'user-profile', params: { user_id: 'profile-user' } });
    mocks.deeplink({ action: 'screen', params: { screen: 'admin' } });
  });
  await screen.findByTestId('admin');
  openScreen('settings');
}

function communityTarget() {
  return JSON.parse(screen.getByTestId('community').getAttribute('data-target')!);
}

describe('Index push navigation', () => {
  it.each(['woman', 'partner'])('replaces all nested screens with an actual DM target for %s', async (role) => {
    mocks.store.role = role;
    await openApp();
    await stackConflictingScreens();
    push({ type: 'direct_message', sender_id: SENDER, userName: 'Forged name' });
    await screen.findByTestId('community');
    expect(communityTarget()).toEqual({ dmUserId: SENDER });
    expect(screen.queryByTestId('admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('messages')).not.toBeInTheDocument();
    expect(consumePendingPushNav()).toBeNull();
    push({ type: 'direct_message' });
    expect(communityTarget()).toEqual({ conversations: true });
    fireEvent.click(screen.getByText('Home tab'));
    expect(await screen.findByTestId('home')).toHaveAttribute('data-role', role);
  });

  it.each(['woman', 'partner'])('opens the unified Messages inbox for %s even from a sub-screen', async (role) => {
    mocks.store.role = role;
    await openApp();
    openScreen('settings');
    await screen.findByTestId('settings');
    push({ type: 'partner_message' });
    const chat = await screen.findByTestId('messages');
    expect(chat).toHaveAttribute('data-partner-profile', 'partner-profile-id');
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Chat back'));
    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('opens the shopping tool even when ToolsHub has a different tool mounted', async () => {
    await openApp();
    act(() => { mocks.deeplink({ action: 'tool', params: { tool_id: 'weight' } }); });
    expect(await screen.findByTestId('tools')).toHaveAttribute('data-tool', 'weight');
    push({ type: 'shopping_list' });
    expect(screen.getByTestId('tools')).toHaveAttribute('data-tool', 'shopping');
    fireEvent.click(screen.getByText('Tool back'));
    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('opens partner-shopping and returns Home without an old sub-screen', async () => {
    mocks.store.role = 'partner';
    await openApp();
    await stackConflictingScreens();
    push({ type: 'shopping_list' });
    await screen.findByTestId('partner-shopping');
    fireEvent.click(screen.getByText('Shopping back'));
    expect(await screen.findByTestId('home')).toHaveAttribute('data-role', 'partner');
  });

  it.each(['woman', 'partner'].flatMap((role) =>
    ['sos_alert', 'birth_alert', 'sos', 'birth'].map((type) => [role, type]),
  ))('mounts AlertReceiver on Home for %s / %s from conflicting sub-screens', async (role, type) => {
    mocks.store.role = role;
    await openApp();
    await stackConflictingScreens();
    expect(screen.queryByTestId('alert-receiver')).not.toBeInTheDocument();
    push({ type });
    expect(await screen.findByTestId('home')).toHaveAttribute('data-role', role);
    expect(await screen.findByTestId('alert-receiver')).toHaveAttribute('data-partner', String(role === 'partner'));
  });

  it('does not leave a hidden chat/profile behind a screen intent', async () => {
    await openApp();
    act(() => {
      mocks.deeplink({ action: 'messages', params: {} });
      mocks.deeplink({ action: 'user-profile', params: { user_id: 'profile-user' } });
    });
    await screen.findByTestId('user-profile');
    push({ type: 'subscription' });
    await screen.findByTestId('billing');
    fireEvent.click(screen.getByText('Screen back'));
    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('clears swipe-forward restoration when a push replaces the navigation stack', async () => {
    await openApp();
    openScreen('settings');
    await screen.findByTestId('settings');
    act(() => { mocks.swipe.onSwipeBack(); });
    await screen.findByTestId('home');
    push({ type: 'sos_alert' });
    act(() => { mocks.swipe.onSwipeForward(); });
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
  });

  it('waits for the loaded role before consuming a cold-start shopping intent', async () => {
    mocks.auth.loading = true;
    mocks.auth.profileLoaded = false;
    push({ type: 'shopping_list' });
    const view = render(<Index />);
    fireEvent.click(screen.getByText('Finish splash'));
    expect(screen.queryByTestId('tools')).not.toBeInTheDocument();
    mocks.store.role = 'partner';
    mocks.auth.loading = false;
    mocks.auth.profileLoaded = true;
    view.rerender(<Index />);
    expect(await screen.findByTestId('partner-shopping')).toBeInTheDocument();
    expect(consumePendingPushNav()).toBeNull();
  });

  it('does not replay a consumed warm intent after navigation or a role re-render', async () => {
    const view = await openApp();
    push({ type: 'direct_message', sender_id: SENDER });
    await screen.findByTestId('community');
    fireEvent.click(screen.getByText('Consume community link'));
    expect(communityTarget()).toBeNull();
    fireEvent.click(screen.getByText('Home tab'));
    mocks.store.role = 'partner';
    view.rerender(<Index />);
    await waitFor(() => expect(screen.getByTestId('home')).toHaveAttribute('data-role', 'partner'));
    expect(screen.queryByTestId('community')).not.toBeInTheDocument();
  });

  it('preserves comment/story push targets and explicitly clears the target for a generic Community push', async () => {
    await openApp();
    openScreen('settings');
    await screen.findByTestId('settings');
    push({ type: 'community_reply', postId: 'post', commentId: 'comment' });
    await screen.findByTestId('community');
    expect(communityTarget()).toEqual({ postId: 'post', commentId: 'comment' });
    push({ type: 'story_reply', storyId: 'story' });
    expect(communityTarget()).toEqual({ storyId: 'story' });
    push({ type: 'community' });
    expect(communityTarget()).toEqual({});
  });

  it.each([
    ['post', { postId: 'post' }],
    ['comment', { postId: 'post', commentId: 'comment' }],
    ['story', { storyId: 'story' }],
  ])('preserves in-app notification %s navigation', async (kind, target) => {
    await openApp();
    openScreen('notifications');
    fireEvent.click(await screen.findByText(`Notification ${kind}`));
    await screen.findByTestId('community');
    expect(communityTarget()).toEqual(target);
    expect(screen.queryByTestId('notifications')).not.toBeInTheDocument();
  });
});
