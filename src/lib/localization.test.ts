import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_LANGUAGES, APP_LANGUAGE_CODES, NEW_LANGUAGE_CODES, appLanguageLocale, normalizeAppLanguage, readAppLanguage, resolveAppLanguages, setCachedAppLanguage } from './app-languages';
import { startupText } from './startup-i18n';
import { detectLang } from './langDetect';
import { defaultFeedLanguages } from '@/hooks/useFeedLanguages';
import { createContentTranslationCache, type ContentBundle } from './content-i18n';
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';
import { formatCountUnit } from './count-format';
import { getOrdinal } from './utils';

// readAppLanguage keeps the language in memory (userStore updates it); these tests
// write storage directly, so start every test without a cached value.
beforeEach(() => { localStorage.clear(); setCachedAppLanguage(null); });
describe('twenty-one-language selection', () => {
  it('keeps bundled choices offline and recognizes inactive legacy-list rows without losing tool restrictions', () => {
    expect(APP_LANGUAGE_CODES).toHaveLength(21);
    expect(new Set(APP_LANGUAGE_CODES).size).toBe(21);
    expect(resolveAppLanguages().map(item => item.code)).toEqual(APP_LANGUAGE_CODES);
    const result = resolveAppLanguages([
      { code: 'en', name: 'English', native_name: 'English', disabled_tools: ['cakes'] },
      { code: 'tr', name: 'Turkish', native_name: 'Türkçe', is_active: false },
      { code: 'ru', name: 'Russian', native_name: 'Русский', is_active: false },
      { code: 'pt', name: 'Portuguese', native_name: 'Português', is_active: false },
      { code: 'unsupported', name: 'Unsupported', native_name: 'Unsupported' },
    ]);
    expect(result.some(item => item.code === 'tr')).toBe(true); expect(result.some(item => item.code === 'ru')).toBe(true);
    expect(result.some(item => item.code === 'pt')).toBe(true); expect(result.some(item => item.code === 'unsupported')).toBe(false);
    expect(result.find(item => item.code === 'fr')?.disabled_tools).toEqual(['cakes']);
  });
  it.each([['zh-CN','zh'], ['zh_Hans','zh'], ['id-ID','id'], ['fr-FR','fr'], ['es-ES','es'], ['pt-PT','pt'],
    ['vi-VN','vi'], ['hi-IN','hi'], ['ja-JP','ja'], ['ko-KR','ko'], ['pl-PL','pl'], ['nl-NL','nl'], ['sv-SE','sv']])('normalizes %s without assigning an account country', (input, expected) => {
    localStorage.setItem('anacan-user-store', JSON.stringify({ state: { language: input, countryCode: 'AZ' } }));
    expect(normalizeAppLanguage(input)).toBe(expected); expect(readAppLanguage()).toBe(expected);
    expect(JSON.parse(localStorage.getItem('anacan-user-store')!).state.countryCode).toBe('AZ');
  });
  it('recovers a separate language preference when its UI snapshot is damaged', () => {
    localStorage.setItem('anacan-user-store', '{bad'); localStorage.setItem('language', 'fr-FR');
    expect(readAppLanguage()).toBe('fr'); expect(appLanguageLocale('pt')).toBe('pt-PT'); expect(appLanguageLocale('zh')).toBe('zh-CN');
  });
  it.each(NEW_LANGUAGE_CODES)('has complete SDK-free language and retry text for %s', language => {
    for (const key of ['selectLanguage','selectCountry','searchPlaceholder','noneFound','continue','languageHint','back','updateRequired','connectionPending','retry'] as const)
      expect(startupText(language, key, 'MISSING'), key).not.toBe('MISSING');
    expect(APP_LANGUAGES.find(item => item.code === language)?.native_name).toBeTruthy();
  });
});

