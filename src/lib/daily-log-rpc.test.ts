import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, upsert } = vi.hoisted(() => {
  const upsert = vi.fn();
  const from = vi.fn(() => ({ upsert }));
  return { from, upsert };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));

import { DAILY_LOG_OUTBOX_TABLE, sendDailyLogPatch } from './daily-log-rpc';

/** supabase upsert(...).select().maybeSingle(), with an optional .abortSignal() in the chain. */
function chain(result: { data: unknown; error: unknown; status: number }) {
  const link: Record<string, unknown> = {};
  link.select = () => link;
  link.abortSignal = () => link;
  link.maybeSingle = async () => result;
  return link;
}

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockReturnValue(chain({ data: { id: 'row' }, error: null, status: 200 }));
});

describe('sendDailyLogPatch', () => {
  it('uses the daily_logs table token', () => {
    expect(DAILY_LOG_OUTBOX_TABLE).toBe('daily_logs');
  });

  it('merge-upserts on (user_id, log_date), dropping the entry id, water and undefined fields', async () => {
    let captured: { row: Record<string, unknown>; opts: unknown } | undefined;
    upsert.mockImplementation((row: Record<string, unknown>, opts: unknown) => {
      captured = { row, opts };
      return chain({ data: row, error: null, status: 200 });
    });

    const res = await sendDailyLogPatch({
      id: 'entry-uuid', user_id: 'u1', log_date: '2026-11-26',
      mood: 4, symptoms: ['nausea'], notes: null, water_intake: 999, bogus: undefined,
    });

    expect(from).toHaveBeenCalledWith('daily_logs');
    expect(captured?.opts).toEqual({ onConflict: 'user_id,log_date' });
    // Natural key + only patch columns; entry id and water_intake stripped.
    expect(captured?.row).toEqual({ user_id: 'u1', log_date: '2026-11-26', mood: 4, symptoms: ['nausea'], notes: null });
    expect('id' in (captured?.row ?? {})).toBe(false);
    expect('water_intake' in (captured?.row ?? {})).toBe(false);
    expect(res.error).toBeNull();
  });

  it('is idempotent: re-sending the same patch writes the same fields again', async () => {
    const rows: Record<string, unknown>[] = [];
    upsert.mockImplementation((row: Record<string, unknown>) => { rows.push(row); return chain({ data: row, error: null, status: 200 }); });
    const payload = { id: 'e', user_id: 'u1', log_date: '2026-11-26', mood: 2 };
    await sendDailyLogPatch(payload);
    await sendDailyLogPatch(payload);
    expect(rows).toEqual([
      { user_id: 'u1', log_date: '2026-11-26', mood: 2 },
      { user_id: 'u1', log_date: '2026-11-26', mood: 2 },
    ]);
  });

  it('rejects a patch without user_id / log_date before calling the server', async () => {
    const res = await sendDailyLogPatch({ id: 'e', user_id: 'u1' });
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects an empty patch (no writable fields) before calling the server', async () => {
    const res = await sendDailyLogPatch({ id: 'e', user_id: 'u1', log_date: '2026-11-26', water_intake: 5 });
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
