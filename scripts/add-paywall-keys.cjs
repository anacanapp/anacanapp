/**
 * Custom Paywall (pw_*, dps_*) — translation keys.
 * Run: node scripts/add-paywall-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // ── PaywallCore ──
  pw_feat_ai: { az: 'Limitsiz Dr. Anacan AI', en: 'Unlimited Dr. Anacan AI' },
  pw_feat_tools: { az: 'Bütün alətlərə tam giriş', en: 'Full access to all tools' },
  pw_feat_reports: { az: 'Həkim üçün PDF hesabatlar', en: 'PDF reports for your doctor' },
  pw_feat_household: { az: 'Partnyorla ortaq Premium', en: 'Shared Premium with partner' },
  pw_feat_sounds: { az: 'Yuxu səsləri və meditasiya', en: 'Sleep sounds & meditation' },
  pw_feat_noads: { az: 'Tam reklamsız təcrübə', en: 'Completely ad-free experience' },
  pw_web_title: { az: 'Premium mobil tətbiqdədir', en: 'Premium is in the mobile app' },
  pw_no_product: { az: 'Məhsul tapılmadı', en: 'Product not found' },
  pw_no_product_desc: { az: 'Bir az sonra yenidən cəhd edin', en: 'Please try again in a moment' },
  pw_success_title: { az: 'Premium aktivləşdirildi! 🎉', en: 'Premium activated! 🎉' },
  pw_success_desc: { az: 'Bütün imkanlar açıldı — xoş istifadələr!', en: 'Everything is unlocked — enjoy!' },
  pw_restored: { az: 'Alışlar bərpa edildi ✓', en: 'Purchases restored ✓' },
  pw_restored_desc: { az: 'Premium abunəliyiniz aktivdir', en: 'Your Premium subscription is active' },
  pw_restore_none: { az: 'Alış tapılmadı', en: 'No purchase found' },
  pw_restore_none_desc: { az: 'Bu hesabla bağlı əvvəlki abunəlik yoxdur', en: 'No previous subscription linked to this account' },
  pw_cta_trial: { az: '{days} gün pulsuz başla', en: 'Start {days} days free' },
  pw_trial_chip: { az: '{days} GÜN PULSUZ', en: '{days} DAYS FREE' },
  pw_social_proof: { az: '10,000+ Azərbaycanlı ana bizi seçib', en: '10,000+ moms already chose us' },
  pw_loading_prices: { az: 'Qiymətlər yüklənir...', en: 'Loading prices...' },
  pw_billed_yearly: { az: 'ildə bir dəfə ödənilir', en: 'billed once a year' },
  pw_flexible: { az: 'Çevik — istənilən ay dayandır', en: 'Flexible — stop any month' },
  pw_lifetime: { az: 'Ömürlük', en: 'Lifetime' },
  pw_lifetime_sub: { az: 'Bir dəfə ödə — həmişəlik sənin', en: 'Pay once — yours forever' },
  pw_close: { az: 'Bağla', en: 'Close' },
  pw_funnel_subtitle: { az: 'Fərdi planınız hazırdır — tam imkanlarla başlayın', en: 'Your personal plan is ready — start with full access' },

  // ── DiscountedPaywallStep ──
  dps_wait: { az: 'Bir dəqiqə! 🎀', en: 'Wait! 🎀' },
  dps_special_offer: { az: 'Xüsusi təklif — yalnız sizin üçün', en: 'A special offer — just for you' },
  dps_try_free: { az: 'Premium-u {days} gün tamamilə pulsuz sınayın', en: 'Try Premium completely free for {days} days' },
  dps_once_only: { az: 'BU TƏKLİF YALNIZ 1 DƏFƏ GÖSTƏRİLİR', en: 'THIS OFFER IS SHOWN ONLY ONCE' },
  dps_free_premium: { az: '{days} Gün Pulsuz Premium', en: '{days} Days Free Premium' },
  dps_full_access: { az: 'Bütün funksiyalara tam giriş. Bəyənməsəniz, heç bir ödəniş tutulmur.', en: 'Full access to everything. If you don\u2019t love it, you pay nothing.' },
  dps_then_price: { az: 'Sonra {price}/il.', en: 'Then {price}/year.' },
  dps_start_free: { az: 'Pulsuz Başla', en: 'Start Free' },
  dps_cancel_anytime: { az: 'İstənilən vaxt ləğv edin — sual verilmir', en: 'Cancel anytime — no questions asked' },
  dps_no_thanks: { az: 'Xeyr, pulsuz davam edirəm', en: 'No, continue with free' },
  dps_trial_started: { az: '{days} günlük pulsuz dövrünüz başladı', en: 'Your {days}-day free trial has started' },
  dps_purchase_failed: { az: 'Alış uğursuz', en: 'Purchase failed' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  let updated = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {
      json[key] = values[lang];
      added++;
    } else if (json[key] !== values[lang]) {
      json[key] = values[lang];
      updated++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${added} added, ${updated} updated (${Object.keys(json).length} total)`);
}
