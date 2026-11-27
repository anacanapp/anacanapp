import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISH_TAGS, FOODS, FOOD_GROUPS, NUTRIENT_TAGS, PLATE, STAGES } from '../solidFoodGuide';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';

const dir = __dirname;
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'));
const az = read('az');
const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort().map(([k, v]) => [k, shape(v)])) : typeof value;
const placeholders = (value: unknown, path = ''): string[] => typeof value === 'string' ? (value.match(/\{n\}/g) ?? []).map(() => path)
  : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => placeholders(v, `${path}.${k}`)) : [];

describe('solid food guide texts', () => {
  it('lines up with the structure module', () => {
    expect(az.stages.map((s: { id: string }) => s.id)).toEqual(STAGES.map((s) => s.id));
    expect(az.nutrients).toHaveLength(NUTRIENT_TAGS.length);
    expect(az.plate).toHaveLength(PLATE.length);
    expect(az.foods).toHaveLength(FOODS.length);
    expect(Object.keys(az.foodGroups).sort()).toEqual([...FOOD_GROUPS].sort());
    for (const [stage, tags] of Object.entries(DISH_TAGS)) expect(az.dishes[stage]).toHaveLength(tags.length);
  });

  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  it('has a file for every app language', () => {
    expect([...files].sort()).toEqual([...APP_LANGUAGE_CODES].sort());
  });
  for (const lang of files.filter((l) => l !== 'az')) {
    it(`${lang} has the same shape, ids and placeholders as az`, () => {
      const text = read(lang);
      expect(shape(text)).toEqual(shape(az));
      expect(text.stages.map((s: { id: string }) => s.id)).toEqual(az.stages.map((s: { id: string }) => s.id));
      expect(placeholders(text)).toEqual(placeholders(az));
    });
  }
});
