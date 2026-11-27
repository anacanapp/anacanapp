// Native OAuth (iOS/Android) via Firebase Auth + Apple Sign-In plugins.
// Returns Supabase-compatible tokens (idToken + optional nonce) that we exchange
// via supabase.auth.signInWithIdToken().

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const isNative = (): boolean => {
  const cap = (window as any)?.Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform();
};

// handle_new_user() DB trigger-inin ad tapmadıqda yazdığı defolt dəyər
// (supabase/son/Son8.sql). signInWithIdToken() ID token-dən kənar heç bir
// profil məlumatı qəbul etmir — trigger bunu HƏMİŞƏ bu placeholder ilə
// yaradır, əgər raw_user_meta_data.name yoxdursa (Apple-da həmişə belədir).
const DEFAULT_PLACEHOLDER_NAME = "İstifadəçi";

/**
 * Provayderdən (Apple/Google) real ad gəlibsə, dərhal profilə yazır —
 * YALNIZ hazırkı ad hələ də defolt placeholder-dirsə (istifadəçi özü ad
 * dəyişdiribsə üzərinə yazılmır). Bu, məcburi "Adınızı deyin" ekranının
 * çoxu istifadəçi üçün ümumiyyətlə görünməməsini təmin edir. Uğursuz olsa
 * belə kritik deyil — onboarding-dəki məcburi ad addımı son fallback-dır.
 */
async function applyProviderNameIfDefault(userId: string | undefined, providerName: string | undefined | null) {
  const name = providerName?.trim();
  if (!name || !userId) return;
  try {
    await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", userId)
      .eq("name", DEFAULT_PLACEHOLDER_NAME);
  } catch {
    // kritik deyil
  }
}

/**
 * Native Google Sign-In using @capacitor-firebase/authentication.
 * Works on both iOS and Android — Firebase handles the platform bits.
 */
export async function signInWithGoogleNative() {
  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );

  // Sign out of any prior Firebase session so account picker shows every time.
  try {
    await FirebaseAuthentication.signOut();
  } catch {}

  // Errors from the native picker step are tagged so the caller can classify them
  // (cancel / old-device unavailable → browser fallback) without confusing them
  // with backend (signInWithIdToken) errors below.
  let result: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>>;
  try {
    result = await FirebaseAuthentication.signInWithGoogle();
  } catch (error) {
    throw new GoogleNativePickerError(error);
  }
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    throw new GoogleNativePickerError(new Error("Google Sign-In returned no idToken"));
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;

  // Google Firebase user obyekti displayName-i həmişə verir (Apple-dan fərqli
  // olaraq bir dəfəlik deyil) — placeholder ad hələ dəyişdirilməyibsə tətbiq et.
  await applyProviderNameIfDefault(data?.user?.id, result?.user?.displayName);

  return data;
}

/** Failure of the native Google account picker (not of the backend exchange). */
export class GoogleNativePickerError extends Error {
  readonly cause: unknown;
  readonly code: string;
  constructor(cause: unknown) {
    const record = (cause ?? {}) as { message?: unknown; code?: unknown };
    super(typeof record.message === "string" ? record.message : String(cause));
    this.name = "GoogleNativePickerError";
    this.cause = cause;
    this.code = record.code == null ? "" : String(record.code);
  }
}

// ── Browser OAuth fallback (old Android phones) ─────────────────────────────
// When Credential Manager / Play Services cannot show the Google picker, the
// regular Supabase OAuth flow runs in the system browser and returns to the app
// through the already-registered custom scheme (AndroidManifest:
// com.atlasoon.anacan). The backend's redirect allow-list must contain
// NATIVE_OAUTH_REDIRECT for the return hop to reach the app.
export const NATIVE_OAUTH_REDIRECT = "com.atlasoon.anacan://auth-callback";

interface BrowserPlugin {
  open(options: { url: string; presentationStyle?: "fullscreen" | "popover" }): Promise<void>;
  close(): Promise<void>;
}
// Resolves to @capacitor/browser when a build includes it; otherwise the system browser is used.
const Browser = registerPlugin<BrowserPlugin>("Browser");

