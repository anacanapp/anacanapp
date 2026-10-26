import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useQuery } from '@tanstack/react-query';
import { Eye, Settings2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { fetchAdmobConfiguration, fetchAdmobOverview, reportAdEvent, type AdEvent } from '@/lib/ads/api';
import { AD_PLACEMENT_IDS, TEST_APP_IDS, placementDefinition, type AdsConfiguration, type AdMode, type AdPlacementId, type AdPlatform } from '@/lib/ads/config';
import { AD_REASON_LABELS, emptyAdLedger, evaluateAd, normalizeAdLedger, recordAdShown, type AdDecision, type AdEvaluationContext, type AdLedger } from '@/lib/ads/policy';
import { hasNativeAdmob, NativeAdmobAdapter, removeNativeAdmobBanner, type NativeConsent } from '@/lib/ads/native';
import { readAdLedger, writeAdLedger } from '@/lib/ads/storage';
import { DemoBanner, DemoFullscreen } from './DemoAd';
import { toast } from 'sonner';
import { useTimerStore } from '@/store/timerStore';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';
import { advanceAdCadence, consumeAdCadence, type AdCadence } from '@/lib/ads/cadence';

interface AdSurface { token: string; id: AdPlacementId; startedAt: number }
export interface AdPreview { enabled: boolean; platform: AdPlatform; premium: boolean; fast: boolean }
const previewKey = 'anacan.ads.admin-preview.v1';
const noPreview: AdPreview = { enabled: false, platform: 'ios', premium: false, fast: true };
const inactive: AdDecision = { allowed: false, reason: 'configuration', waitSeconds: 0, mode: 'demo', adUnitId: null };
interface AdExperience {
  configuration: AdsConfiguration | null; preview: AdPreview; consent: NativeConsent; nativeAvailable: boolean;
  busy: boolean; pauseUntil: number; bannerId: AdPlacementId | null;
  registerSurface: (id: AdPlacementId) => () => void;
  registerBlock: () => () => void;
  decisionFor: (id: AdPlacementId) => AdDecision;
  showInterstitial: (id: AdPlacementId) => Promise<boolean>;
  showRewarded: (id?: AdPlacementId) => Promise<boolean>;
  showStory: () => Promise<boolean>;
  opportunity: (id: AdPlacementId, key: string) => boolean;
  startPreview: (options?: Partial<AdPreview>) => Promise<void>;
  stopPreview: () => void; resetDemo: () => void; openPrivacy: () => Promise<void>;
}
const AdContext = createContext<AdExperience>({ configuration: null, preview: noPreview, consent: { canRequestAds: false, privacyOptionsRequired: false },
  nativeAvailable: false, busy: false, pauseUntil: 0, bannerId: null, registerSurface: () => () => {}, registerBlock: () => () => {}, decisionFor: () => inactive,
  showInterstitial: async () => false, showRewarded: async () => false, showStory: async () => false, opportunity: () => false, startPreview: async () => {}, stopPreview: () => {}, resetDemo: () => {}, openPrivacy: async () => {} });
export const useAdExperience = () => useContext(AdContext);

const LAYOUT_THROTTLE_MS = 150;

function layoutState() {
  const input = document.activeElement;
  const editing = input instanceof HTMLElement && (input.matches('input:not([type=button]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]'));
  const overlays = [...document.querySelectorAll<HTMLElement>('[data-ad-block="true"],[aria-modal="true"],[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],.fixed.inset-0')];
  const blockers = overlays.filter(element => !element.closest('[data-ad-overlay="true"]') && element.getBoundingClientRect().height > 0
    && (element.hasAttribute('data-ad-block') || element.getAttribute('aria-modal') === 'true' || ['dialog','alertdialog'].includes(element.getAttribute('role') || '')
      || Number.parseInt(getComputedStyle(element).zIndex) >= 40));
  const blocked = editing || blockers.length > 0;
  const allowed = editing || !blockers.length ? [] : AD_PLACEMENT_IDS.filter(id => blockers.every(element => (element.getAttribute('data-ad-allow') || '').split(' ').includes(id)));
  const nav = document.querySelector<HTMLElement>('[data-ad-bottom-nav]');
  const navRect = nav?.getBoundingClientRect();
  const safeProbe = document.getElementById('admob-safe-area-probe');
  const safeBottom = safeProbe ? parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0 : 0;
  const safeTop = safeProbe ? parseFloat(getComputedStyle(safeProbe).paddingTop) || 0 : 0;
  const bottom = navRect && navRect.height > 0 ? Math.max(0, window.innerHeight - navRect.top) + 10 : safeBottom + 8;
  const anchors: Record<string, { top: number; height: number; visible: boolean }> = {};
  document.querySelectorAll<HTMLElement>('[data-ad-inline-anchor]').forEach(element => {
    const rect = element.getBoundingClientRect();
    anchors[element.dataset.adInlineAnchor!] = { top: rect.top, height: rect.height,
      visible: rect.height > 0 && rect.top >= safeTop + 4 && rect.bottom <= window.innerHeight - bottom };
  });
  return { blocked, allowed, bottom, safeBottom, safeTop, viewportHeight: window.innerHeight, anchors, foreground: document.visibilityState !== 'hidden', online: navigator.onLine };
}

export function AdExperienceProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const subscription = useSubscription();
  const hasActiveTimer = useTimerStore(state => state.activeTimers.length > 0);
  const hasActiveAudio = useWhiteNoiseStore(state => state.isPlaying);
  const userId = user?.id ?? null;
  const [preview, setPreview] = useState<AdPreview>(noPreview);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [surfaces, setSurfaces] = useState<AdSurface[]>([]);
  const [forcedBlocks, setForcedBlocks] = useState<string[]>([]);
  const [layout, setLayout] = useState(() => ({ blocked: false, allowed: [] as AdPlacementId[], bottom: 8, safeBottom: 0, safeTop: 0,
    viewportHeight: typeof window === 'undefined' ? 800 : window.innerHeight,
    anchors: {} as Record<string, { top: number; height: number; visible: boolean }>, foreground: true, online: true }));
  const [consent, setConsent] = useState<NativeConsent>({ canRequestAds: false, privacyOptionsRequired: false });
  const consentRef = useRef(consent);
  const [nativeVersion, setNativeVersion] = useState('0');
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [banner, setBanner] = useState<{ id: AdPlacementId; mode: AdMode; height: number; loaded: boolean; key: string } | null>(null);
  const bannerRef = useRef(banner); bannerRef.current = banner;
  const positioned = useRef<{ key: string; top: number; hidden: boolean } | null>(null);
  const [demo, setDemo] = useState<{ id: AdPlacementId; minutes: number; finish: (rewarded: boolean) => void } | null>(null);
  const demoRef = useRef(demo); demoRef.current = demo;
  const adapter = useRef(new NativeAdmobAdapter()).current;
  // useRef's argument is evaluated on every render; create the session id once.
  const [initialSession] = useState(() => ({ id: crypto.randomUUID(), startedAt: Date.now(), userId }));
  const session = useRef(initialSession);
  const epoch = useRef(0), mounted = useRef(true), consentAttempt = useRef('');
  const backoff = useRef<Record<string, number>>({});
  const ledgerCache = useRef<Partial<Record<AdMode, AdLedger>>>({});
  const cadences = useRef<Record<string, AdCadence>>({});
  const actualPlatform = Capacitor.getPlatform();
  const nativeAvailable = hasNativeAdmob();
  const backend = getBackendConfig(), azure = backend.azure;
  const configQuery = useQuery({ queryKey: ['admob-configuration', backend.url], queryFn: fetchAdmobConfiguration,
    enabled: !!userId, staleTime: 15_000, gcTime: 60_000, refetchInterval: 30_000, retry: false });
  const previewProof = useQuery({ queryKey: ['admin-admob-preview', backend.url, userId], queryFn: fetchAdmobOverview,
    enabled: !!userId && isAdmin && previewRequested && azure, staleTime: 0, refetchInterval: 30_000, retry: false });
  const demoAllowed = !!userId && isAdmin && previewRequested && previewProof.isSuccess && !previewProof.isError;
  const effectivePreview = { ...preview, enabled: preview.enabled && demoAllowed };
  const configuration = !configQuery.isError && tick - configQuery.dataUpdatedAt < 75_000 ? configQuery.data ?? null : null;
  const protectedLayout = { ...layout, blocked: layout.blocked || hasActiveTimer || hasActiveAudio || forcedBlocks.length > 0,
    allowed: hasActiveTimer || hasActiveAudio || forcedBlocks.length > 0 ? [] : layout.allowed };
  const current = useRef({ configuration, effectivePreview, userId, subscription, layout: protectedLayout, nativeVersion, nativeAvailable, surfaces, tick });
  current.current = { configuration, effectivePreview, userId, subscription, layout: protectedLayout, nativeVersion, nativeAvailable, surfaces, tick };

  const getLedger = useCallback((mode: AdMode) => {
    const now = Date.now();
    const value = normalizeAdLedger(ledgerCache.current[mode] ?? readAdLedger(mode, session.current.id, now), now, session.current.id);
    ledgerCache.current[mode] = value; return value;
  }, []);
  const saveLedger = useCallback((mode: AdMode, value: AdLedger) => {
    ledgerCache.current[mode] = value; writeAdLedger(mode, value); if (mounted.current) setTick(Date.now());
  }, []);
  const contextFor = useCallback((id: AdPlacementId, options: { ignoreBusy?: boolean; consent?: boolean; existingBanner?: boolean } = {}): AdEvaluationContext => {
    const state = current.current, previewing = state.effectivePreview.enabled;
    const platform: AdPlatform = previewing ? state.effectivePreview.platform : Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    const surface = [...state.surfaces].reverse().find(item => item.id === id);
    return { now: Date.now(), sessionStartedAt: session.current.startedAt, screenStartedAt: surface?.startedAt ?? Date.now(), platform,
      signedIn: !!state.userId, entitlementReady: previewing || state.subscription.entitlementReady,
      premium: previewing ? state.effectivePreview.premium : state.subscription.isPremium,
      foreground: state.layout.foreground, online: state.layout.online, blocked: state.layout.blocked && !state.layout.allowed.includes(id),
      native: Capacitor.isNativePlatform(), sdkAvailable: state.nativeAvailable, nativeVersion: previewing ? '31.0' : state.nativeVersion,
      compiledAppId: platform === 'ios' ? import.meta.env.VITE_ADMOB_IOS_APP_ID || TEST_APP_IDS.ios : import.meta.env.VITE_ADMOB_ANDROID_APP_ID || TEST_APP_IDS.android,
      consent: options.consent ?? (previewing || consentRef.current.canRequestAds), demo: previewing,
      busy: !options.ignoreBusy && busyRef.current, fastPreview: previewing && state.effectivePreview.fast,
      alreadyShowingBanner: options.existingBanner === true };
  }, []);
  const decisionFor = useCallback((id: AdPlacementId, options?: Parameters<typeof contextFor>[1]) => {
    const context = contextFor(id, options), config = current.current.configuration;
    const mode = context.demo ? 'demo' : config?.settings.mode ?? 'demo';
    return evaluateAd(config, id, context, getLedger(mode));
  }, [contextFor, getLedger]);
  const emit = useCallback((id: AdPlacementId, event: AdEvent, mode: AdMode, reason = '') => {
    if (current.current.userId) void reportAdEvent(id, event, mode, Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web', reason, current.current.configuration?.revision);
  }, []);
  const markShown = useCallback((id: AdPlacementId, mode: AdMode) => {
    saveLedger(mode, recordAdShown(getLedger(mode), id, Date.now())); emit(id, 'shown', mode);
    const key = `${mode}:${id}`; if (cadences.current[key]) cadences.current[key] = consumeAdCadence(cadences.current[key]);
  }, [emit, getLedger, saveLedger]);
  const setBusyState = useCallback((value: boolean) => { busyRef.current = value; if (mounted.current) setBusy(value); }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setTick(Date.now()), 5000);
    const unload = () => { adapter.reset(); };
    window.addEventListener('pagehide', unload);
    if (nativeAvailable) {
      void removeNativeAdmobBanner();
      void import('@capacitor/app').then(({ App }) => App.getInfo()).then(info => { if (mounted.current) setNativeVersion(info.version); }).catch(() => {});
    }
    return () => { mounted.current = false; epoch.current++; clearInterval(timer); window.removeEventListener('pagehide', unload);
      demoRef.current?.finish(false); adapter.reset();
      document.documentElement.style.setProperty('--admob-banner-space', '0px');
      document.documentElement.style.setProperty('--admob-viewport-bottom', '0px');
      document.documentElement.style.setProperty('--admob-viewport-top', '0px');
      document.documentElement.classList.remove('admob-banner-visible','admob-position-top','admob-position-middle','admob-position-bottom'); };
  }, [adapter, nativeAvailable]);
  useEffect(() => {
    epoch.current++; adapter.reset(); setBanner(null); setBusyState(false); consentAttempt.current = '';
    session.current = { id: crypto.randomUUID(), startedAt: Date.now(), userId }; ledgerCache.current = {};
    cadences.current = {};
    demoRef.current?.finish(false);
    if (!userId || !isAdmin) { setPreview(noPreview); setPreviewRequested(false); return; }
    try {
      const saved = JSON.parse(sessionStorage.getItem(previewKey) || 'null');
      const requested = new URLSearchParams(window.location.search).get('ad_preview') === '1';
      if (requested || (saved?.userId === userId && saved.expiresAt > Date.now())) {
        setPreview({ enabled: true, platform: saved?.platform === 'android' ? 'android' : 'ios', premium: saved?.premium === true, fast: saved?.fast !== false });
        setPreviewRequested(true);
      }
    } catch { /* Default remains disabled. */ }
  }, [userId, isAdmin, adapter, setBusyState]);
  useEffect(() => {
    // Scroll/DOM dəyişiklikləri saniyədə onlarla dəfə gəlir; layoutState() isə bütün
    // overlay-ları sorğulayır və getComputedStyle çağırır. ~150ms-dən bir hesablanır.
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, last = 0;
    const run = () => {
      timer = undefined;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        last = Date.now();
        const next = layoutState();
        setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      });
    };
    const update = () => {
      if (timer !== undefined) return;
      timer = setTimeout(run, Math.max(0, LAYOUT_THROTTLE_MS - (Date.now() - last)));
    };
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'data-ad-block', 'data-ad-allow', 'aria-modal'] });
    for (const event of ['resize', 'online', 'offline', 'focusin', 'focusout']) window.addEventListener(event, update);
    document.addEventListener('visibilitychange', update); window.visualViewport?.addEventListener('resize', update); update();
    document.addEventListener('scroll', update, scrollOptions);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer);
      for (const event of ['resize', 'online', 'offline', 'focusin', 'focusout']) window.removeEventListener(event, update);
      document.removeEventListener('visibilitychange', update); document.removeEventListener('scroll', update, scrollOptions); window.visualViewport?.removeEventListener('resize', update); };
  }, []);
  const registerSurface = useCallback((id: AdPlacementId) => {
    const token = crypto.randomUUID(); setSurfaces(previous => [...previous, { id, token, startedAt: Date.now() }]);
    return () => setSurfaces(previous => previous.filter(surface => surface.token !== token));
  }, []);
  const registerBlock = useCallback(() => {
    const id = crypto.randomUUID(); setForcedBlocks(items => [...items, id]);
    return () => setForcedBlocks(items => items.filter(value => value !== id));
  }, []);
  const ensureConsent = useCallback(async () => {
    // UMP is device-scoped. A Source session uses the same native SDK and the
    // Source-hosted configuration, without authenticating against Azure.
    if (!nativeAvailable) return false;
    const ownEpoch = epoch.current;
    setBusyState(true);
    try {
      const result = await adapter.consent();
      if (ownEpoch !== epoch.current || !mounted.current) return false;
      consentRef.current = result; setConsent(result); return result.canRequestAds;
    } catch { return false; }
    finally { if (ownEpoch === epoch.current) setBusyState(false); }
  }, [adapter, nativeAvailable, setBusyState]);
  useEffect(() => {
    if (!configuration || effectivePreview.enabled || configuration.settings.mode === 'demo' || !nativeAvailable || busyRef.current) return;
    const eligible = surfaces.find(surface => decisionFor(surface.id, { consent: true }).allowed);
    const key = `${userId}:${configuration.settings.mode}:${configuration.settings.ios_app_id}:${configuration.settings.android_app_id}`;
    if (!eligible || consentAttempt.current === key) return;
    consentAttempt.current = key; void ensureConsent();
  }, [configuration, effectivePreview.enabled, nativeAvailable, surfaces, userId, tick, decisionFor, ensureConsent]);

  const bannerSurface = [...surfaces].reverse().find(surface => placementDefinition(surface.id).format === 'banner');
  const bannerDecision = bannerSurface ? decisionFor(bannerSurface.id, { existingBanner: !!banner?.loaded && banner.id === bannerSurface.id }) : inactive;
  const bannerPosition = configuration?.placements.find(item => item.id === bannerSurface?.id)?.position ?? 'bottom';
  const anchor = bannerSurface ? layout.anchors[bannerSurface.id] : undefined;
  const bannerTop = bannerPosition === 'top' ? layout.safeTop + 8 : bannerPosition === 'middle' ? anchor?.top ?? 0
    : layout.viewportHeight - layout.bottom - (banner?.height ?? 60);
  const bannerVisible = bannerPosition !== 'middle' || anchor?.visible === true;
  const bannerKey = bannerSurface && bannerDecision.allowed ? `${bannerSurface.token}:${bannerDecision.mode}:${bannerDecision.adUnitId}:${configuration?.settings.non_personalized_only}:${bannerPosition}` : '';
  const canDisplay = Boolean(bannerKey && Date.now() >= (backoff.current[bannerKey] ?? 0)
    && (bannerVisible || banner?.key === bannerKey));
  useEffect(() => {
    if (!canDisplay || !bannerSurface || !configuration) { void adapter.stopBanner(); setBanner(null); return; }
    const id = bannerSurface.id, mode = bannerDecision.mode, ownEpoch = epoch.current;
    let cancelled = false, committed = false;
    const valid = () => !cancelled && mounted.current && ownEpoch === epoch.current;
    const loaded = () => {
      if (!valid()) return;
      setBanner(previous => previous?.key === bannerKey ? { ...previous, loaded: true } : previous);
      if (!committed) { committed = true; markShown(id, mode); emit(id, 'loaded', mode); }
    };
    setBanner({ id, mode, height: bannerPosition === 'middle' ? 50 : mode === 'demo' ? 74 : 60, loaded: mode === 'demo', key: bannerKey });
    emit(id, 'requested', mode);
    if (mode === 'demo') { loaded(); emit(id, 'impression', mode); }
    else void adapter.showBanner(bannerDecision.adUnitId!, Math.max(0, bannerPosition === 'bottom'
      ? layout.bottom - (actualPlatform === 'ios' ? layout.safeBottom : 0) : bannerTop - layout.safeTop), mode,
      configuration.settings.non_personalized_only, {
        loaded,
        size: height => { if (valid() && height > 0) setBanner(previous => previous?.key === bannerKey ? { ...previous, height } : previous); },
        impression: () => { if (valid()) emit(id, 'impression', mode); },
        failed: () => { if (valid()) { backoff.current[bannerKey] = Date.now() + 60_000; emit(id, 'failed', mode, 'sdk_error'); setBanner(null); } },
      }, { top: bannerPosition !== 'bottom', inline: bannerPosition === 'middle' });
    return () => { cancelled = true; void adapter.stopBanner(); };
    // Display-session identity is deliberate: unrelated edits and ticks do not reload an ad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerKey, canDisplay, adapter, emit, markShown]);
  useEffect(() => {
    document.documentElement.style.setProperty('--admob-banner-space', banner?.loaded ? `${Math.ceil(banner.height + 18)}px` : '0px');
    document.documentElement.style.setProperty('--admob-viewport-bottom', banner?.loaded && bannerPosition === 'bottom' ? `${Math.ceil(layout.bottom + banner.height + 8)}px` : '0px');
    document.documentElement.style.setProperty('--admob-viewport-top', banner?.loaded && bannerPosition === 'top' ? `${Math.ceil(banner.height + 16)}px` : '0px');
    document.documentElement.classList.toggle('admob-banner-visible', Boolean(banner?.loaded));
    for (const position of ['top','middle','bottom']) document.documentElement.classList.toggle(`admob-position-${position}`, Boolean(banner?.loaded) && position === bannerPosition);
    if (!banner?.loaded || banner.mode === 'demo') { positioned.current = null; return; }
    // Native körpü çağırışı bahalıdır: yalnız mövqe ≥2px dəyişəndə və ya görünmə dəyişəndə
    const top = Math.round(bannerTop), hidden = !bannerVisible, last = positioned.current;
    if (last && last.key === banner.key && last.hidden === hidden && Math.abs(last.top - top) < 2) return;
    positioned.current = { key: banner.key, top, hidden };
    void adapter.positionBanner(top, hidden).catch(() => { positioned.current = null; void adapter.stopBanner(); setBanner(null); });
  }, [banner?.key, banner?.loaded, banner?.height, banner?.mode, layout.bottom, bannerPosition, bannerTop, bannerVisible, adapter]);
  useEffect(() => {
    for (const surface of surfaces) {
      const format = placementDefinition(surface.id).format;
      if (format !== 'interstitial' && format !== 'native_story') continue;
      const decision = decisionFor(surface.id);
      if (decision.allowed && decision.mode !== 'demo' && decision.adUnitId && configuration
        && Date.now() > (backoff.current[surface.id] ?? 0)) {
        const placement = configuration.placements.find(item => item.id === surface.id)!;
        if (format === 'native_story') {
          const video = placement.story_format === 'video';
          if (!adapter.isStoryPrepared(decision.adUnitId, video) && !adapter.isStoryPreparing(decision.adUnitId, video)) {
            emit(surface.id, 'requested', decision.mode);
            void adapter.prepareStory(decision.adUnitId, decision.mode, configuration.settings.non_personalized_only, video).then(ok => {
              if (!ok) backoff.current[surface.id] = Date.now() + 60000;
              emit(surface.id, ok ? 'loaded' : 'failed', decision.mode, ok ? '' : 'sdk_error');
            });
          }
        } else if (!adapter.isPrepared(decision.adUnitId, decision.mode, configuration.settings.non_personalized_only)
          && !adapter.isPreparing(decision.adUnitId, decision.mode, configuration.settings.non_personalized_only)) {
          emit(surface.id, 'requested', decision.mode);
          void adapter.prepare(decision.adUnitId, decision.mode, configuration.settings.non_personalized_only).then(ok => {
            if (!ok) backoff.current[surface.id] = Date.now() + 60_000;
            emit(surface.id, ok ? 'loaded' : 'failed', decision.mode, ok ? '' : 'sdk_error');
          });
        }
      }
    }
  }, [tick, surfaces, configuration, decisionFor, adapter, emit]);

  const present = useCallback(async (id: AdPlacementId, rewarded: boolean): Promise<boolean> => {
    if (busyRef.current) return false;
    const surfaceToken = [...current.current.surfaces].reverse().find(surface => surface.id === id)?.token;
    if (!surfaceToken) return false;
    let decision = decisionFor(id);
    if (rewarded && decision.reason === 'consent') { await ensureConsent(); decision = decisionFor(id); }
    if (!decision.allowed) { emit(id, 'skipped', decision.mode, decision.reason); return false; }
    const config = current.current.configuration!;
    const nativeStory = placementDefinition(id).format === 'native_story';
    const storyVideo = config.placements.find(item => item.id === id)?.story_format === 'video';
    const ownEpoch = epoch.current, mode = decision.mode, minutes = config.settings.reward_pause_minutes;
    const stillCurrent = () => mounted.current && epoch.current === ownEpoch;
    const grant = () => {
      if (!stillCurrent()) return;
      if (id === 'ads_pause_rewarded') {
        const ledger = getLedger(mode); ledger.pause_until = Math.max(ledger.pause_until, Date.now() + minutes * 60_000);
        saveLedger(mode, ledger);
      }
      emit(id, 'reward_earned', mode);
    };
    if (mode !== 'demo' && !rewarded && !(nativeStory ? adapter.isStoryPrepared(decision.adUnitId!, storyVideo)
      : adapter.isPrepared(decision.adUnitId!, mode, config.settings.non_personalized_only))) {
      emit(id, 'skipped', mode, 'not_ready'); return false;
    }
    setBusyState(true); void adapter.stopBanner(); setBanner(null);
    try {
      if (mode === 'demo') return await new Promise<boolean>(resolve => {
        let finished = false;
        markShown(id, mode); emit(id, 'impression', mode);
        const finish = (earned: boolean) => {
          if (finished) return; finished = true;
          if (earned && rewarded && stillCurrent()) grant();
          emit(id, 'dismissed', mode);
          if (mounted.current) setDemo(null);
          resolve(rewarded ? earned && stillCurrent() : true);
        };
        setDemo({ id, minutes, finish });
      });
      if (rewarded) {
        emit(id, 'requested', mode);
        if (!await adapter.prepare(decision.adUnitId!, mode, config.settings.non_personalized_only, true)) {
          emit(id, 'failed', mode, 'sdk_error'); return false;
        }
        emit(id, 'loaded', mode);
      }
      const allowed = () => stillCurrent() && current.current.surfaces.some(surface => surface.token === surfaceToken)
        && decisionFor(id, { ignoreBusy: true }).allowed;
      const callbacks = {
          shown: () => { if (stillCurrent()) markShown(id, mode); },
          impression: () => { if (stillCurrent()) emit(id, 'impression', mode); }, rewarded: grant,
      };
      const result = nativeStory ? await adapter.showStory(decision.adUnitId!, storyVideo, allowed, callbacks)
        : await adapter.showFullscreen(decision.adUnitId!, mode, config.settings.non_personalized_only, rewarded, allowed, callbacks);
      if (stillCurrent()) emit(id, result.shown ? 'dismissed' : 'failed', mode, result.shown ? '' : 'sdk_error');
      return rewarded ? result.rewarded && stillCurrent() : result.shown;
    } finally { if (stillCurrent()) setBusyState(false); }
  }, [adapter, decisionFor, emit, ensureConsent, getLedger, markShown, saveLedger, setBusyState]);
  const startPreview = useCallback(async (options: Partial<AdPreview> = {}) => {
    if (!userId || !isAdmin) return;
    await fetchAdmobOverview();
    const next = { ...noPreview, ...options, enabled: true };
    try { sessionStorage.setItem(previewKey, JSON.stringify({ ...next, userId, expiresAt: Date.now() + 2 * 3600_000 })); } catch { /* In-memory preview still works. */ }
    setPreview(next); setPreviewRequested(true);
  }, [userId, isAdmin]);
  const stopPreview = useCallback(() => {
    try { sessionStorage.removeItem(previewKey); } catch { /* Optional persistence. */ }
    const url = new URL(window.location.href); url.searchParams.delete('ad_preview'); url.searchParams.delete('ad_screen');
    window.history.replaceState(window.history.state, '', url);
    setPreview(noPreview); setPreviewRequested(false); demoRef.current?.finish(false);
  }, []);
  const resetDemo = useCallback(() => { saveLedger('demo', emptyAdLedger(Date.now(), session.current.id)); backoff.current = {}; cadences.current = {}; }, [saveLedger]);
  const opportunity = useCallback((id: AdPlacementId, key: string) => {
    const config = current.current.configuration, placement = config?.placements.find(item => item.id === id);
    if (!config?.settings.enabled || !placement?.enabled) return false;
    const mode = current.current.effectivePreview.enabled ? 'demo' : config.settings.mode;
    const ledgerKey = `${mode}:${id}`;
    const result = advanceAdCadence(cadences.current[ledgerKey] ?? { count: 0, seen: [] }, key, placement.every_n);
    cadences.current[ledgerKey] = result.state; return result.due;
  }, []);
  const openPrivacy = useCallback(async () => {
    if (!nativeAvailable || busyRef.current) return;
    const ownEpoch = epoch.current; setBusyState(true);
    try {
      const result = await adapter.privacyOptions();
      if (mounted.current && epoch.current === ownEpoch) { consentRef.current = result; setConsent(result); }
    } catch { toast.error('Reklam məxfilik seçimləri hazırda açılmır. Yenidən cəhd edin.'); }
    finally { if (ownEpoch === epoch.current) setBusyState(false); }
  }, [adapter, nativeAvailable, setBusyState]);
  const mode = effectivePreview.enabled ? 'demo' : configuration?.settings.mode ?? 'demo';
  // Consumers (~30 across the app) only need minute-level countdowns/eligibility.
  // Re-rendering all of them on every 5s internal tick caused jank on low-end devices.
  const consumerClock = Math.floor(tick / 30_000);
  const value = useMemo<AdExperience>(() => ({ configuration, preview: effectivePreview, consent, nativeAvailable, busy,
    pauseUntil: getLedger(mode).pause_until, bannerId: banner?.loaded ? banner.id : null,
    registerSurface, registerBlock, decisionFor, showInterstitial: id => present(id, false), showRewarded: (id = 'ads_pause_rewarded') => present(id, true),
    showStory: () => present('community_story_break', false), opportunity,
    startPreview, stopPreview, resetDemo, openPrivacy }),
  // The clock updates consumer countdowns and eligibility diagnostics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [configuration, effectivePreview.enabled, preview, consent, nativeAvailable, busy, banner, consumerClock, registerSurface, decisionFor, present, startPreview, stopPreview, resetDemo, openPrivacy]);
  return <AdContext.Provider value={value}>
    {children}
    <span id="admob-safe-area-probe" aria-hidden style={{ position: 'fixed', visibility: 'hidden', pointerEvents: 'none', paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }} />
    {banner?.loaded && <div className="admob-banner-dock" style={{ top: bannerTop, height: banner.height, visibility: bannerVisible ? 'visible' : 'hidden', ...(bannerPosition === 'middle' ? { width: 'min(320px, calc(100% - 16px))' } : {}) }} data-testid="ad-banner-dock" data-placement={banner.id} data-position={bannerPosition}>
      {banner.mode === 'demo' && <DemoBanner placementId={banner.id} onClick={() => {
        emit(banner.id, 'demo_clicked', 'demo'); toast.info('Bu demo reklamdır. Real reklamın məzmununu AdMob təqdim edir.');
      }} />}
    </div>}
    {effectivePreview.enabled && <div className="admob-preview-toolbar" data-testid="ad-preview-toolbar">
      <Eye size={13} /><span>Ad demo · {preview.platform} · {preview.premium ? 'Premium' : 'Free'}</span>
      <button aria-label="Demo limitlərini sıfırla" onClick={resetDemo}><Settings2 size={14} /></button>
      <button aria-label="Demo rejimini bağla" onClick={stopPreview}><X size={14} /></button>
    </div>}
    {demo && <DemoFullscreen key={demo.id} placementId={demo.id} rewardMinutes={demo.minutes}
      storyFormat={configuration?.placements.find(item => item.id === demo.id)?.story_format} onFinish={demo.finish} />}
  </AdContext.Provider>;
}

export function AdSurface({ id, enabled = true }: { id: AdPlacementId; enabled?: boolean }) {
  const { registerSurface } = useAdExperience();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!enabled || !AD_PLACEMENT_IDS.includes(id)) return;
    const dispose = registerSurface(id), parent = ref.current?.parentElement;
    if (parent && placementDefinition(id).format === 'banner') {
      parent.setAttribute('data-ad-screen', id);
      if (!parent.closest('[data-scroll-container]')) parent.setAttribute('data-ad-standalone', 'true');
    }
    return () => { dispose(); if (parent?.getAttribute('data-ad-screen') === id) { parent.removeAttribute('data-ad-screen'); parent.removeAttribute('data-ad-standalone'); } };
  }, [id, enabled, registerSurface]);
  return <span ref={ref} aria-hidden hidden data-ad-placement={id} />;
}

