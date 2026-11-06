/**
 * Consent gate (legal documents v2.0): Terms + Privacy Policy acceptance, explicit health-data consent,
 * age 16+ and optional marketing, recorded server-side in public.user_consents (append-only) through
 * record_consents_v1 and read back with my_consents_v1. See docs/CONSENT_GATE.md.
 *
 * Never lock anyone out: when the server is unreachable or the RPC is missing the gate is skipped, and an
 * acceptance that could not be sent is kept locally (per backend + user + version) and retried later.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export type ConsentKind = 'terms' | 'health_data' | 'age_16' | 'marketing' | 'child_data' | 'ai_assistant'
  | 'marketing_email' | 'marketing_push' | 'marketing_sms';
export const CONSENT_KINDS: readonly ConsentKind[] = ['terms', 'health_data', 'age_16', 'marketing', 'child_data', 'ai_assistant',
  'marketing_email', 'marketing_push', 'marketing_sms'];
export const REQUIRED_GATE_KINDS: readonly ConsentKind[] = ['terms', 'health_data', 'age_16'];
export const MARKETING_CHANNELS = ['marketing_email', 'marketing_push', 'marketing_sms'] as const;
export type ConsentVariant = 'default' | 'kvkk_tr';
/** Last resort when the server could not be asked (the pending send is dropped if the server disagrees). */
export const FALLBACK_CONSENT_VERSION = '2.0';

export interface ConsentGateConfig { enabled: boolean; version: string | null }
export interface ConsentRecord { granted: boolean; document_version: string; text_variant?: ConsentVariant | null; source?: string | null; created_at: string }
export interface ConsentState { gate: ConsentGateConfig; consents: Partial<Record<ConsentKind, ConsentRecord>> }
export interface ConsentItem { kind: ConsentKind; granted: boolean; version: string; variant?: ConsentVariant }
export type GateChoices = Record<Exclude<ConsentKind, 'ai_assistant'>, boolean>;

/** Türkiye users (profile country TR or app language tr) see the owner's KVKK Açık Rıza wording. */
export function isKvkkUser(countryCode: string | null | undefined, language: string | null | undefined): boolean {
  return (countryCode || '').trim().toUpperCase() === 'TR' || (language || '').trim().toLowerCase() === 'tr';
}

const VERSION_RE = /^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$/;
const CACHE_PREFIX = 'anacan_consent_gate_v1';
const PENDING_PREFIX = 'anacan_consent_pending_v1';
export const CONSENT_RPC_TIMEOUT_MS = 6000;

/** Parse the my_consents_v1 / record_consents_v1 payload; anything malformed → null (treated as unavailable). */
export function parseConsentState(raw: unknown): ConsentState | null {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!value || typeof value !== 'object') return null;
  const gateRaw = (value as any).gate;
  if (!gateRaw || typeof gateRaw !== 'object') return null;
  const version = typeof gateRaw.version === 'string' && VERSION_RE.test(gateRaw.version) ? gateRaw.version : null;
  const gate: ConsentGateConfig = { enabled: gateRaw.enabled === true && version !== null, version };
  const consents: ConsentState['consents'] = {};
  const rows = (value as any).consents;
  if (rows && typeof rows === 'object') {
    for (const kind of CONSENT_KINDS) {
      const row = rows[kind];
      if (row && typeof row === 'object' && typeof row.granted === 'boolean' && typeof row.document_version === 'string') {
        consents[kind] = { granted: row.granted, document_version: row.document_version, source: row.source ?? null, created_at: String(row.created_at ?? '') };
        if (row.text_variant === 'default' || row.text_variant === 'kvkk_tr') consents[kind]!.text_variant = row.text_variant;
      }
    }
  }
  return { gate, consents };
}

export type GateDecision = 'show' | 'skip';
export interface GateInput {
  /** Server state, or null when the RPC failed / is unavailable / timed out. */
  state: ConsentState | null;
  /** Version this user already accepted on this device (cache or a pending, not-yet-sent acceptance). */
  localAcceptedVersion?: string | null;
}

/** Whether the full-screen consent gate must be shown. Errors and a disabled setting always skip. */
export function decideConsentGate({ state, localAcceptedVersion }: GateInput): GateDecision {
  if (!state) return 'skip';
  const { gate, consents } = state;
  if (!gate.enabled || !gate.version) return 'skip';
  if (localAcceptedVersion && localAcceptedVersion === gate.version) return 'skip';
  const terms = consents.terms;
  if (terms && terms.granted && terms.document_version === gate.version) return 'skip';
  return 'show';
}

