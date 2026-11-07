import { beforeEach, describe, expect, it, vi } from 'vitest';
// The Deno module takes its Supabase client, auth and env as injected deps (no npm:/Deno globals).
import {
  FANOUT_BUDGET_MS, FANOUT_CONCURRENCY, handleInteractionPush, type InteractionPushDeps,
} from '../../supabase/functions/_shared/interaction-push';

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;

/** Minimal in-memory PostgREST-style client covering the calls interaction-push makes. */
function fakeDb(tables: Record<string, Row[]>) {
  const claims = new Set<string>();
  const calls = { claims: [] as Row[], inserts: [] as Row[] };
  let ids = 0;
  const query = (table: string) => {
    const filters: Filter[] = [];
    let range: [number, number] | null = null;
    let limit = Infinity;
    let inserted: Row | null = null;
    let remove = false;
    const rows = () => {
      if (inserted) return [inserted];
      let result = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
      if (remove) { tables[table] = (tables[table] ?? []).filter((row) => !result.includes(row)); return []; }
      if (range) result = result.slice(range[0], range[1] + 1);
      return result.slice(0, limit);
    };
    const builder: any = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return builder; },
      neq: (key: string, value: unknown) => { filters.push((row) => row[key] !== value); return builder; },
      gte: (key: string, value: string) => { filters.push((row) => row[key] >= value); return builder; },
      gt: (key: string, value: string) => { filters.push((row) => row[key] > value); return builder; },
      lte: (key: string, value: string) => { filters.push((row) => row[key] <= value); return builder; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return builder; },
      is: (key: string, value: unknown) => { filters.push((row) => (row[key] ?? null) === value); return builder; },
      order: () => builder,
      limit: (count: number) => { limit = count; return builder; },
      range: (from: number, to: number) => { range = [from, to]; return builder; },
      insert: (row: Row) => { inserted = { id: `log-${++ids}`, ...row }; calls.inserts.push(inserted); (tables[table] ??= []).push(inserted); return builder; },
      delete: () => { remove = true; return builder; },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  };
  return {
    calls,
    client: {
      from: query,
      rpc: (name: string, args: Row) => {
        expect(name).toBe('claim_communication_notification_v2');
        calls.claims.push(args);
        const key = `${args.p_interaction_id}|${args.p_target_user_id}|${args.p_kind}`;
        if (claims.has(key)) return Promise.resolve({ data: false, error: null });
        claims.add(key);
        return Promise.resolve({ data: true, error: null });
      },
    },
  };
}

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SENDER = uid(1);
const GROUP = uid(900);
const MESSAGE = uid(901);
const NOW = Date.parse('2026-11-07T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function world(memberCount = 3) {
  const members = Array.from({ length: memberCount }, (_, i) => uid(10 + i));
  const tables: Record<string, Row[]> = {
    community_groups: [{ id: GROUP, name: 'Mamas', is_active: true }],
    group_memberships: [SENDER, ...members].map((user_id) => ({ group_id: GROUP, user_id, joined_at: iso(-86_400_000) })),
    group_messages: [{ id: MESSAGE, group_id: GROUP, sender_id: SENDER, content: 'Salam', message_type: 'text', created_at: iso(-60_000) }],
    profiles: [{ user_id: SENDER, name: 'Aysel' }],
    user_preferences: [],
    device_tokens: members.map((user_id, i) => ({ id: `t${i}`, user_id, token: `token-${user_id}`, created_at: iso(-1) })),
    notification_send_log: [],
  };
  return { members, tables };
}

function deps(db: ReturnType<typeof fakeDb>, callerId = SENDER, overrides: Partial<InteractionPushDeps> = {}) {
  const fcm = vi.fn(async (_url: string, init: RequestInit) => new Response('{}', { status: 200 }));
  const value: InteractionPushDeps = {
    requireUser: async () => ({ user: { id: callerId }, error: null }),
    serviceClient: () => db.client,
    env: (name) => (name === 'FIREBASE_SERVICE_ACCOUNT_JSON' ? '{}' : undefined),
    firebaseAccessToken: vi.fn(async () => ({ accessToken: 'access', projectId: 'project' })),
    fetch: fcm as unknown as typeof fetch,
    now: () => NOW,
    ...overrides,
  };
  return { value, fcm };
}

