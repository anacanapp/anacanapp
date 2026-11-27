import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const NAME = '20261109090000_partner_children_due_date';
const sql = readFileSync(`supabase/migrations/${NAME}.sql`, 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync(`supabase/migrations/${NAME}.cdc.json`, 'utf8'));
const original = readFileSync('supabase/duzelis/Duzelis83.sql', 'utf8');
const body = (text: string, open: string, close: string) => text.slice(text.indexOf(open), text.indexOf(close, text.indexOf(open)));

describe('partner_children_v1 due_date migration (file only, applied by the operator)', () => {
  it('is one transaction that drops and recreates the function with due_date in the result', () => {
    expect(code.trim().startsWith('BEGIN;')).toBe(true);
    expect(code.trim().endsWith('COMMIT;')).toBe(true);
    expect(code.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(code).toContain('DROP FUNCTION IF EXISTS public.partner_children_v1();');
    expect(code).not.toMatch(/CASCADE/i);
    expect(code.indexOf('DROP FUNCTION')).toBeLessThan(code.indexOf('CREATE FUNCTION public.partner_children_v1()'));
    expect(code).toContain('RETURNS TABLE(id uuid, name text, birth_date date, gender text, avatar_emoji text, sort_order integer, due_date date, is_current boolean)');
    expect(code).toMatch(/SELECT c\.id, c\.name, c\.birth_date, c\.gender, c\.avatar_emoji, c\.sort_order, c\.due_date,/);
  });

  it('keeps SECURITY DEFINER, search_path, auth and share_baby_logs masking, owner and grants identical to Duzelis83', () => {
    expect(code).toContain("LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'");
    expect(code).toContain("IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;");
    expect(code).toContain("IF owner IS NULL OR NOT public.partner_can_see_v1(owner, 'baby_logs') THEN RETURN; END IF;");
    expect(code).toContain('WHERE c.user_id = owner AND c.is_active');
    for (const line of [
      'ALTER FUNCTION public.partner_children_v1() OWNER TO pgadmin;',
      'REVOKE ALL ON FUNCTION public.partner_children_v1() FROM PUBLIC, anon;',
      'GRANT EXECUTE ON FUNCTION public.partner_children_v1() TO authenticated;',
    ]) { expect(code).toContain(line); expect(original).toContain(line); }
    // The query body is the Duzelis83 one, unchanged.
    const norm = (s: string) => s.replace(/\$function\$|\$\$/g, '$').replace(/\s+/g, ' ').trim();
    expect(norm(body(code, 'DECLARE owner', 'END $function$'))).toBe(norm(body(original, 'DECLARE owner', 'END $$')));
  });

  it('refuses without its dependencies and verifies the result before COMMIT', () => {
    for (const e of ['PARTNER_CHILDREN_RELATIONS_MISSING', 'PARTNER_CHILDREN_HELPERS_MISSING', 'PARTNER_CHILDREN_DUE_DATE_COLUMN_MISSING']) {
      expect(code.indexOf(`RAISE EXCEPTION '${e}'`)).toBeGreaterThan(-1);
      expect(code.indexOf(e)).toBeLessThan(code.indexOf('DROP FUNCTION'));
    }
    expect(code.indexOf("RAISE EXCEPTION 'PARTNER_CHILDREN_VERIFY_FAILED'")).toBeGreaterThan(code.indexOf('GRANT EXECUTE'));
    expect(code).toContain("pg_get_function_result(fn) NOT LIKE '%due_date date%'");
  });

  it('touches no relation and the CDC manifest says function only', () => {
    expect(code).not.toMatch(/\b(?:CREATE TABLE|ALTER TABLE|INSERT INTO|UPDATE public|DELETE FROM|CREATE TRIGGER|DROP TRIGGER|CREATE POLICY|cron\.)/i);
    expect(manifest).toMatchObject({ protocol: 'anacan-cdc-enrollment-request-v1', migration: `${NAME}.sql`, relations: [] });
    expect(manifest.functions).toEqual([expect.objectContaining({ name: 'public.partner_children_v1()', security: 'definer', grant: ['authenticated'] })]);
    expect(manifest.install).toMatch(/function only, no new or changed relation/);
  });
});
