/**
 * One scheduler for every on-device reminder (vaccines, Tərbiyə, weaning, nap alerts, baby messages,
 * illness doses, water, vitamin, exercise, pill).
 *
 * iOS keeps at most 64 pending local notifications and silently drops the rest, so with two or more
 * children reminders were lost. Features no longer call LocalNotifications.schedule themselves: each one
 * registers its desired reminders under a namespace (setLocalNotifications). The scheduler keeps the
 * desired set durably on the device, cancels reminders that are no longer wanted, and keeps only the
 * nearest PENDING_BUDGET (60) by fire time pending (a daily reminder counts as its next occurrence).
 * The rest is scheduled on a later re-plan (app open / resume, or whenever a feature changes its set).
 * Android has no such limit but uses the same path.
 *
 * Ids stay the features' existing stable ids, so a reminder that an older app version already scheduled
 * is replaced (same id), never duplicated; `cancelIds` lets a feature retire its whole old id range.
 * Planning never asks for permission; only `ask: true` (a user action in that feature) may prompt.
 */

export const PENDING_BUDGET = 60;
const STORE_KEY = 'anacan.localNotifications.v1';
/** Device-level reminders that do not belong to an account (kept when another account is bound). */
const DEVICE_NAMESPACES = new Set(['water']);
/** A one-shot reminder this close to now (or past) is treated as already delivered. */
const EXPIRY_MARGIN_MS = 5_000;

export interface DesiredNotification {
  id: number;
  title: string;
  body: string;
  /** One-shot fire time (Date or epoch ms). For `repeat: 'day'` only its local hour/minute are used. */
  at: Date | number;
  repeat?: 'day';
  extra?: Record<string, unknown>;
  smallIcon?: string;
  channelId?: string;
}

interface StoredNotification {
  id: number;
  title: string;
  body: string;
  at: number;
  repeat?: 'day';
  extra?: Record<string, unknown>;
  smallIcon?: string;
  channelId?: string;
}

interface SchedulerStore {
  v: 1;
  owner: string | null;
  namespaces: Record<string, StoredNotification[]>;
  /** id -> fingerprint of what this scheduler last handed to the OS. */
  scheduled: Record<string, string>;
}

export type ScheduleResult = 'scheduled' | 'cleared' | 'denied' | 'unavailable';

export interface PlannedNotification extends StoredNotification {
  namespace: string;
  /** Next fire time (epoch ms). */
  next: number;
}

// ── Pure planning (tested) ─────────────────────────────────────────────────────────────

/** The next time a reminder fires after `now`, or null when a one-shot is already past. */
export function nextFireAt(item: Pick<StoredNotification, 'at' | 'repeat'>, now: number): number | null {
  if (item.repeat === 'day') {
    const base = new Date(item.at);
    const today = new Date(now);
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), base.getHours(), base.getMinutes(), 0, 0);
    if (candidate.getTime() <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate.getTime();
  }
  return item.at > now + EXPIRY_MARGIN_MS ? item.at : null;
}

/** Which reminders should be pending now: the nearest `budget`, ordered by next fire time, then id. */
export function planLocalNotifications(namespaces: Record<string, StoredNotification[]>, now: number, budget = PENDING_BUDGET): PlannedNotification[] {
  const seen = new Set<number>();
  const all: PlannedNotification[] = [];
  for (const namespace of Object.keys(namespaces).sort()) {
    for (const item of namespaces[namespace] || []) {
      if (seen.has(item.id)) continue; // one id, one reminder
      const next = nextFireAt(item, now);
      if (next === null) continue;
      seen.add(item.id);
      all.push({ ...item, namespace, next });
    }
  }
  all.sort((a, b) => a.next - b.next || a.id - b.id);
  return all.slice(0, Math.max(0, budget));
}

/** Stable description of what is handed to the OS: unchanged reminders are not rescheduled. */
export function fingerprint(item: StoredNotification): string {
  const when = item.repeat === 'day'
    ? `d${new Date(item.at).getHours()}:${new Date(item.at).getMinutes()}`
    : `a${item.at}`;
  return JSON.stringify([item.title, item.body, when, item.extra ?? null, item.smallIcon ?? null, item.channelId ?? null]);
}

