// Günə-özəl push cədvəllərini AUTHENTICATED istifadəçi ilə çəkib chunks/ yaradır.
// (RLS: SELECT yalnız authenticated üçün açıqdır — anon boş görür.)
// İstifadə: node scripts/content-i18n/fetch-day-notifications.cjs
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  // 1) Test istifadəçi (diag pattern — email confirm tələb olunmur)
  const email = `diag_i18n_${Date.now()}@anacan-test.dev`;
  const su = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!diag' }),
  });
  const suData = await su.json();
  const token = suData.access_token;
  if (!token) { console.error('✗ token alınmadı:', JSON.stringify(suData).slice(0, 200)); process.exit(1); }
  console.log('✓ auth token alındı');
  const H = { apikey: KEY, Authorization: `Bearer ${token}` };

  // 2) Hər iki cədvəli səhifələyərək çək
  for (const t of ['pregnancy_day_notifications', 'mommy_day_notifications']) {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(
        `${URL_}/rest/v1/${t}?select=id,day_number,title,body,title_ru&order=day_number.asc,id.asc`,
        { headers: { ...H, Range: `${from}-${from + 999}` } }
      );
      if (!r.ok) { console.error(`✗ ${t}: HTTP ${r.status}`, (await r.text()).slice(0, 200)); process.exit(1); }
      const rows = await r.json();
      all.push(...rows);
      if (rows.length < 1000) break;
    }
    // chunk formatı: [{id, _o, title, body}] — azure-translate bunları oxuyur
    const already = all.filter((r) => r.title_ru).length;
    const chunk = all.map((r) => ({ id: r.id, _o: r.day_number, title: r.title, body: r.body }));
    const out = path.join(__dirname, 'chunks', `${t}.json`);
    fs.writeFileSync(out, JSON.stringify(chunk, null, 1));
    console.log(`✓ ${t}: ${all.length} sətir (ru artıq dolu: ${already}) → chunks/${t}.json`);
    if (all[0]) console.log(`  nümunə: [gün ${all[0].day_number}] "${all[0].title}" — "${String(all[0].body).slice(0, 90)}"`);
  }
  console.log('\nQeyd: test hesab yarandı:', email, '(Auth > Users-dən silinə bilər)');
})();
