import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Activity, Footprints, HeartPulse, Link2, Settings2, Download, RefreshCw,
  ArrowDownToLine, ArrowUpFromLine, Scale, Droplet, ShieldCheck } from
'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocaleTag } from '@/lib/i18n';
import { tr } from '@/lib/tr';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import {
  healthPlatform, isHealthConnected, requestHealthPermissions, mindfulnessSupported,
  disconnectHealth, openHealthSettings, installHealthConnect, localDayKey } from
'@/lib/health';
import {
  isCycleWriteEnabled, setCycleWriteEnabled,
  isCycleWriteAvailable, requestCycleWritePermission } from
'@/lib/healthCycle';
import {
  isVitalsWriteEnabled, setVitalsWriteEnabled, isVitalsWriteAvailable,
  requestVitalsWritePermission, syncVitalsToHealth, getLastVitalsSync } from
'@/lib/healthVitals';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/store/userStore';
import { useHealthAvailability, useHealthDaily, useHealthReadAccess, useHealthWorkouts } from '@/hooks/useHealthData';
import { useHealthSyncText, fill, type HealthSyncText } from '@/data/health-sync';
import '@/styles/health-sync.css';

interface Props {
  onBack: () => void;
}

export const STEP_GOAL = 7000;

const enter = (delay = 0) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay } });

/**
 * Apple Health (iOS) and Health Connect (Android), both directions:
 * reads steps/workouts (+ mindful minutes on iOS) to show here, and optionally copies saved
 * measurements and period days from Anacan to the phone's health store.
 */
const HealthSyncScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const language = useUserStore((s) => s.language);
  const t = useHealthSyncText(language);
  if (!t) return <div className="a-scope min-h-screen" style={{ background: 'var(--a-bg)' }} />;
  return <HealthSyncContent t={t} onBack={onBack} />;
};

