import '@/styles/babycare.css';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Milk, Moon, Droplets, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { useChildren } from '@/hooks/useChildren';
import { useAchievements } from '@/hooks/useAchievements';
import { useToast } from '@/hooks/use-toast';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useBabyLogsRange } from '@/hooks/useBabyLogsRange';
import { useTimerStore } from '@/store/timerStore';
import { hapticFeedback } from '@/lib/native';
import { bc, durationUnits } from '@/lib/babycare-i18n';
import {
  dailyHistory, diaperKind, diaperStats, feedKind, feedingStats, formatClockSeconds, formatMinutes, logsInWindow,
  logsOfDay, minutesBetween, mlFromNotes, sleepStats, timeOfDay, trendPoints, type BabyLogRow, type DiaperKind, type TrendPoint,
} from '@/lib/baby-logs-range';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { ToolPage, ToolHeader } from './anacan/ToolKit';

type Tab = 'feeding' | 'sleep' | 'diaper';
const PERIODS = [7, 14, 30, 90] as const;
const DIAPERS: { value: DiaperKind; emoji: string }[] = [{ value: 'wet', emoji: '💧' }, { value: 'dirty', emoji: '💩' }, { value: 'mixed', emoji: '💧💩' }];
const FEEDING_PRO_AFTER = 9;
const DIAPER_HERO_AFTER = 9;

const dur = (m: number) => formatMinutes(m, durationUnits());
const diaperLabel = (k: DiaperKind) => (k === 'wet' ? bc('babytracker_diaper_wet') : k === 'dirty' ? bc('babytracker_diaper_dirty') : bc('babytracker_diaper_mixed'));
const tabLabel = (t: Tab) => (t === 'feeding' ? bc('babytracker_tab_feeding') : t === 'sleep' ? bc('babytracker_tab_sleep') : bc('babytracker_tab_diaper'));
const ago = (d: Date, now: Date) => {
  const m = minutesBetween(d, now);
  return m < 1 ? bc('babytracker_just_now') : `${dur(m)} ${bc('babytracker_ago')}`;
};
/** Compact h:mm for the small stat tile. */
const clock = (m: number) => { const t = Math.round(m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const oneDecimal = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const perDay = (total: number, days: number) => Math.round((total / days) * 10) / 10;
const periodText = (key: 'babytracker_trend_period' | 'babytracker_period_avg' | 'babytracker_period_total' | 'babytracker_period_days', days: number) =>
  bc(key).replace('{days}', String(days));
const dayLabel = (days: number) => (d: Date) => (days > 30
  ? format(d, 'd.MM', { locale: getCurrentDateLocale() })
  : days > 14 ? String(d.getDate()) : format(d, 'EEEEEE', { locale: getCurrentDateLocale() }));

/** Seconds since a timer started; only this text re-renders every second. */
const Elapsed = memo(function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(id); }, []);
  return <>{formatClockSeconds((Date.now() - since) / 1000)}</>;
});

