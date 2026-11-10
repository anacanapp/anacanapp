/**
 * "Hamiləlik həftəbəhəftə" (pregnancy week by week), Azerbaijani only:
 *   hub   /az/hamilelik/heftelik/
 *   week  /az/hamilelik/<n>-<ci|cu>-hefte/   (n = 1..42)
 *
 * The URL segment is the Azerbaijani ordinal folded to ASCII like every other site slug
 * (ə→e, ı→i, ü→u: "3-cü həftə" → 3-cu-hefte, "6-cı" → 6-ci-hefte, "40-cı" → 40-ci-hefte); the visible
 * text keeps the real suffix (azOrdinal). This module is small and ships in the main site bundle
 * (routing, metadata, sizes, sources). The 42 week texts live in az.ts and are loaded like the other
 * tool data (registry.ts: SSR registers at import, the browser loads the chunk before hydration).
 * No website copy keys are used (see docs/WEBSITE_GOOGLE_20261006.md).
 *
 * Week convention (same as the app's getPregnancyWeek and the website due date calculator):
 * "N-ci həftə" = N completed weeks since the first day of the last menstrual period, i.e. N weeks
 * 0 days to N weeks 6 days. Trimesters follow the app's getTrimester (src/lib/pregnancy-utils.ts).
 */
import { azOrdinal } from '../tools/names';

/**
 * Publication switch (owner decision). While false the pages render at their live URLs so the owner
 * can read them, but carry robots noindex,nofollow (meta tag and X-Robots-Tag), are left out of every
 * sitemap and llms file, and no other page links to them. When true they are indexable, listed in
 * sitemap-pages.xml/sitemap-az.xml and linked from the pregnancy detail page and the calculators page.
 */
/** Owner decision 2026-11-10: week-by-week content stays in the Anacan app only; the website pages are switched off
 * (every /az/hamilelik/<…>/ week URL answers 404). Set to true to bring the hidden pages back. */
export const PREGNANCY_WEEKS_ENABLED = false;
let enabled: boolean = PREGNANCY_WEEKS_ENABLED;
export const pregnancyWeeksEnabled = () => enabled;
/** Tests only. */
export function overridePregnancyWeeksEnabled(value?: boolean) { enabled = value ?? PREGNANCY_WEEKS_ENABLED; }
export const PREGNANCY_WEEKS_PUBLISHED = false;
let published: boolean = PREGNANCY_WEEKS_PUBLISHED;
/** Every gate (robots, sitemaps, inbound links) reads the flag through this function. */
export const pregnancyWeeksPublished = () => published && enabled;
/** Tests only: render both states without editing the constant. No argument restores the constant. */
export function overridePregnancyWeeksPublished(value?: boolean) { published = value ?? PREGNANCY_WEEKS_PUBLISHED; }
/** Sitemap lastmod once published (update when the texts change). */
export const PREGNANCY_WEEKS_UPDATED = '2026-11-10';
export const PREGNANCY_WEEKS_ROBOTS = 'noindex,nofollow';

export const PREGNANCY_WEEK_LAST = 42;
export const PREGNANCY_WEEK_NUMBERS = Array.from({ length: PREGNANCY_WEEK_LAST }, (_, index) => index + 1);
/** Parent segment = the Azerbaijani pregnancy detail page slug (detail-routes.json). */
export const PREGNANCY_WEEKS_PARENT = 'hamilelik';
export const PREGNANCY_WEEKS_HUB_SLUG = 'heftelik';

export { azOrdinal };
export const isPregnancyWeek = (value: number) => Number.isInteger(value) && value >= 1 && value <= PREGNANCY_WEEK_LAST;
const asciiFold = (value: string) => value.replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ə/g, 'e');
/** Published URL segment of a week page: 1-ci-hefte, 3-cu-hefte, 6-ci-hefte, 9-cu-hefte, 40-ci-hefte. */
export function pregnancyWeekSlug(week: number): string {
  if (!isPregnancyWeek(week)) throw new Error('PREGNANCY_WEEK_OUT_OF_RANGE');
  return `${asciiFold(azOrdinal(week))}-hefte`;
}
const SLUG_TO_WEEK = new Map(PREGNANCY_WEEK_NUMBERS.map(week => [pregnancyWeekSlug(week), week]));
export const pregnancyWeekFromSlug = (slug: string | undefined) => (slug ? SLUG_TO_WEEK.get(slug) : undefined);
export const pregnancyWeeksHubPath = () => `/az/${PREGNANCY_WEEKS_PARENT}/${PREGNANCY_WEEKS_HUB_SLUG}/`;
export const pregnancyWeekPath = (week: number) => `/az/${PREGNANCY_WEEKS_PARENT}/${pregnancyWeekSlug(week)}/`;

