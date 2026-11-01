// Home-screen widgets (iOS WidgetKit, Android AppWidget). The app renders a small localized snapshot
// and hands it to the native "AnacanWidgets" plugin, which stores it in the App Group / shared prefs
// and reloads the widgets. Widgets never read the network or the account directly.
import { registerPlugin, Capacitor } from '@capacitor/core';
import type { WidgetText } from '@/data/widgets';
import { fill } from './feature-text';

interface AnacanWidgetsPlugin {
  update(options: { snapshot: string }): Promise<{ ok: boolean }>;
}
const AnacanWidgets = registerPlugin<AnacanWidgetsPlugin>('AnacanWidgets');

export const WIDGET_SETTINGS_KEY = 'anacan.widgets.settings.v1';
export interface WidgetSettings { showFeed: boolean; showNap: boolean; showActions: boolean; privacy: boolean }
export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = { showFeed: true, showNap: true, showActions: true, privacy: false };

export function readWidgetSettings(): WidgetSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDGET_SETTINGS_KEY) || 'null');
    return raw && typeof raw === 'object' ? { ...DEFAULT_WIDGET_SETTINGS, ...raw } : DEFAULT_WIDGET_SETTINGS;
  } catch { return DEFAULT_WIDGET_SETTINGS; }
}
export function saveWidgetSettings(s: WidgetSettings): void {
  try { localStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(s)); } catch { /* optional */ }
}

export const WIDGET_LINKS = {
  home: 'anacan:///',
  premium: 'anacan://premium',
  feed: 'anacan://tool/baby-tracker?widget_action=feed',
  sleep: 'anacan://tool/sleep-training?widget_action=sleep',
  diaper: 'anacan://tool/baby-tracker?widget_action=diaper',
  sleepTool: 'anacan://tool/sleep-training',
  tracker: 'anacan://tool/baby-tracker'
} as const;

export interface WidgetJourney { eyebrow: string; title: string; subtitle: string; badge: string; progress: number; emoji: string }
export interface WidgetCare {
  name: string;
  age: string;
  emoji: string;
  /** epoch ms */
  lastFeedAt: number | null;
  lastFeedText: string;
  nextNapStart: number | null;
  nextNapEnd: number | null;
  nextNapIsBedtime: boolean;
  sleepingSince: number | null;
  todayFeeds: number;
  todaySleep: string;
  todayDiapers: number;
}
export interface WidgetWord { eyebrow: string; text: string }
export interface WidgetSnapshot {
  v: 1;
  updatedAt: number;
  premium: boolean;
  privacy: boolean;
  showActions: boolean;
  journey: WidgetJourney | null;
  /** Real care data (Premium) OR a sample preview (non-Premium: native shows it locked). */
  care: WidgetCare | null;
  /** True when `care` is the non-Premium sample; native shows the "Premium required" overlay. */
  careLocked: boolean;
  /** Daily word / affirmation widget (free). */
  word: WidgetWord | null;
  labels: Record<string, string>;
  links: typeof WIDGET_LINKS;
}

/** A realistic sample so a non-Premium user sees the full care widget (locked), not an empty teaser. */
export function sampleCare(t: WidgetText, now = new Date()): WidgetCare {
  const ms = now.getTime();
  return {
    name: 'Nuray', age: fill(t.baby_months, { m: 3, d: 12 }), emoji: '👶',
    lastFeedAt: ms - 2 * 3600_000, lastFeedText: `${t.sides.left} · ${fill(t.minutes, { n: 14 })}`,
    nextNapStart: ms + 45 * 60_000, nextNapEnd: ms + 105 * 60_000, nextNapIsBedtime: false,
    sleepingSince: null, todayFeeds: 6, todaySleep: fill(t.hours_minutes, { h: 4, m: 20 }), todayDiapers: 5,
  };
}

/** Günün sözü — a short daily affirmation, rotated by the day of the year. */
export function dailyWord(t: WidgetText, now = new Date()): WidgetWord | null {
  const words = Array.isArray(t.words) ? t.words : [];
  if (!words.length) return null;
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return { eyebrow: t.word_eyebrow, text: words[day % words.length] };
}

export const compactDuration = (t: WidgetText, minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return m >= 60 ? fill(t.hours_minutes, { h: Math.floor(m / 60), m: m % 60 }) : fill(t.minutes, { n: m });
};

/** "3 ay 12 gün", "12 gün", "1 yaş 3 ay" from a birth date. */
export function babyAgeText(t: WidgetText, birth: Date, now: Date): string {
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  const anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
  const days = Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - anchor.getTime()) / 86_400_000));
  if (months >= 12) return fill(t.baby_years, { y: Math.floor(months / 12), m: months % 12 });
  if (months === 0) return fill(t.baby_days, { d: days });
  return fill(t.baby_months, { m: months, d: days });
}

export function widgetLabels(t: WidgetText): Record<string, string> {
  return {
    lastFeed: t.last_feed, nextNap: t.next_nap, bedtime: t.bedtime, sleeping: t.sleeping, awake: t.awake, today: t.today,
    feeds: t.feeds, sleep: t.sleep, diapers: t.diapers, btnFeed: t.btn_feed, btnSleep: t.btn_sleep, btnDiaper: t.btn_diaper,
    btnWoke: t.btn_woke, premiumTitle: t.premium_title, premiumBody: t.premium_body, noData: t.no_data, openApp: t.open_app,
    hidden: t.hidden, hoursMinutes: t.hours_minutes, minutes: t.minutes,
    premiumBadge: t.premium_badge, premiumLocked: t.premium_locked_title, wordEyebrow: t.word_eyebrow
  };
}

export function buildWidgetSnapshot(o: {
  text: WidgetText; premium: boolean; settings: WidgetSettings; journey: WidgetJourney | null; care: WidgetCare | null; now?: Date;
}): WidgetSnapshot {
  const now = o.now ?? new Date();
  const applySettings = (c: WidgetCare): WidgetCare => ({
    ...c,
    lastFeedAt: o.settings.showFeed ? c.lastFeedAt : null,
    lastFeedText: o.settings.showFeed ? c.lastFeedText : '',
    nextNapStart: o.settings.showNap ? c.nextNapStart : null,
    nextNapEnd: o.settings.showNap ? c.nextNapEnd : null,
  });
  // Premium: real data. Non-Premium: a sample preview (native renders it with a "Premium required"
  // overlay) so the full widget is visible before buying — no real feeding/sleep data leaves the app.
  const careLocked = !o.premium;
  const care = o.premium ? (o.care ? applySettings(o.care) : null) : applySettings(sampleCare(o.text, now));
  return {
    v: 1, updatedAt: now.getTime(), premium: o.premium, privacy: o.settings.privacy, showActions: o.settings.showActions,
    journey: o.journey,
    care,
    careLocked,
    word: dailyWord(o.text, now),
    labels: widgetLabels(o.text), links: WIDGET_LINKS
  };
}

let lastSent = '';
/** Send the snapshot to the native widgets when it changed (no-op on the web or old builds). */
export async function pushWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { updatedAt: _ignored, ...stable } = snapshot;
  const key = JSON.stringify(stable);
  if (key === lastSent) return;
  try {
    await AnacanWidgets.update({ snapshot: JSON.stringify(snapshot) });
    lastSent = key;
  } catch { /* older native build without the widget plugin */ }
}
