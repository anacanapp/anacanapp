// Ported from: src/lib/recap/pace.ts
//
// Reveal schedule shared by the renderer and the model: every scene holds fully built for at least HOLD seconds
// before its exit transition. Scenes are the JSON-shaped maps of recap_model.dart.

import 'dart:math' as math;

abstract final class Pace {
  static const double hold = 1.8;
  static const double exit = 0.36;
  static const double word = 0.5;
  static const double stagger = 0.035;
  static const double pill = 0.45;
  static const double numberStart = 0.3;
  static const double numberCount = 1.2;
  static const double numberPop = 0.4;
  static const double lineDelay = 0.7;
  static const double subGap = 0.15;
  static const double chipGap = 0.1;
  static const double calendar = 1.4;
}

final RegExp _cjkToken = RegExp(r'[A-Za-z0-9.,:%+\-→·]+|[\s]+|[　-〿＀-￯，。！？、：」』）]|.', unicode: true);
final RegExp _cjkPunct = RegExp(r'^[　-〿＀-￯，。！？、：」』）]$', unicode: true);

/// Word tokens as the renderer lays them out (Chinese / Japanese break per character).
List<String> tokenize(String text, bool cjk) {
  if (!cjk) return text.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
  final out = <String>[];
  for (final m in _cjkToken.allMatches(text)) {
    final tok = m[0]!;
    if (RegExp(r'^\s+$').hasMatch(tok)) continue;
    if (out.isNotEmpty && _cjkPunct.hasMatch(tok)) {
      out[out.length - 1] += tok;
    } else {
      out.add(tok);
    }
  }
  return out;
}

/// End of a staggered sentence starting at [delay].
double sentenceEnd(String text, bool cjk, double delay, [double stagger = Pace.stagger]) =>
    delay + math.max(0, tokenize(text, cjk).length - 1) * stagger + Pace.word;

class StatPlan {
  const StatPlan({required this.number, required this.line, required this.subs, required this.chips, required this.calendar, required this.badge, required this.built});
  final double number;
  final double line;
  final List<double> subs;
  final double chips;
  final double calendar;
  final double badge;
  final double built;
}

/// When each part of a stat scene appears, and when the scene is fully built.
StatPlan statPlan(Map<String, Object?> s, bool cjk) {
  final line = s['line']! as String;
  final subsIn = s['subs']! as List;
  final chipsIn = s['chips']! as List;
  final lineEnd = sentenceEnd(line, cjk, Pace.lineDelay);
  var t = Pace.lineDelay + 0.2 + math.max(0, tokenize(line, cjk).length - 1) * Pace.stagger;
  var built = math.max(Pace.numberStart + Pace.numberCount + Pace.numberPop, lineEnd);
  final calendar = s['motif'] == 'calendar' && (s['param']! as num) * 365 >= 30 ? t - 0.2 : -1.0;
  if (calendar >= 0) {
    built = math.max(built, calendar + 0.1 + Pace.calendar);
    t += 0.3;
  }
  final subs = [for (var i = 0; i < subsIn.length; i++) t + i * Pace.subGap];
  if (subs.isNotEmpty) {
    built = math.max(built, subs.last + Pace.pill);
    t = subs.last + Pace.subGap;
  }
  final chips = chipsIn.isNotEmpty ? t : -1.0;
  if (chips >= 0) {
    built = math.max(built, chips + (chipsIn.length - 1) * Pace.chipGap + Pace.pill);
    t = chips + chipsIn.length * Pace.chipGap;
  }
  final badgeText = s['badge'];
  final badge = badgeText is String && badgeText.isNotEmpty ? t + 0.05 : -1.0;
  if (badge >= 0) built = math.max(built, badge + 0.55);
  if (s['motif'] == 'glasses') built = math.max(built, 0.4 + 7 * 0.1 + 0.6);
  return StatPlan(number: Pace.numberStart, line: Pace.lineDelay, subs: subs, chips: chips, calendar: calendar, badge: badge, built: built);
}

/// Seconds from the scene start until everything is on screen.
double sceneBuildTime(Map<String, Object?> s, bool cjk) {
  switch (s['kind']) {
    case 'cold':
      return math.max(0.5 + 3 * 0.12 + 0.8, sentenceEnd(s['title']! as String, cjk, 1.2, 0.06));
    case 'stat':
      return statPlan(s, cjk).built;
    case 'journey':
      final n = (s['stages']! as List).length;
      return math.max(0.3 + (n - 1) * 0.45 + 0.6, sentenceEnd(s['line']! as String, cjk, 0.4 + n * 0.45));
    case 'milestones':
      final n = (s['items']! as List).length + (s['more'] is String && (s['more'] as String).isNotEmpty ? 1 : 0);
      return [0.3 + 1.0, 0.8 + math.max(0, n - 1) * 0.22 + 0.5, sentenceEnd(s['line']! as String, cjk, 0.9 + n * 0.22)].reduce(math.max);
    case 'growth':
      return [0.6 + 1.0 + 0.4, 0.5 + 1.1, sentenceEnd(s['line']! as String, cjk, 0.9)].reduce(math.max);
    case 'peak':
      final burst = (s['burst']! as num).toDouble(), n = (s['stats']! as List).length;
      return math.max(burst + (n - 1) * 0.25 + 0.8, sentenceEnd(s['close']! as String, cjk, burst + 0.2 + n * 0.2, 0.06));
    case 'persona':
      return [1.1, sentenceEnd(s['title']! as String, cjk, 0.5, 0.1), sentenceEnd(s['reason']! as String, cjk, 0.9, 0.03)].reduce(math.max);
    case 'summary':
      return 0.6 + 3 * 0.15 + 1.0;
    case 'outro':
      return 1.9;
  }
  return double.nan;
}

/// Shortest duration that still holds the built scene for Pace.hold seconds.
double minSceneDuration(Map<String, Object?> s, bool cjk, [bool last = false]) => sceneBuildTime(s, cjk) + Pace.hold + (last ? 0 : Pace.exit);
