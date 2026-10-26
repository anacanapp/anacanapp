// Paywall diaqnozu: app_settings configlər + pw_*/usepaywallconfig_* açarlarının dil əhatəsi
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };

  for (const k of ['premium_paywall_config', 'billing_page_config']) {
    const r = await fetch(`${URL_}/rest/v1/app_settings?select=key,value&key=eq.${k}`, { headers: H });
    const rows = await r.json();
    console.log(`app_settings[${k}]:`, r.status, rows.length ? JSON.stringify(rows[0].value).slice(0, 400) : 'YOXDUR/RLS');
  }

  const sampleKeys = ['pw_billed_yearly', 'pw_flexible', 'pw_cta_trial', 'pw_social_proof', 'usepaywallconfig_illik', 'usepaywallconfig_ayliq_6f265e', 'usepaywallconfig_tam_tecrube_sinirsiz_imkanlar_ce3376', 'usepaywallconfig_reklamsiz_cc4ba5', 'common_limitsiz', 'usepaywallconfig_3_gun_pulsuz_9e6197', 'usepaywallconfig_days_gun_pulsuz_sinayin_sonra__fa9bb5', 'usepaywallconfig_i_stenilen_vaxt_legv_ede_biler_cc073d'];
  const r2 = await fetch(`${URL_}/rest/v1/translations?select=key,lang&key=in.(${encodeURIComponent(sampleKeys.join(','))})`, { headers: H });
  const rows2 = await r2.json();
  const byKey = {};
  for (const row of rows2) { (byKey[row.key] = byKey[row.key] || []).push(row.lang); }
  console.log('\nAçar → mövcud dillər:');
  for (const k of sampleKeys) console.log(' ', k, '→', (byKey[k] || []).sort().join(',') || 'HEÇ BİRİ');
})();
