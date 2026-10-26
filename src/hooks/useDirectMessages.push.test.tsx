import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDirectMessages } from './useDirectMessages';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invokePush: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  toast: vi.fn(),
  auth: { user: { id: '11111111-1111-4111-8111-111111111111' } }
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    storage: { from: vi.fn() }
  }
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.invokePush }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

const senderId = '11111111-1111-4111-8111-111111111111';
const receiverId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

function query(result: unknown) {
  const execute = vi.fn().mockResolvedValue({ data: result, error: null });
  const builder = {
    execute,
    select: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(() => execute()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
  builder.select.mockReturnValue(builder);
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
});

afterEach(() => cleanup());

it('sends a direct-message push with the exact row returned by the insert', async () => {
  const initialFetch = query([]);
  const insertedMessage = {
    id: messageId,
    sender_id: senderId,
    receiver_id: receiverId,
    content: 'Hello',
    message_type: 'text',
    media_url: null,
    is_read: false,
    created_at: '2026-09-11T12:00:00Z'
  };
  const insert = query(insertedMessage);
  mocks.from.mockReturnValueOnce(initialFetch).mockReturnValueOnce(insert);

  const { result } = renderHook(() => useDirectMessages(receiverId));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.sendMessage('Hello', 'text');
  });

  expect(insert.insert).toHaveBeenCalledExactlyOnceWith({
    sender_id: senderId,
    receiver_id: receiverId,
    content: 'Hello',
    message_type: 'text',
    media_url: null
  });
  expect(mocks.invokePush).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    userId: receiverId,
    data: {
      type: 'direct_message',
      context: 'direct_message',
      sender_id: senderId,
      messageId,
      interactionId: messageId
    }
  }));
});
