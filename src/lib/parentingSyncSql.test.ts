import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261107200000_parenting_sync_cms.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261107200000_parenting_sync_cms.cdc.json', 'utf8'));
const NEW = ['parenting_state', 'parenting_content_overrides'];

describe('Tərbiyə sync + CMS migration (file only, applied by the operator)', () => {
  it('declares every created or written relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched].sort()).toEqual(['public.parenting_content_overrides', 'public.parenting_state']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true, change: 'created' });
    expect(manifest.migration).toBe('20261107200000_parenting_sync_cms.sql');
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
  });

  it('refuses without the guard catalog and enrolls both tables with the three standard triggers', () => {
    expect(code).toContain("RAISE EXCEPTION 'PARENTING_GUARD_CATALOG_MISSING'");
    expect(code.indexOf('PARENTING_GUARD_CATALOG_MISSING')).toBeLessThan(code.indexOf('CREATE TABLE'));
    expect(code).toMatch(/\('public', 'parenting_state', ARRAY\['user_id'\]\)/);
    expect(code).toMatch(/\('public', 'parenting_content_overrides', ARRAY\['id'\]\)/);
    for (const t of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(t);
    expect(code).toContain("RAISE EXCEPTION 'PARENTING_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toMatch(/<> 6 THEN/);
  });

  it('keeps the state private to its owner', () => {
    expect(code).toContain('ALTER TABLE public.parenting_state ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('REVOKE ALL ON public.parenting_state FROM PUBLIC, anon;');
    expect(code).toMatch(/CREATE POLICY parenting_state_own ON public\.parenting_state\s+FOR ALL TO authenticated\s+USING \(user_id = auth\.uid\(\)\)\s+WITH CHECK \(user_id = auth\.uid\(\)\)/);
    expect(code).toMatch(/user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  });

  it('lets everyone read only published overrides (public columns) and nobody write them directly', () => {
    expect(code).toContain('ALTER TABLE public.parenting_content_overrides ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('REVOKE ALL ON public.parenting_content_overrides FROM PUBLIC, anon, authenticated;');
    expect(code).toContain('GRANT SELECT (language, item_type, item_id, patch, published, updated_at) ON public.parenting_content_overrides TO anon, authenticated;');
    expect(code).toMatch(/FOR SELECT TO anon, authenticated\s+USING \(published\)/);
    expect(code).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*parenting_content_overrides[^;]*TO (anon|authenticated)/);
    expect(code).not.toMatch(/GRANT SELECT \([^)]*draft/);
    expect(code).toContain('UNIQUE (language, item_type, item_id)');
  });

  it('writes overrides only through admin-checked SECURITY DEFINER RPCs', () => {
    for (const fn of ['admin_parenting_overrides_v1', 'admin_parenting_override_save_v1', 'admin_parenting_override_revert_v1']) {
      const body = new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\$function\\$;`).exec(code)?.[0] ?? '';
      expect(body, fn).toContain('SECURITY DEFINER');
      expect(body, fn).toContain("SET search_path TO 'public'");
      expect(body, fn).toContain("NOT public.has_role(auth.uid(), 'admin')");
    }
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.admin_parenting_overrides_v1\(text\),[\s\S]*FROM PUBLIC, anon;/);
    expect(code).toContain("p_action NOT IN ('draft', 'publish', 'unpublish')");
  });

  it('matches the client: item types, id format and sizes', () => {
    expect(code).toContain("item_type IN ('article', 'sos', 'programme', 'programme_day', 'tip', 'band', 'area', 'quiz')");
    expect(code).toContain('octet_length(state::text) <= 65536');
    for (const t of NEW) expect(code).toContain(`ALTER TABLE public.${t} OWNER TO pgadmin`);
  });

  it('is one transaction with no cron or timer and leaves the earlier migrations alone', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
    expect(code).not.toMatch(/get_public_app_setting|app_settings|tool_configs/);
  });
});
