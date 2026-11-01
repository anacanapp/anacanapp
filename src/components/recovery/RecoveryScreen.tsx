import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarPlus, ChevronRight, Phone, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppointments } from '@/hooks/useAppointments';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useRecoveryText, type RecoveryText } from '@/data/recovery';
import { fill } from '@/lib/feature-text';
import { getEmergencyNumber } from '@/lib/emergency';
import { getLocaleTag } from '@/lib/i18n';
import { hapticFeedback } from '@/lib/native';
import {
  FLAGS, KEGEL_DAILY_GOAL, PROGRAM_WEEKS, checkupDate, flagSeverity, isoDay, kegelLevel, kegelMinutes, listCheckins,
  saveBirthType, saveCheckin, weekAfterBirth, type BirthType, type Checkin, type RecoveryFlag, type StitchState } from
'@/lib/recovery';
import { KegelTrainer } from './KegelTrainer';
import PremiumModal from '@/components/PremiumModal';
import '@/styles/care.css';

type Tab = 'week' | 'checkin' | 'kegel' | 'signs';
interface Props { onBack: () => void; onNavigateToTool?: (tool: string) => void; initialTab?: Tab }

const MOOD_EMOJI = ['😢', '😟', '😐', '🙂', '😊'];
const PAIN_COLOR = (n: number) => n <= 3 ? '#63bd8b' : n <= 6 ? '#f59f00' : '#e03131';

export function useRecoveryCheckins(days = 14) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['postpartum-checkins', user?.id, days], queryFn: () => listCheckins(user!.id, days), enabled: !!user?.id, staleTime: 60_000 });
}

export default function RecoveryScreen(props: Props) {
  useScrollToTop();
  const language = useUserStore((s) => s.language);
  const t = useRecoveryText(language);
  if (!t) return <div className="a-scope cx-page" />;
  return <RecoveryContent t={t} {...props} />;
}

function RecoveryContent({ t, onBack, onNavigateToTool, initialTab = 'week' }: Props & { t: RecoveryText }) {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const locale = getLocaleTag();
  const { isPremium } = useSubscription();
  const birthDate = (profile as { baby_birth_date?: string | null } | null)?.baby_birth_date ?? null;
  const [birthType, setBirthType] = useState<BirthType | null>((profile as { birth_type?: BirthType | null } | null)?.birth_type ?? null);
  const [choosing, setChoosing] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [paywall, setPaywall] = useState(false);
  const week = weekAfterBirth(birthDate);
  const emergency = getEmergencyNumber((profile as { country_code?: string | null } | null)?.country_code ?? null);
  const checkins = useRecoveryCheckins(14);
  const today = isoDay(new Date());
  const todayCheckin = checkins.data?.find((c) => c.day === today) ?? null;

  const save = useMutation({
    mutationFn: (c: Partial<Checkin>) => saveCheckin(user!.id, { day: today, ...c }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['postpartum-checkins'] })
  });

  const chooseType = async (type: BirthType) => {
    setBirthType(type);setChoosing(false);
    try {await saveBirthType(user!.id, type);void refreshProfile?.();} catch {toast.error('—');}
  };

  if (!birthType || choosing) {
    return (
      <Shell t={t} onBack={choosing ? () => setChoosing(false) : onBack} eyebrow={t.title} title={t.choose_title}>
        <p className="cx-sub" style={{ marginBottom: 14 }}>{t.choose_desc}</p>
        <div className="cx-grid2">
          {(['vaginal', 'cesarean'] as BirthType[]).map((type) =>
          <motion.button key={type} type="button" className="cx-tile" whileTap={{ scale: .96 }} aria-pressed={birthType === type}
          style={{ minHeight: 150, background: type === 'vaginal' ? 'var(--a-peach-1)' : 'var(--a-lav-1)', fontSize: 15 }} onClick={() => void chooseType(type)}>
              <span style={{ fontSize: 44 }}>{type === 'vaginal' ? '🌸' : '🩹'}</span>{t[type]}
            </motion.button>
          )}
        </div>
      </Shell>);
  }

  const program = t.weeks[birthType];
  const weekIdx = Math.min(PROGRAM_WEEKS, Math.max(1, week ?? 1)) - 1;
  const content = program[weekIdx];
  const afterProgram = (week ?? 1) > PROGRAM_WEEKS;
  const kegel = kegelLevel(week);

  return (
    <Shell t={t} onBack={onBack} eyebrow={birthType === 'cesarean' ? t.eyebrow_cesarean : t.eyebrow_vaginal}
    title={afterProgram ? t.after_title : fill(t.week_title, { n: week ?? 1 })}>
      <div className="cx-tabs" role="tablist">
        {(Object.keys(t.tabs) as Tab[]).map((key) =>
        <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => {setTab(key);void hapticFeedback.light();}}>{t.tabs[key]}</button>
        )}
      </div>

      {tab === 'week' &&
      <WeekTab t={t} weekIdx={weekIdx} week={week} afterProgram={afterProgram} content={content} birthDate={birthDate} locale={locale}
      todayCheckin={todayCheckin} kegelText={fill(t.kegel_today, { done: todayCheckin?.kegel_sessions ?? 0, goal: KEGEL_DAILY_GOAL, min: kegelMinutes(kegel) })}
      onTab={setTab} onChangeType={() => setChoosing(true)} onMoodTest={() => onNavigateToTool?.('mental-health')} />
      }
      {tab === 'checkin' && <CheckinTab t={t} birthType={birthType} existing={todayCheckin} history={checkins.data ?? []} emergency={emergency} saving={save.isPending}
      onSave={async (c) => {await save.mutateAsync(c);toast.success(t.checkin_saved);}} locale={locale} />}
      {tab === 'kegel' &&
      <div className="cx-card">
          <KegelTrainer t={t} level={kegel} locked={!isPremium} onUpgrade={() => setPaywall(true)} cesarean={birthType === 'cesarean'}
        done={todayCheckin?.kegel_sessions ?? 0}
        onComplete={async () => {
          const n = (todayCheckin?.kegel_sessions ?? 0) + 1;
          await save.mutateAsync({ kegel_sessions: Math.min(10, n) });
          toast.success(fill(t.kegel_done, { n }));
        }} />
        </div>
      }
      {tab === 'signs' && <SignsTab t={t} emergency={emergency} existing={todayCheckin}
      onSave={async (flags) => {await save.mutateAsync({ flags });}} />}

      <p className="cx-disc">{t.disclaimer}</p>
      <PremiumModal isOpen={paywall} onClose={() => setPaywall(false)} feature={t.kegel_premium} />
    </Shell>);
}

