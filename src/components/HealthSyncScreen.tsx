import { useState } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, Footprints, HeartPulse, Link2, Settings2, Download, Dumbbell, Wind } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import {
  isNativeHealthPlatform, isHealthConnected, requestHealthPermissions,
  disconnectHealth, openHealthSettings, installHealthConnect } from
'@/lib/health';
import {
  isCycleWriteEnabled, setCycleWriteEnabled,
  isCycleWriteAvailable, requestCycleWritePermission } from
'@/lib/healthCycle';
import {
  isVitalsWriteEnabled, setVitalsWriteEnabled,
  isVitalsWriteAvailable, requestVitalsWritePermission } from
'@/lib/healthVitals';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/store/userStore';
import { useHealthAvailability, useHealthDaily, useHealthWorkouts } from '@/hooks/useHealthData';
import { tr } from '@/lib/tr';

interface Props {
  onBack: () => void;
}

/** Apple Health integration on iOS; optional cycle writes only on Android. */
const HealthSyncScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isIos = Capacitor.getPlatform() === 'ios';
  const isAndroid = isNativeHealthPlatform() && Capacitor.getPlatform() === 'android';
  const platformName = isIos ? 'Apple Health' : 'Health Connect';

  const [connected, setConnected] = useState(isHealthConnected());
  const [connecting, setConnecting] = useState(false);

  // Flow users can enable cycle writes; prior Android opt-ins can always be disabled.
  const lifeStage = useUserStore((s) => s.lifeStage);
  const [cycleWrite, setCycleWrite] = useState(isCycleWriteEnabled());
  const [cycleWriteBusy, setCycleWriteBusy] = useState(false);
  const { data: cycleAvailable } = useQuery({
    queryKey: ['health-cycle-write-available'],
    queryFn: isCycleWriteAvailable,
    enabled: isAndroid,
    staleTime: 60 * 1000
  });

  const toggleCycleWrite = async (on: boolean) => {
    if (!on) {
      setCycleWriteEnabled(false);
      setCycleWrite(false);
      return;
    }
    setCycleWriteBusy(true);
    const available = await isCycleWriteAvailable();
    if (!available) {
      setCycleWriteBusy(false);
      toast({
        title: tr('hc_write_unavailable', 'Mövcud deyil'),
        description: isAndroid ?
          tr('health_android_unavailable_desc', 'Health Connect bu cihazda əlçatan deyil. Quraşdırılması və ya yenilənməsi tələb oluna bilər.') :
          tr('hc_write_unavailable_desc', 'Yazma üçün tətbiqin yeni native build-i lazımdır'),
        variant: 'destructive'
      });
      return;
    }
    const granted = await requestCycleWritePermission();
    setCycleWriteBusy(false);
    if (granted) {
      setCycleWriteEnabled(true);
      setCycleWrite(true);
      toast({ title: tr('hc_write_on', 'Aktiv edildi ✓'), description: tr('hc_write_on_desc', 'Period qeydləri bundan sonra Health-ə yazılacaq') });
    } else {
      toast({ title: tr('hc_write_denied', 'İcazə verilmədi'), description: tr('hc_write_denied_desc', 'Sistem ayarlarından icazə verə bilərsiniz'), variant: 'destructive' });
    }
  };

  // Vitals writes remain available on iOS only.
  const [vitalsWrite, setVitalsWrite] = useState(isVitalsWriteEnabled());
  const [vitalsWriteBusy, setVitalsWriteBusy] = useState(false);

  const toggleVitalsWrite = async (on: boolean) => {
    if (!on) {
      setVitalsWriteEnabled(false);
      setVitalsWrite(false);
      return;
    }
    setVitalsWriteBusy(true);
    const available = await isVitalsWriteAvailable();
    if (!available) {
      setVitalsWriteBusy(false);
      toast({
        title: tr('hc_write_unavailable', 'Mövcud deyil'),
        description: tr('hc_write_unavailable_desc', 'Yazma üçün tətbiqin yeni native build-i lazımdır'),
        variant: 'destructive'
      });
      return;
    }
    const granted = await requestVitalsWritePermission();
    setVitalsWriteBusy(false);
    if (granted) {
      setVitalsWriteEnabled(true);
      setVitalsWrite(true);
      toast({ title: tr('hc_write_on', 'Aktiv edildi ✓'), description: tr('vitals_write_on_desc', 'Çəki, qan təzyiqi və qan şəkəri qeydləriniz bundan sonra Health-ə yazılacaq') });
    } else {
      toast({ title: tr('hc_write_denied', 'İcazə verilmədi'), description: tr('hc_write_denied_desc', 'Sistem ayarlarından icazə verə bilərsiniz'), variant: 'destructive' });
    }
  };

  const { isLoading: availLoading } = useHealthAvailability();
  const { data: daily } = useHealthDaily(7, connected);
  const { data: workouts = [] } = useHealthWorkouts(7, connected);

  const todayKey = new Date().toISOString().split('T')[0];
  const todaySteps = daily?.steps.find((s) => s.date === todayKey)?.value ?? 0;
  const maxSteps = Math.max(1, ...(daily?.steps || []).map((s) => s.value));
  const weekMindfulness = (daily?.mindfulness || []).reduce((sum, s) => sum + s.value, 0);

  const handleConnect = async () => {
    setConnecting(true);
    const ok = await requestHealthPermissions();
    setConnecting(false);
    if (ok) {
      setConnected(true);
      queryClient.invalidateQueries({ queryKey: ['health-daily'] });
      queryClient.invalidateQueries({ queryKey: ['health-workouts'] });
      toast({ title: tr('health_connected_toast', 'Qoşuldu! 🎉'), description: `${platformName} ${tr('health_connected_desc', 'məlumatları oxunur')}` });
    } else {
      toast({ title: tr('health_connect_failed', 'Qoşulmadı'), description: tr('health_connect_failed_desc', 'İcazələr verilmədi — yenidən cəhd edin'), variant: 'destructive' });
    }
  };

  const handleDisconnect = () => {
    disconnectHealth();
    setConnected(false);
    toast({ title: tr('health_disconnected', 'Əlaqə kəsildi'), description: tr('health_disconnected_desc', 'İcazələri tam silmək üçün sistem ayarlarından istifadə edin') });
  };

  const workoutLabel = (type: string): string => {
    const key = type.toLowerCase();
    if (key.includes('walk')) return tr('health_wt_walking', 'Gəzinti');
    if (key.includes('run')) return tr('health_wt_running', 'Qaçış');
    if (key.includes('yoga')) return 'Yoga';
    if (key.includes('swim')) return tr('health_wt_swimming', 'Üzgüçülük');
    if (key.includes('cycl') || key.includes('bik')) return tr('health_wt_cycling', 'Velosiped');
    if (key.includes('pilates')) return 'Pilates';
    return tr('health_wt_workout', 'Məşq');
  };

  return (
    <div className="a-scope min-h-screen safe-top pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 py-5">
          <button onClick={onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label={tr('common_geri', 'Geri')}>
            <ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2} />
          </button>
          <div>
            <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{tr('health_eyebrow', 'Sağlamlıq inteqrasiyası')}</p>
            <h1 className="a-heading" style={{ margin: 0, fontSize: 20, color: 'var(--a-ink)' }}>{platformName}</h1>
          </div>
        </div>

        {/* Qoşulma statusu / CTA */}
        {!isNativeHealthPlatform() ?
        <div className="a-card text-center" style={{ padding: '28px 18px' }}>
            <HeartPulse size={34} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} />
            <p className="a-list-title" style={{ fontSize: 15 }}>{tr('health_web_title', 'Yalnız mobil tətbiqdə')}</p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', marginTop: 4 }}>
              {tr('health_web_desc', 'Sağlamlıq inteqrasiyası iOS və Android tətbiqlərində işləyir.')}
            </p>
          </div> :

        isAndroid ?
        <motion.div className="a-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
                  <HeartPulse size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-list-title">{tr('health_android_cycle_only', 'Health Connect: yalnız period qeydlərinin yazılması')}</p>
                  <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
                    {tr('health_android_flow_only', 'Bu inteqrasiya yalnız Flow rejimində period qeydlərini yazmaq üçündür. Health Connect-dən məlumat oxunmur.')}
                  </p>
                </div>
              </div>
              {cycleAvailable === false &&
              <>
                <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBottom: 12 }}>
                  {tr('health_android_unavailable_desc', 'Health Connect bu cihazda əlçatan deyil. Quraşdırılması və ya yenilənməsi tələb oluna bilər.')}
                </p>
                <button className="a-cta-btn w-full" style={{ justifyContent: 'center', height: 48 }} onClick={installHealthConnect}>
                  <Download size={17} strokeWidth={2} />
                  {tr('health_hc_install', 'Play Store-dan quraşdır')}
                </button>
              </>
              }
            </motion.div> :

        availLoading ?
        <div className="a-card animate-pulse" style={{ height: 120 }} /> :

        !connected ?
        <motion.div className="a-card text-center" style={{ padding: '26px 18px' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ borderRadius: 20, background: 'var(--a-grad-green)' }}>
                <HeartPulse size={28} style={{ color: 'var(--a-green-ink)' }} />
              </div>
              <h2 className="a-heading" style={{ fontSize: 18, color: 'var(--a-ink)', margin: '0 0 6px' }}>
                {`${platformName} ${tr('health_connect_title', 'ilə qoşulun')}`}
              </h2>
              <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBottom: 18 }}>
                {tr('health_connect_desc', 'Addım sayınız və məşqləriniz avtomatik görünəcək. Məlumatlar cihazınızda qalır.')}
              </p>
              <button
            className="a-cta-btn w-full"
            style={{ justifyContent: 'center', height: 50, opacity: connecting ? 0.6 : 1 }}
            disabled={connecting}
            onClick={handleConnect}>
                <Link2 size={16} strokeWidth={2.2} />
                {connecting ? tr('health_connecting', 'Qoşulur...') : tr('health_connect_btn', 'İndi qoşul')}
              </button>
            </motion.div> :

        <>
            {/* Bu gün */}
            <div className="a-trio">
              <motion.div className="a-trio-item" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <span className="a-trio-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
                  <Footprints size={17} strokeWidth={2} />
                </span>
                <p className="a-trio-value" style={{ fontSize: 17 }}>{todaySteps.toLocaleString()}</p>
                <p className="a-trio-label">{tr('health_steps_today', 'Addım (bu gün)')}</p>
              </motion.div>
              <motion.div className="a-trio-item" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                <span className="a-trio-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                  <Wind size={17} strokeWidth={2} />
                </span>
                <p className="a-trio-value" style={{ fontSize: 17 }}>{weekMindfulness}</p>
                <p className="a-trio-label">{tr('health_mindfulness_week', 'Rahatlama dəq (7 gün)')}</p>
              </motion.div>
              <motion.div className="a-trio-item" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <span className="a-trio-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
                  <Dumbbell size={17} strokeWidth={2} />
                </span>
                <p className="a-trio-value" style={{ fontSize: 17 }}>{workouts.length}</p>
                <p className="a-trio-label">{tr('health_workouts_week', 'Məşq (7 gün)')}</p>
              </motion.div>
            </div>

            {/* 7 günlük addım qrafiki */}
            <motion.div className="a-card" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="a-card-head">
                <h3 className="a-card-title a-heading">{tr('health_steps_7d', 'Son 7 gün — addımlar')}</h3>
              </div>
              <div className="h-28 flex items-end gap-2">
                {(daily?.steps || []).map((s) =>
              <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                  className="w-full"
                  style={{ background: 'var(--a-grad-green)', borderRadius: '8px 8px 4px 4px' }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(6, s.value / maxSteps * 100)}%` }} />
                    <span className="a-list-time" style={{ margin: 0, fontSize: 9 }}>
                      {new Date(s.date).toLocaleDateString(getLocaleTag(), { weekday: 'short' })}
                    </span>
                  </div>
              )}
              </div>
            </motion.div>

            {/* Son məşqlər */}
            {workouts.length > 0 &&
          <motion.div className="a-list-card" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                {workouts.slice(0, 5).map((w, i) =>
            <div key={`${w.startDate}-${i}`} className="a-list-row">
                    <span className="a-list-icon" style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>
                      <Activity size={17} strokeWidth={2} />
                    </span>
                    <div>
                      <p className="a-list-title" style={{ fontSize: 14 }}>{workoutLabel(w.workoutType)}</p>
                      <p className="a-list-sub">
                        {new Date(w.startDate).toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short' })} · {Math.round(w.duration / 60)} {tr('health_min', 'dəq')}
                      </p>
                    </div>
                    {w.calories > 0 &&
              <span className="a-list-trail">
                        <p className="a-list-value">{w.calories} kal</p>
                      </span>
              }
                  </div>
            )}
              </motion.div>
          }
          </>
        }

        {isNativeHealthPlatform() && (isAndroid || (!availLoading && connected)) &&
          <>
            {/* Cycle writing is independent of the reader connection on Android. */}
            {(lifeStage === 'flow' || (isAndroid && cycleWrite)) &&
          <div className="a-card flex items-center gap-3" style={{ marginTop: 12, padding: '14px 16px' }}>
                <span className="a-list-icon shrink-0" style={{ background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                  🩸
                </span>
                <div className="flex-1 min-w-0">
                  <p className="a-list-title" style={{ fontSize: 14 }}>{tr('hc_write_title', 'Tsikli Health-ə yaz')}</p>
                  <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
                    {isAndroid ?
                      tr('health_android_cycle_write_desc', 'Aktiv etdikdən sonra ana ekranda "Periodum başladı" ilə yeni qeyd əlavə edin. Əvvəlki qeydlər köçürülmür.') :
                      tr('hc_write_desc', 'Period qeydləriniz avtomatik Apple Health / Health Connect-ə əlavə olunur')}
                  </p>
                </div>
                <Switch
              className="data-[state=checked]:bg-[var(--a-peach-2)]"
              aria-label={tr('hc_write_title', 'Tsikli Health-ə yaz')}
              checked={cycleWrite}
              disabled={cycleWriteBusy || (isAndroid && !cycleWrite && (lifeStage !== 'flow' || !cycleAvailable))}
              onCheckedChange={toggleCycleWrite} />
              </div>
          }

            {/* Vitals writing is iOS-only. */}
            {isIos &&
            <div className="a-card flex items-center gap-3" style={{ marginTop: 12, padding: '14px 16px' }}>
              <span className="a-list-icon shrink-0" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                <HeartPulse size={16} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="a-list-title" style={{ fontSize: 14 }}>{tr('vitals_write_title', 'Ölçmələrimi Health-ə yaz')}</p>
                <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
                  {tr('vitals_write_desc', 'Çəki, qan təzyiqi və qan şəkəri qeydləriniz Apple Health / Health Connect-ə əlavə olunur')}
                </p>
              </div>
              <Switch
                className="data-[state=checked]:bg-[var(--a-peach-2)]"
                checked={vitalsWrite}
                disabled={vitalsWriteBusy}
                onCheckedChange={toggleVitalsWrite} />
            </div>
            }

            {/* İdarəetmə */}
            <div className="a-list-card" style={{ marginTop: 12 }}>
              <button className="a-list-row w-full text-start" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={openHealthSettings}>
                <span className="a-list-icon" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                  <Settings2 size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-list-title" style={{ fontSize: 14 }}>{tr('health_open_settings', 'İcazə ayarları')}</p>
                  <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{`${platformName} ${tr('health_open_settings_desc', 'icazələrini idarə edin')}`}</p>
                </div>
              </button>
              {isIos &&
              <button className="a-list-row w-full text-start" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleDisconnect}>
                <span className="a-list-icon" style={{ background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                  <Link2 size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-list-title" style={{ fontSize: 14, color: 'var(--a-pink-ink)' }}>{tr('health_disconnect_btn', 'Əlaqəni kəs')}</p>
                </div>
              </button>
              }
            </div>

            <p className="a-teaser text-center" style={{ marginTop: 14 }}>
              {isAndroid ?
                tr('health_android_privacy_note', 'Bu seçim yalnız Health Connect-ə yazmanı idarə edir. Tətbiqdə daxil etdiyiniz sağlamlıq qeydləri hesabınızda saxlanmağa davam edir.') :
                tr('health_privacy_note', 'Sağlamlıq məlumatlarınız yalnız cihazınızda oxunur — serverlərimizə göndərilmir.')}
            </p>
          </>
        }
      </div>
    </div>);

};

export default HealthSyncScreen;
