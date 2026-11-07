import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyChatMessage, type ChatMessage } from './chat';

const mocks = vi.hoisted(() => ({ invokeSendPush: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.invokeSendPush }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/group-i18n', () => ({ tr: (_key: string, fallback?: string) => fallback ?? _key }));

const SENDER = '11111111-1111-4111-8111-111111111111';
const GROUP = '22222222-2222-4222-8222-222222222222';
const MESSAGE = '33333333-3333-4333-8333-333333333333';
const members = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
const message: ChatMessage = { id: MESSAGE, sender_id: SENDER, group_id: GROUP, content: 'Salam', message_type: 'text', created_at: '2026-11-07T12:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: [{ user_id: SENDER }, ...members.map((user_id) => ({ user_id }))], error: null });
});

describe('notifyChatMessage group push', () => {
  it('asks the server once to fan the message out', async () => {
    mocks.invokeSendPush.mockResolvedValue({ ok: true, sent: 2, skippedCounts: {} });
    await notifyChatMessage('group', GROUP, message);
    expect(mocks.invokeSendPush).toHaveBeenCalledExactlyOnceWith({
      userId: SENDER, title: 'Yeni mesaj', body: 'Salam', kind: 'group_message_fanout',
      data: { type: 'group_message_fanout', context: 'group_message_fanout', groupId: GROUP, messageId: MESSAGE, interactionId: MESSAGE },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['a fan-out with zero sends', { ok: true, sent: 0, skippedCounts: { no_device_tokens: 2 } }],
    ['another server error', { ok: false, sent: 0, serverError: 'no_verified_interaction' }],
    ['a network failure', { ok: false, sent: 0, error: new Error('offline') }],
  ])('does not fall back after %s', async (_label, result) => {
    mocks.invokeSendPush.mockResolvedValue(result);
    await notifyChatMessage('group', GROUP, message);
    expect(mocks.invokeSendPush).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('falls back to one group_message push per member on an older server', async () => {
    mocks.invokeSendPush.mockResolvedValueOnce({ ok: false, sent: 0, serverError: 'unsupported_context_or_type' })
      .mockResolvedValue({ ok: true, sent: 1 });
    await notifyChatMessage('group', GROUP, message);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('chat_group_members_v2', { p_group: GROUP });
    expect(mocks.invokeSendPush).toHaveBeenCalledTimes(3);
    expect(mocks.invokeSendPush.mock.calls.slice(1).map(([payload]) => payload)).toEqual(members.map((userId) => ({
      userId, title: 'Yeni mesaj', body: 'Salam', kind: 'group_message',
      data: { type: 'group_message', context: 'group_message', groupId: GROUP, messageId: MESSAGE, interactionId: MESSAGE },
    })));
  });

  it('keeps direct messages on the single-recipient path', async () => {
    mocks.invokeSendPush.mockResolvedValue({ ok: true, sent: 1 });
    await notifyChatMessage('direct', members[0], { ...message, group_id: undefined });
    expect(mocks.invokeSendPush).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: members[0], kind: 'direct_message' }));
  });
});
