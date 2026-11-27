// Ported from: src/lib/ttc.ts, src/data/ttc/index.ts (useTtcText → ttcText), src/lib/feature-text.ts (fill)
//
// "Trying to conceive" goal inside Flow. profiles.flow_goal switches the Flow home, profiles.ttc_state keeps the
// start month, checklist and pregnancy tests (bounded JSON).
import '../../core/i18n/i18n.dart';
import '../home_flow/data/flow_repository.dart';
import 'data/ttc_text.g.dart';

/// 'track' | 'conceive'
typedef FlowGoal = String;

/// 'negative' | 'faint' | 'positive'
typedef PregnancyTest = String;

const List<String> kChecklistKeys = ['folic', 'gyn', 'labs', 'vaccines', 'dentist', 'lifestyle', 'meds', 'partner'];

/// 'low' | 'medium' | 'high' | 'peak'
typedef Chance = String;

DateTime _midnight(DateTime d) => DateTime(d.year, d.month, d.day);
int dayDiff(DateTime a, DateTime b) => ((_midnight(a).millisecondsSinceEpoch - _midnight(b).millisecondsSinceEpoch) / 86400000).round();

/// Chance of conceiving on a day relative to (estimated or confirmed) ovulation.
Chance chanceFor(DateTime day, DateTime ovulation) {
  final d = dayDiff(day, ovulation);
  if (d == -1 || d == 0) return 'peak';
  if (d == -2 || d == -3) return 'high';
  if (d == -4 || d == -5 || d == 1) return 'medium';
  return 'low';
}

/// Whole months since they started trying (0 in the first month).
int? monthsTrying(String? startedOn, [DateTime? now]) {
  final n = now ?? DateTime.now();
  if (startedOn == null || startedOn.isEmpty) return null;
  final p = startedOn.split('-').map((x) => int.tryParse(x) ?? 0).toList();
  final y = p.isNotEmpty ? p[0] : 0, m = p.length > 1 ? p[1] : 0, d = p.length > 2 ? p[2] : 0;
  if (y == 0 || m == 0) return null;
  var months = (n.year - y) * 12 + (n.month - 1 - (m - 1));
  if (n.day < (d == 0 ? 1 : d)) months -= 1;
  return months < 0 ? 0 : months;
}

/// See a doctor after 12 months, or 6 months from age 35.
int doctorThreshold(int? age) => age != null && age >= 35 ? 6 : 12;

const int kMinBirthYear = 1950;
int maxBirthYear([DateTime? now]) => (now ?? DateTime.now()).year - 12;

/// A valid stored birth year, or null.
int? validBirthYear(Object? value, [DateTime? now]) {
  final num? year = value is String ? num.tryParse(value.trim().isEmpty ? 'x' : value.trim()) : (value is num ? value : null);
  if (year == null || year != year.truncateToDouble() || !year.isFinite) return null;
  final y = year.toInt();
  return y >= kMinBirthYear && y <= maxBirthYear(now) ? y : null;
}

int? ageFromBirthYear(Object? value, [DateTime? now]) {
  final y = validBirthYear(value, now);
  return y == null ? null : (now ?? DateTime.now()).year - y;
}

int doctorThresholdFor(Map<String, Object?>? state, [DateTime? now]) => doctorThreshold(ageFromBirthYear(state?['birth_year'], now));

/// "Three over six": a rise of ≥ 0.2 °C held for 3 days over the previous 6 days' highest value.
int? bbtShift(List<double?> values) {
  final days = [for (var i = 0; i < values.length; i++) if (values[i] != null) (v: values[i]!, i: i)];
  for (var k = 6; k + 2 < days.length; k++) {
    final base = days.sublist(k - 6, k).map((x) => x.v).reduce((a, b) => a > b ? a : b);
    if (days.sublist(k, k + 3).every((x) => x.v >= base + 0.2)) return days[k].i;
  }
  return null;
}

/// TtcState JSON (profiles.ttc_state): started_on, checklist, tests, snooze_until, birth_year.
typedef TtcState = Map<String, Object?>;

Future<void> saveFlowGoal(FlowRepository repo, String userId, FlowGoal goal, [TtcState? state]) =>
    repo.updateProfile(userId, {'flow_goal': goal, 'ttc_state': ?state});

Future<void> saveTtcState(FlowRepository repo, String userId, TtcState state) {
  final tests = (state['tests'] as List?) ?? const [];
  final bounded = <String, Object?>{...state, 'tests': tests.length > 30 ? tests.sublist(tests.length - 30) : List.of(tests)};
  if (state['birth_year'] != null && validBirthYear(state['birth_year']) == null) bounded.remove('birth_year');
  return repo.updateProfile(userId, {'ttc_state': bounded});
}

/// Positive test → pregnancy mode with the current cycle's first day as LMP.
Future<void> switchToPregnancy(FlowRepository repo, String userId, String lmp, String dueDate) =>
    repo.updateProfile(userId, {'life_stage': 'bump', 'last_period_date': lmp, 'due_date': dueDate, 'flow_goal': 'track'});

/// `fill(template, values)`.
String fill(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);

/// `useTtcText(language)`: own file, else en, else az. Values are strings, string lists and nested maps.
class TtcText {
  TtcText._(this._d);
  final Map<String, Object> _d;
  factory TtcText.of([String? language]) {
    final lang = normalizeAppLanguage(language ?? currentLanguage());
    return TtcText._(kTtcText[lang] ?? kTtcText['en'] ?? kTtcText['az']!);
  }

  /// `t.key` or `t.a.b`.
  String call(String path) {
    Object? v = _d;
    for (final part in path.split('.')) {
      v = v is Map ? v[part] : null;
    }
    return v is String ? v : path;
  }

  List<String> list(String key) => [for (final x in (_d[key] as List? ?? const [])) '$x'];
}
