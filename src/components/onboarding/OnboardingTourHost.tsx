import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useToolConfigs } from '@/hooks/useDynamicTools';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { usePrivacyConsent } from '@/lib/privacyConsent';
import { buildTourPlan, isToolOpenForUser, isTourEligible, PUSH_GRANTED_EVENT, TOUR_VERSION, type TourNav, type TourPush, type TourStage, type TourTool } from '@/lib/onboardingTour';
import GlassTour from './GlassTour';

const localKey = (uid: string) => `anacan_tour_v${TOUR_VERSION}_${uid}`;
const readLocal = (uid: string) => { try { return localStorage.getItem(localKey(uid)); } catch { return null; } };
const writeLocal = (uid: string, v: string) => { try { localStorage.setItem(localKey(uid), v); } catch { /* private mode */ } };

async function readPush(): Promise<TourPush> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const p = await FirebaseMessaging.checkPermissions();
    if (p.receive === 'granted') return 'granted';
    if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') return 'prompt';
    return 'denied';
  } catch { return 'unsupported'; }
}

/**
 * Decides whether this user gets the in-app onboarding tour and runs it.
 * Switch: app_settings.inapp_onboarding ('on'/'off', Admin → Tənzimləmələr). Progress: profiles.onboarding_journey.
 * The tour waits for every first-run sheet (splash, intro, privacy consent, other sheets) to close.
 */
export default function OnboardingTourHost({ blocked, onNavigate, onRunningChange }: { blocked: boolean; onNavigate: (nav: TourNav) => void; onRunningChange?: (running: boolean) => void }) {
  const { user, profile } = useAuth();
  const { isPremium, loading: subLoading, entitlementReady, freeLimits } = useSubscription();
  const setting = useAppSetting('inapp_onboarding');
  const since = useAppSetting('inapp_onboarding_since');
  const { role, lifeStage, isOnboarded } = useUserStore(useShallow((s) => ({ role: s.role, lifeStage: s.lifeStage, isOnboarded: s.isOnboarded })));
  const consent = usePrivacyConsent();
  const stage = (lifeStage === 'mommy' || lifeStage === 'bump' || lifeStage === 'flow' ? lifeStage : null) as TourStage | null;
  const { data: configs, isSuccess: configsReady } = useToolConfigs(stage || undefined);
  const { disabledTools } = useDisabledTools();
  const [push, setPush] = useState<TourPush | null>(null);
  const [running, setRunning] = useState(false);
  // The plan is frozen when the tour starts, so a refetch (tools, subscription) cannot shift the steps mid-tour.
  const [plan, setPlan] = useState<ReturnType<typeof buildTourPlan>>([]);
  const [closed, setClosed] = useState(false);
  const started = useRef(false);
  const uid = user?.id || '';
  const journey = (profile as { onboarding_journey?: unknown } | null)?.onboarding_journey;

  const eligible = !!uid && !closed && readLocal(uid) === null && isTourEligible({
    setting, since, accountCreatedAt: user?.created_at, journey, role, lifeStage,
    lossRecoveryActive: (profile as { loss_recovery_active?: boolean } | null)?.loss_recovery_active, onboarded: isOnboarded,
  });

  useEffect(() => { if (eligible && push === null) void readPush().then(setPush); }, [eligible, push]);

  const tools: TourTool[] = useMemo(() => {
    if (!stage || !configs) return [];
    const locked = (c: (typeof configs)[number]) => (stage === 'flow' ? c.flow_locked : stage === 'bump' ? c.bump_locked : c.mommy_locked) || false;
    return configs.filter((c) => !disabledTools.includes(c.tool_id)).map((c) => ({
      id: c.tool_id,
      name: ((c as { display_name?: string | null }).display_name || c.name) as string,
      description: c.description,
      open: isToolOpenForUser(c, locked(c), isPremium),
    }));
  }, [configs, stage, disabledTools, isPremium]);

  const ready = eligible && !blocked && consent.decidedAt !== null && stage !== null && configsReady && push !== null && !subLoading && entitlementReady !== false;
  useEffect(() => {
    if (!ready || started.current) return;
    const timer = window.setTimeout(() => {
      started.current = true;
      writeLocal(uid, 'started');
      // Recorded at start: an interrupted tour is never shown again (no repeats on any device).
      void supabase.from('profiles').update({ onboarding_journey: { version: TOUR_VERSION, status: 'started', at: new Date().toISOString() } } as never).eq('user_id', uid);
      setPlan(buildTourPlan({ stage: stage!, isPremium, push: push!, tools }));
      setRunning(true);
      onRunningChange?.(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [ready, uid, stage, isPremium, push, tools, onRunningChange]);

  const finish = useCallback((status: 'done' | 'skipped', step: string) => {
    writeLocal(uid, status);
    setRunning(false); setClosed(true); onRunningChange?.(false);
    void supabase.from('profiles').update({ onboarding_journey: { version: TOUR_VERSION, status, step, at: new Date().toISOString() } } as never).eq('user_id', uid);
    onNavigate({ tab: 'home' });
  }, [uid, onNavigate, onRunningChange]);

  const askPush = useCallback(async () => {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const p = await FirebaseMessaging.requestPermissions();
      if (p.receive === 'granted') window.dispatchEvent(new Event(PUSH_GRANTED_EVENT));
    } catch { /* plugin unavailable: nothing to ask */ }
  }, []);

  const openPremium = useCallback(() => {
    window.dispatchEvent(new CustomEvent('anacan:deeplink', { detail: { action: 'screen', params: { screen: 'billing' } } }));
  }, []);

  useEffect(() => () => onRunningChange?.(false), [onRunningChange]);
  if (!running || plan.length === 0 || !stage) return null;
  const aiFreePerDay = Number((freeLimits as { ai_chat_count_per_day?: number } | undefined)?.ai_chat_count_per_day) || 10;
  return <GlassTour plan={plan} name={(profile as { name?: string } | null)?.name || ''} stage={stage} isPremium={isPremium} aiFreePerDay={aiFreePerDay}
    tools={tools} onNavigate={onNavigate} onPush={askPush} onPremium={openPremium} onFinish={finish} />;
}
