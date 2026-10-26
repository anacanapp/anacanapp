/**
 * Flow P0 — translation keys (az + en).
 * Run: node scripts/add-flow-p0-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // Adaptiv proqnoz
  flowdashboard_adaptiv_proqnoz: { az: 'Proqnoz son {n} tsiklə əsasən öyrənir · dəqiqlik ±{sd} gün', en: 'Prediction learns from your last {n} cycles · accuracy ±{sd} days' },
  flowdashboard_proqnoz_deqiqlesir: { az: 'Proqnoz dəqiqləşir — period günlərini qeyd etməyə davam edin 📈', en: 'Predictions are calibrating — keep logging your period days 📈' },

  // Servikal maye
  flowdailylogger_servikal_maye: { az: 'Servikal maye', en: 'Cervical mucus' },
  flowdailylogger_fertillik_gostericisi: { az: 'fertillik göstəricisi', en: 'fertility sign' },
  flowdailylogger_mucus_dry: { az: 'Quru', en: 'Dry' },
  flowdailylogger_mucus_sticky: { az: 'Yapışqan', en: 'Sticky' },
  flowdailylogger_mucus_creamy: { az: 'Kremvari', en: 'Creamy' },
  flowdailylogger_mucus_watery: { az: 'Sulu', en: 'Watery' },
  flowdailylogger_mucus_eggwhite: { az: 'Yumurta ağı', en: 'Egg white' },

  // Cinsi əlaqə / libido
  flowdailylogger_cinsi_elaqe: { az: 'Cinsi əlaqə', en: 'Intimacy' },
  flowdailylogger_sex_protected: { az: 'Qorunmalı', en: 'Protected' },
  flowdailylogger_sex_unprotected: { az: 'Qorunmasız', en: 'Unprotected' },
  flowdailylogger_libido: { az: 'Libido', en: 'Sex drive' },

  // PMS default reminder
  useflowreminders_pms_yaxinlasir_ozune_bax: { az: 'PMS dövrü yaxınlaşır — özünə qayğı göstər! ⚡', en: 'PMS is approaching — take care of yourself! ⚡' },
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
