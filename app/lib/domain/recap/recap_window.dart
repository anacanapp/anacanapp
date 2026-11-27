// Ported from: src/lib/recap/window.ts
//
// Recap availability window (app_settings.recap_<year>): everyone, admins included, sees it between start_at and
// end_at; admin_start_at / admin_end_at, when set, replace those dates for admins only.

import 'dart:convert';

import '../js_compat.dart';

/// Parses the stored value (object or JSON string) into the config map.
Map<String, Object?> parseRecapConfig(Object? value) {
  var v = value;
  if (v is String) {
    try {
      v = jsonDecode(v);
    } catch (_) {
      v = <String, Object?>{};
    }
  }
  return v is Map ? v.cast<String, Object?>() : <String, Object?>{};
}

const int _bakuMs = 4 * 3600000;

bool _truthy(Object? v) => v != null && v != false && v != '' && v != 0;

/// ISO timestamp → `<input type="datetime-local">` value in Baku time (UTC+4, no DST).
String toBakuInput(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final t = jsDateParseMs(iso);
  return t != null ? jsToIsoString(DateTime.fromMillisecondsSinceEpoch(t + _bakuMs, isUtc: true)).substring(0, 16) : '';
}

/// datetime-local value (Baku time) → ISO with +04:00, or null when empty/invalid.
String? fromBakuInput(String value) => RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$').hasMatch(value) ? '$value:00+04:00' : null;

/// Window that applies to an admin or to everyone else.
({String? start, String? end}) recapWindow(Map<String, Object?> cfg, bool admin) {
  String? pick(String adminKey, String key) {
    if (admin && _truthy(cfg[adminKey])) return cfg[adminKey] as String;
    return _truthy(cfg[key]) ? cfg[key] as String : null;
  }

  return (start: pick('admin_start_at', 'start_at'), end: pick('admin_end_at', 'end_at'));
}

bool recapOpen(Map<String, Object?> cfg, bool admin, [DateTime? now]) {
  if (!_truthy(cfg['enabled'])) return false;
  final w = recapWindow(cfg, admin);
  final t = (now ?? DomainClock.now()).millisecondsSinceEpoch;
  // Date.parse of a bad value is NaN, and comparisons with NaN are false.
  final s = w.start != null ? (jsDateParseMs(w.start!)?.toDouble() ?? double.nan) : double.infinity;
  final e = w.end != null ? (jsDateParseMs(w.end!)?.toDouble() ?? double.nan) : double.infinity;
  return t >= s && t <= e;
}
