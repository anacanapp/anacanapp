import { expect, it, vi } from 'vitest';
vi.mock('@/hooks/useDynamicContent', () => ({ useRecipes: () => ({ data: [] }) }));
import { recipeMinMonths } from './SolidFoodGuide';

it('reads the starting age from recipe titles', () => {
  expect(recipeMinMonths('Armud və Gavalı püresi\n(6 ay+)')).toBe(6);
  expect(recipeMinMonths('Sağlam Naqets(1 yaş+)')).toBe(12);
  expect(recipeMinMonths('Gold Mac & Cheese (2 yaş+)')).toBe(24);
  expect(recipeMinMonths('Iron Bowl - Qarabaşaq və Ət')).toBeNull();
});