// ── Durable desired set ───────────────────────────────────────────────────────────────

const emptyStore = (): SchedulerStore => ({ v: 1, owner: null, namespaces: {}, scheduled: {} });

function readStore(): SchedulerStore {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return emptyStore();
    const namespaces: Record<string, StoredNotification[]> = {};
    for (const [ns, list] of Object.entries(raw.namespaces || {})) {
      if (!Array.isArray(list)) continue;
      namespaces[ns] = list.filter((n): n is StoredNotification =>
        !!n && Number.isInteger(n.id) && typeof n.title === 'string' && typeof n.body === 'string' && Number.isFinite(n.at));
    }
    const scheduled: Record<string, string> = {};
    for (const [id, fp] of Object.entries(raw.scheduled || {})) if (typeof fp === 'string') scheduled[id] = fp;
    return { v: 1, owner: typeof raw.owner === 'string' ? raw.owner : null, namespaces, scheduled };
  } catch { return emptyStore(); }
}

function writeStore(store: SchedulerStore): void {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* next re-plan rebuilds from callers */ }
}

const toStored = (n: DesiredNotification): StoredNotification => ({
  id: n.id, title: n.title, body: n.body, at: n.at instanceof Date ? n.at.getTime() : n.at,
  ...(n.repeat ? { repeat: n.repeat } : {}),
  ...(n.extra ? { extra: n.extra } : {}),
  ...(n.smallIcon ? { smallIcon: n.smallIcon } : {}),
  ...(n.channelId ? { channelId: n.channelId } : {}),
});

/** Desired reminders of a namespace as currently stored (tests, diagnostics). */
export function desiredLocalNotifications(namespace?: string): StoredNotification[] {
  const store = readStore();
  if (namespace) return store.namespaces[namespace] ?? [];
  return Object.values(store.namespaces).flat();
}

// ── Native bridge ─────────────────────────────────────────────────────────────────────

type LocalNotificationsPlugin = typeof import('@capacitor/local-notifications')['LocalNotifications'];

/**
 * The plugin is a Capacitor proxy: any property read, including `then`, becomes a native
 * call. Returning it from an async function makes promise resolution call
 * `LocalNotifications.then()`, which rejects ("not implemented on ios") and silently broke
 * every reminder in 52.0.0/52.0.1. Hand it back inside a plain holder object instead.
 */
async function loadPlugin(): Promise<{ ln: LocalNotificationsPlugin } | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    if (typeof Capacitor.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable('LocalNotifications')) return null;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return { ln: LocalNotifications };
  } catch { return null; }
}

type Display = 'granted' | 'denied' | 'prompt' | 'unavailable';
async function permission(ln: LocalNotificationsPlugin, ask: boolean): Promise<Display> {
  try {
    let status = (await ln.checkPermissions())?.display as string | undefined;
    if (ask && (status === 'prompt' || status === 'prompt-with-rationale')) status = (await ln.requestPermissions())?.display;
    if (status === 'granted') return 'granted';
    return status === 'prompt' || status === 'prompt-with-rationale' ? 'prompt' : 'denied';
  } catch { return 'unavailable'; }
}

const toNative = (item: StoredNotification) => {
  const at = new Date(item.at);
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    schedule: item.repeat === 'day'
      ? { on: { hour: at.getHours(), minute: at.getMinutes() }, repeats: true, allowWhileIdle: true }
      : { at, allowWhileIdle: true },
    ...(item.extra ? { extra: item.extra } : {}),
    ...(item.smallIcon ? { smallIcon: item.smallIcon } : {}),
    ...(item.channelId ? { channelId: item.channelId } : {}),
  };
};

// Every operation runs in order: a feature update never races the resume re-plan.
// A stuck native bridge holds the queue for at most SERIAL_STEP_TIMEOUT_MS.
const SERIAL_STEP_TIMEOUT_MS = 10_000;
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work);
  chain = Promise.race([
    run.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, SERIAL_STEP_TIMEOUT_MS)),
  ]);
  return run;
}

