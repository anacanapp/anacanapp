import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToolPage, ToolHeader } from '@/components/tools/anacan/ToolKit';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useSubscription } from '@/hooks/useSubscription';
import { useEmergencyNumber } from '@/hooks/useEmergencyNumber';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { pushBackHandler } from '@/lib/backButton';
import { resetAppScrollPosition } from '@/lib/scroll';
import { getLocaleTag } from '@/lib/i18n';
import { nativeShare } from '@/lib/native';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import { ageInMonths, isoDay, parseDay } from '@/lib/weaning';
import { stepLabel, wf, wt } from '@/lib/weaning-copy';
import { syncWeaningReminders } from '@/lib/weaning-reminders';
import { useWeaningState } from './useWeaningState';
import {
  type Screen, type WeaningCtx, BuilderScreen, CheckinScreen, FinishScreen, HubScreen, IntroScreen, MotherScreen, MythsScreen,
  NightScreen, NutritionScreen, ReadyScreen, ResultScreen, StepScreen,
} from './WeaningScreens';

/**
 * Süddən ayırma — gradual weaning for children 12+ months (Ana module, tile from 9 months).
 * Free: intro, readiness, check-in + red flags, all guides. Premium: the personal plan calendar and reminders.
 */
interface Props {
  onBack: () => void;
  /** Test hook: fixed "now". */
  now?: Date;
}

const HEADERS: Record<Exclude<Screen, 'hub' | 'step'>, [Parameters<typeof wt>[0], Parameters<typeof wt>[0]]> = {
  intro: ['weaning_intro_eyebrow', 'weaning_tool_name'],
  ready: ['weaning_ready_eyebrow', 'weaning_ready_title'],
  builder: ['weaning_builder_eyebrow', 'weaning_builder_title'],
  checkin: ['weaning_checkin_eyebrow', 'weaning_checkin_title'],
  result: ['weaning_result_eyebrow', 'weaning_result_title'],
  nutrition: ['weaning_guide_eyebrow', 'weaning_nut_title'],
  mother: ['weaning_guide_eyebrow', 'weaning_mother_title'],
  myths: ['weaning_guide_eyebrow', 'weaning_myths_title'],
  night: ['weaning_night_eyebrow', 'weaning_night_module_title'],
  finish: ['weaning_finish_eyebrow', 'weaning_finish_title'],
};

export default function WeaningTool({ onBack, now }: Props) {
  useScreenAnalytics('Weaning', 'Tools');
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const emergency = useEmergencyNumber();
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  const childId = child?.id ?? null;
  const uid = user?.id ?? null;
  const { state, update, setPlan, online, pending } = useWeaningState(uid, childId);

  const nowDate = useMemo(() => now ?? new Date(), [now]);
  const today = isoDay(nowDate);
  const ageMonths = ageInMonths(child?.birth_date, nowDate);
  const plan = state.plan && (state.plan.childId ?? null) === childId && state.plan.status !== 'cancelled' ? state.plan : null;

  const [stack, setStack] = useState<Screen[]>([]);
  const [stepId, setStepId] = useState<string | null>(null);
  const root: Screen = plan ? 'hub' : 'intro';
  const screen: Screen = stack.length ? stack[stack.length - 1] : root;

  const go = useCallback((to: Screen, opts?: { stepId?: string; reset?: boolean }) => {
    if (opts?.stepId) setStepId(opts.stepId);
    setStack((prev) => (opts?.reset ? (to === 'hub' || to === 'intro' ? [] : [to]) : [...prev, to]));
    resetAppScrollPosition();
  }, []);
  const back = useCallback(() => {
    if (stack.length) setStack((prev) => prev.slice(0, -1));
    else onBack();
  }, [stack.length, onBack]);

  // Android back: inner screens first, then the tool closes (ToolsHub's own handler).
  useEffect(() => {
    if (!stack.length) return;
    return pushBackHandler(() => { setStack((prev) => prev.slice(0, -1)); return true; });
  }, [stack.length]);

  // Premium reminders on this phone: 09:00 on each upcoming step's first day.
  const reminderKey = plan ? `${plan.id}:${plan.updatedAt}:${plan.status}` : 'none';
  useEffect(() => {
    void syncWeaningReminders(plan, isPremium, {
      title: wt('weaning_reminder_title'),
      body: (step) => wf('weaning_reminder_body', { label: stepLabel(step) }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey, isPremium]);

  const fmt = useCallback((day: string) => {
    try { return parseDay(day).toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long' }); } catch { return day; }
  }, []);

  const ctx: WeaningCtx = {
    today, isPremium, childName: child?.name || wt('weaning_child_fallback'), childGender: child?.gender, childId, ageMonths, emergency,
    local: state, plan, stepId, go, update, setPlan, fmt,
    openTool: (toolId) => window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { tool: toolId } })),
    share: (title, text) => { void nativeShare({ title, text }); },
  };

  let eyebrow: string;
  let title: string;
  if (screen === 'hub') {
    eyebrow = ageMonths === null ? ctx.childName : `${ctx.childName} · ${wf('weaning_age_months', { n: ageMonths })}`;
    title = wt('weaning_tool_name');
  } else if (screen === 'step') {
    const idx = plan ? Math.max(0, plan.steps.findIndex((s) => s.id === stepId)) : 0;
    eyebrow = plan ? wf('weaning_step_of', { n: idx + 1, total: plan.steps.length }) : '';
    title = plan ? stepLabel(plan.steps[idx]) : wt('weaning_tool_name');
  } else {
    [eyebrow, title] = HEADERS[screen].map((k) => wt(k));
  }

  const body = (() => {
    switch (screen) {
      case 'intro': return <IntroScreen ctx={ctx} />;
      case 'ready': return <ReadyScreen ctx={ctx} />;
      case 'builder': return <BuilderScreen ctx={ctx} />;
      case 'hub': return <HubScreen ctx={ctx} />;
      case 'step': return <StepScreen ctx={ctx} />;
      case 'checkin': return <CheckinScreen ctx={ctx} />;
      case 'result': return <ResultScreen ctx={ctx} />;
      case 'nutrition': return <NutritionScreen ctx={ctx} />;
      case 'mother': return <MotherScreen ctx={ctx} />;
      case 'myths': return <MythsScreen ctx={ctx} />;
      case 'night': return <NightScreen ctx={ctx} />;
      case 'finish': return <FinishScreen ctx={ctx} />;
      default: return null;
    }
  })();

  return (
    <ToolPage>
      <ToolHeader title={title} eyebrow={eyebrow} onBack={back} />
      {pending && !online && <p className="a-wean-small" role="status" style={{ marginBottom: 10 }}>{wt('weaning_offline')}</p>}
      {body}
    </ToolPage>
  );
}
