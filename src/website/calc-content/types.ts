/** Texts of the free calculator pages. They are bundled TypeScript (one module per website
 * language), never `src/website/copy/*.json` keys: the live SSR runtime reads copy JSON from
 * disk and a missing copy key would take every page down. */
export interface CalcFaq { q: string; a: string }
export interface CalcPageText {
  /** Short name: hub card, related links, breadcrumb and schema name. */
  name: string;
  /** Meta title without the brand (the page title is `title | Anacan`, 60 characters at most). */
  title: string;
  /** Meta description, 120 to 158 characters. */
  description: string;
  h1: string;
  /** Two or three sentences answering the search intent directly. */
  intro: string;
  /** One sentence for the calculators hub card. */
  card: string;
  facts: Array<[string, string]>;
  method: string[];
  formula: string;
  doctor: string[];
  faq: CalcFaq[];
  /** "Open in the app" card: title, text and three features of the matching app tool. */
  appTitle: string;
  app: string;
  appFeatures: [string, string, string];
}
export interface CalcUi {
  freeTool: string; disclaimer: string; keyFacts: string; howCalculated: string; whenDoctor: string; faq: string;
  sources: string; related: string; result: string; reset: string; calculate: string;
  exportCalendar: string; privacy: string; calculators: string; days: string; kg: string; cm: string;
  /** Labels of the shared "open in app" card (src/website/tools/AppOpen.tsx). */
  appOpen: { eyebrow: string; open: string; fallback: string };
  errors: Record<'dateError' | 'cycleError' | 'dueDateError' | 'measureError' | 'weekError' | 'ageError', string>;
}
export interface CalcContent {
  ui: CalcUi;
  pregnancyWeight: CalcPageText & { labels: {
    preWeight: string; height: string; currentWeight: string; week: string; pregnancyType: string; singleton: string; twins: string;
    bmi: string; totalGain: string; weekRange: string; weeklyRate: string; yourGain: string;
    below: string; within: string; above: string; twinsNote: string; noTwinRange: string; perWeek: string;
    categories: Record<'underweight' | 'normal' | 'overweight' | 'obese', string>;
  } };
  conception: CalcPageText & { labels: {
    method: string; fromLmp: string; fromDue: string; lmp: string; dueDate: string; cycleLength: string;
    conception: string; likelyWindow: string; fertileWindow: string; estimatedDue: string; estimatedLmp: string;
  } };
  periodCalendar: CalcPageText & { labels: {
    lmp: string; cycleLength: string; periodLength: string; nextPeriods: string; period: string;
    fertile: string; ovulation: string; cycleNumber: string;
  } };
  babyGrowth: CalcPageText & { labels: {
    sex: string; boy: string; girl: string; birthDate: string; measureDate: string; indicator: string;
    weight: string; length: string; head: string; value: string; age: string; ageValue: string;
    percentile: string; zscore: string; median: string; chart: string; months: string;
    bandLow: string; bandTypical: string; bandHigh: string; heightNote: string;
  } };
}
