/**
 * In-app onboarding tour (Glass guided tour after the first full app open).
 * Pure rules only: who sees the tour, which steps they get and when push permission is asked.
 * UI: src/components/onboarding/GlassTour.tsx. Plan and prototype: docs/INAPP_ONBOARDING_JOURNEY.md.
 */
import { isToolFree } from '@/lib/freemium';

export const TOUR_VERSION = 1;
/** Fired after the tour's push permission request is granted; useDeviceToken registers the device. */
export const PUSH_GRANTED_EVENT = 'anacan:push-granted';
/** Admin-only preview (Admin → Tənzimləmələr → "Turu sınaqla"): runs the tour ignoring eligibility, writes nothing. detail: { premium: boolean } */
export const TOUR_PREVIEW_EVENT = 'anacan:tour-preview';
export interface TourPreviewDetail { premium: boolean }
// The admin panel replaces the main screen, so the tour host is not mounted when the button is pressed:
// the request is kept here and picked up when the host mounts (or live through the event if it is mounted).
let pendingPreview: TourPreviewDetail | null = null;
export function requestTourPreview(premium: boolean) {
  pendingPreview = { premium };
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<TourPreviewDetail>(TOUR_PREVIEW_EVENT, { detail: { premium } }));
}
export function takePendingTourPreview(): TourPreviewDetail | null {
  const p = pendingPreview; pendingPreview = null; return p;
}
export const TOUR_MAX_ACCOUNT_AGE_DAYS = 14;
export type TourStage = 'mommy' | 'bump' | 'flow';
/** Push permission as the OS reports it; 'unsupported' = web / no messaging plugin. */
export type TourPush = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type TourTab = 'home' | 'tools' | 'ai' | 'community';
export interface TourNav { tab: TourTab; tool?: string | null }

export interface TourTool { id: string; name: string; description?: string | null; open: boolean }
export interface TourInput { stage: TourStage; isPremium: boolean; push: TourPush; tools: TourTool[] }

export type TourSubKind = 'card' | 'spot' | 'coach' | 'push';
export interface TourSub {
  kind: TourSubKind;
  /** Screen the app must show for this sub-step. */
  nav: TourNav;
  /** data-tour target to highlight (spot only). Tapping it advances the tour. */
  target?: string;
  /** Copy id inside GlassTour, or a tool id for tool pages. */
  copy: string;
  toolId?: string;
}
export type TourStepId = 'welcome' | 'mood' | 'tools' | 'ai' | 'premium' | 'final';
export interface TourStep { id: TourStepId; subs: TourSub[] }

/** Same rule as the Tools page: free only when no DB flag, stage lock or freemium rule gates it. */
export function isToolOpenForUser(config: { tool_id: string; is_premium?: boolean | null }, stageLocked: boolean, isPremium: boolean): boolean {
  if (isPremium) return true;
  return !config.is_premium && !stageLocked && isToolFree(config.tool_id);
}

/** Ask for push only when the OS can still show its permission dialog. */
export const shouldAskPush = (push: TourPush) => push === 'prompt';

const FEATURED: Record<TourStage, { free: string[]; premium: string[] }> = {
  mommy: { free: ['vaccine-calendar', 'danger-signs', 'baby-album', 'doctors', 'blog'], premium: ['baby-growth', 'growth-tracker', 'teething', 'vaccine-calendar', 'doctors'] },
  bump: { free: ['hospital', 'pregnancy-album', 'danger-signs', 'doctors', 'blog'], premium: ['kick', 'contraction', 'weight', 'fetal-growth', 'hospital'] },
  flow: { free: ['doctors', 'blog'], premium: ['vitamin-tracker', 'recipes', 'nutrition', 'doctors'] },
};
export const MOOD_TOOL = 'mood';

