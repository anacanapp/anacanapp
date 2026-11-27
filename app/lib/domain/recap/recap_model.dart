// Ported from: src/lib/recap/model.ts
//
// buildRecapModel: turns anacan_recap_v1 data into an ordered, timed list of scenes, cut to the music (drop,
// breath, lift, tail). Pure and deterministic. Data and scenes are JSON-shaped maps with the TypeScript field
// names (see recap_types.dart); looks and music come from data/recap_data.g.dart.

import 'dart:math' as math;

import '../common/app_languages.dart';
import '../js_compat.dart';
import 'data/recap_data.g.dart';
import 'recap_numbers.dart';
import 'recap_pace.dart';
import 'recap_persona.dart';
import 'recap_types.dart';

typedef Json = Map<String, Object?>;

class RecapLabels {
  const RecapLabels({this.tool, this.milestone, this.symptom});
  final String? Function(String id)? tool;
  final String? Function(String id)? milestone;
  final String? Function(String id)? symptom;
}

/// The music the video is cut to.
class RecapMusic {
  const RecapMusic({this.src, required this.length, required this.drop, required this.breath, required this.lift, required this.tail, required this.end, required this.beat});
  final String? src;
  final double length;
  final double drop;
  final double breath;
  final double lift;
  final double tail;
  final double end;
  final double beat;

  factory RecapMusic.fromJson(Map<String, Object?> j) => RecapMusic(
        src: j['src'] as String?,
        length: (j['length']! as num).toDouble(),
        drop: (j['drop']! as num).toDouble(),
        breath: (j['breath']! as num).toDouble(),
        lift: (j['lift']! as num).toDouble(),
        tail: (j['tail']! as num).toDouble(),
        end: (j['end']! as num).toDouble(),
        beat: (j['beat']! as num).toDouble(),
      );
}

/// recap-2026.mp3 as measured.
final RecapMusic recapMusic2026Value = RecapMusic.fromJson(recapMusic2026);

/// Mood 1-5 → orb colour.
String moodColor(num mood) {
  const stops = ['#9C8CF0', '#C9A2E8', '#FF9AB0', '#FFB07A', '#FFD36E'];
  return stops[math.max(0, math.min(4, jsRoundInt(mood) - 1))];
}

int _hash(String text) => fnv1a32(text);

/// Number in the app language (deterministic, see recap_numbers.dart).
String formatRecapNumber(String lang, num n, [int decimals = 0]) => formatNumber(lang, n, decimals);
String _unit(String lang, num n, String u, [int decimals = 0]) => formatUnit(lang, n, u, decimals);
String _pct(String lang, num n) => formatPercent(lang, math.max(1, n));
bool _showPct(Object? v) => v is num && v >= 0 && v <= 30;
String? _clean(String? v) => v != null && v.trim().isNotEmpty ? v.trim() : null;

const Set<String> _cjk = {'zh', 'ja'};

Json _look(String key) => {...recapLooks[key]!, 'bg': [...(recapLooks[key]!['bg']! as List)]};

class _Ctx {
  _Ctx(this.d, this.lang, this.t, this.labels, this.child);
  final Json d;
  final String lang;
  final RecapTranslate t;
  final RecapLabels labels;
  final String? child;
}

String _tf(_Ctx c, String key, [Map<String, Object> values = const {}]) => fillRecap(c.t(key), values);

num _n(Object? v) => v is num ? v : 0;
Json? _o(Object? v) => v is Map ? v.cast<String, Object?>() : null;

Json _stat(_Ctx c, String id, Json lk, String motif, String eyebrow, Json value, String line,
        {List<String>? subs, Object? badge = _none, List<String>? chips, num? param, num? param2}) =>
    {
      'kind': 'stat',
      'id': id,
      'look': lk,
      'seed': _hash(id),
      'motif': motif,
      'eyebrow': eyebrow,
      'value': value,
      'line': line,
      'subs': subs ?? <String>[],
      'badge': identical(badge, _none) ? null : badge,
      'chips': chips ?? <String>[],
      'param': param ?? 0,
      'param2': param2 ?? 0,
    };

