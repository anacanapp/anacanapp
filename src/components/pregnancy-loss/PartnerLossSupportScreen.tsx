import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Heart, HeartHandshake, ListChecks, Loader2, MessageCircleHeart, Send, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerData } from '@/hooks/usePartnerData';
import { usePartnerRecentMoods } from '@/hooks/usePartnerRecentMoods';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { sendPartnerMessage } from '@/lib/chat';
import { hapticFeedback } from '@/lib/native';
import { LOSS_RECOVERY_WEEKS, lossPhase, lossWeek, usePregnancyLossText } from '@/data/pregnancy-loss';
import LossSignsChecker from './LossSignsChecker';
import '@/styles/pregnancy-loss.css';

/**
 * The partner's guide after a pregnancy loss: what she goes through now (four two-week phases), what to
 * say and avoid with one-tap messages, "today I take care of" tasks sent to her, his own grief, and a
 * warning-sign check. A low-mood note appears when she shares her mood.
 */
type Tab = 'now' | 'say' | 'you' | 'signs';

const Card = ({ icon: Icon, title, children }: { icon: typeof Heart; title: string; children: React.ReactNode }) => (
  <section className="loss-card">
    <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
      <span className="loss-row-icon" style={{ width: 30, height: 30, borderRadius: 10 }}><Icon size={15} style={{ color: 'var(--loss-accent-ink)' }} /></span>
      <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{title}</h3>
    </div>
    {children}
  </section>
);

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
    {items.map((item) => (
      <li key={item} className="flex gap-2 loss-body"><span aria-hidden style={{ color: 'var(--loss-accent)' }}>•</span><span>{item}</span></li>
    ))}
  </ul>
);

