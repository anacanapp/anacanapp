import { beforeEach, expect, it, vi } from 'vitest';
import { readCommunityPostMarkers } from './useUnreadCommunityPosts';

const mocks = vi.hoisted(() => ({ from: vi.fn(), batches: [] as string[][] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.batches = [];
  mocks.from.mockImplementation(() => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn((_column, ids: string[]) => {
      mocks.batches.push(ids);
      return Promise.resolve({ data: [{ post_id: ids[0] }], error: null });
    }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    return query;
  });
});

it('hydrates all 500 markers without sending an overlong UUID request', async () => {
  const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const seen = await readCommunityPostMarkers('fixture-user', ids);
  expect(mocks.batches.flat()).toEqual(ids);
  expect(mocks.batches).toHaveLength(5);
  expect(mocks.batches.every(batch => batch.length <= 100)).toBe(true);
  expect(Object.keys(seen)).toEqual([ids[0], ids[100], ids[200], ids[300], ids[400]]);
});

it('does not query an empty marker set', async () => {
  expect(await readCommunityPostMarkers('fixture-user', [])).toEqual({});
  expect(mocks.from).not.toHaveBeenCalled();
});

it('does not turn a failed batch into missing read markers', async () => {
  mocks.from.mockImplementation(() => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    return query;
  });
  await expect(readCommunityPostMarkers('fixture-user', ['fixture-post'])).rejects.toEqual({ code: '42501' });
});
