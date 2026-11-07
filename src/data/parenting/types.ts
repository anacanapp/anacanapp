/**
 * Tərbiyə (positive parenting) — content model. Content lives per language in src/data/parenting/<lang>/
 * (Azerbaijani only for now); UI chrome strings live in src/lib/parenting-copy.ts and the locale bundles.
 * Emergency numbers are never written into content: texts use {emergency}, filled from the country helper.
 */

export type AgeBandId = '0-1' | '1-3' | '3-6' | '6-12';
export const AGE_BANDS: AgeBandId[] = ['0-1', '1-3', '3-6', '6-12'];

/** A real, verifiable reference: author or organisation, year when known, and the title. */
export interface Source {
  who: string;
  year?: string;
  title: string;
}

export interface BandOverview {
  id: AgeBandId;
  emoji: string;
  title: string;
  lead: string;
  /** "Beyində nə baş verir" — paragraphs. */
  brain: string[];
  /** What the child needs from the parent. */
  needs: string[];
  /** Behaviour that is developmentally normal at this age. */
  normal: string[];
  /** Small practical ideas for this age. */
  tryThis: string[];
  /** When to talk to a pediatrician / specialist. Always free. */
  specialist: string[];
  sources: Source[];
}

export type AreaId =
  | 'emotions' | 'limits' | 'connection' | 'routines' | 'growth' | 'play' | 'behaviour' | 'parent' | 'school';

export interface Area {
  id: AreaId;
  emoji: string;
  title: string;
}

export interface Article {
  id: string;
  area: AreaId;
  emoji: string;
  title: string;
  /** One or two sentences shown in lists and at the top of the article. */
  summary: string;
  bands: AgeBandId[];
  /** Free articles are shown in full; Premium ones show the summary, science and specialist signals. */
  free: boolean;
  /** Short science explainer — paragraphs. */
  science: string[];
  /** "Bu gün sına" — concrete steps. */
  tryToday: string[];
  /** Common mistakes, with what to do instead. */
  mistakes: string[];
  /** Age-specific notes. */
  byAge?: Partial<Record<AgeBandId, string>>;
  /** When to see a specialist. Always free (safety). May contain {emergency}. */
  specialist: string[];
  sources: Source[];
}

export interface SosStep {
  title: string;
  text: string;
}

export interface SosCard {
  id: string;
  emoji: string;
  title: string;
  /** The moment, in one line. */
  moment: string;
  bands: AgeBandId[];
  free: boolean;
  /** Exactly three steps: what to do / say. */
  steps: [SosStep, SosStep, SosStep];
  /** Example phrases. */
  say: string[];
  /** What not to do. */
  avoid: string[];
  byAge?: Partial<Record<AgeBandId, string>>;
  /** When this is more than an ordinary hard moment. Always free. May contain {emergency}. */
  redFlag?: string;
}

export interface ProgrammeDay {
  title: string;
  task: string;
  why: string;
}

export interface Programme {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  bands: AgeBandId[];
  intro: string[];
  days: ProgrammeDay[];
  sources: Source[];
}

export type StyleDimension = 'warmth' | 'structure' | 'harsh' | 'giveIn';
export type StyleResultId = 'balanced' | 'gentle' | 'storm' | 'strict' | 'stretched';

export interface StyleQuiz {
  id: 'style';
  emoji: string;
  title: string;
  intro: string;
  /** Answer scale shared by all statements (0 … 3). */
  scale: [string, string, string, string];
  items: { text: string; dim: StyleDimension }[];
  results: Record<StyleResultId, { title: string; short: string; detail: string[]; next: string[] }>;
  note: string;
  sources: Source[];
}

export type MilestoneAnswer = 'yes' | 'no' | 'unsure';
export type MilestoneResultId = 'ontrack' | 'watch' | 'talk';

export interface MilestoneCheckpoint {
  id: string;
  /** Applies from this age in months. */
  fromMonths: number;
  title: string;
  items: { text: string; /** "Hələ yox" on this item is a red flag. */ flag?: boolean; /** Premium: how to support this skill. */ support: string }[];
}

export interface MilestoneQuiz {
  id: 'milestones';
  emoji: string;
  title: string;
  intro: string;
  answers: Record<MilestoneAnswer, string>;
  /** Asked at every checkpoint: "Yes" here is a red flag (loss of skills). */
  regression: string;
  checkpoints: MilestoneCheckpoint[];
  results: Record<MilestoneResultId, { title: string; short: string; detail: string[] }>;
  note: string;
  sources: Source[];
}

export interface Tip {
  title: string;
  text: string;
}

export interface ParentingContent {
  bands: BandOverview[];
  areas: Area[];
  articles: Article[];
  sos: SosCard[];
  programmes: Programme[];
  styleQuiz: StyleQuiz;
  milestoneQuiz: MilestoneQuiz;
  tips: Record<AgeBandId, Tip[]>;
}
