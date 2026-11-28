// Ported from: src/lib/illness.ts (models, temperature bands and units, medicines, alerts, episode day, reminder ids
//              and the reminder plan of syncDoseReminders)
//
// Baby illness journal (Duzelis75). The family - the mother and her mutually linked partner - reads and writes
// episodes and entries through SECURITY DEFINER RPCs (illness_data.dart). The app never calculates a dose: the
// dose and interval are stored exactly as entered.
import 'dart:ui' show Color;

import '../../../core/i18n/count_format.dart' show formatIntlNumber;
import '../../../domain/js_compat.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../state/local_store.dart';

/// 'fever' | 'cold' | 'stomach' | 'ear' | 'rash' | 'teething' | 'vaccine' | 'other'.
typedef IllnessKind = String;
const List<IllnessKind> illnessKinds = ['fever', 'cold', 'stomach', 'ear', 'rash', 'teething', 'vaccine', 'other'];
const Map<IllnessKind, String> kindEmoji = {
  'fever': '🤒', 'cold': '🤧', 'stomach': '🤢', 'ear': '👂', 'rash': '🔴', 'teething': '🦷', 'vaccine': '💉', 'other': '🩺',
};

/// 'armpit' | 'ear' | 'forehead' | 'rectal' | 'oral'.
typedef TempMethod = String;
const List<TempMethod> tempMethods = ['armpit', 'ear', 'forehead', 'rectal', 'oral'];
const List<String> illnessSymptoms = [
  'cough', 'runny_nose', 'vomit', 'diarrhea', 'poor_feeding', 'fewer_diapers', 'rash', 'sleepy', 'irritable', 'breathing', 'ear_pull',
];

num? _num(Object? v) => v is num ? v : (v is String ? num.tryParse(v) : null);
String? _str(Object? v) => v is String ? v : null;

class IllnessEpisode {
  const IllnessEpisode({
    required this.id,
    this.childId,
    this.childName,
    required this.kind,
    required this.startedAt,
    this.endedAt,
    this.note,
    this.entries = 0,
    this.lastTemp,
    this.maxTemp,
  });
  final String id;
  final String? childId;
  final String? childName;
  final IllnessKind kind;
  final String startedAt;
  final String? endedAt;
  final String? note;
  final int entries;
  final num? lastTemp;
  final num? maxTemp;

  factory IllnessEpisode.fromRow(Map<String, dynamic> r) => IllnessEpisode(
        id: '${r['id']}',
        childId: _str(r['child_id']),
        childName: _str(r['child_name']),
        kind: _str(r['kind']) ?? 'other',
        startedAt: _str(r['started_at']) ?? '',
        endedAt: _str(r['ended_at']),
        note: _str(r['note']),
        entries: _num(r['entries'])?.toInt() ?? 0,
        lastTemp: _num(r['last_temp']),
        maxTemp: _num(r['max_temp']),
      );

  Map<String, dynamic> toRow() => {
        'id': id,
        'child_id': childId,
        'child_name': childName,
        'kind': kind,
        'started_at': startedAt,
        'ended_at': endedAt,
        'note': note,
        'entries': entries,
        'last_temp': lastTemp,
        'max_temp': maxTemp,
      };
}

class IllnessEntry {
  const IllnessEntry({
    required this.id,
    required this.kind,
    required this.at,
    this.tempC,
    this.tempMethod,
    this.medName,
    this.dose,
    this.intervalHours,
    this.remind = false,
    this.symptoms,
    this.note,
    this.by,
    this.byMe = false,
  });

  final String id;

  /// 'temp' | 'med' | 'symptom'.
  final String kind;
  final String at;
  final double? tempC;
  final TempMethod? tempMethod;
  final String? medName;
  final String? dose;
  final double? intervalHours;
  final bool remind;
  final List<String>? symptoms;
  final String? note;

  /// 'mother' | 'partner' | null.
  final String? by;
  final bool byMe;

