// kk audit probe: epds options strukturu, banners sütunları, aktiv banner sayı
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };

  let r = await fetch(URL_ + '/rest/v1/epds_questions?select=options&limit=1', { headers: H });
  const epds = await r.json();
  console.log('EPDS options[0]:', JSON.stringify(epds?.[0]?.options?.[0] || null));

  r = await fetch(URL_ + '/rest/v1/banners?select=*&limit=1', { headers: H });
  const banners = await r.json();
  console.log('banners HTTP', r.status, 'sütunlar:', banners?.[0] ? Object.keys(banners[0]).join(',') : JSON.stringify(banners).slice(0, 200));

  r = await fetch(URL_ + '/rest/v1/banners?select=id&is_active=eq.true', { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log('aktiv banner sayı:', r.headers.get('content-range'));

  // kk UI açarlarının DB-də olub-olmadığını yoxla (Qazax2 tətbiq statusu)
  r = await fetch(URL_ + '/rest/v1/translations?select=key&lang=eq.kk', { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log('DB-də kk translations sayı:', r.headers.get('content-range'));

  // app_languages kk statusu
  r = await fetch(URL_ + '/rest/v1/app_languages?select=code,is_active,native_name', { headers: H });
  console.log('app_languages:', JSON.stringify(await r.json()));
})();
