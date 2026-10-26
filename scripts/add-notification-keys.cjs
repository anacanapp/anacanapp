/**
 * Adds/repairs notification translation keys:
 *  - the new once-daily water reminder copy
 *  - the previously missing vitamin reminder body
 * Run: node scripts/add-notification-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  notifications_water_daily_title: {
    az: 'Su vaxtı! 💧',
    en: 'Water time! 💧',
  },
  notifications_water_daily_body: {
    az: 'Gündə ən azı 8 stəkan su içməyi unutmayın.',
    en: 'Don\u2019t forget to drink at least 8 glasses of water a day.',
  },
  usenotificationsettings_gundelik_vitaminlerinizi_qebul_6a3811: {
    az: 'Gündəlik vitaminlərinizi qəbul etməyi unutmayın.',
    en: 'Don\u2019t forget to take your daily vitamins.',
  },
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