/** Same boundaries as the app's getTrimester: weeks 1-12, 13-26, 27-42. */
export const pregnancyTrimester = (week: number): 1 | 2 | 3 => (week < 13 ? 1 : week < 27 ? 2 : 3);

/**
 * Copy of the app's FRUIT_SIZES (src/types/anacan.ts; that module pulls in the consumer i18n runtime,
 * which stays out of the website). pregnancy-weeks.test.ts asserts both stay identical.
 */
export const APP_FRUIT_SIZES: Record<number, { fruit: string; lengthCm: number; weightG: number }> = {
  4: { fruit: 'Xaşxaş toxumu', lengthCm: 0.1, weightG: 0.04 },
  5: { fruit: 'Susam', lengthCm: 0.2, weightG: 0.1 },
  6: { fruit: 'Mərci', lengthCm: 0.4, weightG: 0.2 },
  7: { fruit: 'Moruq', lengthCm: 1.0, weightG: 1 },
  8: { fruit: 'Noxud', lengthCm: 1.6, weightG: 2 },
  9: { fruit: 'Gilas', lengthCm: 2.3, weightG: 4 },
  10: { fruit: 'Qoz', lengthCm: 3.1, weightG: 7 },
  11: { fruit: 'Əncir', lengthCm: 4.1, weightG: 10 },
  12: { fruit: 'Gavalı', lengthCm: 5.4, weightG: 14 },
  13: { fruit: 'Şaftalı', lengthCm: 7.4, weightG: 23 },
  14: { fruit: 'Limon', lengthCm: 8.7, weightG: 43 },
  15: { fruit: 'Alma', lengthCm: 10.1, weightG: 70 },
  16: { fruit: 'Avokado', lengthCm: 11.6, weightG: 100 },
  17: { fruit: 'Armud', lengthCm: 13, weightG: 140 },
  18: { fruit: 'Bibər', lengthCm: 14.2, weightG: 190 },
  19: { fruit: 'Pomidor', lengthCm: 15.3, weightG: 240 },
  20: { fruit: 'Banan', lengthCm: 16.4, weightG: 300 },
  24: { fruit: 'Qarğıdalı', lengthCm: 21.3, weightG: 600 },
  28: { fruit: 'Badımcan', lengthCm: 25.4, weightG: 1000 },
  32: { fruit: 'Qabaq', lengthCm: 27.4, weightG: 1700 },
  36: { fruit: 'Kahı', lengthCm: 34, weightG: 2600 },
  40: { fruit: 'Qarpız', lengthCm: 36, weightG: 3400 },
};
/** Copy of the app's median estimated fetal weight for weeks 20-40 (src/lib/fetalGrowth.ts, asserted in tests). */
export const APP_MEDIAN_WEIGHT_G: Record<number, number> = {
  20: 300, 21: 350, 22: 410, 23: 480, 24: 600, 25: 660, 26: 760, 27: 875, 28: 1000, 29: 1150, 30: 1320,
  31: 1500, 32: 1700, 33: 1920, 34: 2150, 35: 2380, 36: 2600, 37: 2850, 38: 3080, 39: 3250, 40: 3400,
};

export type PregnancyWeekSize =
  | { kind: 'none'; text: string }
  | { kind: 'table'; fruit: string; lengthCm: number; weightG: number }
  /** Between two app rows: the app keeps showing the previous row's fruit (`fruit`) until `nextWeek`. */
  | { kind: 'between'; fruit: string; next: string; nextWeek: number; lengthCm: number; weightG: number }
  | { kind: 'term'; fruit: string; lengthCm: number; weightG: number };

