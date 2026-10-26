/**
 * i18n Ekstraktor — ru/tr tərcümə pipeline-ının 1-ci addımı.
 *
 * 1. src/ içindəki bütün tr('key', 'az fallback') çağırışlarını çıxarır
 * 2. admin* açarlarını ATIR (daxili alət — tərcümə olunmur)
 * 3. AZ mətni: az.json (kanonik) → yoxdursa koddakı fallback literalı
 * 4. EN mətni: en.json (varsa)
 * 5. DB-dəki MÖVCUD ru/tr açarlarını çəkir (.env VITE_* ilə; alınmasa boş sayır)
 * 6. Prioritet qruplaşdırma (P1 konversiya-kritik → P3) + 200-lük chunk-lar
 *
 * Çıxış:
 *   scripts/i18n/chunks/P{n}-{idx}.json   → [{key, az, en}]
 *   scripts/i18n/manifest.json            → statistika + chunk siyahısı
 *
 * Run: node scripts/i18n/extract-used-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(__dirname, 'chunks');
const CHUNK_SIZE = 200;

// ── P1: ilk açılış + konversiya kritik ──
const P1_PREFIXES = [
'onboarding', 'ponb_', 'auth', 'login', 'signup',
'paywall', 'pw_', 'pgate_', 'premium', 'dps_', 'usepaywallconfig', 'billing',
'ref_', 'winback_', 'profilescreen_referral',
'bottomnav', 'dashboard', 'common', 'splash', 'appintro', 'initiallang',
'funnel', 'quizstep', 'analysisstep', 'resultsstep', 'howapphelps', 'reviewsstep',
'featuresstep', 'customplan', 'discountedpaywall', 'reversetrial',
'appratingprompt', 'back_press', 'forceupdate'];


// ── P2: gündəlik əsas istifadə ──
const P2_PREFIXES = [
'flow', 'aichat', 'community', 'postcard', 'commentreply', 'groupfeed',
'groupslist', 'stories', 'storyviewer', 'createpost', 'conversation',
'directmessage', 'userprofile', 'settings', 'profile', 'notification',
'privacy', 'appearance', 'calendar', 'month_', 'weekday', 'help',
'health_', 'hc_', 'bp_', 'rf_', 'rfb_', 'who_', 'pdf_', 'applock',
'messagesscreen', 'motherchat', 'legal', 'ptour_', 'aichatscreen'];


function priorityOf(key) {
  const k = key.toLowerCase();
  if (P1_PREFIXES.some((p) => k.startsWith(p))) return 'P1';
  if (P2_PREFIXES.some((p) => k.startsWith(p))) return 'P2';
  return 'P3';
}

// ── JS string literalını unescape et ──
function unescapeLiteral(raw) {
  // raw: 'xxx' və ya "xxx" (dırnaqlar daxil)
  const body = raw.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\') {out += c;continue;}
    const n = body[++i];
    switch (n) {
      case 'n':out += '\n';break;
      case 't':out += '\t';break;
      case 'r':out += '\r';break;
      case '\\':out += '\\';break;
      case "'":out += "'";break;
      case '"':out += '"';break;
      case '`':out += '`';break;
      case 'u':{
          const hex = body.slice(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          } else {out += 'u';}
          break;
        }
      default:out += n;
    }
  }
  return out;
}

// ── src skan ──
function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (!/node_modules|locales/.test(f)) walk(p, files);
    } else if (/\.(ts|tsx)$/.test(f)) {
      files.push(p);
    }
  }
  return files;
}

console.log('1/5  src skan edilir...');
const files = walk(SRC);
const keyToFallback = new Map(); // key -> koddan çıxarılan az fallback (ilk rast gələn)
const RE = /\btr\(\s*(['"])([^'"]+)\1\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
const RE_KEY_ONLY = /\btr\(\s*(['"])([^'"]+)\1\s*,/g;

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  let m;
  RE.lastIndex = 0;
  while (m = RE.exec(c)) {
    const key = m[2];
    if (!keyToFallback.has(key)) {
      keyToFallback.set(key, unescapeLiteral(m[3]));
    }
  }
  // Fallback-ı literal olmayan (template və s.) açarları da tut
  RE_KEY_ONLY.lastIndex = 0;
  while (m = RE_KEY_ONLY.exec(c)) {
    const key = m[2];
    if (!keyToFallback.has(key)) keyToFallback.set(key, null);
  }
}
console.log(`   ${keyToFallback.size} unikal açar tapıldı`);

// ── admin* at ──
const allKeys = [...keyToFallback.keys()].filter((k) => !/^admin/i.test(k));
console.log(`2/5  admin* çıxıldı → ${allKeys.length} açar qaldı`);

// ── az/en JSON-ları ──
const azJson = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', 'az.json'), 'utf8'));
const enJson = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', 'en.json'), 'utf8'));

// ── DB-dəki mövcud ru/tr (qrasiyalı) ──
async function fetchExisting(lang, url, anon) {
  const existing = new Set();
  let from = 0;
  const page = 1000;
  while (true) {
    const res = await fetch(
      `${url}/rest/v1/translations?select=key&lang=eq.${lang}&limit=${page}&offset=${from}`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const rows = await res.json();
    rows.forEach((r) => existing.add(r.key));
    if (rows.length < page) break;
    from += page;
  }
  return existing;
}

async function main() {
  let existingRu = new Set();
  let existingTr = new Set();
  try {
    const envRaw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const url = (envRaw.match(/VITE_SUPABASE_URL="?([^"\r\n]+)"?/) || [])[1];
    const anon = (envRaw.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/) || [])[1];
    if (url && anon) {
      console.log('3/5  DB-dəki mövcud ru/tr yoxlanılır...');
      existingRu = await fetchExisting('ru', url, anon);
      existingTr = await fetchExisting('tr', url, anon);
      console.log(`   mövcud: ru=${existingRu.size}, tr=${existingTr.size}`);
    } else {
      console.log('3/5  .env-də VITE açarları tapılmadı — DB yoxlaması ötürülür');
    }
  } catch (e) {
    console.log(`3/5  DB yoxlaması alınmadı (${e.message}) — hamısı tərcümə ediləcək (DO NOTHING qoruyur)`);
  }

  // ── Mənbə sıraları ──
  const items = [];
  const problems = [];
  for (const key of allKeys) {
    const az = azJson[key] ?? keyToFallback.get(key);
    const en = enJson[key] ?? null;
    if (!az) {problems.push(key);continue;}
    // Hər iki dildə mövcuddursa tam ötür
    const needRu = !existingRu.has(key);
    const needTr = !existingTr.has(key);
    if (!needRu && !needTr) continue;
    items.push({ key, az, en, needRu, needTr, pri: priorityOf(key) });
  }

  // ── Sırala: P1→P3, daxildə key üzrə ──
  items.sort((a, b) => a.pri.localeCompare(b.pri) || a.key.localeCompare(b.key));

  // ── Chunk-la ──
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const chunks = [];
  const counters = { P1: 0, P2: 0, P3: 0 };
  let current = [];
  let currentPri = items[0]?.pri;

  const flush = () => {
    if (current.length === 0) return;
    counters[currentPri]++;
    const name = `${currentPri}-${String(counters[currentPri]).padStart(3, '0')}.json`;
    fs.writeFileSync(
      path.join(OUT_DIR, name),
      JSON.stringify(current.map(({ key, az, en }) => ({ key, az, en })), null, 1),
      'utf8'
    );
    chunks.push({ name, count: current.length, pri: currentPri });
    current = [];
  };

  for (const it of items) {
    if (it.pri !== currentPri || current.length >= CHUNK_SIZE) {
      flush();
      currentPri = it.pri;
    }
    current.push(it);
  }
  flush();

  const stats = {
    generatedAt: new Date().toISOString(),
    totalUsedKeys: keyToFallback.size,
    afterAdminFilter: allKeys.length,
    existingInDb: { ru: existingRu.size, tr: existingTr.size },
    toTranslate: items.length,
    byPriority: {
      P1: items.filter((i) => i.pri === 'P1').length,
      P2: items.filter((i) => i.pri === 'P2').length,
      P3: items.filter((i) => i.pri === 'P3').length
    },
    chunks,
    problems
  };
  fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(stats, null, 2), 'utf8');

  console.log(`4/5  ${items.length} açar tərcümə ediləcək  (P1=${stats.byPriority.P1}, P2=${stats.byPriority.P2}, P3=${stats.byPriority.P3})`);
  console.log(`5/5  ${chunks.length} chunk yazıldı → scripts/i18n/chunks/`);
  if (problems.length) console.log(`⚠ AZ mətni tapılmayan ${problems.length} açar (manifest.problems)`);
}

main().catch((e) => {console.error(e);process.exit(1);});