const request = (body: unknown) => new Request('https://api.test/functions/v1/send-push-notification', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});
const single = (userId: string, overrides: Row = {}) => request({ userId, title: 'Yeni mesaj', body: 'Salam', data: {
  type: 'group_message', context: 'group_message', groupId: GROUP, messageId: MESSAGE, interactionId: MESSAGE, ...overrides,
} });
const fanout = (overrides: Row = {}, userId = SENDER) => request({ userId, title: 'Yeni mesaj', body: 'Salam', data: {
  type: 'group_message_fanout', context: 'group_message_fanout', groupId: GROUP, messageId: MESSAGE, interactionId: MESSAGE, ...overrides,
} });
const call = async (req: Request, d: InteractionPushDeps) => {
  const response = await handleInteractionPush(req, d);
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom's AbortSignal has no timeout(); Deno does.
  if (typeof (AbortSignal as any).timeout !== 'function') (AbortSignal as any).timeout = () => new AbortController().signal;
});

describe('group_message (per-member, old clients)', () => {
  it('sends to a current member with the group title and message data', async () => {
    const { members, tables } = world(1);
    const db = fakeDb(tables);
    const { value, fcm } = deps(db);
    expect(await call(single(members[0]), value)).toEqual({ status: 200, body: { success: true, sent: 1, failed: 0 } });
    const message = JSON.parse(String(fcm.mock.calls[0][1].body)).message;
    expect(message.notification).toEqual({ title: 'Mamas', body: 'Aysel: Salam' });
    expect(message.data).toEqual({ context: 'group_message', type: 'group_message', groupId: GROUP, interactionId: MESSAGE, sender_id: SENDER, messageId: MESSAGE });
  });

  it('answers 200 not_member (no claim, no send) when only the target is not a member', async () => {
    const { tables } = world(1);
    const db = fakeDb(tables);
    const { value, fcm } = deps(db);
    expect(await call(single(uid(77)), value)).toEqual({ status: 200, body: { success: true, sent: 0, skipped: 'not_member' } });
    expect(db.calls.claims).toHaveLength(0);
    expect(fcm).not.toHaveBeenCalled();
  });

  it('treats a member who joined after the message as not_member', async () => {
    const { members, tables } = world(1);
    tables.group_memberships.find((row) => row.user_id === members[0])!.joined_at = iso(-1000);
    expect((await call(single(members[0]), deps(fakeDb(tables)).value)).body).toMatchObject({ skipped: 'not_member' });
  });

  it.each([
    ['a non-member sender', (t: Record<string, Row[]>) => { t.group_memberships = t.group_memberships.filter((row) => row.user_id !== SENDER); }],
    ['an unknown group', (t: Record<string, Row[]>) => { t.community_groups = []; }],
    ['an inactive group', (t: Record<string, Row[]>) => { t.community_groups[0].is_active = false; }],
    ['an unknown message', (t: Record<string, Row[]>) => { t.group_messages = []; }],
    ['another sender\'s message', (t: Record<string, Row[]>) => { t.group_messages[0].sender_id = uid(10); }],
    ['a message older than 15 minutes', (t: Record<string, Row[]>) => { t.group_messages[0].created_at = iso(-901_000); }],
  ])('keeps 403 for %s, even when the target is also not a member', async (_label, mutate) => {
    const { members, tables } = world(1);
    mutate(tables);
    for (const target of [members[0], uid(77)]) {
      expect(await call(single(target), deps(fakeDb(tables)).value)).toEqual({ status: 403, body: { error: 'no_verified_interaction' } });
    }
  });

  it('keeps 403 when interactionId and messageId name different rows', async () => {
    const { members, tables } = world(1);
    expect((await call(single(members[0], { interactionId: uid(555) }), deps(fakeDb(tables)).value)).status).toBe(403);
  });
});

