import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import {
  groupConversations, loadMarketMessages, markConversationRead, markSeen, readSeenMap, totalUnread, writeSeenMap,
  type MarketConversation, type MarketMessage,
} from '@/lib/marketInbox';

export interface InboxListing {
  id: string;
  user_id: string;
  title: string;
  images: string[] | null;
  category: string;
  is_free: boolean;
  price: number;
  status: string;
}

/**
 * Loads my market conversations (as buyer and as seller). There is no realtime subscription
 * (the buyer chat never had one and marketplace_messages is not in a realtime publication), so the
 * inbox refreshes on mount, when the app becomes visible again, and after sending or opening a thread.
 */
export function useMarketInbox(myId: string | null | undefined, blocked: Set<string>) {
  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [listings, setListings] = useState<Record<string, InboxListing>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeenMap(myId));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => { setSeen(readSeenMap(myId)); }, [myId]);

  const refresh = useCallback(async () => {
    if (!myId) { setMessages([]); return; }
    const run = ++seq.current;
    setLoading(true);
    const rows = await loadMarketMessages(supabase, myId);
    if (run !== seq.current) return;
    setLoading(false);
    if (!rows) { setFailed(true); return; }
    setFailed(false);
    setMessages(rows);
    const listingIds = [...new Set(rows.map((m) => m.listing_id))];
    const people = [...new Set(rows.map((m) => (m.sender_id === myId ? m.receiver_id : m.sender_id)))];
    if (listingIds.length) {
      try {
        const { data } = await supabase.from('marketplace_listings')
          .select('id, user_id, title, images, category, is_free, price, status').in('id', listingIds);
        if (run === seq.current && Array.isArray(data)) {
          setListings(Object.fromEntries((data as InboxListing[]).map((l) => [l.id, l])));
        }
      } catch { /* titles fall back to a generic label */ }
    }
    if (people.length) {
      getPublicProfileCards(people)
        .then((cards) => { if (run === seq.current) setNames(Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.name || '']))); })
        .catch(() => {});
    }
  }, [myId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const listingOwners = useMemo(
    () => Object.fromEntries(Object.values(listings).map((l) => [l.id, l.user_id])), [listings]);

  const conversations: MarketConversation[] = useMemo(
    () => groupConversations(messages, myId, { blocked, listingOwners, seen }), [messages, myId, blocked, listingOwners, seen]);

  const unread = useMemo(() => totalUnread(conversations), [conversations]);

  /** Marks a conversation read on the server (is_read) and on this device (last seen). */
  const markRead = useCallback((listingId: string, counterpartId: string, lastAt?: string) => {
    if (!myId) return;
    const key = `${listingId}:${counterpartId}`;
    const at = lastAt ?? new Date().toISOString();
    setSeen((prev) => {
      const next = markSeen(prev, key, at);
      if (next !== prev) writeSeenMap(myId, next);
      return next;
    });
    setMessages((prev) => prev.map((m) => (m.listing_id === listingId && m.sender_id === counterpartId && m.receiver_id === myId && !m.is_read
      ? { ...m, is_read: true } : m)));
    void markConversationRead(supabase, myId, listingId, counterpartId);
  }, [myId]);

  return { messages, conversations, listings, names, unread, loading, failed, refresh, markRead };
}
