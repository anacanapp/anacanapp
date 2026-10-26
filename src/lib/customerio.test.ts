import { describe, expect, it, vi } from 'vitest';
import { readCustomerIoConfig } from './customerio-config';
import { createCustomerIoTracking } from './customerio-tracking';
import type { CustomerIoDataInPlugin } from '@anacan/customerio-data-in';
import { currentAnalyticsScreen, registerAnalyticsScreen } from './analytics-screen';

const config = { region: 'EU', environment: 'sandbox' } as const;
const alice = { userId: 'integration-test-alice', backend: 'https://backend.example.test', language: 'az', consent: true };
const bob = { ...alice, userId: 'integration-test-bob' };
function fixture(overrides: Partial<CustomerIoDataInPlugin> = {}) {
  const sdk = { initialize: vi.fn().mockResolvedValue(undefined), identify: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined), track: vi.fn().mockResolvedValue(undefined), screen: vi.fn().mockResolvedValue(undefined), ...overrides };
  const load = vi.fn().mockResolvedValue(sdk);
  return { sdk, load, tracker: createCustomerIoTracking(config, load) };
}

describe('Customer.io Data In configuration', () => {
  const env = { VITE_CUSTOMERIO_ENABLED: 'true',
    VITE_CUSTOMERIO_REGION: 'EU', VITE_CUSTOMERIO_ENVIRONMENT: 'sandbox' };
  it('configures the selected native profile without exposing a key on the JS bridge', () => {
    expect(readCustomerIoConfig(env)).toEqual(config);
  });
  it.each([{}, { ...env, VITE_CUSTOMERIO_ENABLED: 'false' }, { ...env, VITE_CUSTOMERIO_ENABLED: undefined },
    { ...env, VITE_CUSTOMERIO_REGION: 'US' }, { ...env, VITE_CUSTOMERIO_ENVIRONMENT: '' }])('does not enable an incomplete/unselected configuration', value => {
    expect(readCustomerIoConfig(value)).toBeNull();
  });
});

describe('Customer.io identity and real app behavior', () => {
  it('tracks the current mounted screen after consent/restoration without duplicating navigation', async () => {
    const { sdk } = fixture();
    const tracker = createCustomerIoTracking(config, async () => sdk, currentAnalyticsScreen);
    const release = registerAnalyticsScreen('Community', 'Social');
    try {
      await tracker.screen('Community', 'Social');
      expect(sdk.screen).not.toHaveBeenCalled();
      await tracker.setIdentity(alice);
      await tracker.screen('Community', 'Social');
      expect(sdk.screen).toHaveBeenCalledTimes(1);
      expect(sdk.screen).toHaveBeenLastCalledWith({ title: 'Community', properties: { environment: 'sandbox', screen_class: 'Social' } });
    } finally { release(); }
    expect(currentAnalyticsScreen()).toBeNull();
  });
  it('does not initialize before consent or when mobile tracking is disabled', async () => {
    const { tracker, load } = fixture();
    await tracker.setIdentity({ ...alice, consent: false });
    await tracker.screen('Community');
    await tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    await createCustomerIoTracking(null, load).setIdentity(alice);
    expect(load).not.toHaveBeenCalled();
  });
  it('initializes once and identifies restored/logged-in accounts before track and screen', async () => {
    const { tracker, sdk, load } = fixture();
    const identity = tracker.setIdentity(alice);
    const event = tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    await Promise.all([identity, event, tracker.screen('Community', 'Social')]);
    await tracker.setIdentity(alice);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sdk.initialize).toHaveBeenCalledWith(config);
    expect(sdk.identify).toHaveBeenCalledTimes(1);
    expect(sdk.identify).toHaveBeenCalledWith({ userId: alice.userId, traits: { language: 'az', environment: 'sandbox' } });
    expect(sdk.track).toHaveBeenCalledWith({ name: 'community_post_created', properties: { environment: 'sandbox', entry_point: 'community' } });
    expect(sdk.screen).toHaveBeenCalledWith({ title: 'Community', properties: { environment: 'sandbox', screen_class: 'Social' } });
    expect(vi.mocked(sdk.identify).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sdk.track).mock.invocationCallOrder[0]);
  });
  it('resets on account switches and rejects late post success from another account/realm', async () => {
    const { tracker, sdk } = fixture();
    await tracker.setIdentity(alice);
    await tracker.setIdentity(bob);
    await tracker.postCreated(alice.userId, alice.backend, 'late-alice-post');
    await tracker.postCreated(bob.userId, 'https://old-backend.example.test', 'old-realm-post');
    expect(sdk.reset).toHaveBeenCalledTimes(1);
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sdk.identify).toHaveBeenLastCalledWith({ userId: bob.userId, traits: { language: 'az', environment: 'sandbox' } });
  });
  it('revoking consent immediately invalidates queued events', async () => {
    const { tracker, sdk } = fixture();
    await tracker.setIdentity(alice);
    const event = tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    await tracker.setIdentity({ ...alice, consent: false });
    await event;
    await tracker.screen('Community');
    expect(sdk.reset).toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sdk.screen).not.toHaveBeenCalled();
  });
  it('logout during asynchronous initialization prevents stale identify and events', async () => {
    let finish!: () => void;
    const { tracker, sdk } = fixture({ initialize: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) });
    const init = tracker.setIdentity(alice);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const event = tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    const logout = tracker.setIdentity(null);
    finish();
    await Promise.all([init, event, logout]);
    expect(sdk.identify).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sdk.reset).toHaveBeenCalled();
  });
  it('deduplicates a successful request and never sends private content or raw routes', async () => {
    const { tracker, sdk } = fixture();
    await tracker.setIdentity(alice);
    await tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    await tracker.postCreated(alice.userId, alice.backend, 'operation-1');
    await tracker.screen('/p/v/private-token');
    expect(sdk.track).toHaveBeenCalledTimes(1);
    expect(sdk.screen).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(sdk.track).mock.calls)).not.toContain('operation-1');
  });
  it('isolates SDK failures from app behavior and retries a failed identify', async () => {
    const identify = vi.fn().mockRejectedValueOnce(new Error('synthetic SDK failure')).mockResolvedValue(undefined);
    const { tracker, sdk } = fixture({ identify });
    await expect(tracker.setIdentity(alice)).resolves.toBeUndefined();
    await tracker.postCreated(alice.userId, alice.backend, 'not-identified');
    expect(sdk.track).not.toHaveBeenCalled();
    await tracker.setIdentity(alice);
    await tracker.postCreated(alice.userId, alice.backend, 'identified');
    expect(sdk.track).toHaveBeenCalledTimes(1);
  });
});
