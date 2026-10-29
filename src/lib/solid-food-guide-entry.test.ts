import { expect, it } from 'vitest';
import { solidFoodGuideRelevant } from './solid-food-guide-entry';

it('shows the guide from about five months until four years', () => {
  expect(solidFoodGuideRelevant(4)).toBe(false);
  expect(solidFoodGuideRelevant(5)).toBe(true);
  expect(solidFoodGuideRelevant(47)).toBe(true);
  expect(solidFoodGuideRelevant(48)).toBe(false);
  expect(solidFoodGuideRelevant(null)).toBe(false);
});
