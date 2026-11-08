import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261108120000_market_reports_and_height.sql', 'utf8');
/** Executable SQL only: comments must not trip the guards. */
const code = sql.replace(/--.*$/gm, '');
const manifest = JSON.parse(readFileSync('supabase/migrations/20261108120000_market_reports_and_height.cdc.json', 'utf8'));
const NEW = ['market_reports', 'market_blocks'];
const EXISTING = ['profiles', 'marketplace_messages'];

describe('Market reports/blocks + profile height migration (file only, applied by the operator)', () => {
  it('declares every created or changed relation in the CDC manifest with CDC and writer guarding', () => {
    const touched = new Set([
      ...[...code.matchAll(/(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM) public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`),
      ...[...code.matchAll(/CREATE TRIGGER [a-z_]+ BEFORE INSERT ON public\.([a-z_]+)/g)].map((m) => `public.${m[1]}`),
    ]);
    expect([...touched].sort()).toEqual(['public.market_blocks', 'public.market_reports', 'public.marketplace_messages', 'public.profiles']);
    const declared = new Map(manifest.relations.map((r: { relation: string }) => [r.relation, r]));
    for (const t of NEW) expect(declared.get(`public.${t}`), t).toMatchObject({ cdc: true, writer_guard: true, change: 'created' });
    for (const t of EXISTING) expect(declared.get(`public.${t}`), t).toMatchObject({ cdc: true, writer_guard: true, change: 'altered' });
    expect(declared.get('public.profiles')).toMatchObject({ columns_added: ['height_cm'] });
    expect(manifest.migration).toBe('20261108120000_market_reports_and_height.sql');
    expect(manifest.protocol).toBe('anacan-cdc-enrollment-request-v1');
  });

  it('refuses without the guard catalog or when profiles / marketplace_messages are not enrolled, before any change', () => {
    const firstChange = code.indexOf('CREATE TABLE');
    expect(code).toContain("RAISE EXCEPTION 'MARKET_SAFETY_GUARD_CATALOG_MISSING'");
    expect(code.indexOf('MARKET_SAFETY_GUARD_CATALOG_MISSING')).toBeLessThan(firstChange);
    expect(code.indexOf('MARKET_SAFETY_EXISTING_ENROLLMENT_INCOMPLETE')).toBeLessThan(firstChange);
    expect(code).toContain("FOREACH t IN ARRAY ARRAY['profiles', 'marketplace_messages']");
    // Existing relations keep their triggers: never dropped or recreated.
    for (const t of EXISTING) {
      expect(code).not.toMatch(new RegExp(`DROP TRIGGER IF EXISTS anacan_gcp_[a-z_]+ ON public\\.${t}\\b`));
      expect(code).not.toMatch(new RegExp(`\\('public', '${t}'`));
    }
  });

  it('enrolls both new tables with the three standard triggers and verifies 2 relations / 6 triggers', () => {
    expect(code).toMatch(/\('public', 'market_reports', ARRAY\['id'\]\)/);
    expect(code).toMatch(/\('public', 'market_blocks', ARRAY\['id'\]\)/);
    expect(code).toContain("FOREACH t IN ARRAY ARRAY['market_reports', 'market_blocks'] LOOP");
    for (const t of ['anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate']) expect(code).toContain(t);
    expect(code).toContain("RAISE EXCEPTION 'MARKET_SAFETY_GUARD_ENROLLMENT_INCOMPLETE'");
    expect(code.match(/<> 6/g)?.length).toBe(2);
    for (const t of NEW) expect(code).toContain(`ALTER TABLE public.${t} OWNER TO pgadmin`);
  });

  it('lets a reporter insert/read her own reports and admins read/update them', () => {
    expect(code).toContain('ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;');
    expect(code).toContain('REVOKE ALL ON public.market_reports FROM PUBLIC, anon;');
    expect(code).toMatch(/FOR INSERT TO authenticated\s+WITH CHECK \(reporter_id = auth\.uid\(\) AND status = 'pending'/);
    expect(code).toMatch(/market_reports_read_own ON public\.market_reports\s+FOR SELECT TO authenticated\s+USING \(reporter_id = auth\.uid\(\)\)/);
    expect(code).toMatch(/market_reports_admin_read ON public\.market_reports\s+FOR SELECT TO authenticated\s+USING \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
    expect(code).toMatch(/market_reports_admin_update ON public\.market_reports\s+FOR UPDATE TO authenticated\s+USING \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
    expect(code).not.toMatch(/GRANT [^;]*DELETE[^;]*market_reports[^;]*TO authenticated/);
    expect(code).toContain("target_type IN ('listing', 'user', 'conversation')");
    expect(code).toContain("reason IN ('spam', 'scam', 'inappropriate', 'harassment', 'prohibited', 'other')");
    expect(code).toContain('char_length(note) <= 500');
  });

  it('keeps blocks private to the blocker', () => {
    expect(code).toContain('ALTER TABLE public.market_blocks ENABLE ROW LEVEL SECURITY;');
    expect(code).toMatch(/market_blocks_own ON public\.market_blocks\s+FOR ALL TO authenticated\s+USING \(blocker_id = auth\.uid\(\)\)\s+WITH CHECK \(blocker_id = auth\.uid\(\)\)/);
    expect(code).toContain('UNIQUE (blocker_id, blocked_id)');
    expect(code).toContain('CHECK (blocker_id <> blocked_id)');
  });

  it('refuses messages between blocked users on the server (either direction)', () => {
    const fn = /FUNCTION public\.market_message_guard\(\)[\s\S]*?\$function\$;/.exec(code)?.[0] ?? '';
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain("SET search_path TO 'public'");
    expect(fn).toContain('b.blocker_id = NEW.receiver_id AND b.blocked_id = NEW.sender_id');
    expect(fn).toContain('b.blocker_id = NEW.sender_id AND b.blocked_id = NEW.receiver_id');
    expect(fn).toContain("RAISE EXCEPTION 'MARKET_BLOCKED' USING ERRCODE = '42501'");
    expect(code).toMatch(/CREATE TRIGGER market_messages_block_guard BEFORE INSERT ON public\.marketplace_messages\s+FOR EACH ROW EXECUTE FUNCTION public\.market_message_guard\(\);/);
    expect(code).not.toMatch(/(DROP|CREATE) POLICY[^;]*ON public\.marketplace_messages/);
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.market_report_prepare\(\), public\.market_message_guard\(\) FROM PUBLIC, anon, authenticated;/);
  });

  it('fixes the reporter and snapshots evidence in a definer trigger', () => {
    const fn = /FUNCTION public\.market_report_prepare\(\)[\s\S]*?\$function\$;/.exec(code)?.[0] ?? '';
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain('NEW.reporter_id := auth.uid();');
    expect(fn).toContain("NEW.status := 'pending';");
    expect(fn).toContain("RAISE EXCEPTION 'MARKET_REPORT_CONVERSATION_MISSING'");
    expect(fn).toContain('LIMIT 30');
  });

  it('adds the nullable profiles.height_cm with a 120..220 check', () => {
    expect(code).toMatch(/ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS height_cm numeric\(5,1\)\s+CHECK \(height_cm IS NULL OR \(height_cm >= 120 AND height_cm <= 220\)\);/);
    expect(code).not.toMatch(/height_cm[^;]*NOT NULL/);
  });

  it('is one transaction with no cron or timer', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(code.match(/^BEGIN;/gm)?.length).toBe(1);
    expect(code).not.toMatch(/cron\.|pg_cron|schedule\(/i);
  });
});
