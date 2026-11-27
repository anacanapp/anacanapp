// Ported from: src/lib/nap-alerts.ts
//
// Local sleep notifications on this phone: before the next nap window, long daytime nap, and one week before a
// sleep regression. Settings are per device; quiet hours 22:00-07:00. Planning is pure; delivery goes through
// the local notification scheduler (namespace 'nap').

import 'dart:convert';

import '../js_compat.dart';
import 'sleep_predict.dart';

class NapAlertSettings {
  const NapAlertSettings({this.enabled = true, this.lead = 15, this.longNap = true, this.regression = true, this.quiet = true});
  final bool enabled;

  /// 5 | 10 | 15 | 20
  final int lead;
  final bool longNap;
  final bool regression;
  final bool quiet;

  NapAlertSettings copyWith({bool? enabled, int? lead}) =>
      NapAlertSettings(enabled: enabled ?? this.enabled, lead: lead ?? this.lead, longNap: longNap, regression: regression, quiet: quiet);

  Map<String, Object?> toJson() => {'enabled': enabled, 'lead': lead, 'longNap': longNap, 'regression': regression, 'quiet': quiet};
}

const NapAlertSettings defaultNapAlerts = NapAlertSettings();
const String napAlertsStorageKey = 'anacan.napAlerts.v1';

abstract final class NapAlertIds {
  static const int nap = 880001;
  static const int long = 880002;
  static const int regression = 880003;
  static const List<int> all = [nap, long, regression];
}

/// `readNapAlerts` on the raw stored value (localStorage text or null).
NapAlertSettings parseNapAlerts(String? raw) {
  try {
    final v = jsonDecode(raw == null || raw.isEmpty ? 'null' : raw);
    if (v is! Map) return defaultNapAlerts;
    final lead = const [5, 10, 15, 20].contains(v['lead']) ? (v['lead'] as num).toInt() : 15;
    return NapAlertSettings(
      enabled: v['enabled'] != false,
      lead: lead,
      longNap: v['longNap'] != false,
      regression: v['regression'] != false,
      quiet: v['quiet'] != false,
    );
  } catch (_) {
    return defaultNapAlerts;
  }
}

/// Inside quiet hours (22:00-07:00 local)?
bool inQuietHours(DateTime d) => d.hour >= 22 || d.hour < 7;

class PlannedAlert {
  const PlannedAlert({required this.id, required this.at, required this.title, required this.body});
  final int id;
  final DateTime at;
  final String title;
  final String body;
}

class NapAlertText {
  const NapAlertText({
    required this.napTitle,
    required this.napBody,
    required this.longTitle,
    required this.longBody,
    required this.regressTitle,
    required this.regressBody,
  });
  final String Function(int min) napTitle;
  final String napBody;
  final String longTitle;
  final String longBody;
  final String regressTitle;
  final String regressBody;
}

/// Which notifications should be pending now.
List<PlannedAlert> planNapAlerts({
  required NapAlertSettings settings,
  required DateTime now,
  required NextNap next,
  required DateTime? sleepingSince,
  required Regression? regression,
  required NapAlertText text,
}) {
  if (!settings.enabled) return [];
  final out = <PlannedAlert>[];
  bool ok(DateTime at) => at.millisecondsSinceEpoch > now.millisecondsSinceEpoch + 30000 && !(settings.quiet && inQuietHours(at));
  if (next.windowStart != null && !next.isBedtime && (next.state == 'early' || next.state == 'soon')) {
    final at = jsDateFromMs(next.windowStart!.millisecondsSinceEpoch - settings.lead * 60000);
    if (ok(at)) out.add(PlannedAlert(id: NapAlertIds.nap, at: at, title: text.napTitle(settings.lead), body: text.napBody));
  }
  if (settings.longNap && sleepingSince != null) {
    final h = sleepingSince.hour;
    if (h >= 7 && h < 18) {
      final at = jsDateFromMs(sleepingSince.millisecondsSinceEpoch + 120 * 60000);
      if (ok(at)) out.add(PlannedAlert(id: NapAlertIds.long, at: at, title: text.longTitle, body: text.longBody));
    }
  }
  if (settings.regression && regression != null && !regression.active && regression.daysUntil >= 7) {
    final d = jsDateFromMs(regression.start.millisecondsSinceEpoch - 7 * 86400000);
    final at = DateTime(d.year, d.month, d.day, 10);
    if (ok(at)) out.add(PlannedAlert(id: NapAlertIds.regression, at: at, title: text.regressTitle, body: text.regressBody));
  }
  return out;
}
