import { tr, formatTr } from '@/lib/tr';

/**
 * QayğıCash — every UI string with its Azerbaijani source text (informal "sən").
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys.
 * "QayğıCash" is the brand name and stays untranslated; it is a bonus, never called money or cash.
 */
export const QC_COPY = {
  // Wallet
  qc_balance_ready: 'İstifadəyə hazır balans',
  qc_profile_hint: 'Alışlarından bonus qazan, Premium və sifarişlərdə xərclə.',
  qc_pending_pill: '{amount} gözləmədə',
  qc_expiring_pill: '{amount} 30 günə bitir',
  qc_spend: 'Xərclə',
  qc_stat_available: 'Hazır',
  qc_stat_pending: 'Gözləmədə',
  qc_stat_expiring: '30 günə bitir',
  qc_next_expiry: 'Ən yaxın bitmə tarixi: {date}',
  qc_paused_note: 'Bonus xərcləmək müvəqqəti dayandırılıb. Alışlarından bonus qazanmağa isə davam edirsən.',
  qc_debt_note: 'Qaytarılan alışa görə {amount} bonus borcun var. Növbəti bonuslarından avtomatik çıxılacaq.',
  qc_rules: 'Qaydalar',
  qc_how_title: 'Necə qazanırsan',
  qc_rate_premium_yearly: 'Premium illik',
  qc_rate_premium_monthly: 'Premium aylıq',
  qc_rate_book: 'PDF kitablar',
  qc_rate_cake: 'Tortlar',
  qc_rate_own_shop: 'Anacan brend məhsulları',
  qc_rate_partner: 'Tərəfdaş məhsulları',
  qc_rates_note: 'Bonus ödədiyin məbləğdən hesablanır: çatdırılma, endirim və istifadə etdiyin QayğıCash çıxılır.',
  qc_history_title: 'Tarixçə',
  qc_history_empty: 'Hələ əməliyyat yoxdur. İlk alışından sonra bonusun burada görünəcək.',
  qc_load_error: 'Balansı yükləmək alınmadı.',
  qc_retry: 'Yenidən yoxla',

  // History rows
  qc_hist_earn_premium_yearly: 'Premium illik',
  qc_hist_earn_premium_monthly: 'Premium aylıq',
  qc_hist_earn_book: 'Kitab sifarişi',
  qc_hist_earn_cake: 'Tort sifarişi',
  qc_hist_earn_own_shop: 'Aptek sifarişi',
  qc_hist_earn_adjust: 'Bonus düzəlişi',
  qc_hist_use_aptek: 'Aptek sifarişində istifadə',
  qc_hist_use_cake: 'Tort sifarişində istifadə',
  qc_hist_use_book: 'Kitab sifarişində istifadə',
  qc_hist_use_premium: 'Premium üçün istifadə',
  qc_hist_use_other: 'Sifarişdə istifadə',
  qc_status_pending: 'Hazır olur: {date}',
  qc_status_available: 'Hazırdır',
  qc_status_expired: 'Vaxtı bitib',
  qc_status_reversed: 'Ləğv olunub',
  qc_status_used: 'İstifadə olunub',
  qc_status_reserved: 'Sifarişə ayrılıb',
  qc_status_returned: 'Balansa qaytarıldı',
  qc_left: 'Qalıq: {amount}',

  // Rules / FAQ
  qc_faq_what_q: 'QayğıCash nədir?',
  qc_faq_what_a: 'Anacan-da etdiyin alışların bir hissəsi bonus kimi geri qayıdır. 1 bonus = 1 ₼ endirim. Yalnız Anacan-da xərclənir.',
  qc_faq_earn_q: 'Nə qədər qazanıram?',
  qc_faq_earn_a: 'Faizlər yuxarıdakı "Necə qazanırsan" bölməsindədir: Premium, PDF kitablar, tortlar və Anacan brend məhsulları. Tərəfdaş məhsullarında bonus yoxdur.',
  qc_faq_when_q: 'Nə vaxt istifadə edə bilərəm?',
  qc_faq_when_a: 'Fiziki məhsulda çatdırılmadan {physical} gün, rəqəmsal alışda (Premium, kitab) ödənişdən {digital} gün sonra. Bu, qaytarma müddətidir.',
  qc_faq_where_q: 'Harada xərcləyə bilərəm?',
  qc_faq_where_a: 'Anacan Aptek, tortlar və PDF kitablarda. Sifarişin {pct}-inə qədər, minimum {min}. Çatdırılma haqqına tətbiq olunmur.',
  qc_faq_expiry_q: 'Vaxtı bitirmi?',
  qc_faq_expiry_a: 'Hər bonus hazır olduqdan {months} ay sonra bitir. Ödənişdə əvvəlcə vaxtı ən tez bitən bonusu istifadə edirik.',
  qc_faq_cash_q: 'Nağd çıxarmaq olar?',
  qc_faq_cash_a: 'Xeyr. QayğıCash Anacan-da endirim bonusudur: nağdlaşdırılmır, başqasına ötürülmür və karta köçürülmür.',
  qc_faq_refund_q: 'Alışı qaytarsam?',
  qc_faq_refund_a: 'Sifariş ləğv olunsa və ya qaytarılsa, ondan qazandığın bonus da ləğv olunur. Artıq xərcləmisənsə, fərq növbəti bonuslarından çıxılır.',
  qc_faq_delete_q: 'Hesabı silsəm?',
  qc_faq_delete_a: 'Hesabını silsən, bonus balansın da silinir və bərpa olunmur.',
  qc_terms_version: 'Qaydalar, versiya {n}',

  // Home and profile
  qc_home_balance: 'QayğıCash balansın',
  qc_home_pending: 'gözləmədə',
  qc_intro_badge: 'Yeni',
  qc_intro_title: 'Alışlarından bonus qazan',
  qc_intro_text: 'Premium, tort, PDF kitab və Anacan brend məhsulları alanda ödədiyinin bir hissəsi QayğıCash bonusu kimi geri qayıdır.',
  qc_intro_cta: 'Necə işləyir?',
  qc_close: 'Bağla',
  qc_profile_sub: '{amount} istifadəyə hazır',

  // Badges and checkout
  qc_badge: '+{amount} · {pct} QayğıCash',
  qc_line_bonus: '+{amount} bonus',
  qc_no_bonus: 'bonus yoxdur',
  qc_use: 'QayğıCash istifadə et',
  qc_use_sub: 'Balans {balance} · bu sifarişdə maks. {max}',
  qc_order_too_small: 'Bonus istifadə etmək üçün sifariş bir az böyük olmalıdır (minimum {min}).',
  qc_amount_label: 'İstifadə olunan bonus',
  qc_earn_box: 'Bu sifarişdən {amount} QayğıCash qazanacaqsan.',
  qc_earn_when_physical: 'Çatdırılmadan {n} gün sonra hazır olur.',
  qc_earn_when_digital: 'Ödənişdən {n} gün sonra hazır olur.',

  // After the order
  qc_success_earn: 'Bu sifarişdən {amount} QayğıCash qazanırsan',
  qc_success_date: 'Təxminən {date} tarixindən istifadə edə bilərsən.',
  qc_success_used: 'Bu sifarişdə {amount} QayğıCash istifadə etdin.',
  qc_view_balance: 'Balansa bax',
  qc_cake_not_applied: 'Sifarişin qəbul olundu, amma bonus bu dəfə tətbiq olunmadı. Balansına toxunulmayıb.',

  // Errors
  qc_err_insufficient: 'Balansında kifayət qədər hazır bonus yoxdur.',
  qc_err_above_max: 'Bu sifarişdə bu qədər bonus istifadə etmək olmur.',
  qc_err_below_min: 'Bonus məbləği minimumdan azdır.',
  qc_err_channel_closed: 'Bu bölmədə bonus hələlik istifadə olunmur.',
  qc_err_paused: 'Bonus xərcləmək müvəqqəti dayandırılıb.',
  qc_err_not_available: 'QayğıCash hesabında əlçatan deyil.',
  qc_err_already_applied: 'Bu sifarişə bonus artıq tətbiq olunub.',
  qc_err_order_not_eligible: 'Bu sifarişə artıq bonus tətbiq etmək olmur.',
  qc_err_premium_closed: 'Premium-u bonusla almaq hazırda mümkün deyil.',
  qc_err_store_subscription: 'App Store və ya Google Play-də aktiv Premium abunəliyin var, ona görə bonusla almaq olmur.',
  qc_err_generic: 'Bonus tətbiq olunmadı. Bir az sonra yenidən yoxla.',

  // Premium
  qc_prem_earn: '+{amount} QayğıCash',
  qc_prem_earn_renewal: 'Hər yenilənmədə +{amount} QayğıCash',
  qc_prem_pay: 'QayğıCash ilə ödə ({amount})',
  qc_prem_pay_need: 'Bunun üçün {amount} hazır balans lazımdır.',
  qc_prem_title: 'Premium-u bonusla al',
  qc_prem_plan_monthly: '1 ay Premium',
  qc_prem_plan_yearly: '1 il Premium',
  qc_prem_confirm_title: 'Bonusla ödəyək?',
  qc_prem_confirm_text: 'Balansından {amount} çıxılacaq və {plan} aktivləşəcək. Avtomatik yenilənmir.',
  qc_prem_confirm: 'Təsdiqlə',
  qc_cancel: 'Ləğv et',
  qc_prem_success: 'Premium aktivdir: {date} tarixinə qədər.',
} as const;

export type QcKey = keyof typeof QC_COPY;

/** Static copy for a key. */
export const qt = (key: QcKey): string => tr(key, QC_COPY[key]);
/** Copy with {placeholders} filled in. */
export const qf = (key: QcKey, values: Record<string, string | number>): string => formatTr(key, QC_COPY[key], values);
/** Copy for a computed key (history titles, statuses, errors); unknown keys fall back to the generic text. */
export const qk = (key: string, values?: Record<string, string | number>): string => {
  const k = (key in QC_COPY ? key : 'qc_err_generic') as QcKey;
  return values ? qf(k, values) : qt(k);
};