  /// `listEntries` maps `temp_c` / `interval_hours` through `Number()` (numeric columns arrive as strings).
  factory IllnessEntry.fromRow(Map<String, dynamic> r) => IllnessEntry(
        id: '${r['id']}',
        kind: _str(r['kind']) ?? 'temp',
        at: _str(r['at']) ?? '',
        tempC: r['temp_c'] == null ? null : _num(r['temp_c'])?.toDouble() ?? double.nan,
        tempMethod: _str(r['temp_method']),
        medName: _str(r['med_name']),
        dose: _str(r['dose']),
        intervalHours: r['interval_hours'] == null ? null : _num(r['interval_hours'])?.toDouble() ?? double.nan,
        remind: r['remind'] == true,
        symptoms: r['symptoms'] is List ? [for (final s in r['symptoms'] as List) if (s is String) s] : null,
        note: _str(r['note']),
        by: _str(r['by']),
        byMe: r['by_me'] == true,
      );

  Map<String, dynamic> toRow() => {
        'id': id,
        'kind': kind,
        'at': at,
        'temp_c': tempC,
        'temp_method': tempMethod,
        'med_name': medName,
        'dose': dose,
        'interval_hours': intervalHours,
        'remind': remind,
        'symptoms': symptoms,
        'note': note,
        'by': by,
        'by_me': byMe,
      };
}

/// `NewIllnessEntry` as sent to `illness_entry_add_v1` (`note` only when given, like `undefined` in JSON).
Map<String, Object?> newTempEntry({required String at, required double tempC, required TempMethod method, String? note}) =>
    {'kind': 'temp', 'at': at, 'temp_c': tempC, 'temp_method': method, 'note': ?note};

Map<String, Object?> newMedEntry({
  required String at,
  required String medName,
  required String dose,
  required num intervalHours,
  required bool remind,
  String? note,
}) =>
    {'kind': 'med', 'at': at, 'med_name': medName, 'dose': dose, 'interval_hours': intervalHours, 'remind': remind, 'note': ?note};

Map<String, Object?> newSymptomEntry({required String at, required List<String> symptoms, String? note}) =>
    {'kind': 'symptom', 'at': at, 'symptoms': symptoms, 'note': ?note};

DateTime _at(String iso) => jsParseDate(iso) ?? DateTime.fromMillisecondsSinceEpoch(0);

// ── Temperature ──────────────────────────────────────────────────────────────────

/// 'low' | 'normal' | 'subfebrile' | 'fever' | 'high'.
typedef TempBand = String;

TempBand tempBand(num temp) {
  if (temp < 36) return 'low';
  if (temp < 37.5) return 'normal';
  if (temp < 38) return 'subfebrile';
  if (temp < 39.5) return 'fever';
  return 'high';
}

/// `BAND_COLOR` (one-off literals of src/lib/illness.ts).
const Map<TempBand, Color> bandColor = {
  'low': Color(0xFF3B82C4),
  'normal': Color(0xFF1C7A4D),
  'subfebrile': Color(0xFFB7791F),
  'fever': Color(0xFFE8590C),
  'high': Color(0xFFC92A2A),
};

// ── Medicines ────────────────────────────────────────────────────────────────────

class MedStatus {
  const MedStatus({
    required this.name,
    this.dose,
    required this.lastAt,
    required this.intervalHours,
    required this.nextAt,
    required this.remind,
    this.by,
    required this.byMe,
  });
  final String name;
  final String? dose;
  final DateTime lastAt;
  final double intervalHours;
  final DateTime nextAt;
  final bool remind;
  final String? by;
  final bool byMe;
}

/// The latest dose of each medicine (by name, case-insensitive) with the next allowed time.
List<MedStatus> medStatuses(List<IllnessEntry> entries) {
  final seen = <String, MedStatus>{};
  for (final entry in entries) {
    final interval = entry.intervalHours;
    if (entry.kind != 'med' || entry.medName == null || entry.medName!.isEmpty || interval == null || interval == 0 || interval.isNaN) {
      continue;
    }
    final key = entry.medName!.trim().toLowerCase();
    final at = _at(entry.at);
    final current = seen[key];
    if (current != null && !current.lastAt.isBefore(at)) continue;
    seen[key] = MedStatus(
      name: entry.medName!,
      dose: entry.dose,
      lastAt: at,
      intervalHours: interval,
      nextAt: DateTime.fromMillisecondsSinceEpoch(at.millisecondsSinceEpoch + (interval * 3600000).round()),
      remind: entry.remind,
      by: entry.by,
      byMe: entry.byMe,
    );
  }
  return jsSorted(seen.values, (a, b) => b.lastAt.millisecondsSinceEpoch - a.lastAt.millisecondsSinceEpoch);
}

