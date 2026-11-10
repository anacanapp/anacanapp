/**
 * Azerbaijani texts of /az/dekret-pulu-kalkulyatoru/ (bundled, no copy keys). Numbers come from the AZ
 * maternity rule (src/data/maternityRules.ts) through dekret.ts; facts not in that rule are quoted from
 * the sources in DEKRET_SOURCES (checked 2026-11-10):
 * - Əmək Məcəlləsi 125.1 (126 = 70 + 56; complicated or 2+ children: 70 after birth), 125.2
 *   (agricultural production: 140 / 156 / 180), 126 (adoption of a child under two months: 56 days);
 * - sosial.gov.az maternity benefit page: 6 months of insurance record, average daily earnings of the four
 *   quarters before the leave month, cap of 25 minimum monthly labour pensions per month, automatic
 *   assignment from the electronic sick-leave certificate, new rules from 1 May 2026.
 * The one-time childbirth allowance amount is not stated here (not confirmed from an official source);
 * the page links to the existing journal article instead.
 */
import type { MaternityRule } from '../../data/maternityRules';
import { leaveDays, payShare, type LeaveDays } from './dekret';

export const DEKRET_SLUG = 'dekret-pulu-kalkulyatoru';
export const DEKRET_UPDATED = '2026-11-10';
export const DEKRET_ARTICLES = {
  dekret: { slug: 'analiq-mezuniyyeti-dekret-kimlere-dusur-ve-odenis-nece-hesablanir', label: 'Analıq məzuniyyəti (dekret): kimlərə düşür və ödəniş necə hesablanır' },
  birth: { slug: '600-manat-birdefelik-muavineti-nece-almaq-olar-senedler-ve-e-social-qeydiyyati', label: 'Birdəfəlik müavinət: sənədlər və e-social qeydiyyatı' },
} as const;
export const DEKRET_SOURCES = [
  { label: 'Əmək Məcəlləsi, 125-ci və 126-cı maddələr (e-qanun.az)', href: 'https://e-qanun.az/framework/46943' },
  { label: 'Əmək Məcəlləsinin mətni (migration.gov.az, PDF)', href: 'https://www.migration.gov.az/content/pdf/5da56e1b87592_%C6%8FM.pdf' },
  { label: 'Hamiləliyə və doğuşa görə müavinət (Əmək və Əhalinin Sosial Müdafiəsi Nazirliyi, sosial.gov.az)', href: 'https://www.sosial.gov.az/en/social-insurance-based-benefits/maternity-benefit' },
] as const;
/** Labour Code 125.2: women working in agricultural production (not part of maternityRules). */
export const AGRICULTURE_DAYS = [
  { label: 'Kənd təsərrüfatı istehsalı: normal doğuş', before: 70, after: 70 },
  { label: 'Kənd təsərrüfatı istehsalı: çətin doğuş', before: 70, after: 86 },
  { label: 'Kənd təsərrüfatı istehsalı: iki və daha çox uşaq', before: 70, after: 110 },
] as const;

export const BIRTH_LABELS = { normal: 'Normal doğuş', complicated: 'Çətin doğuş', multiple: 'İki və daha çox uşaq' } as const;

export const DEKRET_COPY = {
  label: 'Dekret pulu kalkulyatoru',
  title: 'Dekret pulu hesablama 2026: analıq məzuniyyəti',
  h1: 'Dekret pulu kalkulyatoru 2026',
  description: (normal?: LeaveDays) => normal
    ? `Dekret pulunu hesablayın: analıq məzuniyyəti ${normal.total} gündür (${normal.before} + ${normal.after}). Orta aylıq əmək haqqına görə gündəlik məbləğ, ümumi müavinət və tarixlər.`
    : 'Dekret pulunu hesablayın: orta aylıq əmək haqqına görə gündəlik məbləğ, ümumi müavinət və məzuniyyət tarixləri.',
  intro: 'Orta aylıq əmək haqqınızı və doğuş növünü seçin: kalkulyator analıq məzuniyyətinin günlərini, gündəlik və ümumi müavinəti, təxmini doğuş tarixini yazsanız, məzuniyyətin başlanğıc və bitmə tarixlərini göstərir.',
  disclaimer: 'Kalkulyator məlumat xarakterlidir və təxmini nəticə verir. Dəqiq məbləğ faktiki qazancınızdan, sosial sığorta stajınızdan və qanunvericilikdəki dəyişikliklərdən asılıdır: işəgötürəninizlə və ya Dövlət Sosial Müdafiə Fondu (DSMF) ilə dəqiqləşdirin.',
  appTitle: 'Anacan tətbiqində dekret kalkulyatoru',
  appText: (countries: number) => `Anacan tətbiqində ${countries} ölkə üzrə dekret qaydaları, ata məzuniyyəti və valideyn məzuniyyəti.`,
  appFeatures: (countries: number) => [`${countries} ölkənin analıq məzuniyyəti qaydaları`, 'Ata məzuniyyəti hesabı', 'Valideyn (uşağa qulluq) məzuniyyətinin müddəti', 'Məzuniyyət tarixləri və işə qayıdış günü'],
};

