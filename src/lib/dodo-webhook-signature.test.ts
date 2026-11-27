import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// The Deno helper only touches Deno.env inside dodoConfig(); verification is plain Web Crypto.
import { verifyStandardWebhook } from '../../supabase/functions/_shared/dodo';

const secretBytes = randomBytes(24);
const secret = `whsec_${secretBytes.toString('base64')}`;
const sign = (id: string, ts: string, body: string, key = secretBytes) =>
  `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;

describe('Dodo (Standard Webhooks) signature', () => {
  const body = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_1' } });
  const now = 1_793_000_000_000;
  const ts = String(now / 1000);
  const headers = (signature: string, timestamp = ts) => new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': timestamp, 'webhook-signature': signature });

  it('accepts a valid signature, also among several', async () => {
    expect(await verifyStandardWebhook(body, headers(sign('msg_1', ts, body)), secret, now)).toBe(true);
    expect(await verifyStandardWebhook(body, headers(`v1,AAAA ${sign('msg_1', ts, body)}`), secret, now)).toBe(true);
  });

  it('rejects a changed body, another secret, a stale timestamp and missing headers', async () => {
    expect(await verifyStandardWebhook(body + ' ', headers(sign('msg_1', ts, body)), secret, now)).toBe(false);
    expect(await verifyStandardWebhook(body, headers(sign('msg_1', ts, body, randomBytes(24))), secret, now)).toBe(false);
    const old = String(now / 1000 - 600);
    expect(await verifyStandardWebhook(body, headers(sign('msg_1', old, body), old), secret, now)).toBe(false);
    expect(await verifyStandardWebhook(body, new Headers(), secret, now)).toBe(false);
    expect(await verifyStandardWebhook(body, headers(sign('msg_1', ts, body)), '', now)).toBe(false);
  });
});
