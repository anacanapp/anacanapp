/**
 * Server stories (2026-11-12): admins add, replace or hide dashboard stories without an app update.
 * Rows come from get_app_stories_v1 (table public.app_stories, Admin → Story-lər). Every row is validated again
 * here, because the app renders it: unknown templates, themes and fields are dropped, text is length-capped and
 * the renderer never injects HTML (parseStoryText). The last good list is cached on the device so stories keep
 * working offline and while the request is in flight.
 */
import { STORY_THEMES, type Story, type StoryModule, type StorySlide, type StoryStage, type StoryTemplate } from './stories';

export interface ServerStoryRow { id: string; action: 'show' | 'hide'; story: unknown; sort?: number; updated_at?: string }
export interface ServerStories { show: Story[]; hide: Set<string> }

const TEMPLATES: readonly StoryTemplate[] = ['cover', 'fact', 'list', 'myth', 'quiz', 'alert', 'quote', 'cta'];
const MODULES: readonly StoryModule[] = ['bump', 'mommy', 'flow', 'all'];
const STAGES: readonly StoryStage[] = ['bump', 'mommy', 'flow'];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const NAV_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const MAX_SLIDES = 20;

const str = (v: unknown, max = 600): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strList = (v: unknown, maxItems: number, max = 200): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => str(x, max)).filter((x): x is string => !!x).slice(0, maxItems);
  return out.length ? out : undefined;
};
const prune = <T extends object>(o: T): T => {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
};

/** One slide, or null when it cannot be shown (unknown template, nothing to say, broken quiz). */
export function sanitizeSlide(raw: unknown): StorySlide | null {
  if (!isObj(raw) || !TEMPLATES.includes(raw.t as StoryTemplate)) return null;
  const t = raw.t as StoryTemplate;
  const slide: StorySlide = prune({
    t,
    kicker: str(raw.kicker, 80),
    title: str(raw.title, 220),
    body: str(raw.body, 700),
    size: raw.size === 'm' || raw.size === 'l' || raw.size === 'xl' ? raw.size : undefined,
    illus: str(raw.illus, 24),
    mascot: STAGES.includes(raw.mascot as StoryStage) ? (raw.mascot as StoryStage) : undefined,
    value: str(raw.value, 24),
    unit: str(raw.unit, 24),
    items: strList(raw.items, 8),
    myth: str(raw.myth, 300),
    fact: str(raw.fact, 500),
    options: strList(raw.options, 4, 120),
    correct: num(raw.correct, 0, 3),
    explain: str(raw.explain, 500),
    quote: str(raw.quote, 400),
    badge: str(raw.badge, 40),
    src: str(raw.src, 160),
  });
  if (isObj(raw.cta) && isObj(raw.cta.nav)) {
    const n = raw.cta.nav;
    const nav = prune({
      tool: typeof n.tool === 'string' && NAV_RE.test(n.tool) ? n.tool : undefined,
      tab: typeof n.tab === 'string' && NAV_RE.test(n.tab) ? n.tab : undefined,
      screen: typeof n.screen === 'string' && NAV_RE.test(n.screen) ? n.screen : undefined,
    });
    const label = str(raw.cta.label, 40);
    if (label && (nav.tool || nav.tab || nav.screen)) slide.cta = prune({ label, nav, premium: raw.cta.premium === true ? true : undefined });
  }
  if (t === 'quiz' && (!slide.options || slide.options.length < 2 || slide.correct === undefined || slide.correct >= slide.options.length)) return null;
  if (t === 'cta' && !slide.cta) return null;
  if (t === 'list' && !slide.items) return null;
  if (t === 'myth' && !(slide.myth && slide.fact)) return null;
  if (t === 'quote' && !slide.quote) return null;
  if (!slide.title && !slide.body && !slide.items && !slide.value && !slide.quote && !slide.myth && !slide.options) return null;
  return slide;
}

/** A whole story from the server, or null. The id comes from the row so it always matches the statistics. */
export function sanitizeStory(id: string, raw: unknown): Story | null {
  if (!ID_RE.test(id) || !isObj(raw)) return null;
  const module = MODULES.includes(raw.module as StoryModule) ? (raw.module as StoryModule) : null;
  const title = str(raw.title, 40);
  const slides = Array.isArray(raw.slides) ? raw.slides.slice(0, MAX_SLIDES).map(sanitizeSlide).filter((s): s is StorySlide => !!s) : [];
  if (!module || !title || slides.length === 0) return null;
  const story: Story = {
    id, module, title, slides,
    theme: (typeof raw.theme === 'string' && raw.theme in STORY_THEMES ? raw.theme : 'coral') as Story['theme'],
    illus: str(raw.illus, 24) ?? 'blob',
  };
  const src = str(raw.source, 160);
  if (src) story.source = src;
  if (isObj(raw.audience)) {
    const a = raw.audience;
    const stage = Array.isArray(a.stage) ? a.stage.filter((s): s is StoryStage => STAGES.includes(s as StoryStage))
      : STAGES.includes(a.stage as StoryStage) ? (a.stage as StoryStage) : undefined;
    const audience = prune({
      stage: Array.isArray(stage) && stage.length === 0 ? undefined : stage,
      weekFrom: num(a.weekFrom, 1, 42), weekTo: num(a.weekTo, 1, 42),
      monthsFrom: num(a.monthsFrom, 0, 120), monthsTo: num(a.monthsTo, 0, 120),
      premium: a.premium === false ? false : undefined,
      goal: str(a.goal, 24),
    });
    if (Object.keys(audience).length) story.audience = audience;
  }
  if (isObj(raw.schedule) && typeof raw.schedule.phase === 'string') story.schedule = { phase: raw.schedule.phase.slice(0, 40) };
  return story;
}

/** Validates the RPC result; bad rows are skipped, never fatal. */
export function parseServerStories(rows: unknown): ServerStories {
  const show: { story: Story; sort: number }[] = [];
  const hide = new Set<string>();
  if (!Array.isArray(rows)) return { show: [], hide };
  for (const r of rows.slice(0, 200)) {
    if (!isObj(r) || typeof r.id !== 'string' || !ID_RE.test(r.id)) continue;
    if (r.action === 'hide') { hide.add(r.id); continue; }
    const story = sanitizeStory(r.id, r.story);
    if (story && !show.some((x) => x.story.id === story.id)) show.push({ story, sort: typeof r.sort === 'number' ? r.sort : 0 });
  }
  show.sort((a, b) => b.sort - a.sort);
  return { show: show.map((x) => x.story), hide };
}

/**
 * Bundled + server: a server story with a bundled id replaces it in place, hidden ids disappear, and new server
 * stories come first (newest content leads the row).
 */
export function mergeStories(bundled: Story[], server: ServerStories | null | undefined): Story[] {
  if (!server) return bundled;
  const byId = new Map(server.show.map((s) => [s.id, s]));
  const merged = bundled.filter((s) => !server.hide.has(s.id)).map((s) => byId.get(s.id) ?? s);
  const bundledIds = new Set(bundled.map((s) => s.id));
  const fresh = server.show.filter((s) => !bundledIds.has(s.id) && !server.hide.has(s.id));
  return [...fresh, ...merged];
}

const CACHE_KEY = (language: string) => `anacan-server-stories:v1:${language}`;
export function readStoriesCache(language: string): unknown[] | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY(language)) || 'null');
    return Array.isArray(v) ? v : undefined;
  } catch { return undefined; }
}
export function writeStoriesCache(language: string, rows: unknown[]): void {
  try { localStorage.setItem(CACHE_KEY(language), JSON.stringify(rows)); } catch { /* storage unavailable */ }
}
