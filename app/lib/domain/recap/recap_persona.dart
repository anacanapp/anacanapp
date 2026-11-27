// Ported from: src/lib/recap/persona.ts (table generated into data/recap_data.g.dart)
//
// "Your year type": each persona has scoring terms over the person's numbers; the highest score wins (ties:
// table order); `base` is a floor so the fallback (caring) wins when nothing stands out.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/recap_data.g.dart';

const String defaultPersona = 'caring';

/// RECAP_PERSONA_TABLE rows: `{id, stages, base?, lines, terms: [{input, from, to, weight}]}`.
List<Map<String, Object?>> get recapPersonas => recapPersonaTable;

num _n(Object? v) => v is num ? v : 0;

Map<String, num> personaFeatures(Map<String, Object?> d) {
  final m = d['mommy'] as Map?, b = d['bump'] as Map?, f = d['flow'] as Map?;
  final hour = d['favorite_hour'] as num?;
  final nightHour = hour != null && (hour >= 22 || hour < 5);
  return {
    'night_hour': nightHour ? 1 : 0,
    'night_feedings': _n(m?['night_feedings']),
    'night_share': m != null && _n(m['feedings']) > 0 ? _n(m['night_feedings']) / _n(m['feedings']) : 0,
    'streak': _n(d['longest_streak']),
    'days_active': _n(d['days_active']),
    'bag_items': _n(b?['bag_items_ready']),
    'flow_days': _n(f?['days_logged']),
    'kick_sessions': _n(b?['kick_sessions']),
    'feedings': _n(m?['feedings']),
    'milestones': _n(m?['milestones']),
    'sleep_hours': _n(m?['sleep_hours']),
    'ai_questions': _n(d['ai_questions']),
    'posts_read': _n(d['posts_read']),
    'social': _n(d['likes']) + _n(d['comments']) * 2 + _n(d['posts']) * 3,
    'water': _n(f?['water_glasses']),
    'games': _n(d['game_plays']),
  };
}

double _ramp(num v, num from, num to) => to == from ? (v >= to ? 1 : 0) : math.max(0, math.min(1, (v - from) / (to - from))).toDouble();

double scorePersona(Map<String, Object?> def, Map<String, num> x) {
  var sum = 0.0;
  for (final t in (def['terms'] as List? ?? const [])) {
    final term = t as Map;
    sum += (term['weight'] as num) * _ramp(x[term['input']]!, term['from'] as num, term['to'] as num);
  }
  return _n(def['base']) + sum;
}

Map<String, Object?> pickPersonaDef(Map<String, Object?> d, [List<Map<String, Object?>>? table]) {
  final t = table ?? recapPersonaTable;
  final x = personaFeatures(d);
  final stage = d['stage'];
  final eligible = t.where((p) {
    final stages = p['stages']! as List;
    return stages.contains('all') || (stage != null && stages.contains(stage));
  }).toList();
  var best = eligible.firstWhere((p) => p['id'] == defaultPersona, orElse: () => eligible.isNotEmpty ? eligible.first : t.first);
  var bestScore = double.negativeInfinity;
  for (final p in eligible) {
    final sc = scorePersona(p, x);
    if (sc > bestScore + 1e-9) {
      best = p;
      bestScore = sc;
    }
  }
  return best;
}

/// Deterministic FNV-1a hash.
int hashText(String text) => fnv1a32(text);

/// Which "why" line (1-based) this person gets, stable for the same person and year.
int pickWhyLine(Map<String, Object?> def, String seed, num year) {
  final lines = math.max<int>(1, (def['lines'] as num).toInt());
  return hashText('$seed|${jsNumberToString(year)}|${def['id']}') % lines + 1;
}
