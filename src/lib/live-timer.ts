// Kilid ekranı taymer körpüsü — timerStore ilə native LiveActivity plugin-i arasında.
// iOS: ActivityKit Live Activity (Lock Screen + Dynamic Island)
// Android: Foreground Service xronometr bildirişi
// Native mövcud deyilsə (web / köhnə iOS / widget target quraşdırılmayıb) →
// köhnə davamlı lokal bildirişə fallback.
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { tr } from '@/lib/tr';
import { isNative } from '@/lib/native';
import LiveActivity, { type PendingTimerStop } from '@/plugins/LiveActivityPlugin';
import { showTimerNotification, clearTimerNotification } from '@/utils/timerNotifications';
import type { ActiveTimer, TimerType } from '@/store/timerStore';

const TYPE_LABELS = (): Record<TimerType, string> => ({
  sleep: tr('timernotifications_yuxu_eb2b53', '😴 Yuxu'),
  feeding: tr('timernotifications_emizdirme_af3cc9', '🍼 Əmizdirmə'),
  diaper: tr('timernotifications_bez_deyisdirme_cfec83', '🧷 Bez dəyişdirmə'),
  'white-noise': tr('timernotifications_kuy_sesi_1de6fc', '🔊 Küy Səsi'),
});

// Hansı taymerlər üçün native aktivlik alınıb (fallback qərarları üçün)
const nativeActive = new Set<string>();

export async function startNativeTimer(timer: ActiveTimer): Promise<void> {
  if (!isNative) return;
  const labels = TYPE_LABELS();
  const base = timer.label || labels[timer.type] || 'Timer';
  const feedSuffix = timer.feedType
    ? ` (${timer.feedType === 'left' ? tr('timernotifications_sol', 'Sol') : tr('timernotifications_sag_edbe12', 'Sağ')})`
    : '';
  // Əkiz/üçüzlərdə hansı körpəyə aid olduğunu kilid ekranında da göstər (yalnız
  // birdən çox uşaq olanda childName ötürülür — bax Dashboard.tsx timerChildName)
  const childPrefix = timer.childName ? `${timer.childName} — ` : '';
  try {
    await LiveActivity.startActivity({
      id: timer.id,
      type: timer.type,
      label: `${childPrefix}${base}${feedSuffix}`,
      subLabel: tr('livetimer_davam_edir', 'Davam edir — dayandırmaq üçün düyməyə basın'),
      stopLabel: tr('livetimer_dayandir', 'Dayandır'),
      startTime: timer.startTime,
      feedType: timer.feedType,
      channelName: tr('livetimer_channel_name', 'Taymerlər'),
      channelDesc: tr('livetimer_channel_desc', 'Aktiv süd vermə / yuxu taymerləri'),
    });
    nativeActive.add(timer.id);
  } catch (e) {
    // Live Activity mümkün deyil → köhnə davamlı bildiriş
    console.warn('LiveActivity start fallback:', e);
    // MÜVƏQQƏTİ DİAQNOSTİKA (iOS widget "düşmür" problemi araşdırılır) — native
    // tərəfin dəqiq rədd səbəbini (məs. "Live Activities disabled by user")
    // Xcode konsoluna ehtiyac olmadan birbaşa ekranda göstərir. Problem
    // tapılandan sonra bu toast silinəcək.
    if (Capacitor.getPlatform() === 'ios') {
      const reason = (e as any)?.message || (e as any)?.errorMessage || String(e);
      toast.error(`LiveActivity başlamadı: ${reason}`, { duration: 8000 });
    }
    showTimerNotification(timer.id, timer.type, `${childPrefix}${base}`, timer.feedType);
  }
}

export async function stopNativeTimer(timerId: string): Promise<void> {
  if (!isNative) return;
  if (nativeActive.has(timerId)) {
    nativeActive.delete(timerId);
    try {
      await LiveActivity.stopActivity({ timerId });
      return;
    } catch (e) {
      console.warn('LiveActivity stop error:', e);
    }
  }
  // Fallback bildirişini təmizlə (hər iki halda zərərsizdir)
  clearTimerNotification(timerId);
  // Restart-dan sonra nativeActive boş ola bilər — native tərəfi yenə də yoxla
  try { await LiveActivity.stopActivity({ timerId }); } catch { /* plugin yoxdursa keç */ }
}

/**
 * Widget/bildirişdən dayandırılmış taymerləri emal et:
 * hər biri üçün `save` çağırılır (baby_logs-a yazmaq üçün).
 *
 * DÜZƏLİŞ ("widget-dən stop qeyd yaratmır" bug-ı): əvvəllər siyahı save-dən
 * ƏVVƏL təmizlənirdi və save xətaları udulurdu — soyuq açılışda auth/uşaq
 * siyahısı hələ hazır olmayanda sessiya birdəfəlik itirdi. İndi `save`
 * boolean qaytarır (true = yazıldı/qəsdən ötürüldü, false = sonra yenidən
 * cəhd et) və siyahı YALNIZ hamısı uğurlu olduqda təmizlənir — uğursuz
 * hallar növbəti çağırışda (resume/mount) yenidən emal olunur.
 */
export async function processPendingStops(
  save: (stop: PendingTimerStop) => Promise<boolean> | boolean
): Promise<number> {
  if (!isNative) return 0;
  try {
    const { stops } = await LiveActivity.getPendingStops();
    if (!stops?.length) return 0;
    let allOk = true;
    for (const s of stops) {
      nativeActive.delete(s.id);
      try {
        const ok = await save(s);
        if (!ok) allOk = false;
      } catch (e) {
        console.warn('pending stop save error:', e);
        allOk = false;
      }
    }
    if (allOk) await LiveActivity.clearPendingStops();
    return stops.length;
  } catch {
    return 0;
  }
}

/** Android canlı "timerStopped" hadisəsi üçün dinləyici (pending siyahısını işə salır) */
export function onNativeTimerStopped(cb: () => void): () => void {
  if (!isNative) return () => {};
  let handle: { remove: () => void } | null = null;
  let cancelled = false;
  LiveActivity.addListener('timerStopped', () => cb())
    .then((h) => {
      // Cleanup ran before addListener resolved: drop the late listener.
      if (cancelled) { void h.remove(); return; }
      handle = h;
    })
    .catch(() => {});
  return () => { cancelled = true; handle?.remove(); handle = null; };
}
