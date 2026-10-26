import { afterEach, expect, it, vi } from 'vitest';
import { QuotaStorage } from '@/test/quota-storage';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('does not reject login/logout callbacks when the UI snapshot cannot be persisted', async () => {
  vi.resetModules();
  const storage = new QuotaStorage();
  storage.setItem('admin_draft_article', 'valuable-unsaved-work');
  storage.limit = storage.size;
  vi.stubGlobal('localStorage', storage);
  const { useUserStore } = await import('./userStore');
  expect(() => useUserStore.getState().setAuth(true, 'fixture-user', 'fixture@example.invalid', 'Fixture')).not.toThrow();
  expect(useUserStore.getState()).toMatchObject({ isAuthenticated: true, userId: 'fixture-user' });
  expect(() => useUserStore.getState().logout()).not.toThrow();
  expect(useUserStore.getState()).toMatchObject({ isAuthenticated: false, userId: null });
  expect(storage.getItem('admin_draft_article')).toBe('valuable-unsaved-work');
});
