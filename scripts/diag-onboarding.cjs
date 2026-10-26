// Onboarding save axınının REAL diaqnozu: test user → profiles select/update → user_children insert
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  const email = `diag_${Date.now()}@anacan-test.dev`;
  const password = 'Test1234!diag';

  // 1) Signup
  const su = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const suData = await su.json();
  console.log('1) signup HTTP', su.status, suData.access_token ? '(token alındı)' : JSON.stringify(suData).slice(0, 220));
  const token = suData.access_token;
  if (!token) { console.log('→ email confirm tələb olunur, token yoxdur; mövcud test hesabla davam etmək lazımdır'); return; }
  const uid = suData.user?.id;
  const H = { apikey: KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 2) profiles SELECT (öz sətri)
  const sel = await fetch(`${URL_}/rest/v1/profiles?select=id,user_id,life_stage&user_id=eq.${uid}`, { headers: H });
  console.log('2) profiles SELECT HTTP', sel.status, (await sel.text()).slice(0, 250));

  // 3) profiles UPDATE — onboarding-in göndərdiyi sahələr
  const upd = await fetch(`${URL_}/rest/v1/profiles?user_id=eq.${uid}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({
      life_stage: 'mommy',
      baby_birth_date: '2026-01-15',
      baby_name: 'Diaq Test',
      baby_gender: 'girl',
      baby_count: 1,
      multiples_type: 'single',
    }),
  });
  console.log('3) profiles UPDATE HTTP', upd.status, (await upd.text()).slice(0, 300));

  // 4) user_children INSERT
  const ins = await fetch(`${URL_}/rest/v1/user_children`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: uid, name: 'Diaq Test', birth_date: '2026-01-15',
      gender: 'girl', avatar_emoji: '👧', sort_order: 0,
    }),
  });
  console.log('4) user_children INSERT HTTP', ins.status, (await ins.text()).slice(0, 300));
})();
