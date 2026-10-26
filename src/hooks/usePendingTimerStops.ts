import { useCallback, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { useTimerStore } from '@/store/timerStore';
import { isNative } from '@/lib/native';
import { processPendingStops, onNativeTimerStopped } from '@/lib/live-timer';
import type { PendingTimerStop } from '@/plugins/LiveActivityPlugin';

/**
 * Kilid ekranı widget-indən (iOS Live Activity) / bildirişdən (Android FGS)
 * dayandırılmış taymerlərin baby_logs-a yazılması.
 *
 * DÜZƏLİŞ ("widget-dən Süd/Yuxu stop-u qeyd yaratmır" bug-ı) — 3 kök səbəb:
 *  1) Emal əvvəllər yalnız şərti render olunan FloatingTimerWidget-də idi və
 *     mount-un İLK render-ində işə düşürdü — useChildren hələ yüklənmədiyi
 *     üçün qeyd child_id=NULL ilə yazılırdı; UI isə child_id-yə görə
 *     filtrlədiyindən qeyd HEÇ YERDƏ görünmürdü ("X-ə basıb çıxmaq kimi").
 *     → İndi bu hook Index səviyyəsində HƏMİŞƏ aktivdir və auth+uşaq siyahısı
 *       hazır olmayana qədər save "false" qaytarır (sonra yenidən cəhd).
 *  2) Pending siyahısı save-dən ƏVVƏL silinirdi — uğursuzluqda sessiya
 *     birdəfəlik itirdi. → live-timer.processPendingStops artıq yalnız
 *     hamısı uğurlu olanda təmizləyir.
 *  3) child_id taymerin özündən (timerStore.childId — persist olunur) və ya
 *     yüklənmiş selectedChild-dən götürülür, açıq şəkildə addLog-a ötürülür.
 */
export const usePendingTimerStops = () => {
  const { user } = useAuth();
  const { selectedChild, loading: childrenLoading } = useChildren();
  const { addLog } = useBabyLogs();

  const saveStop = useCallback(async (stop: PendingTimerStop): Promise<boolean> => {
    // Yalnız yuxu/əmizdirmə sessiyaları qeydə alınır
    if (stop.type !== 'sleep' && stop.type !== 'feeding') return true;
    // <3s — təsadüfi toxunuş, qəsdən ötürülür (emal olunmuş sayılır)
    if (stop.stoppedAt - stop.startTime < 3000) return true;
    // Auth/uşaq siyahısı hazır deyil → sonra yenidən cəhd (siyahı silinməyəcək)
    if (!user || childrenLoading) return false;

    // Taymer store-da hələ varsa child_id-ni oradan götür (persist olunur,
    // restart-a davamlıdır), sonra store-dan çıxar
    const { activeTimers, stopTimer } = useTimerStore.getState();
    const storeTimer = activeTimers.find((t) => t.id === stop.id);
    const childId = (storeTimer as any)?.childId ?? selectedChild?.id ?? null;
    if (storeTimer) stopTimer(stop.id);

    const startIso = new Date(stop.startTime).toISOString();

    // Dublikat qoruması: eyni istifadəçi+növ+başlama vaxtı artıq yazılıbsa
    // (məs. çox-elementli batch-in qismən uğurlu təkrar emalı) yenidən yazma
    try {
      const { data: existing } = await supabase
        .from('baby_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('log_type', stop.type)
        .eq('start_time', startIso)
        .maybeSingle();
      if (existing) return true;
    } catch {/* yoxlama alınmasa, insert cəhdinə davam et */}

    const result = await addLog({
      log_type: stop.type as 'sleep' | 'feeding',
      feed_type:
        stop.type === 'feeding' && stop.feedType
          ? (stop.feedType === 'left' ? 'breast_left' : 'breast_right')
          : undefined,
      start_time: startIso,
      end_time: new Date(stop.stoppedAt).toISOString(),
      child_id: childId,
    } as any);

    return !(result as any)?.error;
  }, [user, childrenLoading, selectedChild?.id, addLog]);

  const processingRef = useRef(false);
  const handlePending = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await processPendingStops(saveStop);
    } finally {
      processingRef.current = false;
    }
  }, [saveStop]);

  // Listeners call the latest handler through a ref, so they are subscribed
  // once instead of on every handlePending identity change.
  const handlePendingRef = useRef(handlePending);
  handlePendingRef.current = handlePending;

  useEffect(() => {
    if (!isNative) return;
    // Mount-da + auth/uşaq siyahısı hazır olanda (deps dəyişəndə) yoxla
    void handlePending();
  }, [handlePending]);

  useEffect(() => {
    if (!isNative) return;
    const offEvent = onNativeTimerStopped(() => { void handlePendingRef.current(); });
    let appListener: { remove: () => void } | null = null;
    let cancelled = false;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void handlePendingRef.current();
    }).then((h) => {
      if (cancelled) h.remove();else appListener = h;
    });
    return () => { cancelled = true; offEvent(); appListener?.remove(); };
  }, []);
};

export default usePendingTimerStops;
