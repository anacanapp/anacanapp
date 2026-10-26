import { describe, expect, it } from 'vitest';
import { detectLang, type FeedLang } from './langDetect';
import { legacyPostLanguage } from './community-language-evidence';

describe('Community post visibility language regression', () => {
  it.each([
    ['Salam qizlar bir sualim var, nece edim?', 'az', 'az'],
    ['Salam bir sualim var', 'az', 'az'],
    ['Qizlar cox narahatam, bilmirem nece edim', 'en', 'az'],
    ['Oğlumun yuxusu normaldır?', 'az', 'az'],
    ['Usagim 2 ayliqdi, i herfini yazdim', 'az', 'az'],
    ['Merhaba kızlar, bebeğim nasıl uyuyabilir?', 'az', 'tr'],
    ['Merhaba, ben bir anne olarak cok mutluyum', 'az', 'tr'],
    ['Salom, mening bolam uchun nima yaxshi?', 'az', 'uz'],
    ['What do you do when your baby cannot sleep?', 'az', 'en'],
    ['Как помочь малышу заснуть вечером?', 'az', 'ru'],
    ['Салем кыздар, калай болады?', 'ru', 'kk'],
    ['Салом, менинг болам учун нима яхши?', 'ru', 'uz'],
    ['https://example.invalid/nece-qizlar #cox ❤️', 'tr', 'tr'],
    ['bir bu var', 'uz', 'uz'],
  ] as [string, FeedLang, FeedLang][])('keeps %s in its content language', (text, fallback, expected) => {
    expect(detectLang(text, fallback)).toBe(expected);
  });

  it('repairs only evidenced legacy labels, keeping other languages and ambiguous choices', () => {
    expect(legacyPostLanguage('Salam qizlar bir sualim var, nece edim?', 'tr', 'az')).toBe('az');
    expect(legacyPostLanguage('Salam, usagim ucun nece edim?', 'en', 'az')).toBe('az');
    expect(legacyPostLanguage('Salom, mening bolam uchun nima yaxshi?', 'az', 'uz')).toBe('uz');
    expect(legacyPostLanguage('Merhaba, ben bir anne olarak cok mutluyum', 'tr', 'az')).toBe('tr');
    expect(legacyPostLanguage('bir bu var', 'tr', 'az')).toBe('tr');
    expect(legacyPostLanguage('Как помочь малышу заснуть?', 'ru', 'az')).toBe('ru');
    expect(legacyPostLanguage('Салем кыздар, калай болады?', 'ru', 'kk')).toBe('kk');
    expect(legacyPostLanguage('Привет девочки, мой ребенок хорошо спит', 'ru', 'kk')).toBe('ru');
    expect(legacyPostLanguage('https://example.invalid/qizlar/nece', 'tr', 'az')).toBe('tr');
    expect(legacyPostLanguage('Salam qizlar nece edim?', 'tr', null)).toBe('tr');
  });
});
