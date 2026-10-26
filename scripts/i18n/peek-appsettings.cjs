const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  const r = await fetch(`${URL_}/rest/v1/app_settings?select=*&limit=3`, { headers: H });
  console.log('HTTP', r.status);
  const rows = await r.json();
  console.log('columns:', rows[0] ? Object.keys(rows[0]).join(',') : JSON.stringify(rows).slice(0, 200));
  // community_header açarları
  const r2 = await fetch(`${URL_}/rest/v1/app_settings?select=*&or=(setting_key.like.community_header*,key.like.community_header*)`, { headers: H }).catch(() => null);
  if (r2 && r2.ok) console.log('community_header rows:', JSON.stringify(await r2.json()).slice(0, 500));
  else {
    const colName = rows[0] && ('setting_key' in rows[0] ? 'setting_key' : 'key');
    const r3 = await fetch(`${URL_}/rest/v1/app_settings?select=*&${colName}=like.community_header*`, { headers: H });
    console.log('community_header rows:', r3.status, JSON.stringify(await r3.json()).slice(0, 600));
  }
})();
