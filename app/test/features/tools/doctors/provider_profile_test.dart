// Ported from: src/components/tools/doctors/providerProfile.test.ts
import 'package:anacan/features/tools/doctors/provider_profile.dart';
import 'package:flutter_test/flutter_test.dart';

const az = 'Təcrübə: 16 il\nDillər: Azərbaycan Dili\nTəhsil: ATU\nMagistr: ATU\nMaraq sahələri: Diabet ,  Piylənmə\n\nDr. Mədinə 15 ildən artıq təcrübəyə malikdir.\nİkinci sətir.';

void main() {
  group('parseProviderProfile', () {
    test('reads the Azerbaijani source headers', () {
      final p = parseProviderProfile(az);
      expect(p.fields, {'experience': '16 il', 'languages': 'Azərbaycan Dili', 'education': 'ATU', 'master': 'ATU', 'interests': 'Diabet ,  Piylənmə'});
      expect(p.basicDescription, 'Dr. Mədinə 15 ildən artıq təcrübəyə malikdir.\nİkinci sətir.');
    });

    test('reads translated headers, full-width colons and spaced colons', () {
      final ja = parseProviderProfile('経験：16年\n言語：アゼルバイジャン語\n学歴：医科大学\n専門分野：肥満、糖尿病\n\n本文です。');
      expect(ja.fields, containsPair('experience', '16年'));
      expect(ja.fields, containsPair('languages', 'アゼルバイジャン語'));
      expect(ja.fields, containsPair('education', '医科大学'));
      expect(ja.fields, containsPair('interests', '肥満、糖尿病'));
      expect(ja.basicDescription, '本文です。');
      final fr = parseProviderProfile('Expérience : 16 ans\nLangues : azéri\nDomaines d’intérêt : obésité, diabète\n\nTexte.');
      expect(fr.fields, containsPair('experience', '16 ans'));
      expect(fr.fields, containsPair('languages', 'azéri'));
      expect(fr.fields, containsPair('interests', 'obésité, diabète'));
      final ky = parseProviderProfile('Тажрыйбасы: 16 жыл\nТилдери: Азербайжан тили\nКызматтар: УЗИ, консультация');
      expect(ky.fields, containsPair('experience', '16 жыл'));
      expect(ky.fields, containsPair('languages', 'Азербайжан тили'));
      expect(ky.fields, containsPair('services', 'УЗИ, консультация'));
      expect(ky.basicDescription, '');
    });

    test('keeps unknown headers as label/value entries instead of falling back to plain text', () {
      final p = parseProviderProfile('Spezialgebiet X: Wert\nTəcrübə: 5 il\n\nText.');
      expect(p.entries, const [
        ProfileEntry(label: 'Spezialgebiet X', value: 'Wert', field: null),
        ProfileEntry(label: 'Təcrübə', value: '5 il', field: 'experience'),
      ]);
      expect(p.basicDescription, 'Text.');
    });

    test('does not treat prose, times or links as headers', () {
      for (final text in ['Dr. Aynurə: həkim-nevroloq.', 'Saat 09:00-dan qəbul', 'https://example.com', 'Plain text only']) {
        final p = parseProviderProfile(text);
        expect(p.entries, isEmpty);
        expect(p.basicDescription, text);
      }
      expect(parseProviderProfile(null).basicDescription, '');
    });

    test('maps aliases case- and apostrophe-insensitively', () {
      expect(profileFieldOf("domaines d'intérêt"), 'interests');
      expect(profileFieldOf('EXPERIENCE'), 'experience');
      expect(profileFieldOf('Unknown'), isNull);
    });
  });

  test('splits lists on Latin and CJK separators', () {
    expect(splitProfileList('a ,  b、c，d; e'), ['a', 'b', 'c', 'd', 'e']);
  });

  test('builds directions from coordinates or the address, or nothing', () {
    expect(directionsUrl(latitude: 40.4, longitude: 49.8, address: 'X'), 'https://www.google.com/maps/dir/?api=1&destination=40.4%2C49.8');
    expect(directionsUrl(address: 'Nizami 1', city: 'Bakı'), 'https://www.google.com/maps/dir/?api=1&destination=Nizami%201%2C%20Bak%C4%B1');
    expect(directionsUrl(), isNull);
  });
}
