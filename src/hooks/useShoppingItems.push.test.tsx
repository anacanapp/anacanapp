import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useShoppingItems } from './useShoppingItems';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invokePush: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  auth: {
    user: { id: '11111111-1111-4111-8111-111111111111' },
    profile: {
      name: 'Actor',
      life_stage: 'mommy',
      linked_partner_id: '33333333-3333-4333-8333-333333333333'
    }
  }
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
vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.invokePush }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

const userId = '11111111-1111-4111-8111-111111111111';
const partnerId = '22222222-2222-4222-8222-222222222222';
const itemId = '44444444-4444-4444-8444-444444444444';

function query(result: unknown) {
  const execute = vi.fn().mockResolvedValue({ data: result, error: null });
  const builder = {
    execute,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(() => execute()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
  mocks.invokePush.mockResolvedValue({ ok: true, sent: 1 });
});

afterEach(() => cleanup());

it('binds a shopping push to the item row returned by the insert', async () => {
  const initialFetch = query([]);
  const partnerLookup = query({ user_id: partnerId });
  const insertedItem = {
    id: itemId,
    user_id: userId,
    partner_id: partnerId,
    name: 'Milk',
    quantity: 1,
    is_checked: false,
    priority: 'medium',
    added_by: 'woman',
    created_at: '2026-09-11T12:00:00Z'
  };
  const insert = query(insertedItem);
  const refresh = query([insertedItem]);
  mocks.from
    .mockReturnValueOnce(initialFetch)
    .mockReturnValueOnce(partnerLookup)
    .mockReturnValueOnce(insert)
    .mockReturnValueOnce(refresh);

  const { result } = renderHook(useShoppingItems);
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.addItem({ name: 'Milk' });
  });

  expect(mocks.invokePush).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    userId: partnerId,
    data: {
      type: 'shopping_list',
      context: 'partner',
      interactionId: itemId
    }
  }));
});
