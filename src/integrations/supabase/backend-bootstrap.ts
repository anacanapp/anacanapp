import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ADMISSION_PIN_KEY, ADMISSION_URL, INITIAL_SOURCE_ADMISSION, BackendAdmissionError,
  advanceAdmission, assertAdmissionReady, parseAdmissionPin, parseBackendAdmission,
  reconcileAdmissionPins, sameAdmission, type BackendAdmission } from './backend-admission';
import { getBackendConfig, selectAdmittedBackend, usesSourceFirstBootstrap } from './backend-config';
import { writeStorageItem } from '@/lib/local-storage';

let booting: Promise<void> | undefined;

/** Outcome of one control read.
 * - `unavailable`: offline, timeout, outage status; nothing was decided.
 * - `malformed`: not the control document at all (non-200, non-JSON such as a captive portal
 *   or proxy HTML page, missing no-store, oversized or unparseable body).
 * - `invalid`: a JSON no-store document from the control URL that is not an acceptable policy. */
export type AdmissionProbe = { kind: 'policy'; policy: BackendAdmission } | { kind: 'unavailable' }
  | { kind: 'malformed' } | { kind: 'invalid' };

/** Public control request only. Never send an API key, session or device/user ID. */
export async function probeBackendAdmission(): Promise<AdmissionProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    let response: Response;
    try {
      response = await fetch(ADMISSION_URL, { method: 'GET', cache: 'no-store', credentials: 'omit',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
    } catch { return { kind: 'unavailable' }; } // Offline: retain the last authority; never invent Azure readiness.
    // A disabled/blocked Azure subscription may return 401/403 rather than 5xx.
    // The control document is public: these are availability failures, not new
    // authority decisions. Existing Azure/maintenance pins remain latched below.
    if ([401, 403, 404, 408, 429].includes(response.status) || response.status >= 500) return { kind: 'unavailable' };
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')
      || !response.headers.get('cache-control')?.split(',').some(value => value.trim() === 'no-store')) {
      return { kind: 'malformed' };
    }
    let text: string;
    try { text = await response.text(); } catch { return { kind: 'unavailable' }; }
    if (text.length > 2048) return { kind: 'malformed' };
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { kind: 'malformed' }; }
    try { return { kind: 'policy', policy: parseBackendAdmission(parsed) }; }
    catch { return { kind: 'invalid' }; }
  } finally { clearTimeout(timeout); }
}

/** Startup read. A control document that fails validation blocks startup (ADMISSION_INVALID).
 * Something that is not the control document at all (captive portal / proxy HTML, a redirect,
 * a cacheable or unparseable body) carries no decision: it is handled exactly like offline,
 * so the device keeps its pinned authority and opens instead of stopping on the retry screen.
 * It can never select or advance an authority. */
export async function fetchBackendAdmission(): Promise<BackendAdmission | null> {
  const probe = await probeBackendAdmission();
  if (probe.kind === 'policy') return probe.policy;
  if (probe.kind === 'unavailable' || probe.kind === 'malformed') return null;
  throw new BackendAdmissionError('ADMISSION_INVALID');
}

/** Must finish before importing client, App, i18n, crashReporter or native.ts. */
export function bootstrapBackend(): Promise<void> {
  if (!usesSourceFirstBootstrap()) return Promise.resolve();
  if (booting) return booting;
  booting = (async () => {
    // This protocol is for the existing native app origin, never a Lovable frame.
    if (!Capacitor.isNativePlatform() || typeof window === 'undefined'
      || window.location.hostname !== 'app.anacan.az'
      || !['https:', 'capacitor:'].includes(window.location.protocol)) {
      throw new BackendAdmissionError('ADMISSION_CONFIGURATION');
    }
    let storage: Storage;
    let pin: ReturnType<typeof parseAdmissionPin>;
    try {
      storage = window.localStorage;
      const native = await Preferences.get({ key: ADMISSION_PIN_KEY });
      pin = reconcileAdmissionPins(parseAdmissionPin(storage.getItem(ADMISSION_PIN_KEY)), parseAdmissionPin(native.value));
    } catch { throw new BackendAdmissionError('ADMISSION_STORAGE'); }

    const remote = await fetchBackendAdmission();
    let initial = INITIAL_SOURCE_ADMISSION;
    if (import.meta.env.VITE_NATIVE_BUILD === 'true' && import.meta.env.VITE_INITIAL_MANAGED_ADMISSION) {
      initial = parseBackendAdmission(JSON.parse(import.meta.env.VITE_INITIAL_MANAGED_ADMISSION));
      if (initial.phase !== 'azure') throw new BackendAdmissionError('ADMISSION_CONFIGURATION');
    }
    if (initial.phase === 'azure' && remote?.phase === 'source') {
      throw new BackendAdmissionError('ADMISSION_ROLLBACK');
    }
    // A verified post-cutover native default is an authority floor. A stale
    // Source control response cannot move a new installation back to Source.
    // Keep an observed maintenance pin latched until a newer live decision.
    const retainedPin = initial.phase === 'azure' && (!pin || pin.policy.phase === 'source'
      || pin.policy.phase === 'azure' && pin.policy.generation < initial.generation)
      ? advanceAdmission(pin, initial) : pin;
    const next = advanceAdmission(retainedPin, remote ?? retainedPin?.policy ?? initial);
    const value = JSON.stringify(next);
    try {
      // Preferences survives WebView storage eviction/app upgrades. Write it first,
      // before allowing any target SDK/token rotation. A partial write blocks boot.
      await Preferences.set({ key: ADMISSION_PIN_KEY, value });
      writeStorageItem(storage, ADMISSION_PIN_KEY, value);
    } catch { throw new BackendAdmissionError('ADMISSION_STORAGE'); }
    assertAdmissionReady(next, import.meta.env.VITE_APP_VERSION);
    selectAdmittedBackend(next);
  })();
  return booting;
}

/** Changes take effect only after a full bootstrap, never by rebinding a live SDK.
 * Server-side source freeze/drain is still required for in-flight/older clients. */
export function watchBackendAdmission(onChange: () => void | Promise<void>): () => void {
  if (!usesSourceFirstBootstrap()) return () => {};
  const current = getBackendConfig().admission!;
  let stopped = false, checking = false, invalidStreak = 0;
  const check = async () => {
    if (stopped || checking || document.visibilityState === 'hidden') return;
    checking = true;
    let changed = false;
    try {
      const probe = await probeBackendAdmission();
      if (probe.kind === 'policy') {
        invalidStreak = 0;
        changed = !sameAdmission(current.policy, probe.policy);
      } else if (probe.kind === 'invalid') {
        // A JSON control document that fails validation must not leave a live writer
        // running forever; require it on two consecutive reads so one odd answer
        // (a JSON-speaking proxy) cannot restart the app. Startup then blocks on it.
        invalidStreak += 1;
        changed = invalidStreak >= 2;
      } else {
        // Offline/outage, captive portal or proxy HTML, truncated body: no decision.
        // Keep running on the admitted authority and check again later.
        invalidStreak = 0;
      }
    } catch {
      invalidStreak = 0;
    } finally { checking = false; }
    if (changed && !stopped) {
      stopped = true;
      await onChange();
    }
  };
  const timer = setInterval(() => { void check(); }, 60_000);
  const wake = () => { void check(); };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake); };
}
