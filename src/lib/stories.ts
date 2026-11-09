/**
 * Dashboard stories (Instagram-style, 2026-11-09). Data: src/data/stories/az.ts (StoryJson). UI: src/components/stories.
 * Switch: app_settings.dashboard_stories = 'off' | 'admin' | 'on' (Admin → Tənzimləmələr). Azerbaijani only for now.
 * Personal values (pregnancy week, baby age, cycle day, names) are filled on the device; nothing is sent anywhere.
 */
export type StoryStage = 'bump' | 'mommy' | 'flow';
export type StoryModule = StoryStage | 'all';
export type StoryNav = { tool?: string; tab?: string; screen?: string };
export type StoryTemplate = 'cover' | 'fact' | 'list' | 'myth' | 'quiz' | 'alert' | 'quote' | 'cta';

export interface StorySlide {
  t: StoryTemplate;
  kicker?: string;
  title?: string;
  body?: string;
  size?: 'm' | 'l' | 'xl';
  illus?: string;
  value?: string;
  unit?: string;
  items?: string[];
  myth?: string;
  fact?: string;
  options?: string[];
  correct?: number;
  explain?: string;
  quote?: string;
  badge?: string;
  src?: string;
  cta?: { label: string; nav: StoryNav; premium?: boolean };
}

export interface Story {
  id: string;
  module: StoryModule;
  title: string;
  theme: StoryThemeName;
  illus: string;
  audience?: { stage?: StoryStage | StoryStage[]; weekFrom?: number; weekTo?: number; monthsFrom?: number; monthsTo?: number; goal?: string; premium?: boolean };
  schedule?: { refresh?: string; day?: string; phase?: string; data?: string; season?: string };
  source?: string;
  slides: StorySlide[];
}

export type WeekRow = [number, string, number, number, string];
export type MonthRow = [number, string, string];
export type PhaseRow = [number, number, string, string];

export interface StoryTheme { bg: string; ink: string; pop: string; popInk: string; chip: string; ink2: string; bg2: string; light?: boolean }
export type StoryThemeName = 'coral' | 'lime' | 'violet' | 'peach' | 'cream' | 'navy' | 'lilac' | 'yellow' | 'mint' | 'forest';
export const STORY_THEMES: Record<StoryThemeName, StoryTheme> = {
  coral: { bg: '#FF5A5F', ink: '#FFFFFF', pop: '#FFE66B', popInk: '#3B1A10', chip: 'rgba(255,255,255,.16)', ink2: '#FFFFFF', bg2: '#FF5A5F' },
  lime: { bg: '#1F9D55', ink: '#FFFFFF', pop: '#C8F560', popInk: '#123526', chip: 'rgba(255,255,255,.14)', ink2: '#C8F560', bg2: '#123526' },
  violet: { bg: '#5B4BDB', ink: '#FFFFFF', pop: '#FFD84D', popInk: '#2A2060', chip: 'rgba(255,255,255,.14)', ink2: '#FFFFFF', bg2: '#5B4BDB' },
  peach: { bg: '#FFB199', ink: '#2B1B17', pop: '#FF5A5F', popInk: '#FFFFFF', chip: 'rgba(43,27,23,.08)', ink2: '#2B1B17', bg2: '#FFB199', light: true },
  cream: { bg: '#FFF6EC', ink: '#22181A', pop: '#FF5A5F', popInk: '#FFFFFF', chip: 'rgba(34,24,26,.06)', ink2: '#22181A', bg2: '#FFF6EC', light: true },
  navy: { bg: '#2E2A7A', ink: '#FFFFFF', pop: '#7FE0FF', popInk: '#16133F', chip: 'rgba(255,255,255,.12)', ink2: '#7FE0FF', bg2: '#16133F' },
  lilac: { bg: '#CDB8FF', ink: '#1E1838', pop: '#FF6B3D', popInk: '#FFFFFF', chip: 'rgba(30,24,56,.08)', ink2: '#1E1838', bg2: '#CDB8FF', light: true },
  yellow: { bg: '#FFD84D', ink: '#2B1B17', pop: '#5B4BDB', popInk: '#FFFFFF', chip: 'rgba(43,27,23,.08)', ink2: '#2B1B17', bg2: '#FFD84D', light: true },
  mint: { bg: '#BFF0D4', ink: '#123526', pop: '#FF5A5F', popInk: '#FFFFFF', chip: 'rgba(18,53,38,.08)', ink2: '#123526', bg2: '#BFF0D4', light: true },
  forest: { bg: '#0F4D32', ink: '#EFFFF5', pop: '#C8F560', popInk: '#0F4D32', chip: 'rgba(239,255,245,.10)', ink2: '#C8F560', bg2: '#0F4D32' },
};

export const STORY_MODULE_LABEL: Record<StoryModule, string> = { bump: 'Hamiləlik', mommy: 'Analıq', flow: 'Dövr', all: 'Hamı üçün' };