/** Continue is enabled only when every required item is ticked (marketing is optional). */
export function canContinue(choices: Partial<GateChoices>): boolean {
  return REQUIRED_GATE_KINDS.every(kind => choices[kind] === true);
}

/**
 * The rows recorded when the gate is accepted. Everyone: terms, health_data, age_16 (granted) + marketing as chosen.
 * Türkiye (KVKK): also child_data and the three İYS channels; marketing = any channel; KVKK-worded rows carry kvkk_tr.
 */
export function gateItems(choices: Partial<GateChoices>, version: string, kvkk = false): ConsentItem[] {
  if (!canContinue(choices)) throw new Error('CONSENT_REQUIRED_MISSING');
  if (!kvkk) {
    return (['terms', 'health_data', 'age_16', 'marketing'] as const).map(kind => ({ kind, granted: choices[kind] === true, version }));
  }
  const anyChannel = MARKETING_CHANNELS.some(kind => choices[kind] === true);
  return [
    { kind: 'terms', granted: true, version },
    { kind: 'health_data', granted: true, version, variant: 'kvkk_tr' },
    { kind: 'age_16', granted: true, version },
    { kind: 'child_data', granted: choices.child_data === true, version, variant: 'kvkk_tr' },
    { kind: 'marketing', granted: anyChannel, version, variant: 'kvkk_tr' },
    ...MARKETING_CHANNELS.map(kind => ({ kind, granted: choices[kind] === true, version, variant: 'kvkk_tr' as const })),
  ];
}

// ── Local cache (per backend + user) ────────────────────────────────────────────────────
const scoped = (prefix: string, backend: string, userId: string) => `${prefix}:${backend}:${userId}`;

function readJson<T>(key: string): T | null {
  try { const raw = globalThis.localStorage?.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}
function remove(key: string) { try { globalThis.localStorage?.removeItem(key); } catch { /* ignore */ } }

export function readAcceptedVersion(backend: string, userId: string): string | null {
  const cached = readJson<{ version?: string }>(scoped(CACHE_PREFIX, backend, userId));
  if (typeof cached?.version === 'string') return cached.version;
  const pending = readPendingConsents(backend, userId);
  return pending?.items.find(item => item.kind === 'terms' && item.granted)?.version ?? null;
}
export function rememberAcceptedVersion(backend: string, userId: string, version: string) {
  writeJson(scoped(CACHE_PREFIX, backend, userId), { version, at: new Date().toISOString() });
}

interface PendingConsents { items: ConsentItem[]; source: string | null; appVersion: string | null }
export function readPendingConsents(backend: string, userId: string): PendingConsents | null {
  const value = readJson<PendingConsents>(scoped(PENDING_PREFIX, backend, userId));
  return value && Array.isArray(value.items) && value.items.length ? value : null;
}
/** Merge into the pending batch (a newer decision of the same kind replaces the older one). */
function savePending(backend: string, userId: string, value: PendingConsents) {
  const previous = readPendingConsents(backend, userId);
  const kinds = new Set(value.items.map(item => item.kind));
  const items = [...(previous?.items.filter(item => !kinds.has(item.kind)) ?? []), ...value.items].slice(-12);
  writeJson(scoped(PENDING_PREFIX, backend, userId), { ...value, items });
}
function clearPending(backend: string, userId: string) { remove(scoped(PENDING_PREFIX, backend, userId)); }

// ── Server calls ────────────────────────────────────────────────────────────────────────
export function consentSource(): 'ios' | 'android' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android' ? platform : 'web';
  } catch { return 'web'; }
}

export async function consentAppVersion(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');
      return (await App.getInfo()).version || null;
    }
  } catch { /* fall through */ }
  const env = (import.meta as any).env?.VITE_APP_VERSION;
  return typeof env === 'string' && env ? env.slice(0, 32) : null;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('CONSENT_TIMEOUT')), ms);
    Promise.resolve(promise).then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

/** my_consents_v1; null when unavailable (offline, timeout, RPC missing, malformed). */
export async function fetchConsentState(timeoutMs = CONSENT_RPC_TIMEOUT_MS): Promise<ConsentState | null> {
  try {
    const { data, error } = await withTimeout(supabase.rpc('my_consents_v1' as any), timeoutMs) as { data: unknown; error: unknown };
    if (error) return null;
    return parseConsentState(data);
  } catch { return null; }
}

