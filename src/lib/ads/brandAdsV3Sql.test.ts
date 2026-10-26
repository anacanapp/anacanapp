import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { K_ANONYMITY, NATIVE_TEMPLATES } from './brandTargeting';

const sql = readFileSync('supabase/migrations/20261022120000_brand_ads_v3.sql', 'utf8');
/** Executable SQL only: header/inline comments document operator steps and must not trip the guards. */
const stripComments = (text: string) => text.replace(/--.*$/gm, '');
const code = stripComments(sql);
const manifest = JSON.parse(readFileSync('supabase/migrations/20261022120000_brand_ads_v3.cdc.json', 'utf8'));
const body = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('END $$;', start) + 7);
};

describe('anacan-brand-ads-v3 SQL (file only, never applied from the app workspace)', () => {
  it('enrolls every new or changed relation for CDC and writer guarding', () => {
    const touched = new Set([...sql.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE) public\.([a-z_]+)/g)].map(match => `public.${match[1]}`));
    const enrolled = new Map(manifest.relations.map((item: any) => [item.relation, item]));
    for (const relation of touched) {
      expect(enrolled.get(relation), relation).toMatchObject({ cdc: true, writer_guard: true });
    }
    expect([...enrolled.keys()].sort()).toEqual([...touched].sort());
  });
  it('adds no cron/timer and does not replay Source cutover steps', () => {
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
    expect(code).not.toMatch(/(?:capture|apply|freeze|seal)_source|activate_cutover|source_writer|_anacan_source_sync/i);
    expect(sql).toMatch(/^BEGIN;/m); expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });
  it('keeps new relations private: RLS on, no table grants, RPC-only access', () => {
    for (const table of ['ad_lead_forms', 'ad_leads', 'ad_creative_drafts']) expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    expect(sql).toContain('REVOKE ALL ON public.ad_lead_forms, public.ad_leads, public.ad_creative_drafts FROM PUBLIC, anon, authenticated, service_role;');
    expect(sql).not.toMatch(/GRANT [^;]* TO anon/);
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE)/);
  });
  it('pins search_path on every SECURITY DEFINER function', () => {
    const definers = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([^]*?AS \$\$/g)].filter(match => match[0].includes('SECURITY DEFINER'));
    expect(definers.length).toBeGreaterThan(10);
    for (const match of definers) expect(match[0], match[1]).toMatch(/SET search_path (?:= pg_catalog, public|TO 'pg_catalog', 'public')/);
  });
  it('stores no profile or health attribute with a lead and never returns answers to administrators', () => {
    const leads = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.ad_leads'), sql.indexOf(');', sql.indexOf('CREATE TABLE IF NOT EXISTS public.ad_leads')));
    expect(leads).not.toMatch(/stage|week|child|premium|tier|country|birth|due/);
    expect(stripComments(body('admin_brand_review_queue_v1'))).not.toMatch(/ad_leads|answers/);
    expect(body('brand_leads_v1')).toMatch(/ad_brand_members WHERE brand_id = p_brand AND user_id = auth\.uid\(\) AND is_active/);
    expect(body('brand_leads_v1')).toMatch(/INSERT INTO public\.ad_brand_audit/);
    expect(sql).toMatch(/actor_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/retention_days smallint NOT NULL DEFAULT 90 CHECK \(retention_days BETWEEN 1 AND 90\)/);
  });
  it('keeps only coarse audience buckets on receipts and enforces k-anonymity in the report', () => {
    const issue = body('issue_brand_ad_delivery_v2');
    expect(issue).toMatch(/'week_bucket', v_facts->'week_bucket'/);
    expect(issue).not.toMatch(/'week', v_facts->'week'|'child_days'/);
    const report = body('brand_audience_report_v1');
    expect(report).toContain(`k constant integer := ${K_ANONYMITY};`);
    expect(report).toMatch(/count\(DISTINCT/); expect(report).toMatch(/Complementary suppression/);
    expect(report).toMatch(/PERFORM public\.brand_ads_access_v1\(p_brand\)/);
    expect(report).toMatch(/p_to - p_from < 6/);
  });
  it('enrolls new relations in the live CDC/writer-guard catalog and keeps the live measurement vocabulary', () => {
    for (const trigger of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(`CREATE TRIGGER ${trigger}`);
    expect(code).toMatch(/INSERT INTO _anacan_gcp_migration\.guarded_relations \(schema_name, table_name, primary_key\)/);
    expect(code).toContain("RAISE EXCEPTION 'BRAND_ADS_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(body('record_brand_ad_event_v2')).toMatch(/'interaction' ELSE 'visible'/);
    expect(code).not.toMatch(/'viewable'/);
    expect(body('brand_banner_eligible_v1')).toMatch(/IF coalesce\(b\.requires_v3,false\) THEN RETURN false; END IF;/);
    expect(code).toMatch(/OWNER TO pgadmin/);
    expect(code).toMatch(/INSERT INTO public\.ad_brand_audit \(id, /);
  });
  it('uses the same template list as the client and evaluates targeting server-side', () => {
    const list = NATIVE_TEMPLATES.map(item => `'${item}'`).join(',');
    expect(sql).toContain(`native_template IN (${list})`);
    expect(body('get_banner_inventory_v3')).toMatch(/auth\.uid\(\) IS DISTINCT FROM p_actor/);
    expect(body('get_banner_inventory_v3')).toMatch(/brand_banner_eligible_v3/);
    expect(body('brand_banner_eligible_v3')).toMatch(/brand_ads_targeting_matches_v1/);
    expect(sql).toMatch(/CREATE POLICY banners_v3_hidden_from_legacy ON public\.banners AS RESTRICTIVE FOR SELECT/);
  });
});
