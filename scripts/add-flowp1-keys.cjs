/**
 * Flow P1 (OPK + fertil pəncərə) + WeightTracker qrafik + Partner tur — translation keys.
 * Run: node scripts/add-flowp1-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // ── FlowDailyLogger: OPK ──
  flowdailylogger_ovulyasiya_testi: { az: 'Ovulyasiya testi', en: 'Ovulation test' },
  flowdailylogger_opk_negative: { az: 'Mənfi', en: 'Negative' },
  flowdailylogger_opk_positive: { az: 'Müsbət', en: 'Positive' },
  flowdailylogger_opk_peak: { az: 'Pik', en: 'Peak' },
  flowdailylogger_opk_positive_hint: { az: '➕ LH yüksəlişi — ovulyasiya 24-36 saat ərzində gözlənilir', en: '➕ LH surge — ovulation expected within 24-36 hours' },
  flowdailylogger_opk_peak_hint: { az: '🌟 Pik LH — ovulyasiya təxminən 24 saat ərzində gözlənilir', en: '🌟 Peak LH — ovulation expected within ~24 hours' },

  // ── FlowDashboard: dəqiqləşdirmə çipləri ──
  flowdashboard_test_tesdiqli: { az: '✓ Test təsdiqli', en: '✓ Test-confirmed' },
  flowdashboard_maye_tesdiqli: { az: '💧 Maye təsdiqli', en: '💧 Mucus-confirmed' },
  flowdashboard_pik_lh: { az: '🌟 Pik LH', en: '🌟 Peak LH' },
  flowdashboard_lh_yukselisi: { az: '➕ LH yüksəlişi', en: '➕ LH surge' },
  flowdashboard_maye_siqnali: { az: '💧 Maye siqnalı', en: '💧 Mucus signal' },

  // ── WeightTracker: hamiləlik qrafiki ──
  weighttracker_hamilelik_qrafiki: { az: 'Hamiləlik qrafiki', en: 'Pregnancy chart' },
  weighttracker_tovsiye_zolagi: { az: 'yaşıl = tövsiyə aralığı', en: 'green = recommended range' },
  weighttracker_tovsiye_araligi: { az: 'Tövsiyə aralığı', en: 'Recommended range' },
  weighttracker_cekiniz: { az: 'Çəkiniz', en: 'Your weight' },
  weighttracker_indi_ref: { az: 'indi', en: 'now' },
  weighttracker_qrafik_izah: { az: 'Xətt — çəki qeydləriniz, yaşıl zolaq — həftəyə görə tövsiyə olunan artım aralığı (başlanğıc çəkiyə əsasən).', en: 'Line — your weight entries, green band — recommended gain range by week (based on starting weight).' },

  // ── Partner onboarding turu ──
  ptour_welcome_title: { az: '"Birlikdə"yə xoş gəldiniz!', en: 'Welcome to "Together"!' },
  ptour_welcome_text: { az: 'Bu bölmə sizin üçündür — xanımınızın səyahətində ən böyük dəstəkçisi olun. Qısa tura baxaq?', en: 'This space is for you — be the biggest supporter on your partner\u2019s journey. Ready for a quick tour?' },
  ptour_home_title: { az: '"Bu gün" ekranı', en: 'The "Today" screen' },
  ptour_home_text: { az: 'Körpənin həftəlik inkişafı, xanımınızın əhvalı və sürətli sevgi mesajları — hamısı ana ekranda.', en: 'Baby\u2019s weekly development, your partner\u2019s mood and quick love messages — all on the home screen.' },
  ptour_together_title: { az: '"Birlikdə" bölməsi', en: 'The "Together" tab' },
  ptour_together_text: { az: 'Gündəlik missiyalar, aktivlik lenti, alış-veriş siyahısı və həkim görüşləri — birgə idarə edin, xal qazanın.', en: 'Daily missions, activity feed, shopping list and doctor appointments — manage together, earn points.' },
  ptour_sos_title: { az: 'SOS siqnalları', en: 'SOS alerts' },
  ptour_sos_text: { az: 'Xanımınız təcili kömək və ya doğuş siqnalı göndərsə, telefonunuza dərhal bildiriş gələcək. Sancı rejimində canlı izləyə bilərsiniz.', en: 'If your partner sends an emergency or labor alert, you\u2019ll get an instant notification. During contractions you can follow along live.' },
  ptour_privacy_title: { az: 'Məxfilik və Premium', en: 'Privacy & Premium' },
  ptour_privacy_text: { az: 'Nəyin paylaşılacağını xanımınız özü seçir. Premium isə ailəvidir — biri alsa, hər ikiniz istifadə edirsiniz.', en: 'Your partner decides what is shared. Premium is a household plan — if one of you subscribes, you both get it.' },
  ptour_skip: { az: 'Keç', en: 'Skip' },
  ptour_next: { az: 'Növbəti', en: 'Next' },
  ptour_done: { az: 'Başlayaq! 💙', en: 'Let\u2019s go! 💙' },
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
