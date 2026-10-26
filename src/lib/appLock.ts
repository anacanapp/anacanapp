import { Capacitor } from '@capacitor/core';

/**
 * Təhlükəsizlik kilidi — cihaz səviyyəsində PIN + biometrika.
 * PIN heç vaxt açıq saxlanılmır: SHA-256(salt + pin) localStorage-da.
 * Biometrika: @capgo/capacitor-native-biometric (yalnız native, dinamik import,
 * plugin sync olunmayıbsa səssizcə gizlənir).
 */

const K_ENABLED = 'anacan_lock_enabled';
const K_HASH = 'anacan_lock_hash';
const K_SALT = 'anacan_lock_salt';
const K_BIO = 'anacan_lock_bio';
const K_LAST_BG = 'anacan_lock_last_bg';

/** Arxa fonda bu qədərdən çox qalanda qayıdışda yenidən kilidlənir. */
export const BACKGROUND_LOCK_MS = 30_000;

export const PIN_LENGTH = 4;

// ── Hash yardımçıları ──────────────────────────────────────────
const toHex = (buf: ArrayBuffer): string =>
Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
};

export const hashPin = async (pin: string, salt: string): Promise<string> => {
  const data = new TextEncoder().encode(`${salt}:${pin}:anacan`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

// ── PIN idarəetməsi ────────────────────────────────────────────
export const isLockEnabled = (): boolean => {
  try {
    return localStorage.getItem(K_ENABLED) === '1' && !!localStorage.getItem(K_HASH);
  } catch {
    return false;
  }
};

export const setPin = async (pin: string): Promise<void> => {
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(K_SALT, salt);
  localStorage.setItem(K_HASH, hash);
  localStorage.setItem(K_ENABLED, '1');
};

export const verifyPin = async (pin: string): Promise<boolean> => {
  try {
    const salt = localStorage.getItem(K_SALT);
    const stored = localStorage.getItem(K_HASH);
    if (!salt || !stored) return false;
    const hash = await hashPin(pin, salt);
    return hash === stored;
  } catch {
    return false;
  }
};

export const disableLock = (): void => {
  localStorage.removeItem(K_ENABLED);
  localStorage.removeItem(K_HASH);
  localStorage.removeItem(K_SALT);
  localStorage.removeItem(K_BIO);
  localStorage.removeItem(K_LAST_BG);
};

// ── Biometrika ─────────────────────────────────────────────────
export const isBiometricPrefEnabled = (): boolean => {
  try {
    return localStorage.getItem(K_BIO) === '1';
  } catch {
    return false;
  }
};

export const setBiometricPref = (enabled: boolean): void => {
  if (enabled) localStorage.setItem(K_BIO, '1');else
  localStorage.removeItem(K_BIO);
};

/** Cihazda biometrika mövcuddurmu (yalnız native, plugin quraşdırılıbsa). */
export const isBiometricAvailable = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return !!result?.isAvailable;
  } catch {
    return false;
  }
};

/** Biometrik doğrulama — uğurda true. */
export const verifyBiometric = async (reason: string, title: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason,
      title,
      maxAttempts: 3
    });
    return true;
  } catch {
    return false;
  }
};

// ── Arxa fon vaxtı (auto-lock) ─────────────────────────────────
export const markBackgrounded = (): void => {
  try {
    localStorage.setItem(K_LAST_BG, String(Date.now()));
  } catch {/* boş */}
};

export const shouldRelock = (): boolean => {
  if (!isLockEnabled()) return false;
  try {
    const ts = Number(localStorage.getItem(K_LAST_BG) || 0);
    if (!ts) return false;
    return Date.now() - ts > BACKGROUND_LOCK_MS;
  } catch {
    return false;
  }
};

export const clearBackgroundMark = (): void => {
  try {
    localStorage.removeItem(K_LAST_BG);
  } catch {/* boş */}
};