/// A dose logged before the previous one's interval ended (same medicine).
({MedStatus last, int minutesAgo})? earlyDose(List<IllnessEntry> entries, String medName, DateTime at) {
  final name = medName.trim().toLowerCase();
  MedStatus? last;
  for (final m in medStatuses(entries)) {
    if (m.name.trim().toLowerCase() == name) {
      last = m;
      break;
    }
  }
  if (last == null || !at.isAfter(last.lastAt) || !at.isBefore(last.nextAt)) return null;
  return (last: last, minutesAgo: jsRoundInt((at.millisecondsSinceEpoch - last.lastAt.millisecondsSinceEpoch) / 60000));
}

// ── Warning signs (from entries) ─────────────────────────────────────────────────

class IllnessAlert {
  const IllnessAlert(this.kind, {this.temp, this.months});

  /// 'infant' | 'breathing' | 'high' | 'long'.
  final String kind;
  final double? temp;
  final int? months;

  @override
  bool operator ==(Object other) => other is IllnessAlert && other.kind == kind && other.temp == temp && other.months == months;
  @override
  int get hashCode => Object.hash(kind, temp, months);
  @override
  String toString() => 'IllnessAlert($kind, temp: $temp, months: $months)';
}

/// Alerts the screen must show: fever in a baby under 3 months, breathing difficulty, 40 °C or more, fever for
/// more than 3 days. Age in months is null when unknown (then the infant rule is skipped).
List<IllnessAlert> illnessAlerts(String? endedAt, List<IllnessEntry> entries, int? ageMonths, [DateTime? now]) {
  if (endedAt != null && endedAt.isNotEmpty) return const [];
  final at = now ?? DomainClock.now();
  final alerts = <IllnessAlert>[];
  final temps = entries.where((e) => e.kind == 'temp' && e.tempC != null).toList();
  final latest = temps.isEmpty ? null : temps.first.tempC;
  if (latest != null && ageMonths != null && ageMonths < 3 && latest >= 38) alerts.add(IllnessAlert('infant', temp: latest, months: ageMonths));
  if (entries.any((e) =>
      e.kind == 'symptom' && (e.symptoms?.contains('breathing') ?? false) && at.millisecondsSinceEpoch - _at(e.at).millisecondsSinceEpoch < 24 * 3600000)) {
    alerts.add(const IllnessAlert('breathing'));
  }
  if (latest != null && latest >= 40) alerts.add(IllnessAlert('high', temp: latest));
  final feverTemps = temps.where((e) => (e.tempC ?? 0) >= 38).toList();
  if (feverTemps.length >= 2) {
    final first = _at(feverTemps.last.at).millisecondsSinceEpoch;
    final last = _at(feverTemps.first.at).millisecondsSinceEpoch;
    if (last - first > 72 * 3600000) alerts.add(const IllnessAlert('long'));
  }
  return alerts;
}

/// Days since the episode started, counting the first day as 1.
int episodeDay(String startedAt, [DateTime? now]) {
  final start = _at(startedAt).toLocal();
  final n = (now ?? DomainClock.now()).toLocal();
  final a = DateTime(start.year, start.month, start.day);
  final b = DateTime(n.year, n.month, n.day);
  final d = jsRoundInt((b.millisecondsSinceEpoch - a.millisecondsSinceEpoch) / 86400000) + 1;
  return d < 1 ? 1 : d;
}

// ── Next-dose reminders on this device ───────────────────────────────────────────

/// Stable notification id per medicine and episode (31-bit positive).
int reminderId(String episodeId, String medName) {
  var hash = 7;
  for (final rune in '$episodeId:${medName.trim().toLowerCase()}'.runes) {
    // `char.charCodeAt(0)`: the first UTF-16 unit of the code point.
    final unit = rune > 0xFFFF ? 0xD800 + ((rune - 0x10000) >> 10) : rune;
    hash = ((hash * 31 + unit) & 0xFFFFFFFF).toSigned(32);
  }
  return 900000000 + (hash.abs() % 99000000);
}

