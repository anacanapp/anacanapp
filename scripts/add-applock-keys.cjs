/**
 * App Lock (Təhlükəsizlik kilidi) — translation keys (az + en).
 * Run: node scripts/add-applock-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  applock_title: { az: 'Tətbiq kilidlidir', en: 'App is locked' },
  applock_subtitle: { az: 'Davam etmək üçün PIN daxil edin', en: 'Enter your PIN to continue' },
  applock_bio_reason: { az: 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin', en: 'Confirm your identity to unlock the app' },
  applock_bio_title: { az: 'Anacan kilidi', en: 'Anacan lock' },
  applock_forgot: { az: 'PIN-i unutmusunuz?', en: 'Forgot your PIN?' },
  applock_forgot_desc: { az: 'Kilid sıfırlanacaq və hesabdan çıxacaqsınız. Yenidən daxil olduqdan sonra PIN təyin edə bilərsiniz.', en: 'The lock will be reset and you\u2019ll be signed out. You can set a new PIN after signing back in.' },
  applock_signout_reset: { az: 'Çıxış et və kilidi sıfırla', en: 'Sign out & reset lock' },
  applock_reset: { az: 'Kilidi sıfırla', en: 'Reset lock' },

  applock_manage_title: { az: 'Tətbiq kilidi', en: 'App lock' },
  applock_create_title: { az: 'Yeni PIN təyin edin', en: 'Set a new PIN' },
  applock_confirm_title: { az: 'PIN-i təkrar daxil edin', en: 'Re-enter your PIN' },
  applock_verify_title: { az: 'Cari PIN-i daxil edin', en: 'Enter current PIN' },
  applock_bio_offer_title: { az: 'Biometrika ilə açılsın?', en: 'Unlock with biometrics?' },
  applock_bio_offer_desc: { az: 'PIN əvəzinə Face ID / barmaq izi ilə daha sürətli açın.', en: 'Unlock faster with Face ID / fingerprint instead of your PIN.' },
  applock_bio_offer_yes: { az: 'Bəli, aktivləşdir', en: 'Yes, enable' },
  applock_bio_offer_no: { az: 'İndi yox', en: 'Not now' },
  applock_bio_row: { az: 'Biometrika ilə aç', en: 'Unlock with biometrics' },
  applock_bio_row_sub: { az: 'Face ID / barmaq izi', en: 'Face ID / fingerprint' },
  applock_change_pin: { az: 'PIN-i dəyiş', en: 'Change PIN' },
  applock_disable: { az: 'Kilidi söndür', en: 'Turn off lock' },
  applock_mismatch: { az: 'PIN-lər uyğun gəlmədi — yenidən cəhd edin', en: 'PINs didn\u2019t match — try again' },
  applock_enabled_toast: { az: 'Kilid aktivləşdirildi 🔒', en: 'Lock enabled 🔒' },
  applock_disabled_toast: { az: 'Kilid söndürüldü', en: 'Lock turned off' },
  applock_status_on: { az: 'Aktiv — PIN ilə qorunur', en: 'Active — protected with PIN' },
  applock_status_off: { az: 'PIN və ya biometrika ilə qoruyun', en: 'Protect with PIN or biometrics' },
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
