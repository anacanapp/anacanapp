/**
 * 53.0 bridge release: mirrors local-only WebView state into Capacitor Preferences.
 *
 * The Flutter app (60.0) replaces this app in place. It can read Capacitor Preferences
 * natively (iOS UserDefaults `CapacitorStorage.<key>`, Android SharedPreferences
 * `CapacitorStorage`) but not the WebView's localStorage or IndexedDB. This module keeps ONE
 * Preferences entry, MIGRATION_EXPORT_KEY, with the raw string value of every localStorage key
 * that matches MIGRATION_EXPORT_RULES, so Flutter can import it on first launch.
 *
 * Inventory and migration classes: docs/flutter/LEGACY_STORAGE.md (kept in step by a test).
 * Sessions, logout tombstones and admission pins already live in Preferences
 * (session-persistence.ts, backend-bootstrap.ts) and are never copied here.
 *
 * Native only; a no-op on web. Every failure is swallowed: an export problem must never break
 * or slow a localStorage write. Plugin objects are only ever called, never returned from an
 * async function (see docs/RELEASE_52_CODEMAGIC.md, "LocalNotifications.then()").
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

export const MIGRATION_EXPORT_KEY = 'anacan.migration.localstore.v1';
export const MIGRATION_EXPORT_SCHEMA = 'anacan-migration-localstore-v1';
/** A single value above this many UTF-16 code units is skipped (listed under `skipped`). */
export const MAX_EXPORT_VALUE_CHARS = 256 * 1024;
/** Total budget for all exported values; later (lower-priority) keys are skipped first. */
export const MAX_EXPORT_TOTAL_CHARS = 1536 * 1024;
export const EXPORT_DEBOUNCE_MS = 3000;
/** First export after startup, once zustand stores have hydrated and startup writes settled. */
export const EXPORT_INITIAL_DELAY_MS = 4000;

export interface MigrationKeyRule {
  match: 'exact' | 'prefix';
  key: string;
  area: string;
}

const exact = (area: string, ...keys: string[]): MigrationKeyRule[] => keys.map(key => ({ match: 'exact', key, area }));
const prefix = (area: string, ...keys: string[]): MigrationKeyRule[] => keys.map(key => ({ match: 'prefix', key, area }));

/**
 * Every localStorage key of migration class `export`, in priority order (the total-size cap
 * drops later rules first). Change docs/flutter/LEGACY_STORAGE.md together with this list.
 */
export const MIGRATION_EXPORT_RULES: readonly MigrationKeyRule[] = [
  ...exact('app-lock', 'anacan_lock_enabled', 'anacan_lock_hash', 'anacan_lock_salt', 'anacan_lock_bio'),
  ...exact('user', 'anacan-user-store', 'selected-child-storage', 'language'),
  ...exact('timers', 'anacan-timers', 'anacan_tool_live_timer_v1'),
  ...prefix('timers', 'anacan_contraction_timer_v1:', 'anacan_kick_active_v1:'),
  ...prefix('outbox', 'anacan_outbox_v1:', 'anacan_contraction_queue_v1:', 'anacan_consent_pending_v1:',
    'anacan-moderator-warning-acks-v1:'),
  ...prefix('plans', 'anacan.sleepTraining.', 'anacan.parenting.v1.', 'anacan.weaning.v1.', 'anacan_kid_exercises_v1:',
    'anacan.play-together.v1.', 'anacan:weight-tracker:height-cm'),
  ...prefix('drafts', 'anacan-onboarding-v3:', 'anacan_loss_letter_v1:', 'anacan_loss_todo_v1:', 'anacan_baby_chat_v1:'),
  ...exact('drafts', 'anacan_pending_funnel', 'anacan_iep_pending_v1', 'anacan:promo-code', 'anacan_books_cart_v1',
    'anacan_books_pending_v1', 'anacan_partner_basket_v1', 'anacan_olivia_basket_v1', 'anacan-aptek-checkout', 'anacan-aptek-recent', 'cake-cart'),
  ...exact('games', 'anacan_colorsort_round_v1', 'anacan_colorsort_level_count_v1', 'anacan_colorsort_markers_v1',
    'anacan:qabarciq:best:v1', 'anacan:qabarciq:sound:v1', 'anacan_two_friends_preferences_v1', 'anacan_word_garden_preferences_v1'),
  ...prefix('games', 'anacan_word_garden_v1:', 'anacan_two_friends_v1:', 'anacan_casual_v1:', 'anacan_minigame_progress_'),
  ...exact('health', 'anacan_health_connected', 'anacan_health_cycle_write', 'anacan_glucose_unit', 'anacan.illness.temp-unit'),
  ...prefix('health', 'anacan_health_vitals_', 'anacan.mommyPeriod.endedOn.'),
  ...exact('notifications', 'anacan_water_reminder_enabled', 'anacan.vaccineReminders.v1', 'anacan.vaccineReminders.childSlots.v1',
    'anacan.localNotifications.v1', 'anacan.napAlerts.v1', 'anacan.parenting.reminders.v1', 'anacan_kick_ten_notified_day',
    'last_push_prompt_date'),
  ...prefix('notifications', 'silent_hours_'),
  ...exact('settings', 'anacan.widgets.settings.v1', 'anacan.sleepCues.v1', 'anacan_recent_stickers_v1'),
  ...prefix('settings', 'anacan_ai_consent_v1:', 'anacan.hospital-bag.hidden.'),
  ...exact('counters', 'anacan_app_usage_count', 'anacan_rating_done', 'anacan.review.firstOpenAt', 'anacan.feedback.sentAt',
    'anacan.feedback.dismissedAt', 'anacan_referral_converted_synced'),
  ...prefix('counters', 'anacan.ads.ledger.v1:', 'anacan_app_update_later_'),
  ...exact('seen', 'anacan_ai_warn_dismissed', 'anacan_partner_tour_v2', 'anacan.lockOffer.seenAt', 'anacan.prompt.lastShownDay'),
  ...prefix('seen', 'anacan_tour_v', 'anacan.parenting.intro.v1.', 'anacan.weaning.homecard.v1.', 'preemie-backfill-dismissed-',
    'anacan_qc_intro_dismissed_v1:', 'anacan-ad-free-offer-seen-v1:', 'community_seen_', 'anacan-stories-seen:',
    'anacan.market.inbox.seen.v1:'),
];

