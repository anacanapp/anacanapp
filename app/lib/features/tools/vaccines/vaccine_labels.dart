// Ported from: src/lib/vaccine-labels.ts, src/lib/regional-i18n.ts
//
// Vaccine names, ages, doses and routes in the app language (all 25), derived from stable schedule data. The Intl
// pieces of the TypeScript (ListFormat, NumberFormat unit/long + formatRange, PluralRules, locale case mapping) are
// pre-rendered from Node's ICU into vaccine_labels.g.dart. Azerbaijani is the source language and always shows the
// database text. Never group or match on output of these helpers: group by `recommended_age_days`.
import '../../../core/i18n/app_languages.dart' show normalizeAppLanguage;
import '../../../core/i18n/count_format.dart' show turkmenOrdinalSuffix;
import '../../../core/i18n/tr.dart';
import '../../../domain/js_compat.dart';
import 'vaccine_labels.g.dart';
import 'vaccine_models.dart';

export 'vaccine_labels.g.dart' show kVaccineLabelPacks, kVaccineTermKeys, kVaccinePhraseKeys;

/// `regionalText(key, language)`.
String regionalText(String key, String language) =>
    kRegionalCopy[normalizeAppLanguage(language)]?[key] ?? kRegionalCopy['en']![key] ?? '';

Map<String, List<String>> _pack(String lang) => kVaccineLabelPacks[normalizeAppLanguage(lang)] ?? kVaccineLabelPacks['en']!;
String _phrase(String lang, String key) => _pack(lang)['phrases']![kVaccinePhraseKeys.indexOf(key)];

/// "Measles, mumps and rubella (MMR)" in the app language; the database name when there is nothing better.
String vaccineDisplayName(VaccineScheduleRow row, String language) {
  final lang = normalizeAppLanguage(language);
  final fallback = _nonEmpty(row.vaccine.name) ?? row.vaccine.nameAz ?? '';
  if (lang == 'az') return fallback;
  // A reviewed programme names its own product (the schedule query already put display_name into vaccine.name).
  final displayName = row.row['id'] != null ? row.timing?.raw['display_name'] : null;
  if (displayName is Map && _nonEmpty(displayName[lang] as String?) != null) return fallback;
  final code = (row.vaccine.code ?? '').trim().toUpperCase();
  if (!kVaccineCodes.containsKey(code)) return fallback;
  return kVaccineDisplayNames[lang]?[code] ?? fallback;
}

String? _nonEmpty(String? s) => s == null || s.isEmpty ? null : s;

const Map<String, String> _azUnits = {'gün': 'day', 'həftə': 'week', 'həftəlik': 'week', 'aylıq': 'month', 'ay': 'month', 'yaş': 'year'};
final RegExp _agePart = RegExp(r'^(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(gün|həftəlik|həftə|aylıq|ay|yaş)$');

/// Intl.NumberFormat(locale, { maximumFractionDigits: 1 }) for the values the labels carry.
String _formatNumber(num value, String lang) {
  final rounded = jsRound(value * 10) / 10;
  final info = kVaccineNumber[lang] ?? kVaccineNumber['en']!;
  var text = jsIsInteger(rounded) ? '${rounded.toInt()}' : rounded.toStringAsFixed(1).replaceFirst('.', info['decimal']!);
  final zero = info['zero']!;
  if (zero != '0') {
    text = text.replaceAllMapped(RegExp('[0-9]'), (m) => String.fromCharCode(zero.codeUnitAt(0) + m[0]!.codeUnitAt(0) - 48));
  }
  return text;
}

/// Intl.PluralRules(locale).select(n) for 0..199.5 (whole and half values); 'x' (other) beyond.
String _category(num n, String lang) {
  final table = kVaccinePlural[lang] ?? kVaccinePlural['en']!;
  final rounded = jsRound(n * 10) / 10;
  if (rounded < 0 || rounded >= 200) return 'x';
  if (jsIsInteger(rounded)) return table[0][rounded.toInt()];
  if ((rounded * 2) == (rounded * 2).truncateToDouble()) return table[1][rounded.floor()];
  return 'x';
}

String? _formatAgePart(String text, String lang) {
  final m = _agePart.firstMatch(text.trim());
  if (m == null) return null;
  final unit = _azUnits[m[3]]!;
  final a = jsNumber(m[1]!.replaceFirst(',', '.'));
  final b = m[2] != null ? jsNumber(m[2]!.replaceFirst(',', '.')) : null;
  final patterns = kVaccineUnitPatterns[lang]?[unit];
  if (patterns == null) return null;
  if (b == null) {
    final p = patterns[_category(a, lang)] ?? patterns['x']!;
    return p.replaceFirst('{0}', _formatNumber(a, lang));
  }
  final ranges = kVaccineRangePatterns[lang]?[unit];
  final r = ranges?[_category(b, lang)] ?? ranges?['x'];
  if (r != null) return r.replaceFirst('{0}', _formatNumber(a, lang)).replaceFirst('{1}', _formatNumber(b, lang));
  final p = patterns[_category(b, lang)] ?? patterns['x']!;
  return '${_formatNumber(a, lang)}-${p.replaceFirst('{0}', _formatNumber(b, lang))}';
}

