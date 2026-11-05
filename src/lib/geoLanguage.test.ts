import { describe, expect, it } from 'vitest';
import { languageForCountry } from './geoLanguage';
import { APP_LANGUAGES } from './app-languages';

const ALL = APP_LANGUAGES.map(l => l.code);

describe('languageForCountry', () => {
  it('maps a country to its language', () => {
    expect(languageForCountry('AZ', ALL)).toBe('az');
    expect(languageForCountry('TR', ALL)).toBe('tr');
    expect(languageForCountry('RU', ALL)).toBe('ru');
    expect(languageForCountry('KZ', ALL)).toBe('kk');
    expect(languageForCountry('KG', ALL)).toBe('ky');
    expect(languageForCountry('EE', ALL)).toBe('et');
    expect(languageForCountry('BR', ALL)).toBe('pt');
    expect(languageForCountry('MX', ALL)).toBe('es');
    expect(languageForCountry('AT', ALL)).toBe('de');
    expect(languageForCountry('SA', ALL)).toBe('ar');
    expect(languageForCountry('jp', ALL)).toBe('ja');
  });
  it('falls back to English for countries without an app language', () => {
    for (const c of ['GB', 'US', 'IT', 'UA', 'IL', 'AM', 'GR']) expect(languageForCountry(c, ALL)).toBe('en');
  });
  it('falls back to English when unknown or missing', () => {
    expect(languageForCountry(null, ALL)).toBe('en');
    expect(languageForCountry(undefined, ALL)).toBe('en');
    expect(languageForCountry('', ALL)).toBe('en');
  });
  it('only picks languages that are currently offered', () => {
    expect(languageForCountry('KG', ALL.filter(c => c !== 'ky'))).toBe('en');
  });
  it('every mapped language is an app language', () => {
    const codes = new Set(ALL);
    const countries = ['AZ','TR','RU','BY','TJ','TM','KZ','KG','UZ','GE','EE','DE','FR','NL','ES','PT','PL','SE','JP','KR','CN','VN','ID','IN','SA'];
    for (const c of countries) expect(codes.has(languageForCountry(c, ALL))).toBe(true);
  });
});
