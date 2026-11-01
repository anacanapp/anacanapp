import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Moon } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useSleepNextText, type SleepNextText } from '@/data/sleep-next';
import { fill } from '@/lib/feature-text';
import { getLocaleTag } from '@/lib/i18n';
import { hapticFeedback } from '@/lib/native';
import { Switch } from '@/components/ui/switch';
import type { AgeBand, SleepEntry } from '@/lib/sleep-training';
import {
  SLEEPY_CUES, personalWakeWindow, predictDay, predictNextNap, upcomingRegressions,
  type NextNap, type PlanItem, type Regression, type SleepyCue } from
'@/lib/sleep-predict';
import { planNapAlerts, readNapAlerts, requestNapAlertPermission, saveNapAlerts, syncNapAlerts, type NapAlertSettings } from '@/lib/nap-alerts';
import '@/styles/care.css';

interface Props {
  entries: SleepEntry[];
  band: AgeBand;
  now: Date;
  birth: Date;
  childName: string;
  sleepingSince: Date | null;
  morningWake: Date | null;
  busy: boolean;
  onStartSleep: () => void;
}

const CUES_KEY = 'anacan.sleepCues.v1';

/** Sleep cues apply to the current awake period only (keyed by its start). */
function useCues(lastWake: Date | null) {
  const key = lastWake ? String(lastWake.getTime()) : '';
  const [state, setState] = useState<{ key: string; cues: SleepyCue[] }>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CUES_KEY) || 'null');
      return raw && raw.key === key ? raw : { key, cues: [] };
    } catch { return { key, cues: [] }; }
  });
  const cues = state.key === key ? state.cues : [];
  const toggle = (c: SleepyCue) => {
    const next = { key, cues: cues.includes(c) ? cues.filter((x) => x !== c) : [...cues, c] };
    setState(next);
    try { localStorage.setItem(CUES_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };
  return { cues, toggle };
}

export function useNextNap(p: Pick<Props, 'entries' | 'band' | 'now' | 'sleepingSince' | 'morningWake'>, cues: SleepyCue[]) {
  return useMemo(() => predictNextNap({ ...p, cues }), [p.entries, p.band, p.now, p.sleepingSince, p.morningWake, cues]);
}

/** The "Next nap" block on the sleep tool's Today tab: gauge, plan, regressions and alerts. */
export default function NextNapSection(props: Props) {
  const language = useUserStore((s) => s.language);
  const t = useSleepNextText(language);
  const base = useMemo(() => predictNextNap({ entries: props.entries, band: props.band, now: props.now, sleepingSince: props.sleepingSince, morningWake: props.morningWake }),
    [props.entries, props.band, props.now, props.sleepingSince, props.morningWake]);
  const { cues, toggle } = useCues(base.lastWake);
  const next = useNextNap(props, cues);
  const plan = useMemo(() => predictDay({ entries: props.entries, band: props.band, now: props.now, next, sleepingSince: props.sleepingSince }),
    [props.entries, props.band, props.now, next, props.sleepingSince]);
  const regressions = useMemo(() => upcomingRegressions(props.birth, props.now), [props.birth, props.now]);
  const [alerts, setAlerts] = useState<NapAlertSettings>(readNapAlerts);
  const locale = getLocaleTag();
  const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  // Keep this phone's sleep notifications in line with the latest prediction.
  const alertKey = `${next.windowStart?.getTime()}|${props.sleepingSince?.getTime()}|${regressions[0]?.key}|${JSON.stringify(alerts)}|${language}`;
  useEffect(() => {
    if (!t) return;
    const name = props.childName || t.baby;
    const reg = regressions[0] ?? null;
    void syncNapAlerts(planNapAlerts({
      settings: alerts, now: new Date(), next, sleepingSince: props.sleepingSince, regression: reg,
      text: {
        napTitle: (min) => fill(t.notif_nap_title, { name, min }),
        napBody: next.windowStart && next.windowEnd ? fill(t.notif_nap_body, { from: clock(next.windowStart), to: clock(next.windowEnd) }) : '',
        longTitle: fill(t.notif_long_title, { name }), longBody: t.notif_long_body,
        regressTitle: reg ? fill(t.notif_regress_title, { name, regression: t.regressions[reg.key].name }) : '', regressBody: t.notif_regress_body
      }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey, t]);

  if (!t) return null;
  const ww = personalWakeWindow(props.entries, props.band, props.now);
  return (
    <>
      {!props.sleepingSince && <NextNapCard t={t} next={next} ww={ww} clock={clock} cues={cues} onCue={toggle} busy={props.busy} onStart={props.onStartSleep} />}
      <DayPlanCard t={t} plan={plan} now={props.now} clock={clock} />
      {regressions[0] && <RegressionCard t={t} regression={regressions[0]} later={regressions.slice(1, 4)} locale={locale} />}
      <AlertsCard t={t} settings={alerts} onChange={async (s) => {
        if (s.enabled && !alerts.enabled) await requestNapAlertPermission();
        setAlerts(s);saveNapAlerts(s);
      }} />
      <p className="cx-disc" style={{ marginTop: 0 }}>🧠 {t.learning}</p>
    </>);
}

const fmtDur = (min: number) => min >= 60 ? `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)}′`;

function Gauge({ next, t, clock }: { next: NextNap; t: SleepNextText; clock: (d: Date) => string }) {
  const W = 280, H = 168, cx = 140, cy = 150, r = 118;
  const pt = (f: number) => {
    const a = Math.PI * (1 - Math.min(1, f));
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = pt(f0), [x1, y1] = pt(f1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const total = next.windowEnd && next.lastWake ? (next.windowEnd.getTime() - next.lastWake.getTime()) : 1;
  const winFrom = next.windowStart && next.lastWake ? (next.windowStart.getTime() - next.lastWake.getTime()) / total : 0.85;
  const progress = Math.min(1, next.progress);
  const [kx, ky] = pt(progress);
  const over = next.state === 'overtired';
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 300, display: 'block', margin: '0 auto' }} role="img">
      <defs>
        <linearGradient id="nnGrad" x1="0" x2="1"><stop offset="0" stopColor="#9ad7b0" /><stop offset=".6" stopColor="#c7aef5" /><stop offset="1" stopColor="#7c5cd6" /></linearGradient>
      </defs>
      <path d={arc(0, 1)} fill="none" stroke="var(--a-surface-soft)" strokeWidth="20" strokeLinecap="round" />
      <path d={arc(winFrom, 1)} fill="none" stroke="#7c5cd6" strokeOpacity=".22" strokeWidth="28" strokeLinecap="round" />
      {progress > 0.01 && <path d={arc(0, progress)} fill="none" stroke={over ? '#e8590c' : 'url(#nnGrad)'} strokeWidth="20" strokeLinecap="round" />}
      <circle cx={kx} cy={ky} r="12" fill="var(--a-surface)" stroke={over ? '#e8590c' : '#5b3aa5'} strokeWidth="5" />
      <text x={cx} y={cy - 46} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--a-ink-soft)">{t.awake}</text>
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="38" fontWeight="800" fill="var(--a-ink)">{next.awakeMinutes != null ? fmtDur(next.awakeMinutes) : '—'}</text>
      {next.lastWake && <text x="22" y={H - 2} fontSize="11" fill="var(--a-ink-soft)">{fill(t.woke_at, { time: clock(next.lastWake) })}</text>}
      <text x={W - 22} y={H - 2} fontSize="11" fontWeight="800" fill="#5b3aa5" textAnchor="end">{t.window_label}</text>
    </svg>);
}

function NextNapCard({ t, next, ww, clock, cues, onCue, busy, onStart }: {
  t: SleepNextText; next: NextNap; ww: ReturnType<typeof personalWakeWindow>; clock: (d: Date) => string;
  cues: SleepyCue[]; onCue: (c: SleepyCue) => void; busy: boolean; onStart: () => void;
}) {
  const range = `${fmtDur(ww.range[0])}–${fmtDur(ww.range[1])}`;
  if (next.state === 'unknown') {
    return (
      <section className="cx-card" style={{ background: 'linear-gradient(160deg, var(--a-surface), var(--a-lav-1))' }}>
        <div className="cx-row"><span className="cx-icon" style={{ background: 'var(--a-surface)' }}>🌙</span>
          <div><b style={{ fontSize: 15, color: 'var(--a-ink)' }}>{t.unknown_title}</b><p className="cx-sub">{t.unknown_desc}</p></div></div>
      </section>);
  }
  const tone = next.state === 'overtired' ? { bg: '#fff1e6', ink: '#b35309' } : next.state === 'window' ? { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' } : { bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' };
  const headline = next.state === 'window' ? t.now_open : next.state === 'overtired' ? t.overtired : next.minutesToStart != null ? fill(t.in_min, { min: fmtDur(next.minutesToStart) }) : '';
  return (
    <motion.section className="cx-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="cx-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div><b style={{ fontSize: 16, color: 'var(--a-ink)' }}>{t.next_title}</b><p className="cx-sub" style={{ fontSize: 12 }}>{t.next_sub}</p></div>
        {ww.samples > 0 && <span className="cx-pill" style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>✨ {fill(t.personal, { n: ww.samples })}</span>}
      </div>
      <Gauge next={next} t={t} clock={clock} />
      {next.windowStart && next.windowEnd &&
      <div className="cx-row" style={{ marginTop: 12, background: tone.bg, borderRadius: 18, padding: '12px 14px', alignItems: 'flex-start' }}>
          <span className="cx-icon" style={{ background: 'var(--a-surface)' }}>{next.isBedtime ? '🌛' : '🌙'}</span>
          <div style={{ minWidth: 0 }}>
            <p className="cx-eyebrow" style={{ color: tone.ink }}>{next.isBedtime ? t.bedtime_best : t.best_time}</p>
            <div style={{ fontSize: 22, fontWeight: 800, color: tone.ink, letterSpacing: '-.02em' }}>{clock(next.windowStart)} – {clock(next.windowEnd)}</div>
            <p className="cx-sub">{headline} · {fill(t.range_age, { range })}</p>
          </div>
        </div>
      }
      <p className="cx-field" style={{ marginTop: 14 }}>{t.cues_title}</p>
      <div className="cx-chips">
        {SLEEPY_CUES.map((c) => <button key={c} type="button" className="cx-chip" aria-pressed={cues.includes(c)}
        style={cues.includes(c) ? { borderColor: 'var(--a-lav-2)', background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' } : undefined}
        onClick={() => {onCue(c);void hapticFeedback.light();}}>{t.cues[c]}</button>)}
      </div>
      {cues.length > 0 && <p className="cx-sub" style={{ marginTop: 8, color: 'var(--a-lav-ink)', fontWeight: 700 }}>✨ {fill(t.cues_applied, { n: cues.length, min: Math.min(15, cues.length * 5) })}</p>}
      <button type="button" className="a3-btn cx-wide" style={{ marginTop: 14, background: '#7c5cd6', color: '#fff' }} disabled={busy} onClick={onStart}>
        <Moon size={17} />{t.start_sleep}
      </button>
    </motion.section>);
}

function DayPlanCard({ t, plan, now, clock }: { t: SleepNextText; plan: PlanItem[]; now: Date; clock: (d: Date) => string }) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6).getTime();
  const span = 15 * 3600_000;
  const pct = (d: Date) => Math.min(100, Math.max(0, (d.getTime() - dayStart) / span * 100));
  const naps = plan.filter((p) => p.kind === 'nap');
  const bed = plan.find((p) => p.kind === 'bedtime');
  const hatch = 'repeating-linear-gradient(45deg,#c7aef5,#c7aef5 5px,#e9ddfc 5px,#e9ddfc 10px)';
  let napNo = 0;
  return (
    <section className="cx-card cx-gap">
      <div className="cx-row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 15, color: 'var(--a-ink)' }}>{t.plan_title}</b>
        {bed && <span className="cx-sub">{fill(t.plan_sub, { naps: naps.length, time: clock(bed.start) })}</span>}
      </div>
      <div style={{ position: 'relative', height: 58, marginTop: 10 }}>
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 20, borderRadius: 10, background: 'var(--a-surface-soft)' }} />
        {naps.map((p, i) => <div key={i} style={{ position: 'absolute', top: 14, height: 20, borderRadius: 10, left: `${pct(p.start)}%`, width: `${Math.max(2.5, pct(p.end) - pct(p.start))}%`, background: p.status === 'predicted' ? hatch : '#7c5cd6' }} />)}
        {bed && <div style={{ position: 'absolute', top: 14, height: 20, borderRadius: 10, left: `${pct(bed.start)}%`, right: 0, background: '#3b2c6b' }} />}
        <div style={{ position: 'absolute', top: 6, width: 3, height: 36, borderRadius: 3, background: 'var(--a-ink)', left: `calc(${pct(now)}% - 1px)` }} />
        <span style={{ position: 'absolute', top: 42, fontSize: 10.5, fontWeight: 800, color: 'var(--a-ink)', left: `${pct(now)}%`, transform: 'translateX(-50%)' }}>{t.now}</span>
        <span style={{ position: 'absolute', top: 42, left: 0, fontSize: 10, color: 'var(--a-ink-faint)' }}>06</span>
        <span style={{ position: 'absolute', top: 42, right: 0, fontSize: 10, color: 'var(--a-ink-faint)' }}>21</span>
      </div>
      <div className="cx-row" style={{ gap: 14, fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 4 }}>
        <span className="cx-row" style={{ gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: '#7c5cd6' }} />{t.done}</span>
        <span className="cx-row" style={{ gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: hatch }} />{t.predicted}</span>
        <span className="cx-row" style={{ gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: '#3b2c6b' }} />{t.night}</span>
      </div>
      <div className="cx-list" style={{ marginTop: 8 }}>
        {plan.map((p, i) => {
          if (p.kind === 'bedtime') {
            const ritual = new Date(p.start.getTime() - 30 * 60_000);
            return <div key={i} className="cx-li"><span className="cx-icon" style={{ background: '#3b2c6b', color: '#fff' }}>🌛</span>
              <div><b>{fill(t.bedtime, { time: clock(p.start) })}</b><small>{fill(t.bedtime_sub, { time: clock(ritual) })}</small></div></div>;
          }
          napNo += 1;
          const sub = p.status === 'done' ? fill(t.nap_done, { time: `${clock(p.start)}–${clock(p.end)}`, dur: fmtDur(p.minutes) }) :
          p.status === 'now' ? fill(t.nap_now, { time: clock(p.start) }) : fill(t.nap_predicted, { time: clock(p.start), dur: fmtDur(p.minutes) });
          return <div key={i} className="cx-li">
            <span className="cx-icon" style={p.status === 'predicted' ? { background: 'var(--a-surface)', border: '2px dashed var(--a-lav-2)' } : { background: 'var(--a-lav-1)' }}>{p.status === 'done' ? '✅' : p.status === 'now' ? '😴' : '🌙'}</span>
            <div style={{ flex: 1 }}><b>{fill(t.nap_n, { n: napNo })}</b><small>{sub}</small></div>
          </div>;
        })}
      </div>
    </section>);
}

