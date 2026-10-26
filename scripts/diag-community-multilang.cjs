// Cəmiyyət çoxdilli linza diaqnozu:
// 1) signup → token
// 2) community_posts or-filtri (linza sintaksisi) — canlı yoxlama
// 3) user_preferences.feed_languages select (Son27-dən ƏVVƏL 400 gözlənilir → client fallback)
// 4) dillərə görə qlobal post sayları
// 5) post insert language ilə (RLS + dəyər yazılışı)
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  const email = `diag_${Date.now()}@anacan-test.dev`;
  const su = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!diag' }),
  });
  const suData = await su.json();
  const token = suData.access_token;
  const uid = suData.user?.id;
  console.log('1) signup HTTP', su.status, token ? '(token alındı)' : JSON.stringify(suData).slice(0, 200));
  if (!token) return;
  const H = { apikey: KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 2) Linza or-filtri — qlobal feed sorğusunun REST ekvivalenti
  const orExpr = encodeURIComponent('(language.in.(az,ru,tr),language.is.null)');
  const feed = await fetch(
    `${URL_}/rest/v1/community_posts?select=id,language&is_active=eq.true&group_id=is.null&or=${orExpr}&order=created_at.desc&limit=5`,
    { headers: H },
  );
  const feedRows = await feed.json();
  console.log('2) linza or-filtri HTTP', feed.status, Array.isArray(feedRows) ? `${feedRows.length} post: ${feedRows.map((r) => r.language).join(',')}` : JSON.stringify(feedRows).slice(0, 200));

  // 3) feed_languages sütunu (Son27-dən əvvəl 400 → client default-a düşür)
  const pref = await fetch(`${URL_}/rest/v1/user_preferences?select=feed_languages&user_id=eq.${uid}`, { headers: H });
  console.log('3) feed_languages SELECT HTTP', pref.status, (await pref.text()).slice(0, 160));

  // 4) Dillərə görə qlobal post sayı
  for (const lang of ['az', 'ru', 'tr', 'en']) {
    const c = await fetch(`${URL_}/rest/v1/community_posts?select=id&is_active=eq.true&group_id=is.null&language=eq.${lang}`, {
      headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
    });
    console.log(`4) lang=${lang} count:`, c.headers.get('content-range'));
  }

  // 5) Post insert language=ru ilə (sonra silinir)
  const ins = await fetch(`${URL_}/rest/v1/community_posts`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: uid, group_id: null, content: 'диагностический пост — будет удалён', language: 'ru', media_urls: [] }),
  });
  const insData = await ins.json();
  const postId = Array.isArray(insData) ? insData[0]?.id : null;
  console.log('5) post INSERT (ru) HTTP', ins.status, postId ? `id=${postId} lang=${insData[0].language}` : JSON.stringify(insData).slice(0, 200));

  // 5b) not-in backfill sintaksisi
  const nin = await fetch(
    `${URL_}/rest/v1/community_posts?select=id,language&is_active=eq.true&group_id=is.null&language=not.in.(az,tr,en)&order=created_at.desc&limit=3`,
    { headers: H },
  );
  const ninRows = await nin.json();
  console.log('5b) backfill not-in HTTP', nin.status, Array.isArray(ninRows) ? `${ninRows.length} post: ${ninRows.map((r) => r.language).join(',')}` : JSON.stringify(ninRows).slice(0, 160));

  // 6) Təmizlik
  if (postId) {
    const del = await fetch(`${URL_}/rest/v1/community_posts?id=eq.${postId}`, { method: 'DELETE', headers: H });
    console.log('6) post DELETE HTTP', del.status);
  }
})();