/**
 * Reconcile the OS with the desired set. `extraCancel` are ids a feature retired in this change.
 * Returns the permission state used. Never throws.
 */
async function reconcile(ln: LocalNotificationsPlugin, store: SchedulerStore, extraCancel: number[], ask: boolean, needPermission = false): Promise<Display> {
  const now = Date.now();
  // Prune one-shots that already fired: the desired set never grows without bound.
  for (const ns of Object.keys(store.namespaces)) {
    store.namespaces[ns] = store.namespaces[ns].filter((item) => nextFireAt(item, now) !== null);
  }
  let pending: Set<number> | null = null;
  try {
    const result = await ln.getPending?.();
    if (result && Array.isArray(result.notifications)) pending = new Set(result.notifications.map((n) => n.id));
  } catch { pending = null; }

  const desiredIds = new Set(Object.values(store.namespaces).flat().map((n) => n.id));
  const retired = new Set(extraCancel.filter((id) => !desiredIds.has(id)));
  // Pending reminders this scheduler does not own (e.g. an older app version's, not yet re-registered)
  // still count against the iOS limit.
  const unmanaged = pending ? [...pending].filter((id) => !(String(id) in store.scheduled) && !desiredIds.has(id) && !retired.has(id)).length : 0;
  const chosen = planLocalNotifications(store.namespaces, now, PENDING_BUDGET - unmanaged);
  const chosenIds = new Set(chosen.map((n) => n.id));

  const cancel = new Set<number>();
  for (const id of Object.keys(store.scheduled)) if (!chosenIds.has(Number(id))) cancel.add(Number(id));
  for (const id of extraCancel) if (!chosenIds.has(id)) cancel.add(id);
  if (cancel.size) {
    try { await ln.cancel({ notifications: [...cancel].map((id) => ({ id })) }); } catch { /* retried on the next re-plan */ }
    for (const id of cancel) delete store.scheduled[String(id)];
  }

  const display = chosen.length || needPermission ? await permission(ln, ask) : 'granted';
  if (display !== 'granted') { writeStore(store); return display; }

  const toSchedule = chosen.filter((n) => store.scheduled[String(n.id)] !== fingerprint(n) || (pending !== null && !pending.has(n.id)));
  if (toSchedule.length) {
    try {
      await ln.schedule({ notifications: toSchedule.map(toNative) as never });
      for (const n of toSchedule) store.scheduled[String(n.id)] = fingerprint(n);
    } catch { /* retried on the next re-plan */ }
  }
  writeStore(store);
  return display;
}

export interface SetOptions {
  /** May show the OS permission prompt (only from a user action in that feature). */
  ask?: boolean;
  /** Old ids of this feature to cancel if they are not in the new set (legacy ranges, whole blocks). */
  cancelIds?: number[];
}

/**
 * Replace one feature's desired reminders (empty = remove them) and re-plan. Never throws.
 * 'scheduled' = permission granted and something is desired; 'cleared' = nothing desired.
 */
export function setLocalNotifications(namespace: string, items: DesiredNotification[], opts: SetOptions = {}): Promise<ScheduleResult> {
  return serial(async () => {
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return 'unavailable';
    const store = readStore();
    const stored = items.map(toStored);
    const ids = new Set(stored.map((n) => n.id));
    // An id belongs to one namespace: taking it over removes it elsewhere.
    for (const ns of Object.keys(store.namespaces)) {
      if (ns !== namespace) store.namespaces[ns] = store.namespaces[ns].filter((n) => !ids.has(n.id));
    }
    const previous = (store.namespaces[namespace] ?? []).map((n) => n.id);
    if (stored.length) store.namespaces[namespace] = stored; else delete store.namespaces[namespace];
    const display = await reconcile(ln, store, [...previous, ...(opts.cancelIds ?? [])], !!opts.ask && stored.length > 0, stored.length > 0);
    if (!stored.length) return 'cleared';
    if (display === 'granted') return 'scheduled';
    return display === 'unavailable' ? 'unavailable' : 'denied';
  });
}