/** The steps this user gets. Premium users get no Premium step; push is asked at most once. */
export function buildTourPlan(input: TourInput): TourStep[] {
  const open = new Map(input.tools.filter((t) => t.open).map((t) => [t.id, t]));
  const steps: TourStep[] = [{ id: 'welcome', subs: [{ kind: 'card', nav: { tab: 'home' }, copy: 'welcome' }] }];
  let pushPlaced = false;
  const pushSub = (nav: TourNav): TourSub[] => {
    if (pushPlaced || !shouldAskPush(input.push)) return [];
    pushPlaced = true;
    return [{ kind: 'push', nav, copy: 'push' }];
  };

  if (open.has(MOOD_TOOL)) {
    const moodNav: TourNav = { tab: 'tools', tool: MOOD_TOOL };
    steps.push({ id: 'mood', subs: [
      { kind: 'spot', nav: { tab: 'home' }, target: 'tab-tools', copy: 'mood_tab' },
      { kind: 'spot', nav: { tab: 'tools', tool: null }, target: `tool-${MOOD_TOOL}`, copy: 'mood_tile' },
      { kind: 'coach', nav: moodNav, copy: 'mood_log', toolId: MOOD_TOOL },
      ...pushSub(moodNav),
    ] });
  }

  const featured = FEATURED[input.stage][input.isPremium ? 'premium' : 'free'].filter((id) => open.has(id) && id !== MOOD_TOOL).slice(0, 2);
  const toolsSubs: TourSub[] = [];
  if (!steps.some((s) => s.id === 'mood')) toolsSubs.push({ kind: 'spot', nav: { tab: 'home' }, target: 'tab-tools', copy: 'tools_tab' });
  toolsSubs.push({ kind: 'spot', nav: { tab: 'tools', tool: null }, target: input.isPremium ? 'tools-premium' : 'tools-free', copy: input.isPremium ? 'tools_list_premium' : 'tools_list_free' });
  for (const id of featured) toolsSubs.push({ kind: 'coach', nav: { tab: 'tools', tool: id }, copy: 'tool_page', toolId: id });
  steps.push({ id: 'tools', subs: toolsSubs });

  steps.push({ id: 'ai', subs: [
    { kind: 'spot', nav: { tab: 'tools', tool: null }, target: 'tab-ai', copy: 'ai_tab' },
    { kind: 'coach', nav: { tab: 'ai' }, copy: input.isPremium ? 'ai_screen_premium' : 'ai_screen_free' },
    { kind: 'spot', nav: { tab: 'ai' }, target: 'tab-community', copy: 'community_tab' },
    { kind: 'coach', nav: { tab: 'community' }, copy: 'community_screen' },
    ...pushSub({ tab: 'community' }),
  ] });

  if (!input.isPremium) steps.push({ id: 'premium', subs: [{ kind: 'card', nav: { tab: 'home' }, copy: 'premium' }] });
  steps.push({ id: 'final', subs: [{ kind: 'card', nav: { tab: 'home' }, copy: 'final' }] });
  return steps;
}

/** Visible step count (welcome and final cards are not counted as steps). */
export const countedSteps = (plan: TourStep[]) => plan.filter((s) => s.id !== 'welcome' && s.id !== 'final').length;

export interface TourEligibilityInput {
  setting: unknown;
  since: unknown;
  accountCreatedAt: string | null | undefined;
  journey: unknown;
  role: string | null | undefined;
  lifeStage: string | null | undefined;
  lossRecoveryActive: boolean | null | undefined;
  onboarded: boolean;
  now?: number;
}

/** Who sees the tour: switched on, new account (after `since`, younger than 14 days), never seen it, not a partner, not in loss mode. */
export function isTourEligible(i: TourEligibilityInput): boolean {
  if (i.setting !== 'on') return false;
  if (i.journey !== null && i.journey !== undefined) return false;
  if (!i.onboarded || i.role === 'partner' || i.lossRecoveryActive) return false;
  if (i.lifeStage !== 'mommy' && i.lifeStage !== 'bump' && i.lifeStage !== 'flow') return false;
  const created = Date.parse(String(i.accountCreatedAt || ''));
  const since = Date.parse(String(i.since || ''));
  if (!Number.isFinite(created) || !Number.isFinite(since) || created < since) return false;
  return (i.now ?? Date.now()) - created < TOUR_MAX_ACCOUNT_AGE_DAYS * 86400_000;
}

/** Accounts younger than a day: the funnel and the tour own the first push prompt, not the daily auto-prompt. */
export const isNewAccount = (createdAt: string | null | undefined, now = Date.now()) => {
  const created = Date.parse(String(createdAt || ''));
  return Number.isFinite(created) && now - created < 86400_000;
};