/**
 * Weeks in the app table use its row exactly. Weeks between two rows (21-23, 25-27, ...) keep the fruit
 * the app shows (the previous row, as userStore does), take the weight from the app's fetal growth
 * median and a length interpolated between the neighbouring rows. Weeks 41-42 repeat week 40 (the app
 * also stops at 40). Weeks 1-3 have no app row.
 */
export function pregnancyWeekSize(week: number): PregnancyWeekSize {
  if (week === 1) return { kind: 'none', text: 'Hələ mayalanma baş verməyib' };
  if (week === 2) return { kind: 'none', text: 'Mayalanma bu həftənin sonuna yaxın baş verə bilər' };
  if (week === 3) return { kind: 'none', text: 'Mikroskopik, təxminən 0,1-0,2 mm' };
  const row = APP_FRUIT_SIZES[week];
  if (row) return { kind: 'table', ...row };
  if (week > 40) return { kind: 'term', ...APP_FRUIT_SIZES[40] };
  const keys = Object.keys(APP_FRUIT_SIZES).map(Number);
  const previous = Math.max(...keys.filter(key => key < week)), nextWeek = Math.min(...keys.filter(key => key > week));
  const a = APP_FRUIT_SIZES[previous], b = APP_FRUIT_SIZES[nextWeek];
  const lengthCm = Math.round((a.lengthCm + (b.lengthCm - a.lengthCm) * (week - previous) / (nextWeek - previous)) * 10) / 10;
  return { kind: 'between', fruit: a.fruit, next: b.fruit, nextWeek, lengthCm, weightG: APP_MEDIAN_WEIGHT_G[week] };
}

const decimal = (value: number) => String(value).replace('.', ',');
export const formatLength = (cm: number) => `${decimal(cm)} sm`;
export const formatWeight = (grams: number) => (grams >= 1000 ? `${decimal(Math.round(grams / 100) / 10)} kq` : `${decimal(grams)} q`);
const lower = (value: string) => value.toLocaleLowerCase('az');

/** Short size line for the hub tiles. */
export function pregnancyWeekSizeShort(week: number): string {
  const size = pregnancyWeekSize(week);
  if (size.kind === 'none') return week === 3 ? 'Mikroskopik' : 'Hələ embrion yoxdur';
  return `${size.fruit}: ${formatLength(size.lengthCm)}, ${formatWeight(size.weightG)}`;
}

/** Predicate that replaces `{size}` in the quick answer: "təxminən limon boydadır (5,4 sm, 14 q)". */
export function pregnancyWeekSizePhrase(week: number): string {
  const size = pregnancyWeekSize(week);
  if (size.kind === 'none') return size.text.toLocaleLowerCase('az');
  if (size.kind === 'between') return `təxminən ${formatLength(size.lengthCm)} boyunda və ${formatWeight(size.weightG)} ağırlığındadır`;
  return `təxminən ${lower(size.fruit)} boydadır (${formatLength(size.lengthCm)}, ${formatWeight(size.weightG)})`;
}
export const pregnancyWeekQuick = (content: PregnancyWeekContent) => content.quick.replace('{size}', pregnancyWeekSizePhrase(content.week));

export interface PregnancyWeekFact { label: string; value: string }
/** Rows of the key facts table. */
export function pregnancyWeekFacts(week: number): PregnancyWeekFact[] {
  const size = pregnancyWeekSize(week);
  const facts: PregnancyWeekFact[] = [
    { label: 'Trimestr', value: `${azOrdinal(pregnancyTrimester(week))} trimestr` },
    { label: 'Hamiləlik müddəti', value: `${week} həftə 0 gün - ${week} həftə 6 gün (son menstruasiyanın 1-ci günündən)` },
  ];
  if (size.kind === 'none') facts.push({ label: 'Körpənin ölçüsü', value: size.text });
  else {
    facts.push({ label: 'Körpənin boyu (təpədən oturağa)', value: `təxminən ${formatLength(size.lengthCm)}` });
    facts.push({ label: 'Körpənin çəkisi', value: `təxminən ${formatWeight(size.weightG)}` });
    facts.push({ label: 'Ölçü müqayisəsi', value: size.kind === 'between' ? `${size.fruit} boydan bir az böyük (${azOrdinal(size.nextWeek)} həftədə: ${lower(size.next)})`
      : size.kind === 'term' ? `${size.fruit} (40-cı həftədəki kimi; hər körpə fərqlidir)` : `${size.fruit} boyda` });
  }
  facts.push({ label: 'Təxmini doğuş tarixinə qədər', value: week < 40 ? `təxminən ${40 - week} həftə` : week === 40 ? 'təxmini doğuş tarixi bu həftəyə düşür' : `təxmini doğuş tarixindən ${week - 40} həftə keçib` });
  return facts;
}

