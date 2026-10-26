import '@/styles/aptek.css';
import '@/styles/babycare.css';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Moon, MoonStar, CloudMoon, Sun, Coffee, Minus, Plus, Target, Undo2, RotateCcw, ListChecks, CheckCircle2, Circle,
  Calendar, Smile, Meh, Frown, Hand, Armchair, TrendingDown, Timer, ShieldCheck, Phone, Info, BellRing, Lightbulb,
  Flame, Pencil, Shirt, Milk, BookOpen, Bath, BedDouble, BarChart3, Trash2, Activity, AlertTriangle, ChevronDown, Check,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useChildren } from '@/hooks/useChildren';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { useBabyLogsRange } from '@/hooks/useBabyLogsRange';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { hapticFeedback } from '@/lib/native';
import { getEmergencyNumber } from '@/lib/emergency';
import { bc, durationUnits, type BabycareKey } from '@/lib/babycare-i18n';
import { formatClockSeconds, formatMinutes } from '@/lib/baby-logs-range';
import {
  BAND_NORMS, DEFAULT_PLAN_STATE, MAX_SLEEP_MINUTES, METHODS, METHOD_STEPS, MIN_SLEEP_MINUTES, PLAN_DAYS, RATINGS,
  ROUTINE_STEPS, SAFETY_ITEMS, WAKE_MAX, WAKE_MIN, WAKE_PRESETS, adjustNightWakes, ageBand, averageNightWakes, blockMinutes,
  buildSchedule, dayOffset, formatClock, localDateKey, minutesOfDay, monthsOld, nightKey, parseClock, parsePlanState, pickMethod,
  planDayNumber, planProgress, planStorageKey, prunePlanState, ratePlanDay, resetPlan, routineStreak, scheduleStatus, setPendingSleep,
  setWake, shiftWake, sleepDays, sleepEntries, sleepSummary, timelineSegments, toggleRoutine, toggleSafety, toggleStep,
  type AgeBand, type Insight, type Method, type PlanState, type Rating, type ScheduleBlock, type SleepDay, type SleepSummary,
} from '@/lib/sleep-training';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { Sheet } from '@/components/anacan/Sheet';
import { ToolPage, ToolHeader, ToolEmpty } from './anacan/ToolKit';

type Tone = 'lav' | 'blue' | 'green' | 'peach' | 'yellow' | 'pink' | 'neutral';
type Tab = 'today' | 'week' | 'plan' | 'safety';

const dur = (m: number) => formatMinutes(m, durationUnits());
const fill = (key: BabycareKey, vars: Record<string, string | number>) => bc(key, vars);
const clockOf = (d: Date) => formatClock(minutesOfDay(d));
const weekday = (d: Date) => format(d, 'EEEEEE', { locale: getCurrentDateLocale() });
const dayMonth = (d: Date) => format(d, 'd MMMM', { locale: getCurrentDateLocale() });

function blockLabel(b: ScheduleBlock, i: number) {
  return b.type === 'nap' ? bc('sleeptraining_block_nap') : b.type === 'bedtime' ? bc('sleeptraining_block_bedtime')
    : i === 0 ? bc('sleeptraining_block_morning') : bc('sleeptraining_block_awake');
}

