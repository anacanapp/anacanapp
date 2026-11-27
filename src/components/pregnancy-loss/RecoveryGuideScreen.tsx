import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Check, ChevronDown, HeartPulse, ListChecks, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useUserStore } from '@/store/userStore';
import { LOSS_RECOVERY_WEEKS, lossWeek, usePregnancyLossText } from '@/data/pregnancy-loss';
import { loadLossTodos, saveLossTodos } from '@/lib/pregnancy-loss';
import LossSignsChecker from './LossSignsChecker';
import '@/styles/pregnancy-loss.css';

/**
 * The mother's 8-week recovery guide: what her body and feelings go through each week, a small self-care
 * checklist (kept on the device), a body check with warning signs, and honest answers to common questions.
 */
type Tab = 'week' | 'signs' | 'faq';

const Section = ({ icon: Icon, title, children }: { icon: typeof Brain; title: string; children: React.ReactNode }) => (
  <section className="loss-card">
    <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
      <span className="loss-row-icon" style={{ width: 30, height: 30, borderRadius: 10 }}><Icon size={15} style={{ color: 'var(--loss-accent-ink)' }} /></span>
      <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{title}</h3>
    </div>
    {children}
  </section>
);

const RecoveryGuideScreen = ({ onBack, initialTab = 'week' }: { onBack: () => void; initialTab?: Tab }) => {
  useScrollToTop();
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  const { user, profile } = useAuth();
  const current = lossWeek(profile?.pregnancy_loss_date) ?? LOSS_RECOVERY_WEEKS;
  const [picked, setPicked] = useState<number | null>(null);
  const week = picked ?? current;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [open, setOpen] = useState<number | null>(0);
  const userId = user?.id || 'local';
  const [todos, setTodos] = useState(() => loadLossTodos(userId));
  useEffect(() => { setTodos(loadLossTodos(userId)); }, [userId]);

  if (!text) {
    return <div className="a-scope loss-scope loss-page min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>;
  }
  const t = text.ui;
  const w = text.weeks[week - 1];
  const tabs: [Tab, string][] = [['week', t.tab_week], ['signs', t.tab_signs], ['faq', t.tab_faq]];
  const toggleTodo = (i: number) => {
    const key = `${week}:${i}`;
    const next = { ...todos, [key]: !todos[key] };
    setTodos(next);
    saveLossTodos(userId, next);
  };

  return (
    <div className="a-scope loss-scope loss-page safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden">
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={t.back}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{t.guide_sub}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{t.guide_title} 🌿</p>
            </div>
          </div>
        </header>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar" role="tablist" style={{ marginBottom: 12 }}>
          {tabs.map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="loss-chip shrink-0">{name}</button>
          ))}
        </div>

        {tab === 'week' &&
          <div className="space-y-3">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: LOSS_RECOVERY_WEEKS }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setPicked(n)} aria-pressed={week === n} aria-label={t.week.replace('{n}', String(n))}
                  style={{ height: 34, borderRadius: 11, fontSize: 13, fontWeight: 900,
                    background: week === n ? 'var(--loss-accent)' : n < current ? 'var(--loss-soft)' : 'var(--a-surface)',
                    color: week === n ? '#fff' : n < current ? 'var(--loss-accent-ink)' : 'var(--a-ink-soft)' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ padding: '4px 4px 0' }}>
              <p className="loss-tag">{t.week.replace('{n}', String(week))}</p>
              <h2 style={{ fontSize: 19, fontWeight: 900, color: 'var(--a-ink)', letterSpacing: '-0.01em' }}>{w.title}</h2>
            </div>
            <Section icon={HeartPulse} title={t.your_body}><p className="loss-body">{w.body}</p></Section>
            <Section icon={Brain} title={t.your_mind}><p className="loss-body">{w.mind}</p></Section>
            <Section icon={ListChecks} title={t.for_you}>
              <div className="space-y-1.5">
                {w.todo.map((item, i) => {
                  const done = !!todos[`${week}:${i}`];
                  return (
                    <button key={item} type="button" role="checkbox" aria-checked={done} onClick={() => toggleTodo(i)} className="flex items-center gap-3 w-full text-start" style={{ padding: '6px 0' }}>
                      <span className="grid place-items-center shrink-0" style={{ width: 22, height: 22, borderRadius: 999,
                        background: done ? 'var(--loss-accent)' : 'transparent', border: done ? 0 : '1.5px solid var(--a-line-strong)' }}>
                        {done && <Check size={13} color="#fff" strokeWidth={3} />}
                      </span>
                      <span className="loss-body" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
            <div className="loss-alert" role="note"><b className="block" style={{ fontSize: 13.5, marginBottom: 2 }}>{t.warn_title}</b>{t.warn_body}</div>
          </div>}

        {tab === 'signs' && <LossSignsChecker text={text} />}

        {tab === 'faq' &&
          <div className="space-y-2">
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--a-ink)', padding: '0 4px 4px' }}>{t.faq_title}</h2>
            {text.faq.map((item, i) => (
              <div key={item.q} className="loss-card" style={{ padding: 0 }}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex items-center gap-3 w-full text-start" style={{ padding: '14px 16px' }}>
                  <span className="flex-1" style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>{item.q}</span>
                  <ChevronDown size={16} style={{ color: 'var(--a-ink-faint)', transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {open === i && <p className="loss-body" style={{ padding: '0 16px 14px' }}>{item.a}</p>}
              </div>
            ))}
          </div>}

        <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--a-ink-faint)', textAlign: 'center', padding: '16px 12px 0' }}>{t.disclaimer}</p>
      </div>
    </div>
  );
};

export default RecoveryGuideScreen;
