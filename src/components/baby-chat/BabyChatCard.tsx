import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleHeart } from 'lucide-react';
import { useBabyChat } from '@/hooks/useBabyChat';
import { scheduleBabyChatNotifications } from '@/lib/baby-chat-notifications';
import './baby-chat.css';

/** Pregnancy dashboard: today's message from the baby (or that it is still on its way). */
const BabyChatCard = ({ onOpen }: { onOpen: () => void }) => {
  const { text, unread, arrived, dailyMessage, thread, userId, facts } = useBabyChat();
  // Keeps the next week of on-device notifications scheduled (never prompts here).
  useEffect(() => { if (text) void scheduleBabyChatNotifications(text, userId, false); }, [text, userId]);
  if (!text) return null;
  const u = text.ui;
  const lastBaby = [...thread].reverse().find((m) => m.from === 'baby')?.text;
  const preview = unread ? dailyMessage : lastBaby || (arrived ? dailyMessage : null);

  return (
    <section className="a-section">
      <motion.button type="button" onClick={onOpen} className="a-card w-full text-start" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        whileTap={{ scale: 0.99 }} style={{ padding: 16 }} aria-label={unread ? u.card_new : u.title}>
        <div className="flex items-center gap-3">
          <span className="bc-avatar" style={{ position: 'relative' }} aria-hidden>
            👶
            {unread && <i style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 12, height: 12, borderRadius: 999, background: 'var(--a-coral, #ff5a5f)', border: '2px solid var(--a-surface)' }} />}
          </span>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--a-ink)' }}>{u.title} 💛</p>
            <p style={{ fontSize: 12, fontWeight: unread ? 700 : 500, color: unread ? 'var(--a-coral, #ff5a5f)' : 'var(--a-ink-soft)' }}>
              {unread ? u.card_new : u.week.replace('{n}', String(facts.week))}
            </p>
          </div>
          <MessageCircleHeart size={20} style={{ color: 'var(--a-coral, #ff5a5f)' }} />
        </div>
        {preview ?
          <p className="bc-bubble baby" style={{ marginTop: 12, maxWidth: '92%', background: 'var(--a-surface-soft)', boxShadow: 'none', filter: unread ? 'blur(3px)' : undefined }}>
            {preview}
          </p> :
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--a-ink-soft)' }}>{u.card_wait}</p>}
        {(unread || arrived) &&
          <span className="inline-flex items-center justify-center" style={{ marginTop: 12, height: 40, padding: '0 18px', borderRadius: 999, background: 'var(--a-coral, #ff5a5f)', color: '#fff', fontSize: 13, fontWeight: 800 }}>
            {u.card_cta}
          </span>}
      </motion.button>
    </section>
  );
};

export default BabyChatCard;