/**
 * Never exported even if a rule above would match: credentials (already backed up in
 * Preferences by session-persistence.ts), admission pins, and the react-query cache.
 */
export const MIGRATION_EXPORT_EXCLUDED: readonly RegExp[] = [
  /^sb-.*-auth-token/, /auth-token/i, /^anacan\.auth[.-]/, /^anacan\.backend-admission/, /^anacan-rq-/,
  /refresh_token|access_token/i,
];

const indexedRules = MIGRATION_EXPORT_RULES.map((rule, index) => ({ rule, index }));
const exactKeys = new Map(indexedRules.filter(item => item.rule.match === 'exact').map(item => [item.rule.key, item.index] as const));
const prefixRules = indexedRules.filter(item => item.rule.match === 'prefix');

/** Rule priority (index into MIGRATION_EXPORT_RULES) for an exported key, or -1. */
function rulePriority(key: string): number {
  if (MIGRATION_EXPORT_EXCLUDED.some(pattern => pattern.test(key))) return -1;
  const direct = exactKeys.get(key);
  if (direct !== undefined) return direct;
  for (const { rule, index } of prefixRules) if (key.startsWith(rule.key)) return index;
  return -1;
}

const decisions = new Map<string, number>();
function cachedPriority(key: string): number {
  let value = decisions.get(key);
  if (value === undefined) {
    value = rulePriority(key);
    if (decisions.size > 2048) decisions.clear();
    decisions.set(key, value);
  }
  return value;
}

export function isMigrationExportKey(key: string): boolean {
  return typeof key === 'string' && cachedPriority(key) >= 0;
}

export interface MigrationExportPayload {
  schema: typeof MIGRATION_EXPORT_SCHEMA;
  exportedAt: string;
  appVersion: string;
  entries: Record<string, string>;
  skipped: string[];
}

type ReadableStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** Pure: selects and size-guards the export entries from a storage snapshot. */
export function collectMigrationEntries(storage: ReadableStorage): { entries: Record<string, string>; skipped: string[] } {
  const selected: { key: string; priority: number }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null) continue;
    const priority = cachedPriority(key);
    if (priority >= 0) selected.push({ key, priority });
  }
  selected.sort((a, b) => a.priority - b.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const entries: Record<string, string> = {};
  const skipped: string[] = [];
  let total = 0;
  for (const { key } of selected) {
    const value = storage.getItem(key);
    if (value === null) continue;
    if (value.length > MAX_EXPORT_VALUE_CHARS || total + key.length + value.length > MAX_EXPORT_TOTAL_CHARS) {
      skipped.push(key);
      continue;
    }
    entries[key] = value;
    total += key.length + value.length;
  }
  return { entries, skipped };
}