function RegressionCard({ t, regression, later, locale }: { t: SleepNextText; regression: Regression; later: Regression[]; locale: string }) {
  const r = t.regressions[regression.key];
  const day = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const [open, setOpen] = useState(regression.active || regression.daysUntil <= 21);
  return (
    <section className="cx-card cx-gap" style={{ background: 'linear-gradient(160deg, var(--a-surface), var(--a-lav-1))' }}>
      <button type="button" className="cx-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer', padding: 0 }} onClick={() => setOpen((o) => !o)}>
        <span className="cx-icon" style={{ background: 'var(--a-surface)', width: 50, height: 50, fontSize: 24 }}>🌀</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="cx-eyebrow" style={{ display: 'block', color: 'var(--a-lav-ink)' }}>{t.regress_title} · {regression.active ? t.regress_active : fill(t.regress_in, { days: regression.daysUntil })}</span>
          <b style={{ display: 'block', fontSize: 16, color: 'var(--a-ink)' }}>{r.name}</b>
          <span className="cx-sub">{fill(t.regress_range, { from: day(regression.start), to: day(regression.end) })}</span>
        </span>
      </button>
      {open &&
      <div style={{ marginTop: 10 }}>
          <p className="cx-field">{t.expect_title}</p>
          <ul className="cx-sub" style={{ margin: 0, paddingInlineStart: 18, color: 'var(--a-ink)' }}>{r.expect.map((x) => <li key={x} style={{ marginTop: 3 }}>{x}</li>)}</ul>
          <p className="cx-field" style={{ marginTop: 10 }}>{t.prep_title}</p>
          <ul className="cx-sub" style={{ margin: 0, paddingInlineStart: 18, color: 'var(--a-green-ink)' }}>{r.prep.map((x) => <li key={x} style={{ marginTop: 3 }}>{x}</li>)}</ul>
          {later.length > 0 &&
        <>
              <p className="cx-field" style={{ marginTop: 10 }}>{t.later_title}</p>
              <div className="cx-row" style={{ gap: 8 }}>
                {later.map((l) => <div key={l.key} style={{ flex: 1, minWidth: 0, background: 'var(--a-surface)', borderRadius: 14, padding: '8px 10px' }}>
                  <b style={{ display: 'block', fontSize: 12.5, color: 'var(--a-ink)' }}>{t.regressions[l.key].name}</b>
                  <span className="cx-sub" style={{ fontSize: 11 }}>{day(l.start)}</span>
                </div>)}
              </div>
            </>
        }
        </div>
      }
    </section>);
}

