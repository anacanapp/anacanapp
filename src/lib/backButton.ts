import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { tr } from '@/lib/tr';

/**
 * Android hardware geri düyməsi — mərkəzi idarəetmə.
 *
 * Problem: heç bir backButton listener yox idi → istənilən ekranda geri
 * basanda tətbiq bağlanırdı (state-əsaslı naviqasiya history istifadə etmir).
 *
 * Həll: handler stack-i. Komponentlər öz "geri" məntiqini qeydiyyatdan keçirir
 * (ən son qeydiyyatdan keçən birinci soruşulur). Heç kim istehlak etməzsə —
 * ana ekranda "çıxmaq üçün yenidən bas" (2 saniyə pəncərə).
 */

/** true qaytarsa = geri basışı istehlak etdi (tətbiq bağlanmır). */
export type BackHandler = () => boolean;

const handlers: BackHandler[] = [];
let lastBackPress = 0;
let initialized = false;

/** Handler qeydiyyatı. Sökülmə funksiyası qaytarır (useEffect cleanup üçün). */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i !== -1) handlers.splice(i, 1);
  };
}

function dispatchBack(): boolean {
  // Ən son əlavə olunandan başla (ən dərin UI qatı)
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch (e) {
      console.error('Back handler error:', e);
    }
  }
  return false;
}

/** main.tsx-dən bir dəfə çağırılır. Yalnız Android-də aktivdir. */
export function initBackButtonHandler(): void {
  if (initialized) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  initialized = true;

  CapacitorApp.addListener('backButton', () => {
    // 1) UI qatları (sheet/tool/screen) — kimsə istehlak etsə dayan
    if (dispatchBack()) return;

    // 2) Kök səviyyə: 2 saniyə ərzində ikinci basış → çıx
    const now = Date.now();
    if (now - lastBackPress < 2000) {
      CapacitorApp.exitApp();
    } else {
      lastBackPress = now;
      toast(tr('back_press_again', 'Çıxmaq üçün yenidən basın'), { duration: 1800 });
    }
  });
}