function StatTile({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="a3-card a3-pad bt-stat">
      <span className={`a3-ico-sq sm ${tone}`} aria-hidden="true"><Icon size={16} /></span>
      <p className="a3-meta" style={{ margin: 0 }}>{label}</p>
      <p className="bt-stat-value a3-num">{value}</p>
      {sub && <p className="a3-meta" style={{ margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="bt-row"><span>{label}</span><b className="a3-num">{value}</b></div>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="a3-card a3-pad bt-card"><h3 className="bt-card-title">{title}</h3>{children}</section>;
}

function Bars({ points, value, format, label, labelOf }: {
  points: TrendPoint[]; value: (p: TrendPoint) => number; format: (n: number) => string; label: string; labelOf: (d: Date) => string;
}) {
  const max = Math.max(1, ...points.map(value)), last = points.length - 1;
  return (
    <div className="bt-bars" role="img" aria-label={label} style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
      {points.map((p, i) => {
        const v = value(p);
        return (
          <div key={p.key} className="bt-bar">
            <span className="bt-bar-v a3-num">{v ? format(v) : ''}</span>
            <i style={{ height: `${Math.max(4, Math.round((v / max) * 72))}px` }} className={i === last ? 'now' : undefined} />
            <span className="bt-bar-l">{labelOf(p.day)}</span>
          </div>
        );
      })}
    </div>
  );
}

function History({ rows }: { rows: ReturnType<typeof dailyHistory> }) {
  if (!rows.length) return <p className="a3-meta">{bc('babytracker_history_empty')}</p>;
  return (
    <div className="bt-history">
      <div className="bt-hrow head"><span>{bc('babytracker_day')}</span><span>{bc('babytracker_tab_feeding')}</span><span>{bc('babytracker_tab_sleep')}</span><span>{bc('babytracker_tab_diaper')}</span></div>
      <div className="bt-hscroll">
        {rows.map((r) => (
          <div key={r.key} className="bt-hrow">
            <b>{format(r.day, 'd MMM', { locale: getCurrentDateLocale() })}</b>
            <span className="a3-num">{r.feedings}{r.formulaMl ? ` · ${r.formulaMl} ml` : ''}</span>
            <span className="a3-num">{r.sleepMinutes ? dur(r.sleepMinutes) : '0'}</span>
            <span className="a3-num">{r.diapers}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Entry { id: string; time: Date; title: string; detail: string }

function Entries({ entries, onDelete }: { entries: Entry[]; onDelete: (id: string) => void }) {
  const [armed, setArmed] = useState<string | null>(null);
  if (!entries.length) return <p className="a3-meta">{bc('babytracker_empty')}</p>;
  return (
    <ul className="bt-entries">
      {entries.map((e) => (
        <li key={e.id}>
          <b className="a3-num">{timeOfDay(e.time)}</b>
          <span className="grow"><span className="t">{e.title}</span>{e.detail && <span className="a3-meta">{e.detail}</span>}</span>
          <button type="button" className={`bt-del${armed === e.id ? ' armed' : ''}`} aria-label={armed === e.id ? bc('babytracker_delete_confirm') : bc('babytracker_delete')}
            onClick={() => { if (armed === e.id) { setArmed(null); onDelete(e.id); } else setArmed(e.id); }}>
            <Trash2 size={16} />{armed === e.id && <span>{bc('babytracker_delete')}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function BreastButton({ label, startedAt, busy, onClick }: { label: string; startedAt?: number; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`bt-breast${startedAt ? ' live' : ''}`} onClick={onClick} disabled={busy} aria-pressed={!!startedAt}>
      <b>{label}</b>
      <span className="a3-num">{startedAt ? <>{bc('babytracker_running')} · <Elapsed since={startedAt} /></> : bc('babytracker_start')}</span>
    </button>
  );
}

export default function BabyTracker({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('BabyTracker', 'Tools');
  const { loading, addLog, deleteLog } = useBabyLogs();
  const range = useBabyLogsRange(90);
  const logs = range.logs;
  const { selectedChild, hasMultipleChildren } = useChildren();
  const { unlockAchievement } = useAchievements();
  const { toast } = useToast();
  const childId = selectedChild?.id;
  const childName = hasMultipleChildren ? selectedChild?.name : undefined;
  const activeTimers = useTimerStore((s) => s.activeTimers);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);

  const [tab, setTab] = useState<Tab>('feeding');
  const [days, setDays] = useState<number>(7);
  const [ml, setMl] = useState('');
  const [food, setFood] = useState('');
  const [busy, setBusy] = useState(false);
  // Minute clock for "x min ago" and day boundaries; the running timers tick on their own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(id); }, []);

  const timerFor = (pred: (t: typeof activeTimers[number]) => boolean) =>
    activeTimers.find((t) => (t.childId ?? undefined) === (childId ?? undefined) && pred(t));
  const leftTimer = timerFor((t) => t.type === 'feeding' && t.feedType === 'left');
  const rightTimer = timerFor((t) => t.type === 'feeding' && t.feedType === 'right');
  const sleepTimer = timerFor((t) => t.type === 'sleep');

  const today = useMemo(() => logsOfDay(logs, now), [logs, now]);
  const feedToday = useMemo(() => feedingStats(today), [today]);
  const sleepToday = useMemo(() => sleepStats(today), [today]);
  const diaperToday = useMemo(() => diaperStats(today), [today]);
  const windowLogs = useMemo(() => logsInWindow(logs, now, days), [logs, now, days]);
  const feedPeriod = useMemo(() => feedingStats(windowLogs), [windowLogs]);
  const sleepPeriod = useMemo(() => sleepStats(windowLogs), [windowLogs]);
  const diaperPeriod = useMemo(() => diaperStats(windowLogs), [windowLogs]);
  const trend = useMemo(() => trendPoints(logs, tab, now, days), [logs, tab, now, days]);
  const history = useMemo(() => dailyHistory(logs, now, days).filter((r) => r.feedings + r.diapers + r.sleepMinutes > 0), [logs, now, days]);
  const labelOf = dayLabel(days);

  const saveError = (): void => { toast({ title: bc('babytracker_save_error'), variant: 'destructive' }); };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const refresh = () => { void range.refresh(); };

  const toggleBreast = (side: 'left' | 'right') => run(async () => {
    void hapticFeedback.medium();
    const timer = side === 'left' ? leftTimer : rightTimer;
    if (!timer) { startTimer('feeding', side, undefined, childId, childName); return; }
    const result = stopTimer(timer.id);
    if (!result) return;
    const end = new Date();
    const { error } = await addLog({
      log_type: 'feeding', feed_type: side === 'left' ? 'breast_left' : 'breast_right',
      start_time: new Date(end.getTime() - result.durationSeconds * 1000).toISOString(), end_time: end.toISOString(),
    });
    if (error) return saveError();
    refresh();
    toast({ title: side === 'left' ? bc('babytracker_left_done') : bc('babytracker_right_done'), description: `${bc('babytracker_duration')}: ${formatClockSeconds(result.durationSeconds)}` });
    if (feedToday.total >= FEEDING_PRO_AFTER) void unlockAchievement('feeding_pro', 'mommy');
  });

  const saveFormula = () => run(async () => {
    const amount = Math.round(Number(ml.replace(',', '.')));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) { toast({ title: bc('babytracker_ml_invalid'), variant: 'destructive' }); return; }
    void hapticFeedback.light();
    const { error } = await addLog({ log_type: 'feeding', feed_type: 'formula', notes: `${amount} ml` });
    if (error) return saveError();
    refresh(); setMl('');
    toast({ title: `${bc('babytracker_formula')} ${amount} ml ${bc('babytracker_saved')}` });
  });

  const saveSolid = () => run(async () => {
    const name = food.trim().slice(0, 80);
    if (!name) return;
    void hapticFeedback.light();
    const { error } = await addLog({ log_type: 'feeding', feed_type: 'solid', notes: name });
    if (error) return saveError();
    refresh(); setFood('');
    toast({ title: `${name} ${bc('babytracker_saved')}` });
  });

  const toggleSleep = () => run(async () => {
    void hapticFeedback.medium();
    if (!sleepTimer) {
      startTimer('sleep', undefined, undefined, childId, childName);
      toast({ title: bc('babytracker_sleep_started'), description: bc('babytracker_tap_to_stop') });
      return;
    }
    const result = stopTimer(sleepTimer.id);
    if (!result) return;
    const end = new Date();
    const { error } = await addLog({ log_type: 'sleep', start_time: new Date(end.getTime() - result.durationSeconds * 1000).toISOString(), end_time: end.toISOString() });
    if (error) return saveError();
    refresh();
    toast({ title: bc('babytracker_sleep_ended'), description: `${bc('babytracker_slept')}: ${formatClockSeconds(result.durationSeconds)}` });
  });

  const addDiaper = (kind: DiaperKind) => run(async () => {
    void hapticFeedback.light();
    const hero = diaperToday.total >= DIAPER_HERO_AFTER;
    const { error } = await addLog({ log_type: 'diaper', diaper_type: kind });
    if (error) return saveError();
    refresh();
    toast({ title: `${bc('babytracker_diaper_saved')}: ${diaperLabel(kind)}` });
    if (hero) void unlockAchievement('diaper_hero', 'mommy');
  });

  const remove = async (id: string) => {
    const { error } = await deleteLog(id);
    if (error) return saveError();
    refresh();
  };

  const feedEntries: Entry[] = useMemo(() => today.filter((l) => l.log_type === 'feeding' && feedKind(l.feed_type)).reverse().map((l: BabyLogRow) => {
    const kind = feedKind(l.feed_type), at = new Date(l.start_time);
    let title = bc('babytracker_formula'), detail = l.notes ?? '';
    if (kind === 'left') title = bc('babytracker_breast_left');
    if (kind === 'right') title = bc('babytracker_breast_right');
    if (kind === 'solid') title = bc('babytracker_solid');
    if (kind === 'left' || kind === 'right') detail = l.end_time ? formatClockSeconds((new Date(l.end_time).getTime() - at.getTime()) / 1000) : '';
    else if (kind === 'formula') { const v = mlFromNotes(l.notes); detail = v ? `${v} ml` : ''; }
    return { id: l.id, time: at, title, detail };
  }), [today]);
  const sleepEntries: Entry[] = useMemo(() => sleepToday.sessions.map((s) => ({
    id: s.id, time: s.start, title: `${timeOfDay(s.start)} – ${timeOfDay(s.end)}`, detail: `${bc('babytracker_duration')}: ${dur(s.minutes)}`,
  })).reverse(), [sleepToday]);
  const diaperEntries: Entry[] = useMemo(() => today.filter((l) => l.log_type === 'diaper').reverse().map((l) => {
    const k = diaperKind(l.diaper_type);
    return { id: l.id, time: new Date(l.start_time), title: k ? diaperLabel(k) : bc('babytracker_tab_diaper'), detail: '' };
  }), [today]);

  const totalTitle = periodText('babytracker_period_total', days);
  const avgLabel = periodText('babytracker_period_avg', days);
  const trendTitle = periodText('babytracker_trend_period', days);
  const times = bc('babytracker_times');

  return (
    <ToolPage>
      <ToolHeader title={bc('babytracker_title')} eyebrow={selectedChild?.name || undefined} onBack={onBack} />

      <div className="bt-stats">
        <StatTile icon={Milk} tone="c-peach" label={bc('babytracker_tab_feeding')} value={String(feedToday.total)} sub={feedToday.formulaMl ? `${feedToday.formulaMl} ml` : undefined} />
        <StatTile icon={Moon} tone="c-lav" label={bc('babytracker_tab_sleep')} value={clock(sleepToday.totalMinutes)} sub={`${sleepToday.sessions.length} ${bc('babytracker_sessions')}`} />
        <StatTile icon={Droplets} tone="c-yellow" label={bc('babytracker_tab_diaper')} value={String(diaperToday.total)} sub={`${bc('babytracker_diaper_wet')} ${diaperToday.wet} · ${bc('babytracker_diaper_dirty')} ${diaperToday.dirty}`} />
      </div>

      <div className="a3-seg bt-tabs" role="tablist" aria-label={bc('babytracker_title')}>
        {(['feeding', 'sleep', 'diaper'] as Tab[]).map((t) => {
          const Icon = t === 'feeding' ? Milk : t === 'sleep' ? Moon : Droplets;
          return <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}><Icon size={15} />{tabLabel(t)}</button>;
        })}
      </div>

      <div className="a3-chips hide-scrollbar bt-periods" role="radiogroup" aria-label={bc('babytracker_period_label')}>
        {PERIODS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={days === d} className={`a3-chip-btn${days === d ? ' on' : ''}`} onClick={() => setDays(d)}>
            {periodText('babytracker_period_days', d)}
          </button>
        ))}
      </div>

      {loading && !logs.length && <p className="a3-meta" style={{ textAlign: 'center' }}>{bc('babytracker_loading')}</p>}

      {tab === 'feeding' && (
        <div className="bt-stack">
          <Card title={bc('babytracker_live_breast')}>
            <div className="bt-two">
              <BreastButton label={bc('babytracker_breast_left')} startedAt={leftTimer?.startTime} busy={busy} onClick={() => void toggleBreast('left')} />
              <BreastButton label={bc('babytracker_breast_right')} startedAt={rightTimer?.startTime} busy={busy} onClick={() => void toggleBreast('right')} />
            </div>
          </Card>
          <Card title={bc('babytracker_bottle')}>
            <form className="bt-inline" onSubmit={(e) => { e.preventDefault(); void saveFormula(); }}>
              <input className="bt-input" inputMode="decimal" value={ml} onChange={(e) => setMl(e.target.value)} placeholder={bc('babytracker_ml_label')} aria-label={bc('babytracker_ml_label')} />
              <button type="submit" className="a3-btn soft sm" disabled={busy || !ml.trim()}><Plus size={14} />{bc('babytracker_formula_save')}</button>
            </form>
            <form className="bt-inline" onSubmit={(e) => { e.preventDefault(); void saveSolid(); }}>
              <input className="bt-input" maxLength={80} value={food} onChange={(e) => setFood(e.target.value)} placeholder={bc('babytracker_solid_label')} aria-label={bc('babytracker_solid_label')} />
              <button type="submit" className="a3-btn soft sm" disabled={busy || !food.trim()}><Plus size={14} />{bc('babytracker_solid_save')}</button>
            </form>
          </Card>
          <Card title={bc('babytracker_today')}>
            <Row label={bc('babytracker_breast_left')} value={`${feedToday.left} ${times}`} />
            <Row label={bc('babytracker_breast_right')} value={`${feedToday.right} ${times}`} />
            <Row label={bc('babytracker_breast_minutes')} value={dur(feedToday.breastMinutes)} />
            <Row label={bc('babytracker_formula')} value={`${feedToday.formulaCount} ${times}${feedToday.formulaMl ? ` · ${feedToday.formulaMl} ml` : ''}`} />
            <Row label={bc('babytracker_solid')} value={`${feedToday.solidCount} ${times}`} />
            <Row label={bc('babytracker_avg_gap')} value={feedToday.averageGapMinutes ? dur(feedToday.averageGapMinutes) : '—'} />
            <Row label={bc('babytracker_last')} value={feedToday.last ? `${timeOfDay(feedToday.last.at)} · ${ago(feedToday.last.at, now)}` : '—'} />
          </Card>
          <Card title={totalTitle}>
            <Row label={bc('babytracker_total')} value={String(feedPeriod.total)} />
            <Row label={bc('babytracker_breast_minutes')} value={dur(feedPeriod.breastMinutes)} />
            <Row label={bc('babytracker_formula')} value={`${feedPeriod.formulaCount}${feedPeriod.formulaMl ? ` · ${feedPeriod.formulaMl} ml` : ''}`} />
            <Row label={bc('babytracker_solid')} value={String(feedPeriod.solidCount)} />
            <Row label={avgLabel} value={`${oneDecimal(perDay(feedPeriod.total, days))} ${bc('babytracker_per_day')}`} />
          </Card>
          <Card title={trendTitle}><Bars points={trend} value={(p) => p.count} format={String} label={trendTitle} labelOf={labelOf} /></Card>
          <Card title={bc('babytracker_history')}><History rows={history} /></Card>
          <Card title={bc('babytracker_entries')}><Entries entries={feedEntries} onDelete={(id) => void remove(id)} /></Card>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="bt-stack">
          <section className="a3-card a3-pad bt-sleep">
            <p className="a3-meta" style={{ margin: 0 }}>{sleepTimer ? bc('babytracker_sleep_running') : bc('babytracker_sleep_idle')}</p>
            {sleepTimer && <p className="bt-sleep-clock a3-num"><Elapsed since={sleepTimer.startTime} /></p>}
            <button type="button" className={`a3-btn ${sleepTimer ? 'accent' : 'soft'}`} onClick={() => void toggleSleep()} disabled={busy}>
              <Moon size={16} />{sleepTimer ? bc('babytracker_sleep_stop') : bc('babytracker_sleep_start')}
            </button>
          </section>
          <Card title={bc('babytracker_today')}>
            <Row label={bc('babytracker_total')} value={dur(sleepToday.totalMinutes)} />
            <Row label={bc('babytracker_sessions')} value={String(sleepToday.sessions.length)} />
            <Row label={bc('babytracker_average')} value={sleepToday.averageMinutes ? dur(sleepToday.averageMinutes) : '—'} />
            <Row label={bc('babytracker_longest')} value={sleepToday.longestMinutes ? dur(sleepToday.longestMinutes) : '—'} />
            <Row label={bc('babytracker_last_wake')} value={sleepToday.lastEnd ? `${timeOfDay(sleepToday.lastEnd)} · ${ago(sleepToday.lastEnd, now)}` : '—'} />
          </Card>
          <Card title={totalTitle}>
            <Row label={bc('babytracker_total')} value={dur(sleepPeriod.totalMinutes)} />
            <Row label={bc('babytracker_sessions')} value={String(sleepPeriod.sessions.length)} />
            <Row label={bc('babytracker_average')} value={sleepPeriod.averageMinutes ? dur(sleepPeriod.averageMinutes) : '—'} />
            <Row label={bc('babytracker_longest')} value={sleepPeriod.longestMinutes ? dur(sleepPeriod.longestMinutes) : '—'} />
            <Row label={avgLabel} value={`${dur(sleepPeriod.totalMinutes / days)} ${bc('babytracker_per_day')}`} />
          </Card>
          <Card title={trendTitle}><Bars points={trend} value={(p) => Math.round(p.minutes)} format={dur} label={bc('babytracker_trend_sleep')} labelOf={labelOf} /></Card>
          <Card title={bc('babytracker_history')}><History rows={history} /></Card>
          <Card title={bc('babytracker_entries')}><Entries entries={sleepEntries} onDelete={(id) => void remove(id)} /></Card>
        </div>
      )}

      {tab === 'diaper' && (
        <div className="bt-stack">
          <Card title={bc('babytracker_diaper_change')}>
            <div className="bt-three">
              {DIAPERS.map((d) => (
                <button key={d.value} type="button" className="bt-diaper" onClick={() => void addDiaper(d.value)} disabled={busy}>
                  <span aria-hidden="true">{d.emoji}</span><b>{diaperLabel(d.value)}</b>
                </button>
              ))}
            </div>
          </Card>
          <Card title={bc('babytracker_today')}>
            <Row label={bc('babytracker_total')} value={String(diaperToday.total)} />
            <Row label={bc('babytracker_diaper_wet')} value={String(diaperToday.wet)} />
            <Row label={bc('babytracker_diaper_dirty')} value={String(diaperToday.dirty)} />
            <Row label={bc('babytracker_diaper_mixed')} value={String(diaperToday.mixed)} />
            <Row label={bc('babytracker_avg_gap')} value={diaperToday.averageGapMinutes ? dur(diaperToday.averageGapMinutes) : '—'} />
            <Row label={bc('babytracker_last')} value={diaperToday.last ? `${timeOfDay(diaperToday.last)} · ${ago(diaperToday.last, now)}` : '—'} />
          </Card>
          <Card title={totalTitle}>
            <Row label={bc('babytracker_total')} value={String(diaperPeriod.total)} />
            <Row label={bc('babytracker_diaper_wet')} value={String(diaperPeriod.wet)} />
            <Row label={bc('babytracker_diaper_dirty')} value={String(diaperPeriod.dirty)} />
            <Row label={bc('babytracker_diaper_mixed')} value={String(diaperPeriod.mixed)} />
            <Row label={avgLabel} value={`${oneDecimal(perDay(diaperPeriod.total, days))} ${bc('babytracker_per_day')}`} />
          </Card>
          <Card title={trendTitle}><Bars points={trend} value={(p) => p.count} format={String} label={bc('babytracker_trend_diaper')} labelOf={labelOf} /></Card>
          <Card title={bc('babytracker_history')}><History rows={history} /></Card>
          <Card title={bc('babytracker_entries')}><Entries entries={diaperEntries} onDelete={(id) => void remove(id)} /></Card>
        </div>
      )}
    </ToolPage>
  );
}
