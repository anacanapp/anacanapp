// Canlı DB diff: translations-da hər hansı dildə olub kk-da OLMAYAN açarlar
// + app_settings string dəyərləri (dinamik tr(key, value) aileləri üçün).
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };

  async function fetchKeys(lang) {
    const keys = new Set();
    for (let off = 0; ; off += 1000) {
      const r = await fetch(`${URL_}/rest/v1/translations?select=key&lang=eq.${lang}&order=key.asc&limit=1000&offset=${off}`, { headers: H });
      if (!r.ok) { console.log(lang, 'HTTP', r.status); break; }
      const rows = await r.json();
      rows.forEach((x) => keys.add(x.key));
      if (rows.length < 1000) break;
    }
    return keys;
  }

  const [az, en, ru, trr, kk] = await Promise.all(['az', 'en', 'ru', 'tr', 'kk'].map(fetchKeys));
  console.log(`DB translations: az=${az.size} en=${en.size} ru=${ru.size} tr=${trr.size} kk=${kk.size}`);

  const anyLang = new Set([...az, ...en, ...ru, ...trr]);
  const missingKk = [...anyLang].filter((k) => !kk.has(k)).sort();
  console.log(`kk-da OLMAYAN (DB-də başqa dildə var): ${missingKk.length}`);
  missingKk.slice(0, 60).forEach((k) => console.log('  ', k));

  // AZ dəyərlərini götür (tərcümə mənbəyi) — missing üçün
  const azVals = {};
  for (let i = 0; i < missingKk.length; i += 80) {
    const slice = missingKk.slice(i, i + 80);
    const inList = slice.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
    const r = await fetch(`${URL_}/rest/v1/translations?select=key,value,lang&key=in.(${encodeURIComponent(slice.join(','))})`, { headers: H });
    if (!r.ok) { console.log('val fetch HTTP', r.status, (await r.text()).slice(0, 120)); continue; }
    const rows = await r.json();
    for (const row of rows) {
      azVals[row.key] = azVals[row.key] || {};
      azVals[row.key][row.lang] = row.value;
    }
  }
  fs.writeFileSync('scripts/i18n/kk-db-missing.json', JSON.stringify({ missingKk, values: azVals }, null, 1));
  console.log('→ scripts/i18n/kk-db-missing.json');

  // app_settings string dəyərləri
  const r2 = await fetch(`${URL_}/rest/v1/app_settings?select=setting_key,setting_value&limit=500`, { headers: H });
  if (r2.ok) {
    const rows = await r2.json();
    const strRows = rows.filter((x) => {
      const v = x.setting_value;
      return typeof v === 'string' && v.length > 2 && !/^[\d.]+$/.test(v) && !v.startsWith('{') && !v.startsWith('[');
    });
    console.log(`\napp_settings string dəyərlər: ${strRows.length}`);
    strRows.forEach((x) => console.log(`   ${x.setting_key} = ${JSON.stringify(String(x.setting_value)).slice(0, 80)}`));
    fs.writeFileSync('scripts/i18n/app-settings-strings.json', JSON.stringify(strRows, null, 1));
  } else {
    console.log('app_settings HTTP', r2.status);
  }
})();