export function isNativeOAuthCallback(url: string | undefined | null): boolean {
  return typeof url === "string" && url.startsWith(NATIVE_OAUTH_REDIRECT);
}

/** Parses tokens (implicit flow) or a code (PKCE) from the callback URL. Never logs them. */
export function parseNativeOAuthCallback(url: string): { accessToken?: string; refreshToken?: string; code?: string; error?: string } {
  const out: { accessToken?: string; refreshToken?: string; code?: string; error?: string } = {};
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));
    out.accessToken = params.get("access_token") || undefined;
    out.refreshToken = params.get("refresh_token") || undefined;
    out.code = params.get("code") || undefined;
    out.error = params.get("error_description") || params.get("error") || undefined;
  } catch {
    out.error = "invalid_callback";
  }
  return out;
}

/** Completes the browser OAuth hop. Returns true when a session was stored. */
export async function completeNativeOAuthCallback(url: string): Promise<boolean> {
  if (!isNativeOAuthCallback(url)) return false;
  const { accessToken, refreshToken, code } = parseNativeOAuthCallback(url);
  try { await Browser.close(); } catch { /* system browser or already closed */ }
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return !error;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}

let callbackListener: Promise<PluginListenerHandle> | null = null;
async function ensureNativeOAuthCallbackListener(): Promise<void> {
  if (callbackListener) return;
  const { App } = await import("@capacitor/app");
  callbackListener = App.addListener("appUrlOpen", (event) => {
    if (isNativeOAuthCallback(event.url)) void completeNativeOAuthCallback(event.url).catch(() => {});
  });
}

/** Starts Google OAuth in the system browser; the session arrives via the app link. */
export async function signInWithGoogleBrowserFallback(): Promise<void> {
  await ensureNativeOAuthCallbackListener();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  const url = data?.url;
  if (!url) throw new Error("Google OAuth URL unavailable");
  const cap = (window as any)?.Capacitor;
  if (cap?.isPluginAvailable?.("Browser")) {
    try {
      await Browser.open({ url, presentationStyle: "fullscreen" });
      return;
    } catch { /* fall through to the system browser */ }
  }
  // Google blocks OAuth inside embedded WebViews: open it outside the app.
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Native Apple Sign-In (iOS only).
 * Uses @capacitor-community/apple-sign-in for a native flow — no browser popup.
 */
export async function signInWithAppleNative() {
  const platform = (window as any)?.Capacitor?.getPlatform?.();
  if (platform !== "ios") {
    throw new Error("Apple Sign-In native flow is iOS-only");
  }

  const { SignInWithApple } = await import(
    "@capacitor-community/apple-sign-in"
  );

  // A random nonce, hashed with SHA-256 for Apple, raw sent to Supabase.
  const rawNonce = generateNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  // Plugin tipləri clientId/redirectURI tələb edir, amma native iOS axınında
  // istifadə olunmurlar (yalnız web axını üçündür) — davranış dəyişmir.
  const res = await SignInWithApple.authorize({
    clientId: "com.atlasoon.anacan",
    redirectURI: `${window.location.origin}/`,
    scopes: "email name",
    state: "signin",
    nonce: hashedNonce,
  } as any);

  const idToken = res?.response?.identityToken;
  if (!idToken) throw new Error("Apple Sign-In returned no identityToken");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple givenName/familyName-i YALNIZ ilk icazədə göndərir (məxfilik
  // siyasəti) — sonrakı girişlərdə null olur. Apple-ın JWT-si heç vaxt ad
  // claim-i daşımır, ona görə bu, ADın tutulduğu YEGANƏ məqamdır.
  const fullName = [res?.response?.givenName, res?.response?.familyName]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(" ")
    .trim();
  await applyProviderNameIfDefault(data?.user?.id, fullName || null);

  return data;
}

function generateNonce(length = 32): string {
  const charset =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
