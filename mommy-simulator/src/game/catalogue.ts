import type { Catalogue, Language, PublicRow } from './types';

const ORIGIN = 'https://gcp.anacan.az';
const CACHE = 'mommy-catalogue-cache-v1';
const groups = ['pregnancy', 'milestones', 'recipes', 'bag', 'names', 'weekly'] as const;
const tables = new Set(['pregnancy_daily_content', 'baby_milestones_db', 'admin_recipes', 'hospital_bag_templates', 'baby_names_db', 'weekly_tips']);

export function validCatalogue(raw: unknown): raw is Catalogue {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as Catalogue;
  return c.schema === 'mommy-public-catalogue-v1' && c.origin === ORIGIN && c.project === 'ninth-park-492111-m4' &&
    typeof c.fetchedAt === 'string' && groups.every(key => Array.isArray(c[key]) && c[key].length > 0 && c[key].length <= 5000 &&
      c[key].every(row => row && typeof row.id === 'string'));
}

export async function loadCatalogue(): Promise<Catalogue> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    if (validCatalogue(cached)) return cached;
  } catch {}
  const result = await fetch('/data/catalogue.json', { signal: AbortSignal.timeout(15000) });
  const data = await result.json();
  if (!validCatalogue(data)) throw new Error('Invalid game catalogue');
  return data;
}

export async function refreshCatalogue(): Promise<Catalogue> {
  const connection = await (await fetch('/data/connection.json')).json();
  if (connection.origin !== ORIGIN || connection.project !== 'ninth-park-492111-m4' || typeof connection.publicKey !== 'string') throw new Error('Unknown content origin');
  const claims = JSON.parse(atob(connection.publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (claims.role !== 'anon' || !Array.isArray(connection.tables) || connection.tables.length !== 6) throw new Error('Public connection required');
  const result: Partial<Catalogue> = { schema: 'mommy-public-catalogue-v1', origin: ORIGIN, project: connection.project, fetchedAt: new Date().toISOString() };
  await Promise.all(connection.tables.map(async (spec: { key: typeof groups[number]; table: string; fields: string[]; order: string; filters?: Record<string, string> }) => {
    if (!tables.has(spec.table) || !groups.includes(spec.key) || !Array.isArray(spec.fields) || spec.fields.some(f => !/^[a-z_]+$/.test(f))) throw new Error('Unknown content table');
    const rows: PublicRow[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const url = new URL(`/rest/v1/${spec.table}`, ORIGIN);
      for (const [key, value] of Object.entries({ select: spec.fields.join(','), is_active: 'eq.true', order: spec.order,
        offset: String(offset), limit: '500', ...(spec.table === 'baby_names_db' ? { lang: 'eq.az' } : {}) })) url.searchParams.set(key, value);
      const r = await fetch(url, { method: 'GET', headers: { apikey: connection.publicKey, Authorization: `Bearer ${connection.publicKey}` },
        signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!r.ok) throw new Error('Content is temporarily unavailable');
      const page = await r.json();
      if (!Array.isArray(page)) throw new Error('Invalid catalogue page');
      rows.push(...page);
      if (page.length < 500) break;
    }
    result[spec.key] = rows;
  }));
  if (!validCatalogue(result)) throw new Error('Incomplete catalogue');
  try { localStorage.setItem(CACHE, JSON.stringify(result)); } catch { /* in-memory catalogue remains usable */ }
  return result;
}

export function rowText(row: PublicRow, field: string, language: Language): string {
  const raw = row[`${field}_${language}`] || row[language === 'az' ? field : `${field}_en`] || row[`${field}_az`] || row[field];
  return typeof raw === 'string' ? raw.replace(/;;;\s*/g, '\n\n').trim() : '';
}

export function rowArray(row: PublicRow, field: string, language: Language): string[] {
  const raw = row[`${field}_${language}`] || row[field];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

export function pregnancyForWeek(catalogue: Catalogue, week: number): PublicRow | undefined {
  const day = week * 7;
  return catalogue.pregnancy.find(row => row.pregnancy_day === day) ?? catalogue.pregnancy.find(row => row.week_number === week);
}

export function safeContentImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && ['gcp.anacan.az', 'api.anacan.az'].includes(url.hostname) && url.pathname.startsWith('/storage/v1/object/public/')) {
      url.hostname = 'gcp.anacan.az'; return url.toString();
    }
  } catch {}
}
