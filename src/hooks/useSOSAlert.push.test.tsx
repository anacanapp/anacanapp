import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSOSAlert } from './useSOSAlert';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invokePush: vi.fn(),
  impact: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  auth: {
    user: { id: '11111111-1111-4111-8111-111111111111' },
    profile: { linked_partner_id: '33333333-3333-4333-8333-333333333333' }
  },
  privacy: { prefs: { privacy_location_sharing: false } }
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel
  }
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth
}));
vi.mock('@/hooks/usePrivacyPreferences', () => ({
  usePrivacyPreferences: () => mocks.privacy
}));
vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.invokePush }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mocks.impact },
  ImpactStyle: { Heavy: 'HEAVY' }
}));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: {} }));

const senderId = '11111111-1111-4111-8111-111111111111';
const receiverId = '22222222-2222-4222-8222-222222222222';
const alertId = '44444444-4444-4444-8444-444444444444';

function query(result: unknown) {
  const execute = vi.fn().mockResolvedValue({ data: result, error: null });
  const builder = {
    execute,
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(() => execute()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
  mocks.invokePush.mockResolvedValue({ ok: true, sent: 1 });
  mocks.impact.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

it('uses the persisted SOS row for both the alert and interaction identifiers', async () => {
  const initialFetch = query([]);
  const partnerLookup = query({ user_id: receiverId });
  const insertedAlert = {
    id: alertId,
    sender_id: senderId,
    receiver_id: receiverId,
    alert_type: 'emergency',
    message: 'Help',
    latitude: null,
    longitude: null,
    location_name: null,
    is_acknowledged: false,
    acknowledged_at: null,
    created_at: '2026-09-11T12:00:00Z'
  };
  const alertInsert = query(insertedAlert);
  const partnerMessageInsert = query(null);
  const refresh = query([insertedAlert]);
  mocks.from
    .mockReturnValueOnce(initialFetch)
    .mockReturnValueOnce(partnerLookup)
    .mockReturnValueOnce(alertInsert)
    .mockReturnValueOnce(partnerMessageInsert)
    .mockReturnValueOnce(refresh);

  const { result } = renderHook(useSOSAlert);
  await waitFor(() => expect(initialFetch.execute).toHaveBeenCalledOnce());

  await act(async () => {
    await result.current.sendSOS('Help', false, 'emergency');
  });

  expect(mocks.invokePush).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    userId: receiverId,
    data: {
      type: 'sos_alert',
      context: 'partner',
      alertId,
      interactionId: alertId
    }
  }));
});
