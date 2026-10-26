/**
 * Adds the translation keys introduced by the anacan-demo redesign
 * (mommy dashboard) to the bundled locale files.
 * Run: node scripts/add-anacan-redesign-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  mommy_hero_day_label: { az: 'Gün', en: 'Day' },
  mommy_hero_headline: { az: '{days} gündür {name} böyüyür', en: '{days} days of watching {name} grow' },
  mommy_meta_months: { az: 'ay', en: 'mo' },
  mommy_meta_days: { az: 'gün', en: 'days' },
  dashboard_daily_badge: { az: 'Gündəlik', en: 'Daily' },
  mommy_cta_title: { az: 'Yalnız sənin üçün kiçik bir qeyd', en: 'A little note, just for you' },
  mommy_log_today_title: { az: 'Bu günü qeyd et', en: 'Log today' },
  mommy_log_today_hint: { az: 'Toxun və əlavə et', en: 'Tap to add' },
  mommy_this_week: { az: 'Bu həftə', en: 'This week' },
  waterwidget_glass_unit: { az: 'stəkan', en: 'glasses' },
  mommy_daily_goal: { az: 'günlük hədəf', en: "today's goal" },
  waterwidget_hint: { az: 'Ana üçün su balansı süd istehsalına dəstəkdir', en: 'Staying hydrated supports milk production' },
  waterwidget_add_glass: { az: '1 stəkan əlavə et', en: 'Add 1 glass' },
  mommy_growth_empty: { az: 'Qrafik üçün ən azı 2 ölçü lazımdır', en: 'At least 2 measurements are needed for the chart' },
  mommy_growth_no_entries: { az: 'Hələ ölçü qeyd edilməyib', en: 'No measurements yet' },
  flow_cycle_alert: { az: 'Tsikl xəbərdarlığı', en: 'Cycle alert' },
  flowmoodchart_son_90_gun: { az: 'Son 90 gün', en: 'Last 90 days' },
  flowdailylogger_doldurulub: { az: 'Doldurulub', en: 'Logged' },
  toolshub_open_btn: { az: 'Aç', en: 'Open' },
  toolshub_netice: { az: 'nəticə', en: 'results' },
  storiesbar_sizin: { az: 'Sizin', en: 'Your story' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {
      json[key] = values[lang];
      added++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${added} keys added (${Object.keys(json).length} total)`);
}
