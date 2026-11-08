import { format, isSameDay } from 'date-fns';
import { Loader2, MessageCircle } from 'lucide-react';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr, formatTr } from '@/lib/tr';
import { previewText, type MarketConversation } from '@/lib/marketInbox';
import type { InboxListing } from './useMarketInbox';

interface MarketInboxProps {
  conversations: MarketConversation[];
  listings: Record<string, InboxListing>;
  names: Record<string, string>;
  myId: string | null | undefined;
  loading: boolean;
  failed: boolean;
  onOpen: (conversation: MarketConversation) => void;
  onRetry: () => void;
  now?: Date;
}

export function inboxTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return isSameDay(d, now) ? format(d, 'HH:mm') : format(d, 'd MMM', { locale: getCurrentDateLocale() });
  } catch {
    return format(d, 'HH:mm');
  }
}

/** Market conversations as buyer and as seller: listing, counterpart, last message, time, unread count. */
export function MarketInbox({ conversations, listings, names, myId, loading, failed, onOpen, onRetry, now }: MarketInboxProps) {
  if (loading && conversations.length === 0) {
    return (
      <div className="flex justify-center py-10" role="status" aria-label={tr('marketinbox_loading', 'Mesajlar yüklənir')}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--a-ink-soft)' }} />
      </div>
    );
  }
  if (failed && conversations.length === 0) {
    return (
      <div className="a-card text-center" style={{ padding: 20 }}>
        <p className="a-list-sub" style={{ margin: '0 0 12px', whiteSpace: 'normal' }}>{tr('marketinbox_load_failed', 'Mesajlar yüklənmədi.')}</p>
        <button type="button" className="a-btn-soft mx-auto" style={{ minHeight: 44 }} onClick={onRetry}>
          {tr('chat_retry', 'Yenidən cəhd et')}
        </button>
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="rounded-[26px] p-8 text-center" style={{ background: 'var(--a-surface)', border: '2px dashed var(--a-line-strong)' }}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-grad-green)' }}>
          <MessageCircle className="w-8 h-8" style={{ color: 'var(--a-green-ink)' }} />
        </div>
        <h3 className="a-list-title" style={{ margin: '0 0 4px' }}>{tr('secondhandmarket_hele_mesaj_yoxdur_cf0b5e', 'Hələ mesaj yoxdur')}</h3>
        <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
          {tr('marketinbox_empty_hint', 'Elanlarınız və yazdığınız satıcılarla yazışmalar burada görünəcək.')}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={tr('bottomnav_mesajlar', 'Mesajlar')}>
      {conversations.map((c) => {
        const listing = listings[c.listingId];
        const title = listing?.title || tr('untranslated_elan_voiz8p', 'Elan');
        const who = names[c.counterpartId] || tr('market_user_fallback', 'İstifadəçi');
        const roleLabel = c.role === 'seller' ? tr('marketinbox_role_buyer', 'Alıcı') : tr('marketinbox_role_seller', 'Satıcı');
        const mine = c.last.sender_id === myId;
        const preview = previewText(c.last.content);
        const unreadLabel = c.unread > 0 ? formatTr('marketinbox_unread_count', '{n} oxunmamış', { n: c.unread }) : '';
        return (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="w-full flex items-center gap-3 text-start rounded-[20px] p-3"
              style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer', minHeight: 64 }}
              aria-label={`${title}, ${roleLabel}: ${who}. ${preview}${unreadLabel ? `. ${unreadLabel}` : ''}`}>
              {listing?.images?.[0] ?
                <img src={listing.images[0]} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-xl object-cover shrink-0" /> :
                <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--a-grad-green)' }}>
                  <MessageCircle className="w-5 h-5" style={{ color: 'var(--a-green-ink)' }} />
                </span>}
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="a-list-title truncate" style={{ margin: 0 }}>{title}</span>
                  <span className="text-xs shrink-0" style={{ color: c.unread ? 'var(--a-green-ink)' : 'var(--a-ink-faint)', fontWeight: c.unread ? 700 : 400 }}>
                    {inboxTimeLabel(c.last.created_at, now)}
                  </span>
                </span>
                <span className="block text-xs truncate" style={{ color: 'var(--a-ink-soft)' }}>
                  <span className="a-rank-tag" style={{ margin: '0 6px 0 0', padding: '0 6px', background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>{roleLabel}</span>
                  {who}
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-sm truncate" style={{ color: c.unread ? 'var(--a-ink)' : 'var(--a-ink-soft)', fontWeight: c.unread ? 700 : 400 }}>
                    {mine ? `${tr('chat_you', 'Siz')}: ` : ''}{preview}
                  </span>
                  {c.unread > 0 &&
                    <span
                      data-testid="market-unread-badge"
                      className="shrink-0 rounded-full text-xs font-bold flex items-center justify-center"
                      style={{ minWidth: 20, height: 20, padding: '0 6px', background: 'var(--a-green-2)', color: '#fff' }}
                      aria-hidden="true">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
