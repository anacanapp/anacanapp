/** Browser: load only the data chunk the current tool page needs, before routing and hydration. */
import { NAMES_COPY, isNamesLanguage, type NameRow, type NamesLanguage } from './names';
import { maternityData, namesIndex, registerMaternity, registerNames } from './tool-data';
import { DEKRET_SLUG } from './dekret-copy';
import { PREGNANCY_WEEKS_PARENT } from '../pregnancy-weeks/weeks';
import { pregnancyWeeksLoaded, registerPregnancyWeeks } from '../pregnancy-weeks/registry';

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
  // Pregnancy week texts (/az/hamilelik/<n>-ci-hefte/): one chunk with all 42 weeks.
  if (language === 'az' && first === PREGNANCY_WEEKS_PARENT && segments.length === 3 && !pregnancyWeeksLoaded())
    tasks.push(import('../pregnancy-weeks/az').then(module => registerPregnancyWeeks(module.PREGNANCY_WEEKS_AZ)));
  await Promise.all(tasks);
}
