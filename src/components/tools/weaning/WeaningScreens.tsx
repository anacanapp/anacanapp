import { useState, type ReactNode } from 'react';
import { Crown, Phone } from 'lucide-react';
import { toast } from 'sonner';
import PremiumBlurGate from '@/components/premium/PremiumBlurGate';
import { fillEmergencyNumber } from '@/lib/emergency';
import { stepLabel, wf, wt, type WeaningKey } from '@/lib/weaning-copy';
import {
  type CheckinAnswers, type FeedType, type NightMode, type Pace, type ReasonId, type Tone, type WeaningPlan, type WeaningStep,
  CUP_ML, EMPTY_CHECKIN, EXTEND_STEP_DAYS, FEED_ICONS, FEED_MAX, MAX_CUPS, MILK_MAX_ML, MIN_DAYS, PACE, PACES, REASONS,
  addDays, applyCheckin, canComplete, canStartNow, checkinComplete, completeCurrent, createPlan, currentStep, currentStepIndex,
  daysBetween, doneCount, evaluateCheckin, extendStep, isoDay, milkStatus, nextUnlockDay, pausePlan, planLastDay,
  planStepCount, planWeeks, readinessAnswered, readinessVerdict, resumePlan, startNow, stepDay, stepState, cancelPlan,
} from '@/lib/weaning';
import { makeCheckin, type WeaningLocal } from '@/lib/weaning-sync';

export type Screen = 'intro' | 'ready' | 'builder' | 'hub' | 'step' | 'checkin' | 'result' | 'nutrition' | 'mother' | 'myths' | 'night' | 'finish';

export interface WeaningCtx {
  today: string;
  isPremium: boolean;
  childName: string;
  childGender: string | null | undefined;
  childId: string | null;
  ageMonths: number | null;
  emergency: string;
  local: WeaningLocal;
  plan: WeaningPlan | null;
  stepId: string | null;
  go: (screen: Screen, opts?: { stepId?: string; reset?: boolean }) => void;
  update: (fn: (s: WeaningLocal) => WeaningLocal) => void;
  setPlan: (plan: WeaningPlan | null) => void;
  openTool: (toolId: string) => void;
  share: (title: string, text: string) => void;
  fmt: (day: string) => string;
}

const PREMIUM = 'Premium';
const ftKey = (t: FeedType, suffix = '') => `weaning_ft_${t}${suffix}` as WeaningKey;
const stepTitle = (s: WeaningStep) => `${FEED_ICONS[s.type]} ${stepLabel(s)}`;
const partnerHint = (t: FeedType) => wt(t === 'night' || t === 'bedtime' || t === 'nap' ? 'weaning_partner_sleep' : 'weaning_partner_day');