export function useAdSafetyBlock(active: boolean) {
  const { registerBlock } = useAdExperience();
  useEffect(() => active ? registerBlock() : undefined, [active, registerBlock]);
}

export function useAdExit(id: AdPlacementId, onExit: () => void, active = true) {
  const ads = useAdExperience(), mounted = useRef(true), exiting = useRef(false), action = useRef(onExit);
  action.current = onExit;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => active ? ads.registerSurface(id) : undefined, [active, id, ads.registerSurface]);
  return useCallback(async () => {
    if (exiting.current) return; exiting.current = true;
    try { if (active) await ads.showInterstitial(id); }
    finally { if (mounted.current) action.current(); exiting.current = false; }
  }, [active, ads.showInterstitial, id]);
}

export function AdInlineAnchor({ id }: { id: AdPlacementId }) {
  const ads = useAdExperience(), ref = useRef<HTMLDivElement>(null);
  const placement = ads.configuration?.placements.find(item => item.id === id);
  const active = placement?.position === 'middle' && (ads.bannerId === id || ads.decisionFor(id).allowed);
  useEffect(() => {
    const update = () => window.dispatchEvent(new Event('resize'));
    if (typeof ResizeObserver === 'undefined') { update(); return; }
    const observer = new ResizeObserver(update); if (ref.current) observer.observe(ref.current); update();
    return () => observer.disconnect();
  }, [active]);
  return <div ref={ref} data-ad-inline-anchor={id} aria-hidden className={active ? 'my-4' : ''} style={{ height: active ? 50 : 0, minHeight: active ? 50 : 0 }} />;
}
