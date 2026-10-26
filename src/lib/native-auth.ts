// Native OAuth (iOS/Android) via Firebase Auth + Apple Sign-In plugins.
// Returns Supabase-compatible tokens (idToken + optional nonce) that we exchange
// via supabase.auth.signInWithIdToken().

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

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    throw new Error("Google Sign-In returned no idToken");
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
