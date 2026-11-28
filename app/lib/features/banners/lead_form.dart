// Ported from: src/lib/ads/leadForm.ts
//
// Brand lead forms: the public projection of get_ad_lead_form_v1, client-side validation mirroring
// submit_ad_lead_v1, and the consumer copy (scripts/i18n/brand-lead-copy.json, 25 languages).
import 'package:flutter/foundation.dart';

import '../../core/i18n/app_languages.dart' show normalizeAppLanguage;
import 'generated/brand_lead_copy.g.dart';

const List<String> kLeadFieldKeys = ['name', 'phone', 'email', 'question_1', 'question_2', 'question_3'];

@immutable
class LeadField {
  const LeadField({required this.key, required this.required});
  final String key;
  final bool required;
}

@immutable
class PublicLeadForm {
  const PublicLeadForm({
    required this.id,
    required this.revision,
    required this.fields,
    required this.copy,
    required this.language,
    required this.privacyUrl,
    required this.retentionDays,
    required this.sponsorName,
  });
  final String id;
  final num revision;
  final List<LeadField> fields;

  /// `{ title, intro?, consent, success?, question_1?, question_2?, question_3? }`.
  final Map<String, String> copy;
  final String language;
  final String? privacyUrl;
  final int retentionDays;
  final String sponsorName;
}

/// `leadText(key, language, values)`: the app language's copy (unknown language → az, missing key → en) with
/// `{name}` placeholders filled.
String leadText(String key, String language, [Map<String, Object> values = const {}]) {
  final lang = normalizeAppLanguage(language);
  final text = kBrandLeadCopy[lang]?[key] ?? kBrandLeadCopy['en']![key] ?? '';
  final effective = text.isEmpty ? (kBrandLeadCopy['en']![key] ?? '') : text;
  return effective.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m.group(1)) ? '${values[m.group(1)]}' : m.group(0)!);
}

bool isLeadEmail(String value) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(value);
String normalizeLeadPhone(String value) => value.replaceAll(RegExp(r'[\s().-]'), '');
bool isLeadPhone(String value) => RegExp(r'^\+?[0-9]{7,15}$').hasMatch(normalizeLeadPhone(value));

bool _truthy(Object? v) => v != null && v != false && v != 0 && v != '';

/// `parsePublicLeadForm(data)`: a sane projection or null; unsafe privacy links are dropped, retention 1–90 days.
PublicLeadForm? parsePublicLeadForm(Object? data) {
  if (data is! Map) return null;
  final copy = data['copy'];
  if (data['id'] is! String || data['fields'] is! List || copy is! Map || !_truthy(copy['title']) || !_truthy(copy['consent'])) return null;
  final fields = <LeadField>[
    for (final f in data['fields'] as List)
      if (f is Map && kLeadFieldKeys.contains(f['key'])) LeadField(key: f['key'] as String, required: f['required'] == true),
  ];
  if (fields.isEmpty) return null;
  final privacy = data['privacy_url'];
  final privacyUrl = privacy is String && RegExp(r'^https://[^\s@/]+(/\S*)?$').hasMatch(privacy) ? privacy : null;
  final rawRetention = data['retention_days'];
  final retention = rawRetention is num ? rawRetention : num.tryParse('${rawRetention ?? ''}');
  final days = retention == null || retention == 0 || retention.isNaN ? 90 : retention;
  return PublicLeadForm(
    id: data['id'] as String,
    revision: data['revision'] is num ? data['revision'] as num : 0,
    fields: fields,
    copy: {for (final e in copy.entries) if (e.value is String) '${e.key}': e.value as String},
    language: data['language'] is String ? data['language'] as String : '',
    privacyUrl: privacyUrl,
    retentionDays: days.clamp(1, 90).toInt(),
    sponsorName: data['sponsor_name'] is String ? data['sponsor_name'] as String : '',
  );
}

/// `validateLead(form, answers, consent)`: errors keyed by field / 'consent' / 'form', the cleaned answers of
/// the enabled fields only.
({Map<String, String> errors, Map<String, String> clean, bool valid}) validateLead(PublicLeadForm form, Map<String, String> answers, bool consent) {
  final errors = <String, String>{};
  final clean = <String, String>{};
  for (final field in form.fields) {
    var value = (answers[field.key] ?? '').trim();
    if (value.isEmpty) {
      if (field.required) errors[field.key] = 'required';
      continue;
    }
    if (field.key == 'email' && !isLeadEmail(value)) errors[field.key] = 'email';
    if (field.key == 'phone') {
      value = normalizeLeadPhone(value);
      if (!isLeadPhone(value)) errors[field.key] = 'phone';
    }
    final max = field.key.startsWith('question_') ? 500 : 254;
    clean[field.key] = value.length > max ? value.substring(0, max) : value;
  }
  if (!consent) errors['consent'] = 'consent';
  if (clean.isEmpty && !errors.keys.any((k) => k != 'consent')) errors['form'] = 'empty';
  return (errors: errors, clean: clean, valid: errors.isEmpty);
}

/// `leadFieldLabel(form, key, language)`: brand questions use the brand copy, standard fields the app copy.
String leadFieldLabel(PublicLeadForm form, String key, String language) =>
    key.startsWith('question_') ? form.copy[key] ?? '' : leadText('field_$key', language);
