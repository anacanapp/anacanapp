import { describe, expect, it } from 'vitest';
import { directionsUrl, parseProviderProfile, profileFieldOf, splitProfileList } from './providerProfile';

const AZ = 'Təcrübə: 16 il\nDillər: Azərbaycan Dili\nTəhsil: ATU\nMagistr: ATU\nMaraq sahələri: Diabet ,  Piylənmə\n\nDr. Mədinə 15 ildən artıq təcrübəyə malikdir.\nİkinci sətir.';

describe('parseProviderProfile', () => {
  it('reads the Azerbaijani source headers', () => {
    const p = parseProviderProfile(AZ);
    expect(p.fields).toEqual({ experience: '16 il', languages: 'Azərbaycan Dili', education: 'ATU', master: 'ATU', interests: 'Diabet ,  Piylənmə' });
    expect(p.basicDescription).toBe('Dr. Mədinə 15 ildən artıq təcrübəyə malikdir.\nİkinci sətir.');
  });

  it('reads translated headers, full-width colons and spaced colons', () => {
    const ja = parseProviderProfile('経験：16年\n言語：アゼルバイジャン語\n学歴：医科大学\n専門分野：肥満、糖尿病\n\n本文です。');
    expect(ja.fields).toMatchObject({ experience: '16年', languages: 'アゼルバイジャン語', education: '医科大学', interests: '肥満、糖尿病' });
    expect(ja.basicDescription).toBe('本文です。');
    const fr = parseProviderProfile('Expérience : 16 ans\nLangues : azéri\nDomaines d’intérêt : obésité, diabète\n\nTexte.');
    expect(fr.fields).toMatchObject({ experience: '16 ans', languages: 'azéri', interests: 'obésité, diabète' });
    const ky = parseProviderProfile('Тажрыйбасы: 16 жыл\nТилдери: Азербайжан тили\nКызматтар: УЗИ, консультация');
    expect(ky.fields).toMatchObject({ experience: '16 жыл', languages: 'Азербайжан тили', services: 'УЗИ, консультация' });
    expect(ky.basicDescription).toBe('');
  });

  it('keeps unknown headers as label/value entries instead of falling back to plain text', () => {
    const p = parseProviderProfile('Spezialgebiet X: Wert\nTəcrübə: 5 il\n\nText.');
    expect(p.entries).toEqual([
      { label: 'Spezialgebiet X', value: 'Wert', field: null },
      { label: 'Təcrübə', value: '5 il', field: 'experience' },
    ]);
    expect(p.basicDescription).toBe('Text.');
  });

  it('does not treat prose, times or links as headers', () => {
    for (const text of ['Dr. Aynurə: həkim-nevroloq.', 'Saat 09:00-dan qəbul', 'https://example.com', 'Plain text only']) {
      const p = parseProviderProfile(text);
      expect(p.entries).toEqual([]);
      expect(p.basicDescription).toBe(text);
    }
    expect(parseProviderProfile(null).basicDescription).toBe('');
  });

  it('maps aliases case- and apostrophe-insensitively', () => {
    expect(profileFieldOf('domaines d\'intérêt')).toBe('interests');
    expect(profileFieldOf('EXPERIENCE')).toBe('experience');
    expect(profileFieldOf('Unknown')).toBeNull();
  });
});

it('splits lists on Latin and CJK separators', () => {
  expect(splitProfileList('a ,  b、c，d; e')).toEqual(['a', 'b', 'c', 'd', 'e']);
});

it('builds directions from coordinates or the address, or nothing', () => {
  expect(directionsUrl({ latitude: 40.4, longitude: 49.8, address: 'X' })).toBe('https://www.google.com/maps/dir/?api=1&destination=40.4%2C49.8');
  expect(directionsUrl({ address: 'Nizami 1', city: 'Bakı' })).toBe('https://www.google.com/maps/dir/?api=1&destination=Nizami%201%2C%20Bak%C4%B1');
  expect(directionsUrl({ address: null, latitude: null, longitude: null })).toBeNull();
});