const Object _none = Object();

Json _n0(num n, [String label = '']) => {'n': n, 'decimals': 0, 'label': label};

Json _draft(Json scene, int priority, int order) => {...scene, 'priority': priority, 'order': order};

// ── Scene candidates ─────────────────────────────────────────────────────────────────────────────
List<Json> _mommyScenes(_Ctx c) {
  final m = _o(c.d['mommy']);
  if (m == null) return [];
  final out = <Json>[];
  final child = c.child;
  if (_n(m['feedings']) > 0) {
    final subs = _n(m['night_feedings']) > 0 ? [_tf(c, 'recap_feed_night', {'n': formatRecapNumber(c.lang, _n(m['night_feedings']))})] : <String>[];
    out.add(_draft(
        _stat(c, 'mommy_feed', _look('feed'), 'bloom', c.t('recap_feed_eyebrow'), _n0(_n(m['feedings'])),
            _n(m['night_feedings']) >= 5 ? c.t('recap_feed_night_line') : c.t('recap_feed_line'),
            subs: subs,
            badge: _showPct(m['feedings_top_pct']) ? _tf(c, 'recap_top_pct', {'pct': _pct(c.lang, m['feedings_top_pct']! as num)}) : null),
        90,
        10));
  }
  if (_n(m['sleep_hours']) >= 1) {
    out.add(_draft(
        _stat(c, 'mommy_sleep', _look('sleep'), 'moons', c.t('recap_sleep_eyebrow'), _n0(jsRoundInt(_n(m['sleep_hours']))),
            child != null ? _tf(c, 'recap_sleep_line_child', {'child': child}) : c.t('recap_sleep_line'),
            subs: _n(m['longest_sleep_hours']) >= 1
                ? [_tf(c, 'recap_sleep_longest', {'hours': _unit(c.lang, _n(m['longest_sleep_hours']), 'hour', 1)})]
                : <String>[],
            param: math.max(3, math.min(9, jsRoundInt(_n(m['sleep_hours']) / 150)))),
        80,
        20));
  }
  if (_n(m['diapers']) > 0) {
    out.add(_draft(_stat(c, 'mommy_diapers', _look('diapers'), 'bubbles', c.t('recap_diaper_eyebrow'), _n0(_n(m['diapers'])), c.t('recap_diaper_line')), 55, 30));
  }
  final msLabels = <String>[];
  for (final id in (m['milestone_ids'] as List? ?? const [])) {
    final l = _clean(c.labels.milestone?.call(id as String));
    if (l != null && !msLabels.contains(l)) msLabels.add(l);
  }
  if (_n(m['milestones']) > 0) {
    final items = msLabels.take(4).toList();
    final rest = math.max(0, _n(m['milestones']) - items.length);
    out.add({
      'kind': 'milestones',
      'id': 'mommy_milestones',
      'look': _look('milestones'),
      'seed': _hash('mommy_milestones'),
      'eyebrow': c.t('recap_ms_eyebrow'),
      'value': _n0(_n(m['milestones'])),
      'items': items,
      'more': items.isNotEmpty && rest > 0 ? _tf(c, 'recap_ms_more', {'n': formatRecapNumber(c.lang, rest)}) : null,
      'line': child != null ? _tf(c, 'recap_ms_line_child', {'child': child}) : c.t('recap_ms_line'),
      'priority': 85,
      'order': 40,
    });
  }
  final w0 = (m['weight_start_kg'] as num?) ?? 0, w1 = (m['weight_end_kg'] as num?) ?? 0;
  if (_n(m['growth_entries']) >= 2 && w0 > 0 && w1 - w0 >= 0.1) {
    final gain = jsRound((w1 - w0) * 10) / 10;
    final kg = _unit(c.lang, gain, 'kilogram', 1);
    out.add({
      'kind': 'growth',
      'id': 'mommy_growth',
      'look': _look('growth'),
      'seed': _hash('mommy_growth'),
      'eyebrow': c.t('recap_growth_eyebrow'),
      'from': {'n': w0, 'decimals': 1, 'label': _unit(c.lang, w0, 'kilogram', 1)},
      'to': {'n': w1, 'decimals': 1, 'label': _unit(c.lang, w1, 'kilogram', 1)},
      'gain': _tf(c, 'recap_growth_gain', {'kg': kg}),
      'fromLabel': c.t('recap_growth_from'),
      'toLabel': c.t('recap_growth_to'),
      'line': child != null ? _tf(c, 'recap_growth_line_child', {'child': child, 'kg': kg}) : _tf(c, 'recap_growth_line', {'kg': kg}),
      'priority': 75,
      'order': 50,
    });
  }
  return out;
}

