import { formatTr, tr } from '@/lib/tr';

/**
 * In-app Epoint card payment for Premium: every UI string with its Azerbaijani source text (informal "sən").
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys
 * (all 25 app languages, checked by in-app-epoint-copy.test.ts). "Epoint", "Premium", "Anacan", "App Store" and
 * "Google Play" are names and stay untranslated.
 */
export const IEP_COPY = {
  iep_pay_title: 'Azərbaycan kartı ilə ödə (Epoint)',
  iep_price_monthly: '{price} / ay',
  iep_price_yearly: '{price} / il',
  iep_campaign: 'Kampaniya qiyməti',
  iep_consent_monthly: 'Ödənişə keçməklə abunəliyin hər ay avtomatik yenilənməsinə və kartının bu ödənişlər üçün yadda saxlanmasına razılıq verirsən. İstənilən vaxt ləğv edə bilərsən.',
  iep_consent_yearly: 'Ödənişə keçməklə abunəliyin hər il avtomatik yenilənməsinə və kartının bu ödənişlər üçün yadda saxlanmasına razılıq verirsən. İstənilən vaxt ləğv edə bilərsən.',
  iep_legal: 'Ödəniş Epoint-in təhlükəsiz səhifəsində aparılır, kart məlumatların Anacan-da saxlanılmır. Abunəliyi anacan.az saytındakı hesab səhifəsində idarə edə bilərsən.',
  iep_opening: 'Ödəniş səhifəsi açılır...',
  iep_checking: 'Ödəniş yoxlanılır...',
  iep_success: 'Premium aktivləşdi. Təşəkkür edirik!',
  iep_timeout: 'Ödəniş hələ təsdiqlənməyib. Ödəniş etmisənsə, bir neçə dəqiqə sonra yenidən yoxla.',
  iep_check_again: 'Yenidən yoxla',
  iep_err_premium_active: 'Sənin artıq aktiv Premium abunəliyin var.',
  iep_err_premium_store: 'Premium artıq App Store və ya Google Play abunəliyi ilə aktivdir. Kartla ayrıca ödəmək lazım deyil.',
  iep_err_payments_unavailable: 'Kartla ödəniş müvəqqəti əlçatan deyil. Bir az sonra yenidən yoxla.',
  iep_err_too_many_attempts: 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
  iep_err_checkout_unavailable: 'Ödəniş səhifəsi açılmadı. Yenidən yoxla.',
  iep_err_generic: 'Xəta baş verdi. Yenidən yoxla.',
} as const;

export type IepKey = keyof typeof IEP_COPY;

export const iepText = (key: IepKey): string => tr(key, IEP_COPY[key]);
export const iepFormat = (key: IepKey, values: Record<string, string | number>): string => formatTr(key, IEP_COPY[key], values);