const Alert = ({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) => (
  <div className={`a-wean-alert is-${tone}`} role={tone === 'red' ? 'alert' : undefined}><b>{title}</b>{children}</div>
);
const FreePill = () => <span className="a-wean-pill is-mint">{wt('weaning_free')}</span>;
const PremiumPill = () => <span className="a-wean-pill is-prem"><Crown size={11} strokeWidth={2.5} />{PREMIUM}</span>;
const Toggle = ({ pressed, onToggle, label }: { pressed: boolean; onToggle: () => void; label: string }) => (
  <button type="button" className="a-wean-toggle" aria-pressed={pressed} aria-label={label} onClick={onToggle} />
);

// ── Intro ──────────────────────────────────────────────────────────────────────────────────
export function IntroScreen({ ctx }: { ctx: WeaningCtx }) {
  const { local } = ctx;
  const setContinue = (v: boolean) => {
    ctx.update((s) => ({ ...s, continueBF: v }));
    if (v) toast.success(wt('weaning_continue_saved'));
  };
  return (
    <div className="a-wean">
      <div className="a-wean-hero">
        {ctx.ageMonths !== null && <span className="a-wean-pill is-coral">{`${ctx.childName} · ${wf('weaning_age_months', { n: ctx.ageMonths })}`}</span>}
        <h2>{wt('weaning_intro_title')}</h2>
        <p>{wt('weaning_intro_text')}</p>
      </div>
      {local.continueBF && (
        <Alert tone="mint" title={wt('weaning_continue_active_title')}>
          <span>{wt('weaning_continue_active_text')}</span>
          <button type="button" className="a-wean-btn ghost small" onClick={() => setContinue(false)}>{wt('weaning_continue_undo')}</button>
        </Alert>
      )}
      <div className="a-wean-principles">
        <div><span>🐢</span>{wt('weaning_principle_gradual')}</div>
        <div><span>🤍</span>{wt('weaning_principle_safe')}</div>
        <div><span>🫶</span>{wt('weaning_principle_choice')}</div>
      </div>
      {ctx.plan
        ? <button type="button" className="a-wean-btn" onClick={() => ctx.go('hub', { reset: true })}>{wt('weaning_cta_open_plan')}</button>
        : <button type="button" className="a-wean-btn" onClick={() => ctx.go('ready')}>{wt('weaning_cta_build')}</button>}
      <div className="a-wean-card">
        <h3>{wt('weaning_read_first')}</h3>
        <ul className="a-wean-list">
          <li><span className="ic">🥛</span><button type="button" className="a-wean-chip" onClick={() => ctx.go('nutrition')}>{wt('weaning_link_nutrition')}</button></li>
          <li><span className="ic">🚫</span><button type="button" className="a-wean-chip" onClick={() => ctx.go('myths')}>{wt('weaning_link_myths')}</button></li>
          <li><span className="ic">💗</span><button type="button" className="a-wean-chip" onClick={() => ctx.go('mother')}>{wt('weaning_link_mother')}</button></li>
          <li><span className="ic">🌙</span><button type="button" className="a-wean-chip" onClick={() => ctx.go('night')}>{wt('weaning_link_night')}</button></li>
        </ul>
      </div>
      {!local.continueBF && (
        <div className="a-wean-card">
          <h3>{wt('weaning_continue_title')}</h3>
          <p>{wt('weaning_continue_text')}</p>
          <button type="button" className="a-wean-btn ghost small" onClick={() => setContinue(true)}>{wt('weaning_continue_btn')}</button>
        </div>
      )}
      <p className="a-wean-small">{wt('weaning_sources')}</p>
    </div>
  );
}

// ── Readiness ──────────────────────────────────────────────────────────────────────────────
export function ReadyScreen({ ctx }: { ctx: WeaningCtx }) {
  const r = ctx.local.readiness;
  const v = readinessVerdict(ctx.ageMonths, r);
  const canAsk = ctx.ageMonths !== null && v.canPlan;
  const answered = readinessAnswered(r);
  const set = (k: 'sick' | 'change' | 'allergy', val: boolean) => ctx.update((s) => ({ ...s, readiness: { ...s.readiness, [k]: val } }));
  const toggleReason = (id: ReasonId) => ctx.update((s) => {
    const has = s.readiness.reasons.includes(id);
    return { ...s, readiness: { ...s.readiness, reasons: has ? s.readiness.reasons.filter((x) => x !== id) : [...s.readiness.reasons, id] } };
  });
  const yn = (k: 'sick' | 'change' | 'allergy', q: WeaningKey, help?: WeaningKey) => (
    <div className="a-wean-card" role="group" aria-label={wt(q)}>
      <div className="a-wean-lab">{wt(q)}</div>
      {help && <p>{wt(help)}</p>}
      <div className="a-wean-row">
        <button type="button" className="a-wean-chip" aria-pressed={r[k] === true} onClick={() => set(k, true)}>{wt('weaning_yes')}</button>
        <button type="button" className="a-wean-chip" aria-pressed={r[k] === false} onClick={() => set(k, false)}>{wt('weaning_no')}</button>
      </div>
    </div>
  );
  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <dl className="a-wean-kv">
          <dt>{wt('weaning_child')}</dt>
          <dd>{ctx.ageMonths === null ? ctx.childName : wf('weaning_from_profile', { name: ctx.childName, age: wf('weaning_age_months', { n: ctx.ageMonths }) })}</dd>
        </dl>
      </div>
      {canAsk && <>
        {yn('sick', 'weaning_q_sick')}
        {yn('change', 'weaning_q_change', 'weaning_q_change_help')}
        {yn('allergy', 'weaning_q_allergy')}
        <div className="a-wean-card">
          <div className="a-wean-lab">{wt('weaning_reason_title')}</div>
          <p>{wt('weaning_reason_help')}</p>
          <div className="a-wean-row">
            {REASONS.map((id) => (
              <button key={id} type="button" className="a-wean-chip" aria-pressed={r.reasons.includes(id)} onClick={() => toggleReason(id)}>
                {wt(`weaning_reason_${id}` as WeaningKey)}
              </button>
            ))}
          </div>
        </div>
      </>}
      {canAsk && r.reasons.includes('pregnant') && <Alert tone="sky" title={wt('weaning_pregnant_title')}><span>{wt('weaning_pregnant_text')}</span></Alert>}
      {canAsk && r.allergy === true && <Alert tone="amber" title={wt('weaning_allergy_title')}><span>{wt('weaning_allergy_text')}</span></Alert>}
      {(answered || !canAsk) && <Alert tone={v.tone} title={wt(v.title)}><span>{wt(v.text)}</span></Alert>}
      {v.canPlan
        ? <button type="button" className="a-wean-btn" disabled={!answered} onClick={() => ctx.go('builder')}>{wt(v.delay ? 'weaning_ready_continue_delay' : 'weaning_ready_continue')}</button>
        : <button type="button" className="a-wean-btn ghost" onClick={() => ctx.go('nutrition')}>{wt('weaning_read_nutrition')}</button>}
    </div>
  );
}

