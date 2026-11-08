import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useFlowDailyLog, useFlowDailyLogs, useSaveFlowDailyLog } from '@/hooks/useFlowDailyLogs';
import { useAppointments } from '@/hooks/useAppointments';
import { Sheet } from '@/components/anacan/Sheet';
import { Switch } from '@/components/ui/switch';
import PremiumGate from '@/components/premium/PremiumGate';
import { useTtcText, type TtcText } from '@/data/ttc';
import { fill } from '@/lib/feature-text';
import { getLocaleTag } from '@/lib/i18n';
import { hapticFeedback } from '@/lib/native';
import { calculateDueDate } from '@/lib/pregnancy-utils';
import {
  CHECKLIST_KEYS, MIN_BIRTH_YEAR, bbtShift, chanceFor, dayDiff, doctorThresholdFor, maxBirthYear, monthsTrying, validBirthYear, saveFlowGoal, saveTtcState, switchToPregnancy,
  type Chance, type ChecklistKey, type FlowGoal, type PregnancyTest, type TtcState } from
'@/lib/ttc';
import { tr, formatTr } from '@/lib/tr';
import '@/styles/care.css';

const CHANCE_COLOR: Record<Chance, string> = { low: 'var(--a-ink-soft)', medium: '#b07ad8', high: '#8b5cf6', peak: '#5b3aa5' };
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

interface CycleProps {
  lastPeriodDate: Date;
  cycleLength: number;
  periodLength: number;
  ovulation: Date;
  ovulationConfirmed: boolean;
}

