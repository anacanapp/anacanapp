/** Browser: load only the data chunk the current tool page needs, before routing and hydration. */
import { NAMES_COPY, isNamesLanguage, type NameRow, type NamesLanguage } from './names';
import { maternityData, namesIndex, registerMaternity, registerNames } from './tool-data';
import { DEKRET_SLUG } from './dekret-copy';
import { isPregnancyWeekLanguage, weekLocale } from '../pregnancy-weeks/locale';
import { pregnancyWeeksLoaded, registerPregnancyWeeks } from '../pregnancy-weeks/registry';
import { SEO_HUB_SLUGS, isSeoHubLanguage } from '../seo-hubs/routes';
import { registerSeoHubContent, seoHubContentLoaded } from '../seo-hubs/registry';

const NAME_LOADERS: Partial<Record<NamesLanguage, () => Promise<{ default: unknown }>>> = {
  az: () => import('./data/names-az.json'),
  ka: () => import('./data/names-ka.json'),
};
export async function preloadToolData(pathname: string): Promise<void> {
  let segments: string[];
  try { segments = pathname.replace(/^\/site(?=\/|$)/, '').split('/').filter(Boolean).map(value => decodeURIComponent(value)); } catch { return; }
  const [language, first] = segments;
  const tasks: Promise<void>[] = [];
  if (language && isNamesLanguage(language) && first === NAMES_COPY[language]!.hubSlug && !namesIndex(language) && NAME_LOADERS[language])
    tasks.push(NAME_LOADERS[language]!().then(module => registerNames(language, module.default as NameRow[])));
  if (language === 'az' && first === DEKRET_SLUG && !maternityData())
    tasks.push(Promise.all([import('../../data/maternityRules'), import('../../data/maternity-regional.json')])
      .then(([rules, regional]) => registerMaternity(rules.maternityRules, Object.keys(regional.default.countries))));
  // Pregnancy week texts (/az/hamilelik/<n>-ci-hefte/, /ru/беременность/<n>-неделя/): one chunk per language with all 42 weeks.
  if (language && isPregnancyWeekLanguage(language) && first === weekLocale(language).parent && segments.length === 3 && !pregnancyWeeksLoaded(language))
    tasks.push((language === 'ru' ? import('../pregnancy-weeks/ru').then(module => module.PREGNANCY_WEEKS_RU) : import('../pregnancy-weeks/az').then(module => module.PREGNANCY_WEEKS_AZ))
      .then(rows => registerPregnancyWeeks(rows, language)));
  // SEO content pages (fever, solid foods, pregnancy can/can't, milk storage, periods): one chunk per language.
  if (language && isSeoHubLanguage(language) && (Object.values(SEO_HUB_SLUGS[language]) as string[]).includes(first) && !seoHubContentLoaded(language))
    tasks.push((language === 'ru' ? import('../seo-hubs/content-ru') : import('../seo-hubs/content-az')).then(module => registerSeoHubContent(language, module)));
  await Promise.all(tasks);
}
