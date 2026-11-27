/**
 * Second-hand market inbox: both sides of a listing conversation (buyer and seller).
 *
 * public.marketplace_messages (listing_id, sender_id, receiver_id, content, is_read, created_at) RLS:
 *   SELECT when auth.uid() is sender or receiver, INSERT when auth.uid() is the sender,
 *   UPDATE when auth.uid() is the receiver (used to set is_read). So the seller can read and reply
 *   with the existing policies; no migration is needed.
 *
 * A conversation is one listing plus one counterpart. Unread = messages addressed to me with
 * is_read not true AND newer than the per-device "last seen" mark of that conversation. The local mark
 * keeps the badge correct when the is_read update fails (offline, old backend), and is_read keeps it
 * correct across devices.
 */
import { visibleMessages } from './marketSafety';

export interface MarketMessage {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean | null;
  created_at: string;
}

export type MarketRole = 'buyer' | 'seller';

export interface MarketConversation {
  key: string;
  listingId: string;
  counterpartId: string;
  /** My side in this conversation: 'seller' when I own the listing. */
  role: MarketRole;
  last: MarketMessage;
  unread: number;
  count: number;
}

/** Hard cap on how many recent messages the inbox loads (newest first). */
export const MARKET_INBOX_LIMIT = 500;
const SEEN_STORAGE_PREFIX = 'anacan.market.inbox.seen.v1:';
const SEEN_MAX_ENTRIES = 300;

export const conversationKey = (listingId: string, counterpartId: string) => `${listingId}:${counterpartId}`;

export const counterpartOf = (m: Pick<MarketMessage, 'sender_id' | 'receiver_id'>, myId: string) =>
  (m.sender_id === myId ? m.receiver_id : m.sender_id);

const ts = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export function isUnreadForMe(m: MarketMessage, myId: string, seenAt?: string | null): boolean {
  if (m.receiver_id !== myId || m.sender_id === myId || m.is_read === true) return false;
  return !seenAt || ts(m.created_at) > ts(seenAt);
}

/**
 * Groups my messages into conversations (listing + counterpart), newest first.
 * listingOwners maps listing id to its owner; a listing I cannot see is never mine (my own listings
 * are always readable), so I am the buyer there. Conversations with blocked users are left out.
 */
export function groupConversations(
  messages: MarketMessage[],
  myId: string | null | undefined,
  options: { blocked?: Set<string>; listingOwners?: Record<string, string>; seen?: Record<string, string> } = {},
): MarketConversation[] {
  if (!myId) return [];
  const blocked = options.blocked ?? new Set<string>();
  const owners = options.listingOwners ?? {};
  const seen = options.seen ?? {};
  const map = new Map<string, MarketConversation>();
  for (const m of messages) {
    if (!m || (m.sender_id !== myId && m.receiver_id !== myId)) continue;
    const counterpartId = counterpartOf(m, myId);
    if (!counterpartId || counterpartId === myId || blocked.has(counterpartId)) continue;
    const key = conversationKey(m.listing_id, counterpartId);
    let conv = map.get(key);
    if (!conv) {
      conv = {
        key, listingId: m.listing_id, counterpartId,
        role: owners[m.listing_id] === myId ? 'seller' : 'buyer',
        last: m, unread: 0, count: 0,
      };
      map.set(key, conv);
    }
    conv.count += 1;
    if (ts(m.created_at) >= ts(conv.last.created_at)) conv.last = m;
    if (isUnreadForMe(m, myId, seen[key])) conv.unread += 1;
  }
  return [...map.values()].sort((a, b) => ts(b.last.created_at) - ts(a.last.created_at));
}

export const totalUnread = (conversations: MarketConversation[]) =>
  conversations.reduce((sum, c) => sum + c.unread, 0);

/** The thread between me and one counterpart about one listing, oldest first, blocked senders hidden. */
export function threadMessages(
  messages: MarketMessage[], listingId: string, counterpartId: string, myId: string, blocked: Set<string> = new Set(),
): MarketMessage[] {
  const thread = messages.filter((m) => m.listing_id === listingId && (
    (m.sender_id === myId && m.receiver_id === counterpartId) || (m.sender_id === counterpartId && m.receiver_id === myId)));
  return visibleMessages(thread, blocked).slice().sort((a, b) => ts(a.created_at) - ts(b.created_at));
}

/** One-line preview of the last message. */
export function previewText(content: string, max = 80): string {
  const flat = (content ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// ── Per-device "last seen" marks (localStorage, best effort) ─────────────────────────────

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStorage = (): StorageLike | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

export function readSeenMap(userId: string | null | undefined, storage: StorageLike | null = defaultStorage()): Record<string, string> {
  if (!userId || !storage) return {};
  try {
    const raw = storage.getItem(SEEN_STORAGE_PREFIX + userId);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Marks a conversation seen up to `at` (never moves backwards); keeps the newest SEEN_MAX_ENTRIES marks. */
export function markSeen(
  seen: Record<string, string>, key: string, at: string,
): Record<string, string> {
  if (seen[key] && ts(seen[key]) >= ts(at)) return seen;
  const next = { ...seen, [key]: at };
  const entries = Object.entries(next);
  if (entries.length <= SEEN_MAX_ENTRIES) return next;
  return Object.fromEntries(entries.sort((a, b) => ts(b[1]) - ts(a[1])).slice(0, SEEN_MAX_ENTRIES));
}

export function writeSeenMap(userId: string | null | undefined, seen: Record<string, string>, storage: StorageLike | null = defaultStorage()) {
  if (!userId || !storage) return;
  try { storage.setItem(SEEN_STORAGE_PREFIX + userId, JSON.stringify(seen)); } catch { /* private mode / quota */ }
}

// ── Server calls (client injected so they stay testable) ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any };

export async function loadMarketMessages(client: Client, myId: string): Promise<MarketMessage[] | null> {
  try {
    const { data, error } = await client.from('marketplace_messages')
      .select('id, listing_id, sender_id, receiver_id, content, is_read, created_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(MARKET_INBOX_LIMIT);
    if (error || !Array.isArray(data)) return null;
    return data as MarketMessage[];
  } catch {
    return null;
  }
}

/** Sets is_read on the counterpart's messages to me in this conversation (RLS: receiver may update). */
export async function markConversationRead(client: Client, myId: string, listingId: string, counterpartId: string): Promise<boolean> {
  try {
    const { error } = await client.from('marketplace_messages')
      .update({ is_read: true })
      .eq('listing_id', listingId)
      .eq('sender_id', counterpartId)
      .eq('receiver_id', myId)
      .or('is_read.is.null,is_read.eq.false');
    return !error;
  } catch {
    return false;
  }
}