const PartnerLossSupportScreen = ({ onBack }: { onBack: () => void }) => {
  useScrollToTop();
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  const { profile } = useAuth();
  const { partnerProfile, sharing } = usePartnerData();
  const { lowDays } = usePartnerRecentMoods(7, sharing.share_mood);
  const { toast } = useToast();
  const week = lossWeek(partnerProfile?.pregnancy_loss_date) ?? LOSS_RECOVERY_WEEKS;
  const [phase, setPhase] = useState<number | null>(null);
  const shownPhase = phase ?? lossPhase(week);
  const [tab, setTab] = useState<Tab>('now');
  const [sent, setSent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  if (!text) {
    return <div className="a-scope loss-scope loss-page min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>;
  }
  const t = text.ui;
  const p = text.partner;
  const ph = p.phases[shownPhase];

  const send = async (content: string) => {
    if (!profile || !partnerProfile || sending) return false;
    setSending(true);
    try {
      await hapticFeedback.medium();
      await sendPartnerMessage(profile.user_id, partnerProfile.user_id, content);
      return true;
    } catch {
      toast({ title: t.sheet_error, variant: 'destructive' });
      return false;
    } finally {
      setSending(false);
    }
  };

  const tabs: [Tab, string][] = [['now', t.p_tab_now], ['say', t.p_tab_say], ['you', t.p_tab_you], ['signs', t.p_tab_signs]];

  return (
    <div className="a-scope loss-scope loss-page safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden">
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={t.back}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{t.p_sub}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{t.p_title} 🤍</p>
            </div>
          </div>
        </header>

        {sharing.share_mood && lowDays >= 3 &&
          <div className="flex gap-2.5" style={{ background: 'var(--a-pink-1)', borderRadius: 16, padding: 13, marginBottom: 12 }}>
            <Heart size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--a-pink-ink)' }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-pink-ink)' }}>{t.p_mood_low_title}</p>
              <p style={{ fontSize: 12, color: 'var(--a-pink-ink)', lineHeight: 1.5 }}>{t.p_mood_low_body.replace('{n}', String(lowDays))} {t.p_mood_low_long}</p>
            </div>
          </div>}

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar" role="tablist" style={{ marginBottom: 12 }}>
          {tabs.map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="loss-chip shrink-0">{name}</button>
          ))}
        </div>

        {tab === 'now' &&
          <div className="space-y-3">
            <section style={{ background: 'var(--loss-hero)', borderRadius: 'var(--a-radius-md)', padding: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--loss-accent-ink)', marginBottom: 4 }}>{t.p_intro_title}</h2>
              <p className="loss-body">{t.p_intro_body}</p>
            </section>
            <div className="grid grid-cols-4 gap-1.5">
              {p.phases.map((_, i) => (
                <button key={i} type="button" aria-pressed={shownPhase === i} onClick={() => setPhase(i)} className="loss-chip" style={{ padding: '8px 4px', fontSize: 12 }}>
                  {t.p_phase.replace('{a}', String(i * 2 + 1)).replace('{b}', String(i * 2 + 2))}
                </button>
              ))}
            </div>
            <Card icon={HeartHandshake} title={ph.title}><p className="loss-body">{ph.body}</p></Card>
            <Card icon={ListChecks} title={t.p_what_do}><Bullets items={ph.do} /></Card>
            <Card icon={ListChecks} title={t.p_tasks_title}>
              <p className="loss-row-sub" style={{ marginBottom: 8 }}>{t.p_tasks_sub}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.tasks.map((task) => (
                  <button key={task} type="button" aria-pressed={tasks.includes(task)} className="loss-chip" style={{ background: tasks.includes(task) ? undefined : 'var(--loss-soft)', fontSize: 12 }}
                    onClick={() => setTasks((list) => list.includes(task) ? list.filter((x) => x !== task) : [...list, task])}>{task}</button>
                ))}
              </div>
              <button type="button" className="loss-cta" style={{ marginTop: 12, padding: 11, fontSize: 13.5 }} disabled={!tasks.length || sending}
                onClick={async () => { if (await send(t.p_tasks_message.replace('{list}', tasks.join(', ')))) { setTasks([]); toast({ title: t.p_sent }); } }}>
                {t.p_tasks_send}
              </button>
            </Card>
            <p className="loss-row-sub" style={{ textAlign: 'center', padding: '0 12px' }}>{t.p_hidden_note}</p>
          </div>}

        {tab === 'say' &&
          <div className="space-y-3">
            <div className="loss-say-yes">
              <p className="flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 900, marginBottom: 6 }}><ThumbsUp size={14} /> {t.p_say_title}</p>
              <ul className="space-y-1" style={{ margin: 0, padding: 0, listStyle: 'none' }}>{p.say.map((s) => <li key={s} style={{ fontSize: 13, lineHeight: 1.45 }}>“{s}”</li>)}</ul>
            </div>
            <div className="loss-say-no">
              <p className="flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 900, marginBottom: 6 }}><ThumbsDown size={14} /> {t.p_avoid_title}</p>
              <ul className="space-y-1" style={{ margin: 0, padding: 0, listStyle: 'none' }}>{p.avoid.map((s) => <li key={s} style={{ fontSize: 13, lineHeight: 1.45 }}>{s}</li>)}</ul>
            </div>
            <Card icon={MessageCircleHeart} title={t.p_phrases_title}>
              <p className="loss-row-sub" style={{ marginBottom: 8 }}>{t.p_phrases_sub}</p>
              <div className="space-y-2">
                {p.phrases.map((line) => (
                  <div key={line} className="flex items-center gap-2" style={{ background: 'var(--loss-soft)', borderRadius: 14, padding: '9px 10px 9px 13px' }}>
                    <p className="flex-1" style={{ fontSize: 13, color: 'var(--a-ink)', fontWeight: 600 }}>{line}</p>
                    <button type="button" className="a-icon-btn shrink-0" style={{ width: 34, height: 34 }} disabled={sending} aria-label={t.p_send}
                      onClick={async () => { if (await send(line)) { setSent(line); toast({ title: t.p_sent }); } }}>
                      {sent === line ? <Check size={15} /> : <Send size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>}

        {tab === 'you' &&
          <div className="space-y-3">
            <Card icon={User} title={p.you_title}><p className="loss-body" style={{ marginBottom: 10 }}>{p.you_body}</p><Bullets items={p.you_tips} /></Card>
          </div>}

        {tab === 'signs' && <LossSignsChecker text={text} forPartner />}

        <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--a-ink-faint)', textAlign: 'center', padding: '16px 12px 0' }}>{t.disclaimer}</p>
      </div>
    </div>
  );
};

export default PartnerLossSupportScreen;