function Ico({ icon: Icon, tone = 'lav', size = 36 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  return <span aria-hidden="true" className={`st-ico st-${tone}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.34) }}><Icon size={Math.round(size * 0.5)} strokeWidth={2.2} /></span>;
}

function Card({ title, subtitle, icon, tone = 'lav', aside, children }: { title: string; subtitle?: string; icon?: LucideIcon; tone?: Tone; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="a3-card a3-pad st-card">
      <header className="st-card-head">
        {icon && <Ico icon={icon} tone={tone} />}
        <div className="grow"><h3 className="st-card-title">{title}</h3>{subtitle && <p className="a3-meta">{subtitle}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Pill({ tone = 'neutral', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return <span className={`st-pill st-${tone}`}>{Icon && <Icon size={12} strokeWidth={2.4} aria-hidden="true" />}{children}</span>;
}

function ProgressCircle({ value, total, size = 64, tone = 'green', label }: { value: number; total: number; size?: number; tone?: Tone; label?: string }) {
  const stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r, p = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <div className="st-progress" style={{ width: size, height: size }} role="img" aria-label={`${value}/${total}`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--a-line-strong)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={`st-stroke-${tone}`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <span style={{ fontSize: Math.round(size * 0.22) }}>{label ?? `${value}/${total}`}</span>
    </div>
  );
}

function Stepper({ value, minusLabel, plusLabel, onMinus, onPlus, minusDisabled, plusDisabled, tone = 'lav', width = 44, compact }: {
  value: string; minusLabel: string; plusLabel: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean;
  tone?: Tone; width?: number; compact?: boolean;
}) {
  const size = compact ? 34 : 40;
  const btn = (label: string, onClick: () => void, disabled: boolean | undefined, Icon: LucideIcon) => (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={`st-step st-${tone}`} style={{ width: size, height: size }}>
      <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
  return (
    <div className="st-stepper">
      {btn(minusLabel, onMinus, minusDisabled, Minus)}
      <span aria-live="polite" className="a3-num" style={{ minWidth: width }}>{value}</span>
      {btn(plusLabel, onPlus, plusDisabled, Plus)}
    </div>
  );
}

function LinkButton({ children, onClick, tone = 'neutral', icon: Icon }: { children: ReactNode; onClick: () => void; tone?: Tone; icon?: LucideIcon }) {
  return <button type="button" onClick={onClick} className={`st-link st-ink-${tone}`}>{Icon && <Icon size={14} strokeWidth={2.2} aria-hidden="true" />}{children}</button>;
}

const METHOD_INFO: Record<Method, { icon: LucideIcon; tone: Tone }> = {
  gentle_pickup: { icon: Hand, tone: 'peach' }, chair: { icon: Armchair, tone: 'lav' },
  fading: { icon: TrendingDown, tone: 'blue' }, timed_checks: { icon: Timer, tone: 'yellow' },
};
const RATE_INFO: Record<Rating, { icon: LucideIcon; tone: Tone }> = { easy: { icon: Smile, tone: 'green' }, medium: { icon: Meh, tone: 'yellow' }, hard: { icon: Frown, tone: 'pink' } };
const ROUTINE_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  bath: { icon: Bath, tone: 'blue' }, pajamas: { icon: Shirt, tone: 'lav' }, feed: { icon: Milk, tone: 'peach' },
  story: { icon: BookOpen, tone: 'yellow' }, dim_lights: { icon: Lightbulb, tone: 'yellow' }, crib_drowsy: { icon: BedDouble, tone: 'blue' },
};
const WARNINGS: BabycareKey[] = ['sleeptraining_warn_breath', 'sleeptraining_warn_blue', 'sleeptraining_warn_limp', 'sleeptraining_warn_feeds', 'sleeptraining_warn_fever'];
const INSIGHTS: Record<Insight, { icon: LucideIcon; tone: Tone; key: BabycareKey }> = {
  no_data: { icon: Info, tone: 'neutral', key: 'sleeptraining_insight_no_data' },
  need_more_data: { icon: Info, tone: 'neutral', key: 'sleeptraining_insight_need_more' },
  naps_below_range: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_naps_below' },
  nap_short: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_nap_short' },
  night_short: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_night_short' },
  wake_window_long: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_wake_long' },
  wake_window_short: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_wake_short' },
  total_below_range: { icon: Lightbulb, tone: 'yellow', key: 'sleeptraining_insight_total_below' },
  all_good: { icon: CheckCircle2, tone: 'green', key: 'sleeptraining_insight_all_good' },
};
const BAND_KEY: Record<AgeBand, BabycareKey> = { '1-3': 'sleeptraining_band_1_3', '4-6': 'sleeptraining_band_4_6', '7-9': 'sleeptraining_band_7_9', '10-12': 'sleeptraining_band_10_12' };

/** A clock that ticks every `ms`; only the components that use it re-render. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { setNow(new Date()); const id = window.setInterval(() => setNow(new Date()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}

const SleepClock = memo(function SleepClock({ since }: { since: Date }) {
  const now = useNow(1000);
  return <>{formatClockSeconds((now.getTime() - since.getTime()) / 1000)}</>;
});

// ── Today ────────────────────────────────────────────────────────────────────
function LiveSleep({ sleepingSince, nightWakes, busy, todaySummary, onStart, onStop, onDiscard, onNightWake }: {
  sleepingSince: Date | null; nightWakes: number; busy: boolean; todaySummary: string;
  onStart: () => void; onStop: () => void; onDiscard: () => void; onNightWake: (d: number) => void;
}) {
  const asleep = sleepingSince !== null;
  return (
    <Card title={bc('sleeptraining_live_title')} subtitle={bc('sleeptraining_live_subtitle')} icon={Moon} tone="lav"
      aside={<Pill tone={asleep ? 'blue' : 'yellow'} icon={asleep ? Moon : Sun}>{asleep ? bc('sleeptraining_state_sleeping') : bc('sleeptraining_state_awake')}</Pill>}>
      <div className="st-live">
        <button type="button" disabled={busy} onClick={asleep ? onStop : onStart} aria-label={asleep ? bc('sleeptraining_live_stop') : bc('sleeptraining_live_start')}
          className={`st-live-btn${asleep ? ' on' : ''}`}>
          {asleep && sleepingSince
            ? <><b className="a3-num"><SleepClock since={sleepingSince} /></b><span><Sun size={15} strokeWidth={2.4} aria-hidden="true" />{bc('sleeptraining_live_stop')}</span></>
            : <><Moon size={36} strokeWidth={2} aria-hidden="true" /><span>{bc('sleeptraining_live_start')}</span></>}
        </button>
        {asleep && sleepingSince
          ? <><p className="a3-meta">{fill('sleeptraining_live_since', { time: clockOf(sleepingSince) })}</p><LinkButton onClick={onDiscard}>{bc('sleeptraining_live_discard')}</LinkButton></>
          : <p className="a3-meta" style={{ textAlign: 'center' }}>{bc('sleeptraining_live_hint')}</p>}
      </div>
      <div className="st-soft-row">
        <Ico icon={BellRing} tone="blue" />
        <div className="grow"><p className="st-title">{bc('sleeptraining_night_wakes')}</p><p className="a3-meta">{bc('sleeptraining_night_wakes_sub')}</p></div>
        <Stepper tone="blue" compact value={String(nightWakes)} width={24} minusLabel={bc('sleeptraining_night_wakes_less')} plusLabel={bc('sleeptraining_night_wakes_more')}
          minusDisabled={nightWakes <= 0} onMinus={() => onNightWake(-1)} onPlus={() => onNightWake(1)} />
      </div>
      <p className="a3-meta" style={{ textAlign: 'center', margin: '12px 0 0' }}>{todaySummary}</p>
    </Card>
  );
}

const SEG_CLASS: Record<string, string> = { wake: 'st-seg-wake', nap: 'st-seg-nap', night: 'st-seg-night' };

function blockTip(b: ScheduleBlock, i: number): { icon: LucideIcon; tone: Tone; tip: string } {
  if (b.type === 'nap') return { icon: CloudMoon, tone: 'lav', tip: bc('sleeptraining_tip_nap') };
  if (b.type === 'bedtime') return { icon: Moon, tone: 'blue', tip: bc('sleeptraining_tip_bedtime') };
  return i === 0 ? { icon: Sun, tone: 'yellow', tip: bc('sleeptraining_tip_morning') } : { icon: Coffee, tone: 'yellow', tip: bc('sleeptraining_tip_awake') };
}

function DayTimeline({ schedule, wakeTime, now, onShiftWake, onPickWake }: {
  schedule: ScheduleBlock[]; wakeTime: string; now: Date; onShiftWake: (d: number) => void; onPickWake: (v: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const segments = useMemo(() => timelineSegments(schedule), [schedule]);
  const status = scheduleStatus(schedule, now);
  const wakeMin = parseClock(wakeTime) ?? WAKE_MIN;
  const toggleOpen = (i: number) => setOpen((o) => (o === i ? null : i));
  const nowPct = (minutesOfDay(now) / 1440) * 100;
  return (
    <Card title={bc('sleeptraining_timeline_title')} subtitle={bc('sleeptraining_timeline_subtitle')} icon={CloudMoon} tone="yellow">
      <div className="st-between">
        <div><p className="st-title">{bc('sleeptraining_wake_title')}</p><p className="a3-meta">{bc('sleeptraining_wake_hint')}</p></div>
        <Stepper tone="yellow" value={wakeTime} width={64} minusLabel={bc('sleeptraining_wake_earlier')} plusLabel={bc('sleeptraining_wake_later')}
          minusDisabled={wakeMin <= WAKE_MIN} plusDisabled={wakeMin >= WAKE_MAX} onMinus={() => onShiftWake(-15)} onPlus={() => onShiftWake(15)} />
      </div>
      <div className="st-presets">
        {WAKE_PRESETS.map((v) => <button key={v} type="button" aria-pressed={wakeTime === v} onClick={() => onPickWake(v)} className={`st-preset${wakeTime === v ? ' on' : ''}`}>{v}</button>)}
      </div>
      <div className="st-bar-wrap">
        <div className="st-bar">
          {segments.map((s, i) => (
            <button key={`${s.kind}-${i}`} type="button" onClick={() => toggleOpen(s.blockIndex)} className={SEG_CLASS[s.kind]}
              aria-label={`${blockLabel(schedule[s.blockIndex], s.blockIndex)} ${schedule[s.blockIndex].start}`}
              style={{ insetInlineStart: `${s.startPct}%`, width: `${s.widthPct}%`, opacity: open === null || open === s.blockIndex ? 1 : 0.45 }} />
          ))}
        </div>
        <span className="st-now" aria-hidden="true" style={{ insetInlineStart: `calc(${nowPct}% - 1.5px)` }} />
        <div className="st-hours" aria-hidden="true">{['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}</div>
      </div>
      <div className="st-legend">
        {(['wake', 'nap', 'night'] as const).map((k) => (
          <span key={k}><i className={SEG_CLASS[k]} />{k === 'wake' ? bc('sleeptraining_legend_awake') : k === 'nap' ? bc('sleeptraining_legend_nap') : bc('sleeptraining_legend_night')}</span>
        ))}
      </div>
      <ul className="st-blocks">
        {schedule.map((b, i) => {
          const tip = blockTip(b, i), isOpen = open === i, isNow = status.currentIndex === i;
          const sub = b.type === 'bedtime' ? fill('sleeptraining_block_night_sub', { time: schedule[0].start }) : `${b.start}–${b.end} · ${dur(blockMinutes(b))}`;
          return (
            <li key={`${b.type}-${i}`}>
              <button type="button" aria-expanded={isOpen} onClick={() => toggleOpen(i)} className={`st-block st-${tip.tone}-soft${isNow ? ' now' : ''}${isOpen || isNow ? ' lit' : ''}`}>
                <Ico icon={tip.icon} tone={tip.tone} size={34} />
                <span className="grow"><span className="st-title">{blockLabel(b, i)}{b.type === 'bedtime' ? ` · ${b.start}` : ''}</span><span className="a3-meta">{sub}</span></span>
                {isNow ? <Pill tone={tip.tone}>{bc('sleeptraining_now')}</Pill> : status.nextIndex === i ? <Pill>{bc('sleeptraining_next')}</Pill> : null}
                <ChevronDown size={16} aria-hidden="true" className={`st-chev${isOpen ? ' up' : ''}`} />
              </button>
              {isOpen && <p className="st-tip"><Lightbulb size={13} aria-hidden="true" />{tip.tip}</p>}
            </li>
          );
        })}
      </ul>
      {schedule.some((b) => b.type === 'bedtime') && <p className="a3-meta" style={{ margin: '10px 0 0' }}>{bc('sleeptraining_schedule_note')}</p>}
    </Card>
  );
}

function Routine({ done, streak, onToggle }: { done: string[]; streak: number; onToggle: (s: string) => void }) {
  const count = ROUTINE_STEPS.filter((s) => done.includes(s)).length, complete = count === ROUTINE_STEPS.length;
  return (
    <Card title={bc('sleeptraining_routine_title')} subtitle={bc('sleeptraining_routine_subtitle')} icon={BedDouble} tone="blue"
      aside={streak > 0 ? <Pill tone="peach" icon={Flame}>{fill('sleeptraining_streak', { days: streak })}</Pill> : undefined}>
      <div className="st-row-gap">
        <ProgressCircle value={count} total={ROUTINE_STEPS.length} tone={complete ? 'green' : 'blue'} />
        <p className="a3-meta">{complete ? bc('sleeptraining_routine_done') : bc('sleeptraining_routine_hint')}</p>
      </div>
      <div className="st-grid2">
        {ROUTINE_STEPS.map((s) => {
          const on = done.includes(s), info = ROUTINE_ICON[s];
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => onToggle(s)} className={`st-tile${on ? ' on' : ''}`}>
              <span className="st-between"><Ico icon={info.icon} tone={on ? 'green' : info.tone} size={32} /><span className={`st-check${on ? ' on' : ''}`} aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span></span>
              <span className="st-tile-label">{bc(`sleeptraining_step_${s}` as BabycareKey)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PastSleep({ busy, onSave }: { busy: boolean; onSave: (day: 'today' | 'yesterday', start: string, end: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('14:00');
  return (
    <section className="a3-card a3-pad st-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="st-collapse">
        <Ico icon={Pencil} tone="neutral" />
        <span className="grow"><span className="st-card-title">{bc('sleeptraining_manual_title')}</span><span className="a3-meta">{bc('sleeptraining_manual_subtitle')}</span></span>
        <ChevronDown size={18} aria-hidden="true" className={`st-chev${open ? ' up' : ''}`} />
      </button>
      {open && (
        <div className="st-manual">
          <div className="a3-seg">
            {(['today', 'yesterday'] as const).map((d) => <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)}>{d === 'today' ? bc('sleeptraining_day_today') : bc('sleeptraining_day_yesterday')}</button>)}
          </div>
          <div className="st-grid2">
            <label className="ap-field"><span>{bc('sleeptraining_log_start')}</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="ap-field"><span>{bc('sleeptraining_log_end')}</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <p className="a3-meta">{bc('sleeptraining_manual_hint')}</p>
          <button type="button" className="a3-btn accent block" disabled={busy} onClick={async () => { if (await onSave(day, start, end)) setOpen(false); }}>{bc('sleeptraining_log_save')}</button>
        </div>
      )}
    </section>
  );
}

// ── Week ─────────────────────────────────────────────────────────────────────
const BAR_CLASS = { today: 'st-bar-today', within: 'st-bar-within', below: 'st-bar-below', above: 'st-bar-above', none: 'st-bar-none' } as const;

function WeekChart({ days, band, onDelete }: { days: SleepDay[]; band: AgeBand; onDelete: (id: string) => void }) {
  const [sel, setSel] = useState(days.length - 1);
  const [armed, setArmed] = useState<string | null>(null);
  const [low, high] = BAND_NORMS[band].totalSleepHours;
  const max = Math.max(high + 2, ...days.map((d) => d.totalMinutes / 60));
  const index = Math.min(sel, days.length - 1), day = days[index];
  const kind = (d: SleepDay, i: number): keyof typeof BAR_CLASS => {
    if (d.totalMinutes === 0) return 'none';
    if (i === days.length - 1) return 'today';
    const h = d.totalMinutes / 60;
    return h < low ? 'below' : h > high ? 'above' : 'within';
  };
  return (
    <Card title={bc('sleeptraining_chart_title')} subtitle={bc('sleeptraining_chart_subtitle')} icon={BarChart3} tone="blue">
      <div className="st-chart">
        {[low, high].map((h) => <span key={h} className="st-guide" aria-hidden="true" style={{ bottom: `${(h / max) * 100}%` }} />)}
        <div className="st-chart-bars">
          {days.map((d, i) => {
            const height = d.totalMinutes === 0 ? 4 : Math.max(6, (d.totalMinutes / 60 / max) * 100);
            return (
              <button key={d.key} type="button" aria-pressed={i === index} onClick={() => { setSel(i); setArmed(null); }}
                aria-label={`${dayMonth(d.date)} · ${d.totalMinutes ? dur(d.totalMinutes) : bc('sleeptraining_chart_none')}`} className={`st-chart-col${i === index ? ' on' : ''}`}>
                <span className="a3-num" aria-hidden="true">{d.totalMinutes ? (d.totalMinutes / 60).toFixed(1) : ''}</span>
                <i className={BAR_CLASS[kind(d, i)]} style={{ height: `${height}%` }} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="st-chart-days" aria-hidden="true">{days.map((d, i) => <span key={d.key} className={i === index ? 'on' : undefined}>{weekday(d.date)}</span>)}</div>
      <div className="st-legend">
        {(['within', 'below', 'above', 'today'] as const).map((k) => (
          <span key={k}><i className={BAR_CLASS[k]} />{k === 'within' ? bc('sleeptraining_chart_within') : k === 'below' ? bc('sleeptraining_chart_below') : k === 'above' ? bc('sleeptraining_chart_above') : bc('sleeptraining_chart_today')}</span>
        ))}
      </div>
      <div className="st-day-detail">
        <div className="st-between"><p className="st-title">{dayMonth(day.date)}</p><p className="a3-meta">{day.totalMinutes ? dur(day.totalMinutes) : bc('sleeptraining_chart_none')}</p></div>
        {day.sessions.length > 0 && (
          <ul className="st-sessions">
            {day.sessions.map((s) => {
              const isArmed = armed === s.id;
              return (
                <li key={s.id}>
                  <Ico icon={s.kind === 'night' ? Moon : CloudMoon} tone={s.kind === 'night' ? 'blue' : 'lav'} size={32} />
                  <span className="grow"><span className="st-title">{s.kind === 'night' ? bc('sleeptraining_kind_night') : bc('sleeptraining_kind_nap')}</span>
                    <span className="a3-meta">{clockOf(s.start)}–{clockOf(s.end)} · {dur(s.minutes)}</span></span>
                  <button type="button" className={`bt-del${isArmed ? ' armed' : ''}`} aria-label={isArmed ? bc('sleeptraining_delete_confirm') : bc('sleeptraining_delete')}
                    onClick={() => { if (isArmed) { setArmed(null); onDelete(s.id); } else setArmed(s.id); }}>
                    <Trash2 size={15} aria-hidden="true" />{isArmed && <span>{bc('sleeptraining_delete_sure')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Stat({ icon, tone, label, value }: { icon: LucideIcon; tone: Tone; label: string; value: string }) {
  return <div className="st-stat"><Ico icon={icon} tone={tone} size={28} /><p className="st-stat-v a3-num">{value}</p><p className="a3-meta">{label}</p></div>;
}

function Averages({ summary, nightWakeAvg }: { summary: SleepSummary; nightWakeAvg: number | null }) {
  const none = bc('sleeptraining_no_value'), v = (m: number | null) => (m === null ? none : dur(m));
  return (
    <Card title={bc('sleeptraining_avg_title')} icon={Activity} tone="green"
      subtitle={summary.daysWithData > 0 ? fill('sleeptraining_avg_days', { count: summary.daysWithData }) : bc('sleeptraining_avg_empty')}>
      <div className="st-grid2">
        <Stat icon={Moon} tone="blue" label={bc('sleeptraining_sum_total')} value={v(summary.avgDailyMinutes)} />
        <Stat icon={CloudMoon} tone="lav" label={bc('sleeptraining_sum_naps')} value={summary.avgNapsPerDay === null ? none : summary.avgNapsPerDay.toFixed(1)} />
        <Stat icon={Timer} tone="lav" label={bc('sleeptraining_sum_nap_len')} value={v(summary.avgNapMinutes)} />
        <Stat icon={Moon} tone="blue" label={bc('sleeptraining_sum_night')} value={v(summary.avgLongestNightMinutes)} />
        <Stat icon={Target} tone="yellow" label={bc('sleeptraining_sum_window')} value={v(summary.avgWakeWindowMinutes)} />
        <Stat icon={BellRing} tone="pink" label={bc('sleeptraining_sum_wakes')} value={nightWakeAvg === null ? none : nightWakeAvg.toFixed(1)} />
      </div>
      {summary.medianBedtime && summary.medianWakeTime && (
        <p className="a3-meta" style={{ margin: '12px 0 0' }}>{fill('sleeptraining_bedtime_line', { bed: summary.medianBedtime, wake: summary.medianWakeTime })}</p>
      )}
    </Card>
  );
}

function Meter({ label, value, range, format }: { label: string; value: number | null; range: [number, number]; format: (n: number) => string }) {
  const max = Math.max(range[1] * 1.6, (value ?? 0) * 1.1);
  const state = value === null ? null : value < range[0] ? 'below' : value > range[1] ? 'above' : 'within';
  const tone: Tone = state === 'within' ? 'green' : state === 'below' ? 'yellow' : state === 'above' ? 'lav' : 'neutral';
  const text = state === 'within' ? bc('sleeptraining_chart_within') : state === 'below' ? bc('sleeptraining_chart_below') : state === 'above' ? bc('sleeptraining_chart_above') : bc('sleeptraining_no_value');
  return (
    <div>
      <div className="st-between"><p className="st-title">{label}</p><Pill tone={tone}>{text}</Pill></div>
      <div className="st-meter">
        <span className="st-meter-range" style={{ insetInlineStart: `${(range[0] / max) * 100}%`, width: `${((range[1] - range[0]) / max) * 100}%` }} />
        {value !== null && <span className={`st-meter-dot st-dot-${tone}`} style={{ insetInlineStart: `calc(${Math.min(100, (value / max) * 100)}% - 7px)` }} />}
      </div>
      <p className="a3-meta">{fill('sleeptraining_meter_line', { low: format(range[0]), high: format(range[1]) })}{value !== null && ` · ${fill('sleeptraining_meter_yours', { value: format(value) })}`}</p>
    </div>
  );
}

function Ranges({ summary, band }: { summary: SleepSummary; band: AgeBand }) {
  const n = BAND_NORMS[band];
  return (
    <Card title={bc('sleeptraining_ranges_title')} subtitle={bc('sleeptraining_ranges_subtitle')} icon={Target} tone="lav">
      <div className="st-stack">
        <Meter label={bc('sleeptraining_sum_naps')} value={summary.avgNapsPerDay} range={n.naps} format={(x) => (Number.isInteger(x) ? String(x) : x.toFixed(1))} />
        <Meter label={bc('sleeptraining_sum_nap_len')} value={summary.avgNapMinutes} range={n.napMinutes} format={dur} />
        <Meter label={bc('sleeptraining_sum_night')} value={summary.avgLongestNightMinutes} range={[n.longestNightHours[0] * 60, n.longestNightHours[1] * 60]} format={dur} />
        <Meter label={bc('sleeptraining_sum_window')} value={summary.avgWakeWindowMinutes} range={n.wakeWindowMinutes} format={dur} />
      </div>
    </Card>
  );
}

function Insights({ insights }: { insights: Insight[] }) {
  return (
    <Card title={bc('sleeptraining_insights_title')} icon={Lightbulb} tone="yellow">
      <ul className="st-list">
        {insights.slice(0, 3).map((i) => {
          const info = INSIGHTS[i];
          return <li key={i} className={`st-note st-${info.tone}-soft`}><info.icon size={18} strokeWidth={2.2} aria-hidden="true" className={`st-ink-${info.tone}`} /><p>{bc(info.key)}</p></li>;
        })}
      </ul>
    </Card>
  );
}

// ── Plan ─────────────────────────────────────────────────────────────────────
function Plan({ state, todayKey, months, onPick, onToggleStep, onRate, onReset }: {
  state: PlanState; todayKey: string; months: number; onPick: (m: Method) => void; onToggleStep: (s: string) => void;
  onRate: (day: number, r: Rating | null, clear?: boolean) => void; onReset: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [rateDay, setRateDay] = useState<number | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const method = state.method;
  const today = state.planStartDate ? planDayNumber(state.planStartDate, todayKey) : 0;
  const progress = planProgress(state);
  const finished = today > PLAN_DAYS;

  if (!method || changing) {
    return (
      <Card title={bc('sleeptraining_plan_title')} subtitle={bc('sleeptraining_plan_intro')} icon={Target} tone="peach">
        {months < 4 && <div className="st-note st-yellow-soft"><AlertTriangle size={18} aria-hidden="true" className="st-ink-yellow" /><p>{bc('sleeptraining_plan_young')}</p></div>}
        <div className="st-grid2">
          {METHODS.map((m) => {
            const info = METHOD_INFO[m], on = method === m;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => { onPick(m); setChanging(false); }} className={`st-method st-${info.tone}-soft${on ? ' on' : ''}`}>
                <Ico icon={info.icon} tone={info.tone} size={34} />
                <b>{bc(`sleeptraining_method_${m}` as BabycareKey)}</b>
                <span className="a3-meta">{bc(`sleeptraining_method_${m}_desc` as BabycareKey)}</span>
              </button>
            );
          })}
        </div>
        {changing && <LinkButton icon={Undo2} onClick={() => setChanging(false)}>{bc('sleeptraining_plan_keep')}</LinkButton>}
      </Card>
    );
  }

  const info = METHOD_INFO[method];
  const current = rateDay !== null ? state.planDone[String(rateDay)] : undefined;
  return (
    <div className="st-stack">
      <Card title={bc(`sleeptraining_method_${method}` as BabycareKey)} subtitle={bc(`sleeptraining_method_${method}_desc` as BabycareKey)} icon={info.icon} tone={info.tone}>
        <div className="st-row-gap">
          <ProgressCircle value={progress.completed} total={PLAN_DAYS} size={72} />
          <div>
            <p className="st-title">{fill('sleeptraining_plan_progress', { done: progress.completed, total: PLAN_DAYS })}</p>
            <p className="a3-meta">{finished ? bc('sleeptraining_plan_finished') : today >= 1 ? fill('sleeptraining_plan_today', { day: today }) : ''}</p>
          </div>
        </div>
        <div className="st-links">
          <LinkButton icon={Undo2} onClick={() => setChanging(true)}>{bc('sleeptraining_plan_change')}</LinkButton>
          <LinkButton icon={RotateCcw} tone={resetArmed ? 'pink' : 'neutral'} onClick={() => { if (resetArmed) { setResetArmed(false); onReset(); } else setResetArmed(true); }}>
            {resetArmed ? bc('sleeptraining_plan_reset_sure') : bc('sleeptraining_plan_reset')}
          </LinkButton>
        </div>
      </Card>
      <Card title={bc('sleeptraining_steps_title')} subtitle={bc('sleeptraining_steps_subtitle')} icon={ListChecks} tone="lav">
        <ol className="st-list">
          {METHOD_STEPS[method].map((s) => {
            const on = state.stepsDone.includes(s);
            return (
              <li key={s}>
                <button type="button" aria-pressed={on} onClick={() => onToggleStep(s)} className={`st-checkrow${on ? ' on' : ''}`}>
                  {on ? <CheckCircle2 size={20} aria-hidden="true" className="st-ink-green" /> : <Circle size={20} aria-hidden="true" className="st-faint" />}
                  <span>{bc(`sleeptraining_${s}` as BabycareKey)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Card>
      <Card title={bc('sleeptraining_calendar_title')} subtitle={bc('sleeptraining_calendar_subtitle')} icon={Calendar} tone="green">
        <div className="st-days">
          {Array.from({ length: PLAN_DAYS }, (_, i) => i + 1).map((d) => {
            const marked = String(d) in state.planDone, rating = state.planDone[String(d)];
            const tone: Tone = rating ? RATE_INFO[rating].tone : marked ? 'lav' : 'neutral';
            const Icon = rating ? RATE_INFO[rating].icon : Check;
            const label = fill('sleeptraining_plan_day', { day: d });
            return (
              <button key={d} type="button" disabled={d > today} onClick={() => setRateDay(d)} aria-label={rating ? `${label} · ${bc(`sleeptraining_rate_${rating}` as BabycareKey)}` : label}
                className={`st-day${marked ? ` st-${tone}-soft st-ink-${tone}` : ''}${d === today ? ' today' : ''}`}>
                <b className="a3-num">{d}</b><span>{marked && <Icon size={14} strokeWidth={2.4} aria-hidden="true" />}</span>
              </button>
            );
          })}
        </div>
        <div className="st-legend">{RATINGS.map((r) => <Pill key={r} tone={RATE_INFO[r].tone} icon={RATE_INFO[r].icon}>{bc(`sleeptraining_rate_${r}` as BabycareKey)}</Pill>)}</div>
        <p className="a3-meta" style={{ margin: '12px 0 0' }}>{bc('sleeptraining_plan_stop_note')}</p>
      </Card>
      <Sheet open={rateDay !== null} onClose={() => setRateDay(null)} full={false} title={rateDay !== null ? fill('sleeptraining_plan_day', { day: rateDay }) : ''}>
        <p className="a3-meta" style={{ marginTop: 0 }}>{bc('sleeptraining_rate_question')}</p>
        <div className="st-stack">
          {RATINGS.map((r) => {
            const ri = RATE_INFO[r];
            return (
              <button key={r} type="button" aria-pressed={current === r} onClick={() => { if (rateDay !== null) onRate(rateDay, r); setRateDay(null); }}
                className={`st-rate st-${ri.tone}-soft st-ink-${ri.tone}${current === r ? ' on' : ''}`}>
                <ri.icon size={22} aria-hidden="true" />{bc(`sleeptraining_rate_${r}` as BabycareKey)}
              </button>
            );
          })}
          {rateDay !== null && String(rateDay) in state.planDone && (
            <LinkButton icon={Undo2} onClick={() => { onRate(rateDay, null, true); setRateDay(null); }}>{bc('sleeptraining_rate_clear')}</LinkButton>
          )}
        </div>
      </Sheet>
    </div>
  );
}

// ── Safety ───────────────────────────────────────────────────────────────────
function Safety({ done, emergency, onToggle }: { done: string[]; emergency: string; onToggle: (s: string) => void }) {
  const count = SAFETY_ITEMS.filter((s) => done.includes(s)).length, complete = count === SAFETY_ITEMS.length;
  return (
    <div className="st-stack">
      <Card title={bc('sleeptraining_safety_title')} subtitle={bc('sleeptraining_safety_subtitle')} icon={ShieldCheck} tone="green">
        <div className="st-row-gap">
          <ProgressCircle value={count} total={SAFETY_ITEMS.length} />
          <p className="a3-meta">{complete ? bc('sleeptraining_safety_done') : bc('sleeptraining_safety_hint')}</p>
        </div>
        <ul className="st-list">
          {SAFETY_ITEMS.map((s) => {
            const on = done.includes(s);
            return (
              <li key={s}>
                <button type="button" aria-pressed={on} onClick={() => onToggle(s)} className={`st-checkrow${on ? ' on' : ''}`}>
                  {on ? <CheckCircle2 size={20} aria-hidden="true" className="st-ink-green" /> : <Circle size={20} aria-hidden="true" className="st-faint" />}
                  <span>{bc(`sleeptraining_safe_${s}` as BabycareKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={bc('sleeptraining_warning_title')} icon={AlertTriangle} tone="pink">
        <ul className="st-list">
          {WARNINGS.map((k) => <li key={k} className="st-note st-pink-soft"><AlertTriangle size={18} aria-hidden="true" className="st-ink-pink" /><p>{bc(k)}</p></li>)}
        </ul>
        <div className="st-soft-row">
          <Ico icon={Phone} tone="pink" />
          <p className="st-title grow">{fill('sleeptraining_emergency_line', { number: emergency })}</p>
          <a href={`tel:${emergency}`} className="a3-btn accent sm">{bc('sleeptraining_emergency_call')}</a>
        </div>
      </Card>
      <p className="st-disclaimer"><Info size={14} aria-hidden="true" />{bc('sleeptraining_disclaimer')}</p>
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function SleepTraining({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('SleepTraining', 'Tools');
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  const { addLog, deleteLog } = useBabyLogs();
  const { logs } = useBabyLogsRange(14);
  const storageKey = planStorageKey(user?.id ?? 'guest');
  const [state, setState] = useState<PlanState>(DEFAULT_PLAN_STATE);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const now = useNow(30_000);
  const todayKey = localDateKey(now);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setState(prunePlanState(parsePlanState(raw ? JSON.parse(raw) : null), localDateKey(new Date())));
    } catch { setState(DEFAULT_PLAN_STATE); }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* storage optional */ }
  }, [state, storageKey, loaded]);

  const update = (fn: (s: PlanState) => PlanState) => setState((s) => prunePlanState(fn(s), localDateKey(new Date())));
  const birth = child?.birth_date ? new Date(child.birth_date) : null;
  const months = birth ? monthsOld(birth, now) : 0;
  const band = ageBand(months);
  const schedule = useMemo(() => (band ? buildSchedule({ wakeTime: state.wakeTime, band }) : []), [band, state.wakeTime]);
  const entries = useMemo(() => sleepEntries(logs), [logs]);
  const status = scheduleStatus(schedule, now);
  const week = useMemo(() => sleepDays(entries, now, 7), [entries, now]);
  const todayDay = week[week.length - 1];
  const summary = useMemo(() => (band ? sleepSummary({ sessions: entries, band, now }) : null), [band, entries, now]);
  const sleepingSince = state.pendingSleepStart ? new Date(state.pendingSleepStart) : null;
  const nightWakes = state.nightWakes[nightKey(now)] ?? 0;
  const emergency = getEmergencyNumber((profile as { country_code?: string } | null)?.country_code ?? (child as { country_code?: string } | null)?.country_code ?? null);

  const todaySummary = todayDay.totalMinutes > 0 ? fill('sleeptraining_today_summary', { time: dur(todayDay.totalMinutes) }) : bc('sleeptraining_today_none');
  const hero = sleepingSince
    ? { sleeping: true, title: bc('sleeptraining_hero_sleeping'), detail: fill('sleeptraining_live_since', { time: clockOf(sleepingSince) }) }
    : status.currentIndex !== null
      ? { sleeping: false, title: fill('sleeptraining_hero_now', { label: blockLabel(schedule[status.currentIndex], status.currentIndex) }), detail: fill('sleeptraining_hero_until', { time: schedule[status.currentIndex].end }) }
      : status.nextIndex !== null && status.minutesToNext !== null
        ? { sleeping: false, title: fill('sleeptraining_hero_next', { label: blockLabel(schedule[status.nextIndex], status.nextIndex) }), detail: fill('sleeptraining_hero_in', { time: dur(status.minutesToNext), clock: schedule[status.nextIndex].start }) }
        : { sleeping: false, title: bc('sleeptraining_hero_idle'), detail: bc('sleeptraining_hero_idle_detail') };

  const guarded = async (fn: () => Promise<boolean>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try { return await fn(); } finally { lock.current = false; setBusy(false); }
  };
  const save = async (start: Date, end: Date) => {
    if (!child) { toast({ title: bc('sleeptraining_no_child'), variant: 'destructive' }); return false; }
    const { error } = await addLog({ log_type: 'sleep', start_time: start.toISOString(), end_time: end.toISOString() });
    if (error) { toast({ title: bc('sleeptraining_save_failed'), variant: 'destructive' }); return false; }
    return true;
  };
  const startSleep = () => { void hapticFeedback.light(); update((s) => setPendingSleep(s, new Date().toISOString())); };
  const discard = () => { update((s) => setPendingSleep(s, null)); toast({ title: bc('sleeptraining_discarded') }); };
  const stopSleep = () => void guarded(async () => {
    if (!sleepingSince) return false;
    const end = new Date(), minutes = Math.round((end.getTime() - sleepingSince.getTime()) / 60_000);
    if (minutes < MIN_SLEEP_MINUTES) { update((s) => setPendingSleep(s, null)); toast({ title: bc('sleeptraining_too_short') }); return false; }
    if (minutes > MAX_SLEEP_MINUTES) { toast({ title: bc('sleeptraining_too_long'), variant: 'destructive' }); return false; }
    if (!(await save(sleepingSince, end))) return false;
    update((s) => setPendingSleep(s, null));
    void hapticFeedback.light();
    toast({ title: fill('sleeptraining_saved', { time: dur(minutes) }) });
    return true;
  });
  const savePast = (day: 'today' | 'yesterday', startText: string, endText: string) => guarded(async () => {
    const s = parseClock(startText), e = parseClock(endText);
    if (s === null || e === null) { toast({ title: bc('sleeptraining_manual_invalid'), variant: 'destructive' }); return false; }
    const base = dayOffset(new Date(), day === 'today' ? 0 : -1);
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(s / 60), s % 60);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (e <= s ? 1 : 0), Math.floor(e / 60), e % 60);
    if (end.getTime() > Date.now()) { toast({ title: bc('sleeptraining_manual_future'), variant: 'destructive' }); return false; }
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (minutes < MIN_SLEEP_MINUTES || minutes > MAX_SLEEP_MINUTES) { toast({ title: bc('sleeptraining_manual_length'), variant: 'destructive' }); return false; }
    if (!(await save(start, end))) return false;
    toast({ title: fill('sleeptraining_saved', { time: dur(minutes) }) });
    return true;
  });
  const removeSleep = async (id: string) => {
    const { error } = await deleteLog(id);
    toast(error ? { title: bc('sleeptraining_delete_failed'), variant: 'destructive' } : { title: bc('sleeptraining_deleted') });
  };

  const header = <ToolHeader onBack={onBack} eyebrow={bc('sleeptraining_eyebrow')} title={bc('sleeptraining_title')} />;
  if (!loaded) return <ToolPage>{header}</ToolPage>;
  if (!child || !birth) return <ToolPage>{header}<ToolEmpty icon="🌙" title={bc('sleeptraining_title')} text={bc('sleeptraining_no_birthdate')} /></ToolPage>;
  if (!band || !summary) {
    return <ToolPage>{header}<ToolEmpty icon="🌙" title={fill('sleeptraining_age_label', { months })} text={bc('sleeptraining_out_of_range')} /></ToolPage>;
  }

  return (
    <ToolPage>
      {header}
      <div className="st-stack">
        <section className="st-hero" aria-label={fill('sleeptraining_age_label', { months })}>
          <div className="st-row-gap">
            <span className="st-hero-ico" aria-hidden="true"><MoonStar size={24} strokeWidth={2.1} /></span>
            <div><p className="a3-eyebrow" style={{ margin: 0 }}>{bc(BAND_KEY[band])}</p><h2 className="st-hero-title">{fill('sleeptraining_age_label', { months })}</h2></div>
          </div>
          <div className="st-hero-status">
            <span className={`st-ico ${hero.sleeping ? 'st-blue' : 'st-yellow'}`} style={{ width: 36, height: 36, borderRadius: 12 }} aria-hidden="true">{hero.sleeping ? <Moon size={18} /> : <Sun size={18} />}</span>
            <div><p className="st-title">{hero.title}</p><p className="a3-meta">{hero.detail}</p></div>
          </div>
          <p className="st-hero-foot"><Activity size={14} aria-hidden="true" />{todaySummary}</p>
        </section>

        <div className="a3-seg" role="tablist">
          {(['today', 'week', 'plan', 'safety'] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{bc(`sleeptraining_tab_${t}` as BabycareKey)}</button>
          ))}
        </div>

        {tab === 'today' && (
          <>
            <LiveSleep sleepingSince={sleepingSince} nightWakes={nightWakes} busy={busy} todaySummary={todaySummary}
              onStart={startSleep} onStop={stopSleep} onDiscard={discard} onNightWake={(d) => update((s) => adjustNightWakes(s, nightKey(new Date()), d))} />
            <DayTimeline schedule={schedule} wakeTime={state.wakeTime} now={now}
              onShiftWake={(d) => update((s) => setWake(s, shiftWake(s.wakeTime, d)))} onPickWake={(v) => update((s) => setWake(s, v))} />
            <Routine done={state.routineDone[todayKey] ?? []} streak={routineStreak(state.routineDone, todayKey)} onToggle={(st) => update((s) => toggleRoutine(s, localDateKey(new Date()), st))} />
            <PastSleep busy={busy} onSave={savePast} />
          </>
        )}
        {tab === 'week' && (
          <>
            <WeekChart days={week} band={band} onDelete={(id) => void removeSleep(id)} />
            <Averages summary={summary} nightWakeAvg={averageNightWakes(state.nightWakes, todayKey)} />
            <Ranges summary={summary} band={band} />
            <Insights insights={summary.insights} />
          </>
        )}
        {tab === 'plan' && (
          <Plan state={state} todayKey={todayKey} months={months} onPick={(m) => update((s) => pickMethod(s, m, localDateKey(new Date())))}
            onToggleStep={(st) => update((s) => toggleStep(s, st))} onRate={(d, r, clear) => update((s) => ratePlanDay(s, d, r, clear))} onReset={() => update(resetPlan)} />
        )}
        {tab === 'safety' && <Safety done={state.safetyDone} emergency={emergency} onToggle={(it) => update((s) => toggleSafety(s, it))} />}
      </div>
    </ToolPage>
  );
}