function AlertsCard({ t, settings, onChange }: { t: SleepNextText; settings: NapAlertSettings; onChange: (s: NapAlertSettings) => void }) {
  const row = (icon: string, title: string, sub: string, value: boolean, set: (v: boolean) => void) =>
  <div className="cx-li"><span className="cx-icon" style={{ background: 'var(--a-lav-1)' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{title}</b><small>{sub}</small></div>
      <Switch checked={value} onCheckedChange={set} aria-label={title} className="data-[state=checked]:bg-[#7c5cd6]" /></div>;
  return (
    <section className="cx-card cx-gap" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="cx-li">
        <span className="cx-icon" style={{ background: 'var(--a-lav-1)' }}><Bell size={18} style={{ color: 'var(--a-lav-ink)' }} /></span>
        <div style={{ flex: 1 }}><b>{t.alerts_title}</b><small>{t.alerts_sub}</small></div>
        <Switch checked={settings.enabled} onCheckedChange={(v) => onChange({ ...settings, enabled: v })} aria-label={t.alerts_title} className="data-[state=checked]:bg-[#7c5cd6]" />
      </div>
      {settings.enabled &&
      <>
          <div style={{ padding: '4px 0 10px' }}>
            <span className="cx-field">⏰ {t.alert_lead}</span>
            <div className="cx-seg">{([5, 10, 15, 20] as const).map((n) => <button key={n} type="button" aria-pressed={settings.lead === n} onClick={() => onChange({ ...settings, lead: n })}>{fill(t.alert_lead_min, { n })}</button>)}</div>
          </div>
          {row('😴', t.alert_long, t.alert_long_sub, settings.longNap, (v) => onChange({ ...settings, longNap: v }))}
          {row('🌀', t.alert_regress, t.alert_regress_sub, settings.regression, (v) => onChange({ ...settings, regression: v }))}
          {row('🌙', t.alert_quiet, t.alert_quiet_sub, settings.quiet, (v) => onChange({ ...settings, quiet: v }))}
        </>
      }
    </section>);
}