/** Flow goal: "track my cycle" or "get pregnant". Rendered at the top of the Flow home. */
export function FlowGoalSection(props: CycleProps) {
  const language = useUserStore((s) => s.language);
  const t = useTtcText(language);
  const { user, profile, refreshProfile } = useAuth();
  const p = profile as { flow_goal?: FlowGoal; ttc_state?: TtcState } | null;
  const [goal, setGoal] = useState<FlowGoal>(p?.flow_goal ?? 'track');
  const [state, setState] = useState<TtcState>(p?.ttc_state ?? {});
  useEffect(() => {if (p?.flow_goal) setGoal(p.flow_goal);}, [p?.flow_goal]);
  useEffect(() => {if (p?.ttc_state) setState(p.ttc_state);}, [p?.ttc_state]);
  if (!t || !user) return null;

  const changeGoal = async (next: FlowGoal) => {
    if (next === goal) return;
    setGoal(next);void hapticFeedback.medium();
    const nextState = next === 'conceive' && !state.started_on ? { ...state, started_on: ymd(new Date()) } : undefined;
    if (nextState) setState(nextState);
    try {await saveFlowGoal(user.id, next, nextState);void refreshProfile?.();} catch {setGoal(goal);toast.error(t.error);}
  };
  const updateState = async (next: TtcState) => {
    setState(next);
    try {await saveTtcState(user.id, next);} catch {toast.error(t.error);}
  };

  return (
    <section className="a-section">
      <div className="cx-seg" role="radiogroup" aria-label={t.goal_title} style={{ background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)', marginBottom: goal === 'conceive' ? 12 : 0 }}>
        <button type="button" role="radio" aria-pressed={goal === 'track'} aria-checked={goal === 'track'} onClick={() => void changeGoal('track')}>🌙 {t.goal_track}</button>
        <button type="button" role="radio" aria-pressed={goal === 'conceive'} aria-checked={goal === 'conceive'} onClick={() => void changeGoal('conceive')}>🌱 {t.goal_conceive}</button>
      </div>
      {goal === 'conceive' && <TtcHome t={t} {...props} state={state} onState={updateState} />}
    </section>);
}

function TtcHome({ t, lastPeriodDate, cycleLength, periodLength, ovulation, ovulationConfirmed, state, onState }: CycleProps & { t: TtcText; state: TtcState; onState: (s: TtcState) => Promise<void> }) {
  const locale = getLocaleTag();
  const today = new Date();
  const cycleDay = dayDiff(today, lastPeriodDate) + 1;
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [positive, setPositive] = useState(false);
  const months = monthsTrying(state.started_on);
  const fertileStart = new Date(ovulation.getFullYear(), ovulation.getMonth(), ovulation.getDate() - 5);
  const fertileEnd = new Date(ovulation.getFullYear(), ovulation.getMonth(), ovulation.getDate() + 1);
  const inWindow = today >= fertileStart && dayDiff(today, fertileEnd) <= 0;
  const shown = picked != null ? new Date(lastPeriodDate.getFullYear(), lastPeriodDate.getMonth(), lastPeriodDate.getDate() + picked - 1) : today;
  const chance = chanceFor(shown, ovulation);
  const short = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const checklistDone = CHECKLIST_KEYS.filter((k) => state.checklist?.[k]).length;
  const lastTest = state.tests?.[state.tests.length - 1];

  // 6 months from age 35, otherwise 12 (birth year is optional; unknown age keeps 12).
  const threshold = doctorThresholdFor(state, today);
  const monthsText = months == null || months < 1 ? t.months_first :
  months >= threshold ? fill(t.months_doctor, { n: months }) : fill(t.months_normal, { n: months });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="cx-card" style={{ textAlign: 'center' }}>
        <div className="cx-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p className="cx-eyebrow" style={{ textAlign: 'start' }}>{months ? fill(t.eyebrow, { n: months + 1 }) : t.eyebrow_start}</p>
          <span className="cx-pill" style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>{t.goal_pill}</span>
        </div>
        <FertilityRing cycleLength={cycleLength} periodLength={periodLength} cycleDay={cycleDay} ovulationDay={dayDiff(ovulation, lastPeriodDate) + 1}
        picked={picked} onPick={(d) => {setPicked(d === picked ? null : d);void hapticFeedback.light();}}>
          <small>{fill(t.cycle_day, { n: picked ?? cycleDay })}{picked != null ? ` · ${short(shown)}` : ''}</small>
          <strong style={{ color: CHANCE_COLOR[chance] }}>{t.chances[chance]}</strong>
          <small>{t.chance}</small>
        </FertilityRing>
        <div className="cx-legend">
          <span><i style={{ background: '#ff8aa4' }} />{t.legend.period}</span>
          <span><i style={{ background: '#c7aef5' }} />{t.legend.fertile}</span>
          <span><i style={{ background: '#5b3aa5' }} />{t.legend.ovulation}</span>
          <span><i style={{ background: 'var(--a-ink)' }} />{t.legend.today}</span>
        </div>
        <p className="cx-sub" style={{ marginTop: 10 }}>
          {inWindow ? <b style={{ color: 'var(--a-lav-ink)' }}>{t.window_today}</b> : fill(t.window, { range: `${short(fertileStart)} – ${short(fertileEnd)}` })}
          {' · '}{fill(t.ovulation, { date: short(ovulation) })}
        </p>
        {ovulationConfirmed && <p className="cx-sub" style={{ color: 'var(--a-green-ink)', fontWeight: 700 }}>✓ {t.ovulation_confirmed}</p>}
        <p className="cx-sub" style={{ fontSize: 11.5, color: 'var(--a-ink-faint)' }}>{t.tap_day}</p>
      </div>

      {lastTest?.result === 'positive' && (!state.snooze_until || state.snooze_until <= ymd(today)) &&
      <motion.button type="button" className="cx-card cx-row cx-gap" initial={{ scale: .97 }} animate={{ scale: 1 }} onClick={() => setPositive(true)}
      style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'linear-gradient(135deg, var(--a-green-1), var(--a-surface))', border: 0 }}>
          <span className="cx-icon" style={{ background: 'var(--a-surface)' }}>🎉</span>
          <b style={{ flex: 1, fontSize: 14.5, color: 'var(--a-green-ink)' }}>{t.positive_title} · {t.positive_switch}</b>
        </motion.button>
      }

      <div className="cx-grid4 cx-gap">
        {[
        { e: '🧪', l: t.quick_lh, bg: 'var(--a-lav-1)' },
        { e: '🌡️', l: t.quick_bbt, bg: 'var(--a-blue-1)' },
        { e: '💞', l: t.quick_intimacy, bg: 'var(--a-pink-1)' },
        { e: '🤰', l: t.quick_test, bg: 'var(--a-green-1)' }].
        map((q) => <button key={q.l} type="button" className="cx-tile" style={{ background: q.bg, minHeight: 80, fontSize: 11.5 }} onClick={() => setSheet(true)}><span className="cx-tile-emoji">{q.e}</span>{q.l}</button>)}
      </div>

      <BbtCard t={t} />

      <div className={`cx-card cx-gap`} style={{ background: months != null && months >= threshold ? 'var(--a-yellow-1)' : 'var(--a-surface)' }}>
        <div className="cx-row" style={{ alignItems: 'flex-start' }}>
          <span className="cx-icon" style={{ background: 'var(--a-lav-1)' }}>🤍</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="cx-sub" style={{ fontSize: 13.5, color: 'var(--a-ink)' }}>{monthsText}</p>
            <label className="cx-row" style={{ gap: 8, marginTop: 8 }}>
              <span className="cx-sub">{t.started_on}</span>
              <input type="month" className="cx-input" style={{ minHeight: 36, width: 'auto', fontSize: 13, padding: '0 8px' }} value={(state.started_on ?? '').slice(0, 7)} max={ymd(today).slice(0, 7)}
              onChange={(e) => e.target.value && void onState({ ...state, started_on: `${e.target.value}-01` })} />
            </label>
            <BirthYearField year={validBirthYear(state.birth_year, today)} max={maxBirthYear(today)}
            onSave={(birth_year) => {const next = { ...state };if (birth_year == null) delete next.birth_year;else next.birth_year = birth_year;void onState(next);}} />
            <p className="cx-sub" style={{ fontSize: 11.5, color: 'var(--a-ink-faint)', marginTop: 6 }}>
              {formatTr('clinical_ttc_doctor_rule', '35 yaşdan kiçik: 12 ay, 35 və yuxarı: 6 ay cəhddən sonra həkimə müraciət edin. Sizin üçün: {n} ay.', { n: threshold })}
            </p>
          </div>
        </div>
      </div>

      <div className="cx-card cx-gap">
        <div className="cx-row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontSize: 15, color: 'var(--a-ink)' }}>{t.checklist_title}</b>
          <span className="cx-sub">{checklistDone} / {CHECKLIST_KEYS.length}</span>
        </div>
        <div className="cx-progress" style={{ margin: '10px 0 4px' }}><i style={{ width: `${checklistDone / CHECKLIST_KEYS.length * 100}%` }} /></div>
        <div className="cx-list">
          {CHECKLIST_KEYS.map((key) => <ChecklistRow key={key} t={t} k={key} done={!!state.checklist?.[key]}
          onToggle={() => {void hapticFeedback.light();void onState({ ...state, checklist: { ...state.checklist, [key]: !state.checklist?.[key] } });}} />)}
        </div>
      </div>

      <div className="cx-card cx-gap" style={{ background: 'var(--a-lav-1)', border: 0 }}>
        <b style={{ fontSize: 14.5, color: 'var(--a-lav-ink)' }}>✨ {t.tips_title}</b>
        <ul className="cx-sub" style={{ margin: '8px 0 0', paddingInlineStart: 18, color: 'var(--a-ink)' }}>{t.tips.map((tip) => <li key={tip} style={{ marginTop: 4 }}>{tip}</li>)}</ul>
      </div>

      <TtcLogSheet t={t} open={sheet} onClose={() => setSheet(false)} lastTest={lastTest?.result ?? null}
      onTest={async (result) => {
        const tests = [...(state.tests ?? []).filter((x) => x.date !== ymd(today)), { date: ymd(today), result }];
        await onState({ ...state, tests });
        if (result === 'positive') {setSheet(false);setPositive(true);}
        if (result === 'faint') toast(t.faint_hint);
      }} />
      <PositiveSheet t={t} open={positive} onClose={() => setPositive(false)} lastPeriodDate={lastPeriodDate}
      onLater={() => {const d = new Date();d.setDate(d.getDate() + 2);void onState({ ...state, snooze_until: ymd(d) });setPositive(false);}} />
    </motion.div>);
}

