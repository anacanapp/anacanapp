/**
 * C-paketi: WHO percentil + win-back + referral + health write — translation keys.
 * Run: node scripts/add-product-c-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // WHO
  who_curves_title: { az: 'WHO inkişaf əyriləri', en: 'WHO growth curves' },
  who_normal: { az: 'normal', en: 'normal' },
  who_watch: { az: 'izləyin', en: 'monitor' },
  who_alert: { az: 'həkimlə danışın', en: 'talk to your doctor' },
  who_weight: { az: 'Çəki (kq)', en: 'Weight (kg)' },
  who_height: { az: 'Boy (sm)', en: 'Height (cm)' },
  who_month_short: { az: 'ay', en: 'mo' },
  who_median: { az: 'P50 (median)', en: 'P50 (median)' },
  who_child: { az: 'Körpəniz', en: 'Your baby' },
  who_explainer: { az: 'Yaşıl xətt — WHO medianı (P50). P15-P85 arası tam normaldır; P3-dən aşağı və ya P97-dən yuxarıdırsa pediatrla məsləhətləşin.', en: 'Green line — WHO median (P50). P15-P85 is fully normal; below P3 or above P97 — consult your pediatrician.' },

  // Win-back
  winback_cancelled_title: { az: 'Sizi itirmək istəmirik 💛', en: 'We don\u2019t want to lose you 💛' },
  winback_expired_title: { az: 'Premium-suz darıxdıq 💛', en: 'We missed you on Premium 💛' },
  winback_cancelled_text: { az: 'Abunəliyiniz ləğv edilib. Fikrinizi dəyişsəniz, bütün imkanlar bir toxunuş uzağındadır.', en: 'Your subscription is cancelled. If you change your mind, everything is one tap away.' },
  winback_expired_text: { az: 'AI bələdçi, hesabatlar və bütün alətlər sizi gözləyir — 3 gün pulsuz yenidən sınayın.', en: 'AI guide, reports and all tools are waiting — try again free for 3 days.' },
  winback_banner_cta: { az: '3 gün pulsuz geri qayıdın', en: 'Come back — 3 days free' },
  winback_cta: { az: 'Yenidən qoşul — 3 gün pulsuz', en: 'Rejoin — 3 days free' },
  winback_dismiss: { az: 'Bağla', en: 'Dismiss' },

  // Referral
  profilescreen_referral: { az: 'Dostunu dəvət et', en: 'Invite a friend' },
  profilescreen_referral_badge: { az: '+7 gün', en: '+7 days' },
  ref_eyebrow: { az: 'Referral proqramı', en: 'Referral program' },
  ref_title: { az: 'Dostunu dəvət et', en: 'Invite a friend' },
  ref_code_sub: { az: 'Sənin dəvət kodun — paylaş, ikiniz də qazanın', en: 'Your invite code — share it, you both win' },
  ref_code_unavailable: { az: 'Kod hazırlanır — bir azdan yenidən baxın', en: 'Code is being prepared — check back soon' },
  ref_share_btn: { az: 'Kodu paylaş', en: 'Share code' },
  ref_share_text: { az: 'Anacan tətbiqinə qoşul! Mənim dəvət kodum: {code} — daxil et, ikimiz də 7 gün pulsuz Premium qazanaq 💛', en: 'Join me on Anacan! My invite code: {code} — enter it and we both get 7 days of free Premium 💛' },
  ref_copied_full: { az: 'Dəvət mətni kopyalandı ✓', en: 'Invite text copied ✓' },
  ref_invited: { az: 'Dəvət edilən', en: 'Invited' },
  ref_earned_days: { az: 'Qazanılan gün', en: 'Days earned' },
  ref_step1: { az: 'Kodunu dostlarına göndər', en: 'Send your code to friends' },
  ref_step2: { az: 'Dostun tətbiqi yükləyib kodu daxil edir', en: 'Your friend installs the app and enters the code' },
  ref_step3: { az: 'İkiniz də 7 gün pulsuz Premium qazanırsınız', en: 'You both get 7 days of free Premium' },
  ref_have_code: { az: 'Dəvət kodun var?', en: 'Have an invite code?' },
  ref_redeem_btn: { az: 'Tətbiq et', en: 'Redeem' },
  ref_redeem_success: { az: 'Təbriklər! 🎉', en: 'Congrats! 🎉' },
  ref_redeem_success_desc: { az: '{days} gün Premium hesabınıza əlavə olundu', en: '{days} days of Premium added to your account' },
  ref_redeem_failed: { az: 'Alınmadı', en: 'Failed' },
  ref_err_own: { az: 'Öz kodunuzu istifadə edə bilməzsiniz', en: 'You can\u2019t use your own code' },
  ref_err_already: { az: 'Artıq bir dəvət kodu istifadə etmisiniz', en: 'You have already redeemed a code' },
  ref_err_invalid: { az: 'Kod tapılmadı — yoxlayıb yenidən yazın', en: 'Code not found — check and try again' },
  ref_err_generic: { az: 'Xəta baş verdi — yenidən cəhd edin', en: 'Something went wrong — try again' },
  ref_terms: { az: 'Hər hesab yalnız 1 dəvət kodu istifadə edə bilər. Bonus günlər mövcud Premium müddətinin üstünə əlavə olunur.', en: 'Each account can redeem only one code. Bonus days stack on top of existing Premium.' },

  // Health write
  hc_write_title: { az: 'Tsikli Health-ə yaz', en: 'Write cycle to Health' },
  hc_write_desc: { az: 'Period qeydləriniz avtomatik Apple Health / Health Connect-ə əlavə olunur', en: 'Your period logs are automatically added to Apple Health / Health Connect' },
  hc_write_on: { az: 'Aktiv edildi ✓', en: 'Enabled ✓' },
  hc_write_on_desc: { az: 'Period qeydləri bundan sonra Health-ə yazılacaq', en: 'Period logs will now be written to Health' },
  hc_write_denied: { az: 'İcazə verilmədi', en: 'Permission denied' },
  hc_write_denied_desc: { az: 'Sistem ayarlarından icazə verə bilərsiniz', en: 'You can grant it from system settings' },
  hc_write_unavailable: { az: 'Mövcud deyil', en: 'Unavailable' },
  hc_write_unavailable_desc: { az: 'Yazma üçün tətbiqin yeni native build-i lazımdır', en: 'Writing requires the latest native build of the app' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {json[key] = values[lang];added++;}
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: +${added} (${Object.keys(json).length} total)`);
}
