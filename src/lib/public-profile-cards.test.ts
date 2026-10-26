import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicProfileCard, getPublicProfileCards } from './public-profile-cards';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), in: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), rpc: vi.fn()
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));

const coreFields = 'user_id, name, avatar_url, badge_type, life_stage, is_premium, created_at';
const coreCard = {
  user_id: 'u1', name: 'Ayla', avatar_url: '/avatar.png', badge_type: 'admin',
  life_stage: 'mommy', is_premium: true, created_at: '2026-09-01T00:00:00Z'
};
const card = { ...coreCard, is_verified: true, verified_until: '2027-09-01T00:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.in, eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('skips database requests for empty IDs', async () => {
  await expect(getPublicProfileCards([])).resolves.toEqual({});
  await expect(getPublicProfileCards(['', ''])).resolves.toEqual({});
  await expect(getPublicProfileCard('')).resolves.toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});

it('uses authoritative premium/role data and batches large author sets', async () => {
  const ids = Array.from({ length: 205 }, (_, index) => `u${index}`);
  mocks.rpc.mockImplementation(async (_name, { p_user_ids }) => ({ data: p_user_ids.map((id: string) => ({
    ...coreCard, user_id: id, badge_type: 'premium', is_premium: true, can_share_links: false,
  })), error: null }));
  const cards = await getPublicProfileCards(ids);
  expect(Object.keys(cards)).toHaveLength(205);
  expect(mocks.rpc).toHaveBeenCalledTimes(3);
  expect(mocks.rpc.mock.calls.every(call => call[1].p_user_ids.length <= 100)).toBe(true);
  expect(cards.u0).toMatchObject({ is_premium: true, badge_type: 'premium', can_share_links: false });
  expect(mocks.from).not.toHaveBeenCalled();
});

it('does not fall back to stale badges on an authorization/server failure', async () => {
  const error = { code: '42501' };
  mocks.rpc.mockResolvedValue({ data: null, error });
  await expect(getPublicProfileCards(['u1'])).rejects.toBe(error);
  expect(mocks.from).not.toHaveBeenCalled();
});

describe.each(['bulk', 'single'] as const)('%s profile lookup', (mode) => {
  const response = mode === 'bulk' ? mocks.in : mocks.maybeSingle;
  const load = () => mode === 'bulk'
    ? getPublicProfileCards(['u1', '', 'u1', 'u2'])
    : getPublicProfileCard('u1');
  const logLabel = mode === 'bulk' ? 'Public profiles bulk fetch error:' : 'Public profile fetch error:';

  it('keeps full profile fields and deduplicates bulk IDs', async () => {
    const secondCard = { ...card, user_id: 'u2', name: 'Maya' };
    response.mockResolvedValue({ data: mode === 'bulk' ? [card, secondCard] : card, error: null });

    await expect(load()).resolves.toEqual(mode === 'bulk' ? { u1: card, u2: secondCard } : card);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('public_profile_cards');
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith(`${coreFields}, is_verified, verified_until`);
    if (mode === 'bulk') expect(mocks.in).toHaveBeenCalledExactlyOnceWith('user_id', ['u1', 'u2']);
    else expect(mocks.eq).toHaveBeenCalledExactlyOnceWith('user_id', 'u1');
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    { code: '42703', message: 'column public_profile_cards.is_verified does not exist' },
    { code: '42703', message: 'column public_profile_cards.verified_until does not exist' },
    { code: 'PGRST204', message: "Could not find the 'is_verified' column in the schema cache" },
    { code: 'PGRST204', details: "Could not find the 'verified_until' column in the schema cache" }
  ])('retries only the core projection for $code: $message $details', async (error) => {
    response.mockResolvedValueOnce({ data: null, error });
    response.mockResolvedValueOnce({ data: mode === 'bulk' ? [coreCard] : coreCard, error: null });

    await expect(load()).resolves.toEqual(mode === 'bulk' ? { u1: coreCard } : coreCard);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.select).toHaveBeenNthCalledWith(1, `${coreFields}, is_verified, verified_until`);
    expect(mocks.select).toHaveBeenNthCalledWith(2, coreFields);
    if (mode === 'bulk') expect(mocks.in).toHaveBeenNthCalledWith(2, 'user_id', ['u1', 'u2']);
    else expect(mocks.eq).toHaveBeenNthCalledWith(2, 'user_id', 'u1');
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    { code: '42703', message: 'column name does not exist', hint: 'Perhaps you meant is_verified' },
    { code: 'PGRST204', message: "Could not find the 'avatar_url' column" },
    { code: 'PGRST204', message: "Could not find the 'old_is_verified' column" },
    { code: '42501', message: 'permission denied for is_verified' },
    { code: '42P01', message: 'relation public_profile_cards does not exist' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: '', message: 'Failed to fetch' }
  ])('throws without fallback or row logging for $code: $message', async (failure) => {
    const error = { ...failure, details: 'private row contents' };
    response.mockResolvedValue({ data: null, error });

    await expect(load()).rejects.toBe(error);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(logLabel, error.code || 'UNKNOWN');
  });

  it('throws and logs only the code when the core retry also fails', async () => {
    const error = { code: '42501', message: 'denied', details: 'private row contents' };
    response.mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column is_verified does not exist' } });
    response.mockResolvedValueOnce({ data: null, error });

    await expect(load()).rejects.toBe(error);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(logLabel, '42501');
  });

  it('propagates rejected requests without retrying the projection', async () => {
    const error = new TypeError('Failed to fetch');
    response.mockRejectedValue(error);
    await expect(load()).rejects.toBe(error);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it('keeps legitimate empty responses empty', async () => {
    response.mockResolvedValue({ data: mode === 'bulk' ? [] : null, error: null });
    await expect(load()).resolves.toEqual(mode === 'bulk' ? {} : null);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });
});
