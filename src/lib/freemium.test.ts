import { describe, expect, it } from 'vitest';
import { canOpenToolFree, isLimitedPremiumType, isToolFree, toolAccess } from './freemium';

describe('freemium tool access', () => {
  it('baby tracker stays fully Premium', () => {
    expect(isToolFree('baby-tracker')).toBe(false);
    expect(toolAccess({ toolId: 'baby-tracker' })).toBe('premium');
    expect(canOpenToolFree('baby-tracker')).toBe(false);
  });

  it('opens tools with an in-tool free limit for free users', () => {
    for (const id of ['whitenoise', 'white-noise', 'recipes', 'solid-food-guide', 'horoscope']) {
      expect(toolAccess({ toolId: id, isPremiumFlag: true, premiumType: 'premium_only' })).toBe('limited');
      expect(canOpenToolFree(id)).toBe(true);
    }
  });

  it('honours the admin premium_type limited values', () => {
    expect(isLimitedPremiumType('limited_total')).toBe(true);
    expect(isLimitedPremiumType('limited_monthly')).toBe(true);
    expect(isLimitedPremiumType('premium_only')).toBe(false);
    expect(toolAccess({ toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'limited_total' })).toBe('limited');
    expect(toolAccess({ toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'none' })).toBe('premium');
    expect(canOpenToolFree('cry-translator', 'limited_monthly')).toBe(true);
    expect(canOpenToolFree('cry-translator')).toBe(false);
  });

  it('keeps the DB premium flag on free-listed tools and stage locks on everything', () => {
    expect(toolAccess({ toolId: 'first-aid' })).toBe('free');
    expect(toolAccess({ toolId: 'first-aid', isPremiumFlag: true })).toBe('premium');
    expect(toolAccess({ toolId: 'recipes', stageLocked: true })).toBe('premium');
  });
});
