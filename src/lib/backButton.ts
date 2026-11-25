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
 * Həll: qatlı handler stack-i. Komponentlər öz "geri" məntiqini qeydiyyatdan
 * keçirir. Qatlar bu ardıcıllıqla soruşulur:
 *   1) `overlay` — açıq Dialog/AlertDialog/Sheet/Drawer (ən son açılan birinci).
 *      Geri əvvəlcə yalnız üstdəki pəncərəni bağlayır; altdakı ekran və onun
 *      formasındakı yazılmış mətn toxunulmaz qalır.
 *   2) `screen` — ekran/alət daxili naviqasiya (defolt, köhnə davranış).
 *   3) `root` — Index-in ekran iyerarxiyası (tab → home).
 * Qat daxilində ən son qeydiyyatdan keçən birinci soruşulur. Heç kim istehlak
 * etməzsə — ana ekranda "çıxmaq üçün yenidən bas" (2 saniyə pəncərə).
 */

/** true qaytarsa = geri basışı istehlak etdi (tətbiq bağlanmır). */
export type BackHandler = () => boolean;
export type BackLayer = 'overlay' | 'screen' | 'root';

const LAYER_ORDER: readonly BackLayer[] = ['overlay', 'screen', 'root'];
const handlers: Record<BackLayer, BackHandler[]> = { overlay: [], screen: [], root: [] };
let lastBackPress = 0;
let initialized = false;

/** Handler qeydiyyatı. Sökülmə funksiyası qaytarır (useEffect cleanup üçün). */
export function pushBackHandler(handler: BackHandler, layer: BackLayer = 'screen'): () => void {
  const list = handlers[layer];
  list.push(handler);
  return () => {
    const i = list.lastIndexOf(handler);
    if (i !== -1) list.splice(i, 1);
  };
}

/** Geri basışını qatlar üzrə yayır. Kimsə istehlak etsə true. */
export function dispatchBack(): boolean {
  for (const layer of LAYER_ORDER) {
    const list = handlers[layer];
    // Ən son əlavə olunandan başla (ən dərin UI qatı)
    for (let i = list.length - 1; i >= 0; i--) {
      try {
        if (list[i]()) return true;
      } catch (e) {
        console.error('Back handler error:', e);
      }
    }
  }
  return false;
}

/** Yalnız testlər üçün. */
export function __resetBackHandlersForTests(): void {
  for (const layer of LAYER_ORDER) handlers[layer].length = 0;
}

/** main.tsx-dən bir dəfə çağırılır. Yalnız Android-də aktivdir. */
export function initBackButtonHandler(): void {
  if (initialized) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  initialized = true;

  CapacitorApp.addListener('backButton', () => {
    // 1) UI qatları (overlay → screen → root) — kimsə istehlak etsə dayan
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
