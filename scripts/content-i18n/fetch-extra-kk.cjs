// Qazax inteqrasiyası üçün çatışmayan chunk-ları çəkir (diaq signup token ilə).
// premium_features, partner_venue_categories, multiples_options, scheduled_notifications, affiliate_products
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

const TABLES = {
  premium_features: 'id,title,title_az,description,description_az',
  partner_venue_categories: 'id,label,label_az',
  multiples_options: 'id,label,label_az',
  scheduled_notifications: 'id,title,body',
  affiliate_products: 'id,name,name_az,description,description_az,review_summary,review_summary_az',
};

(async () => {
  const su = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `diag_${Date.now()}@anacan-test.dev`, password: 'Test1234!diag' }),
  });
  const suData = await su.json();
  const token = suData.access_token;
  if (!token) { console.error('✗ token yoxdur', JSON.stringify(suData).slice(0, 150)); process.exit(1); }
  const H = { apikey: KEY, Authorization: `Bearer ${token}` };

  for (const [table, sel] of Object.entries(TABLES)) {
    const rows = [];
    for (let fromIdx = 0; ; fromIdx += 1000) {
      const r = await fetch(`${URL_}/rest/v1/${table}?select=${sel}&order=id.asc&limit=1000&offset=${fromIdx}`, { headers: H });
      if (!r.ok) { console.log(`✗ ${table}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`); break; }
      const batch = await r.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (rows.length) {
      fs.writeFileSync(path.join(__dirname, 'chunks', `${table}.json`), JSON.stringify(rows, null, 1));
      console.log(`✓ ${table}: ${rows.length} sətir → chunks/${table}.json`);
    } else {
      console.log(`⚠ ${table}: 0 sətir (RLS və ya boş)`);
    }
  }
})();
