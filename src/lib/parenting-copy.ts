import { tr, formatTr } from '@/lib/tr';

/**
 * Tərbiyə (positive parenting) — UI chrome strings with their Azerbaijani source text.
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys.
 * The long-form content is in src/data/parenting/<lang>/ (Azerbaijani only for now).
 * Emergency numbers are never written here: copy uses {emergency} and is filled per country.
 */
export const PARENTING_COPY = {
  par_tool_name: 'Tərbiyə',
  par_tool_desc: 'Elmə əsaslanan, sevgi dolu tərbiyə: yaşa görə bələdçi, çətin anlar üçün SOS və proqramlar',
  par_free: 'Pulsuz',
  par_premium: 'Premium',
  par_child_fallback: 'Uşaq',
  par_age_months: '{n} ay',
  par_age_years: '{n} yaş',
  par_minutes: '{n} dəq',
  par_disclaimer: 'Bu bələdçi məlumat xarakterlidir, həkim və ya psixoloq məsləhətini əvəz etmir.',

  // Age bands
  par_band_0_1: '0–1 yaş',
  par_band_1_3: '1–3 yaş',
  par_band_3_6: '3–6 yaş',
  par_band_6_12: '6–12 yaş',
  par_band_pick: 'Yaş dövrünü seç',
  par_band_from_child: '{name} üçün seçildi',

  // Home
  par_home_hello: 'Bu gün kiçik bir addım kifayətdir',
  par_tip_title: 'Günün məsləhəti',
  par_sec_age: 'Bu yaşda',
  par_sec_topics: 'Mövzular',
  par_sec_sos: 'Çətin an? SOS',
  par_sec_programmes: 'Qısa proqramlar',
  par_sec_quizzes: 'Testlər',
  par_see_all: 'Hamısına bax',
  par_band_open: 'Beyində nə baş verir?',

  // Headings
  par_h_brain: 'Beyində nə baş verir',
  par_h_needs: 'Səndən nəyə ehtiyacı var',
  par_h_normal: 'Bu yaşda normaldır',
  par_h_try_age: 'Bu yaşda sına',
  par_h_science: 'Elm nə deyir',
  par_h_try: 'Bu gün sına',
  par_h_mistakes: 'Tez-tez edilən səhvlər',
  par_h_by_age: 'Uşağının yaşına görə',
  par_h_specialist: 'Nə vaxt mütəxəssisə müraciət etməli',
  par_h_sources: 'Elmi mənbələr',

  // Lists
  par_topics_title: 'Mövzular kitabxanası',
  par_sos_title: 'Çətin anlar üçün SOS',
  par_programmes_title: 'Qısa proqramlar',
  par_quizzes_title: 'Testlər',
  par_filter_band: 'Yaşına uyğun',
  par_filter_all: 'Hamısı',
  par_empty: 'Bu yaş üçün hələ material yoxdur.',

  // SOS
  par_sos_steps: '3 addım',
  par_sos_say: 'Belə deyə bilərsən',
  par_sos_avoid: 'Bunu etmə',
  par_sos_red: 'Bu artıq adi çətin an deyil',

  // Premium
  par_lock_title: 'Davamı Premium-dadır',
  par_lock_text: 'Bütün mövzular, SOS kartları, proqramlar və testlərin ətraflı nəticələri.',
  par_lock_cta: 'Premium-u aç',

  // Programmes
  par_prog_days: '{n} gün',
  par_prog_progress: '{done}/{total} gün',
  par_prog_start: 'Proqrama başla',
  par_prog_today: 'Bugünkü addım',
  par_prog_why: 'Niyə işləyir',
  par_prog_done_today: 'Bunu etdim ✓',
  par_prog_come_back: 'Bugünkü addım tamamdır. Sabah növbəti gün açılacaq.',
  par_prog_undo: 'Son qeydi geri al',
  par_prog_restart: 'Yenidən başla',
  par_prog_finished: 'Proqramı bitirdin! Özünə təşəkkür et 🤍',
  par_prog_day: 'Gün {n}',
  par_prog_all_days: 'Bütün günlər',

  // Quizzes
  par_quiz_start: 'Testə başla',
  par_quiz_question: 'Sual {n}/{total}',
  par_quiz_result: 'Nəticən',
  par_quiz_detail: 'Ətraflı nəticə',
  par_quiz_retake: 'Yenidən keç',
  par_quiz_last: 'Son nəticə: {result}',
  par_quiz_support: 'Bu bacarığı necə dəstəkləmək olar',

  // Safety
  par_emergency_title: 'Təhlükə varsa, gözləmə',
  par_emergency_text: 'Uşaq və ya sən təhlükədəsənsə, zorakılıq, özünə zərər vermə və ya intihar fikri varsa, dərhal {emergency} nömrəsinə zəng et.',
  par_call: 'Zəng et: {emergency}',
} as const;

export type ParentingKey = keyof typeof PARENTING_COPY;

/** Translated UI string of the parenting tool (tr with the Azerbaijani source as fallback). */
export const pt = (key: ParentingKey): string => tr(key, PARENTING_COPY[key]);

/** Translated template with {placeholders} filled. */
export const pf = (key: ParentingKey, values: Record<string, unknown>): string => formatTr(key, PARENTING_COPY[key], values);

/** Age band label key. */
export const bandKey = (band: string) => `par_band_${band.replace('-', '_')}` as ParentingKey;
