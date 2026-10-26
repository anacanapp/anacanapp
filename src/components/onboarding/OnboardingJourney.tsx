import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, CalendarDays, HeartHandshake, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useLifeStageEnabled } from '@/hooks/useAppSettings';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { isNativePlatform } from '@/lib/revenuecat';
import { pushBackHandler } from '@/lib/backButton';
import { useChildStore } from '@/store/childStore';
import { saveOnboardingSetup, claimOnboardingOffer, completeOnboarding, adoptLegacyOnboarding } from '@/lib/onboarding-persistence';
import { BRANCH_QUESTIONS, MULTI_QUESTIONS, ONBOARDING_STAGES, isOnboardingStage, isQuestion,
  journeyRecord, newOnboardingDraft, onboardingDataError, onboardingDraftKey, onboardingSteps, readOnboardingDraft,
  recommendedOnboardingPlan, selectOnboardingStage, toggleOnboardingAnswer, writeOnboardingDraft, onboardingQuestionOptions,
  type OnboardingDraft, type OnboardingOutcome, type OnboardingStep } from '@/lib/onboarding-model';
import { onboardingText, onboardingNumber, onboardingDate, type OnboardingCopyKey } from '@/lib/onboarding-i18n';
import { OnboardingCompanion, OnboardingFamily, type CompanionPose } from './OnboardingCompanion';
import { OnboardingFrame, OnboardingButton } from './OnboardingFrame';
import { OnboardingFields } from './OnboardingFields';
import { OnboardingBenefits } from './OnboardingBenefits';
import OnboardingPaywall from './OnboardingPaywall';
import type { Profile } from '@/contexts/AuthContext';

const LegalScreen = lazy(() => import('@/components/LegalScreen'));

function initialDraft(actor: string, backend: string, profile: Profile | null): OnboardingDraft {
  const stored = readOnboardingDraft(actor, backend);
  const draft = stored ?? newOnboardingDraft(actor, backend, profile?.name);
  if (!stored && useUserStore.getState().hasSeenIntro) draft.step = 'stage';
  const record = journeyRecord(profile?.onboarding_answers);
  if (!record) return { ...draft, setupComplete: false };
  const localMatches = record.id === draft.id;
  return { ...draft, id: record.id, stage: isOnboardingStage(profile?.life_stage) ? profile.life_stage : draft.stage,
    name: profile?.name || draft.name, setupComplete: true, saveStarted: true, offerSeen: !!record.offerSeenAt, plan: record.plan,
    answers: localMatches ? draft.answers : (profile?.onboarding_answers || {}) as OnboardingDraft['answers'],
    babyCount: profile?.baby_count ?? draft.babyCount, lastPeriodDate: profile?.last_period_date || draft.lastPeriodDate,
    pregnancyDate: profile?.last_period_date || draft.pregnancyDate, dateMode: 'lmp',
    step: draft.purchasePending && localMatches ? 'paywall' : record.offerSeenAt && draft.step === 'offer' ? 'free'
      : localMatches && ['results','features','paywall','free','success'].includes(draft.step) ? draft.step : 'results' };
}

