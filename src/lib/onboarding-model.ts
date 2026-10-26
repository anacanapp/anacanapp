import { writeStorageItem } from './local-storage';

export const ONBOARDING_SCHEMA = 'anacan-onboarding-v3' as const;
export const ONBOARDING_STAGES = ['bump', 'mommy', 'flow'] as const;
export type OnboardingStage = typeof ONBOARDING_STAGES[number];
export type OnboardingAnswer = string | string[];
export type NotificationChoice = 'granted' | 'denied' | 'skipped';
export type OnboardingOutcome = 'free' | 'purchased' | 'restored' | 'existing';
export type OnboardingStep = 'welcome' | 'stage' | 'name' | 'data' | 'support' | 'privacy' | 'value' | 'notifications'
  | 'analysis' | 'results' | 'features' | 'paywall' | 'offer' | 'free' | 'success' | OnboardingQuestion;
export type OnboardingQuestion = 'firstPregnancy' | 'bumpSymptoms' | 'bumpInterests' | 'feeding' | 'nightWakes' | 'mommyInterests'
  | 'flowGoal' | 'regularity' | 'flowSymptoms' | 'concern' | 'sleep' | 'supportLevel' | 'duration' | 'budget';
export interface OnboardingChild {
  id: string;
  name: string;
  gender: 'boy' | 'girl' | '';
  birthDate: string;
  term: 'term' | 'preterm' | '';
  gestationalWeeks: number;
}
export interface OnboardingDraft {
  schema: typeof ONBOARDING_SCHEMA;
  actor: string;
  backend: string;
  id: string;
  step: OnboardingStep;
  stage: OnboardingStage | null;
  name: string;
  dateMode: 'lmp' | 'due';
  pregnancyDate: string;
  lastPeriodDate: string;
  cycleLength: number;
  periodLength: number;
  babyCount: number;
  children: OnboardingChild[];
  deliveryType: 'natural' | 'cesarean' | 'assisted' | '';
  answers: Record<string, OnboardingAnswer>;
  notifications: NotificationChoice;
  setupComplete: boolean;
  saveStarted: boolean;
  offerSeen: boolean;
  purchasePending: boolean;
  plan: 'yearly' | 'monthly';
  outcome: OnboardingOutcome | null;
}
export interface OnboardingJourneyRecord {
  version: 3;
  id: string;
  revision: string;
  setupCompletedAt: string;
  completedAt: string | null;
  offerSeenAt: string | null;
  offerKind?: 'monthly-coffee';
  outcome: OnboardingOutcome | null;
  plan: 'yearly' | 'monthly';
}

