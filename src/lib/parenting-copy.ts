import { tr, formatTr } from '@/lib/tr';

/**
 * Tərbiyə (positive parenting) — UI chrome strings with their Azerbaijani source text.
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys.
 * The long-form content is in src/data/parenting/<lang>/ (all 23 app languages).
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
  par_age_ym: '{y} yaş {m} ay',
  par_minutes: '{n} dəq',
  par_read_time: '{n} dəqiqəlik oxu',
  par_count_cards: '{n} kart',
  par_count_articles: '{n} məqalə',
  par_disclaimer: 'Bu bələdçi məlumat xarakterlidir, həkim və ya psixoloq məsləhətini əvəz etmir.',

  // Age bands
  par_band_0_1: '0–1 yaş',
  par_band_1_3: '1–3 yaş',
  par_band_3_6: '3–6 yaş',
  par_band_6_12: '6–12 yaş',
  par_band_pick: 'Yaş dövrünü seç',
  par_band_from_child: '{name} üçün seçildi',

  // Home
  par_tip_title: 'Günün məsləhəti',
  par_sec_topics: 'Mövzular',
  par_sec_sos: 'Çətin an? SOS',
  par_sec_programmes: 'Qısa proqramlar',
  par_sec_quizzes: 'Testlər',
  par_see_all: 'Hamısına bax',
  par_home_continue: 'Davam et: {title}',
  par_home_day: 'Gün {n}/{total}',
  par_milestone_early: 'Bu yoxlama {n} aylıqdan başlayır. Bu yaşda hər körpə öz tempi ilə inkişaf edir. Səni narahat edən bir şey varsa, həkimlə danış.',
  par_band_open: 'Bu yaşda nə baş verir?',

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
  par_sos_say: 'Belə deyə bilərsən',
  par_sos_avoid: 'Bunu etmə',
  par_sos_red: 'Bu artıq adi çətin an deyil',
  par_sos_meta_free: '3 addım · pulsuz',
  par_sos_meta_premium: '3 addım · Premium',

  // Bookmarks
  par_saved_title: 'Saxlanılanlar',
  par_saved_empty: 'Hələ heç nə saxlamamısan. Məqalədə və ya SOS kartında 🔖 düyməsinə toxun.',
  par_save: 'Yadda saxla',
  par_unsave: 'Saxlanılanlardan çıxar',

  // Premium
  par_lock_title: 'Davamı Premium-dadır',
  par_lock_text: 'Bütün mövzular, SOS kartları, proqramlar və testlərin ətraflı nəticələri.',
  par_lock_cta: 'Premium-u aç',

  // Programmes
  par_prog_days: '{n} gün',
  par_prog_progress: '{done}/{total} gün',
  par_prog_start: 'Proqrama başla',
  par_prog_why: 'Niyə işləyir',
  par_prog_done_today: 'Bunu etdim ✓',
  par_prog_come_back: 'Bugünkü addım tamamdır. Sabah növbəti gün açılacaq.',
  par_prog_undo: 'Son qeydi geri al',
  par_prog_restart: 'Yenidən başla',
  par_prog_finished: 'Proqramı bitirdin! Özünə təşəkkür et 🤍',
  par_prog_day: 'Gün {n}',
  par_prog_all_days: 'Bütün günlər',
  par_prog_great: 'Əla gedirsən! 🔥',
  par_prog_steps_done: '{n} kiçik addım artıq geridə qalıb',
  par_prog_daily: 'Hər gün bir kiçik addım',
  par_prog_free_days: 'İlk {n} gün pulsuz',
  par_prog_locked_title: 'Proqramlar Premium-dadır',
  par_prog_unlock: 'Premium ilə aç',

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

  // Loading and sync
  par_loading: 'Yüklənir…',
  par_load_failed: 'Məzmunu yükləmək alınmadı. İnternet bağlantısını yoxla və yenidən cəhd et.',
  par_retry: 'Yenidən cəhd et',
  par_offline: 'Oflayn: dəyişikliklər telefonda saxlanılır, internet gələndə hesabına sinxronlaşacaq.',

  // Search
  par_search_label: 'Tərbiyədə axtar',
  par_search_placeholder: 'Axtar: isterika, yuxu, ekran…',
  par_search_clear: 'Axtarışı təmizlə',
  par_search_results: '{n} nəticə',
  par_search_empty: 'Heç nə tapılmadı. Başqa sözlə yoxla.',
  par_search_sos: 'SOS kartları',
  par_search_articles: 'Məqalələr',
  par_search_programmes: 'Proqramlar',

  // Programme pause and reminders
  par_prog_pause: 'Fasilə ver',
  par_prog_resume: 'Davam et',
  par_prog_paused: 'Proqram fasilədədir. Hazır olanda davam et.',
  par_reminder_title: 'Gündəlik xatırlatma',
  par_reminder_text: 'Günün addımını hər gün seçdiyin saatda xatırladaq.',
  par_reminder_time: 'Saat',
  par_reminder_premium: 'Xatırlatmalar Premium ilə',
  par_reminder_paused: 'Proqram fasilədədir — xatırlatma göndərilmir.',
  par_notif_title: 'Tərbiyə · {programme}',
  par_notif_body: 'Gün {n}: {task}',

  // Anacan.AI suggestion and partner entry
  par_ai_kind_sos: 'Tərbiyə · SOS kartı',
  par_ai_kind_article: 'Tərbiyə · Məqalə',
  par_ai_text: 'Bu mövzuda addım-addım bələdçi',
  par_ai_open: 'Aç',
  par_partner_sub: 'Uşağın yaşına görə bələdçi və SOS',

  // Several children, first-run intro, quiz back, programme summary
  par_child_switch: 'Uşağı seç',
  par_intro_skip: 'Keç',
  par_intro_next: 'Növbəti',
  par_intro_start: 'Başla',
  par_intro_step: 'Addım {n}/{total}',
  par_intro_title_1: 'Yaşa görə bələdçi',
  par_intro_text_1: 'Uşağının yaşında beyində nə baş verir, ona nə lazımdır və hər gün üçün qısa məsləhət.',
  par_intro_title_2: 'Çətin anlar üçün SOS',
  par_intro_text_2: 'İsterika, vurma, yatmaq istəməmək kimi anlarda 3 sakit addım və deyə biləcəyin sözlər.',
  par_intro_title_3: 'Qısa proqramlar və testlər',
  par_intro_text_3: 'Hər gün bir kiçik addımla qısa proqramlar, tərbiyə üslubu testi və inkişaf yoxlaması.',
  par_intro_band_title: 'Uşağın neçə yaşındadır?',
  par_intro_band_text: 'Məsləhətləri bu yaşa uyğunlaşdıraq. Sonra istənilən vaxt dəyişə bilərsən.',
  par_quiz_prev: 'Əvvəlki sual',
  par_prog_summary_days: '{n} gün tamamlandı',
  par_prog_next_title: 'Növbəti üçün təklif',
  par_prog_next_open: 'Proqrama bax',
} as const;

export type ParentingKey = keyof typeof PARENTING_COPY;

/** Translated UI string of the parenting tool (tr with the Azerbaijani source as fallback). */
export const pt = (key: ParentingKey): string => tr(key, PARENTING_COPY[key]);

/** Translated template with {placeholders} filled. */
export const pf = (key: ParentingKey, values: Record<string, unknown>): string => formatTr(key, PARENTING_COPY[key], values);

/** Age band label key. */
export const bandKey = (band: string) => `par_band_${band.replace('-', '_')}` as ParentingKey;
