// Local sleep notifications on this phone: before the next nap window, long daytime nap, and one week
// before a sleep regression. Settings are per device (localStorage); quiet hours 22:00–07:00.
import type { NextNap, Regression } from './sleep-predict';

export interface NapAlertSettings { enabled: boolean; lead: 5 | 10 | 15 | 20; longNap: boolean; regression: boolean; quiet: boolean }
export const DEFAULT_NAP_ALERTS: NapAlertSettings = { enabled: true, lead: 15, longNap: true, regression: true, quiet: true };
const KEY = 'anacan.napAlerts.v1';
export const NAP_ALERT_IDS = { nap: 880_001, long: 880_002, regression: 880_003 } as const;

export function readNapAlerts(): NapAlertSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_NAP_ALERTS;
    const lead = [5, 10, 15, 20].includes(raw.lead) ? raw.lead : 15;
    return { enabled: raw.enabled !== false, lead, longNap: raw.longNap !== false, regression: raw.regression !== false, quiet: raw.quiet !== false };
  } catch { return DEFAULT_NAP_ALERTS; }
}
export function saveNapAlerts(s: NapAlertSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* optional */ }
}

/** Inside quiet hours (22:00–07:00 local)? */
export const inQuietHours = (d: Date) => d.getHours() >= 22 || d.getHours() < 7;

export interface PlannedAlert { id: number; at: Date; title: string; body: string }

/** Which notifications should be pending now (pure; tested). */
export function planNapAlerts(o: {
  settings: NapAlertSettings; now: Date; next: NextNap; sleepingSince: Date | null; regression: Regression | null;
  text: { napTitle: (min: number) => string; napBody: string; longTitle: string; longBody: string; regressTitle: string; regressBody: string };
}): PlannedAlert[] {
  const { settings, now } = o;
  if (!settings.enabled) return [];
  const out: PlannedAlert[] = [];
  const ok = (at: Date) => at.getTime() > now.getTime() + 30_000 && !(settings.quiet && inQuietHours(at));
  if (o.next.windowStart && !o.next.isBedtime && (o.next.state === 'early' || o.next.state === 'soon')) {
    const at = new Date(o.next.windowStart.getTime() - settings.lead * 60_000);
    if (ok(at)) out.push({ id: NAP_ALERT_IDS.nap, at, title: o.text.napTitle(settings.lead), body: o.text.napBody });
  }
  if (settings.longNap && o.sleepingSince) {
    const h = o.sleepingSince.getHours();
    if (h >= 7 && h < 18) {
      const at = new Date(o.sleepingSince.getTime() + 120 * 60_000);
      if (ok(at)) out.push({ id: NAP_ALERT_IDS.long, at, title: o.text.longTitle, body: o.text.longBody });
    }
  }
  if (settings.regression && o.regression && !o.regression.active && o.regression.daysUntil >= 7) {
    const at = new Date(o.regression.start.getTime() - 7 * 86_400_000);
    at.setHours(10, 0, 0, 0);
    if (ok(at)) out.push({ id: NAP_ALERT_IDS.regression, at, title: o.text.regressTitle, body: o.text.regressBody });
  }
  return out;
}

/** Replace this feature's pending notifications with the planned ones (native only, never throws). */
export async function syncNapAlerts(planned: PlannedAlert[]): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: Object.values(NAP_ALERT_IDS).map((id) => ({ id })) });
    if (!planned.length) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({ notifications: planned.map((p) => ({ id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true } })) });
  } catch { /* best effort */ }
}

export async function requestNapAlertPermission(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.checkPermissions();
    if (p.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch { return false; }
}