List<Json> _bumpScenes(_Ctx c) {
  final b = _o(c.d['bump']);
  if (b == null) return [];
  final out = <Json>[];
  final ws = _n(b['week_start']), we = _n(b['week_end']);
  if (we > 0 && we > ws) {
    final from = math.max(1, jsRoundInt(ws)), to = math.min(42, jsRoundInt(we));
    out.add(_draft(
        _stat(c, 'bump_weeks', _look('weeks'), 'ring', c.t('recap_weeks_eyebrow'),
            {'n': to, 'decimals': 0, 'text': '${formatRecapNumber(c.lang, from)} → ${formatRecapNumber(c.lang, to)}', 'label': ''},
            c.t('recap_weeks_line'),
            param: from,
            param2: to),
        85,
        10));
  }
  if (_n(b['kicks']) > 0) {
    out.add(_draft(
        _stat(c, 'bump_kicks', _look('kicks'), 'pulse', c.t('recap_kicks_eyebrow'), _n0(_n(b['kicks'])), c.t('recap_kicks_line'),
            subs: _n(b['max_kicks_session']) > 1
                ? [_tf(c, 'recap_kicks_max', {'n': formatRecapNumber(c.lang, _n(b['max_kicks_session']))})]
                : <String>[],
            badge: _showPct(b['kicks_top_pct']) ? _tf(c, 'recap_top_pct', {'pct': _pct(c.lang, b['kicks_top_pct']! as num)}) : null),
        90,
        20));
  }
  if (_n(b['bag_items_ready']) > 0) {
    out.add(_draft(
        _stat(c, 'bump_bag', _look('bag'), 'gift', c.t('recap_bag_eyebrow'), _n0(_n(b['bag_items_ready'])), c.t('recap_bag_line'),
            subs: _n(b['favorite_names']) > 0
                ? [_tf(c, 'recap_names_sub', {'n': formatRecapNumber(c.lang, _n(b['favorite_names']))})]
                : <String>[]),
        60,
        30));
  } else if (_n(b['favorite_names']) > 0) {
    out.add(_draft(_stat(c, 'bump_names', _look('bag'), 'names', c.t('recap_names_eyebrow'), _n0(_n(b['favorite_names'])), c.t('recap_names_line')), 55, 30));
  }
  return out;
}