function Shell({ t, onBack, eyebrow, title, children }: { t: RecoveryText; onBack: () => void; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="a-scope cx-page safe-top">
      <div className="a-sky" aria-hidden><span className="a-cloud c1" /><span className="a-cloud c2" /></div>
      <div className="cx-wrap">
        <div className="cx-head">
          <button type="button" onClick={onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label={t.title}><ArrowLeft className="rtl:rotate-180" size={18} /></button>
          <div className="cx-titles"><p className="cx-eyebrow">{eyebrow}</p><h1 className="cx-title">{title}</h1></div>
        </div>
        {children}
      </div>
    </div>);
}

function WeekTab({ t, weekIdx, week, afterProgram, content, birthDate, locale, todayCheckin, kegelText, onTab, onChangeType, onMoodTest }: {
  t: RecoveryText; weekIdx: number; week: number | null; afterProgram: boolean; content: RecoveryText['weeks']['vaginal'][number];
  birthDate: string | null; locale: string; todayCheckin: Checkin | null; kegelText: string;
  onTab: (tab: Tab) => void; onChangeType: () => void; onMoodTest: () => void;
}) {
  const { addAppointment } = useAppointments();
  const [added, setAdded] = useState(false);
  const checkup = birthDate ? checkupDate(birthDate) : null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="cx-card" style={{ background: 'linear-gradient(160deg, var(--a-surface), var(--a-surface-soft))' }}>
        <div className="cx-weeks" aria-hidden>
          {Array.from({ length: PROGRAM_WEEKS }, (_, i) => <i key={i} className={i < weekIdx || afterProgram ? 'on' : i === weekIdx ? 'now' : ''} />)}
        </div>
        <p className="cx-eyebrow" style={{ marginTop: 14 }}>{t.focus}</p>
        <h2 className="cx-title" style={{ fontSize: 18, margin: '4px 0 6px' }}>{afterProgram ? t.after_title : content.title}</h2>
        <p className="cx-sub" style={{ fontSize: 13.5 }}>{afterProgram ? t.after_body : content.body}</p>
        {!afterProgram &&
        <div className="cx-list" style={{ marginTop: 10 }}>
            {content.tips.map((tip) => <div key={tip} className="cx-li" style={{ padding: '9px 0' }}><span className="cx-check ok">✓</span><span style={{ fontSize: 13.5, color: 'var(--a-ink)' }}>{tip}</span></div>)}
          </div>
        }
      </div>

      <button type="button" className="cx-card cx-row cx-gap" style={{ width: '100%', textAlign: 'start', cursor: 'pointer' }} onClick={() => onTab('checkin')}>
        <span className="cx-icon" style={{ background: 'var(--a-peach-1)' }}>{todayCheckin ? MOOD_EMOJI[(todayCheckin.mood ?? 3) - 1] : '📝'}</span>
        <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5, color: 'var(--a-ink)' }}>{t.checkin_title}</b><span className="cx-sub" style={{ display: 'block' }}>{todayCheckin ? t.checkin_saved : '30 s'}</span></span>
        <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
      </button>

      <button type="button" className="cx-card cx-row cx-gap" style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'var(--a-lav-1)', border: 0 }} onClick={() => onTab('kegel')}>
        <span className="cx-icon" style={{ background: 'var(--a-surface)' }}>🌸</span>
        <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5, color: 'var(--a-ink)' }}>{t.kegel_title}</b><span className="cx-sub" style={{ display: 'block', color: 'var(--a-lav-ink)' }}>{kegelText}</span></span>
        <span className="a3-btn sm ghost">{t.kegel_start}</span>
      </button>

      {checkup && (week ?? 1) <= 8 &&
      <div className="cx-card cx-gap">
          <div className="cx-row">
            <span className="cx-icon" style={{ background: 'var(--a-green-1)' }}>🩺</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14.5, color: 'var(--a-ink)' }}>{t.checkup_title}</b>
              <span className="cx-sub" style={{ display: 'block' }}>{fill(t.checkup_desc, { date: checkup.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}</span>
            </span>
          </div>
          <div className="cx-list" style={{ marginTop: 8 }}>
            {t.checkup_questions.map((q) => <div key={q} className="cx-li" style={{ padding: '8px 0', fontSize: 13.5, color: 'var(--a-ink)' }}>❓ {q}</div>)}
          </div>
          <button type="button" className="a3-btn soft cx-wide" style={{ marginTop: 8 }} disabled={added} onClick={async () => {
          const ok = await addAppointment({ title: t.checkup_title, description: t.checkup_questions.join('\n'), event_date: isoDay(checkup), event_type: 'doctor', reminder_enabled: true });
          if (ok) {setAdded(true);toast.success(t.added_calendar);}
        }}><CalendarPlus size={17} />{added ? t.added_calendar : t.add_to_calendar}</button>
        </div>
      }

      <div className="cx-card cx-gap" style={{ padding: 0, overflow: 'hidden' }}>
        <button type="button" className="cx-link" onClick={() => onTab('signs')}>
          <span className="cx-icon" style={{ background: 'var(--a-pink-1)' }}>🚨</span><b style={{ flex: 1, fontSize: 14 }}>{t.signs_question}</b>
          <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
        </button>
        <button type="button" className="cx-link" style={{ borderTop: '1px solid var(--a-line)' }} onClick={onMoodTest}>
          <span className="cx-icon" style={{ background: 'var(--a-lav-1)' }}>💜</span><b style={{ flex: 1, fontSize: 14 }}>{t.mood_test}</b>
          <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
        </button>
        <button type="button" className="cx-link" style={{ borderTop: '1px solid var(--a-line)' }} onClick={onChangeType}>
          <span className="cx-icon" style={{ background: 'var(--a-surface-soft)' }}>🔁</span><b style={{ flex: 1, fontSize: 14 }}>{t.change_type}</b>
        </button>
      </div>
    </motion.div>);
}