/** <title> without the " | Anacan" suffix seo.ts adds (whole title stays at most 60 characters). */
export const pregnancyWeekTitle = (week: number) => `Hamiləliyin ${azOrdinal(week)} həftəsi: körpə və əlamətlər`;
export const pregnancyWeekHeading = (week: number) => `Hamiləliyin ${azOrdinal(week)} həftəsi: körpənin ölçüsü, əlamətlər və məsləhətlər`;
export const pregnancyWeekLabel = (week: number) => `${azOrdinal(week)} həftə`;
export const PREGNANCY_WEEKS_HUB = {
  label: 'Həftəbəhəftə',
  title: 'Hamiləlik həftəbəhəftə: 1-42-ci həftələr',
  heading: 'Hamiləlik həftəbəhəftə: 1-ci həftədən 42-ci həftəyə',
  description: 'Hamiləliyin 1-42-ci həftələri: körpənin ölçüsü və inkişafı, bədəninizdəki dəyişikliklər, əlamətlər, müayinələr və həkimə nə vaxt müraciət etməli.',
  intro: 'Hər həftə üçün körpənin ölçüsü, bədəninizdə baş verən dəyişikliklər, tipik əlamətlər, standart müayinələr və diqqət tələb edən təhlükə əlamətləri. Həftələr son menstruasiyanın birinci günündən sayılır.',
};
export const PREGNANCY_TRIMESTERS = ([1, 2, 3] as const).map(trimester => {
  const weeks = PREGNANCY_WEEK_NUMBERS.filter(week => pregnancyTrimester(week) === trimester);
  const last = weeks[weeks.length - 1];
  return { trimester, title: `${azOrdinal(trimester)} trimestr`, range: `${weeks[0]}-${azOrdinal(last)} həftələr`, weeks };
});