/// The reminders `syncDoseReminders` hands to the scheduler: namespace `illness:<episode>`, one per medicine
/// whose reminder is on and whose next dose is more than a minute away (none for an ended episode); every
/// medicine's id is cancelled first.
({String namespace, List<StoredNotification> due, List<int> cancelIds}) doseReminderPlan(
  IllnessEpisode episode,
  List<IllnessEntry> entries, {
  required String Function(String med) title,
  required String body,
  DateTime? now,
}) {
  final statuses = medStatuses(entries);
  final at = (now ?? DomainClock.now()).millisecondsSinceEpoch;
  final cancel = [for (final m in statuses) reminderId(episode.id, m.name)];
  final ended = episode.endedAt != null && episode.endedAt!.isNotEmpty;
  final due = ended ? const <MedStatus>[] : statuses.where((m) => m.remind && m.nextAt.millisecondsSinceEpoch > at + 60000).toList();
  return (
    namespace: 'illness:${episode.id}',
    due: [
      for (final m in due) StoredNotification(id: reminderId(episode.id, m.name), title: title(m.name), body: body, at: m.nextAt.millisecondsSinceEpoch),
    ],
    cancelIds: cancel,
  );
}

// ── Temperature unit (°C / °F) ───────────────────────────────────────────────────
// Readings are always stored and evaluated in °C. °F is only a display / input unit, chosen per device.

/// 'C' | 'F'.
typedef TempUnit = String;
const String tempUnitKey = 'anacan.illness.temp-unit';
const double tempMinC = 35;
const double tempMaxC = 42.5;

double cToF(num c) => c * 9 / 5 + 32;
double fToC(num f) => (f - 32) * 5 / 9;
double _round1(num v) => jsRound(v * 10) / 10;

/// A °C reading in the given unit, rounded to 0.1.
double toUnit(num c, TempUnit unit) => _round1(unit == 'F' ? cToF(c) : c);

/// A value typed in the given unit back to °C, rounded to 0.1 (what the database keeps).
double fromUnit(num value, TempUnit unit) => _round1(unit == 'F' ? fToC(value) : value);

/// The app language of a BCP 47 tag (`en-US` → `en`) for the number symbols.
String _languageOf(String? locale) => (locale == null || locale.isEmpty ? 'az' : locale).split(RegExp('[-_]')).first.toLowerCase();

/// `value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })`.
String formatOneDecimal(num value, String? locale) => formatIntlNumber(_languageOf(locale), value, maximumFractionDigits: 1, minimumFractionDigits: 1);

/// "38.5 °C" / "101.3 °F" in the locale's number format.
String formatTemp(num c, TempUnit unit, [String? locale, bool withUnit = true]) {
  final text = formatOneDecimal(toUnit(c, unit), locale);
  return withUnit ? '$text °$unit' : text;
}

/// °F only for devices set to US English; everyone else starts with °C.
TempUnit defaultTempUnit(String? deviceLocale) => (deviceLocale ?? '').replaceFirst('_', '-').toLowerCase() == 'en-us' ? 'F' : 'C';

TempUnit readTempUnit(LocalStore store, String? deviceLocale) {
  try {
    final stored = store.getItem(tempUnitKey);
    if (stored == 'C' || stored == 'F') return stored!;
  } catch (_) {
    // blocked storage
  }
  return defaultTempUnit(deviceLocale);
}

void saveTempUnit(LocalStore store, TempUnit unit) {
  try {
    store.setItem(tempUnitKey, unit);
  } catch (_) {
    // the choice just is not remembered
  }
}

/// Copy templates write "{temp} °C"; drop the unit so the caller passes a value formatted with [formatTemp].
String tempTemplate(String template) => template.replaceAll(RegExp(r'\{temp\}[\s\u00a0\u202f]*°\s*C'), '{temp}');

/// Static copy with °C numbers ("38,0 °C", "39 °C", "38.0°") shown in °F when that unit is chosen.
String localizeTempText(String text, TempUnit unit, [String? locale]) {
  if (unit == 'C') return text;
  return text.replaceAllMapped(RegExp(r'(\d{2}(?:[.,]\d)?)[\s\u00a0\u202f]*°\s*C?'),
      (m) => '${formatTemp(double.parse(m[1]!.replaceFirst(',', '.')), 'F', locale, false)} °F');
}

/// Whole months between [birth] and [now] (`monthsBetween` of IllnessScreen); null without a valid date.
int? monthsBetween(String? birth, [DateTime? now]) {
  if (birth == null || birth.isEmpty) return null;
  final b = jsDate(birth);
  if (b == null) return null;
  final n = now ?? DomainClock.now();
  final m = (n.year - b.year) * 12 + n.month - b.month - (n.day < b.day ? 1 : 0);
  return m < 0 ? 0 : m;
}
