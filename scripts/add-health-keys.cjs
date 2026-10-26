/**
 * Health inteqrasiyası (health_*) + settings sırası — translation keys.
 * Run: node scripts/add-health-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  settingsscreen_health_sync: { az: 'Sağlamlıq inteqrasiyası', en: 'Health integration' },
  settingsscreen_health_sync_desc: { az: 'Apple Health / Health Connect — addım və aktivlik', en: 'Apple Health / Health Connect — steps & activity' },

  health_eyebrow: { az: 'Sağlamlıq inteqrasiyası', en: 'Health integration' },
  health_web_title: { az: 'Yalnız mobil tətbiqdə', en: 'Mobile app only' },
  health_web_desc: { az: 'Sağlamlıq inteqrasiyası iOS və Android tətbiqlərində işləyir.', en: 'Health integration works in the iOS and Android apps.' },
  health_hc_missing: { az: 'Health Connect quraşdırılmayıb', en: 'Health Connect is not installed' },
  health_hc_missing_desc: { az: 'Addım və aktivlik məlumatları üçün Google Health Connect lazımdır.', en: 'Google Health Connect is required for steps and activity data.' },
  health_hc_install: { az: 'Play Store-dan quraşdır', en: 'Install from Play Store' },
  health_connect_title: { az: 'ilə qoşulun', en: '— connect now' },
  health_connect_desc: { az: 'Addım sayı, kalori və məşqləriniz avtomatik görünəcək. Məlumatlar cihazınızda qalır.', en: 'Your steps, calories and workouts will appear automatically. Data stays on your device.' },
  health_connect_btn: { az: 'İndi qoşul', en: 'Connect now' },
  health_connecting: { az: 'Qoşulur...', en: 'Connecting...' },
  health_connected_toast: { az: 'Qoşuldu! 🎉', en: 'Connected! 🎉' },
  health_connected_desc: { az: 'məlumatları oxunur', en: 'data is now being read' },
  health_connect_failed: { az: 'Qoşulmadı', en: 'Connection failed' },
  health_connect_failed_desc: { az: 'İcazələr verilmədi — yenidən cəhd edin', en: 'Permissions were not granted — try again' },
  health_disconnected: { az: 'Əlaqə kəsildi', en: 'Disconnected' },
  health_disconnected_desc: { az: 'İcazələri tam silmək üçün sistem ayarlarından istifadə edin', en: 'Use system settings to fully revoke permissions' },
  health_steps_today: { az: 'Addım (bu gün)', en: 'Steps (today)' },
  health_calories_today: { az: 'Kalori (aktiv)', en: 'Calories (active)' },
  health_workouts_week: { az: 'Məşq (7 gün)', en: 'Workouts (7d)' },
  health_steps_7d: { az: 'Son 7 gün — addımlar', en: 'Last 7 days — steps' },
  health_min: { az: 'dəq', en: 'min' },
  health_open_settings: { az: 'İcazə ayarları', en: 'Permission settings' },
  health_open_settings_desc: { az: 'icazələrini idarə edin', en: 'manage permissions' },
  health_disconnect_btn: { az: 'Əlaqəni kəs', en: 'Disconnect' },
  health_privacy_note: { az: 'Sağlamlıq məlumatlarınız yalnız cihazınızda oxunur — serverlərimizə göndərilmir.', en: 'Your health data is read on-device only — never sent to our servers.' },
  health_wt_walking: { az: 'Gəzinti', en: 'Walking' },
  health_wt_running: { az: 'Qaçış', en: 'Running' },
  health_wt_swimming: { az: 'Üzgüçülük', en: 'Swimming' },
  health_wt_cycling: { az: 'Velosiped', en: 'Cycling' },
  health_wt_workout: { az: 'Məşq', en: 'Workout' },
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