describe('group_message_fanout', () => {
  it('pushes every current member except the sender through the per-member pipeline', async () => {
    const { members, tables } = world(3);
    tables.group_memberships.push({ group_id: GROUP, user_id: uid(50), joined_at: iso(-1000) }); // joined after the message
    tables.user_preferences.push({ user_id: members[1], push_enabled: false });
    tables.device_tokens = tables.device_tokens.filter((row) => row.user_id !== members[2]);
    const db = fakeDb(tables);
    const { value, fcm } = deps(db);
    const result = await call(fanout(), value);
    expect(result).toEqual({ status: 200, body: {
      ok: true, success: true, sent: 1, recipients: 4, delivered: 1,
      skipped: { not_member: 1, preferences_disabled: 1, no_device_tokens: 1 },
    } });
    expect(db.calls.claims.map((claim) => claim.p_target_user_id).sort()).toEqual(members.slice().sort());
    expect(db.calls.claims.every((claim) => claim.p_kind === 'group_message' && claim.p_interaction_id === MESSAGE)).toBe(true);
    expect(fcm).toHaveBeenCalledOnce();
    const message = JSON.parse(String(fcm.mock.calls[0][1].body)).message;
    expect(message.token).toBe(`token-${members[0]}`);
    expect(message.data).toEqual({ context: 'group_message', type: 'group_message', groupId: GROUP, interactionId: MESSAGE, sender_id: SENDER, messageId: MESSAGE });
    expect(db.calls.inserts).toEqual([expect.objectContaining({ user_id: members[0], notification_type: 'group_message', status: 'sent', source_notification_id: MESSAGE })]);
  });

  it('builds the same claim (title, body, data) as the per-member call, so the two paths dedup', async () => {
    const { members, tables } = world(2);
    const db = fakeDb(tables);
    const { value, fcm } = deps(db);
    expect((await call(single(members[0]), value)).body).toMatchObject({ sent: 1 });
    expect((await call(fanout(), value)).body).toMatchObject({ sent: 1, delivered: 1, skipped: { duplicate: 1 } });
    expect((await call(single(members[1]), value)).body).toMatchObject({ sent: 0, skipped: 'duplicate' });
    expect(fcm).toHaveBeenCalledTimes(2);
    const [oldClaim, ...later] = db.calls.claims;
    expect(later.filter((claim) => claim.p_target_user_id === members[0])).toEqual([oldClaim]);
  });

  it('runs at most FANOUT_CONCURRENCY deliveries at once and pages over 1000 members', async () => {
    const { tables } = world(1100);
    let active = 0;
    let peak = 0;
    const slow = vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active--;
      return new Response('{}', { status: 200 });
    });
    const db = fakeDb(tables);
    const result = await call(fanout(), deps(db, SENDER, { fetch: slow as unknown as typeof fetch }).value);
    expect(result.body).toMatchObject({ ok: true, sent: 1100, recipients: 1100, skipped: {} });
    expect(peak).toBeLessThanOrEqual(FANOUT_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });

  it('stops starting new recipients after the time budget and reports them', async () => {
    const { tables } = world(20);
    let clock = NOW;
    const db = fakeDb(tables);
    const fcm = vi.fn(async () => { clock += FANOUT_BUDGET_MS / 10; return new Response('{}', { status: 200 }); });
    const result = await call(fanout(), deps(db, SENDER, { fetch: fcm as unknown as typeof fetch, now: () => clock }).value);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.sent + result.body.skipped.deadline).toBe(20);
    expect(result.body.skipped.deadline).toBeGreaterThan(0);
  });

  it('counts per-recipient failures without failing the whole fan-out', async () => {
    const { tables } = world(2);
    const fcm = vi.fn(async () => new Response(JSON.stringify({ error: { status: 'INTERNAL' } }), { status: 500 }));
    const result = await call(fanout(), deps(fakeDb(tables), SENDER, { fetch: fcm as unknown as typeof fetch }).value);
    expect(result).toEqual({ status: 200, body: { ok: false, success: false, sent: 0, recipients: 2, delivered: 0, skipped: { fcm_failed: 2 } } });
  });

  it.each([
    ['userId is not the caller', fanout({}, uid(10))],
    ['the caller is not the sender', null],
    ['the message is too old', 'old'],
    ['interactionId differs from messageId', fanout({ interactionId: uid(555) })],
  ])('answers 403 when %s', async (_label, variant) => {
    const { members, tables } = world(2);
    let callerId = SENDER;
    let req = variant instanceof Request ? variant : fanout();
    if (variant === null) { callerId = members[0]; req = fanout({}, members[0]); }
    if (variant === 'old') tables.group_messages[0].created_at = iso(-901_000);
    const db = fakeDb(tables);
    expect(await call(req, deps(db, callerId).value)).toEqual({ status: 403, body: { error: 'no_verified_interaction' } });
    expect(db.calls.claims).toHaveLength(0);
  });

  it('answers 403 when the sender is no longer a member', async () => {
    const { tables } = world(2);
    tables.group_memberships = tables.group_memberships.filter((row) => row.user_id !== SENDER);
    expect((await call(fanout(), deps(fakeDb(tables)).value)).status).toBe(403);
  });

  it('rejects unknown fields and a context/type mismatch as before', async () => {
    const { tables } = world(1);
    const d = deps(fakeDb(tables)).value;
    expect((await call(fanout({ sender_id: SENDER }), d)).body).toEqual({ error: 'unsupported_data_field' });
    expect((await call(fanout({ context: 'group_message' }), d)).body).toEqual({ error: 'unsupported_context_or_type' });
  });
});
