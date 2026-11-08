import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAN_TABLE } from './sleep-training-sync';

const sql = readFileSync('supabase/migrations/20261108090000_sleep_training_plans.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261108090000_sleep_training_plans.cdc.json', 'utf8'));

describe('sleep-training plans migration (file only, applied by the operator)', () => {
  it('declares every created or written relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched]).toEqual(['public.sleep_training_plans']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true, change: 'created', primary_key: ['id'] });
    expect(manifest.migration).toBe('20261108090000_sleep_training_plans.sql');
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
    expect(PLAN_TABLE).toBe('sleep_training_plans');
  });

  it('refuses without the guard catalog or the partner helper and enrolls the table with the three standard triggers', () => {
    expect(code).toContain("RAISE EXCEPTION 'SLEEP_PLAN_GUARD_CATALOG_MISSING'");
    expect(code).toContain("RAISE EXCEPTION 'SLEEP_PLAN_PARTNER_HELPER_MISSING'");
    expect(code.indexOf('SLEEP_PLAN_GUARD_CATALOG_MISSING')).toBeLessThan(code.indexOf('CREATE TABLE'));
    expect(code).toMatch(/\('public', 'sleep_training_plans', ARRAY\['id'\]\)/);
    for (const t of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(`CREATE TRIGGER ${t}`);
    expect(code).toContain('_anacan_gcp_migration.guard_write()');
    expect(code).toContain('_anacan_gcp_migration.capture_change()');
    expect(code).toContain("RAISE EXCEPTION 'SLEEP_PLAN_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toMatch(/<> 3 THEN/);
  });

  it('keeps one plan per owner and child (a null child counts once) within a bounded size', () => {
    expect(code).toContain('UNIQUE NULLS NOT DISTINCT (user_id, child_id)');
    expect(code).toMatch(/user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(code).toMatch(/child_id uuid REFERENCES public\.user_children\(id\) ON DELETE CASCADE/);
    expect(code).toContain('octet_length(plan::text) <= 65536');
  });

  it('gives the owner full access to her own children only and the linked partner read access behind the baby-logs switch', () => {
    expect(code).toContain('ALTER TABLE public.sleep_training_plans ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('REVOKE ALL ON public.sleep_training_plans FROM PUBLIC, anon;');
    expect(code).toMatch(/CREATE POLICY sleep_training_plans_own ON public\.sleep_training_plans\s+FOR ALL TO authenticated\s+USING \(user_id = auth\.uid\(\)\)\s+WITH CHECK \(\s+user_id = auth\.uid\(\)\s+AND \(child_id IS NULL OR EXISTS \(\s+SELECT 1 FROM public\.user_children c WHERE c\.id = sleep_training_plans\.child_id AND c\.user_id = auth\.uid\(\)\)\)/);
    expect(code).toMatch(/CREATE POLICY sleep_training_plans_partner_read ON public\.sleep_training_plans\s+FOR SELECT TO authenticated\s+USING \(public\.partner_can_see_v1\(user_id, 'baby_logs'\)\);/);
    // The partner never writes: the only policy covering writes is the owner's.
    expect(code.match(/CREATE POLICY/g)).toHaveLength(2);
    expect(code).not.toMatch(/GRANT[^;]*sleep_training_plans[^;]*TO anon/);
  });

  it('is one transaction with no cron or timer and touches nothing else', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
    expect(code).not.toMatch(/partner_sharing_settings|baby_logs\b(?!')|app_settings|CREATE OR REPLACE FUNCTION/);
    expect(code).toContain('ALTER TABLE public.sleep_training_plans OWNER TO pgadmin');
  });
});