/** Optional birth year; saved on blur/Enter so typing does not write partial years. */
function BirthYearField({ year, max, onSave }: { year: number | null; max: number; onSave: (year: number | null) => void }) {
  const [draft, setDraft] = useState(year != null ? String(year) : '');
  useEffect(() => {setDraft(year != null ? String(year) : '');}, [year]);
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {if (year != null) onSave(null);return;}
    const next = validBirthYear(trimmed);
    if (next == null) {setDraft(year != null ? String(year) : '');return;}
    if (next !== year) onSave(next);
  };
  return (
    <label className="cx-row" style={{ gap: 8, marginTop: 8 }}>
      <span className="cx-sub">{tr('clinical_ttc_birth_year', 'Doğum iliniz')}</span>
      <input type="number" inputMode="numeric" className="cx-input" min={MIN_BIRTH_YEAR} max={max} placeholder={String(max - 18)}
      style={{ minHeight: 36, width: 96, fontSize: 13, padding: '0 8px' }} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => {if (e.key === 'Enter') (e.target as HTMLInputElement).blur();}} />
    </label>);
}

function FertilityRing({ cycleLength, periodLength, cycleDay, ovulationDay, picked, onPick, children }: {
  cycleLength: number; periodLength: number; cycleDay: number; ovulationDay: number; picked: number | null; onPick: (day: number) => void; children: React.ReactNode;
}) {
  const n = Math.min(45, Math.max(20, cycleLength));
  const size = 236, c = size / 2, r = 98, gap = 1.6;
  const seg = 360 / n;
  const arc = (i: number, rr: number) => {
    const a0 = (i * seg - 90 + gap / 2) * Math.PI / 180, a1 = ((i + 1) * seg - 90 - gap / 2) * Math.PI / 180;
    return `M${c + rr * Math.cos(a0)},${c + rr * Math.sin(a0)} A${rr},${rr} 0 0 1 ${c + rr * Math.cos(a1)},${c + rr * Math.sin(a1)}`;
  };
  const color = (day: number) => {
    if (day <= periodLength) return '#ff8aa4';
    if (day === ovulationDay) return '#5b3aa5';
    if (day >= ovulationDay - 5 && day <= ovulationDay + 1) return '#c7aef5';
    return 'var(--a-surface-soft)';
  };
  const marker = Math.min(n, Math.max(1, cycleDay));
  const ma = ((marker - 0.5) * seg - 90) * Math.PI / 180;
  return (
    <div className="cx-ring-wrap" style={{ marginTop: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {Array.from({ length: n }, (_, i) => {
          const day = i + 1;
          return <path key={day} d={arc(i, r)} fill="none" stroke={color(day)} strokeWidth={picked === day ? 22 : 16} strokeLinecap="butt"
          style={{ cursor: 'pointer', transition: 'stroke-width .15s' }} onClick={() => onPick(day)} />;
        })}
        <circle cx={c + r * Math.cos(ma)} cy={c + r * Math.sin(ma)} r="11" fill="var(--a-surface)" stroke="var(--a-ink)" strokeWidth="3.5" pointerEvents="none" />
      </svg>
      <div className="cx-ring-center">{children}</div>
    </div>);
}

function ChecklistRow({ t, k, done, onToggle }: { t: TtcText; k: ChecklistKey; done: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="cx-li" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer' }} onClick={onToggle} aria-pressed={done}>
      <motion.span className={`cx-check${done ? ' ok' : ''}`} animate={{ scale: done ? [1, 1.25, 1] : 1 }}>{done ? '✓' : ''}</motion.span>
      <span style={{ minWidth: 0 }}>
        <b style={done ? { textDecoration: 'line-through', color: 'var(--a-ink-soft)' } : undefined}>{t.checklist[k].title}</b>
        <small>{t.checklist[k].desc}</small>
      </span>
    </button>);
}

function BbtCard({ t }: { t: TtcText }) {
  const start = ymd(subDays(new Date(), 13));
  const { data: logs = [] } = useFlowDailyLogs(start, ymd(new Date()));
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const key = ymd(subDays(new Date(), 13 - i));
    const row = logs.find((l) => l.log_date === key);
    return { key, temp: row?.temperature ?? null, lh: row?.ovulation_test ?? null, intimacy: row?.sexual_activity === 'unprotected' || row?.sexual_activity === 'protected' };
  }), [logs]);
  const values = days.map((d) => d.temp);
  const present = values.filter((v): v is number => v != null);
  const shift = bbtShift(values);
  const W = 320, H = 120, pad = 12;
  const lo = present.length ? Math.min(...present) - 0.15 : 36.2, hi = present.length ? Math.max(...present) + 0.15 : 37;
  const x = (i: number) => pad + i / 13 * (W - pad * 2);
  const y = (v: number) => 14 + (hi - v) / Math.max(0.1, hi - lo) * (H - 40);
  const pts = days.map((d, i) => d.temp != null ? { x: x(i), y: y(d.temp), i } : null).filter(Boolean) as { x: number; y: number; i: number }[];
  return (
    <div className="cx-gap">
      <PremiumGate title={t.bbt_chart} description={t.bbt_premium} emoji="🌡️" feature="ttc_bbt_chart">
        <div className="cx-card">
          <div className="cx-row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 15, color: 'var(--a-ink)' }}>🌡️ {t.bbt_title}</b>
            <span className="cx-sub">{t.bbt_chart}</span>
          </div>
          <svg className="cx-bbt" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 6 }}>
            {shift != null && <rect x={x(shift) - 6} y="8" width={W - x(shift)} height={H - 34} fill="#c7aef5" opacity=".18" rx="8" />}
            {pts.length > 1 && <polyline fill="none" stroke="#63acdf" strokeWidth="2.5" strokeLinejoin="round" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />}
            {pts.map((p) => <circle key={p.i} cx={p.x} cy={p.y} r="3.6" fill="var(--a-surface)" stroke="#63acdf" strokeWidth="2.2" />)}
            {days.map((d, i) => <g key={d.key}>
                {d.lh && d.lh !== 'negative' && <text x={x(i)} y={H - 14} fontSize="10" textAnchor="middle">🧪</text>}
                {d.intimacy && <text x={x(i)} y={H - 2} fontSize="9" textAnchor="middle">💞</text>}
              </g>)}
          </svg>
          {shift != null ? <p className="cx-sub" style={{ color: 'var(--a-lav-ink)', fontWeight: 700 }}>↑ {t.bbt_shift}</p> : <p className="cx-sub">{t.bbt_hint}</p>}
        </div>
      </PremiumGate>
    </div>);
}

