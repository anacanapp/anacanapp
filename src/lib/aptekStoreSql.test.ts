import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261027090000_aptek_store.sql', 'utf8');
/** Executable SQL only: comments document operator steps and must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261027090000_aptek_store.cdc.json', 'utf8'));
const body = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5) + 3);
};

describe('anacan-aptek-store SQL (file only, applied by the operator)', () => {
  it('declares every written relation in the CDC manifest and refuses to run unguarded', () => {
    const touched = new Set([...code.matchAll(/(?:ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`));
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const relation of touched) expect(declared.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true });
    expect(code).toContain("RAISE EXCEPTION 'APTEK_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code).not.toMatch(/CREATE TABLE/);
  });

  it('is one transaction with no cron and no change to the public setting allowlist', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
    expect(code).not.toMatch(/get_public_app_setting/);
  });

  it('keeps checkout authenticated-only and prices on the server', () => {
    expect(code).toContain('REVOKE ALL ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text) FROM PUBLIC, anon;');
    expect(code).toContain('GRANT EXECUTE ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text) TO authenticated;');
    const checkout = body('place_aptek_order');
    expect(checkout).toContain('SECURITY DEFINER');
    expect(checkout).toMatch(/SET search_path = pg_catalog, public, pg_temp/);
    expect(checkout).toContain('auth.uid()');
    // Unit prices come from products, never from the request payload.
    expect(checkout).toMatch(/SELECT p\.id, p\.sku, p\.name, p\.price, i\.qty/);
    expect(checkout).not.toMatch(/e->>'price'|e->>'unit_price'/);
    expect(checkout).toContain('FOR UPDATE');
  });

  it('seeds the catalogue idempotently and leaves the store disabled', () => {
    expect(code).toContain('ON CONFLICT (sku) WHERE sku IS NOT NULL DO UPDATE');
    expect(code).toMatch(/'enabled', false/);
    expect((code.match(/'\/aptek\/\d+_0\.webp'/g) || []).length).toBeGreaterThanOrEqual(52);
    expect(code).toMatch(/'60956'[^\n]*'infant_formula'/);
  });

  it('ships every referenced product image with the app', () => {
    const files = new Set(readFileSync('supabase/migrations/20261027090000_aptek_store.sql', 'utf8').match(/\/aptek\/[\w.]+\.webp/g));
    for (const f of files) expect(() => readFileSync(`public${f}`), f).not.toThrow();
  });
});
