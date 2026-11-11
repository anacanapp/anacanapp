// Per-user language trimming for app blog reads (2026-11-11).
// The app list query selects every column of up to 200 posts: the body in all 23 languages (~16.7 MB JSON). The
// app only ever shows one language plus a fixed fallback chain (src/lib/tr.ts mapRowTranslation), but it stored the
// whole response in its offline cache, which overflowed localStorage and froze mid-range Android phones.
// When the caller's app language is known, translation columns and editorial locales outside that chain are dropped.
// Unknown language (signed out, website, admin source reads) -> the response is unchanged.

const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et'];
const NEW_LANGS = new Set(['zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et']);
const TRANSLATED = /^(content|title|excerpt)_([a-z]{2})$/u;

/** Languages whose columns the app may read for `language` (mirrors mapRowTranslation's fallback chains). */
export function keepLanguages(language) {
  if (!LANGS.includes(language)) return null;
  if (language === 'az') return new Set(['az']);
  if (NEW_LANGS.has(language) || language === 'de' || language === 'ar') return new Set([language, 'en', 'az']);
  if (language === 'kk' || language === 'uz' || language === 'ka') return new Set([language, 'ru', 'az']);
  return new Set([language, 'az']);
}

export function trimRow(row, keep, language) {
  if (!keep || !row || typeof row !== 'object' || Array.isArray(row)) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const m = TRANSLATED.exec(key);
    if (m && LANGS.includes(m[2]) && !keep.has(m[2])) continue;
    out[key] = value;
  }
  const meta = row.editorial_metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.locales && typeof meta.locales === 'object') {
    const locales = {};
    for (const [code, value] of Object.entries(meta.locales)) if (code === language || code === 'az' || keep.has(code)) locales[code] = value;
    out.editorial_metadata = { ...meta, locales };
  }
  return out;
}

/** user id (sub) from a bearer JWT, unverified: it is only used to ask PostgREST with the same token, which verifies it. */
export function bearerSubject(authorization) {
  const m = /^Bearer\s+([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/u.exec(String(authorization || ''));
  if (!m) return null;
  try {
    const payload = JSON.parse(Buffer.from(m[2], 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' && /^[0-9a-f-]{36}$/u.test(payload.sub) && payload.role === 'authenticated' ? payload.sub : null;
  } catch { return null; }
}

/** Looks up user_preferences.language through PostgREST with the caller's own token; cached 60 s, bounded. */
export function createLanguageLookup({ fetchJson, ttlMs = 60_000, max = 5000 }) {
  const cache = new Map();
  return async (headers) => {
    const sub = bearerSubject(headers.authorization);
    if (!sub) return null;
    const hit = cache.get(sub);
    if (hit && hit.expires > Date.now()) return hit.language;
    let language = null;
    try {
      const rows = await fetchJson(`/user_preferences?select=language&user_id=eq.${sub}&limit=1`, { authorization: headers.authorization, apikey: headers.apikey });
      const value = Array.isArray(rows) && rows[0] ? rows[0].language : null;
      language = typeof value === 'string' && LANGS.includes(value) ? value : null;
    } catch { language = null; }
    if (cache.size >= max) cache.delete(cache.keys().next().value);
    cache.set(sub, { language, expires: Date.now() + ttlMs });
    return language;
  };
}
