import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBrandExposure } from './brandMeasurement';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup() {
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => name === 'issue_brand_ad_delivery_v1'
    ? { data: { id: args.p_exposure, expires_at: new Date(Date.now() + 900000).toISOString() }, error: null } : { data: true, error: null });
  return { rpc, exposure: createBrandExposure({ rpc, actor: 'owned-actor', banner: 'owned-banner', language: 'en', platform: 'ios' }) };
}
it('counts a continuous visible second once, and restarting visibility resets the clock', async () => {
  const { rpc, exposure } = setup(); exposure.visible(true); await vi.advanceTimersByTimeAsync(600); exposure.visible(false);
  await vi.advanceTimersByTimeAsync(1200); expect(rpc.mock.calls.filter(([name]) => name === 'record_brand_ad_event_v1')).toHaveLength(0);
  exposure.visible(true); await vi.advanceTimersByTimeAsync(1100);
  expect(rpc.mock.calls.filter(([name]) => name === 'record_brand_ad_event_v1')).toHaveLength(1);
  exposure.visible(false); exposure.visible(true); await vi.advanceTimersByTimeAsync(2000);
  expect(rpc.mock.calls.filter(([name]) => name === 'record_brand_ad_event_v1')).toHaveLength(1); exposure.dispose();
});
it('cancels impressions on unmount but completes an account-bound click after navigation', async () => {
  const { rpc, exposure } = setup(); exposure.visible(true); await vi.advanceTimersByTimeAsync(500);
  const click = exposure.click(); exposure.dispose(); await click; await vi.advanceTimersByTimeAsync(2000);
  const events = rpc.mock.calls.filter(([name]) => name === 'record_brand_ad_event_v1');
  expect(events).toHaveLength(1); expect(events[0][1]).toMatchObject({ p_actor: 'owned-actor', p_event: 'click' });
});
it('does not fabricate events when the server refuses the delivery ticket', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const exposure = createBrandExposure({ rpc, actor: 'owner', banner: 'banner', language: 'en', platform: 'web' });
  exposure.visible(true); await vi.advanceTimersByTimeAsync(3000); await exposure.click(); expect(rpc).toHaveBeenCalledTimes(1); exposure.dispose();
});
it('routes v3 creatives to the audience-aware receipt RPCs and returns the click ticket for lead attribution', async () => {
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => name === 'issue_brand_ad_delivery_v2'
    ? { data: { id: args.p_exposure, expires_at: new Date(Date.now() + 900000).toISOString() }, error: null } : { data: true, error: null });
  const exposure = createBrandExposure({ rpc, actor: 'owner', banner: 'banner', language: 'ar', platform: 'android', version: 3 });
  exposure.visible(true); await vi.advanceTimersByTimeAsync(1200);
  const ticket = await exposure.click();
  const names = rpc.mock.calls.map(([name]) => name);
  expect(names).toEqual(['issue_brand_ad_delivery_v2', 'record_brand_ad_event_v2', 'record_brand_ad_event_v2']);
  expect(names.some(name => name.endsWith('_v1'))).toBe(false);
  expect(ticket).toBe(rpc.mock.calls[0][1].p_exposure); exposure.dispose();
});
