import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronRight, Images, Loader2, MessageCircleHeart, NotebookPen, Leaf, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { usePregnancyLossText } from '@/data/pregnancy-loss';
import { deleteThreads, loadThreads } from '@/lib/baby-chat';
import { loadLossLetter, saveLossLetter } from '@/lib/pregnancy-loss';
import ReadyChoices from './ReadyChoices';
import '@/styles/pregnancy-loss.css';

/**
 * "Xatirələrim": everything from the pregnancy stays, out of sight, until she wants it. The album (its own
 * screen, where photos can be deleted), the baby chat kept on this device (read or delete), a private
 * letter kept on this device, the recovery guide and the "Hazır olanda" choices.
 */
interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
  onOpenTool: (tool: string) => void;
}

const LossMemoriesScreen = ({ onBack, onNavigate, onOpenTool }: Props) => {
  useScrollToTop();
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || 'local';
  const [threads, setThreads] = useState(() => loadThreads(userId));
  const [letter, setLetter] = useState(() => loadLossLetter(userId));
  const [chatOpen, setChatOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setThreads(loadThreads(userId)); setLetter(loadLossLetter(userId)); }, [userId]);
  const days = useMemo(() => Object.keys(threads).filter((d) => threads[d]?.length).sort(), [threads]);

  if (!text) {
    return <div className="a-scope loss-scope loss-page min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>;
  }
  const t = text.ui;

  const row = (Icon: typeof Images, title: string, sub: string, onClick: () => void, expanded?: boolean) => (
    <button type="button" className="loss-row" onClick={onClick} aria-expanded={expanded}>
      <span className="loss-row-icon"><Icon size={17} style={{ color: 'var(--loss-accent-ink)' }} /></span>
      <span className="flex-1 min-w-0">
        <span className="loss-row-title block">{title}</span>
        <span className="loss-row-sub block">{sub}</span>
      </span>
      {expanded === undefined
        ? <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
        : <ChevronDown size={16} className="shrink-0" style={{ color: 'var(--a-ink-faint)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
    </button>
  );

  return (
    <div className="a-scope loss-scope loss-page safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden">
      <div className="a-shell space-y-3">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={t.back}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{t.memories_title} 🤍</p>
          </div>
        </header>

        <section className="loss-card">
          <p className="loss-body" style={{ marginBottom: 4 }}>{t.mem_intro}</p>
          {row(Images, t.mem_album, t.mem_album_sub, () => onOpenTool('pregnancy-album'))}

          {row(MessageCircleHeart, t.mem_chat, days.length ? t.mem_chat_sub.replace('{n}', String(days.length)) : t.mem_chat_empty, () => setChatOpen((v) => !v), chatOpen)}
          {chatOpen && days.length > 0 &&
            <div style={{ background: 'var(--loss-soft)', borderRadius: 16, padding: 10, margin: '2px 0 10px', maxHeight: 360, overflowY: 'auto' }}>
              {days.map((day) => (
                <div key={day} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--a-ink-faint)', textAlign: 'center', margin: '4px 0 6px' }}>{new Date(`${day}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {threads[day].map((m) => (
                    <div key={m.id} className={`flex ${m.from === 'mom' ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: 4 }}>
                      <p style={{ maxWidth: '82%', fontSize: 12.5, lineHeight: 1.45, padding: '7px 11px', borderRadius: 14,
                        background: m.from === 'mom' ? 'var(--loss-accent)' : 'var(--a-surface)', color: m.from === 'mom' ? '#fff' : 'var(--a-ink)' }}>{m.text}</p>
                    </div>
                  ))}
                </div>
              ))}
              {confirmDelete ?
                <div style={{ background: 'var(--a-surface)', borderRadius: 14, padding: 10 }}>
                  <p className="loss-body" style={{ fontSize: 12.5 }}>{t.mem_chat_delete_confirm}</p>
                  <div className="flex gap-2" style={{ marginTop: 8 }}>
                    <button type="button" className="flex-1" style={{ borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, background: 'var(--a-alert-ink)', color: '#fff' }}
                      onClick={() => { deleteThreads(userId); setThreads({}); setConfirmDelete(false); setChatOpen(false); toast({ title: t.mem_deleted }); }}>{t.mem_chat_delete}</button>
                    <button type="button" className="flex-1" style={{ borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 700, color: 'var(--a-ink-soft)' }} onClick={() => setConfirmDelete(false)}>{t.ready_no}</button>
                  </div>
                </div> :
                <button type="button" className="flex items-center gap-2 mx-auto" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--a-alert-ink)', padding: 6 }} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> {t.mem_chat_delete}
                </button>}
            </div>}

          {row(NotebookPen, t.mem_letter, t.mem_letter_sub, () => setLetterOpen((v) => !v), letterOpen)}
          {letterOpen &&
            <div style={{ margin: '2px 0 10px' }}>
              <textarea value={letter} onChange={(e) => setLetter(e.target.value)} placeholder={t.mem_letter_placeholder} maxLength={5000} rows={7}
                aria-label={t.mem_letter}
                style={{ width: '100%', borderRadius: 16, padding: 12, fontSize: 14, lineHeight: 1.55, background: 'var(--loss-soft)', color: 'var(--a-ink)', border: 0, resize: 'vertical' }} />
              <button type="button" className="loss-cta" style={{ marginTop: 8, padding: 11, fontSize: 13.5 }}
                onClick={() => toast({ title: saveLossLetter(userId, letter) ? t.mem_saved : t.sheet_error })}>{t.mem_save}</button>
            </div>}

          {row(Leaf, t.mem_guide, t.mem_guide_sub, () => onNavigate('loss-guide'))}
        </section>

        <ReadyChoices text={text} onNavigate={onNavigate} />
      </div>
    </div>
  );
};

export default LossMemoriesScreen;
