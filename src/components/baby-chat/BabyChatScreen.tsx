import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Share2, Image as ImageIcon, Clapperboard, Loader2 } from 'lucide-react';
import { useBabyChat } from '@/hooks/useBabyChat';
import { useToast } from '@/hooks/use-toast';
import { useIsRtl } from '@/lib/rtl';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';
import { babyReply, type BabyChatMessage } from '@/lib/baby-chat';
import { scheduleBabyChatNotifications } from '@/lib/baby-chat-notifications';
import { renderChatPhoto, renderChatVideo, shareMedia, videoRecordingSupported, type ShareChatInput } from '@/lib/baby-chat-share';
import './baby-chat.css';

/** "Körpəmdən mesajlar": the unborn baby's daily message and its replies, shareable as photo or video. */
const BabyChatScreen = ({ onBack }: { onBack: () => void }) => {
  const chat = useBabyChat();
  const { text, facts, thread, pendingDaily, setThread, arrived, userId, today, language } = chat;
  const rtl = useIsRtl();
  const { toast } = useToast();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'photo' | 'video' | null>(null);
  const [progress, setProgress] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;

  // Ask for notifications here (a natural moment) and keep the next week scheduled.
  useEffect(() => { if (text) void scheduleBabyChatNotifications(text, userId, true); }, [text, userId]);

  // Deliver today's messages with a typing pause before each.
  useEffect(() => {
    if (!pendingDaily.length) return;
    let cancelled = false;
    void (async () => {
      for (const msg of pendingDaily) {
        setTyping(true);
        await new Promise((r) => setTimeout(r, 1300));
        if (cancelled) return;
        setTyping(false);
        setThread([...threadRef.current, { ...msg, at: Date.now() }]);
        void hapticFeedback.light();
        await new Promise((r) => setTimeout(r, 350));
      }
    })();
    return () => { cancelled = true; setTyping(false); };
  }, [pendingDaily, setThread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread.length, typing]);

  if (!text) {
    return <div className="a-scope bc-screen" style={{ alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
  }
  const u = text.ui;
  const sizeLine = facts.fruit ? u.size.replace('{fruit}', facts.fruit) : '';
  const subtitle = [u.week.replace('{n}', String(facts.week)), sizeLine].filter(Boolean).join(' · ');
  const chip = facts.cm && facts.cm >= 1 ? `${Math.round(facts.cm * 10) / 10} ${tr('common_sm', 'sm')}` : null;
  const dayLabel = `${u.week.replace('{n}', String(facts.week))} · ${u.today}`;
  const shown = thread.length ? thread : chat.previousThread;
  const canShare = thread.some((m) => m.from === 'mom') && thread.some((m) => m.from === 'baby');

  const send = async () => {
    const value = draft.trim();
    if (!value || typing) return;
    const mine: BabyChatMessage = { id: `${today}-m${Date.now()}`, from: 'mom', text: value.slice(0, 300), at: Date.now() };
    const next = [...threadRef.current, mine];
    setThread(next);
    setDraft('');
    void hapticFeedback.light();
    setTyping(true);
    await new Promise((r) => setTimeout(r, 1100 + Math.random() * 900));
    setTyping(false);
    const reply = babyReply(value, text, facts, language, `${userId}:${today}:${next.length}`);
    setThread([...threadRef.current, { id: `${today}-b${Date.now()}`, from: 'baby', text: reply, at: Date.now() }]);
    void hapticFeedback.light();
  };

  const share = async (kind: 'photo' | 'video') => {
    const input: ShareChatInput = { messages: thread, text, subtitle, chip, dayLabel, rtl };
    setBusy(kind);
    setProgress(0);
    try {
      const blob = kind === 'photo' ? await renderChatPhoto(input) : await renderChatVideo(input, setProgress);
      await shareMedia(blob, `anacan-korpem-${today}`, u.share_text);
    } catch (error) {
      console.error('Baby chat share failed', error);
      toast({ title: u.share_error, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="a-scope bc-screen">
      <header className="bc-header safe-area-top">
        <div className="bc-header-row">
          <button type="button" className="bc-back" onClick={onBack} aria-label={tr('common_geri', 'Geri')}><ArrowLeft className="rtl:rotate-180" size={22} /></button>
          <span className="bc-avatar" aria-hidden>👶</span>
          <div className="bc-who">
            <p className="bc-name">{u.title} 💛</p>
            <p className={`bc-sub${typing ? ' typing' : ''}`}>{typing ? u.typing : subtitle}</p>
          </div>
          {chip && <span className="bc-chip"><i />{chip}</span>}
        </div>
      </header>

      <div className="bc-list" ref={listRef}>
        <p className="bc-day">{dayLabel}</p>
        {!thread.length && !arrived && <p className="bc-wait">{u.card_wait}</p>}
        <AnimatePresence initial={false}>
          {shown.map((m) => (
            <motion.div key={m.id} className={`bc-bubble ${m.from}`} initial={{ opacity: 0, scale: 0.85, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
              {m.text}
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" className="bc-bubble baby bc-typing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-label={u.typing}>
              <span /><span /><span />
            </motion.div>
          )}
        </AnimatePresence>

        {canShare && !typing && (
          <motion.section className="bc-share" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="bc-share-title"><Share2 size={15} /> {u.share_title}</p>
            <p className="bc-share-sub">{u.share_sub}</p>
            <div className="bc-share-row">
              <button type="button" onClick={() => share('photo')} disabled={!!busy}>
                {busy === 'photo' ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}{u.share_photo}
              </button>
              {videoRecordingSupported() && (
                <button type="button" className="primary" onClick={() => share('video')} disabled={!!busy}>
                  {busy === 'video' ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
                  {busy === 'video' ? `${u.share_making} ${Math.round(progress * 100)}%` : u.share_video}
                </button>
              )}
            </div>
          </motion.section>
        )}
        <p className="bc-about">{u.about}</p>
      </div>

      <form className="bc-input safe-area-bottom" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={u.placeholder} maxLength={300} aria-label={u.placeholder} />
        <button type="submit" disabled={!draft.trim() || typing} aria-label={tr('helpscreen_gonder_3f11bd', 'Göndər')}><Send size={19} className="rtl:-scale-x-100" /></button>
      </form>
    </div>
  );
};

export default BabyChatScreen;
