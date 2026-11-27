import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Heart, Brain, ListChecks, MessageCircleHeart, Ban, Send, Check, AlertTriangle, Phone, HeartHandshake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerData } from '@/hooks/usePartnerData';
import { usePartnerRecentMoods } from '@/hooks/usePartnerRecentMoods';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { sendPartnerMessage } from '@/lib/chat';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';
import { POSTPARTUM_WEEKS, postpartumWeek, usePostpartumPartnerText } from '@/data/postpartum-partner';

/**
 * "İlk 8 həftə" — the partner's guide for the weeks after birth: what she goes through,
 * what to do and say, baby blues vs postnatal depression, warning signs, and one-tap support.
 */
type Tab = 'week' | 'blues' | 'signs' | 'support';

const card = { background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)', padding: 16 } as const;
const label = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--a-ink-faint)' } as const;
const body = { fontSize: 13.5, lineHeight: 1.55, color: 'var(--a-body-text)' } as const;

const Section = ({ icon: Icon, tint, title, children }: { icon: any; tint: [string, string]; title: string; children: React.ReactNode }) => (
  <section style={card}>
    <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
      <span className="w-8 h-8 flex items-center justify-center shrink-0" style={{ borderRadius: 10, background: tint[0] }}><Icon size={15} style={{ color: tint[1] }} /></span>
      <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{title}</h3>
    </div>
    {children}
  </section>
);

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
    {items.map((item) => (
      <li key={item} className="flex gap-2" style={body}><span aria-hidden style={{ color: 'var(--a-ink-faint)' }}>•</span><span>{item}</span></li>
    ))}
  </ul>
);