// ── Plan builder ───────────────────────────────────────────────────────────────────────────
export function BuilderScreen({ ctx }: { ctx: WeaningCtx }) {
  const { feeds, pace, nightMode, readiness } = ctx.local;
  const v = readinessVerdict(ctx.ageMonths, readiness);
  const [startChoice, setStartChoice] = useState<'recommended' | 'today'>('recommended');
  if (!v.canPlan) return <ReadyScreen ctx={ctx} />;
  const delay = startChoice === 'recommended' ? v.delay : 0;
  const start = addDays(ctx.today, delay);
  const steps = planStepCount(feeds, nightMode);
  const setFeeds = (patch: Partial<typeof feeds>) => ctx.update((s) => ({ ...s, feeds: { ...s.feeds, ...patch } }));
  const row = (k: 'morning' | 'day' | 'nap' | 'bedtime' | 'night', icon: FeedType) => {
    const label = wt(`weaning_feed_${k}` as WeaningKey);
    const isCount = k === 'day' || k === 'night';
    return (
      <div className="a-wean-feedrow" key={k}>
        <div><b>{`${FEED_ICONS[icon]} ${label}`}</b><small>{wt(`weaning_feed_${k}_sub` as WeaningKey)}</small></div>
        {isCount ? (
          <div className="a-wean-stepper" role="group" aria-label={label}>
            <button type="button" aria-label={wt('weaning_decrease')} disabled={feeds[k] <= 0} onClick={() => setFeeds({ [k]: Math.max(0, feeds[k] - 1) })}>−</button>
            <output aria-live="polite">{feeds[k]}</output>
            <button type="button" aria-label={wt('weaning_increase')} disabled={feeds[k] >= FEED_MAX[k]} onClick={() => setFeeds({ [k]: Math.min(FEED_MAX[k], feeds[k] + 1) })}>+</button>
          </div>
        ) : <Toggle pressed={feeds[k]} label={label} onToggle={() => setFeeds({ [k]: !feeds[k] })} />}
      </div>
    );
  };
  const make = () => {
    const plan = createPlan({ feeds, pace, nightMode, start, childId: ctx.childId });
    ctx.setPlan(plan);
    toast.success(wt(ctx.isPremium ? 'weaning_plan_created_premium' : 'weaning_plan_created_free'));
    ctx.go('hub', { reset: true });
  };
  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <h3>{wt('weaning_builder_q')}</h3>
        <p>{wt('weaning_builder_help')}</p>
        {row('morning', 'morning')}{row('day', 'day')}{row('nap', 'nap')}{row('bedtime', 'bedtime')}{row('night', 'night')}
      </div>
      <div className="a-wean-card">
        <div className="a-wean-lab">{wt('weaning_pace')}</div>
        <div className="a-wean-row">
          {PACES.map((p: Pace) => (
            <button key={p} type="button" className="a-wean-chip" aria-pressed={pace === p} onClick={() => ctx.update((s) => ({ ...s, pace: p }))}>
              {wt(`weaning_pace_${p}` as WeaningKey)}<small>{wt(`weaning_pace_${p}_sub` as WeaningKey)}</small>
            </button>
          ))}
        </div>
        <p className="a-wean-small">{wf('weaning_no_cold_turkey', { n: MIN_DAYS })}</p>
      </div>
      {feeds.night > 0 && (
        <div className="a-wean-card">
          <div className="a-wean-lab">{wt('weaning_night_title')}</div>
          <div className="a-wean-row">
            {(['last', 'separate'] as NightMode[]).map((m) => (
              <button key={m} type="button" className="a-wean-chip" aria-pressed={nightMode === m} onClick={() => ctx.update((s) => ({ ...s, nightMode: m }))}>
                {wt(m === 'last' ? 'weaning_night_last' : 'weaning_night_separate')}
              </button>
            ))}
          </div>
          <p className="a-wean-small">{wt('weaning_night_help')}</p>
        </div>
      )}
      {v.delay > 0 && (
        <div className="a-wean-card">
          <div className="a-wean-lab">{wt('weaning_start')}</div>
          <div className="a-wean-row">
            <button type="button" className="a-wean-chip" aria-pressed={startChoice === 'recommended'} onClick={() => setStartChoice('recommended')}>
              {wf('weaning_start_recommended', { date: ctx.fmt(addDays(ctx.today, v.delay)) })}
            </button>
            <button type="button" className="a-wean-chip" aria-pressed={startChoice === 'today'} onClick={() => setStartChoice('today')}>{wt('weaning_start_today')}</button>
          </div>
        </div>
      )}
      <div className="a-wean-card">
        <dl className="a-wean-kv">
          <dt>{wt('weaning_steps_count')}</dt><dd>{steps}</dd>
          <dt>{wt('weaning_duration')}</dt><dd>{wf('weaning_weeks', { n: planWeeks(feeds, nightMode, pace) })}</dd>
          <dt>{wt('weaning_start')}</dt><dd>{delay ? `${ctx.fmt(start)} ${wt('weaning_start_delay_note')}` : ctx.fmt(start)}</dd>
        </dl>
      </div>
      <button type="button" className="a-wean-btn" disabled={!steps} onClick={make}>{wt('weaning_make_plan')}</button>
    </div>
  );
}