function CheckinTab({ t, birthType, existing, history, emergency, saving, onSave, locale }: {
  t: RecoveryText; birthType: BirthType; existing: Checkin | null; history: Checkin[]; emergency: string; saving: boolean; locale: string;
  onSave: (c: Partial<Checkin>) => Promise<void>;
}) {
  const [bleeding, setBleeding] = useState<number | null>(existing?.bleeding ?? null);
  const [pain, setPain] = useState<number | null>(existing?.pain ?? null);
  const [stitches, setStitches] = useState<StitchState | null>(existing?.stitches ?? (birthType === 'vaginal' ? null : null));
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  useEffect(() => {
    if (!existing) return;
    setBleeding(existing.bleeding);setPain(existing.pain);setStitches(existing.stitches);setMood(existing.mood);
  }, [existing]);
  const severity = flagSeverity(existing?.flags ?? [], bleeding);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();d.setDate(d.getDate() - (6 - i));
    return { key: isoDay(d), label: d.toLocaleDateString(locale, { weekday: 'narrow' }), row: history.find((h) => h.day === isoDay(d)) };
  });
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cx-stack">
      <div className="cx-card">
        <span className="cx-field">🩸 {t.bleeding}</span>
        <div className="cx-seg">
          {t.bleeding_levels.map((label, i) => <button key={label} type="button" aria-pressed={bleeding === i} style={bleeding === i && i === 3 ? { color: '#c92a2a' } : undefined} onClick={() => setBleeding(i)}>{label}</button>)}
        </div>
      </div>
      <div className="cx-card">
        <div className="cx-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="cx-field" style={{ margin: 0 }}>⚡ {t.pain}</span>
          {pain != null && <strong style={{ color: PAIN_COLOR(pain), fontSize: 18 }}>{pain}/10</strong>}
        </div>
        <div className="cx-pain">
          {Array.from({ length: 11 }, (_, n) => <button key={n} type="button" aria-pressed={pain === n} style={pain === n ? { background: PAIN_COLOR(n) } : undefined} onClick={() => {setPain(n);void hapticFeedback.light();}}>{n}</button>)}
        </div>
      </div>
      <div className="cx-card">
        <span className="cx-field">🩹 {t.stitches}</span>
        <div className="cx-chips">
          {(Object.keys(t.stitches_levels) as StitchState[]).map((s) => <button key={s} type="button" className="cx-chip" aria-pressed={stitches === s} onClick={() => setStitches(s)}>{t.stitches_levels[s]}</button>)}
        </div>
      </div>
      <div className="cx-card">
        <span className="cx-field">💭 {t.mood}</span>
        <div className="cx-mood">
          {MOOD_EMOJI.map((emoji, i) => <button key={emoji} type="button" aria-pressed={mood === i + 1} aria-label={t.mood_levels[i]} onClick={() => {setMood(i + 1);void hapticFeedback.light();}}>{emoji}</button>)}
        </div>
        {mood != null && <p className="cx-sub" style={{ textAlign: 'center', marginTop: 6 }}>{t.mood_levels[mood - 1]}</p>}
      </div>
      {severity && <SeverityAlert t={t} severity={severity} emergency={emergency} harm={false} />}
      <button type="button" className="a3-btn accent cx-wide" disabled={saving || (bleeding == null && pain == null && mood == null && stitches == null)}
      onClick={() => void onSave({ bleeding, pain, stitches, mood })}>{t.save_checkin}</button>
      <div className="cx-card">
        <span className="cx-field">{t.history}</span>
        <div className="cx-hist">
          {last7.map((d) => <div key={d.key}><i style={d.row?.flags?.length ? { background: 'var(--a-pink-1)' } : d.row ? { background: 'var(--a-lav-1)' } : undefined}>{d.row?.mood ? MOOD_EMOJI[d.row.mood - 1] : ''}</i>{d.label}</div>)}
        </div>
      </div>
    </motion.div>);
}

