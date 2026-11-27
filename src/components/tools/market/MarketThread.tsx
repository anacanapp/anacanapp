import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { tr } from '@/lib/tr';

export interface ThreadMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface MarketThreadProps {
  messages: ThreadMessage[];
  myId: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Second line of the empty state, e.g. "Satıcıya mesaj göndərin". */
  emptyHint?: string;
}

/** Shared chat thread for the second-hand market: my messages on the end side, the counterpart's on the start side. */
export function MarketThread({ messages, myId, value, onChange, onSend, sending, emptyHint }: MarketThreadProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const disabled = !value.trim() || sending;

  return (
    <>
      <div ref={listRef} className="max-h-60 overflow-y-auto space-y-2 p-2" aria-live="polite">
        {messages.length === 0 ?
          <div className="text-center py-6">
            <MessageCircle className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
            <p className="a-list-sub" style={{ margin: 0 }}>{tr('secondhandmarket_hele_mesaj_yoxdur_cf0b5e', 'Hələ mesaj yoxdur')}</p>
            {emptyHint && <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink-faint)' }}>{emptyHint}</p>}
          </div> :
          messages.map((msg) => {
            const mine = msg.sender_id === myId;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 text-sm ${mine ? 'rounded-2xl rounded-ee-sm' : 'rounded-2xl rounded-es-sm'}`}
                  style={mine ?
                    { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' } :
                    { background: 'var(--a-surface-soft)', color: 'var(--a-ink)' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{msg.content}</p>
                  <p className="text-[10px] mt-1" style={{ margin: '4px 0 0', opacity: 0.6 }}>
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex gap-2">
        <input
          className="a-input flex-1"
          placeholder={tr('secondhandmarket_mesajinizi_yazin_21d48f', 'Mesajınızı yazın...')}
          aria-label={tr('secondhandmarket_mesajinizi_yazin_21d48f', 'Mesajınızı yazın...')}
          value={value}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!disabled) onSend(); } }} />
        <button
          type="button"
          className="a-cta-btn"
          aria-label={tr('directmessagescreen_send', 'Göndər')}
          style={{ width: 42, height: 42, padding: 0, justifyContent: 'center', background: 'var(--a-green-2)', opacity: disabled ? 0.5 : 1 }}
          onClick={onSend}
          disabled={disabled}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}