/** Official sources (NHS pages opened on 2026-11-10; WHO, ACOG and NICE are their long-standing public pages). */
export const PREGNANCY_SOURCES = {
  whoAnc: { label: 'WHO: Recommendations on antenatal care for a positive pregnancy experience', url: 'https://www.who.int/publications/i/item/9789241549912' },
  acogRoutineTests: { label: 'ACOG: Routine Tests During Pregnancy', url: 'https://www.acog.org/womens-health/faqs/routine-tests-during-pregnancy' },
  acogGenetic: { label: 'ACOG: Prenatal Genetic Screening Tests', url: 'https://www.acog.org/womens-health/faqs/prenatal-genetic-screening-tests' },
  acogFetus: { label: 'ACOG: How Your Fetus Grows During Pregnancy', url: 'https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy' },
  acogNutrition: { label: 'ACOG: Nutrition During Pregnancy', url: 'https://www.acog.org/womens-health/faqs/nutrition-during-pregnancy' },
  acogExercise: { label: 'ACOG: Exercise During Pregnancy', url: 'https://www.acog.org/womens-health/faqs/exercise-during-pregnancy' },
  acogGdm: { label: 'ACOG: Gestational Diabetes', url: 'https://www.acog.org/womens-health/faqs/gestational-diabetes' },
  acogPreeclampsia: { label: 'ACOG: Preeclampsia and High Blood Pressure During Pregnancy', url: 'https://www.acog.org/womens-health/faqs/preeclampsia-and-high-blood-pressure-during-pregnancy' },
  acogPreterm: { label: 'ACOG: Preterm Labor and Birth', url: 'https://www.acog.org/womens-health/faqs/preterm-labor-and-birth' },
  acogGbs: { label: 'ACOG: Group B Strep and Pregnancy', url: 'https://www.acog.org/womens-health/faqs/group-b-strep-and-pregnancy' },
  acogPostTerm: { label: 'ACOG: When Pregnancy Goes Past Your Due Date', url: 'https://www.acog.org/womens-health/faqs/when-pregnancy-goes-past-your-due-date' },
  nhsAppointments: { label: 'NHS: Your antenatal care and appointments', url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-appointments/' },
  nhsVitamins: { label: 'NHS: Vitamins and supplements in pregnancy', url: 'https://www.nhs.uk/best-start-in-life/pregnancy/vitamins-and-supplements-in-pregnancy/' },
  nhsSickness: { label: 'NHS: Vomiting and morning sickness', url: 'https://www.nhs.uk/pregnancy/related-conditions/common-symptoms/vomiting-and-morning-sickness/' },
  nhsEctopic: { label: 'NHS: Ectopic pregnancy', url: 'https://www.nhs.uk/conditions/ectopic-pregnancy/' },
  nhsMiscarriage: { label: 'NHS: Miscarriage', url: 'https://www.nhs.uk/conditions/miscarriage/' },
  nhsScreening: { label: 'NHS: Screening tests in pregnancy', url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/screening-tests/' },
  nhsScan12: { label: 'NHS: 12-week scan', url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/12-week-scan/' },
  nhsScan20: { label: 'NHS: 20-week screening scan', url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/20-week-scan/' },
  nhsMovements: { label: "NHS: Your baby's movements", url: 'https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/' },
  nhsVaccinations: { label: 'NHS: Vaccinations in pregnancy', url: 'https://www.nhs.uk/pregnancy/keeping-well/vaccinations/' },
  nhsGdm: { label: 'NHS: Gestational diabetes', url: 'https://www.nhs.uk/conditions/gestational-diabetes/' },
  nhsPreeclampsia: { label: 'NHS: Pre-eclampsia', url: 'https://www.nhs.uk/conditions/pre-eclampsia/' },
  nhsGbs: { label: 'NHS: Group B strep', url: 'https://www.nhs.uk/conditions/group-b-strep/' },
  nhsLabourSigns: { label: 'NHS: Signs that labour has begun', url: 'https://www.nhs.uk/pregnancy/labour-and-birth/signs-of-labour/signs-that-labour-has-begun/' },
  nhsOverdue: { label: 'NHS: Overdue, have you gone past your due date?', url: 'https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/overdue-have-you-gone-past-your-due-date/' },
  niceAntenatal: { label: 'NICE NG201: Antenatal care', url: 'https://www.nice.org.uk/guidance/ng201' },
  niceHypertension: { label: 'NICE NG133: Hypertension in pregnancy', url: 'https://www.nice.org.uk/guidance/ng133' },
  niceDiabetes: { label: 'NICE NG3: Diabetes in pregnancy', url: 'https://www.nice.org.uk/guidance/ng3' },
  niceInduction: { label: 'NICE NG207: Inducing labour', url: 'https://www.nice.org.uk/guidance/ng207' },
} as const;
export type PregnancySourceId = keyof typeof PREGNANCY_SOURCES;

/** NHS Best Start in Life has one guide page per week for weeks 4-41; other weeks use its overview. */
export function nhsWeekSource(week: number): { label: string; url: string } {
  if (week < 4 || week > 41) return { label: 'NHS: Week-by-week guide to pregnancy', url: 'https://www.nhs.uk/pregnancy/week-by-week/' };
  const folder = week <= 12 ? '1st-trimester' : week <= 27 ? '2nd-trimester' : '3rd-trimester';
  return { label: `NHS: ${week} weeks pregnant guide`, url: `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/${folder}/week-${week}/` };
}
/** Always the NHS week guide, WHO antenatal care and NICE antenatal care, then the week's own sources. */
export function pregnancyWeekSources(week: number, ids: readonly PregnancySourceId[]) {
  const list = [nhsWeekSource(week), ...(['whoAnc', 'niceAntenatal', ...ids] as PregnancySourceId[]).map(id => PREGNANCY_SOURCES[id])];
  return list.filter((item, index) => list.findIndex(other => other.url === item.url) === index);
}

export interface PregnancyWeekFaq { question: string; answer: string }
/** One week's text. Plain strings only (no HTML or Markdown, no long dashes). */
export interface PregnancyWeekContent {
  week: number;
  /** Meta description, 120-158 characters. */
  description: string;
  /** Quick answer box: 2-3 sentences. */
  quick: string;
  baby: string[];
  body: string[];
  symptoms: string[];
  /** Week-specific checklist items (shown before the shared trimester items). */
  todo: string[];
  /** Week-specific danger signs (shown before the shared trimester list). */
  warning: string[];
  faq: PregnancyWeekFaq[];
  sources: PregnancySourceId[];
}

/** Standard tests of the week (NT 11-13, anomaly scan 18-22, glucose 24-28, GBS 36-37); empty otherwise. */
export function pregnancyWeekTests(week: number): string[] {
  if (week >= 11 && week <= 13) return [
    'Birinci trimestr skrininqi adətən 11 həftə 0 gün ilə 13 həftə 6 gün arasında edilir: ultrasəs müayinəsində boyun qırışığının qalınlığı (NT) ölçülür, çox vaxt qan analizi (PAPP-A və beta-hCG) ilə birlikdə qiymətləndirilir.',
    'Bu skrininq diaqnoz qoymur, yalnız Daun, Edvards və Patau sindromları ehtimalının aşağı və ya yüksək olduğunu göstərir. Ehtimal yüksək çıxarsa, həkim əlavə testləri (məsələn, NIPT və ya diaqnostik müayinə) izah edəcək.',
    'Eyni ultrasəsdə hamiləliyin müddəti dəqiqləşdirilir, ürək döyüntüsü və körpələrin sayı yoxlanılır.',
  ];
  if (week >= 18 && week <= 22) return [
    'İkinci trimestrin ətraflı ultrasəs müayinəsi (anomaliya skrininqi) adətən 18 həftə 0 gün ilə 22 həftə arasında edilir: körpənin beyni, üz quruluşu, onurğası, ürəyi, böyrəkləri, qarın divarı və əl-ayaqları yoxlanılır.',
    'Plasentanın yeri, döl suyunun miqdarı və körpənin ölçüləri də qiymətləndirilir. Bəzi vəziyyətlər bu müayinədə görünməyə bilər; nəticəni həkiminizlə müzakirə edin.',
    ...(week === 22 ? ['Bu müayinəni hələ etdirməmisinizsə, mümkün qədər tez həkiminizlə vaxt təyin edin.'] : []),
  ];
  if (week >= 24 && week <= 28) return [
    'Hestasion diabet üçün qlükoza yükləmə testi adətən 24-28-ci həftələr arasında edilir: ac qarına və şəkərli məhlul içdikdən sonra qanda qlükoza ölçülür.',
    'Testdən əvvəl necə hazırlaşmağı (neçə saat ac qalmaq, hansı məhlul) həkiminiz və ya laboratoriya deyəcək. Risk amilləri olanlara test daha erkən də təyin oluna bilər.',
  ];
  if (week === 36 || week === 37) return [
    'B qrup streptokok (GBS) üçün uşaqlıq yolu və düz bağırsaqdan yaxma adətən 36 həftə 0 gün ilə 37 həftə 6 gün arasında götürülür (bu, bəzi ölkələrdə müntəzəm, bəzilərində isə risk amillərinə görə edilir).',
    'Nəticə müsbət olarsa, doğuş zamanı körpəni qorumaq üçün damardan antibiotik verilir. Bu, sizin sağlamlığınızla bağlı qorxulu bir xəbər deyil; GBS çox qadında əlamətsiz olur.',
  ];
  return [];
}
/** Line shown when the week has no standard test: the next one, or routine visits. */
export function pregnancyWeekNextTest(week: number): string {
  if (week < 11) return 'Bu həftəyə düşən standart skrininq yoxdur. Növbəti standart müayinə 11-13-cü həftələrdə birinci trimestr skrininqidir (NT). İlk antenatal görüşdə həkim qan və sidik analizlərini təyin edəcək.';
  if (week < 18) return 'Bu həftəyə düşən standart skrininq yoxdur. Növbəti standart müayinə 18-22-ci həftələrdə ətraflı ultrasəsdir (anomaliya skrininqi). Müntəzəm görüşlərdə təzyiq və sidik yoxlanılır.';
  if (week < 24) return 'Bu həftəyə düşən standart skrininq yoxdur. Növbəti standart müayinə 24-28-ci həftələrdə qlükoza yükləmə testidir. Müntəzəm görüşlərdə təzyiq, sidik və qarnın ölçüsü yoxlanılır.';
  if (week < 36) return 'Bu həftəyə düşən standart skrininq yoxdur. Növbəti standart müayinə 36-37-ci həftələrdə B qrup streptokok (GBS) yoxlamasıdır. Müntəzəm görüşlərdə təzyiq, sidik, qarnın ölçüsü və körpənin ürək döyüntüsü yoxlanılır.';
  return 'Bu həftəyə düşən yeni standart skrininq yoxdur. Həkiminiz təzyiqi, sidiyi, körpənin vəziyyətini və ürək döyüntüsünü yoxlamağa davam edəcək.';
}

/** Shared danger signs per stage (added after the week-specific ones). */
export function pregnancyWeekSharedWarnings(week: number): string[] {
  if (week <= 3) return [
    'Hamiləlik testi müsbət olduqdan sonra qarnın bir tərəfində güclü ağrı, çiyin ucunda ağrı, başgicəllənmə və ya huşunu itirmə (uşaqlıqdankənar hamiləlik ola bilər).',
    'Güclü qanaxma və ya 38 °C-dən yüksək qızdırma.',
  ];
  if (week <= 12) return [
    'Güclü qanaxma, laxtalı qan və ya sancıya bənzər güclü qarın ağrısı.',
    'Qarnın bir tərəfində kəskin ağrı, çiyin ucunda ağrı, başgicəllənmə, huşunu itirmə.',
    'Gün ərzində heç nə, hətta su da saxlaya bilməmək, sidiyin çox azalması və ya tünd olması.',
    '38 °C-dən yüksək qızdırma, sidik ifrazında yanma ilə birlikdə bel ağrısı.',
  ];
  if (week <= 23) return [
    'Uşaqlıq yolundan qanaxma və ya su kimi maye axması.',
    'Ritmik qarın bərkiməsi, sancılar, bel ağrısı və ya aşağıda güclü təzyiq hissi.',
    'Güclü baş ağrısı, görmədə dəyişiklik, üzün və əllərin qəfil şişməsi (20-ci həftədən sonra).',
    '38 °C-dən yüksək qızdırma, keçməyən güclü qarın ağrısı.',
  ];
  return [
    'Körpənin hərəkətlərinin azalması, dəyişməsi və ya dayanması: səhəri gözləmədən dərhal həkimə və ya doğum evinə müraciət edin.',
    'Uşaqlıq yolundan qanaxma və ya su kimi maye axması.',
    '37-ci həftədən əvvəl müntəzəm sancılar, bel ağrısı və ya aşağıda güclü təzyiq hissi.',
    'Güclü baş ağrısı, görmədə dəyişiklik, qabırğaların altında ağrı, üzün və əllərin qəfil şişməsi.',
    'Ovuc və ayaqaltılarda güclü qaşınma (xüsusən gecələr), 38 °C-dən yüksək qızdırma.',
  ];
}
/** Shared checklist items per trimester (added after the week-specific ones). */
export function pregnancyWeekSharedTodo(week: number): string[] {
  if (week <= 12) return ['Həkimin tövsiyə etdiyi fol turşusunu qəbul edin.', 'Siqaret, alkoqol və həkimlə razılaşdırılmamış dərmanlardan uzaq durun.'];
  if (week <= 26) return ['Hər gün bir az hərəkət edin: gəzinti, üzgüçülük və ya hamilələr üçün yoqa.', 'Müntəzəm antenatal görüşləri buraxmayın.'];
  return ['Körpənin hərəkətlərini hər gün izləyin və adi ritmini tanıyın.', 'Doğum evinin və həkiminizin telefonunu əl altında saxlayın.'];
}