function TtcLogSheet({ t, open, onClose, lastTest, onTest }: { t: TtcText; open: boolean; onClose: () => void; lastTest: PregnancyTest | null; onTest: (r: PregnancyTest) => Promise<void> }) {
  const today = ymd(new Date());
  const { data: log } = useFlowDailyLog(today);
  const save = useSaveFlowDailyLog();
  const [lh, setLh] = useState<'negative' | 'positive' | 'peak' | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [intimacy, setIntimacy] = useState(false);
  const [test, setTest] = useState<PregnancyTest | null>(null);
  useEffect(() => {
    if (!open) return;
    setLh(log?.ovulation_test ?? null);
    setTemp(log?.temperature ?? null);
    setIntimacy(log?.sexual_activity === 'unprotected' || log?.sexual_activity === 'protected');
    setTest(null);
  }, [open, log]);
  const bump = (d: number) => {setTemp((v) => Math.round(Math.min(38.5, Math.max(35, (v ?? 36.5) + d)) * 100) / 100);void hapticFeedback.light();};
  const submit = async () => {
    try {
      await save.mutateAsync({ log_date: today, ovulation_test: lh, temperature: temp, sexual_activity: intimacy ? log?.sexual_activity === 'protected' ? 'protected' : 'unprotected' : log?.sexual_activity === 'none' ? 'none' : null });
      if (test) await onTest(test);
      toast.success(t.saved);
      if (test !== 'positive') onClose();
    } catch {toast.error(t.error);}
  };
  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.log_title}
    footer={<button type="button" className="a3-btn accent cx-wide" disabled={save.isPending} onClick={() => void submit()}>{t.save}</button>}>
      <div className="cx-stack">
        <div>
          <span className="cx-field">🧪 {t.lh_title}</span>
          <div className="cx-seg">
            {(['negative', 'positive', 'peak'] as const).map((v) => <button key={v} type="button" aria-pressed={lh === v} style={lh === v && v !== 'negative' ? { color: 'var(--a-lav-ink)' } : undefined} onClick={() => setLh(lh === v ? null : v)}>{t.lh[v]}</button>)}
          </div>
        </div>
        <div>
          <span className="cx-field">🌡️ {t.bbt_title} · {t.bbt_hint}</span>
          <div className="cx-row" style={{ justifyContent: 'center', gap: 16 }}>
            <button type="button" className="cx-step" onClick={() => bump(-0.05)}>−</button>
            <strong style={{ fontSize: 34, fontWeight: 800, minWidth: 130, textAlign: 'center', color: temp == null ? 'var(--a-ink-faint)' : 'var(--a-ink)' }}>{temp == null ? '—' : `${temp.toFixed(2)}°`}</strong>
            <button type="button" className="cx-step" onClick={() => bump(0.05)}>+</button>
          </div>
        </div>
        <div className="cx-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}><b style={{ fontSize: 14, color: 'var(--a-ink)' }}>💞 {t.intimacy_title}</b><p className="cx-sub">🔒 {t.intimacy_desc}</p></div>
          <Switch checked={intimacy} onCheckedChange={setIntimacy} aria-label={t.intimacy_title} className="data-[state=checked]:bg-[var(--a-peach-2)]" />
        </div>
        <div>
          <span className="cx-field">🤰 {t.test_title} · {t.test_desc}</span>
          <div className="cx-seg">
            {(['negative', 'faint', 'positive'] as const).map((v) => <button key={v} type="button" aria-pressed={test === v} style={test === v && v === 'positive' ? { color: 'var(--a-green-ink)' } : undefined} onClick={() => setTest(test === v ? null : v)}>{t.test[v]}</button>)}
          </div>
          {lastTest && !test && <p className="cx-sub" style={{ marginTop: 6 }}>{t.test[lastTest]}</p>}
        </div>
      </div>
    </Sheet>);
}

