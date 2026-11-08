import { describe, expect, it, vi } from 'vitest';
import {
  conversationKey, groupConversations, isUnreadForMe, markConversationRead, markSeen, previewText, readSeenMap,
  threadMessages, totalUnread, writeSeenMap, type MarketMessage,
} from './marketInbox';

const ME = 'me';
let n = 0;
const msg = (p: Partial<MarketMessage>): MarketMessage => ({
  id: `m${++n}`, listing_id: 'L1', sender_id: 'b1', receiver_id: ME, content: 'salam', is_read: false,
  created_at: '2026-11-08T10:00:00Z', ...p,
});

describe('groupConversations', () => {
  const messages = [
    // I sell L1; two buyers wrote to me
    msg({ listing_id: 'L1', sender_id: 'b1', receiver_id: ME, created_at: '2026-11-08T10:00:00Z' }),
    msg({ listing_id: 'L1', sender_id: ME, receiver_id: 'b1', created_at: '2026-11-08T10:05:00Z', content: 'Bəli, var' }),
    msg({ listing_id: 'L1', sender_id: 'b1', receiver_id: ME, created_at: '2026-11-08T10:06:00Z' }),
    msg({ listing_id: 'L1', sender_id: 'b2', receiver_id: ME, created_at: '2026-11-08T09:00:00Z', is_read: true }),
    // I buy on L9 (listing not visible to me any more)
    msg({ listing_id: 'L9', sender_id: ME, receiver_id: 's9', created_at: '2026-11-08T11:00:00Z' }),
    msg({ listing_id: 'L9', sender_id: 's9', receiver_id: ME, created_at: '2026-11-08T11:30:00Z', is_read: null }),
    // not mine at all
    msg({ listing_id: 'L5', sender_id: 'x', receiver_id: 'y' }),
  ];
  const owners = { L1: ME };

  it('groups by listing + counterpart, newest first, with role and unread', () => {
    const convs = groupConversations(messages, ME, { listingOwners: owners });
    expect(convs.map((c) => c.key)).toEqual(['L9:s9', 'L1:b1', 'L1:b2']);
    const [buy, sell1, sell2] = convs;
    expect(buy.role).toBe('buyer');
    expect(buy.unread).toBe(1);
    expect(sell1.role).toBe('seller');
    expect(sell1.count).toBe(3);
    expect(sell1.unread).toBe(2);
    expect(sell1.last.created_at).toBe('2026-11-08T10:06:00Z');
    expect(sell2.unread).toBe(0);
    expect(totalUnread(convs)).toBe(3);
  });

  it('hides conversations with blocked users', () => {
    const convs = groupConversations(messages, ME, { listingOwners: owners, blocked: new Set(['b1']) });
    expect(convs.map((c) => c.key)).toEqual(['L9:s9', 'L1:b2']);
  });

  it('uses the per-device last-seen mark when is_read was not updated', () => {
    const seen = { [conversationKey('L1', 'b1')]: '2026-11-08T10:00:00Z' };
    const convs = groupConversations(messages, ME, { listingOwners: owners, seen });
    expect(convs.find((c) => c.key === 'L1:b1')?.unread).toBe(1);
  });

  it('returns nothing without a user', () => {
    expect(groupConversations(messages, null)).toEqual([]);
  });
});

describe('isUnreadForMe', () => {
  it('never counts my own messages', () => {
    expect(isUnreadForMe(msg({ sender_id: ME, receiver_id: 'b1' }), ME)).toBe(false);
  });
  it('respects is_read and the seen mark', () => {
    expect(isUnreadForMe(msg({ is_read: true }), ME)).toBe(false);
    expect(isUnreadForMe(msg({}), ME, '2026-11-08T10:00:00Z')).toBe(false);
    expect(isUnreadForMe(msg({}), ME, '2026-11-08T09:59:59Z')).toBe(true);
  });
});

describe('threadMessages', () => {
  it('returns only that pair on that listing, oldest first, blocked senders hidden', () => {
    const list = [
      msg({ id: 'a', sender_id: 'b1', created_at: '2026-11-08T10:06:00Z' }),
      msg({ id: 'b', sender_id: ME, receiver_id: 'b1', created_at: '2026-11-08T10:01:00Z' }),
      msg({ id: 'c', sender_id: 'b2' }),
      msg({ id: 'd', listing_id: 'L2', sender_id: 'b1' }),
    ];
    expect(threadMessages(list, 'L1', 'b1', ME).map((m) => m.id)).toEqual(['b', 'a']);
    expect(threadMessages(list, 'L1', 'b1', ME, new Set(['b1'])).map((m) => m.id)).toEqual(['b']);
  });
});

describe('seen map', () => {
  it('never moves backwards and round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    let seen = markSeen({}, 'L1:b1', '2026-11-08T10:06:00Z');
    expect(markSeen(seen, 'L1:b1', '2026-11-08T09:00:00Z')).toBe(seen);
    seen = markSeen(seen, 'L1:b1', '2026-11-08T11:00:00Z');
    writeSeenMap(ME, seen, storage);
    expect(readSeenMap(ME, storage)).toEqual({ 'L1:b1': '2026-11-08T11:00:00Z' });
    expect(readSeenMap('other', storage)).toEqual({});
  });
  it('survives broken storage', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readSeenMap(ME, storage)).toEqual({});
    expect(() => writeSeenMap(ME, {}, storage)).not.toThrow();
  });
});

describe('markConversationRead', () => {
  it('updates only the counterpart messages to me', async () => {
    const calls: unknown[][] = [];
    const builder: any = {
      update: (v: unknown) => { calls.push(['update', v]); return builder; },
      eq: (k: string, v: unknown) => { calls.push(['eq', k, v]); return builder; },
      or: (f: string) => { calls.push(['or', f]); return Promise.resolve({ error: null }); },
    };
    const client = { from: vi.fn(() => builder) };
    expect(await markConversationRead(client, ME, 'L1', 'b1')).toBe(true);
    expect(client.from).toHaveBeenCalledWith('marketplace_messages');
    expect(calls).toEqual([
      ['update', { is_read: true }], ['eq', 'listing_id', 'L1'], ['eq', 'sender_id', 'b1'], ['eq', 'receiver_id', ME],
      ['or', 'is_read.is.null,is_read.eq.false'],
    ]);
  });
});

it('previewText flattens and trims', () => {
  expect(previewText('  a\n\n b ')).toBe('a b');
  expect(previewText('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
});
