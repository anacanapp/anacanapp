import { describe, expect, it } from 'vitest';
import { canOpenToolFree, isLimitedPremiumType, isToolFree, toolAccess } from './freemium';

describe('freemium tool access', () => {
  it('baby tracker stays fully Premium', () => {
    expect(isToolFree('baby-tracker')).toBe(false);
    expect(toolAccess({ toolId: 'baby-tracker' })).toBe('premium');
    expect(canOpenToolFree('baby-tracker')).toBe(false);
  });

  it('opens tools with an in-tool free limit for free users', () => {
    for (const id of ['recipes', 'horoscope']) {
      expect(toolAccess({ toolId: id, isPremiumFlag: true, premiumType: 'premium_only' })).toBe('limited');
      expect(canOpenToolFree(id)).toBe(true);
    }
  });

  it('honours the admin premium_type limited values', () => {
    expect(isLimitedPremiumType('limited_total')).toBe(true);
    expect(isLimitedPremiumType('limited_monthly')).toBe(true);
    expect(isLimitedPremiumType('premium_only')).toBe(false);
    // Admin "limited" only opens tools that enforce their own free limit; others stay Premium.
    // 2026-11-09: Fotosessiya and Ağ səs are Premium preview tools (open to look at, action needs Premium).
    expect(toolAccess({ toolId: 'photoshoot', isPremiumFlag: true, premiumType: 'limited_total' })).toBe('preview');
    expect(toolAccess({ toolId: 'whitenoise' })).toBe('preview');
    expect(toolAccess({ toolId: 'photoshoot', stageLocked: true })).toBe('premium');
    expect(toolAccess({ toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'limited_total' })).toBe('premium');
    expect(toolAccess({ toolId: 'fairy-tale', isPremiumFlag: true, premiumType: 'limited_monthly' })).toBe('premium');
    expect(toolAccess({ toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'none' })).toBe('premium');
    expect(canOpenToolFree('photoshoot', 'limited_monthly')).toBe(true);
    expect(canOpenToolFree('cry-translator', 'limited_monthly')).toBe(false);
    expect(canOpenToolFree('cry-translator')).toBe(false);
  });

  it('keeps the DB premium flag on free-listed tools and stage locks on everything', () => {
    expect(toolAccess({ toolId: 'first-aid' })).toBe('free');
    expect(toolAccess({ toolId: 'first-aid', isPremiumFlag: true })).toBe('premium');
    expect(toolAccess({ toolId: 'recipes', stageLocked: true })).toBe('premium');
  });
});

describe('Premium-only tools (2026-11-09)', () => {
  it('Tərbiyə and Əlavə qida bələdçisi need Premium', async () => {
    const { toolAccess } = await import('./freemium');
    expect(toolAccess({ toolId: 'parenting' })).toBe('premium');
    expect(toolAccess({ toolId: 'solid-food-guide' })).toBe('premium');
  });
});
