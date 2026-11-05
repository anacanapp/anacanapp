import { supabase } from '@/integrations/supabase/client';

/**
 * First-launch language preselect from the caller's IP country.
 * The Google load balancer adds `X-Anacan-Geo-Country` to every request; the anon RPC
 * `request_geo_country()` hands it back (ISO-2 or null). The language screen still lets the user pick.
 */

// Country (ISO 3166-1 alpha-2) → app language. Anything not listed falls back to English.
const COUNTRY_LANGUAGE: Record<string, string> = {};
const add = (language: string, countries: string) => countries.split(' ').forEach(c => { COUNTRY_LANGUAGE[c] = language; });
add('az', 'AZ');
add('tr', 'TR');
add('ru', 'RU BY TJ TM');
add('kk', 'KZ');
add('ky', 'KG');
add('uz', 'UZ');
add('ka', 'GE');
add('et', 'EE');
add('de', 'DE AT CH LI LU');
add('fr', 'FR MC BE SN CI CM ML BF NE TG BJ GA CG CD MG GN TD CF DJ KM HT RE GP MQ GF NC PF');
add('nl', 'NL SR');
add('es', 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ');
add('pt', 'PT BR AO MZ CV GW ST TL');
add('pl', 'PL');
add('sv', 'SE');
add('ja', 'JP');
add('ko', 'KR');
add('zh', 'CN TW HK MO');
add('vi', 'VN');
add('id', 'ID');
add('hi', 'IN');
add('ar', 'SA AE QA KW BH OM YE IQ SY JO LB PS EG LY SD DZ MA TN MR');

/** Language for a country, limited to the languages the app offers right now; otherwise English. */
export function languageForCountry(country: string | null | undefined, available: readonly string[]): string {
  const fallback = available.includes('en') ? 'en' : available[0] || 'en';
  if (!country) return fallback;
  const language = COUNTRY_LANGUAGE[country.toUpperCase()];
  return language && available.includes(language) ? language : fallback;
}

/** IP country from the backend, or null (offline, timeout, unknown). Never throws. */
export async function fetchGeoCountry(timeoutMs = 2500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await (supabase.rpc as any)('request_geo_country').abortSignal(controller.signal);
    if (error || typeof data !== 'string' || !/^[A-Z]{2}$/.test(data)) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