export const QUESTION_OPTIONS: Record<Exclude<OnboardingQuestion, 'concern'>, readonly string[]> = {
  firstPregnancy: ['first', 'second'],
  bumpSymptoms: ['nausea', 'fatigue', 'backpain', 'insomnia', 'heartburn', 'swelling', 'none'],
  bumpInterests: ['development', 'nutrition', 'exercise', 'birth_prep', 'names', 'shopping'],
  feeding: ['breast', 'formula', 'mixed', 'solid'],
  nightWakes: ['rare', 'sometimes', 'often', 'varies'],
  mommyInterests: ['sleep', 'feeding', 'milestones', 'vaccines', 'teething', 'games'],
  flowGoal: ['track', 'conceive', 'health', 'symptoms'],
  regularity: ['regular', 'irregular', 'unsure'],
  flowSymptoms: ['cramps', 'mood', 'bloating', 'headache', 'acne', 'none'],
  sleep: ['rested', 'interrupted', 'poor'],
  supportLevel: ['supported', 'some', 'little'],
  duration: ['months', 'year', 'unsure'],
  budget: ['value', 'flexible', 'undecided'],
};
export const CONCERNS: Record<OnboardingStage, readonly string[]> = {
  bump: ['birth', 'baby_health', 'body', 'finances'],
  mommy: ['rest', 'loneliness', 'feeding', 'own_time'],
  flow: ['irregular', 'pain', 'pms', 'fertility'],
};
export const MULTI_QUESTIONS = new Set<OnboardingQuestion>(['bumpSymptoms', 'bumpInterests', 'mommyInterests', 'flowSymptoms']);
export const BRANCH_QUESTIONS: Record<OnboardingStage, OnboardingQuestion[]> = {
  bump: ['firstPregnancy', 'bumpSymptoms', 'bumpInterests'],
  mommy: ['feeding', 'nightWakes', 'mommyInterests'],
  flow: ['flowGoal', 'regularity', 'flowSymptoms'],
};
export const isOnboardingStage = (stage: unknown): stage is OnboardingStage => ONBOARDING_STAGES.includes(stage as OnboardingStage);
export const isQuestion = (step: string): step is OnboardingQuestion => step === 'concern' || Object.prototype.hasOwnProperty.call(QUESTION_OPTIONS, step);
export function onboardingQuestionOptions(draft: OnboardingDraft, question: OnboardingQuestion): readonly string[] {
  if (question !== 'concern') return QUESTION_OPTIONS[question];
  return draft.stage ? CONCERNS[draft.stage].filter(option => !(draft.stage === 'flow' && draft.answers.regularity === 'regular' && option === 'irregular')) : [];
}
export function onboardingSteps(stage: OnboardingStage | null, native: boolean): OnboardingStep[] {
  const base: OnboardingStep[] = ['welcome', 'stage', 'name', 'data'];
  if (!stage) return base;
  const branch = BRANCH_QUESTIONS[stage];
  return [...base, branch[0], 'support', branch[1], branch[2], 'privacy', 'concern', 'sleep', 'supportLevel', 'duration', 'budget',
    'value', ...(native ? ['notifications' as const] : []), 'analysis', 'results', 'features', 'paywall'];
}
export function newOnboardingChild(): OnboardingChild {
  return { id: crypto.randomUUID(), name: '', gender: '', birthDate: '', term: '', gestationalWeeks: 34 };
}
export function newOnboardingDraft(actor: string, backend: string, name = ''): OnboardingDraft {
  return { schema: ONBOARDING_SCHEMA, actor, backend, id: crypto.randomUUID(), step: 'welcome', stage: null,
    name: name === 'İstifadəçi' ? '' : name, dateMode: 'lmp', pregnancyDate: '', lastPeriodDate: '', cycleLength: 28, periodLength: 5,
    babyCount: 1, children: [newOnboardingChild()], deliveryType: '', answers: {}, notifications: 'skipped',
    setupComplete: false, saveStarted: false, offerSeen: false, purchasePending: false, plan: 'yearly', outcome: null };
}
export function selectOnboardingStage(draft: OnboardingDraft, stage: OnboardingStage): OnboardingDraft {
  if (draft.stage === stage) return { ...draft, step: 'name' };
  // Health answers and dates never leak between branches. Personal name remains.
  return { ...newOnboardingDraft(draft.actor, draft.backend, draft.name), id: draft.id, stage, step: 'name' };
}
export function toggleOnboardingAnswer(current: OnboardingAnswer | undefined, value: string): string[] {
  const selected = Array.isArray(current) ? current : [];
  if (value === 'none') return selected.includes('none') ? [] : ['none'];
  return selected.includes(value) ? selected.filter(item => item !== value) : [...selected.filter(item => item !== 'none'), value];
}
export function recommendedOnboardingPlan(answers: OnboardingDraft['answers']): 'yearly' | 'monthly' {
  return answers.budget === 'flexible' || answers.duration === 'months' && answers.budget !== 'value' ? 'monthly' : 'yearly';
}

const DAY = 86400000;
export function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? Math.floor(time / DAY) : null;
}
export function todayCalendarDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function addCalendarDays(date: string, days: number): string {
  const day = calendarDay(date);
  if (day === null || !Number.isInteger(days)) throw new Error('ONBOARDING_INVALID_DATE');
  return new Date((day + days) * DAY).toISOString().slice(0, 10);
}
export function pregnancyDates(draft: Pick<OnboardingDraft, 'pregnancyDate' | 'dateMode'>) {
  const lastPeriod = draft.dateMode === 'due' ? addCalendarDays(draft.pregnancyDate, -280) : draft.pregnancyDate;
  return { lastPeriod, due: addCalendarDays(lastPeriod, 280) };
}
export const childDueDate = (child: OnboardingChild) => child.term === 'preterm'
  ? addCalendarDays(child.birthDate, 280 - child.gestationalWeeks * 7) : child.term === 'term' ? child.birthDate : null;