export default function OnboardingJourney({ onComplete, legacyPending = false, offerEnabled = true }: {
  onComplete?: () => void; legacyPending?: boolean; offerEnabled?: boolean;
}) {
  const { user, profile, refreshProfile, updateProfile } = useAuth();
  const language = useUserStore(state => state.language);
  const actor = user?.id || '', backend = getBackendConfig().url;
  const native = isNativePlatform();
  const bumpEnabled = useLifeStageEnabled('bump'), mommyEnabled = useLifeStageEnabled('mommy'), flowEnabled = useLifeStageEnabled('flow');
  const enabled = { bump: bumpEnabled, mommy: mommyEnabled, flow: flowEnabled };
  const [draft, setDraft] = useState(() => initialDraft(actor, backend, profile));
  const draftRef = useRef(draft); draftRef.current = draft;
  const [busy, setBusy] = useState(false), lock = useRef(false), alive = useRef(true);
  const [error, setError] = useState<OnboardingCopyKey | null>(null), [progress, setProgress] = useState(0);
  const [legal, setLegal] = useState<'privacy_policy' | 'terms_of_service' | null>(null);
  const advancing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameOnly = !!profile?.life_stage && !legacyPending && (!journeyRecord(profile.onboarding_answers) || !!journeyRecord(profile.onboarding_answers)?.completedAt)
    && (!profile.name?.trim() || profile.name === 'İstifadəçi');
  const current: OnboardingStep = nameOnly ? 'name' : draft.step;
  const steps = onboardingSteps(draft.stage, native);
  const progressStep = draft.setupComplete && ['offer','free','success'].includes(current) ? steps.length
    : Math.min(steps.length, Math.max(1, steps.indexOf(current) + 1));
  const t = useCallback((key: OnboardingCopyKey, values?: Record<string, string | number>) => onboardingText(language, key, values), [language]);
  const cancelAdvance = () => { if (advancing.current) clearTimeout(advancing.current); advancing.current = null; };
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancelAdvance(); }; }, []);

  const commit = (next: OnboardingDraft): boolean => {
    if (!alive.current || next.actor !== actor || next.backend !== backend) return false;
    if (nameOnly) { setDraft(next); draftRef.current = next; return true; }
    try { writeOnboardingDraft(next); setError(null); }
    catch {
      const unsaved = { ...next, step: draftRef.current.step };
      setError('storage_failed'); setDraft(unsaved); draftRef.current = unsaved; return false;
    }
    setDraft(next); draftRef.current = next; return true;
  };
  const move = (step: OnboardingStep) => { cancelAdvance(); commit({ ...draftRef.current, step }); };
  const syncUi = async (saved: Profile) => {
    if (!alive.current || saved.user_id !== actor) return;
    // These identity/data values come only from the verified actor's server row.
    useUserStore.setState({ name: saved.name, babyCount: saved.baby_count ?? 1, multiplesType: saved.multiples_type ?? null });
    await refreshProfile();
    if (alive.current && draftRef.current.stage === 'mommy') {
      useChildStore.getState().setSelectedChildId(draftRef.current.children[0]?.id || null);
      window.dispatchEvent(new Event('anacan:children-updated'));
    }
  };
  const reportError = (failure: unknown) => { if (alive.current) setError((failure as Error)?.message === 'ONBOARDING_ACCOUNT_CHANGED' ? 'account_changed' : 'save_failed'); };

  const saveSetup = async () => {
    if (lock.current) return;
    const candidate = draftRef.current;
    const invalid = onboardingDataError(candidate);
    if (invalid) { setError(invalid as OnboardingCopyKey); return; }
    if (!commit({ ...candidate, saveStarted: true, step: 'analysis' })) return;
    lock.current = true; setBusy(true); setProgress(0);
    try {
      const saved = await saveOnboardingSetup(draftRef.current, language, amount => { if (alive.current) setProgress(amount); });
      if (!alive.current) return;
      const completed = { ...draftRef.current, setupComplete: true, plan: recommendedOnboardingPlan(candidate.answers), step: 'results' as const };
      commit(completed);
      useUserStore.getState().setFunnelCompleted(false);
      await syncUi(saved);
    } catch (failure) { reportError(failure); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !actor) return;
    initialized.current = true;
    if (legacyPending && !journeyRecord(profile?.onboarding_answers)) {
      lock.current = true; setBusy(true);
      void adoptLegacyOnboarding(actor, backend).then(async saved => {
        if (!alive.current) return;
        commit(initialDraft(actor, backend, saved)); await syncUi(saved);
      }).catch(reportError).finally(() => { lock.current = false; if (alive.current) setBusy(false); });
    } else if (!nameOnly) {
      // Recover a suspended save by rerunning the idempotent confirmation path.
      if (draft.step === 'analysis' && !draft.setupComplete) void saveSetup();
      else commit(draft);
    }
  }, [actor, backend]);

  const saveName = async () => {
    if (lock.current || !draft.name.trim() || draft.name.trim().length > 80) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await updateProfile({ name: draft.name.trim() });
      if (result.error || result.data?.user_id !== actor || result.data?.name !== draft.name.trim()) throw new Error('ONBOARDING_NAME_SAVE_FAILED');
      if (alive.current) { useUserStore.setState({ name: result.data.name }); onComplete?.(); }
    } catch (failure) { reportError(failure); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const next = () => {
    if (lock.current) return;
    cancelAdvance();
    if (nameOnly) { void saveName(); return; }
    const active = draftRef.current;
    if (active.step === 'name' && !active.name.trim()) { setError('name_required'); return; }
    if (active.step === 'data') {
      const invalid = onboardingDataError(active);
      if (invalid) { setError(invalid as OnboardingCopyKey); return; }
    }
    const index = steps.indexOf(active.step);
    const target = steps[index + 1];
    if (target === 'analysis') { void saveSetup(); return; }
    if (target === 'paywall' && !offerEnabled) { move('free'); return; }
    if (target) move(target);
  };
  const back = () => {
    if (lock.current) return;
    cancelAdvance();
    if (legal) { setLegal(null); return; }
    const active = draftRef.current;
    if (active.setupComplete && ['results','features','paywall','offer','free','success'].includes(active.step)) {
      if (active.step === 'features' || active.step === 'paywall') move('results');
      return;
    }
    const index = steps.indexOf(active.step), previous = steps[index - 1];
    if (active.saveStarted && previous && steps.indexOf(previous) < steps.indexOf('data')) return;
    if (previous) move(previous);
  };
  const backRef = useRef(back); backRef.current = back;
  useEffect(() => pushBackHandler(() => { backRef.current(); return true; }), []);

  const finish = async (outcome: OnboardingOutcome) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await completeOnboarding(actor, backend, outcome, undefined, draftRef.current.plan);
      if (!alive.current) return;
      await syncUi(result.profile);
      try { localStorage.removeItem(onboardingDraftKey(actor, backend)); localStorage.removeItem('anacan_pending_funnel'); } catch { /* Server completion remains authoritative. */ }
      if (alive.current) { useUserStore.getState().setFunnelCompleted(true); onComplete?.(); }
    } catch (failure) { reportError(failure); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const offer = async (): Promise<boolean> => {
    if (lock.current || draftRef.current.offerSeen) return false;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await claimOnboardingOffer(actor, backend);
      if (!alive.current) return false;
      if (!result.changed) { commit({ ...draftRef.current, offerSeen: true, step: 'free' }); return false; }
      commit({ ...draftRef.current, offerSeen: true, step: 'offer' });
      return true;
    } catch (failure) { reportError(failure); throw failure; }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const legalLinks = <div className="onb-legal"><button type="button" onClick={() => setLegal('privacy_policy')}>{t('privacy')}</button>
    <button type="button" onClick={() => setLegal('terms_of_service')}>{t('terms')}</button></div>;
  const canBack = !nameOnly && current !== 'welcome' && !(draft.setupComplete && ['results','offer','free','success'].includes(current))
    && !(draft.saveStarted && ['data','stage','name'].includes(current));
  const title = (heading: string, subtitle?: string) => <><h1 tabIndex={-1}>{heading}</h1>{subtitle && <p className="onb-sub">{subtitle}</p>}</>;
  const companion = (pose: CompanionPose, size: 'hero' | 'compact' | 'tiny' = 'compact') => draft.stage
    ? <OnboardingCompanion stage={draft.stage} pose={pose} language={language} size={size} /> : <OnboardingFamily language={language} />;
  const stageTitle = draft.stage ? t(`stage_${draft.stage}`) : '';
  const featureKeys: OnboardingCopyKey[] = draft.stage === 'bump' ? ['development','birth_prep','nutrition']
    : draft.stage === 'mommy' ? ['sleep','feeding','milestones'] : ['track','symptoms','health'];
  const list = (keys: OnboardingCopyKey[]) => <ul className="onb-list">{keys.map(key => <li key={key}><Check size={19} aria-hidden="true" /><span>{t(key)}</span></li>)}</ul>;
  let content: React.ReactNode, footer: React.ReactNode = <OnboardingButton onClick={next} busy={busy}>{t('next')}</OnboardingButton>;

  if (isQuestion(current)) {
    const options = onboardingQuestionOptions(draft, current);
    const multi = MULTI_QUESTIONS.has(current), chosen = draft.answers[current];
    const branchIndex = draft.stage ? BRANCH_QUESTIONS[draft.stage].indexOf(current) : -1;
    const pose: CompanionPose = branchIndex >= 0 ? `q${branchIndex + 1}` as CompanionPose : current === 'duration' ? 'q4' : current === 'budget' ? 'q5' : 'q2';
    content = <>{companion(pose, 'tiny')}{title(t((current === 'concern' ? `q_concern_${draft.stage}` : `q_${current}`) as OnboardingCopyKey), t(multi ? 'multi_hint' : 'single_hint'))}
      <div className="onb-options">{options.map(option => {
        const selected = Array.isArray(chosen) ? chosen.includes(option) : chosen === option;
        return <button type="button" key={option} data-answer={option} className="onb-option" disabled={busy} aria-pressed={selected} onClick={() => {
          cancelAdvance();
          const updated = { ...draftRef.current, answers: { ...draftRef.current.answers, [current]: multi ? toggleOnboardingAnswer(chosen, option) : option } };
          if (current === 'regularity' && option === 'regular' && updated.answers.concern === 'irregular') delete updated.answers.concern;
          if (commit(updated) && !multi) advancing.current = setTimeout(() => { advancing.current = null; if (alive.current && draftRef.current.step === current) next(); }, 220);
        }}><span className="onb-option-label">{t(option as OnboardingCopyKey)}</span>{selected && <Check size={19} className="onb-check" aria-hidden="true" />}</button>;
      })}</div></>;
    footer = <>{multi && <OnboardingButton onClick={next} busy={busy}>{t('next')}</OnboardingButton>}
      <OnboardingButton secondary onClick={() => { cancelAdvance(); const answers = { ...draftRef.current.answers }; delete answers[current]; if (commit({ ...draftRef.current, answers })) next(); }} busy={busy}>{t('skip')}</OnboardingButton></>;
  } else switch (current) {
    case 'welcome':
      content = <><OnboardingFamily language={language} /><div className="onb-center"><p className="onb-eyebrow">{t('welcome_eyebrow')}</p>{title(t('welcome_title'), t('welcome_sub'))}</div>
        <div className="onb-feature-grid">{[[CalendarDays, 'feature_tracking'], [LayoutGrid, 'feature_tools'], [HeartHandshake, 'feature_community']].map(([Icon, key]) => {
          const Graphic = Icon as typeof CalendarDays; return <div key={String(key)}><Graphic size={22} /><span>{t(key as OnboardingCopyKey)}</span></div>;
        })}</div><p className="onb-note">{t('own_pace')}</p></>;
      footer = <OnboardingButton onClick={next}>{t('start')}</OnboardingButton>; break;
    case 'stage':
      content = <>{title(t('stage_title'), t('stage_sub'))}<div className="onb-options">{ONBOARDING_STAGES.filter(stage => enabled[stage]).map(stage =>
        <button type="button" key={stage} className="onb-option" data-stage={stage} aria-pressed={draft.stage === stage} onClick={() => commit(selectOnboardingStage(draftRef.current, stage))}>
          <OnboardingCompanion stage={stage} pose="mode" size="option" language={language} /><span className="onb-option-label">{t(`stage_${stage}`)}<small>{t(`stage_${stage}_sub`)}</small></span>
          {draft.stage === stage && <Check size={19} aria-hidden="true" />}
        </button>)}</div>{!ONBOARDING_STAGES.some(stage => enabled[stage]) && <p role="status">{t('stage_unavailable')}</p>}</>;
      footer = null; break;
    case 'name':
      content = <>{companion('name')}{title(t('name_title'), t('name_sub'))}<label className="onb-field" htmlFor="onb-name">{t('name_label')}
        <input id="onb-name" value={draft.name} autoComplete="given-name" maxLength={80} disabled={busy} required
          onChange={event => commit({ ...draftRef.current, name: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && draft.name.trim()) next(); }} /></label></>;
      footer = <OnboardingButton onClick={next} busy={busy} disabled={!draft.name.trim()}>{t('next')}</OnboardingButton>; break;
    case 'data':
      content = <>{companion('data', 'compact')}{title(t(`data_${draft.stage}_title` as OnboardingCopyKey), t('data_sub'))}
        <OnboardingFields draft={draft} language={language} onChange={commit} disabled={busy} />
        {onboardingDataError(draft) && <p className="onb-note" role="status">{t(onboardingDataError(draft) as OnboardingCopyKey)}</p>}</>;
      footer = <OnboardingButton onClick={next} busy={busy} disabled={!!onboardingDataError(draft)}>{t('next')}</OnboardingButton>; break;
    case 'support': content = <>{companion('sproof', 'hero')}{title(t('support_title'), t('support_sub'))}</>; break;
    case 'privacy': content = <>{companion('privacy', 'hero')}{title(t('privacy_title'))}{list(['privacy_save','privacy_draft','privacy_optional'])}{legalLinks}</>; break;
    case 'value': content = <>{companion('value', 'hero')}{title(t('value_title'), t('value_sub'))}{list(featureKeys)}</>; break;
    case 'notifications':
      content = <>{companion('privacy', 'hero')}{title(t('notifications_title'), t('notifications_sub'))}</>;
      footer = <><OnboardingButton busy={busy} onClick={() => {
        if (lock.current) return;
        lock.current = true; setBusy(true);
        void import('@capacitor-firebase/messaging').then(async ({ FirebaseMessaging }) => {
          let permission = await FirebaseMessaging.checkPermissions();
          if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await FirebaseMessaging.requestPermissions();
          return permission.receive === 'granted';
        }).catch(() => false).then(granted => {
          lock.current = false; if (!alive.current) return; setBusy(false);
          if (commit({ ...draftRef.current, notifications: granted ? 'granted' : 'denied' })) void saveSetup();
        });
      }}>{t('allow_notifications')}</OnboardingButton><OnboardingButton secondary busy={busy} onClick={() => { if (commit({ ...draftRef.current, notifications: 'skipped' })) void saveSetup(); }}>{t('not_now')}</OnboardingButton></>; break;
    case 'analysis':
      content = <>{companion('analysis')}{title(t('analysis_title'), t('analysis_sub'))}
        <div className="onb-ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t('analysis_title')}>
          <svg width="106" height="106" viewBox="0 0 106 106" aria-hidden="true"><circle cx="53" cy="53" r="46" fill="none" stroke="var(--onb-line)" strokeWidth="7" />
            <circle cx="53" cy="53" r="46" fill="none" stroke="var(--onb-accent)" strokeWidth="7" strokeDasharray="289.03" strokeDashoffset={289.03 * (1 - progress / 100)} strokeLinecap="round" /></svg>
          <strong>{onboardingNumber(language, progress)}%</strong>
        </div><ul className="onb-list onb-save-steps">{(['saving_details','saving_preferences','saving_profile','saved'] as const).map((key, i) =>
          <li key={key} data-done={progress >= [50, 65, 90, 100][i]}><Check size={18} aria-hidden="true" />{t(key)}</li>)}</ul></>;
      footer = error ? <OnboardingButton onClick={() => void saveSetup()} busy={busy}>{t('retry')}</OnboardingButton> : null; break;
    case 'results': {
      content = <><div className="onb-summary-heading"><div>{title(t('results_title', { name: draft.name }), t('results_sub'))}</div>{companion('results', 'tiny')}</div>
        <div className="onb-results-chips"><span>{stageTitle}</span>
        {draft.stage === 'mommy' && <span>{t('child_number', { n: onboardingNumber(language, draft.babyCount) })}</span>}
        {draft.stage !== 'mommy' && profile?.last_period_date && <span>{onboardingDate(language, profile.last_period_date)}</span>}</div>
        <OnboardingBenefits stage={draft.stage!} page="results" language={language} /></>;
      footer = <OnboardingButton onClick={next} busy={busy}>{t('view_plan')}</OnboardingButton>; break;
    }
    case 'features': content = <><div className="onb-summary-heading"><div>{title(t('features_title'), t('features_sub'))}</div>{companion('proof', 'tiny')}</div>
      <OnboardingBenefits stage={draft.stage!} page="features" language={language} /></>; break;
    case 'paywall': case 'offer':
      content = <OnboardingPaywall stage={draft.stage!} language={language} mode={current} initialPlan={draft.plan}
        onPlanChange={plan => commit({ ...draftRef.current, plan })}
        offerSeen={draft.offerSeen || !offerEnabled} pending={draft.purchasePending} onPending={() => commit({ ...draftRef.current, purchasePending: true })}
        onOffer={offer} onSkip={() => move('free')} onLegal={setLegal} onSuccess={(outcome, selectedPlan) => commit({ ...draftRef.current, plan: selectedPlan || draftRef.current.plan, purchasePending: false, outcome, step: 'success' })} />;
      footer = null; break;
    case 'free': content = <>{companion('freemode', 'hero')}{title(t('free_title'), t('free_sub'))}{list(featureKeys)}</>;
      footer = <OnboardingButton data-testid="onb-finish" onClick={() => void finish('free')} busy={busy}>{t('continue_free')}</OnboardingButton>; break;
    case 'success': content = <>{companion('success', 'hero')}{title(t('success_title'), t('success_sub'))}{list(['premium_ai','premium_noads','premium_household'])}</>;
      footer = <OnboardingButton onClick={() => void finish(draft.outcome || 'existing')} busy={busy}>{t('open_app')}</OnboardingButton>; break;
  }
  if (legal) return <OnboardingFrame language={language} step={`legal-${legal}`} onBack={() => setLegal(null)}>
    <Suspense fallback={<p role="status">{t('working')}</p>}><LegalScreen initialDocument={legal} onBack={() => setLegal(null)} /></Suspense>
  </OnboardingFrame>;
  return <OnboardingFrame language={language} step={current} current={nameOnly ? 1 : progressStep}
    total={nameOnly ? 1 : steps.length} onBack={canBack ? back : undefined} busy={busy}
    footer={error || footer ? <>{error && <p role="alert" className="onb-error">{t(error)}</p>}{footer}</> : null}>
    {content}
  </OnboardingFrame>;
}
