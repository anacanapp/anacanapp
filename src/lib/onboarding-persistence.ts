import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { isAppLanguage } from './app-languages';
import type { Profile } from '@/contexts/AuthContext';
import { childDueDate, journeyRecord, multiplesType, onboardingDataError, pregnancyDates, recommendedOnboardingPlan,
  validatedOnboardingAnswers, type OnboardingDraft, type OnboardingJourneyRecord, type OnboardingOutcome } from './onboarding-model';

type SavedProfile = Profile & { onboarding_answers: Record<string, unknown> };
type Port = { client: typeof supabase; realm: () => string };
const defaultPort: Port = { client: supabase, realm: () => getBackendConfig().url };
function assert(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

async function checkActor(actor: string, backend: string, port: Port) {
  const { data, error } = await port.client.auth.getSession();
  assert(!error && data.session?.user.id === actor && port.realm() === backend, 'ONBOARDING_ACCOUNT_CHANGED');
}
async function readProfile(actor: string, backend: string, port: Port): Promise<SavedProfile> {
  await checkActor(actor, backend, port);
  const { data, error } = await port.client.from('profiles').select('*').eq('user_id', actor).single();
  assert(!error && data?.user_id === actor, 'ONBOARDING_PROFILE_READ_FAILED');
  await checkActor(actor, backend, port);
  return data as SavedProfile;
}

/** Existing CDC-enrolled relations only. Write children/preferences before the
 * profile's completion marker. Stable child UUIDs make interrupted retries safe;
 * no successful UI transition is allowed until every write is read back. */
export async function saveOnboardingSetup(draft: OnboardingDraft, language: string,
  onProgress: (percent: number) => void = () => {}, port: Port = defaultPort): Promise<SavedProfile> {
  assert(!onboardingDataError(draft), 'ONBOARDING_INVALID_DATA');
  assert(isAppLanguage(language), 'ONBOARDING_INVALID_LANGUAGE');
  const { actor, backend } = draft;
  const before = await readProfile(actor, backend, port);
  const existingJourney = journeyRecord(before.onboarding_answers);
  // A timed-out successful commit is acknowledged, not repeated. Established
  // profiles from another journey must never have their dates overwritten.
  if (existingJourney?.id === draft.id && existingJourney.setupCompletedAt) return before;
  assert(!before.life_stage && !existingJourney, 'ONBOARDING_PROFILE_ALREADY_CONFIGURED');
  onProgress(15);

  if (draft.stage === 'mommy') {
    for (const [index, child] of draft.children.entries()) {
      await checkActor(actor, backend, port);
      const expected = { user_id: actor, name: child.name.trim(), birth_date: child.birthDate, gender: child.gender as 'boy' | 'girl',
        due_date: childDueDate(child), avatar_emoji: child.gender === 'girl' ? '👧' : '👦', is_active: true, sort_order: index };
      const lookup = await port.client.from('user_children').select('*').eq('user_id', actor).eq('id', child.id).maybeSingle();
      assert(!lookup.error, 'ONBOARDING_CHILD_READ_FAILED');
      const write = lookup.data
        ? await port.client.from('user_children').update(expected).eq('user_id', actor).eq('id', child.id).select().single()
        : await port.client.from('user_children').insert({ id: child.id, ...expected }).select().single();
      assert(!write.error && write.data?.id === child.id
        && Object.entries(expected).every(([key, value]) => (write.data as Record<string, unknown>)[key] === value), 'ONBOARDING_CHILD_SAVE_FAILED');
      await checkActor(actor, backend, port);
      onProgress(15 + Math.round((index + 1) / draft.children.length * 35));
    }
  }

  await checkActor(actor, backend, port);
  const preferences = { user_id: actor, language, ...(draft.notifications === 'skipped' ? {} : {
    notifications_enabled: draft.notifications === 'granted', push_enabled: draft.notifications === 'granted',
    daily_push_enabled: draft.notifications === 'granted',
  }) };
  const savedPreferences = await port.client.from('user_preferences').upsert(preferences, { onConflict: 'user_id' }).select().single();
  assert(!savedPreferences.error && savedPreferences.data
    && Object.entries(preferences).every(([key, value]) => (savedPreferences.data as Record<string, unknown>)[key] === value), 'ONBOARDING_PREFERENCES_SAVE_FAILED');
  onProgress(65);
  await checkActor(actor, backend, port);

  const journey: OnboardingJourneyRecord = { version: 3, id: draft.id, revision: crypto.randomUUID(), setupCompletedAt: new Date().toISOString(),
    completedAt: null, offerSeenAt: null, outcome: null, plan: recommendedOnboardingPlan(draft.answers) };
  const answers = { ...object(before.onboarding_answers), ...validatedOnboardingAnswers(draft), notifications: draft.notifications, v: 3, journey,
    ...(draft.stage === 'mommy' ? { children: draft.children.map(child => ({ id: child.id, term: child.term || null,
      gestational_weeks: child.term === 'preterm' ? child.gestationalWeeks : null })) } : {}),
  };
  let fields: Record<string, unknown> = { name: draft.name.trim(), life_stage: draft.stage, onboarding_answers: answers };
  if (draft.stage === 'bump') {
    const dates = pregnancyDates(draft);
    fields = { ...fields, last_period_date: dates.lastPeriod, due_date: dates.due, baby_count: draft.babyCount, multiples_type: multiplesType(draft.babyCount) };
  } else if (draft.stage === 'mommy') {
    const first = draft.children[0];
    fields = { ...fields, baby_name: first.name.trim(), baby_birth_date: first.birthDate, baby_gender: first.gender,
      baby_count: draft.babyCount, multiples_type: multiplesType(draft.babyCount), delivery_type: draft.deliveryType || null };
  } else fields = { ...fields, last_period_date: draft.lastPeriodDate, cycle_length: draft.cycleLength, period_length: draft.periodLength };

  // The final conditional update also refuses a parallel setup on another device.
  const result = await port.client.from('profiles').update(fields).eq('user_id', actor).is('life_stage', null).select().maybeSingle();
  assert(!result.error, 'ONBOARDING_PROFILE_SAVE_FAILED');
  await checkActor(actor, backend, port);
  const saved = result.data as SavedProfile | null;
  assert(saved?.user_id === actor && journeyRecord(saved.onboarding_answers)?.id === draft.id
    && Object.entries(fields).filter(([key]) => key !== 'onboarding_answers').every(([key, value]) => (saved as unknown as Record<string, unknown>)[key] === value), 'ONBOARDING_PROFILE_SAVE_UNCONFIRMED');
  onProgress(90);
  const confirmed = await readProfile(actor, backend, port);
  assert(journeyRecord(confirmed.onboarding_answers)?.revision === journey.revision
    && canonicalJson(confirmed.onboarding_answers) === canonicalJson(answers), 'ONBOARDING_PROFILE_SAVE_UNCONFIRMED');
  onProgress(100);
  return confirmed;
}

async function changeJourney(actor: string, backend: string,
  update: (record: OnboardingJourneyRecord) => OnboardingJourneyRecord | null, port: Port): Promise<{ profile: SavedProfile; changed: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const profile = await readProfile(actor, backend, port);
    const record = journeyRecord(profile.onboarding_answers);
    assert(record && profile.life_stage && record.setupCompletedAt, 'ONBOARDING_SETUP_REQUIRED');
    const next = update(record);
    if (!next) return { profile, changed: false };
    await checkActor(actor, backend, port);
    const answers = { ...object(profile.onboarding_answers), journey: { ...next, revision: crypto.randomUUID() } };
    const result = await port.client.from('profiles').update({ onboarding_answers: answers } as any).eq('user_id', actor)
      .eq('onboarding_answers->journey->>revision', record.revision).select().maybeSingle();
    assert(!result.error, 'ONBOARDING_PROGRESS_SAVE_FAILED');
    await checkActor(actor, backend, port);
    if (result.data) {
      const saved = result.data as SavedProfile;
      assert(journeyRecord(saved.onboarding_answers)?.revision === answers.journey.revision, 'ONBOARDING_PROGRESS_SAVE_UNCONFIRMED');
      return { profile: saved, changed: true };
    }
  }
  throw new Error('ONBOARDING_PROGRESS_CHANGED');
}

