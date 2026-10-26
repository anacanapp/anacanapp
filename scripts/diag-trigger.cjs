// Trigger-li INSERT probu: authenticated user → community_groups SELECT → group_members INSERT
// (update_group_member_count trigger-i REVOKE-a baxmayaraq işə düşməlidir — fire-time-da EXECUTE yoxlanmır)
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  const email = `diag_trg_${Date.now()}@anacan-test.dev`;
  const password = 'Test1234!diag';

  const su = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const suData = await su.json();
  console.log('1) signup HTTP', su.status, suData.access_token ? '(token alındı)' : JSON.stringify(suData).slice(0, 220));
  const token = suData.access_token;
  if (!token) return;
  const uid = suData.user?.id;
  const H = { apikey: KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 2) Qrup tap (autoJoin-un etdiyi kimi)
  const g = await fetch(`${URL_}/rest/v1/community_groups?select=id,name,member_count&limit=1`, { headers: H });
  const groups = await g.json();
  console.log('2) community_groups SELECT HTTP', g.status, JSON.stringify(groups).slice(0, 200));
  const grp = Array.isArray(groups) && groups[0];
  if (!grp) { console.log('→ qrup yoxdur, trigger probu mümkün deyil'); return; }

  // 3) group_memberships INSERT → update_group_member_count trigger-i işə düşür
  const ins = await fetch(`${URL_}/rest/v1/group_memberships`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ group_id: grp.id, user_id: uid }),
  });
  console.log('3) group_members INSERT HTTP', ins.status, (await ins.text()).slice(0, 300));

  // 4) member_count artdı? (trigger-in real işlədiyinin sübutu)
  const g2 = await fetch(`${URL_}/rest/v1/community_groups?select=member_count&id=eq.${grp.id}`, { headers: H });
  const after = await g2.json();
  console.log('4) member_count əvvəl:', grp.member_count, '→ sonra:', after?.[0]?.member_count,
    after?.[0]?.member_count === (grp.member_count ?? 0) + 1 ? '✓ TRIGGER İŞLƏDİ' : '⚠ dəyişməyib');
})();
