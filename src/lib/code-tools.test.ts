import { describe, expect, it } from 'vitest';
import { isToolRowLive } from './code-tools';

describe('code tool rows', () => {
  it('normal rows need is_active; code rows are live while kept inactive for old builds', () => {
    expect(isToolRowLive({ tool_id: 'kick', is_active: true })).toBe(true);
    expect(isToolRowLive({ tool_id: 'kick', is_active: false })).toBe(false);
    expect(isToolRowLive({ tool_id: 'cakes', is_active: false })).toBe(true);
    expect(isToolRowLive({ tool_id: 'baby-tracker', is_active: false })).toBe(true);
  });
});