/** record_consents_v1; throws on failure, returns the fresh state on success. */
export async function recordConsents(items: ConsentItem[]): Promise<ConsentState | null> {
  const appVersion = await consentAppVersion();
  const { data, error } = await withTimeout(supabase.rpc('record_consents_v1' as any, {
    p_items: items, p_source: consentSource(), p_app_version: appVersion,
  } as any), CONSENT_RPC_TIMEOUT_MS) as { data: unknown; error: unknown };
  if (error) throw error;
  return parseConsentState(data);
}

/**
 * Gate acceptance: record on the server; if that fails, keep the decision locally so the user is not asked
 * again and retry with flushPendingConsents(). Either way the accepted version is cached for this user.
 */
export async function acceptConsentGate(backend: string, userId: string, choices: Partial<GateChoices>, version: string, kvkk = false):
  Promise<{ synced: boolean; state: ConsentState | null }> {
  const items = gateItems(choices, version, kvkk);
  rememberAcceptedVersion(backend, userId, version);
  try {
    const state = await recordConsents(items);
    clearPending(backend, userId);
    return { synced: true, state };
  } catch {
    savePending(backend, userId, { items, source: consentSource(), appVersion: await consentAppVersion() });
    return { synced: false, state: null };
  }
}

/** Retry an acceptance that could not be sent. Drops it when the server no longer accepts that version. */
export async function flushPendingConsents(backend: string, userId: string): Promise<boolean> {
  const pending = readPendingConsents(backend, userId);
  if (!pending) return true;
  try {
    await recordConsents(pending.items);
    clearPending(backend, userId);
    return true;
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (/CONSENT_(VERSION_MISMATCH|ITEMS_INVALID|KIND_INVALID|REQUIRED_NOT_WITHDRAWABLE)/.test(message)) {
      clearPending(backend, userId);
      remove(scoped(CACHE_PREFIX, backend, userId));
    }
    return false;
  }
}

// ── Anacan.AI first-use consent (kind ai_assistant) ─────────────────────────────────────
const AI_PREFIX = 'anacan_ai_consent_v1';
export type AiConsentDecision = 'open' | 'ask';

export function readLocalAiConsent(backend: string, userId: string): boolean | null {
  const value = readJson<{ granted?: boolean }>(scoped(AI_PREFIX, backend, userId));
  return typeof value?.granted === 'boolean' ? value.granted : null;
}
function rememberAiConsent(backend: string, userId: string, granted: boolean) {
  writeJson(scoped(AI_PREFIX, backend, userId), { granted, at: new Date().toISOString() });
}

/**
 * The chat opens only with a granted ai_assistant consent (server first, this device's decision when offline),
 * or when the consent gate is switched off in app_settings. Without either it asks; asking never blocks the app.
 */
export function decideAiConsent(state: ConsentState | null, local: boolean | null): AiConsentDecision {
  if (state) {
    if (!state.gate.enabled) return 'open';
    const row = state.consents.ai_assistant;
    if (row) return row.granted ? 'open' : 'ask';
    return local === true ? 'open' : 'ask';
  }
  return local === true ? 'open' : 'ask';
}

/** Records the AI consent (granted or withdrawn); kept locally and retried when the server is unreachable. */
export async function setAiConsent(backend: string, userId: string, granted: boolean, version: string | null, kvkk = false):
  Promise<{ synced: boolean; state: ConsentState | null }> {
  const item: ConsentItem = { kind: 'ai_assistant', granted, version: version || FALLBACK_CONSENT_VERSION, ...(kvkk ? { variant: 'kvkk_tr' as const } : {}) };
  rememberAiConsent(backend, userId, granted);
  try {
    const state = await recordConsents([item]);
    return { synced: true, state };
  } catch {
    savePending(backend, userId, { items: [item], source: consentSource(), appVersion: await consentAppVersion() });
    return { synced: false, state: null };
  }
}

/** Keep this device's AI decision in line with the server (e.g. withdrawn on another device). */
export function syncLocalAiConsent(backend: string, userId: string, state: ConsentState | null) {
  const row = state?.consents.ai_assistant;
  if (row) rememberAiConsent(backend, userId, row.granted);
}
