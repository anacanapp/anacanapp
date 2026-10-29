/**
 * Əlavə Qida Bələdçisi (0–4 yaş) — structure. Texts live per language in
 * ./solid-food-guide/<lang>.json (same order as these arrays); see useSolidFoodGuideText.
 * Source: Anacan editorial document 2026-10-29 (WHO 2023, AAP, Turkish MoH, Union of
 * Pediatricians of Russia, SACN). Tags: iron ★, ca calcium, omega Ω-3, c vitamin C, allergen.
 */

export type GuideTag = 'iron' | 'ca' | 'omega' | 'c' | 'allergen';
export type FoodGroupId = 'meat' | 'fish' | 'egg' | 'dairy' | 'legumes' | 'grains' | 'vegetables' | 'fruit' | 'fats_seeds';

export const STAGES = [
  { id: '0-6', fromMonths: 0, toMonths: 6 },
  { id: '6-8', fromMonths: 6, toMonths: 9 },
  { id: '9-11', fromMonths: 9, toMonths: 12 },
  { id: '12-24', fromMonths: 12, toMonths: 24 },
  { id: '24-48', fromMonths: 24, toMonths: 48 },
];

/** Aligned with text.nutrients; the needs table shows rows whose first need is not '—'. */
export const NUTRIENT_TAGS: (GuideTag | null)[] = ['iron', null, null, 'ca', 'omega', null, 'c'];

/** Aligned with text.plate. */
export const PLATE = [
  { share: 25, color: 'var(--a-coral)' },
  { share: 25, color: 'var(--a-yellow-2, #ffc94d)' },
  { share: 50, color: 'var(--a-green-2, #63bd8b)' },
];

export const FOOD_GROUPS: FoodGroupId[] = ['meat', 'fish', 'egg', 'dairy', 'legumes', 'grains', 'vegetables', 'fruit', 'fats_seeds'];

/** Aligned with text.foods. */
export const FOODS: { group: FoodGroupId; from: number; tags: GuideTag[] }[] = [
  { group: 'meat', from: 6, tags: ['iron'] },
  { group: 'meat', from: 6, tags: ['iron'] },
  { group: 'meat', from: 6, tags: ['iron'] },
  { group: 'meat', from: 6, tags: ['iron'] },
  { group: 'meat', from: 7, tags: ['iron'] },
  { group: 'fish', from: 6, tags: ['omega', 'allergen'] },
  { group: 'fish', from: 6, tags: ['omega', 'allergen'] },
  { group: 'fish', from: 6, tags: ['allergen'] },
  { group: 'egg', from: 6, tags: ['iron', 'allergen'] },
  { group: 'dairy', from: 6, tags: ['ca', 'allergen'] },
  { group: 'dairy', from: 6, tags: ['ca', 'allergen'] },
  { group: 'dairy', from: 6, tags: [] },
  { group: 'dairy', from: 12, tags: ['ca', 'allergen'] },
  { group: 'legumes', from: 6, tags: ['iron'] },
  { group: 'legumes', from: 6, tags: ['iron'] },
  { group: 'legumes', from: 7, tags: ['iron'] },
  { group: 'grains', from: 6, tags: ['iron'] },
  { group: 'grains', from: 6, tags: [] },
  { group: 'grains', from: 6, tags: ['iron'] },
  { group: 'grains', from: 6, tags: ['allergen'] },
  { group: 'grains', from: 7, tags: ['iron'] },
  { group: 'vegetables', from: 6, tags: [] },
  { group: 'vegetables', from: 6, tags: ['c'] },
  { group: 'vegetables', from: 6, tags: [] },
  { group: 'vegetables', from: 6, tags: ['iron'] },
  { group: 'vegetables', from: 7, tags: ['c'] },
  { group: 'vegetables', from: 6, tags: ['iron'] },
  { group: 'fruit', from: 6, tags: [] },
  { group: 'fruit', from: 6, tags: [] },
  { group: 'fruit', from: 6, tags: [] },
  { group: 'fruit', from: 6, tags: ['c'] },
  { group: 'fruit', from: 6, tags: [] },
  { group: 'fruit', from: 9, tags: ['iron'] },
  { group: 'fats_seeds', from: 6, tags: [] },
  { group: 'fats_seeds', from: 6, tags: ['allergen'] },
  { group: 'fats_seeds', from: 6, tags: ['allergen'] },
  { group: 'fats_seeds', from: 6, tags: ['ca', 'allergen'] },
  { group: 'fats_seeds', from: 9, tags: ['omega'] },
];

/** Aligned with text.dishes[stage]. */
export const DISH_TAGS: Record<string, GuideTag[][]> = {
  '6-8': [
    ['iron'],
    ['iron'],
    ['iron'],
    ['iron'],
    ['iron'],
    ['ca', 'allergen'],
    [],
    ['iron', 'allergen'],
    ['c'],
    ['omega', 'allergen'],
    ['iron', 'allergen'],
    [],
  ],
  '9-11': [
    ['iron'],
    ['iron', 'allergen'],
    ['omega', 'allergen'],
    ['ca', 'allergen'],
    ['iron'],
    ['iron'],
    ['iron', 'allergen'],
    ['iron', 'allergen'],
    ['iron'],
    ['ca', 'allergen'],
    ['ca', 'allergen'],
    ['iron'],
  ],
  '12-24': [
    ['iron'],
    ['iron'],
    ['iron'],
    ['iron', 'allergen'],
    ['iron', 'allergen'],
    ['iron', 'c', 'allergen'],
    ['iron'],
    ['omega', 'allergen'],
    ['iron'],
    ['iron', 'allergen'],
    ['iron', 'ca', 'allergen'],
    ['ca'],
    ['ca', 'allergen'],
    ['iron', 'allergen'],
  ],
  '24-48': [
    ['iron'],
    ['omega'],
    ['iron'],
    ['ca', 'allergen'],
    ['iron', 'c', 'allergen'],
    ['iron', 'c'],
    ['iron'],
    ['iron', 'allergen'],
    ['ca', 'allergen'],
    ['iron'],
  ],
};
