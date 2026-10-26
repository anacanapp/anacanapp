import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecipes } from './useDynamicContent';

const fixture = vi.hoisted(() => ({ from: vi.fn(), bundled: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: fixture.from } }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: (state: { language: string }) => unknown) => select({ language: 'pl' }) }));
vi.mock('@/lib/content-i18n', () => ({ getBundledContentTranslation: fixture.bundled }));
vi.mock('@/lib/i18n', () => ({ getCachedTranslation: () => undefined }));
afterEach(() => vi.resetAllMocks());

describe('localized recipe identity', () => {
  it.each(['server columns', 'source-schema bundle'])('keeps filtering and free-tier grouping stable with %s', async transport => {
    const translated = { title: 'Owsianka', category: 'Śniadania', ingredients: ['Płatki owsiane'], instructions: ['Wymieszaj składniki.'] };
    const row = { id: 'public-recipe', category: 'seher_yemeyi', title: 'Oatmeal', ingredients: ['Oats'], instructions: ['Mix ingredients.'],
      ...(transport === 'server columns' ? Object.fromEntries(Object.entries(translated).map(([key, value]) => [`${key}_pl`, value])) : {}) };
    fixture.bundled.mockImplementation((item, field, language) => transport === 'source-schema bundle' && item.id === row.id && language === 'pl'
      ? translated[field as keyof typeof translated] : undefined);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: [row], error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); fixture.from.mockReturnValue(query);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      const { result } = renderHook(useRecipes, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const recipe = result.current.data![0];
      expect(fixture.from).toHaveBeenCalledWith('admin_recipes');
      expect(recipe.category).toBe('seher_yemeyi');
      expect(recipe.stage).toBe('seher_yemeyi');
      expect(recipe.categoryLabel).toBe('Śniadania');
      expect(recipe.title).toBe('Owsianka');
      expect(recipe.ingredients).toEqual(['Płatki owsiane']);
      expect(recipe.instructions).toEqual(['Wymieszaj składniki.']);
      expect(row.category).toBe('seher_yemeyi');
    } finally { client.clear(); }
  });
});