export const multiplesType = (count: number) => (['single', 'twins', 'triplets', 'quadruplets'] as const)[count - 1];
export function onboardingDataError(draft: OnboardingDraft, today = todayCalendarDate()): string | null {
  const now = calendarDay(today)!;
  if (!isOnboardingStage(draft.stage)) return 'choose_stage';
  if (!draft.name.trim() || draft.name.trim().length > 80) return 'name_required';
  if (draft.stage === 'bump') {
    const date = calendarDay(draft.pregnancyDate);
    if (date === null) return 'date_required';
    const lmp = draft.dateMode === 'due' ? date - 280 : date;
    if (lmp > now || now - lmp > 308) return 'pregnancy_date_invalid';
    if (!Number.isInteger(draft.babyCount) || draft.babyCount < 1 || draft.babyCount > 4) return 'baby_count_invalid';
  } else if (draft.stage === 'mommy') {
    if (!Number.isInteger(draft.babyCount) || draft.babyCount < 1 || draft.babyCount > 4 || draft.children.length !== draft.babyCount) return 'baby_count_invalid';
    const identities = new Set<string>();
    for (const child of draft.children) {
      if (!child.name.trim() || child.name.trim().length > 80) return 'child_name_required';
      if (!['boy', 'girl'].includes(child.gender)) return 'child_gender_required';
      const birth = calendarDay(child.birthDate);
      if (birth === null || birth > now || now - birth > 36525) return 'birth_date_invalid';
      if (child.term === 'preterm' && (!Number.isInteger(child.gestationalWeeks) || child.gestationalWeeks < 22 || child.gestationalWeeks > 36)) return 'gestation_invalid';
      const key = `${child.name.trim().toLowerCase()}|${child.birthDate}`;
      if (identities.has(key)) return 'duplicate_child';
      identities.add(key);
    }
  } else {
    const date = calendarDay(draft.lastPeriodDate);
    if (date === null || date > now || now - date > 36525) return 'period_date_invalid';
    if (!Number.isInteger(draft.cycleLength) || draft.cycleLength < 10 || draft.cycleLength > 50
      || !Number.isInteger(draft.periodLength) || draft.periodLength < 2 || draft.periodLength > 10 || draft.periodLength > draft.cycleLength) return 'cycle_length_invalid';
  }
  return null;
}
export function validatedOnboardingAnswers(draft: OnboardingDraft) {
  if (!draft.stage) throw new Error('ONBOARDING_STAGE_REQUIRED');
  const allowed: OnboardingQuestion[] = [...BRANCH_QUESTIONS[draft.stage], 'concern', 'sleep', 'supportLevel', 'duration', 'budget'];
  const answers: Record<string, OnboardingAnswer | null> = {};
  for (const question of allowed) {
    const options = onboardingQuestionOptions(draft, question);
    const value = draft.answers[question];
    if (MULTI_QUESTIONS.has(question)) {
      const values = Array.isArray(value) ? [...new Set(value.filter(item => options.includes(item)))] : [];
      answers[question] = values.includes('none') ? ['none'] : values;
    } else answers[question] = typeof value === 'string' && options.includes(value) ? value : null;
  }
  if (draft.stage !== 'flow') answers.multiples = multiplesType(draft.babyCount);
  return answers;
}
export function journeyRecord(answers: unknown): OnboardingJourneyRecord | null {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const journey = (answers as Record<string, unknown>).journey as OnboardingJourneyRecord | undefined;
  return journey?.version === 3 && typeof journey.id === 'string' && typeof journey.revision === 'string' ? journey : null;
}
export const onboardingDraftKey = (actor: string, backend: string) => `${ONBOARDING_SCHEMA}:${new URL(backend).host}:${actor}`;
export function readOnboardingDraft(actor: string, backend: string, storage: Storage = localStorage): OnboardingDraft | null {
  try {
    const raw = storage.getItem(onboardingDraftKey(actor, backend));
    if (!raw || raw.length > 32768) return null;
    const value = JSON.parse(raw) as OnboardingDraft;
    const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
    if (value?.schema !== ONBOARDING_SCHEMA || value.actor !== actor || value.backend !== backend || !uuid.test(value.id)
      || !(value.stage === null || isOnboardingStage(value.stage)) || typeof value.name !== 'string'
      || !Array.isArray(value.children) || value.children.length > 4 || !value.children.every(child => child && uuid.test(child.id)
        && typeof child.name === 'string' && typeof child.birthDate === 'string' && ['', 'boy', 'girl'].includes(child.gender)
        && ['', 'term', 'preterm'].includes(child.term) && Number.isInteger(child.gestationalWeeks))
      || !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)
      || !['lmp', 'due'].includes(value.dateMode) || typeof value.pregnancyDate !== 'string' || typeof value.lastPeriodDate !== 'string'
      || !Number.isInteger(value.cycleLength) || !Number.isInteger(value.periodLength) || !Number.isInteger(value.babyCount)
      || !['granted', 'denied', 'skipped'].includes(value.notifications) || !['yearly', 'monthly'].includes(value.plan)
      || !['', 'natural', 'cesarean', 'assisted'].includes(value.deliveryType)
      || !['setupComplete', 'saveStarted', 'offerSeen', 'purchasePending'].every(key => typeof value[key as keyof OnboardingDraft] === 'boolean')
      || ![...onboardingSteps(value.stage, true), 'offer', 'free', 'success'].includes(value.step)) return null;
    return value;
  } catch { return null; }
}
export function writeOnboardingDraft(draft: OnboardingDraft, storage: Storage = localStorage): void {
  writeStorageItem(storage, onboardingDraftKey(draft.actor, draft.backend), JSON.stringify(draft));
}
export function hasPendingOnboarding(actor: string, backend: string, answers: unknown): boolean {
  const journey = journeyRecord(answers);
  if (journey?.completedAt) return false;
  return !!journey || !!readOnboardingDraft(actor, backend);
}
