import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ADMISSION_PIN_KEY, ADMISSION_URL, INITIAL_SOURCE_ADMISSION, BackendAdmissionError,
  advanceAdmission, assertAdmissionReady, parseAdmissionPin, parseBackendAdmission,
  reconcileAdmissionPins, sameAdmission, type BackendAdmission } from './backend-admission';
import { getBackendConfig, selectAdmittedBackend, usesSourceFirstBootstrap } from './backend-config';
import { writeStorageItem } from '@/lib/local-storage';

let booting: Promise<void> | undefined;

/** Public control request only. Never send an API key, session or device/user ID. */
export async function fetchBackendAdmission(): Promise<BackendAdmission | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    let response: Response;
    try {
      response = await fetch(ADMISSION_URL, { method: 'GET', cache: 'no-store', credentials: 'omit',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
    } catch { return null; } // Offline: retain the last authority; never invent Azure readiness.
    // A disabled/blocked Azure subscription may return 401/403 rather than 5xx.
    // The control document is public: these are availability failures, not new
    // authority decisions. Existing Azure/maintenance pins remain latched below.
    if ([401, 403, 404, 408, 429].includes(response.status) || response.status >= 500) return null;
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')
      || !response.headers.get('cache-control')?.split(',').some(value => value.trim() === 'no-store')) {
      throw new BackendAdmissionError('ADMISSION_INVALID');
    }
    let text: string;
    try { text = await response.text(); } catch { return null; }
    if (text.length > 2048) throw new BackendAdmissionError('ADMISSION_INVALID');
    try { return parseBackendAdmission(JSON.parse(text)); }
    catch { throw new BackendAdmissionError('ADMISSION_INVALID'); }
  } finally { clearTimeout(timeout); }
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
  let stopped = false, checking = false;
  const check = async () => {
    if (stopped || checking || document.visibilityState === 'hidden') return;
    checking = true;
    let changed = false;
    try {
      const remote = await fetchBackendAdmission();
      changed = !!remote && !sameAdmission(current.policy, remote);
    } catch {
      // An invalid published policy must not leave a live writer running forever.
      changed = true;
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
