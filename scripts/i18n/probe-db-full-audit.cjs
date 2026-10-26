// Canlı DB tam-tərcümə auditi: hansı Qazax/Alman SQL faylları tətbiq olunub?
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };

  const count = async (table, filter) => {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=id&${filter}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range');
    return r.ok ? (cr ? cr.split('/')[1] : '?') : `ERR ${r.status}`;
  };
  const colExists = async (table, col) => {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${col}&limit=1`, { headers: H });
    return r.ok;
  };

  console.log('══ app_languages ══');
  const langs = await (await fetch(`${URL_}/rest/v1/app_languages?select=code,is_active&order=sort_order`, { headers: H })).json();
  console.log(' ', JSON.stringify(langs));

  console.log('\n══ translations sayı (dil üzrə) ══');
  for (const l of ['az', 'en', 'ru', 'tr', 'kk', 'de']) {
    console.log(`  ${l}: ${await count('translations', `lang=eq.${l}`)}`);
  }

  console.log('\n══ Sxem sütunları (fayl-tətbiq göstəricisi) ══');
  console.log('  baby_message_kk (Qazax1):', await colExists('pregnancy_daily_content', 'baby_message_kk'));
  console.log('  baby_message_de (Alman1):', await colExists('pregnancy_daily_content', 'baby_message_de'));
  console.log('  info_de (Alman1):', await colExists('baby_daily_info', 'info_de'));
  console.log('  title_de day-notif (Alman1):', await colExists('mommy_day_notifications', 'title_de'));

  console.log('\n══ Kontent dolğunluğu (NULL olmayan) ══');
  const contentChecks = [
    ['pregnancy_daily_content', 'baby_message_kk'],
    ['pregnancy_daily_content', 'baby_message_de'],
    ['baby_daily_info', 'info_kk'],
    ['baby_daily_info', 'info_de'],
    ['mommy_day_notifications', 'title_kk'],
    ['mommy_day_notifications', 'title_de'],
    ['pregnancy_day_notifications', 'title_de'],
    ['vitamins', 'name_kk'],
    ['vitamins', 'name_de'],
    ['premium_features', 'title_kk'],
    ['premium_features', 'title_de'],
    ['faqs', 'question_de'],
    ['legal_documents', 'content_de'],
  ];
  for (const [t, c] of contentChecks) {
    const ok = await colExists(t, c);
    if (!ok) { console.log(`  ${t}.${c}: SÜTUN YOXDUR`); continue; }
    console.log(`  ${t}.${c}: ${await count(t, `${c}=not.is.null`)} dolu`);
  }

  console.log('\n══ EPDS options (Qazax6/Alman5) ══');
  const ep = await (await fetch(`${URL_}/rest/v1/epds_questions?select=options&limit=1`, { headers: H })).json();
  const o = ep?.[0]?.options?.[0] || {};
  console.log('  sahələr:', Object.keys(o).join(','));

  console.log('\n══ baby_message Anacan→müraciət (Qazax8) ══');
  const bm = await (await fetch(`${URL_}/rest/v1/pregnancy_daily_content?select=baby_message_ru&day_number=eq.9&limit=1`, { headers: H })).json();
  const s = bm?.[0]?.baby_message_ru || '';
  console.log('  gün-9 ru başlanğıc:', JSON.stringify(s.slice(0, 60)));
})();
