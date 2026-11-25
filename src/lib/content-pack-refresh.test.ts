import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { installContentTranslationRefresh } from './content-pack-refresh';

describe('content pack refresh', () => {
  it('coalesces shard arrivals into one refetch of queries keyed by the current language', async () => {
    vi.useFakeTimers();
    try {
      let emit = () => {};
      const client = new QueryClient();
      client.setQueryData(['recipes', 'fr'], [1]); client.setQueryData(['recipes', 'de'], [1]); client.setQueryData(['profile'], {});
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const stop = installContentTranslationRefresh(client, { subscribe: listener => { emit = listener; return () => {}; }, language: () => 'fr' });
      emit(); emit(); emit();
      await vi.advanceTimersByTimeAsync(400);
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(['recipes', 'fr'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(['recipes', 'de'])?.isInvalidated).toBe(false);
      expect(client.getQueryState(['profile'])?.isInvalidated).toBe(false);
      stop(); client.clear();
    } finally { vi.useRealTimers(); }
  });
});
