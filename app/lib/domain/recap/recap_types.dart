// Ported from: src/lib/recap/types.ts (parseRecap), src/lib/recap/copy.ts (RECAP_COPY, fillRecap)
//
// The RPC (anacan_recap_v1) returns jsonb and numbers may arrive as strings. The parsed data and the scene model
// are JSON-shaped maps with the TypeScript field names (snake_case data, camelCase scene fields), so they can be
// compared with fixtures produced by the TypeScript.

import '../js_compat.dart';
import 'data/recap_data.g.dart';

/// Translator handed to the model: key → translated text (or the Azerbaijani source).
typedef RecapTranslate = String Function(String key);

/// The Azerbaijani source translator.
String recapSource(String key) => recapCopy[key] ?? key;

/// RecapTranslate from the app's `tr(key, azDefault)`.
RecapTranslate recapTranslator(Tr tr) => (key) => tr(key, recapCopy[key] ?? key);

/// Fills `{placeholders}`; unknown ones are left as they are.
String fillRecap(String template, Map<String, Object> values) =>
    template.replaceAllMapped(RegExp(r'\{([A-Za-z_][A-Za-z0-9_]*)\}'), (m) {
      final v = values[m[1]];
      return v == null ? m[0]! : (v is num ? jsNumberToString(v) : '$v');
    });

Map<String, Object?>? _obj(Object? v) => v is Map ? v.cast<String, Object?>() : null;

double _toNumber(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String && v.trim().isNotEmpty) return jsNumber(v);
  return double.nan;
}

num _num(Object? v) {
  final n = _toNumber(v);
  if (!(n.isFinite && n > 0)) return 0;
  return n == n.truncateToDouble() ? n.toInt() : n;
}

num? _numOrNull(Object? v) {
  final n = _toNumber(v);
  if (!n.isFinite) return null;
  return n == n.truncateToDouble() ? n.toInt() : n;
}

String? _str(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;
bool _isStage(Object? v) => v == 'flow' || v == 'bump' || v == 'mommy';

/// parseRecap: `{available: true, …}` data, or `{available: false, reason, opens_at}`.
Map<String, Object?> parseRecap(Object? raw) {
  final r = _obj(raw);
  if (r == null || r['available'] != true) {
    return {'available': false, 'reason': _str(r?['reason']) ?? 'unknown', 'opens_at': _str(r?['opens_at'])};
  }
  final m = _obj(r['mommy']), b = _obj(r['bump']), f = _obj(r['flow']);
  final hour = _numOrNull(r['favorite_hour']);
  final stages = <String>[];
  if (r['stages'] is List) {
    for (final s in r['stages'] as List) {
      if (_isStage(s) && !stages.contains(s)) stages.add(s as String);
    }
  }
  final y = _num(r['year']);
  return {
    'available': true,
    'preview': r['preview'] == true,
    'year': y != 0 ? y : 2026,
    'name': _str(r['name']),
    'stage': _isStage(r['stage']) ? r['stage'] : null,
    'stages': stages,
    'member_since': _str(r['member_since']),
    'first_open_this_year': _str(r['first_open_this_year']),
    'days_active': jsRoundInt(_num(r['days_active'])),
    'longest_streak': jsRoundInt(_num(r['longest_streak'])),
    'favorite_hour': hour != null && hour >= 0 && hour <= 23 ? hour.floor() : null,
    'top_tools': r['top_tools'] is List
        ? [
            for (final t in (r['top_tools'] as List).map(_obj))
              if (t != null && _str(t['id']) != null && _num(t['count']) > 0) {'id': _str(t['id']), 'count': _num(t['count'])},
          ]
        : <Object?>[],
    'ai_questions': _num(r['ai_questions']),
    'posts_read': _num(r['posts_read']),
    'likes': _num(r['likes']),
    'comments': _num(r['comments']),
    'posts': _num(r['posts']),
    'game_plays': _num(r['game_plays']),
    'achievements': _num(r['achievements']),
    'is_premium': r['is_premium'] == true,
    'mommy': m == null
        ? null
        : {
            'child_name': _str(m['child_name']),
            'child_birth_date': _str(m['child_birth_date']),
            'born_this_year': m['born_this_year'] == true,
            'feedings': _num(m['feedings']),
            'night_feedings': _num(m['night_feedings']),
            'sleeps': _num(m['sleeps']),
            'sleep_hours': _num(m['sleep_hours']),
            'longest_sleep_hours': _num(m['longest_sleep_hours']),
            'diapers': _num(m['diapers']),
            'milestones': _num(m['milestones']),
            'milestone_ids': m['milestone_ids'] is List ? [for (final x in m['milestone_ids'] as List) ?_str(x)] : <String>[],
            'growth_entries': _num(m['growth_entries']),
            'weight_start_kg': _numOrNull(m['weight_start_kg']),
            'weight_end_kg': _numOrNull(m['weight_end_kg']),
            'photos': _num(m['photos']),
            'feedings_top_pct': _numOrNull(m['feedings_top_pct']),
          },
    'bump': b == null
        ? null
        : {
            'due_date': _str(b['due_date']),
            'week_start': _num(b['week_start']),
            'week_end': _num(b['week_end']),
            'kick_sessions': _num(b['kick_sessions']),
            'kicks': _num(b['kicks']),
            'max_kicks_session': _num(b['max_kicks_session']),
            'kicks_top_pct': _numOrNull(b['kicks_top_pct']),
            'bag_items_ready': _num(b['bag_items_ready']),
            'favorite_names': _num(b['favorite_names']),
          },
    'flow': f == null
        ? null
        : {
            'cycles': _num(f['cycles']),
            'avg_cycle_length': _numOrNull(f['avg_cycle_length']),
            'avg_period_length': _numOrNull(f['avg_period_length']),
            'period_days_logged': _num(f['period_days_logged']),
            'days_logged': _num(f['days_logged']),
            'top_symptom': _str(f['top_symptom']),
            'mood_avg': _numOrNull(f['mood_avg']),
            'water_glasses': _num(f['water_glasses']),
            'logging_top_pct': _numOrNull(f['logging_top_pct']),
            'goal': _str(f['goal']),
          },
  };
}