function HealthSyncContent({ t, onBack }: { t: HealthSyncText; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const platform = healthPlatform();
  const isAndroid = platform === 'android';
  const platformName = platform === 'android' ? 'Health Connect' : 'Apple Health';
  const userId = useUserStore((s) => s.userId);
  const lifeStage = useUserStore((s) => s.lifeStage);
  const locale = getLocaleTag();
  const number = (n: number) => n.toLocaleString(locale);

  const [connected, setConnected] = useState(isHealthConnected());
  const [connecting, setConnecting] = useState(false);

  const availability = useHealthAvailability();
  const hcMissing = isAndroid && availability.data === false && !availability.isLoading;
  const access = useHealthReadAccess(connected);
  const daily = useHealthDaily(7, connected);
  const workoutsQuery = useHealthWorkouts(7, connected);
  const workouts = workoutsQuery.data ?? [];
  const noAccess = isAndroid && !!access.data && !access.data.steps && !access.data.workouts;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['health-read-access'] });
    void queryClient.invalidateQueries({ queryKey: ['health-daily'] });
    void queryClient.invalidateQueries({ queryKey: ['health-workouts'] });
  };

  const handleConnect = async () => {
    setConnecting(true);
    const ok = await requestHealthPermissions();
    setConnecting(false);
    if (ok) {
      setConnected(true);
      refresh();
      toast({ title: t.connected_toast, description: fill(t.dir_in_title, { platform: platformName }) });
    } else {
      toast({ title: t.denied_title, description: fill(t.denied_desc, { platform: platformName }), variant: 'destructive' });
    }
  };

  const handleDisconnect = () => {
    disconnectHealth();
    setConnected(false);
    toast({ title: t.disconnect, description: t.disconnected_toast });
  };

  // ---- Anacan → Health: measurements ----
  const [vitalsWrite, setVitalsWrite] = useState(isVitalsWriteEnabled());
  const [vitalsBusy, setVitalsBusy] = useState(false);
  const [lastSync, setLastSync] = useState(() => userId ? getLastVitalsSync(userId) : null);

  const runVitalsSync = async (announceEmpty: boolean) => {
    if (!userId) return;
    setVitalsBusy(true);
    try {
      const result = await syncVitalsToHealth(userId);
      setLastSync(getLastVitalsSync(userId));
      if (result.failed > 0) toast({ title: t.sync_failed, variant: 'destructive' });else
      if (result.written > 0) toast({ title: fill(t.synced_toast, { count: result.written }) });else
      if (announceEmpty) toast({ title: t.synced_none });
    } catch {
      toast({ title: t.sync_failed, variant: 'destructive' });
    } finally {
      setVitalsBusy(false);
    }
  };

  const toggleVitals = async (on: boolean) => {
    if (!on) {
      setVitalsWriteEnabled(false);
      setVitalsWrite(false);
      return;
    }
    setVitalsBusy(true);
    if (!(await isVitalsWriteAvailable())) {
      setVitalsBusy(false);
      toast({ title: t.unavailable, description: isAndroid ? t.install_desc : t.unavailable_update, variant: 'destructive' });
      return;
    }
    const granted = await requestVitalsWritePermission();
    setVitalsBusy(false);
    if (!granted) {
      toast({ title: t.denied_title, description: fill(t.denied_desc, { platform: platformName }), variant: 'destructive' });
      return;
    }
    setVitalsWriteEnabled(true);
    setVitalsWrite(true);
    toast({ title: t.connected_toast, description: t.vitals_on });
    await runVitalsSync(false);
  };

  // ---- Anacan → Health: period days (Flow; an earlier opt-in can always be turned off) ----
  const [cycleWrite, setCycleWrite] = useState(isCycleWriteEnabled());
  const [cycleBusy, setCycleBusy] = useState(false);
  const { data: cycleAvailable } = useQuery({
    queryKey: ['health-cycle-write-available'],
    queryFn: isCycleWriteAvailable,
    enabled: platform !== null,
    staleTime: 60 * 1000
  });
  const showCycle = lifeStage === 'flow' || cycleWrite;

  const toggleCycle = async (on: boolean) => {
    if (!on) {
      setCycleWriteEnabled(false);
      setCycleWrite(false);
      return;
    }
    setCycleBusy(true);
    if (!(await isCycleWriteAvailable())) {
      setCycleBusy(false);
      toast({ title: t.unavailable, description: isAndroid ? t.install_desc : t.unavailable_update, variant: 'destructive' });
      return;
    }
    const granted = await requestCycleWritePermission();
    setCycleBusy(false);
    if (granted) {
      setCycleWriteEnabled(true);
      setCycleWrite(true);
      toast({ title: t.connected_toast, description: t.cycle_on });
    } else {
      toast({ title: t.denied_title, description: fill(t.denied_desc, { platform: platformName }), variant: 'destructive' });
    }
  };

  // ---- derived read data ----
  const todayKey = localDayKey(new Date());
  const steps = daily.data?.steps ?? [];
  const todaySteps = steps.find((s) => s.date === todayKey)?.value ?? 0;
  const avgSteps = steps.length ? Math.round(steps.reduce((sum, s) => sum + s.value, 0) / steps.length) : 0;
  const maxSteps = Math.max(STEP_GOAL, ...steps.map((s) => s.value));
  const weekMindful = (daily.data?.mindfulness ?? []).reduce((sum, s) => sum + s.value, 0);
  const activeMinutes = Math.round(workouts.reduce((sum, w) => sum + w.duration, 0) / 60);
  const loaded = daily.isSuccess && workoutsQuery.isSuccess;
  const nothingFound = loaded && steps.every((s) => s.value === 0) && workouts.length === 0 && weekMindful === 0;
  const readError = daily.isError || workoutsQuery.isError;

  const workoutLabel = (type: string): string => {
    const key = type.toLowerCase();
    if (key.includes('walk') || key.includes('hik')) return t.wt_walking;
    if (key.includes('run')) return t.wt_running;
    if (key.includes('yoga')) return t.wt_yoga;
    if (key.includes('swim')) return t.wt_swimming;
    if (key.includes('cycl') || key.includes('bik')) return t.wt_cycling;
    if (key.includes('pilates')) return t.wt_pilates;
    return t.wt_workout;
  };

  const status = useMemo(() => {
    if (hcMissing) return { cls: 'warn', label: t.status_install };
    if (!connected) return { cls: '', label: t.status_off };
    if (noAccess) return { cls: 'warn', label: t.status_no_access };
    return { cls: 'on', label: t.status_connected };
  }, [hcMissing, connected, noAccess, t]);

  const lastSyncText = lastSync ?
  fill(t.last_sync, { time: new Date(lastSync).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) :
  t.never_synced;

  return (
    <div className="a-scope min-h-screen safe-top pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-5 pb-10">
        <div className="flex items-center gap-3 py-5">
          <button onClick={onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label={tr('common_geri', 'Geri')}>
            <ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{t.eyebrow}</p>
            <h1 className="a-heading" style={{ margin: 0, fontSize: 20, color: 'var(--a-ink)' }}>{platformName}</h1>
          </div>
          {platform && <span className={`hs-status ${status.cls}`} data-testid="health-status"><i />{status.label}</span>}
        </div>

        {!platform ?
        <div className="a-card text-center" style={{ padding: '28px 18px' }}>
            <HeartPulse size={34} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} />
            <p className="a-list-title" style={{ fontSize: 15 }}>{t.web_title}</p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', marginTop: 4 }}>{t.web_desc}</p>
          </div> :

        <>
            {hcMissing ?
          <motion.div className="a-card" {...enter()}>
                <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBottom: 12 }}>{t.install_desc}</p>
                <button className="a-cta-btn w-full" style={{ justifyContent: 'center', height: 48 }} onClick={installHealthConnect}>
                  <Download size={17} strokeWidth={2} />
                  {t.install_btn}
                </button>
              </motion.div> :

          !connected ?
          <motion.div className="a-card" style={{ padding: '22px 18px' }} {...enter()}>
                <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center" style={{ borderRadius: 18, background: 'var(--a-grad-green)' }}>
                  <HeartPulse size={26} style={{ color: 'var(--a-green-ink)' }} />
                </div>
                <p className="a-list-sub text-center" style={{ whiteSpace: 'normal' }}>{t.intro}</p>
                <Directions t={t} platformName={platformName} />
                <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 50, opacity: connecting ? 0.6 : 1 }}
              disabled={connecting}
              onClick={handleConnect}>
                  <Link2 size={16} strokeWidth={2.2} />
                  {connecting ? t.connecting : fill(t.connect_btn, { platform: platformName })}
                </button>
              </motion.div> :

          noAccess ?
          <motion.div className="hs-hint" {...enter()}>
                <b>{t.status_no_access}</b>
                <p>{t.no_access_desc}</p>
                <div className="hs-hint-actions">
                  <button className="hs-chip-btn" onClick={handleConnect} disabled={connecting}><Link2 size={14} />{t.grant_btn}</button>
                  <button className="hs-chip-btn" onClick={openHealthSettings}><Settings2 size={14} />{t.open_permissions}</button>
                </div>
              </motion.div> :

          <>
                <motion.div className="a-card" {...enter()}>
                  <div className="hs-today">
                    <StepRing value={todaySteps} goal={STEP_GOAL} loading={daily.isLoading}>
                      <b>{daily.isLoading ? '…' : number(todaySteps)}</b>
                      <span>{t.steps}</span>
                    </StepRing>
                    <div className="hs-today-side">
                      <div className="hs-label">{t.today}</div>
                      {todaySteps >= STEP_GOAL ?
                  <p className="hs-goal-done">{t.goal_done}</p> :
                  <p>{fill(t.goal, { goal: number(STEP_GOAL) })}</p>}
                    </div>
                  </div>
                  <div className="hs-stats">
                    <Stat value={number(avgSteps)} label={t.avg7} />
                    <Stat value={String(workouts.length)} label={t.workouts7} />
                    {mindfulnessSupported() ?
                <Stat value={String(weekMindful)} label={t.mindful7} /> :
                <Stat value={String(activeMinutes)} label={t.active7} />}
                  </div>
                </motion.div>

                {(readError || nothingFound) &&
            <motion.div className="hs-hint" style={{ marginTop: 12 }} {...enter(0.05)}>
                    <b>{readError ? t.load_error : t.empty_title}</b>
                    <p>{isAndroid ? t.empty_android : t.empty_ios}</p>
                    <div className="hs-hint-actions">
                      <button className="hs-chip-btn" onClick={openHealthSettings}><Settings2 size={14} />{t.open_permissions}</button>
                      <button className="hs-chip-btn" onClick={refresh}><RefreshCw size={14} />{t.refresh}</button>
                    </div>
                  </motion.div>
            }

                {!nothingFound &&
            <motion.div className="a-card" style={{ marginTop: 12 }} {...enter(0.08)}>
                  <div className="a-card-head" style={{ marginBottom: 6 }}>
                    <h3 className="a-card-title a-heading">{t.week_title}</h3>
                    <button className="a-icon-btn" style={{ width: 34, height: 34 }} onClick={refresh} aria-label={t.refresh}>
                      <RefreshCw size={15} className={daily.isFetching ? 'animate-spin' : undefined} />
                    </button>
                  </div>
                  <div className="hs-plot">
                    <div className="hs-goal-line" style={{ bottom: `${STEP_GOAL / maxSteps * 100}%` }} aria-hidden />
                    {steps.map((s) =>
                <div key={s.date} className="hs-bar-col">
                        <motion.div
                    className={`hs-bar${s.value >= STEP_GOAL ? ' met' : ''}${s.date === todayKey ? ' today' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, s.value / maxSteps * 100)}%` }}>
                          {s.value > 0 && <span className="hs-bar-val">{s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}</span>}
                        </motion.div>
                      </div>
                )}
                  </div>
                  <div className="hs-days">
                    {steps.map((s) => {
                  const [y, m, d] = s.date.split('-').map(Number);
                  return (
                    <span key={s.date} className={`hs-bar-day${s.date === todayKey ? ' today' : ''}`}>
                          {new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short' })}
                        </span>);
                })}
                  </div>
                </motion.div>
            }

                {workouts.length > 0 &&
            <>
                    <p className="hs-section-title">{t.workouts_title}</p>
                    <motion.div className="a-list-card" {...enter(0.12)}>
                      {workouts.slice(0, 5).map((w, i) =>
                <div key={`${w.startDate}-${i}`} className="a-list-row">
                          <span className="a-list-icon" style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>
                            <Activity size={17} strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="a-list-title" style={{ fontSize: 14 }}>{workoutLabel(w.workoutType)}</p>
                            <p className="a-list-sub">
                              {new Date(w.startDate).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {Math.max(1, Math.round(w.duration / 60))} {t.min}
                            </p>
                          </div>
                          {w.calories > 0 &&
                  <span className="a-list-trail"><p className="a-list-value">{w.calories} {t.kcal}</p></span>
                  }
                        </div>
                )}
                    </motion.div>
                  </>
            }
              </>
          }

            {!hcMissing &&
          <>
                <p className="hs-section-title">{fill(t.out_title, { platform: platformName })}</p>
                <div className="a-list-card">
                  <div className="hs-switch-row">
                    <span className="a-list-icon shrink-0" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                      <Scale size={16} strokeWidth={2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="a-list-title" style={{ fontSize: 14 }}>{t.vitals_title}</p>
                      <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{t.vitals_desc}</p>
                    </div>
                    <Switch
                  className="data-[state=checked]:bg-[var(--a-peach-2)]"
                  aria-label={t.vitals_title}
                  checked={vitalsWrite}
                  disabled={vitalsBusy}
                  onCheckedChange={toggleVitals} />
                  </div>
                  {vitalsWrite &&
              <div className="hs-sync-row">
                      <span>{lastSyncText}</span>
                      <button className="hs-chip-btn" onClick={() => runVitalsSync(true)} disabled={vitalsBusy}>
                        <RefreshCw size={14} className={vitalsBusy ? 'animate-spin' : undefined} />
                        {vitalsBusy ? t.syncing : t.sync_now}
                      </button>
                    </div>
              }
                  {showCycle &&
              <div className="hs-switch-row">
                      <span className="a-list-icon shrink-0" style={{ background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                        <Droplet size={16} strokeWidth={2} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="a-list-title" style={{ fontSize: 14 }}>{t.cycle_title}</p>
                        <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{t.cycle_desc}</p>
                      </div>
                      <Switch
                  className="data-[state=checked]:bg-[var(--a-peach-2)]"
                  aria-label={t.cycle_title}
                  checked={cycleWrite}
                  disabled={cycleBusy || !cycleWrite && (lifeStage !== 'flow' || cycleAvailable === false)}
                  onCheckedChange={toggleCycle} />
                    </div>
              }
                </div>
              </>
          }

            <div className="a-list-card" style={{ marginTop: 22 }}>
              <button className="a-list-row w-full text-start" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={openHealthSettings}>
                <span className="a-list-icon" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                  <Settings2 size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-list-title" style={{ fontSize: 14 }}>{t.permissions}</p>
                  <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{fill(t.permissions_desc, { platform: platformName })}</p>
                </div>
              </button>
              {connected &&
            <button className="a-list-row w-full text-start" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleDisconnect}>
                  <span className="a-list-icon" style={{ background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                    <Link2 size={17} strokeWidth={2} />
                  </span>
                  <p className="a-list-title" style={{ fontSize: 14, color: 'var(--a-pink-ink)' }}>{t.disconnect}</p>
                </button>
            }
            </div>

            <p className="a-teaser text-start flex items-start gap-2" style={{ marginTop: 14 }}>
              <ShieldCheck size={15} className="shrink-0" style={{ marginTop: 2 }} />
              <span>{t.privacy}</span>
            </p>
          </>
        }
      </div>
    </div>);
}

function Directions({ t, platformName }: { t: HealthSyncText; platformName: string }) {
  return (
    <div className="hs-dirs">
      <div className="hs-dir">
        <span className="hs-dir-icon" style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}><ArrowDownToLine size={17} /></span>
        <div>
          <b>{fill(t.dir_in_title, { platform: platformName })}</b>
          <span>{mindfulnessSupported() ? t.dir_in_ios : t.dir_in_android}</span>
        </div>
      </div>
      <div className="hs-dir">
        <span className="hs-dir-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}><ArrowUpFromLine size={17} /></span>
        <div>
          <b>{fill(t.dir_out_title, { platform: platformName })}</b>
          <span>{t.dir_out_desc}</span>
        </div>
      </div>
    </div>);
}

function StepRing({ value, goal, loading, children }: { value: number; goal: number; loading: boolean; children: ReactNode }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = loading ? 0 : Math.min(1, value / goal);
  return (
    <div className="hs-ring">
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
        <circle className="hs-ring-track" cx="56" cy="56" r={radius} fill="none" strokeWidth="10" />
        <circle className="hs-ring-fill" cx="56" cy="56" r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <div className="hs-ring-center"><Footprints size={14} style={{ color: 'var(--a-green-ink)' }} />{children}</div>
    </div>);
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="hs-stat"><b>{value}</b><span>{label}</span></div>;
}

export default HealthSyncScreen;
