const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  let r = await fetch(URL_ + '/rest/v1/partner_venue_categories?select=*&limit=2', { headers: H });
  console.log('pvc:', r.status, JSON.stringify(await r.json()).slice(0, 500));
  r = await fetch(URL_ + '/rest/v1/affiliate_products?select=id,name&limit=3', { headers: H });
  console.log('affiliate:', r.status, JSON.stringify(await r.json()).slice(0, 200));
})();