/// Age label ("2 months", "4–6 years", "At birth") from the Azerbaijani source label; database text otherwise.
String vaccineAgeLabel(VaccineScheduleRow row, String language) {
  final lang = normalizeAppLanguage(language);
  final source = (row.ageLabelAz ?? '').trim();
  final fallback = _nonEmpty(row.ageLabel) ?? source;
  if (lang == 'az' || source.isEmpty) return fallback;
  final birth = RegExp(r'^Doğulanda(?:\s*\((.+)\))?$').firstMatch(source);
  if (birth != null) {
    if (birth[1] == null) return _phrase(lang, 'birth');
    final inner = _formatAgePart(birth[1]!, lang);
    return inner != null ? '${_phrase(lang, 'birth')} ($inner)' : fallback;
  }
  final yearsMonths = RegExp(r'^(\d+)\s*yaş\s+(\d+)\s*ay$').firstMatch(source);
  if (yearsMonths != null) {
    final y = _formatAgePart('${yearsMonths[1]} yaş', lang), mo = _formatAgePart('${yearsMonths[2]} ay', lang);
    return y != null && mo != null ? '$y $mo' : fallback;
  }
  return _formatAgePart(source, lang) ?? fallback;
}

/// Dose label ("Dose 2", "Booster") from the Azerbaijani source label; database text otherwise.
String vaccineDoseLabel(VaccineScheduleRow row, String language) {
  final lang = normalizeAppLanguage(language);
  final source = (row.doseLabelAz ?? '').trim();
  final fallback = _nonEmpty(row.doseLabel) ?? source;
  if (lang == 'az' || source.isEmpty) return fallback;
  if (RegExp(r'^bustər\s*\(revaksinasiya\)$', caseSensitive: false).hasMatch(source)) return _phrase(lang, 'revacc');
  if (RegExp(r'^(ikinci|İkinci)\s+bustər$', caseSensitive: false).hasMatch(source)) return _phrase(lang, 'booster2');
  if (RegExp(r'^bustər$', caseSensitive: false).hasMatch(source)) return _phrase(lang, 'booster');
  final dose = RegExp(r'^(\d+)\s*-\s*(?:ci|cı|cu|cü|ncı|nci|ncu|ncü)\s+doza(?:\s*\((.+)\))?$', caseSensitive: false).firstMatch(source);
  if (dose == null) return fallback;
  final label = _phrase(lang, 'dose').replaceFirst('{n}', dose[1]!).replaceFirst('{ord}', turkmenOrdinalSuffix(int.parse(dose[1]!)));
  if (dose[2] == null) return label;
  if (RegExp(r'^doğulanda$', caseSensitive: false).hasMatch(dose[2]!.trim())) return '$label (${kVaccineBirthLower[lang]})';
  return fallback;
}

/// Route of administration in the app language; database text for anything unrecognised.
String vaccineRouteLabel(VaccineScheduleRow row, String language) {
  final lang = normalizeAppLanguage(language);
  // toLocaleLowerCase('az'): dotted / dotless I as in Azerbaijani.
  final source = (row.vaccine.routeAz ?? '').trim().replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();
  final fallback = _nonEmpty(row.vaccine.route) ?? row.vaccine.routeAz ?? '';
  if (lang == 'az' || source.isEmpty) return fallback;
  if (source.startsWith('əzələdaxili')) return _phrase(lang, 'im');
  if (source.startsWith('ağızdan')) return _phrase(lang, 'oral');
  if (source.startsWith('dərialtı')) return _phrase(lang, 'sc');
  if (source.startsWith('dəridaxili')) return _phrase(lang, 'id');
  return fallback;
}

/// "Hepatitis B (HepB) (Dose 1)" style text for reminders.
String vaccineReminderLabel(VaccineScheduleRow row, String language) =>
    '${vaccineDisplayName(row, language)} (${vaccineDoseLabel(row, language)})';

/// Notification title/body for one reminder slot.
({String title, String body}) vaccineReminderText(String kind, String childName, VaccineScheduleRow? row, String language) {
  final vars = {'child': childName, 'vaccine': row != null ? vaccineReminderLabel(row, language) : ''};
  if (kind == 'soon') {
    return (title: tr('sleepvax_vax_soon_title', 'Peyvənd yaxınlaşır'), body: formatTr('sleepvax_vax_soon_body', '{child}: {vaccine} 3 gün sonradır.', vars));
  }
  if (kind == 'today') {
    return (
      title: tr('sleepvax_vax_today_title', 'Bu gün peyvənd günüdür'),
      body: formatTr('sleepvax_vax_today_body', '{child}: {vaccine} bu gün üçün planlanıb.', vars),
    );
  }
  return (
    title: tr('sleepvax_vax_overdue_title', 'Peyvənd vaxtı keçib'),
    body: formatTr('sleepvax_vax_overdue_body', '{child}: {vaccine} hələ qeyd olunmayıb. Yeni tarix üçün həkiminizlə danışın.', vars),
  );
}

class VaccineAgeGroup<T> {
  const VaccineAgeGroup({required this.days, required this.label, required this.items});
  final num days;
  final String label;
  final List<T> items;
}

/// Age groups for the full plan, keyed by the stable `recommended_age_days` (never by translated text).
List<VaccineAgeGroup<T>> vaccineAgeGroups<T>(List<T> items, VaccineScheduleRow Function(T item) rowOf, String language) {
  final groups = <num, ({List<String> labels, List<T> items})>{};
  for (final item in items) {
    final row = rowOf(item);
    final days = row.recommendedAgeDays;
    final group = groups.putIfAbsent(days, () => (labels: <String>[], items: <T>[]));
    final label = vaccineAgeLabel(row, language);
    if (label.isNotEmpty && !group.labels.contains(label)) group.labels.add(label);
    group.items.add(item);
  }
  final keys = groups.keys.toList()..sort();
  return [for (final k in keys) VaccineAgeGroup(days: k, label: groups[k]!.labels.join(' / '), items: groups[k]!.items)];
}