List<Json> _flowScenes(_Ctx c) {
  final f = _o(c.d['flow']);
  if (f == null) return [];
  final out = <Json>[];
  if (_n(f['cycles']) > 0) {
    final subs = <String>[];
    final acl = f['avg_cycle_length'] as num?, apl = f['avg_period_length'] as num?;
    if (acl != null && acl != 0 && acl >= 15) subs.add(_tf(c, 'recap_cycles_avg', {'days': _unit(c.lang, jsRoundInt(acl), 'day')}));
    if (apl != null && apl != 0 && apl >= 1) subs.add(_tf(c, 'recap_period_avg', {'days': _unit(c.lang, jsRoundInt(apl), 'day')}));
    out.add(_draft(
        _stat(c, 'flow_cycles', _look('cycles'), 'ring', c.t('recap_cycles_eyebrow'), _n0(_n(f['cycles'])), c.t('recap_cycles_line'),
            subs: subs, param: apl ?? 5, param2: acl ?? 28),
        88,
        10));
  }
  final logged = math.max(_n(f['days_logged']), _n(f['period_days_logged']));
  if (logged > 0) {
    out.add(_draft(
        _stat(c, 'flow_days', _look('flowdays'), 'calendar', c.t('recap_flowdays_eyebrow'), _n0(logged), c.t('recap_flowdays_line'),
            badge: _showPct(f['logging_top_pct']) ? _tf(c, 'recap_top_pct', {'pct': _pct(c.lang, f['logging_top_pct']! as num)}) : null,
            param: math.min(1, logged / 365)),
        86,
        20));
  }
  final moodAvg = f['mood_avg'] as num?;
  if (moodAvg != null && moodAvg >= 1) {
    final mood = math.max(1, math.min(5, moodAvg));
    final word = mood < 2.5
        ? c.t('recap_mood_1')
        : mood < 3.5
            ? c.t('recap_mood_2')
            : mood < 4.3
                ? c.t('recap_mood_3')
                : c.t('recap_mood_4');
    final topSymptom = f['top_symptom'] as String?;
    final symptom = topSymptom != null && topSymptom.isNotEmpty ? _clean(c.labels.symptom?.call(topSymptom)) : null;
    final cycles = _look('cycles');
    out.add(_draft(
        _stat(c, 'flow_mood', {...cycles, 'bg': ['#1E0A1E', '#4A1A3E', moodColor(mood)], 'accent': moodColor(mood)}, 'orb', c.t('recap_mood_eyebrow'),
            {'n': mood, 'decimals': 1, 'text': word, 'label': ''}, c.t('recap_mood_line'),
            subs: symptom != null ? [_tf(c, 'recap_mood_symptom', {'symptom': symptom})] : <String>[], param: mood),
        70,
        30));
  }
  if (_n(f['water_glasses']) >= 5) {
    out.add(_draft(_stat(c, 'flow_water', _look('water'), 'glasses', c.t('recap_water_eyebrow'), _n0(_n(f['water_glasses'])), c.t('recap_water_line')), 50, 40));
  }
  return out;
}

List<Json> _anacanScenes(_Ctx c) {
  final d = c.d;
  final out = <Json>[];
  final tools = <String>[];
  for (final tool in (d['top_tools'] as List? ?? const [])) {
    final l = _clean(c.labels.tool?.call((tool as Map)['id'] as String));
    if (l != null) tools.add(l);
  }
  final topTools = tools.take(3).toList();
  final h = d['favorite_hour'] as num?;
  if (h != null) {
    final band = h >= 22 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : 'evening';
    final lk = band == 'night' ? 'hourNight' : band == 'morning' ? 'hourMorning' : band == 'day' ? 'hourDay' : 'hourEvening';
    final line = c.t(band == 'night'
        ? 'recap_hour_night'
        : band == 'morning'
            ? 'recap_hour_morning'
            : band == 'day'
                ? 'recap_hour_day'
                : 'recap_hour_evening');
    out.add(_draft(
        _stat(c, 'anacan_hour', _look(lk), 'clock', c.t('recap_hour_eyebrow'), {'n': h, 'decimals': 0, 'text': formatHour(h), 'label': ''}, line,
            chips: topTools, subs: topTools.isNotEmpty ? [c.t('recap_tools_title')] : <String>[], param: h),
        58,
        60));
  }
  final ai = _n(d['ai_questions']);
  if (ai > 0) {
    out.add(_draft(_stat(c, 'anacan_ai', _look('ai'), 'sparkle', c.t('recap_ai_eyebrow'), _n0(ai), c.t('recap_ai_line')), ai >= 10 ? 57 : 45, 70));
  }
  final likes = _n(d['likes']), comments = _n(d['comments']), posts = _n(d['posts']), postsRead = _n(d['posts_read']);
  final social = likes + comments + posts;
  if (postsRead > 0 || social > 0) {
    final chips = <String>[
      if (postsRead > 0 && likes > 0) _tf(c, 'recap_comm_likes', {'n': formatRecapNumber(c.lang, likes)}),
      if (comments > 0) _tf(c, 'recap_comm_comments', {'n': formatRecapNumber(c.lang, comments)}),
      if (posts > 0) _tf(c, 'recap_comm_posts', {'n': formatRecapNumber(c.lang, posts)}),
    ];
    final reads = postsRead > 0;
    out.add(_draft(
        _stat(c, 'anacan_community', _look('community'), 'hearts', c.t(reads ? 'recap_reads_eyebrow' : 'recap_likes_eyebrow'),
            _n0(reads ? postsRead : (likes != 0 ? likes : social)), c.t('recap_comm_line'),
            chips: chips),
        postsRead >= 20 || social >= 10 ? 52 : 42,
        80));
  }
  final games = _n(d['game_plays']), achievements = _n(d['achievements']);
  if (games > 0 || achievements > 0) {
    out.add(_draft(
        _stat(c, 'anacan_games', _look('games'), 'stars', c.t('recap_games_eyebrow'), _n0(games != 0 ? games : achievements), c.t('recap_games_line'),
            chips: games > 0 && achievements > 0 ? [_tf(c, 'recap_achievements', {'n': formatRecapNumber(c.lang, achievements)})] : <String>[]),
        20,
        90));
  }
  return out;
}