/** Compare-and-set on the existing profile row: concurrent tabs cannot both
 * present the last-chance offer. This controls presentation, never entitlement. */
export async function claimOnboardingOffer(actor: string, backend: string, port: Port = defaultPort) {
  return changeJourney(actor, backend, record => record.completedAt || record.offerSeenAt ? null
    : { ...record, offerSeenAt: new Date().toISOString(), offerKind: 'monthly-coffee' }, port);
}
export async function completeOnboarding(actor: string, backend: string, outcome: OnboardingOutcome, port: Port = defaultPort, selectedPlan?: 'yearly' | 'monthly') {
  return changeJourney(actor, backend, record => record.completedAt ? null
    : { ...record, completedAt: new Date().toISOString(), outcome, plan: selectedPlan || record.plan }, port);
}

/** Resume only the old, locally pending funnel; ordinary established accounts
 * are not enrolled. No medical/profile fields are rewritten during adoption. */
export async function adoptLegacyOnboarding(actor: string, backend: string, port: Port = defaultPort): Promise<SavedProfile> {
  const profile = await readProfile(actor, backend, port);
  if (journeyRecord(profile.onboarding_answers)) return profile;
  assert(['bump','mommy','flow'].includes(profile.life_stage || ''), 'ONBOARDING_SETUP_REQUIRED');
  const journey: OnboardingJourneyRecord = { version: 3, id: crypto.randomUUID(), revision: crypto.randomUUID(), setupCompletedAt: new Date().toISOString(),
    completedAt: null, offerSeenAt: null, outcome: null, plan: 'yearly' };
  const result = await port.client.from('profiles').update({ onboarding_answers: { ...object(profile.onboarding_answers), journey } } as any)
    .eq('user_id', actor).is('onboarding_answers->journey', null).select().maybeSingle();
  assert(!result.error, 'ONBOARDING_PROGRESS_SAVE_FAILED');
  return readProfile(actor, backend, port);
}