describe('community language inference', () => {
  it.each([
    ['宝宝今天睡得很好', 'zh'], ['Saya sedang hamil dan bayi saya sehat', 'id'],
    ['Bonjour les mamans, comment va votre bébé ?', 'fr'], ['Hola, estoy embarazada y mi bebé está bien', 'es'],
    ['Olá, estou grávida e o meu bebé está bem', 'pt'], ['Ça va bien avec votre bébé ?', 'fr'],
    ['Mən hamiləyəm və çox xoşbəxtəm', 'az'], ['Bebeğim çok iyi uyuyor ve ben mutluyum', 'tr'],
    ['Tôi đang mang thai và em bé của tôi khỏe mạnh', 'vi'], ['मेरा बच्चा आज अच्छी तरह सोया है', 'hi'],
    ['赤ちゃんは今日よく眠っています', 'ja'], ['아기가 오늘 잘 자고 있어요', 'ko'],
    ['Jestem w ciąży i moje dziecko ma się dobrze', 'pl'], ['Mijn baby slaapt goed en ik ben blij', 'nl'],
    ['Jag är gravid och mitt barn mår bra', 'sv'],
  ])('infers %s as %s', (text, expected) => expect(detectLang(text, 'az')).toBe(expected));
  it('preserves uncertain text and prioritizes without filtering other languages', () => {
    expect(detectLang('❤️', 'fr')).toBe('fr');
    expect(detectLang('妊娠初期', 'ja')).toBe('ja');
    expect(defaultFeedLanguages('PT', 'id')).toEqual(['id']);
    expect(defaultFeedLanguages('AZ', 'zh')).toEqual(['zh']);
  });
});

describe('new-language count grammar', () => {
  it('uses Polish, Dutch and Swedish singular/plural unit forms', () => {
    expect(formatCountUnit('pl', '{count} days', { count: 1 })).toBe('1 dzień');
    expect(formatCountUnit('pl', '{count} days', { count: 2 })).toBe('2 dni');
    expect(formatCountUnit('pl', '{count} days', { count: 5 })).toBe('5 dni');
    expect(formatCountUnit('nl', '{count} gün', { count: 1 })).toBe('1 dag');
    expect(formatCountUnit('nl', '{count} gün', { count: 2 })).toBe('2 dagen');
    expect(formatCountUnit('sv', '{count} days', { count: 1 })).toBe('1 dygn');
    expect(formatCountUnit('sv', '{count} days', { count: 2 })).toBe('2 dygn');
    expect(formatCountUnit('sv', '{count} hours', { count: 1 })).toBe('1 timme');
    expect(formatCountUnit('sv', '{count} hours', { count: 2 })).toBe('2 timmar');
  });
  it('does not reinterpret prices, arbitrary sentences or existing-language labels', () => {
    expect(formatCountUnit('pl', '${price}', { price: 19.99 })).toBeUndefined();
    expect(formatCountUnit('pl', 'Wait {count} days', { count: 2 })).toBeUndefined();
    expect(formatCountUnit('en', '{count} days', { count: 1 })).toBeUndefined();
    expect(getOrdinal(1, 'sv')).toBe('1:a'); expect(getOrdinal(12, 'sv')).toBe('12:e');
    expect(getOrdinal(21, 'sv')).toBe('21:a'); expect(getOrdinal(3, 'pl')).toBe('3.');
  });
});

describe('source-bound public content bundles', () => {
  const row = { id: 'public-fixture', description: 'Source text: 3 mg', description_en: 'Source text: 3 mg' };
  const key = contentTranslationKey(row, 'description')!;
  const fixture = (): ContentBundle => ({ schema: 'anacan-content-translations-v1', language: 'fr', sourceHash: 'a'.repeat(64), values: { [key]: 'Texte source : 3 mg' } });
  it('coalesces offline loads, translates exact public rows and refuses an edited source', async () => {
    const loader = vi.fn(async () => fixture());
    const cache = createContentTranslationCache({ '../../scripts/i18n/content/fr.json': loader });
    await Promise.all([cache.ensure('fr'), cache.ensure('fr-FR')]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.lookup(row, 'description', 'fr')).toBe('Texte source : 3 mg');
    expect(cache.lookup({ ...row, description: 'Source text: 30 mg' }, 'description', 'fr')).toBeUndefined();
    expect(cache.lookup({ ...row, id: 'another-row' }, 'description', 'fr')).toBeUndefined();
    expect(cache.lookup({ ...row, description_en: 'Edited' }, 'description', 'fr')).toBeUndefined();
    expect(row.description).toBe('Source text: 3 mg');
  });
  it('rejects mismatched bundles and allows a clean retry', async () => {
    const loader = vi.fn().mockResolvedValueOnce({ ...fixture(), language: 'es' }).mockResolvedValueOnce(fixture());
    const cache = createContentTranslationCache({ '../../scripts/i18n/content/fr.json': loader });
    await expect(cache.ensure('fr')).rejects.toThrow('BUNDLED_CONTENT_LANGUAGE_INVALID');
    await cache.ensure('fr'); expect(cache.lookup(row, 'description', 'fr')).toBeTruthy();
    await expect(cache.ensure('zh')).rejects.toThrow('BUNDLED_CONTENT_LANGUAGE_MISSING');
    await expect(cache.ensure('az')).resolves.toBeUndefined();
  });
});