export function buildMigrationExport(storage: ReadableStorage, now = new Date()): MigrationExportPayload {
  const { entries, skipped } = collectMigrationEntries(storage);
  return {
    schema: MIGRATION_EXPORT_SCHEMA,
    exportedAt: now.toISOString(),
    appVersion: String(import.meta.env.VITE_APP_VERSION || 'unknown'),
    entries,
    skipped,
  };
}

// ── Runtime (native only) ───────────────────────────────────────────────────────────────
let started = false;
let target: Storage | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let writing: Promise<void> | null = null;
let rerun = false;
let lastSignature: string | null = null;
let restorePatch: (() => void) | null = null;
let appListener: { remove: () => unknown } | null = null;
let onVisibility: (() => void) | null = null;

function localStorageOrNull(): Storage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

async function writeExport(): Promise<void> {
  const storage = target ?? localStorageOrNull();
  if (!storage) return;
  const payload = buildMigrationExport(storage);
  const signature = JSON.stringify([payload.appVersion, payload.entries, payload.skipped]);
  if (signature === lastSignature) return;
  await Preferences.set({ key: MIGRATION_EXPORT_KEY, value: JSON.stringify(payload) });
  lastSignature = signature;
}

/** Writes the export now (cancels a pending debounce). Never rejects. */
export function flushMigrationExport(): Promise<void> {
  if (!started) return Promise.resolve();
  if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  if (writing) { rerun = true; return writing; }
  writing = (async () => {
    try {
      do {
        rerun = false;
        try { await writeExport(); }
        catch { console.warn('[migration-export] export write failed'); }
      } while (rerun);
    } finally { writing = null; }
  })();
  return writing;
}

function schedule(delay = EXPORT_DEBOUNCE_MS): void {
  if (!started) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void flushMigrationExport(); }, delay);
}

function installWriteHook(storage: Storage): (() => void) | null {
  const proto = typeof Storage !== 'undefined' ? Storage.prototype : null;
  if (!proto || !(storage instanceof Storage)) return null;
  const originalSet = proto.setItem, originalRemove = proto.removeItem, originalClear = proto.clear;
  // The original write runs first and its result or exception is passed through untouched;
  // only a matching key on this localStorage schedules the (debounced, async) export.
  proto.setItem = function setItem(this: Storage, key: string, value: string) {
    originalSet.call(this, key, value);
    try { if (this === storage && isMigrationExportKey(String(key))) schedule(); } catch { /* export is best effort */ }
  };
  proto.removeItem = function removeItem(this: Storage, key: string) {
    originalRemove.call(this, key);
    try { if (this === storage && isMigrationExportKey(String(key))) schedule(); } catch { /* export is best effort */ }
  };
  proto.clear = function clear(this: Storage) {
    originalClear.call(this);
    try { if (this === storage) schedule(); } catch { /* export is best effort */ }
  };
  return () => { proto.setItem = originalSet; proto.removeItem = originalRemove; proto.clear = originalClear; };
}

/** Native-only, idempotent. Call after the first render; it never blocks startup. */
export function startMigrationExport(): void {
  try {
    if (started || !Capacitor.isNativePlatform()) return;
    target = localStorageOrNull();
    if (!target) return;
    started = true;
    try { restorePatch = installWriteHook(target); } catch { restorePatch = null; }
    // Flush the last state when the app leaves the foreground (it may never come back).
    App.addListener('appStateChange', ({ isActive }) => { if (!isActive) void flushMigrationExport(); })
      .then(handle => { if (started) appListener = handle; else void handle.remove(); })
      .catch(() => { /* visibilitychange below still flushes */ });
    onVisibility = () => { if (document.visibilityState === 'hidden') void flushMigrationExport(); };
    document.addEventListener('visibilitychange', onVisibility);
    schedule(EXPORT_INITIAL_DELAY_MS);
  } catch { console.warn('[migration-export] start failed'); }
}

export function __resetMigrationExportForTests(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  restorePatch?.();
  restorePatch = null;
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
  onVisibility = null;
  void appListener?.remove();
  appListener = null;
  started = false; target = null; writing = null; rerun = false; lastSignature = null;
  decisions.clear();
}
