// Native store review (SKStoreReviewController on iOS, Play In-App Review on Android) at positive
// moments only: a baby milestone just marked, a new pregnancy week viewed, and day 7+ of use.
//
// Never asked while: the remote switch is off (default — stays off until the crash fix ships), the
// native build is below min_build_<platform>, this device had an app crash in the last 7 days, the
// user is in pregnancy-loss recovery, fewer than 3 sessions, inside the cooldown, or 3 times in the
// last 365 days. The OS decides whether the sheet actually appears; there is no custom pre-prompt
// (Apple guideline 5.6.1) and no star filtering.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export type ReviewMoment = 'milestone' | 'pregnancy_week' | 'day7';

export interface ReviewConfig { enabled: boolean; min_build_ios: number | null; min_build_android: number | null; cooldown_days: number }
export const DISABLED_CONFIG: ReviewConfig = { enabled: false, min_build_ios: null, min_build_android: null, cooldown_days: 60 };

const K = {
  firstOpen: 'anacan.review.firstOpenAt',
  sessions: 'anacan.review.sessions',
  asked: 'anacan.review.askedAt',
  lastCrash: 'anacan.review.lastCrashAt',
  weekSeen: 'anacan.review.lastPregnancyWeek'
} as const;

const DAY = 86_400_000;
const read = (k: string) => {try {return localStorage.getItem(k);} catch {return null;}};
const write = (k: string, v: string) => {try {localStorage.setItem(k, v);} catch {/* optional */}};

export function parseReviewConfig(raw: unknown): ReviewConfig {
  let v = raw;
  if (typeof v === 'string') {try {v = JSON.parse(v);} catch {return DISABLED_CONFIG;}}
  if (!v || typeof v !== 'object') return DISABLED_CONFIG;
  const o = v as Record<string, unknown>;
  const build = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : null;
  const cooldown = typeof o.cooldown_days === 'number' && o.cooldown_days >= 14 ? o.cooldown_days : 60;
  return { enabled: o.enabled === true, min_build_ios: build(o.min_build_ios), min_build_android: build(o.min_build_android), cooldown_days: cooldown };
}

/** Called once per app start: counts sessions and remembers the first open. */
export function trackReviewSession(): void {
  if (!read(K.firstOpen)) write(K.firstOpen, String(Date.now()));
  write(K.sessions, String((Number(read(K.sessions)) || 0) + 1));
}

/** Called by the crash reporter for real app crashes (not network/push noise). */
export function noteAppCrash(): void {
  write(K.lastCrash, String(Date.now()));
}

export interface ReviewState {
  now: number;
  platform: string;
  build: number | null;
  firstUseAt: number | null;
  sessions: number;
  askedAt: number[];
  lastCrashAt: number | null;
  lossRecovery: boolean;
}

export type ReviewDecision = { ok: true } | { ok: false; reason: string };

/** Pure eligibility check (tested). */
export function reviewDecision(moment: ReviewMoment, config: ReviewConfig, s: ReviewState): ReviewDecision {
  if (s.platform !== 'ios' && s.platform !== 'android') return { ok: false, reason: 'web' };
  if (!config.enabled) return { ok: false, reason: 'disabled' };
  const min = s.platform === 'ios' ? config.min_build_ios : config.min_build_android;
  if (min != null && (s.build == null || s.build < min)) return { ok: false, reason: 'old_build' };
  if (s.lastCrashAt && s.now - s.lastCrashAt < 7 * DAY) return { ok: false, reason: 'recent_crash' };
  if (s.lossRecovery) return { ok: false, reason: 'sensitive' };
  if (s.sessions < 3) return { ok: false, reason: 'new_user' };
  const age = s.firstUseAt ? (s.now - s.firstUseAt) / DAY : 0;
  if (moment === 'day7' && age < 7) return { ok: false, reason: 'before_day7' };
  if (moment !== 'day7' && age < 2) return { ok: false, reason: 'too_early' };
  const last = Math.max(0, ...s.askedAt);
  if (last && s.now - last < config.cooldown_days * DAY) return { ok: false, reason: 'cooldown' };
  if (s.askedAt.filter((t) => s.now - t < 365 * DAY).length >= 3) return { ok: false, reason: 'yearly_cap' };
  return { ok: true };
}

let configCache: { at: number; value: ReviewConfig } | null = null;
async function loadConfig(): Promise<ReviewConfig> {
  if (configCache && Date.now() - configCache.at < 10 * 60_000) return configCache.value;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC newer than the generated types
    const { data, error } = await (supabase.rpc as any)('get_review_prompt_config_v1');
    const value = error ? DISABLED_CONFIG : parseReviewConfig(data);
    configCache = { at: Date.now(), value };
    return value;
  } catch {
    return DISABLED_CONFIG;
  }
}

async function nativeBuild(): Promise<number | null> {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    const n = Number(info.build);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

let inFlight = false;

/**
 * Ask the OS for a review if this moment qualifies. Waits `delayMs` so the positive UI (toast,
 * animation) is seen first. Never throws, never shows any custom UI.
 */
export async function maybeRequestReview(moment: ReviewMoment, o: { userId?: string | null; accountCreatedAt?: string | null; lossRecovery?: boolean; delayMs?: number } = {}): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || inFlight) return false;
  inFlight = true;
  try {
    const config = await loadConfig();
    const firstOpen = Number(read(K.firstOpen)) || null;
    const created = o.accountCreatedAt ? Date.parse(o.accountCreatedAt) : NaN;
    const firstUseAt = [firstOpen, Number.isNaN(created) ? null : created].filter((x): x is number => !!x).reduce((a, b) => Math.min(a, b), Infinity);
    let asked: number[] = [];
    try {asked = JSON.parse(read(K.asked) || '[]');} catch {asked = [];}
    const decision = reviewDecision(moment, config, {
      now: Date.now(), platform: Capacitor.getPlatform(), build: await nativeBuild(),
      firstUseAt: Number.isFinite(firstUseAt) ? firstUseAt : null, sessions: Number(read(K.sessions)) || 0,
      askedAt: Array.isArray(asked) ? asked.filter((x) => typeof x === 'number') : [],
      lastCrashAt: Number(read(K.lastCrash)) || null, lossRecovery: !!o.lossRecovery
    });
    if (!decision.ok) return false;
    await new Promise((r) => setTimeout(r, o.delayMs ?? 1500));
    if (document.visibilityState === 'hidden') return false;
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    write(K.asked, JSON.stringify([...asked, Date.now()].slice(-5)));
    void recordRequest(o.userId, moment);
    return true;
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
}

/** Remember the request on the account (admin stats: app_rating_prompts.last_action = native_<moment>). */
async function recordRequest(userId: string | null | undefined, moment: ReviewMoment): Promise<void> {
  if (!userId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const now = new Date().toISOString();
    const { data } = await db.from('app_rating_prompts').select('id, show_count').eq('user_id', userId).maybeSingle();
    if (data) await db.from('app_rating_prompts').update({ last_action: `native_${moment}`, last_shown_at: now, show_count: (data.show_count || 0) + 1, platform: Capacitor.getPlatform(), updated_at: now }).eq('user_id', userId);
    else await db.from('app_rating_prompts').insert({ user_id: userId, last_action: `native_${moment}`, platform: Capacitor.getPlatform() });
  } catch {/* stats only */}
}

/** The pregnancy week the user last saw on the home screen; returns true when this week is new. */
export function markPregnancyWeekSeen(week: number): boolean {
  const last = Number(read(K.weekSeen)) || 0;
  if (week <= last) return false;
  write(K.weekSeen, String(week));
  return last > 0; // the very first week seen is not an "update"
}