/// Journey only for forward transitions (flow→bump→mommy).
Json? _journeyScene(_Ctx c) {
  const order = ['flow', 'bump', 'mommy'];
  final s = (c.d['stages'] as List).cast<String>();
  if (s.length < 2 || !s.contains('bump') || s.last != c.d['stage']) return null;
  for (var i = 1; i < s.length; i++) {
    if (order.indexOf(s[i]) <= order.indexOf(s[i - 1])) return null;
  }
  final line = s.length == 3
      ? c.t('recap_journey_full')
      : s.contains('mommy')
          ? c.t('recap_journey_bump_mommy')
          : c.t('recap_journey_flow_bump');
  return {
    'kind': 'journey',
    'id': 'journey',
    'look': _look('journey'),
    'seed': _hash('journey'),
    'eyebrow': c.t('recap_journey_eyebrow'),
    'stages': [for (final x in s) c.t(x == 'flow' ? 'recap_stage_flow' : x == 'bump' ? 'recap_stage_bump' : 'recap_stage_mommy')],
    'line': line,
    'priority': 101,
    'order': 2,
  };
}

String pickPersona(Json d) => pickPersonaDef(d)['id']! as String;

// ── Timing ─────────────────────────────────────────────────────────────────────────────────────
class Slot {
  const Slot({required this.min, required this.max, required this.w});
  final double min;
  final double max;
  final double w;
}

/// Distributes [span] over the slots within their min/max.
List<double> fitDurations(double span, List<Slot> slots) {
  final out = List<double>.filled(slots.length, 0);
  final fixed = List<bool>.filled(slots.length, false);
  for (var pass = 0; pass < slots.length + 1; pass++) {
    var used = 0.0, freeW = 0.0;
    for (var i = 0; i < slots.length; i++) {
      if (fixed[i]) {
        used += out[i];
      } else {
        freeW += slots[i].w;
      }
    }
    if (freeW <= 0) break;
    var changed = false;
    for (var i = 0; i < slots.length; i++) {
      if (fixed[i]) continue;
      final d = (span - used) * slots[i].w / freeW;
      if (d > slots[i].max) {
        out[i] = slots[i].max;
        fixed[i] = true;
        changed = true;
      } else if (d < slots[i].min) {
        out[i] = slots[i].min;
        fixed[i] = true;
        changed = true;
      } else {
        out[i] = d;
      }
    }
    if (!changed) break;
  }
  return out;
}

List<List<double>> _place(double start, List<double> durations, double grid) {
  final end = start + durations.fold<double>(0, (s, v) => s + v);
  final cuts = <double>[start];
  var acc = start;
  for (var i = 0; i < durations.length; i++) {
    acc += durations[i];
    cuts.add(i == durations.length - 1 ? end : jsRound(acc / grid) * grid);
  }
  return [for (var i = 0; i < durations.length; i++) [cuts[i], cuts[i + 1]]];
}