/** Azerbaijani ordinal suffix: by the last non-zero digit, or by the tens when the number ends in 0. */
export function azOrdinal(n: number): string {
  const d = n % 10;
  const t = Math.floor(n / 10) % 10;
  if (d) return ({ 1: '-ci', 2: '-ci', 5: '-ci', 7: '-ci', 8: '-ci', 3: '-cü', 4: '-cü', 6: '-cı', 9: '-cu' } as Record<number, string>)[d];
  if (n % 100 === 0) return '-cü';
  return ({ 1: '-cu', 2: '-ci', 3: '-cu', 4: '-cı', 5: '-ci', 6: '-cı', 7: '-ci', 8: '-ci', 9: '-cı' } as Record<number, string>)[t];
}

export interface StoryContext {
  stage: StoryStage;
  week?: number | null;
  babyMonths?: number | null;
  babyName?: string | null;
  cycleDay?: number | null;
  isPremium?: boolean;
}
export interface StoryTables { weeks: WeekRow[]; months: MonthRow[]; phases: PhaseRow[] }

export function storyVars(ctx: StoryContext, tables: StoryTables): Record<string, string> {
  const out: Record<string, string> = {};
  if (ctx.week) {
    const w = [...tables.weeks].reverse().find((x) => ctx.week! >= x[0]) ?? tables.weeks[0];
    Object.assign(out, { week: String(ctx.week), weekLabel: `${ctx.week}${azOrdinal(ctx.week)} həftə`, fruit: w[1], lengthCm: String(w[2]),
      weightG: w[3].toLocaleString('az-AZ'), weekNote: w[4] });
  }
  if (ctx.babyMonths != null) {
    const m = [...tables.months].reverse().find((x) => ctx.babyMonths! >= x[0]) ?? tables.months[0];
    Object.assign(out, { babyMonths: String(ctx.babyMonths), milestone: m[1], milestoneShort: m[2], babyName: ctx.babyName?.trim() || 'Körpən' });
  }
  if (ctx.cycleDay) {
    const p = tables.phases.find((x) => ctx.cycleDay! >= x[0] && ctx.cycleDay! <= x[1]) ?? tables.phases[tables.phases.length - 1];
    Object.assign(out, { cycleDay: String(ctx.cycleDay), cycleLabel: `${ctx.cycleDay}${azOrdinal(ctx.cycleDay)} gün`, phase: p[2], phaseTip: p[3] });
  }
  return out;
}

const VAR_RE = /\{(\w+)\}/g;
export const storyVarsUsed = (story: Story): string[] => {
  const found = new Set<string>();
  const scan = (v: unknown) => {
    if (typeof v === 'string') for (const m of v.matchAll(VAR_RE)) found.add(m[1]);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === 'object') Object.values(v).forEach(scan);
  };
  scan(story.title); scan(story.slides);
  return [...found];
};
export const fillStory = (text: string | undefined, vars: Record<string, string>): string =>
  (text ?? '').replace(VAR_RE, (_, k: string) => vars[k] ?? '');

const LUTEAL = new Set(['luteal', 'lüteal faza']);
/** Which stories this user should see right now (stage, week/age window, cycle phase, Premium-only promos, and every variable available). */
export function storyMatches(story: Story, ctx: StoryContext, vars: Record<string, string>): boolean {
  const a = story.audience ?? {};
  const stages = Array.isArray(a.stage) ? a.stage : a.stage ? [a.stage] : null;
  if (story.module === 'all') { if (stages && !stages.includes(ctx.stage)) return false; }
  else if (story.module !== ctx.stage) return false;
  if (a.premium === false && ctx.isPremium) return false;
  if (a.goal) return false; // goal-specific stories (e.g. TTC) wait until the goal is known on the device
  if (ctx.stage === 'bump' && ctx.week && ((a.weekFrom && ctx.week < a.weekFrom) || (a.weekTo && ctx.week > a.weekTo))) return false;
  if (ctx.stage === 'mommy' && ctx.babyMonths != null && ((a.monthsFrom && ctx.babyMonths < a.monthsFrom) || (a.monthsTo && ctx.babyMonths > a.monthsTo))) return false;
  const phase = story.schedule?.phase;
  if (ctx.stage === 'flow' && phase && vars.phase && !(phase === vars.phase || (LUTEAL.has(phase) && LUTEAL.has(vars.phase)))) return false;
  if (ctx.stage === 'flow' && phase && !vars.phase) return false;
  return storyVarsUsed(story).every((k) => vars[k] !== undefined);
}

/** Splits ==mark==, __accent__ and **bold** markers into parts for rendering (no HTML is ever injected). */
export type StoryTextPart = { text: string; kind: 'plain' | 'mark' | 'hl' | 'bold' };
export function parseStoryText(text: string): StoryTextPart[] {
  const parts: StoryTextPart[] = [];
  const re = /==(.+?)==|__(.+?)__|\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), kind: 'plain' });
    parts.push(m[1] !== undefined ? { text: m[1], kind: 'mark' } : m[2] !== undefined ? { text: m[2], kind: 'hl' } : { text: m[3], kind: 'bold' });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), kind: 'plain' });
  return parts;
}

export type StoriesSetting = 'off' | 'admin' | 'on';
export const storiesEnabledFor = (setting: unknown, opts: { isAdmin: boolean; language: string | null | undefined; role?: string | null }): boolean => {
  if (opts.role === 'partner') return false;
  if (opts.language !== 'az') return false;
  if (setting === 'on') return true;
  return setting === 'admin' && opts.isAdmin;
};
