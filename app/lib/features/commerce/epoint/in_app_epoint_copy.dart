// Ported from: src/lib/in-app-epoint-copy.ts
//
// In-app Epoint card payment for Premium: every UI string with its Azerbaijani source text (informal "sən").
// "Epoint", "Premium", "Anacan", "App Store" and "Google Play" are names and stay untranslated.
import '../../../core/i18n/i18n.dart';

const Map<String, String> kIepCopy = {
  'iep_pay_title': 'Azərbaycan kartı ilə ödə (Epoint)',
  'iep_price_monthly': '{price} / ay',
  'iep_price_yearly': '{price} / il',
  'iep_campaign': 'Kampaniya qiyməti',
  'iep_consent_monthly': 'Ödənişə keçməklə abunəliyin hər ay avtomatik yenilənməsinə və kartının bu ödənişlər üçün yadda saxlanmasına razılıq verirsən. İstənilən vaxt ləğv edə bilərsən.',
  'iep_consent_yearly': 'Ödənişə keçməklə abunəliyin hər il avtomatik yenilənməsinə və kartının bu ödənişlər üçün yadda saxlanmasına razılıq verirsən. İstənilən vaxt ləğv edə bilərsən.',
  'iep_legal': 'Ödəniş Epoint-in təhlükəsiz səhifəsində aparılır, kart məlumatların Anacan-da saxlanılmır. Abunəliyi anacan.az saytındakı hesab səhifəsində idarə edə bilərsən.',
  'iep_opening': 'Ödəniş səhifəsi açılır...',
  'iep_checking': 'Ödəniş yoxlanılır...',
  'iep_success': 'Premium aktivləşdi. Təşəkkür edirik!',
  'iep_timeout': 'Ödəniş hələ təsdiqlənməyib. Ödəniş etmisənsə, bir neçə dəqiqə sonra yenidən yoxla.',
  'iep_check_again': 'Yenidən yoxla',
  'iep_err_premium_active': 'Sənin artıq aktiv Premium abunəliyin var.',
  'iep_err_premium_store': 'Premium artıq App Store və ya Google Play abunəliyi ilə aktivdir. Kartla ayrıca ödəmək lazım deyil.',
  'iep_err_payments_unavailable': 'Kartla ödəniş müvəqqəti əlçatan deyil. Bir az sonra yenidən yoxla.',
  'iep_err_too_many_attempts': 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
  'iep_err_checkout_unavailable': 'Ödəniş səhifəsi açılmadı. Yenidən yoxla.',
  'iep_err_generic': 'Xəta baş verdi. Yenidən yoxla.',
};

String iepText(String key) => tr(key, kIepCopy[key] ?? key);
String iepFormat(String key, Map<String, Object?> values) => formatTr(key, kIepCopy[key] ?? key, values);
