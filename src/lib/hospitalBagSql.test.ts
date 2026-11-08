import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAG_CATEGORIES } from './hospital-bag';

const sql = readFileSync('supabase/migrations/20261108150000_hospital_bag_custom.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261108150000_hospital_bag_custom.cdc.json', 'utf8'));

describe('hospital bag custom items migration (file only, applied by the operator)', () => {
  it('declares the altered relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    expect([...touched]).toEqual(['public.hospital_bag_items']);
    expect(code).not.toMatch(/CREATE TABLE/);
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
    expect(manifest.migration).toBe('20261108150000_hospital_bag_custom.sql');
    expect(manifest.relations).toHaveLength(1);
    expect(manifest.relations[0]).toMatchObject({
      relation: 'public.hospital_bag_items', change: 'altered', cdc: true, writer_guard: true, columns_added: ['is_hidden'],
    });
  });

  it('refuses unless hospital_bag_items is already enrolled with the three triggers, before altering it', () => {
    expect(code).toContain("RAISE EXCEPTION 'HOSPITAL_BAG_GUARD_CATALOG_MISSING'");
    expect(code).toContain("RAISE EXCEPTION 'HOSPITAL_BAG_EXISTING_ENROLLMENT_INCOMPLETE'");
    expect(code).toContain("RAISE EXCEPTION 'HOSPITAL_BAG_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).toMatch(/guarded_relations\s+WHERE schema_name = 'public' AND table_name = 'hospital_bag_items'\) <> 1/);
    expect(code).toMatch(/tg\.tgname IN \('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate'\)\) <> 3/);
    expect(code.indexOf('HOSPITAL_BAG_EXISTING_ENROLLMENT_INCOMPLETE')).toBeLessThan(code.indexOf('ALTER TABLE'));
  });

  it('leaves the triggers, enrollment, grants and existing policies alone', () => {
    expect(code).not.toMatch(/DROP TRIGGER|CREATE TRIGGER|INSERT INTO _anacan_gcp_migration/);
    expect(code).not.toMatch(/\b(GRANT|REVOKE|ROW LEVEL SECURITY)\b/);
    expect(code).not.toMatch(/DROP (TABLE|COLUMN)/);
    const dropped = [...code.matchAll(/DROP POLICY IF EXISTS "([^"]+)"/g)].map((m) => m[1]);
    expect(dropped).toEqual(['Partners can delete custom hospital bag items']);
  });

  it('lets the partner delete only own items of the linked mother', () => {
    expect(code).toMatch(/FOR DELETE\s+USING \(\s+\(item_id LIKE 'custom:%' OR item_id LIKE 'partner-%'\)\s+AND user_id IN \(/);
    expect(code).toContain('WHERE p.linked_partner_id = me.id');
  });

  it('accepts every category the app writes and adds is_hidden with a default', () => {
    expect(code).toContain("CHECK (category IN ('mom', 'baby', 'documents', 'partner'))");
    for (const category of BAG_CATEGORIES) expect(code).toContain(`'${category}'`);
    expect(code).toContain('ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false');
  });

  it('is one transaction with no cron or timer', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
  });
});
