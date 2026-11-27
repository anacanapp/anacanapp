import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TIME_ZONE_PATTERN } from './user-timezone';

const sql = readFileSync('supabase/migrations/20261108100000_user_timezone.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261108100000_user_timezone.cdc.json', 'utf8'));

describe('user time zone migration (file only, applied by the operator)', () => {
  it('declares the altered relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched]).toEqual(['public.user_preferences']);
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
    expect(manifest.migration).toBe('20261108100000_user_timezone.sql');
    expect(manifest.relations).toHaveLength(1);
    expect(manifest.relations[0]).toMatchObject({ relation: 'public.user_preferences', change: 'altered', cdc: true, writer_guard: true, columns_added: ['timezone'] });
  });

  it('refuses unless user_preferences is already enrolled with the three triggers, before altering it', () => {
    expect(code).toContain("RAISE EXCEPTION 'USER_TIMEZONE_GUARD_CATALOG_MISSING'");
    expect(code).toContain("RAISE EXCEPTION 'USER_TIMEZONE_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toMatch(/guarded_relations\s+WHERE schema_name = 'public' AND table_name = 'user_preferences'\) <> 1/);
    expect(code).toMatch(/tg\.tgname IN \('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate'\)\) <> 3/);
    expect(code.indexOf('USER_TIMEZONE_GUARD_ENROLLMENT_INCOMPLETE')).toBeLessThan(code.indexOf('ALTER TABLE'));
  });

  it('leaves the triggers, enrollment, RLS and grants alone', () => {
    expect(code).not.toMatch(/DROP TRIGGER|CREATE TRIGGER|INSERT INTO _anacan_gcp_migration/);
    expect(code).not.toMatch(/\b(GRANT|REVOKE|POLICY|ROW LEVEL SECURITY)\b/);
    expect(code).not.toMatch(/DROP (TABLE|COLUMN)/);
  });

  it('adds only the nullable timezone column with the IANA check used by the app', () => {
    expect(code).toContain("ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS timezone text CHECK (timezone IS NULL OR (length(timezone) BETWEEN 1 AND 64 AND timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'));");
    expect(code).not.toMatch(/NOT NULL|DEFAULT/);
    expect(TIME_ZONE_PATTERN.source.replace(/\\\//g, '/')).toBe('^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$');
  });

  it('is one transaction with no cron or timer', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
  });
});