const int _stageMax = 4;
const double _flexMaxDuration = 7.5;

class _Plan {
  const _Plan(this.k, this.chosen, this.mins);
  final int k;
  final List<Json> chosen;
  final List<double> mins;
}

num _prio(Json d) => _n(d['priority']);

_Plan _planFlex(List<Json> stageDrafts, List<Json> others, double coldMin, RecapMusic music, bool cjk) {
  num byPriority(Json a, Json z) => _prio(z) - _prio(a);
  final ranked = [...jsSorted(stageDrafts, byPriority).take(_stageMax), ...jsSorted(others, byPriority)];
  final intro = music.drop, mid = music.breath - music.drop;
  for (var n = math.min(ranked.length, 9); n >= 0; n--) {
    final chosen = jsSorted(ranked.take(n), (Json a, Json z) => _n(a['order']) - _n(z['order']));
    final mins = [for (final d in chosen) math.max(3.5, minSceneDuration(d, cjk))];
    _Plan? best;
    var bestSlack = double.negativeInfinity;
    for (var k = 0; k <= n; k++) {
      final a = coldMin + mins.take(k).fold<double>(0, (x, v) => x + v), b = mins.skip(k).fold<double>(0, (x, v) => x + v);
      if (a > intro + 1e-6 || b > mid + 1e-6) continue;
      final cap1 = 7 + k * _flexMaxDuration, cap2 = (n - k) * _flexMaxDuration;
      final gap = math.max(0, intro - cap1) + math.max(0, mid - cap2);
      final slack = math.min((intro - a) / (k + 1), n - k != 0 ? (mid - b) / (n - k) : 99) - gap * 10;
      if (slack > bestSlack) {
        bestSlack = slack.toDouble();
        best = _Plan(k, chosen, mins);
      }
    }
    if (best != null) return best;
  }
  return const _Plan(0, [], []);
}

Json _withoutDraftKeys(Json d) => {
      for (final e in d.entries)
        if (e.key != 'priority' && e.key != 'order') e.key: e.value,
    };

