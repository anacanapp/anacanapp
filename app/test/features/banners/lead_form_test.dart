// Ported from: src/lib/ads/leadForm.test.ts
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/features/banners/generated/brand_lead_copy.g.dart';
import 'package:anacan/features/banners/lead_form.dart';
import 'package:flutter_test/flutter_test.dart';

PublicLeadForm form({String? privacyUrl}) => PublicLeadForm(
      id: 'form',
      revision: 2,
      language: 'az',
      privacyUrl: privacyUrl,
      retentionDays: 90,
      sponsorName: 'Brand',
      fields: const [LeadField(key: 'name', required: true), LeadField(key: 'phone', required: true), LeadField(key: 'email', required: false), LeadField(key: 'question_1', required: false)],
      copy: const {'title': 'Pulsuz nümunə', 'consent': 'Brend sizinlə əlaqə saxlayacaq.', 'question_1': 'Körpənin yaşı?'},
    );

Map<String, Object?> formJson([Map<String, Object?> patch = const {}]) => {
      'id': 'form',
      'revision': 2,
      'language': 'az',
      'privacy_url': null,
      'retention_days': 90,
      'sponsor_name': 'Brand',
      'fields': [
        {'key': 'name', 'required': true},
        {'key': 'phone', 'required': true},
        {'key': 'email', 'required': false},
        {'key': 'question_1', 'required': false},
      ],
      'copy': {'title': 'Pulsuz nümunə', 'consent': 'Brend sizinlə əlaqə saxlayacaq.', 'question_1': 'Körpənin yaşı?'},
      ...patch,
    };

void main() {
  group('consumer lead copy', () {
    test('ships every key in all 21 app languages with the same placeholders', () {
      final english = kBrandLeadCopy['en']!.keys.toList()..sort();
      expect(kBrandLeadCopy.keys.toSet(), kAppLanguages.map((l) => l.code).toSet());
      final placeholder = RegExp(r'\{\w+\}');
      for (final entry in kBrandLeadCopy.entries) {
        expect(entry.value.keys.toList()..sort(), english, reason: entry.key);
        for (final key in english) {
          expect(placeholder.allMatches(entry.value[key]!).map((m) => m.group(0)).toList(), placeholder.allMatches(kBrandLeadCopy['en']![key]!).map((m) => m.group(0)).toList(),
              reason: '${entry.key}.$key');
        }
      }
      // The generated table matches the JSON it was generated from.
      final source = File('../scripts/i18n/brand-lead-copy.json');
      if (source.existsSync()) {
        final json = jsonDecode(source.readAsStringSync()) as Map<String, dynamic>;
        expect((json['languages'] as Map).map((k, v) => MapEntry(k, Map<String, String>.from(v as Map))), kBrandLeadCopy);
      }
    });
    test('interpolates the brand and retention and resolves unknown languages like the app', () {
      expect(leadText('privacy_note', 'az', {'brand': 'Brend', 'days': 90}), contains('Brend'));
      expect(leadText('privacy_note', 'az', {'brand': 'Brend', 'days': 90}), contains('90'));
      expect(leadText('submit', 'en'), 'Send');
      expect(leadText('submit', 'xx'), leadText('submit', 'az'));
      expect(leadText('success', 'ar', {'brand': 'X'}), contains('X'));
    });
  });

  group('lead form validation (mirror of submit_ad_lead_v1)', () {
    test('validates contact formats and normalizes phone numbers', () {
      expect(isLeadEmail('ana@example.az'), isTrue);
      expect(isLeadEmail('ana@example'), isFalse);
      expect(normalizeLeadPhone('+994 (50) 123-45-67'), '+994501234567');
      expect(isLeadPhone('+994 50 123 45 67'), isTrue);
      expect(isLeadPhone('12'), isFalse);
      expect(isLeadPhone('+99450abc'), isFalse);
    });
    test('requires consent and required fields, and returns only cleaned answers for enabled fields', () {
      final missing = validateLead(form(), {'name': ' '}, false);
      expect(missing.valid, isFalse);
      expect(missing.errors, containsPair('name', 'required'));
      expect(missing.errors, containsPair('phone', 'required'));
      expect(missing.errors, containsPair('consent', 'consent'));
      final ok = validateLead(form(), {'name': ' Aynur ', 'phone': '+994 50 123 45 67', 'question_2': 'ignored'}, true);
      expect(ok.valid, isTrue);
      expect(ok.clean, {'name': 'Aynur', 'phone': '+994501234567'});
      expect(ok.clean.containsKey('question_2'), isFalse);
      expect(validateLead(form(), {'name': 'A', 'phone': '+994501234567', 'email': 'bad'}, true).errors, {'email': 'email'});
    });
    test('accepts only a sane public projection and drops unsafe privacy links', () {
      expect(parsePublicLeadForm(null), isNull);
      expect(parsePublicLeadForm(formJson({'fields': [{'key': 'ssn', 'required': true}]})), isNull);
      expect(parsePublicLeadForm(formJson({'privacy_url': 'javascript:alert(1)'}))?.privacyUrl, isNull);
      final parsed = parsePublicLeadForm(formJson({'privacy_url': 'https://brand.example/privacy', 'retention_days': 900}))!;
      expect(parsed.privacyUrl, 'https://brand.example/privacy');
      expect(parsed.retentionDays, 90);
    });
    test('labels brand questions with the brand copy and standard fields with app copy', () {
      expect(leadFieldLabel(form(), 'question_1', 'az'), 'Körpənin yaşı?');
      expect(leadFieldLabel(form(), 'phone', 'ru'), 'Номер телефона');
    });
  });
}
