import { describe, expect, it } from 'vitest';
import { advanceAdCadence, consumeAdCadence } from './cadence';

describe('story/game advertisement cadence', () => {
  it('requires two different finished rounds and ignores duplicate completion callbacks', () => {
    const first = advanceAdCadence({ count: 0, seen: [] }, 'round-one', 2);
    expect(first.due).toBe(false);
    expect(advanceAdCadence(first.state, 'round-one', 2).counted).toBe(false);
    const second = advanceAdCadence(first.state, 'round-two', 2);
    expect(second.due).toBe(true);
    const afterAd = consumeAdCadence(second.state);
    expect(afterAd.count).toBe(0);
    expect(advanceAdCadence(afterAd, 'round-two', 2).due).toBe(false);
  });
  it('keeps a missed opportunity due without accumulating a queue of ads', () => {
    let state = { count: 0, seen: [] as string[] };
    for (let i = 0; i < 20; i++) state = advanceAdCadence(state, `story-${i}`, 5).state;
    expect(state.count).toBe(5);
    expect(consumeAdCadence(state).count).toBe(0);
  });
});