// ── Plan hub ───────────────────────────────────────────────────────────────────────────────
function Ring({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0;
  return (
    <svg className="a-wean-ring" viewBox="0 0 84 84" role="img" aria-label={`${done}/${total}`}>
      <circle cx="42" cy="42" r="34" fill="none" stroke="var(--a-surface-soft)" strokeWidth="10" />
      <circle cx="42" cy="42" r="34" fill="none" stroke="var(--a-coral)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(2 * Math.PI * 34 * pct).toFixed(1)} 999`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--a-ink)">{`${done}/${total}`}</text>
    </svg>
  );
}

export function Timeline({ ctx, plan }: { ctx: WeaningCtx; plan: WeaningPlan }) {
  return (
    <div className="a-wean-tl" data-testid="weaning-timeline">
      {plan.steps.map((s, i) => {
        const st = stepState(s, ctx.today);
        return (
          <button type="button" key={s.id} className={`st ${st}`} onClick={() => ctx.go('step', { stepId: s.id })}>
            <span className="dot">{st === 'done' ? '✓' : i + 1}</span>
            <span className="body">
              <b>{stepTitle(s)}</b>
              <small>{`${ctx.fmt(s.start)} – ${ctx.fmt(addDays(s.start, s.len - 1))} · ${wf('weaning_days', { n: s.len })}`}{st === 'cur' && plan.status === 'active' ? ` · ${wt('weaning_now')}` : ''}</small>
            </span>
          </button>
        );
      })}
      {plan.nightMode === 'separate' && (
        <button type="button" className="st future" onClick={() => ctx.go('night')}>
          <span className="dot">🌙</span>
          <span className="body"><b>{wt('weaning_link_night')}</b><small>{wt('weaning_night_later_sub')}</small></span>
        </button>
      )}
    </div>
  );
}

export function HubScreen({ ctx }: { ctx: WeaningCtx }) {
  const plan = ctx.plan;
  if (!plan) return <IntroScreen ctx={ctx} />;
  const { today, isPremium } = ctx;
  const total = plan.steps.length;
  const dn = doneCount(plan);
  const s = currentStep(plan);
  const save = (next: WeaningPlan) => ctx.setPlan(next);

  const complete = () => {
    const next = completeCurrent(plan, today);
    save(next);
    const n = currentStep(next);
    toast.success(n ? wf('weaning_toast_next', { label: stepLabel(n), date: ctx.fmt(n.start) }) : wt('weaning_toast_all_done'));
  };
  const begin = () => {
    const next = startNow(plan, today);
    save(next);
    if (s) toast.success(wf('weaning_toast_started', { label: stepLabel(s) }));
  };
  const resume = () => {
    const { plan: next, shifted } = resumePlan(plan, today);
    save(next);
    toast.success(wt(shifted ? 'weaning_toast_resumed_dates' : 'weaning_toast_resumed'));
  };
  const togglePause = () => {
    if (plan.status === 'paused') return resume();
    save(pausePlan(plan, 'manual'));
    toast(wt('weaning_toast_paused'));
  };
  const sharePartner = () => {
    const step = s ?? plan.steps[plan.steps.length - 1];
    ctx.share(wt('weaning_partner_share_title'), `${stepLabel(step)}: ${wt(ftKey(step.type, '_swap'))}\n${partnerHint(step.type)}`);
  };
  const cancel = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(wt('weaning_cancel_confirm'))) return;
    save(cancelPlan(plan));
    toast(wt('weaning_toast_cancelled'));
    ctx.go('intro', { reset: true });
  };

  let todayCard: ReactNode;
  if (plan.status === 'paused') {
    const doctor = plan.pauseReason === 'doctor';
    todayCard = (
      <Alert tone={doctor ? 'red' : 'amber'} title={wt(doctor ? 'weaning_paused_doctor_title' : 'weaning_paused_manual_title')}>
        <span>{wt(doctor ? 'weaning_paused_doctor_text' : 'weaning_paused_manual_text')}</span>
        <button type="button" className="a-wean-btn ghost small" onClick={resume}>{wt(doctor ? 'weaning_resume_doctor' : 'weaning_resume')}</button>
      </Alert>
    );
  } else if (!s) {
    todayCard = (
      <Alert tone="mint" title={wt('weaning_all_done')}>
        <button type="button" className="a-wean-btn small" onClick={() => ctx.go('finish')}>{wt('weaning_finish_card_btn')}</button>
      </Alert>
    );
  } else if (stepState(s, today) === 'future') {
    const idx = currentStepIndex(plan);
    const prev = idx > 0 ? plan.steps[idx - 1] : null;
    todayCard = prev ? (
      <div className="a-wean-card">
        <span className="a-wean-pill is-mint">{`✓ ${stepLabel(prev)}`}</span>
        <h3>{wf('weaning_next', { label: stepTitle(s) })}</h3>
        <p>{isPremium ? wf('weaning_next_text', { date: ctx.fmt(s.start) }) : wt('weaning_next_text_free')}</p>
        {canStartNow(plan, today)
          ? <button type="button" className="a-wean-btn ghost small" onClick={begin}>{wt('weaning_start_now')}</button>
          : <p className="a-wean-small">{wf('weaning_earliest', { date: ctx.fmt(addDays(prev.start, MIN_DAYS)), n: MIN_DAYS })}</p>}
      </div>
    ) : (
      <div className="a-wean-card">
        {isPremium && <span className="a-wean-pill is-sky">{wf('weaning_starts_on', { date: ctx.fmt(s.start) })}</span>}
        <h3>{wf('weaning_starts_in', { n: daysBetween(today, s.start) })}</h3>
        <p>{wt('weaning_prepare')}</p>
      </div>
    );
  } else {
    const day = stepDay(s, today);
    const ready = canComplete(s, today);
    todayCard = (
      <div className="a-wean-card" data-testid="weaning-today">
        <span className="a-wean-pill is-coral">{wf('weaning_step_day', { day, len: s.len })}</span>
        <h3>{wf('weaning_replacing', { label: stepTitle(s) })}</h3>
        <p><b>{wt('weaning_swap_label')}</b>{` ${wt(ftKey(s.type, '_swap'))}`}</p>
        <div className="a-wean-row">
          <button type="button" className="a-wean-btn small" onClick={() => ctx.go('step', { stepId: s.id })}>{wt('weaning_how')}</button>
          <button type="button" className="a-wean-btn ghost small" disabled={!ready} onClick={complete}>{wt('weaning_complete')}</button>
        </div>
        {!ready && <p className="a-wean-small">{wf('weaning_complete_wait', { date: ctx.fmt(nextUnlockDay(s)) })}</p>}
      </div>
    );
  }

  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <div className="a-wean-row" style={{ gap: 14, flexWrap: 'nowrap' }}>
          <Ring done={dn} total={total} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b style={{ fontSize: 15 }}>{wt(plan.pace === 'gentle' ? 'weaning_plan_gentle' : 'weaning_plan_medium')}</b>
            {isPremium && <p>{`${ctx.fmt(plan.steps[0].start)} – ${ctx.fmt(planLastDay(plan))}`}</p>}
            {isPremium ? <span className="a-wean-pill is-sky">{`🔔 ${wt('weaning_reminders_on')}`}</span>
              : <span className="a-wean-pill is-prem">{`🔔 ${wt('weaning_reminders_premium')}`}</span>}
          </div>
        </div>
      </div>
      {todayCard}
      <button type="button" className="a-wean-btn ghost" onClick={() => ctx.go('checkin')}>{`📝 ${wt('weaning_checkin_btn')}`}<FreePill /></button>
      <div className="a-wean-sec">{wt('weaning_plan_section')}{!isPremium && <PremiumPill />}</div>
      {isPremium ? <Timeline ctx={ctx} plan={plan} /> : (
        <PremiumBlurGate feature="weaning_plan" title={wt('weaning_lock_title')} subtitle={wt('weaning_lock_text')} cta={wt('weaning_lock_cta')}>
          <Timeline ctx={ctx} plan={plan} />
        </PremiumBlurGate>
      )}
      <div className="a-wean-sec">{wt('weaning_guide_section')}<FreePill /></div>
      <div className="a-wean-tiles">
        <button type="button" className="a-wean-tile" onClick={() => ctx.go('nutrition')}><span className="ti">🥛</span>{wt('weaning_tile_nutrition')}</button>
        <button type="button" className="a-wean-tile" onClick={() => ctx.go('mother')}><span className="ti">💗</span>{wt('weaning_tile_mother')}</button>
        <button type="button" className="a-wean-tile" onClick={() => ctx.go('myths')}><span className="ti">🚫</span>{wt('weaning_tile_myths')}</button>
        <button type="button" className="a-wean-tile" onClick={() => ctx.go('night')}><span className="ti">🌙</span>{wt('weaning_tile_night')}</button>
        <button type="button" className="a-wean-tile" onClick={sharePartner}><span className="ti">👨</span>{wt('weaning_tile_partner')}</button>
        {plan.status !== 'finished' && (
          <button type="button" className="a-wean-tile" onClick={togglePause}>
            <span className="ti">{plan.status === 'paused' ? '▶️' : '⏸️'}</span>{wt(plan.status === 'paused' ? 'weaning_resume' : 'weaning_tile_pause')}
          </button>
        )}
      </div>
      {plan.status !== 'finished' && <button type="button" className="a-wean-btn ghost small" onClick={cancel}>{wt('weaning_cancel_plan')}</button>}
      <p className="a-wean-small">{wt('weaning_disclaimer')}</p>
    </div>
  );
}

