import { describe, expect, it } from 'vitest';
import { fromBakuInput, parseRecapConfig, recapOpen, recapWindow, toBakuInput } from './window';

const cfg = { enabled: true, start_at: '2026-12-10T00:00:00+04:00', end_at: '2027-02-28T23:59:59+04:00' };

describe('recap window', () => {
  it('admins follow the shared dates unless they have their own', () => {
    expect(recapOpen(cfg, true, new Date('2026-11-12T10:00:00Z'))).toBe(false);
    expect(recapOpen(cfg, false, new Date('2026-12-10T10:00:00Z'))).toBe(true);
    const own = { ...cfg, admin_start_at: '2026-11-01T00:00:00+04:00' };
    expect(recapOpen(own, true, new Date('2026-11-12T10:00:00Z'))).toBe(true);
    expect(recapOpen(own, false, new Date('2026-11-12T10:00:00Z'))).toBe(false);
    expect(recapWindow(own, true).end).toBe(cfg.end_at);
    expect(recapOpen({ ...cfg, enabled: false }, true, new Date('2026-12-20T10:00:00Z'))).toBe(false);
  });
  it('converts Baku input values', () => {
    expect(toBakuInput('2026-12-10T00:00:00+04:00')).toBe('2026-12-10T00:00');
    expect(fromBakuInput('2026-12-10T00:00')).toBe('2026-12-10T00:00:00+04:00');
    expect(fromBakuInput('')).toBeNull();
    expect(parseRecapConfig(JSON.stringify(cfg)).start_at).toBe(cfg.start_at);
  });
});
