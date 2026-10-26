import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const parent = dirname(root.slice(0, -1));
const origin = 'https://gcp.anacan.az';
const key = loadEnv('azure', parent, 'VITE_').VITE_SUPABASE_PUBLISHABLE_KEY;
let claims;
try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch {}
if (claims?.role !== 'anon') throw new Error('Only the existing public anonymous key is allowed.');

const translated = (fields) => fields.flatMap(field => [field, `${field}_en`, `${field}_tr`]);
const tables = [
  { key: 'pregnancy', table: 'pregnancy_daily_content', order: 'pregnancy_day.asc,id.asc',
    fields: ['id', 'pregnancy_day', 'week_number', 'baby_size_cm', 'baby_weight_gram',
      ...translated(['baby_size_fruit', 'baby_development', 'baby_message', 'daily_tip', 'emotional_tip', 'partner_tip'])] },
  { key: 'milestones', table: 'baby_milestones_db', order: 'sort_order.asc,id.asc',
    fields: ['id', 'milestone_key', 'week_number', 'emoji', 'label', 'label_az', 'label_en', 'label_tr',
      'description', 'description_az', 'description_en', 'description_tr'] },
  { key: 'recipes', table: 'admin_recipes', order: 'id.asc',
    fields: ['id', 'category', 'prep_time', 'cook_time', 'image_url',
      ...translated(['title', 'description', 'ingredients', 'instructions'])] },
  { key: 'bag', table: 'hospital_bag_templates', order: 'sort_order.asc,id.asc',
    fields: ['id', 'category', 'is_essential', 'sort_order', 'item_name', 'item_name_az', 'item_name_en', 'item_name_tr'] },
  { key: 'names', table: 'baby_names_db', order: 'popularity.desc.nullslast,id.asc', filters: { lang: 'eq.az' },
    fields: ['id', 'name', 'gender', 'lang', 'popularity', 'meaning', 'meaning_az', 'meaning_en', 'meaning_tr', 'origin'] },
  { key: 'weekly', table: 'weekly_tips', order: 'week_number.asc,id.asc',
    fields: ['id', 'week_number', 'life_stage', ...translated(['title', 'content'])] },
];

async function catalogue(spec) {
  const result = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const url = new URL(`/rest/v1/${spec.table}`, origin);
    for (const [name, value] of Object.entries({ select: spec.fields.join(','), is_active: 'eq.true',
      order: spec.order, limit: '500', offset: String(offset), ...spec.filters })) url.searchParams.set(name, value);
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(45000), redirect: 'error' });
    if (!response.ok) throw new Error(`Public catalogue ${spec.table}: HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some(row => typeof row.id !== 'string')) throw new Error('Invalid public catalogue.');
    result.push(...rows);
    if (rows.length < 500) break;
  }
  if (!result.length) throw new Error(`Empty public catalogue: ${spec.table}`);
  console.log(`${spec.table}: ${result.length} active public records`);
  return [spec.key, result];
}

const data = Object.fromEntries(await Promise.all(tables.map(catalogue)));
const snapshot = { schema: 'mommy-public-catalogue-v1', origin, project: 'ninth-park-492111-m4',
  fetchedAt: new Date().toISOString(), ...data };
const json = JSON.stringify(snapshot);
const directory = join(root, 'public/data');
await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'catalogue.json'), json + '\n');
await writeFile(join(directory, 'connection.json'), JSON.stringify({ schema: 'mommy-public-connection-v1',
  origin, project: snapshot.project, publicKey: key, tables }, null, 2) + '\n');
await writeFile(join(directory, 'provenance.json'), JSON.stringify({ schema: snapshot.schema, origin,
  project: snapshot.project, fetchedAt: snapshot.fetchedAt,
  sha256: createHash('sha256').update(json).digest('hex'), counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  scope: 'active-public-catalogues-only', transport: 'anonymous-read-only' }, null, 2) + '\n');
console.log('Offline Google content snapshot saved. No personal data or privileged keys.');