// ── Step detail ────────────────────────────────────────────────────────────────────────────
export function StepScreen({ ctx }: { ctx: WeaningCtx }) {
  const plan = ctx.plan;
  const s = (plan && (plan.steps.find((x) => x.id === ctx.stepId) || currentStep(plan))) || null;
  if (!plan || !s) return <HubScreen ctx={ctx} />;
  const extend = () => {
    ctx.setPlan(extendStep(plan, s.id, EXTEND_STEP_DAYS));
    toast.success(wt('weaning_toast_extended'));
  };
  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <h3>{`${FEED_ICONS[s.type]} ${wt('weaning_swap_title')}`}</h3>
        <p>{wt(ftKey(s.type, '_swap'))}</p>
      </div>
      <div className="a-wean-card">
        <h3>{wt('weaning_how_title')}</h3>
        <ul className="a-wean-list">
          {[1, 2, 3].map((i) => <li key={i}><span className="ic">•</span><span>{wt(ftKey(s.type, `_tip${i}`))}</span></li>)}
          <li><span className="ic">🤲</span><span>{wt('weaning_first_days')}</span></li>
        </ul>
      </div>
      <div className="a-wean-card">
        <h3>{wt('weaning_cries_title')}</h3>
        <ul className="a-wean-list">
          {[1, 2, 3].map((i) => <li key={i}><span className="ic">{i}</span><span>{wt(`weaning_cries_${i}` as WeaningKey)}</span></li>)}
        </ul>
      </div>
      <div className="a-wean-card">
        <h3>{`👨 ${wt('weaning_partner_title')}`}</h3>
        <p>{partnerHint(s.type)}</p>
        <button type="button" className="a-wean-btn ghost small"
          onClick={() => ctx.share(wt('weaning_partner_share_title'), `${stepLabel(s)}: ${wt(ftKey(s.type, '_swap'))}\n${partnerHint(s.type)}`)}>
          {wt('weaning_partner_send')}
        </button>
      </div>
      {s.status !== 'done' && plan.status !== 'finished' && (
        <button type="button" className="a-wean-btn ghost small" onClick={extend}>{wt('weaning_extend')}</button>
      )}
    </div>
  );
}

