import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261108160000_parenting_cms_history.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261108160000_parenting_cms_history.cdc.json', 'utf8'));
const fnBody = (name: string) => new RegExp(`FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`).exec(code)?.[0] ?? '';

describe('Tərbiyə CMS history migration (file only, applied by the operator)', () => {
  it('declares every created, written or triggered relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([
      ...[...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`),
      ...[...code.matchAll(/(?:INSERT OR UPDATE OR DELETE|INSERT OR DELETE OR UPDATE) ON public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`),
    ]);
    expect([...touched].sort()).toEqual(['public.parenting_content_override_history', 'public.parenting_content_overrides']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true });
    expect(declared.get('public.parenting_content_override_history')).toMatchObject({ change: 'created', primary_key: ['id'], private: true });
    expect(manifest.migration).toBe('20261108160000_parenting_cms_history.sql');
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
  });

  it('refuses without the guard catalog or the earlier CMS, and enrolls the history table with the three standard triggers', () => {
    for (const e of ['PARENTING_HISTORY_GUARD_CATALOG_MISSING', 'PARENTING_HISTORY_HAS_ROLE_MISSING', 'PARENTING_HISTORY_CMS_MISSING']) {
      expect(code).toContain(`RAISE EXCEPTION '${e}'`);
      expect(code.indexOf(e)).toBeLessThan(code.indexOf('CREATE TABLE'));
    }
    expect(code).toMatch(/\('public', 'parenting_content_override_history', ARRAY\['id'\]\)/);
    expect(code).toContain('FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()');
    expect(code).toContain('FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()');
    expect(code).toContain('AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()');
    expect(code).toContain("RAISE EXCEPTION 'PARENTING_HISTORY_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toMatch(/<> 2\s+OR[\s\S]*<> 6 THEN/);
    // Enrolled before anything writes the table (the baseline insert and the trigger must be captured).
    expect(code.indexOf('anacan_gcp_writer_guard BEFORE')).toBeLessThan(code.indexOf('INSERT INTO public.parenting_content_override_history'));
  });

  it('has the required columns and keeps history readable by admins only', () => {
    const table = /CREATE TABLE IF NOT EXISTS public\.parenting_content_override_history \(([\s\S]*?)\n\);/.exec(code)?.[1] ?? '';
    for (const col of ['id uuid PRIMARY KEY', 'language text', 'item_type text', 'item_id text', 'patch jsonb', 'draft jsonb', 'published boolean', 'action text', 'edited_by uuid', 'created_at timestamptz']) {
      expect(table, col).toContain(col);
    }
    expect(code).toContain('ALTER TABLE public.parenting_content_override_history ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('REVOKE ALL ON public.parenting_content_override_history FROM PUBLIC, anon, authenticated;');
    expect(code).toMatch(/CREATE POLICY parenting_content_override_history_admin_read ON public\.parenting_content_override_history\s+FOR SELECT TO authenticated\s+USING \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
    expect(code).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*parenting_content_override_history[^;]*TO (anon|authenticated)/);
    expect(code).not.toMatch(/GRANT[^;]*parenting_content_override_history[^;]*TO anon/);
    expect(code).toContain('ALTER TABLE public.parenting_content_override_history OWNER TO pgadmin');
  });

  it('records insert, update and delete of overrides through a SECURITY DEFINER row trigger', () => {
    expect(code).toMatch(/CREATE TRIGGER parenting_override_history\s+AFTER INSERT OR UPDATE OR DELETE ON public\.parenting_content_overrides\s+FOR EACH ROW EXECUTE FUNCTION public\.parenting_override_history_capture\(\)/);
    const body = fnBody('parenting_override_history_capture');
    expect(body).toContain('SECURITY DEFINER');
    expect(body).toContain("SET search_path TO 'public'");
    expect(body).toMatch(/TG_OP = 'DELETE'[\s\S]*v_row := OLD;[\s\S]*v_action := 'revert'/);
    for (const a of ['publish', 'unpublish', 'draft', 'restore']) expect(body).toContain(`v_action := '${a}'`);
    expect(code).toContain("REVOKE ALL ON FUNCTION public.parenting_override_history_capture() FROM PUBLIC, anon, authenticated;");
    expect(code).toMatch(/'baseline'[\s\S]*WHERE NOT EXISTS/);
  });

  it('lists and restores versions only for admins; restore goes through the existing save RPC', () => {
    for (const fn of ['admin_parenting_override_history_v1', 'admin_parenting_override_restore_v1']) {
      const body = fnBody(fn);
      expect(body, fn).toContain('SECURITY DEFINER');
      expect(body, fn).toContain("SET search_path TO 'public'");
      expect(body, fn).toContain("NOT public.has_role(auth.uid(), 'admin')");
    }
    const restore = fnBody('admin_parenting_override_restore_v1');
    expect(restore).toContain("p_action NOT IN ('draft', 'publish')");
    expect(restore).toContain('public.admin_parenting_override_save_v1(v_h.language, v_h.item_type, v_h.item_id, v_patch, p_action)');
    expect(restore).toContain("set_config('anacan.parenting_history_action', 'restore', true)");
    expect(restore).not.toMatch(/INSERT INTO|UPDATE public|DELETE FROM/);
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.admin_parenting_override_history_v1\(text, text, text, integer\),\s+public\.admin_parenting_override_restore_v1\(uuid, text\) FROM PUBLIC, anon;/);
    expect(fnBody('admin_parenting_override_history_v1')).toMatch(/LIMIT LEAST\(GREATEST\(COALESCE\(p_limit, 50\), 1\), 200\)/);
  });

  it('matches the overrides table: item types, id format and sizes', () => {
    expect(code).toContain("item_type IN ('article', 'sos', 'programme', 'programme_day', 'tip', 'band', 'area', 'quiz')");
    expect(code).toContain("item_id ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'");
    expect(code).toContain('octet_length(patch::text) <= 65536');
  });

  it('is one transaction with no cron or timer and leaves the earlier migrations alone', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
    expect(code).not.toMatch(/get_public_app_setting|app_settings|tool_configs|parenting_state/);
    expect(code).not.toMatch(/CREATE OR REPLACE FUNCTION public\.admin_parenting_override_(save|revert)_v1|admin_parenting_overrides_v1/);
  });
});