const PostpartumSupportScreen = ({ onBack }: { onBack: () => void }) => {
  useScrollToTop();
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePostpartumPartnerText(language);
  const { profile } = useAuth();
  const { partnerProfile, sharing, getBabyAgeDays } = usePartnerData();
  const { lowDays } = usePartnerRecentMoods(7, sharing.share_mood);
  const { toast } = useToast();
  const current = postpartumWeek(getBabyAgeDays()) ?? POSTPARTUM_WEEKS;
  // Follows the baby's age (partner data loads after mount) until a week is picked.
  const [picked, setWeek] = useState<number | null>(null);
  const week = picked ?? current;
  const [tab, setTab] = useState<Tab>('week');
  const [sent, setSent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [signs, setSigns] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const send = async (content: string) => {
    if (!profile || !partnerProfile || sending) return false;
    setSending(true);
    try {
      await hapticFeedback.medium();
      await sendPartnerMessage(profile.user_id, partnerProfile.user_id, content);
      return true;
    } catch {
      toast({ title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), variant: 'destructive' });
      return false;
    } finally {
      setSending(false);
    }
  };

  if (!text) {
    return <div className="a-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--a-bg)' }}><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>;
  }
  const t = text.ui;
  const w = text.weeks[week - 1];
  const urgentPicked = signs.some((s) => text.blues.urgent_signs.includes(s));
  // The local emergency number is part of the translated text (112, 119, 120, ...).
  const emergency = (t.signs_urgent.match(/\b\d{3}\b/) || ['112'])[0];
  const tabs: [Tab, string][] = [['week', t.tab_week], ['blues', t.tab_blues], ['signs', t.tab_signs], ['support', t.tab_support]];

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{t.subtitle}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{t.title} 💛</p>
            </div>
          </div>
        </header>

        {lowDays >= 3 &&
          <div className="flex gap-2.5" style={{ background: 'var(--a-pink-1)', borderRadius: 16, padding: 13, marginBottom: 12 }}>
            <Heart size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--a-pink-ink)' }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-pink-ink)' }}>{t.mood_low_title}</p>
              <p style={{ fontSize: 12, color: 'var(--a-pink-ink)', lineHeight: 1.5 }}>{t.mood_low_body.replace('{n}', String(lowDays))} {t.mood_low_long}</p>
            </div>
          </div>}

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar" role="tablist" style={{ marginBottom: 12 }}>
          {tabs.map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className="shrink-0" style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 800,
                background: tab === id ? 'var(--a-ink)' : 'var(--a-surface)', color: tab === id ? 'var(--a-surface)' : 'var(--a-ink)' }}>
              {name}
            </button>
          ))}
        </div>

        {tab === 'week' &&
          <div className="space-y-3">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: POSTPARTUM_WEEKS }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setWeek(n)} aria-pressed={week === n} aria-label={t.week.replace('{n}', String(n))}
                  style={{ height: 36, borderRadius: 12, fontSize: 13, fontWeight: 900,
                    background: week === n ? 'var(--a-peach-2)' : n === current ? 'var(--a-peach-1)' : 'var(--a-surface)',
                    color: week === n ? '#fff' : 'var(--a-ink)' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ padding: '4px 4px 0' }}>
              <p style={label}>{t.week.replace('{n}', String(week))}</p>
              <h2 style={{ fontSize: 19, fontWeight: 900, color: 'var(--a-ink)', letterSpacing: '-0.01em' }}>{w.title}</h2>
            </div>
            <Section icon={Heart} tint={['var(--a-pink-1)', 'var(--a-pink-ink)']} title={t.her_body}><p style={body}>{w.body}</p></Section>
            <Section icon={Brain} tint={['var(--a-lav-1)', 'var(--a-lav-ink)']} title={t.her_mind}><p style={body}>{w.mind}</p></Section>
            <Section icon={ListChecks} tint={['var(--a-green-1)', 'var(--a-green-ink)']} title={t.you_do}><Bullets items={w.do} /></Section>
            <Section icon={MessageCircleHeart} tint={['var(--a-blue-1)', 'var(--a-blue-ink)']} title={t.you_say}>
              <div className="space-y-2">
                {w.say.map((line) => (
                  <div key={line} className="flex items-center gap-2" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '9px 10px 9px 13px' }}>
                    <p className="flex-1" style={{ fontSize: 13, color: 'var(--a-ink)', fontWeight: 600 }}>“{line}”</p>
                    <button type="button" className="a-icon-btn shrink-0" style={{ width: 34, height: 34 }} disabled={sending} aria-label={t.send}
                      onClick={async () => { if (await send(line)) { setSent(line); toast({ title: t.sent }); } }}>
                      {sent === line ? <Check size={15} /> : <Send size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </Section>
            <Section icon={Ban} tint={['var(--a-yellow-1)', 'var(--a-yellow-ink)']} title={t.avoid}><p style={body}>{w.avoid}</p></Section>
          </div>}

        {tab === 'blues' &&
          <div className="space-y-3">
            <Section icon={Heart} tint={['var(--a-pink-1)', 'var(--a-pink-ink)']} title={text.blues.title}>
              <p style={{ ...body, marginBottom: 8 }}>{text.blues.intro}</p>
              <Bullets items={text.blues.facts} />
            </Section>
            <Section icon={ListChecks} tint={['var(--a-green-1)', 'var(--a-green-ink)']} title={text.blues.help_title}><Bullets items={text.blues.help} /></Section>
            <Section icon={Brain} tint={['var(--a-lav-1)', 'var(--a-lav-ink)']} title={text.blues.ppd_title}>
              <p style={{ ...body, marginBottom: 8 }}>{text.blues.ppd_intro}</p>
              <Bullets items={text.blues.ppd_signs} />
              <p style={{ ...body, marginTop: 8, fontWeight: 700, color: 'var(--a-ink)' }}>{text.blues.ppd_action}</p>
            </Section>
            <section style={{ ...card, background: 'var(--a-alert-bg)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <AlertTriangle size={17} style={{ color: 'var(--a-alert-ink)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-alert-ink)' }}>{text.blues.urgent_title}</h3>
              </div>
              <Bullets items={text.blues.urgent_signs} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-alert-ink)', marginTop: 8 }}>{text.blues.urgent_action}</p>
            </section>
            <Section icon={HeartHandshake} tint={['var(--a-blue-1)', 'var(--a-blue-ink)']} title={text.blues.self_title}><Bullets items={text.blues.self} /></Section>
          </div>}

        {tab === 'signs' &&
          <div className="space-y-3">
            <section style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{t.signs_title}</h3>
              <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', margin: '2px 0 10px' }}>{t.signs_sub}</p>
              <div className="space-y-1.5">
                {[...text.blues.ppd_signs, ...text.blues.urgent_signs].map((sign) => {
                  const on = signs.includes(sign);
                  const urgent = text.blues.urgent_signs.includes(sign);
                  return (
                    <button key={sign} type="button" aria-pressed={on} onClick={() => setSigns(on ? signs.filter((s) => s !== sign) : [...signs, sign])}
                      className="w-full flex items-center gap-2.5 text-start" style={{ padding: '10px 12px', borderRadius: 14,
                        background: on ? (urgent ? 'var(--a-alert-bg)' : 'var(--a-lav-1)') : 'var(--a-surface-soft)' }}>
                      <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ borderRadius: 6, border: '1.5px solid var(--a-line-strong, var(--a-line))', background: on ? 'var(--a-ink)' : 'transparent' }}>
                        {on && <Check size={12} style={{ color: 'var(--a-surface)' }} />}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: urgent ? 'var(--a-alert-ink)' : 'var(--a-ink)' }}>{sign}</span>
                    </button>);
                })}
              </div>
            </section>
            <div role="status" style={{ ...card, background: urgentPicked ? 'var(--a-alert-bg)' : signs.length ? 'var(--a-yellow-1)' : 'var(--a-green-1)' }}>
              <p style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.5, color: urgentPicked ? 'var(--a-alert-ink)' : signs.length ? 'var(--a-warn-ink, var(--a-yellow-ink))' : 'var(--a-green-ink)' }}>
                {urgentPicked ? t.signs_urgent : signs.length ? t.signs_some : t.signs_none}
              </p>
              {urgentPicked &&
                <a href={`tel:${emergency}`} className="a-btn-solid inline-flex items-center justify-center gap-2" style={{ marginTop: 10, width: '100%' }}><Phone size={16} />{emergency}</a>}
            </div>
          </div>}

        {tab === 'support' &&
          <div className="space-y-3">
            <section style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{t.tasks_title}</h3>
              <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', margin: '2px 0 10px' }}>{t.tasks_sub}</p>
              <div className="flex flex-wrap gap-1.5">
                {text.tasks.map((task) => {
                  const on = tasks.includes(task);
                  return (
                    <button key={task} type="button" aria-pressed={on} onClick={() => setTasks(on ? tasks.filter((x) => x !== task) : [...tasks, task])}
                      className="inline-flex items-center gap-1" style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                        background: on ? 'var(--a-green-ink)' : 'var(--a-surface-soft)', color: on ? 'var(--a-surface)' : 'var(--a-ink)' }}>
                      {on && <Check size={13} />}{task}
                    </button>);
                })}
              </div>
              <button type="button" className="a-btn-solid w-full inline-flex items-center justify-center gap-2" style={{ marginTop: 12 }}
                disabled={!tasks.length || sending}
                onClick={async () => { if (await send(t.tasks_message.replace('{list}', tasks.join(', ')))) { setTasks([]); toast({ title: t.sent }); } }}>
                <Send size={15} />{t.tasks_send}
              </button>
            </section>
            <section style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{t.phrases_title}</h3>
              <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', margin: '2px 0 10px' }}>{t.phrases_sub}</p>
              <div className="space-y-2">
                {text.phrases.map((line) => (
                  <button key={line} type="button" disabled={sending}
                    onClick={async () => { if (await send(line)) { setSent(line); toast({ title: t.sent }); } }}
                    className="w-full flex items-center gap-2 text-start" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '11px 13px' }}>
                    <span className="flex-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{line}</span>
                    {sent === line ? <Check size={15} style={{ color: 'var(--a-green-ink)' }} /> : <Send size={14} style={{ color: 'var(--a-ink-faint)' }} />}
                  </button>
                ))}
              </div>
            </section>
          </div>}

        <p style={{ fontSize: 11, color: 'var(--a-ink-faint)', textAlign: 'center', marginTop: 16 }}>{t.disclaimer}</p>
      </div>
    </div>);
};

export default PostpartumSupportScreen;
