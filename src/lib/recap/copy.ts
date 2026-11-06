/**
 * Anacan Recap — every string of the year-in-review video and its screen, with the Azerbaijani source text.
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys.
 * This module is pure (no tr import) so the renderer and the demo pipeline can use it without the app shell.
 *
 * Copy rules: warm, "sən", never clinical or guilt-inducing, no medical claims. Numbers are shown as large
 * values under a heading (eyebrow) so sentences never depend on grammatical number agreement.
 */
export const RECAP_COPY = {
  // Cold open
  recap_cold_title_name: '{name}, bu il sənin hekayən idi.',
  recap_cold_title: 'Bu il sənin hekayən idi.',

  // Days together
  recap_days_eyebrow: 'Anacan ilə birlikdə keçən günlər',
  recap_days_line: 'Hər açılış kiçik bir qayğı anı idi.',
  recap_days_streak: 'Ən uzun seriya: {days}',

  // Journey across stages
  recap_journey_eyebrow: 'Sənin yolun',
  recap_journey_bump_mommy: 'Bu il həm hamiləlik, həm analıq.',
  recap_journey_flow_bump: 'Bu il yeni bir həyatı gözləməyə başladın.',
  recap_journey_full: 'Dövrdən hamiləliyə, hamiləlikdən analığa — hamısı bir ildə.',
  recap_stage_flow: 'Dövr',
  recap_stage_bump: 'Hamiləlik',
  recap_stage_mommy: 'Analıq',

  // Mommy
  recap_feed_eyebrow: 'Qidalandırmalar',
  recap_feed_line: 'Hər biri bir qucaq, bir sakit an idi.',
  recap_feed_night: 'Gecə qidalandırmaları: {n}',
  recap_feed_night_line: 'Gecə 03:00-da da yanında idin.',
  recap_sleep_eyebrow: 'Yuxu saatları',
  recap_sleep_line_child: '{child} şirin yuxular gördü, sən isə keşiyində idin.',
  recap_sleep_line: 'Körpən şirin yuxular gördü, sən isə keşiyində idin.',
  recap_sleep_longest: 'Ən uzun yuxu: {hours}',
  recap_diaper_eyebrow: 'Bez dəyişmələri',
  recap_diaper_line: 'Bəli, hər birini saydıq. Sən qəhrəmansan.',
  recap_ms_eyebrow: 'Yeni bacarıqlar',
  recap_ms_line_child: '{child} hər gün bir az böyüdü.',
  recap_ms_line: 'Körpən hər gün bir az böyüdü.',
  recap_ms_more: '+{n} daha',
  recap_growth_eyebrow: 'Böyümə',
  recap_growth_line_child: '{child} bu il {kg} böyüdü.',
  recap_growth_line: 'Körpən bu il {kg} böyüdü.',
  recap_growth_from: 'İlin əvvəli',
  recap_growth_to: 'İndi',
  recap_growth_gain: '+{kg}',

  // Bump
  recap_weeks_eyebrow: 'Hamiləlik həftələri',
  recap_weeks_line: 'Hər həftə bir az daha yaxın.',
  recap_kicks_eyebrow: 'Təpiklər',
  recap_kicks_line: 'Hər biri “buradayam” deyirdi.',
  recap_kicks_max: 'Bir seansda ən çox: {n}',
  recap_bag_eyebrow: 'Xəstəxana çantasında hazır əşyalar',
  recap_bag_line: 'Hər şey hazırdır — sən də.',
  recap_names_eyebrow: 'Sevimli adlar',
  recap_names_line: 'Hər ad bir arzu idi.',
  recap_names_sub: 'Sevimli adlar: {n}',

  // Flow
  recap_cycles_eyebrow: 'İzlədiyin dövrlər',
  recap_cycles_line: 'Bədənini bir az daha yaxşı tanıdın.',
  recap_cycles_avg: 'Orta dövr: {days}',
  recap_period_avg: 'Menstruasiya: {days}',
  recap_flowdays_eyebrow: 'Özünü dinlədiyin günlər',
  recap_flowdays_line: 'Hər qeyd özünə ayırdığın bir an idi.',
  recap_mood_eyebrow: 'Əhvalının rəngi',
  recap_mood_1: 'Həssas',
  recap_mood_2: 'Sakit',
  recap_mood_3: 'İşıqlı',
  recap_mood_4: 'Parlaq',
  recap_mood_line: 'Hər hiss sənindir və hamısı yerindədir.',
  recap_mood_symptom: 'Ən çox qeyd etdiyin: {symptom}',
  recap_water_eyebrow: 'İçdiyin stəkan su',
  recap_water_line: 'Özünə qayğı da qayğıdır.',

  // Your Anacan
  recap_hour_eyebrow: 'Ən sevdiyin saat',
  recap_hour_night: 'Hamı yatanda biz yanında idik.',
  recap_hour_morning: 'Səhərin ilk anlarında birlikdə.',
  recap_hour_day: 'Günün ortasında kiçik bir fasilə.',
  recap_hour_evening: 'Axşamın sakitliyində birlikdə.',
  recap_tools_title: 'Ən çox açdığın alətlər',
  recap_ai_eyebrow: 'Anacan.AI-ya verdiyin suallar',
  recap_ai_line: 'Heç bir sual kiçik deyil.',
  recap_reads_eyebrow: 'İcmada oxuduğun yazılar',
  recap_likes_eyebrow: 'Paylaşdığın ürəklər',
  recap_comm_line: 'Tək deyilsən — minlərlə ana yanındadır.',
  recap_comm_likes: 'Bəyənilər: {n}',
  recap_comm_comments: 'Şərhlər: {n}',
  recap_comm_posts: 'Paylaşımlar: {n}',
  recap_games_eyebrow: 'Oyun anları',
  recap_games_line: 'Bir az istirahət də qayğıdır.',
  recap_achievements: 'Nailiyyətlər: {n}',
  recap_top_pct: 'Ən fəal {pct} arasındasan',

  // Emotional peak
  recap_peak_lead_child: 'Bu il {child} ilə:',
  recap_peak_lead: 'Bu il:',
  recap_peak_close_mommy: 'və saysız sevgi.',
  recap_peak_close_bump: 'və bir ömürlük sevgi.',
  recap_peak_close_flow: 'və özünə bir az daha çox sevgi.',
  recap_peak_close: 'və hər gün bir az qayğı.',

  // Stat labels (headings under a value)
  recap_label_days: 'gün birlikdə',
  recap_label_feedings: 'qidalandırma',
  recap_label_sleep: 'saat yuxu',
  recap_label_diapers: 'bez dəyişmə',
  recap_label_milestones: 'yeni bacarıq',
  recap_label_kicks: 'təpik',
  recap_label_weeks: 'həftə gözləmə',
  recap_label_bag: 'hazır əşya',
  recap_label_names: 'sevimli ad',
  recap_label_cycles: 'dövr',
  recap_label_flowdays: 'qeyd günü',
  recap_label_water: 'stəkan su',
  recap_label_ai: 'Anacan.AI sualı',
  recap_label_reads: 'oxunan yazı',
  recap_label_likes: 'ürək',
  recap_label_streak: 'günlük seriya',
  recap_label_games: 'oyun',

  // Personality
  recap_persona_eyebrow: 'Sənin {year} tipin',
  recap_persona_night: 'Gecə Qəhrəmanı',
  recap_persona_night_why: 'Ən çox gecə saatlarında yanımızda idin — sakit, oyaq, sevgi dolu.',
  recap_persona_planner: 'Səbirli Planlayıcı',
  recap_persona_planner_why: 'Ardıcıllıq sənin super gücündür: hər şeyi vaxtında, sakitcə.',
  recap_persona_knowledge: 'Bilik Ovçusu',
  recap_persona_knowledge_why: 'Soruşmaqdan, oxumaqdan, öyrənməkdən yorulmadın.',
  recap_persona_community: 'İcma Ürəyi',
  recap_persona_community_why: 'Başqa analara ürək verdin, onlar da sənə.',
  recap_persona_caring: 'Qayğı Ustası',
  recap_persona_caring_why: 'Səssiz, sabit, hər gün — əsl qayğı belə olur.',

  // Summary card and outro
  recap_summary_kicker: 'Mənim ilim',
  recap_outro_tagline: 'Hər addımda yanında',
  recap_outro_stores: 'App Store və Google Play-də',

  // Screen and entry points
  recap_home_title: 'Sənin {year}-n hazırdır ✨',
  recap_home_text: 'Bu ilin ən gözəl anları bir videoda. İzlə və paylaş.',
  recap_home_cta: 'İzlə',
  recap_profile_sub: 'Sənin ilin bir videoda',
  recap_preview_badge: 'Önizləmə · yalnız admin',
  recap_loading: 'Hekayən hazırlanır…',
  recap_unavailable: 'Recap hələ açılmayıb. Tezliklə!',
  recap_download: 'Videonu yüklə',
  recap_share: 'Paylaş',
  recap_share_image: 'Şəkil kimi paylaş',
  recap_rendering: 'Video hazırlanır… {pct}',
  recap_rendering_hint: 'Ekranı açıq saxla, təxminən 1 dəqiqə çəkir.',
  recap_replay: 'Yenidən izlə',
  recap_close: 'Bağla',
  recap_cancel: 'Ləğv et',
  recap_pause: 'Fasilə',
  recap_mute: 'Səsi bağla',
  recap_unmute: 'Səsi aç',
  recap_saved: 'Video hazırdır',
  recap_error: 'Video hazırlana bilmədi. Şəkil kimi paylaşa bilərsən.',
  recap_share_text: 'Mənim Anacan {year} hekayəm 💛 anacan.az',
} as const;

export type RecapCopyKey = keyof typeof RECAP_COPY;

/** Translator handed to the model: returns the translated string (or the Azerbaijani source). */
export type RecapTranslate = (key: RecapCopyKey) => string;

/** The Azerbaijani source translator (demo pipeline and tests). */
export const recapSource: RecapTranslate = (key) => RECAP_COPY[key];

/** Fills {placeholders}; unknown ones are left as they are. */
export function fillRecap(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
}
