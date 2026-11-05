import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261106090000_weaning.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261106090000_weaning.cdc.json', 'utf8'));
const allowlist = (text: string) => {
  const m = /get_public_app_setting[\s\S]*?ARRAY\[([\s\S]*?)\]::text\[\]/.exec(text);
  expect(m).not.toBeNull();
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};

describe('weaning migration (file only, applied by the operator)', () => {
  it('declares every created or written relation in the CDC manifest', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched].sort()).toEqual(['public.app_settings', 'public.tool_configs', 'public.weaning_checkins', 'public.weaning_plans']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true });
    expect(manifest.migration).toBe('20261106090000_weaning.sql');
  });

  it('enrolls both new tables with the three standard triggers and refuses to run unguarded', () => {
    expect(code).toMatch(/\('public', 'weaning_plans', ARRAY\['id'\]\)/);
    expect(code).toMatch(/\('public', 'weaning_checkins', ARRAY\['id'\]\)/);
    for (const t of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(t);
    expect(code).toContain("RAISE EXCEPTION 'WEANING_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toContain("RAISE EXCEPTION 'WEANING_GUARD_CATALOG_MISSING'");
  });

  it('keeps both tables private to their owner', () => {
    for (const t of ['weaning_plans', 'weaning_checkins']) {
      expect(code).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      expect(code).toContain(`REVOKE ALL ON public.${t} FROM PUBLIC, anon;`);
      expect(code).toMatch(new RegExp(`CREATE POLICY ${t}_own ON public\\.${t}\\s+FOR ALL TO authenticated\\s+USING \\(user_id = auth\\.uid\\(\\)\\)`));
    }
    expect(code).not.toMatch(/partner/i);
  });

  it('has the agreed columns and statuses', () => {
    for (const col of ['user_id', 'child_id', 'pace', 'night_mode', 'steps jsonb', 'status', 'started_at', 'created_at', 'updated_at']) expect(code).toContain(col);
    expect(code).toContain("status IN ('active', 'paused', 'finished', 'cancelled')");
    expect(code).toContain("pace IN ('gentle', 'medium')");
    for (const col of ['plan_id', 'date date', 'child_mood', 'wet_diapers', 'child_sick', 'breast_fullness', 'lump', 'redness', 'fever', 'mother_mood', 'result_tone']) expect(code).toContain(col);
  });

  it('adds the free mommy-only tool and the admin switch, default off, to the public allowlist', () => {
    expect(code).toMatch(/'weaning',[\s\S]*'\{mommy\}', 40, true, false, 'none', 0, false, false, true\)/);
    expect(code).toContain(`SELECT 'weaning_tool', '"off"'::jsonb`);
    const previous = allowlist(readFileSync('supabase/migrations/20261105130000_inapp_onboarding.sql', 'utf8'));
    expect(allowlist(sql)).toEqual([...previous, 'weaning_tool']);
  });

  it('is one transaction with no cron or timer', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
  });
});
