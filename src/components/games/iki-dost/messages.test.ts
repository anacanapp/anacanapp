import { describe, expect, it } from 'vitest';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { FRIENDS_MESSAGES, friendsText, type FriendsMessageKey } from './messages';

describe('Two Friends offline language packs', () => {
  it('bundles every label and matching placeholders in all 21 app languages', () => {
    expect(Object.keys(FRIENDS_MESSAGES).sort()).toEqual([...APP_LANGUAGE_CODES].sort());
    const keys = Object.keys(FRIENDS_MESSAGES.az) as FriendsMessageKey[];
    for (const language of APP_LANGUAGE_CODES) for (const key of keys) {
      const text = FRIENDS_MESSAGES[language][key]; expect(text?.trim().length).toBeGreaterThan(0);
      expect(text.match(/\{\w+\}/g) || []).toEqual(FRIENDS_MESSAGES.az[key].match(/\{\w+\}/g) || []);
      expect(friendsText(language, key, { level: 2, count: 3 })).not.toMatch(/\{\w+\}/);
    }
  });
});