// ── Build ──────────────────────────────────────────────────────────────────────────────────────
Json buildRecapModel(Json data, String language, RecapTranslate t, {RecapLabels labels = const RecapLabels(), RecapMusic? music, String? seed}) {
  final lang = normalizeAppLanguage(language);
  final locale = appLanguageLocale(lang);
  final mus = music ?? recapMusic2026Value;
  final stage = data['stage'] as String?;
  final child = _clean(_o(data['mommy'])?['child_name'] as String?);
  final c = _Ctx(data, lang, t, labels, child);
  final year = data['year']! as num;
  final cjk = _cjk.contains(lang);
  final stages = (data['stages'] as List).cast<String>();

  final journey = _journeyScene(c);
  var stageDrafts = stage == 'mommy'
      ? _mommyScenes(c)
      : stage == 'bump'
          ? _bumpScenes(c)
          : stage == 'flow'
              ? _flowScenes(c)
              : <Json>[];
  if (journey != null && stage == 'mommy' && stages.contains('bump')) {
    final kicks = _bumpScenes(c).where((s) => s['id'] == 'bump_kicks');
    if (kicks.isNotEmpty) stageDrafts = [...stageDrafts, {...kicks.first, 'priority': 50, 'order': 5}];
  }
  final daysActive = _n(data['days_active']), streak = _n(data['longest_streak']);
  final days = daysActive > 0
      ? _draft(
          _stat(c, 'days', _look('days'), 'calendar', c.t('recap_days_eyebrow'), _n0(daysActive), c.t('recap_days_line'),
              subs: streak >= 2 ? [_tf(c, 'recap_days_streak', {'days': _unit(lang, streak, 'day')})] : <String>[],
              param: math.min(1, daysActive / 365)),
          100,
          1)
      : null;
  final name = data['name'] as String?;
  final cold = <String, Object?>{
    'kind': 'cold',
    'id': 'cold',
    'look': _look('cold'),
    'seed': _hash('cold'),
    'year': year,
    'title': name != null && name.isNotEmpty ? _tf(c, 'recap_cold_title_name', {'name': name}) : c.t('recap_cold_title'),
  };
  final coldMin = math.max(4.5, minSceneDuration(cold, cjk));
  final others = [?journey, ?days, ..._anacanScenes(c)];
  final plan = _planFlex(stageDrafts, others, coldMin, mus, cjk);
  final chosen = plan.chosen;

  final peakStats = _pickStats(c, 3);
  final personaDef = pickPersonaDef(data);
  final persona = personaDef['id']! as String;
  final why = pickWhyLine(personaDef, seed ?? '${name ?? ''}|${data['member_since'] ?? ''}|${jsNumberToString(daysActive)}', year);
  final closeKey = stage == 'mommy'
      ? 'recap_peak_close_mommy'
      : stage == 'bump'
          ? 'recap_peak_close_bump'
          : stage == 'flow'
              ? 'recap_peak_close_flow'
              : 'recap_peak_close';

  final k = plan.k;
  final g1 = fitDurations(mus.drop, [
    Slot(min: coldMin, max: 7, w: 1),
    for (var i = 0; i < k; i++) Slot(min: plan.mins[i], max: _flexMaxDuration, w: 1),
  ]);
  final g2 = fitDurations(mus.breath - mus.drop, [for (var i = k; i < chosen.length; i++) Slot(min: plan.mins[i], max: _flexMaxDuration, w: 1)]);
  final p1 = _place(0, g1, mus.beat);
  final g1End = p1.last[1];
  final p2 = g2.isNotEmpty ? _place(g1End, g2, mus.beat) : <List<double>>[];
  final flexEnd = p2.isNotEmpty ? p2.last[1] : g1End;
  final shift = flexEnd - mus.breath;
  final peakStart = mus.breath + shift;
  final personaStart = mus.lift + 4 + shift;
  final summaryStart = personaStart + 5;
  final outroStart = mus.tail + shift;
  final end = mus.end + shift;

  final scenes = <Json>[
    {...cold, 'start': p1[0][0], 'end': p1[0][1]},
  ];
  for (var i = 0; i < chosen.length; i++) {
    final se = i < k ? p1[i + 1] : p2[i - k];
    scenes.add({..._withoutDraftKeys(chosen[i]), 'start': se[0], 'end': se[1]});
  }
  scenes.add({
    'kind': 'peak',
    'id': 'peak',
    'look': _look('peak'),
    'seed': _hash('peak'),
    'start': peakStart,
    'end': personaStart,
    'lead': stage == 'mommy' && child != null ? _tf(c, 'recap_peak_lead_child', {'child': child}) : c.t('recap_peak_lead'),
    'stats': peakStats,
    'close': c.t(closeKey),
    'burst': mus.lift - mus.breath,
  });
  scenes.add({
    'kind': 'persona',
    'id': 'persona',
    'look': _look('persona'),
    'seed': _hash('persona'),
    'start': personaStart,
    'end': summaryStart,
    'persona': persona,
    'eyebrow': _tf(c, 'recap_persona_eyebrow', {'year': year}),
    'title': c.t('recap_persona_$persona'),
    'reason': c.t('recap_persona_${persona}_why_$why'),
  });
  scenes.add({
    'kind': 'summary',
    'id': 'summary',
    'look': _look('summary'),
    'seed': _hash('summary'),
    'start': summaryStart,
    'end': outroStart,
    'name': name,
    'year': year,
    'kicker': c.t('recap_summary_kicker'),
    'stats': _pickStats(c, 4),
    'persona': c.t('recap_persona_$persona'),
    'site': 'anacan.az',
  });
  scenes.add({
    'kind': 'outro',
    'id': 'outro',
    'look': _look('outro'),
    'seed': _hash('outro'),
    'start': outroStart,
    'end': end,
    'tagline': c.t('recap_outro_tagline'),
    'site': 'anacan.az',
    'stores': c.t('recap_outro_stores'),
  });

  final hits = <double>[];
  for (final h in [g1End, mus.lift + shift]) {
    if (h > 1 && !hits.contains(h)) hits.add(h);
  }
  return {
    'version': 1,
    'year': year,
    'language': lang,
    'locale': locale,
    'rtl': lang == 'ar',
    'cjk': cjk,
    'stage': stage,
    'persona': persona,
    'scenes': scenes,
    'duration': end,
    'beat': mus.beat,
    'fadeStart': outroStart,
    'hits': hits,
  };
}

