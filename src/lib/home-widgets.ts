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
export interface WidgetSnapshot {
  v: 1;
  updatedAt: number;
  premium: boolean;
  privacy: boolean;
  showActions: boolean;
  journey: WidgetJourney | null;
  care: WidgetCare | null;
  labels: Record<string, string>;
  links: typeof WIDGET_LINKS;
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
    hidden: t.hidden, hoursMinutes: t.hours_minutes, minutes: t.minutes
  };
}

export function buildWidgetSnapshot(o: {
  text: WidgetText; premium: boolean; settings: WidgetSettings; journey: WidgetJourney | null; care: WidgetCare | null; now?: Date;
}): WidgetSnapshot {
  const care = o.care && o.settings ? {
    ...o.care,
    lastFeedAt: o.settings.showFeed ? o.care.lastFeedAt : null,
    lastFeedText: o.settings.showFeed ? o.care.lastFeedText : '',
    nextNapStart: o.settings.showNap ? o.care.nextNapStart : null,
    nextNapEnd: o.settings.showNap ? o.care.nextNapEnd : null
  } : null;
  return {
    v: 1, updatedAt: (o.now ?? new Date()).getTime(), premium: o.premium, privacy: o.settings.privacy, showActions: o.settings.showActions,
    journey: o.journey,
    // Without Premium the care widget shows "Get Anacan Premium" — no feeding/sleep data leaves the app.
    care: o.premium ? care : null,
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