/** Remove every namespace starting with `prefix` (e.g. 'vaccine:'), cancelling their reminders. */
export function clearLocalNotificationNamespaces(prefix: string, cancelIds: number[] = []): Promise<void> {
  return serial(async () => {
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return;
    const store = readStore();
    const removed: number[] = [];
    for (const ns of Object.keys(store.namespaces)) {
      if (!ns.startsWith(prefix)) continue;
      removed.push(...store.namespaces[ns].map((n) => n.id));
      delete store.namespaces[ns];
    }
    await reconcile(ln, store, [...removed, ...cancelIds], false);
  });
}

/** Re-plan from the durable set (app open / resume). Never prompts, never throws. */
export function replanLocalNotifications(): Promise<void> {
  return serial(async () => {
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return;
    await reconcile(ln, readStore(), [], false);
  });
}

/** Cancel specific ids outside any namespace (timer / chat notifications). */
export function cancelLocalNotificationIds(ids: number[]): Promise<void> {
  return serial(async () => {
    if (!ids.length) return;
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return;
    try { await ln.cancel({ notifications: ids.map((id) => ({ id })) }); } catch { /* best effort */ }
  });
}

/**
 * Show a notification right away (a running timer, an incoming chat message). It is delivered at once,
 * so it never occupies a pending slot and is not part of the desired set.
 */
export function notifyNow(item: { id: number; title: string; body: string; extra?: Record<string, unknown>; ongoing?: boolean; autoCancel?: boolean; smallIcon?: string }, opts: { ask?: boolean } = {}): Promise<boolean> {
  return serial(async () => {
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return false;
    if (await permission(ln, !!opts.ask) !== 'granted') return false;
    try { await ln.schedule({ notifications: [item] as never }); return true; } catch { return false; }
  });
}

/**
 * Logout / "all notifications off": forget every desired reminder of this device and cancel everything
 * pending and delivered, so the next person never sees the previous account's reminders.
 */
export function resetLocalNotifications(): Promise<void> {
  return serial(async () => {
    writeStore(emptyStore());
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) return;
    const pending = await ln.getPending();
    const ids = (pending?.notifications ?? []).map((n) => ({ id: n.id }));
    if (ids.length) await ln.cancel({ notifications: ids });
    try { await ln.removeAllDeliveredNotifications(); } catch { /* optional on older plugins */ }
  });
}

/**
 * Bind the desired set to the signed-in account. When another account's set is still stored (the session
 * ended without a logout cleanup), its reminders are cancelled; device-level ones (water) stay.
 */
export function bindLocalNotificationOwner(userId: string): Promise<void> {
  return serial(async () => {
    if (!userId) return;
    const store = readStore();
    if (store.owner === userId) return;
    const previousOwner = store.owner;
    store.owner = userId;
    if (!previousOwner) { writeStore(store); return; }
    const removed: number[] = [];
    for (const ns of Object.keys(store.namespaces)) {
      if (DEVICE_NAMESPACES.has(ns)) continue;
      removed.push(...store.namespaces[ns].map((n) => n.id));
      delete store.namespaces[ns];
    }
    const ln = (await loadPlugin())?.ln ?? null;
    if (!ln) { writeStore(store); return; }
    await reconcile(ln, store, removed, false);
  });
}

let replannerInstalled = false;
/** Re-plan now and whenever the app returns to the foreground (throttled). Native only; call once at start. */
export function installLocalNotificationReplanner(minIntervalMs = 30_000): void {
  if (replannerInstalled) return;
  replannerInstalled = true;
  let last = 0;
  const run = () => {
    const now = Date.now();
    if (now - last < minIntervalMs) return;
    last = now;
    void replanLocalNotifications();
  };
  run();
  void (async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', ({ isActive }) => { if (isActive) run(); });
    } catch { /* re-plans still happen whenever a feature changes its reminders */ }
  })();
}
