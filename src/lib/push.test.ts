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

describe('invokeSendPush group fan-out contract', () => {
  const groupId = '55555555-5555-4555-8555-555555555555';
  const fanoutData = {
    type: 'group_message_fanout', context: 'group_message_fanout', groupId, messageId, interactionId: messageId,
  } satisfies PushEventData;
  const httpError = (body: unknown) => Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: { json: async () => body },
  });

  it('forwards the fan-out payload addressed to the sender', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, sent: 3, skipped: { no_device_tokens: 1 } }, error: null });
    await expect(invokeSendPush({ userId: senderId, title: 'T', body: 'B', kind: 'group_message_fanout', data: fanoutData }))
      .resolves.toMatchObject({ ok: true, sent: 3, skippedCounts: { no_device_tokens: 1 } });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('send-push-notification', {
      body: { userId: senderId, title: 'T', body: 'B', data: fanoutData }
    });
    expect(mocks.reportPushFailure).not.toHaveBeenCalled();
  });

  it('does not report a fan-out that reached nobody for expected reasons', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.invoke.mockResolvedValue({ data: { ok: true, sent: 0, skipped: { preferences_disabled: 2, not_member: 1 } }, error: null });
    await expect(invokeSendPush({ userId: senderId, title: 'T', body: 'B', kind: 'group_message_fanout', data: fanoutData }))
      .resolves.toMatchObject({ ok: true, sent: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.reportPushFailure).not.toHaveBeenCalled();
  });

  it('reports a fan-out the server flags as incomplete', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.invoke.mockResolvedValue({ data: { ok: false, sent: 1, skipped: { deadline: 4 } }, error: null });
    await expect(invokeSendPush({ userId: senderId, title: 'T', body: 'B', kind: 'group_message_fanout', data: fanoutData }))
      .resolves.toMatchObject({ ok: false, sent: 1, skippedCounts: { deadline: 4 } });
    await vi.waitFor(() => expect(mocks.reportPushFailure).toHaveBeenCalledWith('group_message_fanout', 'fanout incomplete', expect.anything()));
  });

  it('returns unsupported_context_or_type from an older server without reporting it', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: httpError({ error: 'unsupported_context_or_type' }) });
    await expect(invokeSendPush({ userId: senderId, title: 'T', body: 'B', kind: 'group_message_fanout', data: fanoutData }))
      .resolves.toMatchObject({ ok: false, sent: 0, serverError: 'unsupported_context_or_type' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.reportPushFailure).not.toHaveBeenCalled();
  });

  it('still reports other invoke errors with the server code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.invoke.mockResolvedValue({ data: null, error: httpError({ error: 'no_verified_interaction' }) });
    await expect(invokeSendPush({ userId: senderId, title: 'T', body: 'B', kind: 'group_message_fanout', data: fanoutData }))
      .resolves.toMatchObject({ ok: false, serverError: 'no_verified_interaction' });
    await vi.waitFor(() => expect(mocks.reportPushFailure).toHaveBeenCalledWith('group_message_fanout',
      'invoke error: Edge Function returned a non-2xx status code', { error: 'no_verified_interaction' }));
  });

  it('treats a not_member skip as an expected outcome', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.invoke.mockResolvedValue({ data: { success: true, sent: 0, skipped: 'not_member' }, error: null });
    await expect(invokeSendPush({ userId: targetId, title: 'T', body: 'B', kind: 'group_message', data: {
      type: 'group_message', context: 'group_message', groupId, messageId, interactionId: messageId,
    } })).resolves.toMatchObject({ ok: false, sent: 0, skipped: 'not_member' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.reportPushFailure).not.toHaveBeenCalled();
  });

  it('blocks a fan-out whose messageId and interactionId differ', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await invokeSendPush({ userId: senderId, title: 'T', body: 'B', data: {
      ...fanoutData, interactionId: '44444444-4444-4444-8444-444444444444'
    } });
    expect(result).toMatchObject({ ok: false, error: expect.any(Error) });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
