import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import { APP_LANGUAGE_CODES } from './app-languages';
import { CONSENT_COPY } from './consent-copy';

const sql = readFileSync('supabase/migrations/20261107150000_user_consents.sql', 'utf8');
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261107150000_user_consents.cdc.json', 'utf8'));

describe('user_consents migration (file only, applied by the operator)', () => {
  it('declares every created or written relation in the CDC manifest', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched].sort()).toEqual(['public.app_settings', 'public.user_consents']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true });
    expect(manifest.migration).toBe('20261107150000_user_consents.sql');
  });

  it('enrolls the new table with the three standard triggers and refuses to run unguarded', () => {
    expect(code).toMatch(/VALUES \('public', t, ARRAY\['id'\]\)/);
    expect(code).toContain("ARRAY['user_consents']");
    for (const t of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(t);
    expect(code).toContain("RAISE EXCEPTION 'USER_CONSENTS_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toContain("RAISE EXCEPTION 'USER_CONSENTS_GUARD_CATALOG_MISSING'");
    expect(code).toContain('ALTER TABLE public.user_consents OWNER TO pgadmin');
  });

  it('is append-only and private: own select/insert, no update/delete grant, update trigger blocks rewrites', () => {
    expect(code).toContain('ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('GRANT SELECT, INSERT ON public.user_consents TO authenticated;');
    expect(code).not.toMatch(/GRANT[^;]*(UPDATE|DELETE)[^;]*user_consents TO authenticated/);
    expect(code).toMatch(/FOR SELECT TO authenticated\s+USING \(user_id = auth\.uid\(\)\)/);
    expect(code).toMatch(/FOR INSERT TO authenticated\s+WITH CHECK \(user_id = auth\.uid\(\)\)/);
    expect(code).toContain("RAISE EXCEPTION 'USER_CONSENTS_APPEND_ONLY'");
    expect(code).toContain("kind IN ('terms', 'health_data', 'age_16', 'marketing', 'child_data', 'ai_assistant', 'marketing_email', 'marketing_push', 'marketing_sms')");
    expect(code).toContain("text_variant IN ('default', 'kvkk_tr')");
    expect(code).toContain('ON public.user_consents (user_id, kind, created_at DESC)');
    expect(code).toContain('REFERENCES auth.users (id) ON DELETE CASCADE');
  });

  it('adds the consent_gate setting and auth-only RPCs', () => {
    expect(code).toContain(`SELECT 'consent_gate', '{"enabled": true, "version": "2.0"}'::jsonb`);
    for (const fn of ['my_consents_v1()', 'record_consents_v1(jsonb,text,text)']) expect(code).toContain(`'${fn}'`);
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.%s FROM PUBLIC, anon'/);
    expect(code).toContain("RAISE EXCEPTION 'CONSENT_AUTH_REQUIRED'");
    expect(code).toContain("RAISE EXCEPTION 'CONSENT_VERSION_MISMATCH'");
    expect(code).toContain("RAISE EXCEPTION 'CONSENT_REQUIRED_NOT_WITHDRAWABLE'");
    expect(code).not.toMatch(/get_public_app_setting/);
  });

  it('is one transaction with no cron or timer', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
  });
});

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();

describe('consent copy in every app language', () => {
  it('uses only the shared copy keys in the consent sources', () => {
    const sources = ['components/consent/ConsentGateScreen.tsx', 'components/consent/AiConsentGate.tsx', 'components/privacy/ConsentSettings.tsx']
      .map((p) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')).join('\n');
    const used = [...sources.matchAll(/'((?:ai_)?consent_[a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(20);
    expect(used.filter((k) => !(k in CONSENT_COPY))).toEqual([]);
  });

  it.each(APP_LANGUAGE_CODES)('%s has every consent string with the same placeholders', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const [key, az] of Object.entries(CONSENT_COPY)) {
      const value = dict[key];
      if (typeof value !== 'string' || !value.trim()) { missing.push(key); continue; }
      expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(az));
    }
    expect(missing).toEqual([]);
    if (lang === 'az') for (const [key, az] of Object.entries(CONSENT_COPY)) expect(dict[key], key).toBe(az);
    else expect(dict.consent_age_label).not.toBe(CONSENT_COPY.consent_age_label);
  });
});

describe('privacy path and KVKK wording', () => {
  it('titles the Privacy section exactly "Razılıqlar" (Profil → Gizlilik → Razılıqlar)', () => {
    expect(CONSENT_COPY.consent_section_title).toBe('Razılıqlar');
    expect(readFileSync(resolve(process.cwd(), 'src/components/PrivacyScreen.tsx'), 'utf8')).toContain('<ConsentSettings />');
  });
  it('uses "Rızalar" and "Gizlilik" in Turkish (KVKK page: Profil → Gizlilik → Rızalar)', () => {
    const tr = JSON.parse(readFileSync(file('tr'), 'utf8'));
    expect(tr.consent_section_title).toBe('Rızalar');
    expect(tr.privacyscreen_gizlilik_tehlukesizlik_67bec6).toBe('Gizlilik');
    expect(tr.profilescreen_gizlilik).toBe('Gizlilik');
  });
  it('keeps the owner\'s KVKK texts verbatim (never routed through translations)', async () => {
    const { KVKK_TEXTS } = await import('./consent-copy');
    expect(KVKK_TEXTS.notice_url).toBe('https://anacan.az/kvkk');
    expect(KVKK_TEXTS.health_data).toContain('″ANACAN″ Mahdud Mesuliyyetli Cemiyyeti tarafından işlenmesine açık rıza veriyorum.');
    expect(KVKK_TEXTS.marketing).toContain('6563 sayılı');
    expect(KVKK_TEXTS.ai_assistant).toContain("Google LLC'ye (Gemini)");
    const tr = JSON.parse(readFileSync(file('tr'), 'utf8'));
    expect(Object.values(tr)).not.toContain(KVKK_TEXTS.health_data);
  });
});
