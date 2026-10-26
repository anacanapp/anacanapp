import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeSendPush, type PushEventData } from './push';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  reportPushFailure: vi.fn()
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } }
}));
vi.mock('@/lib/crashReporter', () => ({ reportPushFailure: mocks.reportPushFailure }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

const targetId = '11111111-1111-4111-8111-111111111111';
const senderId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.invoke.mockResolvedValue({ data: { sent: 1 }, error: null });
});

describe('invokeSendPush Azure contract guard', () => {
  it('forwards only the server payload for an interaction-bound event', async () => {
    const data = {
      type: 'direct_message',
      context: 'direct_message',
      sender_id: senderId,
      messageId,
      interactionId: messageId
    } satisfies PushEventData;

    await expect(invokeSendPush({
      userId: targetId,
      title: 'Ignored client title',
      body: 'Ignored client body',
      data,
      kind: 'direct_message'
    })).resolves.toMatchObject({ ok: true, sent: 1 });

    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('send-push-notification', {
      body: {
        userId: targetId,
        title: 'Ignored client title',
        body: 'Ignored client body',
        data
      }
    });
  });

  it('allows the interaction-free self diagnostic contract', async () => {
    await invokeSendPush({
      userId: targetId,
      title: 'Diagnostic',
      body: 'Diagnostic body',
      data: { type: 'diagnostic', context: 'self' }
    });

    expect(mocks.invoke).toHaveBeenCalledOnce();
  });

  it.each([
    ['legacy contextless like', { type: 'like' }],
    ['supported event without its row id', {
      type: 'community_comment', context: 'community_post', postId: messageId
    }],
    ['message aliases for different rows', {
      type: 'direct_message', context: 'direct_message', sender_id: senderId,
      messageId, interactionId: '44444444-4444-4444-8444-444444444444'
    }],
    ['an unsupported data field', {
      type: 'shopping_list', context: 'partner', interactionId: messageId, itemName: 'client copy'
    }]
  ])('blocks %s before invoking Supabase', async (_label, data) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await invokeSendPush({
      userId: targetId,
      title: 'Title',
      body: 'Body',
      data
    });

    expect(result).toMatchObject({ ok: false, sent: 0, error: expect.any(Error) });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
