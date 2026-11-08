// Deno edge helper; Deno.env is only read inside the senders, which these tests don't call.
declare global { const Deno: { env: { get(name: string): string | undefined } } }
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { endsText, nudgeCopy, nudgeEmailHtml, nudgeLink } from '../../supabase/functions/_shared/web-premium-nudge';

describe('abandoned web checkout reminder', () => {
  const ends = '2026-11-08T19:59:59Z'; // 23:59 Baku

  it('says "bu gün" on the last day and the date before it', () => {
    expect(endsText(ends, new Date('2026-11-08T10:00:00Z'))).toBe('bu gün saat 23:59-da');
    expect(endsText(ends, new Date('2026-11-07T10:00:00Z'))).toMatch(/^8 noyabr saat 23:59-da$/);
    expect(endsText(null)).toBeNull();
    expect(endsText('not a date')).toBeNull();
  });

  it('keeps the copy plain: no long dashes, plan named, campaign end in the push', () => {
    const copy = nudgeCopy('yearly', ends, new Date('2026-11-08T10:00:00Z'));
    const all = Object.values(copy).join(' ');
    expect(all).not.toMatch(/[—–]/);
    expect(copy.body).toContain('illik plan');
    expect(copy.pushBody).toBe('Endirim bu gün saat 23:59-da bitir. Ödənişi bir dəqiqəyə tamamla.');
    expect(nudgeCopy('monthly', null).body).toContain('hələ qüvvədədir');
  });

  it('links to the campaign page with reminder UTM tags and escapes the copy', () => {
    expect(nudgeLink('push')).toBe('https://anacan.az/website/premium/kampaniya/index.html?utm_source=push&utm_medium=reminder&utm_campaign=checkout_nudge');
    const html = nudgeEmailHtml({ ...nudgeCopy('monthly', ends), heading: '<b>x</b>' }, nudgeLink('email'));
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('utm_source=email');
  });

  it('migration claims only real, abandoned, unreminded checkouts and is CDC-guarded', () => {
    const sql = readFileSync('supabase/migrations/20261108070000_web_premium_checkout_nudge.sql', 'utf8');
    for (const rule of ["l.status = 'failed'", 'l.amount >= 1', "interval '30 minutes'", "interval '24 hours'", "p.status = 'pending'",
      "interval '7 days'", "cur.plan_type <> 'free'", 'ON CONFLICT (charge_id) DO NOTHING', 'anacan_gcp_writer_guard', 'capture_change']) {
      expect(sql).toContain(rule);
    }
    const cdc = JSON.parse(readFileSync('supabase/migrations/20261108070000_web_premium_checkout_nudge.cdc.json', 'utf8'));
    expect(cdc.relations[0]).toMatchObject({ relation: 'public.web_premium_checkout_nudges', cdc: true, writer_guard: true });
  });
});