function PositiveSheet({ t, open, onClose, onLater, lastPeriodDate }: { t: TtcText; open: boolean; onClose: () => void; onLater: () => void; lastPeriodDate: Date }) {
  const { user, refreshProfile } = useAuth();
  const { setLifeStage, setLastPeriodDate, setDueDate } = useUserStore();
  const { addAppointment } = useAppointments();
  const [visit, setVisit] = useState(true);
  const [busy, setBusy] = useState(false);
  const locale = getLocaleTag();
  const due = calculateDueDate(lastPeriodDate) ?? new Date(lastPeriodDate.getTime() + 280 * 86400_000);
  const long = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const go = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await switchToPregnancy(user.id, ymd(lastPeriodDate), ymd(due));
      if (visit) {
        const visitDate = new Date(lastPeriodDate.getFullYear(), lastPeriodDate.getMonth(), lastPeriodDate.getDate() + 49);
        if (visitDate > new Date()) void addAppointment({ title: t.positive_visit, description: t.positive_visit_desc, event_date: ymd(visitDate), event_type: 'doctor', reminder_enabled: true });
      }
      setLastPeriodDate(lastPeriodDate);setDueDate(due);setLifeStage('bump');
      void refreshProfile?.();
      toast.success(t.switched);
      onClose();
    } catch {toast.error(t.error);} finally {setBusy(false);}
  };
  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.positive_title}
    footer={<div style={{ display: 'grid', gap: 8, width: '100%' }}>
        <button type="button" className="a3-btn accent cx-wide" disabled={busy} onClick={() => void go()}>{t.positive_switch}</button>
        <button type="button" className="a3-btn ghost cx-wide" onClick={onLater}>{t.positive_later}</button>
      </div>}>
      <div className="cx-stack">
        <div className="cx-celebrate">
          <motion.div className="cx-big" initial={{ scale: .4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>🎉</motion.div>
          <p className="cx-sub" style={{ fontSize: 14.5, marginTop: 10 }}>{t.positive_body}</p>
        </div>
        <div className="cx-card" style={{ padding: '4px 16px' }}>
          <div className="cx-list">
            <div className="cx-li"><span className="cx-icon" style={{ background: 'var(--a-lav-1)' }}>📅</span><div><b>{fill(t.positive_lmp, { date: long(lastPeriodDate) })}</b><small>{fill(t.positive_due, { date: long(due) })}</small></div></div>
            <div className="cx-li"><span className="cx-icon" style={{ background: 'var(--a-green-1)' }}>🩺</span><div style={{ flex: 1 }}><b>{t.positive_visit}</b><small>{t.positive_visit_desc}</small></div>
              <Switch checked={visit} onCheckedChange={setVisit} aria-label={t.positive_visit} className="data-[state=checked]:bg-[var(--a-peach-2)]" /></div>
            <div className="cx-li"><span className="cx-icon" style={{ background: 'var(--a-pink-1)' }}>💞</span><div><b>{t.positive_partner}</b><small>{t.positive_partner_desc}</small></div></div>
          </div>
        </div>
      </div>
    </Sheet>);
}