function SeverityAlert({ t, severity, emergency, harm }: { t: RecoveryText; severity: 'urgent' | 'doctor'; emergency: string; harm: boolean }) {
  const { sendSOS, hasPartner } = useSOSAlert();
  const [told, setTold] = useState(false);
  if (severity === 'doctor') return <div className="cx-warn"><b style={{ display: 'block', fontSize: 14 }}>🩺 {t.doctor_alert_title}</b>{t.doctor_alert_body}</div>;
  return (
    <motion.div className="cx-alert" initial={{ scale: .97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <b>🚨 {t.urgent_title}</b>
      {fill(harm ? t.harm_body : t.urgent_body, { number: emergency })}
      <a className="cx-call" href={`tel:${emergency}`}><Phone size={17} />{fill(t.call, { number: emergency })}</a>
      {hasPartner &&
      <button type="button" className="a3-btn ghost cx-wide" style={{ marginTop: 8 }} disabled={told} onClick={async () => {
        const result = await sendSOS(t.partner_alert_msg, false);
        if (!result?.error) {setTold(true);toast.success(t.partner_told);}
      }}><Send size={16} />{told ? t.partner_told : t.tell_partner}</button>
      }
    </motion.div>);
}

function SignsTab({ t, emergency, existing, onSave }: { t: RecoveryText; emergency: string; existing: Checkin | null; onSave: (flags: RecoveryFlag[]) => Promise<void> }) {
  const [flags, setFlags] = useState<RecoveryFlag[]>(existing?.flags ?? []);
  const toggle = (f: RecoveryFlag) => {
    const next = flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f];
    setFlags(next);void hapticFeedback.medium();
    void onSave(next).catch(() => {});
  };
  const severity = flagSeverity(flags, null);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cx-stack">
      <div className="cx-card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <b style={{ display: 'block', fontSize: 14.5, color: 'var(--a-ink)', padding: '8px 0' }}>{t.signs_question}</b>
        <div className="cx-list">
          {FLAGS.map((f) => <button key={f} type="button" className="cx-flag" aria-pressed={flags.includes(f)} onClick={() => toggle(f)}><span className="cx-check">{flags.includes(f) ? '✓' : ''}</span>{t.flags[f]}</button>)}
        </div>
      </div>
      {severity && <SeverityAlert t={t} severity={severity} emergency={emergency} harm={flags.includes('harm')} />}
    </motion.div>);
}