/// Music length a full story would need (for briefing a longer track).
({List<String> flexScenes, double introAndBuild, double afterBreath}) recapMusicNeeds(Json data, String language, RecapTranslate t,
    {RecapLabels labels = const RecapLabels(), String? seed}) {
  final m = buildRecapModel(data, language, t,
      labels: labels, seed: seed, music: const RecapMusic(length: 999, drop: 400, breath: 800, lift: 802, tail: 818, end: 822.2, beat: 0.5));
  final scenes = (m['scenes']! as List).cast<Json>();
  const fixedKinds = {'cold', 'peak', 'persona', 'summary', 'outro'};
  final flex = scenes.where((s) => !fixedKinds.contains(s['kind'])).toList();
  final cjk = m['cjk']! as bool;
  final flexMin = flex.fold<double>(0, (x, s) => x + math.max(3.5, minSceneDuration(s, cjk))) + math.max(4.5, minSceneDuration(scenes[0], cjk));
  return (flexScenes: [for (final s in flex) s['id']! as String], introAndBuild: (flexMin * 2).ceil() / 2, afterBreath: 2 + 4 + 5 + 7 + 4.2);
}

/// The strongest numbers of the year, stage first, never zero.
List<Json> _pickStats(_Ctx c, int count) {
  final d = c.d, m = _o(d['mommy']), b = _o(d['bump']), f = _o(d['flow']);
  final out = <({Json stat, num p})>[];
  void add(num? n, String key, num p) {
    if (n != null && n != 0 && n > 0) out.add((stat: {'n': jsRoundInt(n), 'decimals': 0, 'label': c.t(key)}, p: p));
  }

  if (d['stage'] == 'mommy' && m != null) {
    add(_n(m['sleep_hours']), 'recap_label_sleep', 92);
    add(_n(m['milestones']), 'recap_label_milestones', 90);
    add(_n(m['feedings']), 'recap_label_feedings', 88);
    add(_n(m['diapers']), 'recap_label_diapers', 60);
  }
  if (d['stage'] == 'bump' && b != null) {
    add(_n(b['week_end']) > _n(b['week_start']) ? _n(b['week_end']) - _n(b['week_start']) : 0, 'recap_label_weeks', 92);
    add(_n(b['kicks']), 'recap_label_kicks', 90);
    add(_n(b['bag_items_ready']), 'recap_label_bag', 62);
    add(_n(b['favorite_names']), 'recap_label_names', 58);
  }
  if (d['stage'] == 'flow' && f != null) {
    add(math.max(_n(f['days_logged']), _n(f['period_days_logged'])), 'recap_label_flowdays', 92);
    add(_n(f['cycles']), 'recap_label_cycles', 90);
    add(_n(f['water_glasses']) >= 5 ? _n(f['water_glasses']) : 0, 'recap_label_water', 60);
  }
  add(_n(d['days_active']), 'recap_label_days', 80);
  add(_n(d['ai_questions']), 'recap_label_ai', 55 + math.min(20, _n(d['ai_questions']) / 5));
  add(_n(d['posts_read']), 'recap_label_reads', 50 + math.min(15, _n(d['posts_read']) / 20));
  add(_n(d['longest_streak']) >= 3 ? _n(d['longest_streak']) : 0, 'recap_label_streak', 40);
  add(_n(d['likes']), 'recap_label_likes', 35);
  add(_n(d['game_plays']), 'recap_label_games', 20);
  return [for (final s in jsSorted(out, (a, z) => z.p - a.p).take(count)) s.stat];
}
