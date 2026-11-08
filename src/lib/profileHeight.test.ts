import { describe, expect, it, vi } from 'vitest';
import {
  heightStorageKey, isHeightSynced, markHeightSynced, planHeight, profileHasHeightColumn, readLocalHeight,
  saveProfileHeight, writeLocalHeight } from './profileHeight';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('planHeight', () => {
  it('keeps the device value and uploads nothing while the column does not exist', () => {
    expect(planHeight({ user_id: 'u' }, 165, false)).toEqual({ height: 165, writeLocal: null, upload: null });
    expect(planHeight(null, 165, false)).toEqual({ height: 165, writeLocal: null, upload: null });
  });
  it('uploads a device-only value once when the column exists and is empty', () => {
    expect(planHeight({ height_cm: null }, 165, false)).toEqual({ height: 165, writeLocal: null, upload: 165 });
    expect(planHeight({ height_cm: null }, 165, true)).toEqual({ height: 165, writeLocal: null, upload: null });
  });
  it('prefers the profile value and copies it to the device (numeric may arrive as a string)', () => {
    expect(planHeight({ height_cm: '170.5' }, 165, true)).toEqual({ height: 170.5, writeLocal: 170.5, upload: null });
    expect(planHeight({ height_cm: 170 }, 170, true)).toEqual({ height: 170, writeLocal: null, upload: null });
    expect(planHeight({ height_cm: 170 }, null, false)).toEqual({ height: 170, writeLocal: 170, upload: null });
  });
  it('ignores implausible values', () => {
    expect(planHeight({ height_cm: 90 }, null, false)).toEqual({ height: null, writeLocal: null, upload: null });
    expect(planHeight({ height_cm: null }, 300, false)).toEqual({ height: null, writeLocal: null, upload: null });
  });
  it('detects the column by key presence', () => {
    expect(profileHasHeightColumn({ height_cm: null })).toBe(true);
    expect(profileHasHeightColumn({})).toBe(false);
    expect(profileHasHeightColumn(undefined)).toBe(false);
  });
});

describe('device copy', () => {
  it('reads and writes per user, keeping the existing key', () => {
    const s = memory();
    expect(heightStorageKey('u1')).toBe('anacan:weight-tracker:height-cm:u1');
    writeLocalHeight('u1', 162, s);
    expect(readLocalHeight('u1', s)).toBe(162);
    expect(readLocalHeight('u2', s)).toBeNull();
    s.setItem(heightStorageKey('u3'), 'abc');
    expect(readLocalHeight('u3', s)).toBeNull();
    expect(isHeightSynced('u1', s)).toBe(false);
    markHeightSynced('u1', s);
    expect(isHeightSynced('u1', s)).toBe(true);
  });
  it('survives a throwing storage', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readLocalHeight('u', bad)).toBeNull();
    expect(() => writeLocalHeight('u', 160, bad)).not.toThrow();
    expect(isHeightSynced('u', bad)).toBe(false);
  });
});

describe('saveProfileHeight', () => {
  const client = (result: unknown) => {
    const eq = vi.fn(async () => result);
    const update = vi.fn(() => ({ eq }));
    return { c: { from: vi.fn(() => ({ update })) }, update, eq };
  };
  it('updates profiles.height_cm by user_id', async () => {
    const f = client({ error: null });
    await expect(saveProfileHeight(f.c, 'u1', 168)).resolves.toBe(true);
    expect(f.c.from).toHaveBeenCalledWith('profiles');
    expect(f.update).toHaveBeenCalledWith({ height_cm: 168 });
    expect(f.eq).toHaveBeenCalledWith('user_id', 'u1');
  });
  it('fails quietly on a missing column, invalid input or a thrown error', async () => {
    await expect(saveProfileHeight(client({ error: { code: 'PGRST204' } }).c, 'u1', 168)).resolves.toBe(false);
    await expect(saveProfileHeight(client({ error: null }).c, 'u1', 50)).resolves.toBe(false);
    await expect(saveProfileHeight(client({ error: null }).c, null, 168)).resolves.toBe(false);
    const thrower = { from: () => { throw new Error('offline'); } };
    await expect(saveProfileHeight(thrower, 'u1', 168)).resolves.toBe(false);
  });
});
