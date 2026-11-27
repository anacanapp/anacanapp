import { describe, it, expect, beforeEach } from 'vitest';
import {
  newKickSession,
  kickElapsedSeconds,
  loadActiveKickSession,
  saveActiveKickSession,
  kickSessionDayKey,
  KICK_SESSION_MAX_AGE_MS,
} from './kickSession';

const NOW = new Date(2026, 10, 8, 12, 0, 0).getTime();

describe('kick session', () => {
  beforeEach(() => localStorage.clear());

  it('every start is a fresh session: count 0 and a new start time', () => {
    const s = newKickSession(NOW);
    expect(s).toEqual({ startedAt: NOW, kicks: 0 });
    expect(newKickSession(NOW + 5000).startedAt).toBe(NOW + 5000);
  });

  it('elapsed time comes from the start timestamp (survives a locked screen)', () => {
    const s = newKickSession(NOW);
    // 10 minutes pass with no timer ticks at all
    expect(kickElapsedSeconds(s, NOW + 10 * 60 * 1000)).toBe(600);
    expect(kickElapsedSeconds(s, NOW - 1000)).toBe(0);
    expect(kickElapsedSeconds(null, NOW)).toBe(0);
  });

  it('persists an unfinished session per user and clears it', () => {
    saveActiveKickSession('u1', { startedAt: NOW, kicks: 4, position: 'left' });
    expect(loadActiveKickSession('u1', NOW + 1000)).toEqual({ startedAt: NOW, kicks: 4, position: 'left' });
    expect(loadActiveKickSession('u2', NOW + 1000)).toBeNull();
    saveActiveKickSession('u1', null);
    expect(loadActiveKickSession('u1', NOW + 1000)).toBeNull();
  });

  it('drops stale or corrupt stored sessions', () => {
    saveActiveKickSession('u1', { startedAt: NOW, kicks: 2 });
    expect(loadActiveKickSession('u1', NOW + KICK_SESSION_MAX_AGE_MS + 1)).toBeNull();
    localStorage.setItem('anacan_kick_active_v1:u1', '{"startedAt":"x","kicks":1}');
    expect(loadActiveKickSession('u1', NOW)).toBeNull();
    localStorage.setItem('anacan_kick_active_v1:u1', 'not json');
    expect(loadActiveKickSession('u1', NOW)).toBeNull();
  });

  it('groups saved sessions by the local day of created_at', () => {
    // 01:30 local in Baku (UTC+4) is the previous day in UTC; it must count as today.
    const createdLocal = new Date(2026, 10, 8, 1, 30, 0);
    expect(kickSessionDayKey({ created_at: createdLocal.toISOString(), session_date: '2026-11-07' })).toBe('2026-11-08');
    expect(kickSessionDayKey({ created_at: 'bad', session_date: '2026-11-07' })).toBe('2026-11-07');
  });
});