export function answerText(rule: MaternityRule): string {
  const normal = leaveDays(rule, 'normal'), complicated = leaveDays(rule, 'complicated');
  return `Azərbaycanda analıq məzuniyyəti (dekret) ${normal.total} təqvim günüdür: doğuşdan əvvəl ${normal.before}, doğuşdan sonra ${normal.after} gün. `
    + `Doğuş çətin olduqda və ya iki və daha çox uşaq doğulduqda doğuşdan sonrakı hissə ${complicated.after} gündür, cəmi ${complicated.total} gün. `
    + `Müavinət orta günlük qazancın ${Math.round(payShare(rule) * 100)}%-i həcmində hər təqvim günü üçün ödənilir.`;
}

export function dekretFaq(rule: MaternityRule): Array<{ question: string; answer: string }> {
  const normal = leaveDays(rule, 'normal'), complicated = leaveDays(rule, 'complicated'), multiple = leaveDays(rule, 'multiple');
  return [
    { question: 'Dekret pulu neçə günə verilir?', answer: `Normal doğuşda analıq məzuniyyəti ${normal.total} təqvim günüdür: doğuşdan əvvəl ${normal.before}, doğuşdan sonra ${normal.after} gün. Müavinət bu günlərin hər biri üçün ödənilir.` },
    { question: 'Çətin doğuşda və əkiz doğulduqda dekret neçə gündür?', answer: `Doğuş çətin olduqda ${complicated.total} gün (${complicated.before} + ${complicated.after}), iki və daha çox uşaq doğulduqda ${multiple.total} gün (${multiple.before} + ${multiple.after}). Kənd təsərrüfatı istehsalında çalışan qadınlar üçün müddətlər daha uzundur: 140, 156 və 180 gün.` },
    { question: 'Dekret pulu necə hesablanır?', answer: 'Ümumi məbləğ orta günlük qazancın məzuniyyət günlərinin sayına vurulması ilə tapılır. Orta günlük qazanc məzuniyyətin başladığı aydan əvvəlki dörd ardıcıl rübdəki (12 ay) qazancın həmin dövrün nəzərə alınan təqvim günlərinə bölünməsi ilə hesablanır. Kalkulyator bunu aylıq orta əmək haqqı × 12 / 365 kimi götürür.' },
    { question: 'Dekret pulu almaq üçün staj lazımdır?', answer: `Bəli. Hamiləliyə və doğuşa görə müavinət üçün ən azı ${rule.tenureRequirementMonths ?? 6} ay sosial sığorta stajı tələb olunur.` },
    { question: 'Dekret pulunun yuxarı həddi varmı?', answer: 'Bəli. Müavinətin aylıq məbləği minimum aylıq əmək pensiyasının 25 mislindən çox ola bilməz. Minimum pensiya 320 AZN olduğu üçün hədd ayda 8 000 AZN-dir. Kalkulyator bu həddi avtomatik nəzərə alır.' },
    { question: 'Dekret pulu üçün ayrıca müraciət etmək lazımdır?', answer: 'Adətən yox. Tibb müəssisəsi elektron xəstəlik vərəqəsi verir, işəgötürən məzuniyyət əmrini Mərkəzləşdirilmiş Elektron İnformasiya Sisteminin «Əmək və Məşğulluq» altsisteminə daxil edir və müavinət avtomatik təyin olunur.' },
    { question: 'Birdəfəlik doğum müavinəti dekret pulundan ayrıdır?', answer: 'Bəli, uşağın doğulmasına görə birdəfəlik müavinət ayrıca ödənişdir. Şərtləri və sənədləri Anacan jurnalındakı ayrıca məqalədə izah olunur.' },
  ];
}