// ── Daily check-in ─────────────────────────────────────────────────────────────────────────
export function CheckinScreen({ ctx }: { ctx: WeaningCtx }) {
  const [c, setC] = useState<CheckinAnswers>(EMPTY_CHECKIN);
  const set = <K extends keyof CheckinAnswers>(k: K, v: CheckinAnswers[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const opt = <K extends 'diapers' | 'fullness' | 'motherMood'>(k: K, items: [NonNullable<CheckinAnswers[K]>, WeaningKey][]) => (
    <div className="a-wean-row">
      {items.map(([v, l]) => <button key={String(v)} type="button" className="a-wean-chip" aria-pressed={c[k] === v} onClick={() => set(k, v)}>{wt(l)}</button>)}
    </div>
  );
  const tg = (k: 'childSick' | 'lump' | 'red' | 'fever', l: WeaningKey) => (
    <div className="a-wean-feedrow"><span>{wt(l)}</span><Toggle pressed={c[k]} label={wt(l)} onToggle={() => set(k, !c[k])} /></div>
  );
  const submit = () => {
    const res = evaluateCheckin(c);
    const plan = ctx.plan && (ctx.plan.status === 'active' || ctx.plan.status === 'paused') ? ctx.plan : null;
    const stored = makeCheckin(c, res, ctx.plan?.id ?? null);
    const nextPlan = plan ? applyCheckin(plan, res) : null;
    ctx.update((s) => ({
      ...s, checkins: [stored, ...s.checkins], lastResult: res,
      ...(nextPlan && nextPlan !== plan ? { plan: nextPlan, planDirty: true } : {}),
    }));
    ctx.go('result');
  };
  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <div className="a-wean-lab">{`👧 ${wf('weaning_ci_child', { name: ctx.childName })}`}</div>
        <div className="a-wean-emo">
          {([['happy', '😊', 'weaning_ci_mood_happy'], ['ok', '🙂', 'weaning_ci_mood_ok'], ['sad', '😢', 'weaning_ci_mood_sad']] as const).map(([v, e, l]) => (
            <button key={v} type="button" aria-pressed={c.childMood === v} aria-label={wt(l)} onClick={() => set('childMood', v)}>{e}</button>
          ))}
        </div>
        <div className="a-wean-lab">{wt('weaning_ci_diapers')}</div>
        {opt('diapers', [['ok', 'weaning_ci_diapers_ok'], ['few', 'weaning_ci_diapers_few']])}
        {tg('childSick', 'weaning_ci_sick')}
      </div>
      <div className="a-wean-card">
        <div className="a-wean-lab">{`🤱 ${wt('weaning_ci_breasts')}`}</div>
        {opt('fullness', [['none', 'weaning_ci_full_none'], ['some', 'weaning_ci_full_some'], ['much', 'weaning_ci_full_much']])}
        {tg('lump', 'weaning_ci_lump')}{tg('red', 'weaning_ci_red')}{tg('fever', 'weaning_ci_fever')}
      </div>
      <div className="a-wean-card">
        <div className="a-wean-lab">{`💗 ${wt('weaning_ci_mother')}`}</div>
        {opt('motherMood', [['good', 'weaning_ci_mother_good'], ['mixed', 'weaning_ci_mother_mixed'], ['low', 'weaning_ci_mother_low']])}
      </div>
      <button type="button" className="a-wean-btn" disabled={!checkinComplete(c)} onClick={submit}>{wt('weaning_ci_save')}</button>
      <p className="a-wean-small">{wt('weaning_ci_note')}</p>
    </div>
  );
}

export function ResultScreen({ ctx }: { ctx: WeaningCtx }) {
  const r = ctx.local.lastResult;
  if (!r) return <CheckinScreen ctx={ctx} />;
  const plan = ctx.plan;
  return (
    <div className="a-wean">
      <Alert tone={r.tone} title={wt(r.title)}>
        <ul className="a-wean-list">
          {r.items.map((k) => <li key={k}><span>•</span><span>{fillEmergencyNumber(wt(k), ctx.emergency)}</span></li>)}
        </ul>
      </Alert>
      {r.emergency && <a className="a-wean-call" href={`tel:${ctx.emergency}`}><Phone size={15} />{wf('weaning_call_emergency', { emergency: ctx.emergency })}</a>}
      {plan && (r.action === 'extend' || r.action === 'slow') && (
        <div className="a-wean-card"><h3>{wt('weaning_res_updated_title')}</h3><p>{wt('weaning_res_updated_text')}</p></div>
      )}
      {plan && r.action === 'offerPause' && plan.status === 'active' && (
        <button type="button" className="a-wean-btn ghost" onClick={() => { ctx.setPlan(pausePlan(plan, 'manual')); toast(wt('weaning_toast_paused')); ctx.go('hub', { reset: true }); }}>
          {wt('weaning_res_pause_btn')}
        </button>
      )}
      {r.moodLink && <button type="button" className="a-wean-btn ghost" onClick={() => ctx.openTool('mood-diary')}>{wt('weaning_res_mood_btn')}</button>}
      <button type="button" className="a-wean-btn" onClick={() => ctx.go(plan ? 'hub' : 'intro', { reset: true })}>{wt(plan ? 'weaning_back_to_plan' : 'weaning_back_to_guide')}</button>
    </div>
  );
}

// ── Guides ─────────────────────────────────────────────────────────────────────────────────
export function NutritionScreen({ ctx }: { ctx: WeaningCtx }) {
  const allergy = ctx.local.readiness.allergy === true;
  const cups = ctx.local.cups.date === ctx.today ? ctx.local.cups.n : 0;
  const ml = cups * CUP_ML;
  const status = milkStatus(cups);
  const setCups = (n: number) => ctx.update((s) => ({ ...s, cups: { date: ctx.today, n: Math.max(0, Math.min(MAX_CUPS, n)) } }));
  const tone: Tone = status === 'over' ? 'red' : status === 'good' ? 'mint' : 'sky';
  return (
    <div className="a-wean">
      {allergy ? (
        <Alert tone="amber" title={wt('weaning_nut_allergy_title')}><span>{wt('weaning_nut_allergy_text')}</span></Alert>
      ) : <>
        <div className="a-wean-card" data-testid="weaning-cow-milk">
          <h3>{wt('weaning_nut_milk_title')}</h3>
          <p>{wt('weaning_nut_milk_text')}</p>
        </div>
        <div className="a-wean-card">
          <div className="a-wean-row" style={{ justifyContent: 'space-between' }}>
            <h3>{wf('weaning_nut_today', { ml })}</h3>
            <span className={`a-wean-pill is-${tone}`}>{wt(`weaning_nut_status_${status}` as WeaningKey)}</span>
          </div>
          <div className="a-wean-cups" aria-hidden="true">
            {Array.from({ length: MAX_CUPS }, (_, i) => <span key={i} className={`a-wean-cup${i < cups ? ' full' : ''}${i < cups && (i + 1) * CUP_ML > MILK_MAX_ML ? ' over' : ''}`} />)}
          </div>
          <div className="a-wean-row">
            <button type="button" className="a-wean-btn ghost small" disabled={cups <= 0} onClick={() => setCups(cups - 1)}>{wt('weaning_nut_cup_minus')}</button>
            <button type="button" className="a-wean-btn small" disabled={cups >= MAX_CUPS} onClick={() => setCups(cups + 1)}>{wt('weaning_nut_cup_plus')}</button>
          </div>
          {status === 'over' && <Alert tone="red" title={wt('weaning_nut_status_over')}><span>{wt('weaning_nut_over_warn')}</span></Alert>}
          <p className="a-wean-small">{wt('weaning_nut_target')}</p>
        </div>
      </>}
      <div className="a-wean-card">
        <h3>{wt('weaning_nut_iron_title')}</h3>
        <ul className="a-wean-list">
          {(['🥩', '🫘', '🥣', '💧'] as const).map((ic, i) => <li key={ic}><span className="ic">{ic}</span><span>{wt(`weaning_nut_iron_${i + 1}` as WeaningKey)}</span></li>)}
        </ul>
        <button type="button" className="a-wean-btn ghost small" onClick={() => ctx.openTool('solid-food-guide')}>
          {wt('weaning_nut_solid_btn')}{!ctx.isPremium && <PremiumPill />}
        </button>
      </div>
      <p className="a-wean-small">{wt('weaning_disclaimer')}</p>
    </div>
  );
}

export function MotherScreen({ ctx }: { ctx: WeaningCtx }) {
  return (
    <div className="a-wean">
      <div className="a-wean-card">
        <h3>{wt('weaning_mother_body_title')}</h3>
        <ul className="a-wean-list">
          {[1, 2, 3].map((i) => <li key={i}><span className="ic">{i}</span><span>{wt(`weaning_mother_body_${i}` as WeaningKey)}</span></li>)}
        </ul>
      </div>
      <div className="a-wean-card">
        <h3>{wt('weaning_mother_feel_title')}</h3>
        <p>{wt('weaning_mother_feel_text')}</p>
        <button type="button" className="a-wean-btn ghost small" onClick={() => ctx.openTool('mood-diary')}>{wt('weaning_mother_mood_btn')}<FreePill /></button>
      </div>
      <Alert tone="red" title={wt('weaning_mother_doctor_title')}>
        <span>{fillEmergencyNumber(wt('weaning_mother_doctor_text'), ctx.emergency)}</span>
        <a className="a-wean-call" href={`tel:${ctx.emergency}`}><Phone size={15} />{wf('weaning_call_emergency', { emergency: ctx.emergency })}</a>
      </Alert>
      <div className="a-wean-card">
        <h3>{wt('weaning_mother_bind_title')}</h3>
        <p>{wt('weaning_mother_bind_text')}</p>
      </div>
      <p className="a-wean-small">{wt('weaning_disclaimer')}</p>
    </div>
  );
}

const MYTH_COUNT = 7;
export function MythsScreen({ ctx }: { ctx: WeaningCtx }) {
  const myths = Array.from({ length: MYTH_COUNT }, (_, i) => [wt(`weaning_myth_${i + 1}` as WeaningKey), wt(`weaning_myth_${i + 1}_fact` as WeaningKey)] as const);
  return (
    <div className="a-wean">
      <p className="a-wean-small">{wt('weaning_myths_intro')}</p>
      {myths.map(([m, f], i) => (
        <div className="a-wean-myth" key={i} data-testid="weaning-myth">
          <div className="m"><span>🚫</span>{m}</div>
          <div className="f">{f}</div>
        </div>
      ))}
      <button type="button" className="a-wean-btn ghost"
        onClick={() => ctx.share(wt('weaning_myths_title'), myths.map(([m, f]) => `🚫 ${m}\n${f}`).join('\n\n'))}>
        {wt('weaning_myths_share')}
      </button>
    </div>
  );
}

export function NightScreen({ ctx }: { ctx: WeaningCtx }) {
  return (
    <div className="a-wean">
      <div className="a-wean-card"><h3>{wt('weaning_night_sep_title')}</h3><p>{wt('weaning_night_sep_text')}</p></div>
      <div className="a-wean-card">
        <h3>{wt('weaning_night_stages_title')}</h3>
        <ul className="a-wean-list">
          {[1, 2, 3].map((i) => (
            <li key={i}><span className="ic">{i}</span>
              <span><b>{wt(`weaning_night_stage${i}_title` as WeaningKey)}</b>{` ${wt(`weaning_night_stage${i}_text` as WeaningKey)}`}</span></li>
          ))}
        </ul>
      </div>
      <Alert tone="amber" title={wt('weaning_night_nocry_title')}><span>{wt('weaning_night_nocry_text')}</span></Alert>
      <button type="button" className="a-wean-btn ghost small" onClick={() => ctx.openTool('sleep-training')}>{wt('weaning_night_sleep_btn')}</button>
    </div>
  );
}

export function FinishScreen({ ctx }: { ctx: WeaningCtx }) {
  const plan = ctx.plan;
  const from = plan ? plan.steps[0].start : ctx.today;
  const to = plan && plan.status === 'finished' ? isoDay(new Date(plan.updatedAt)) : ctx.today;
  const heroKey: WeaningKey = ctx.childGender === 'girl' ? 'weaning_finish_hero_girl' : ctx.childGender === 'boy' ? 'weaning_finish_hero_boy' : 'weaning_finish_hero_other';
  return (
    <div className="a-wean">
      <div className="a-wean-hero">
        <h2>{wf(heroKey, { name: ctx.childName })}</h2>
        <p>{wf('weaning_finish_range', { from: ctx.fmt(from), to: ctx.fmt(to) })}</p>
      </div>
      <div className="a-wean-card">
        <h3>{wt('weaning_finish_memory_title')}</h3>
        <p>{wt('weaning_finish_memory_text')}</p>
        <button type="button" className="a-wean-btn small" onClick={() => ctx.openTool('baby-album')}>{wt('weaning_finish_album_btn')}</button>
      </div>
      <div className="a-wean-card"><h3>{wt('weaning_finish_next_title')}</h3><p>{wt('weaning_finish_next_text')}</p></div>
      <div className="a-wean-card"><h3>{wt('weaning_finish_relact_title')}</h3><p>{wt('weaning_finish_relact_text')}</p></div>
    </div>
  );
}
