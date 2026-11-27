// Ported from: src/lib/stories.ts (themes, azOrdinal, storyVars, storyVarsUsed, fillStory, storyMatches,
//              parseStoryText, storiesEnabledFor), src/lib/server-stories.ts (sanitizeSlide, sanitizeStory,
//              parseServerStories, mergeStories, device cache), src/data/stories/az.ts (via the generated JSON)
//
// Stories stay StoryJson maps (`{id, module, title, theme, illus, audience?, schedule?, source?, slides[]}`), the
// same shape the server rows and the bundled data use.
import 'dart:convert';
import 'dart:ui' show Color;

import '../../domain/js_compat.dart' show jsRound;
import '../../state/local_store.dart';
import 'data/stories_az.g.dart';

typedef Story = Map<String, dynamic>;
typedef StorySlide = Map<String, dynamic>;

class StoryTheme {
  const StoryTheme({required this.bg, required this.ink, required this.pop, required this.popInk, required this.chip, required this.ink2, required this.bg2, this.light = false});
  final Color bg, ink, pop, popInk, chip, ink2, bg2;
  final bool light;
}

/// `STORY_THEMES` (literal colours of src/lib/stories.ts).
const Map<String, StoryTheme> storyThemes = {
  'coral': StoryTheme(bg: Color(0xFFFF5A5F), ink: Color(0xFFFFFFFF), pop: Color(0xFFFFE66B), popInk: Color(0xFF3B1A10), chip: Color(0x29FFFFFF), ink2: Color(0xFFFFFFFF), bg2: Color(0xFFFF5A5F)),
  'lime': StoryTheme(bg: Color(0xFF1F9D55), ink: Color(0xFFFFFFFF), pop: Color(0xFFC8F560), popInk: Color(0xFF123526), chip: Color(0x24FFFFFF), ink2: Color(0xFFC8F560), bg2: Color(0xFF123526)),
  'violet': StoryTheme(bg: Color(0xFF5B4BDB), ink: Color(0xFFFFFFFF), pop: Color(0xFFFFD84D), popInk: Color(0xFF2A2060), chip: Color(0x24FFFFFF), ink2: Color(0xFFFFFFFF), bg2: Color(0xFF5B4BDB)),
  'peach': StoryTheme(bg: Color(0xFFFFB199), ink: Color(0xFF2B1B17), pop: Color(0xFFFF5A5F), popInk: Color(0xFFFFFFFF), chip: Color(0x142B1B17), ink2: Color(0xFF2B1B17), bg2: Color(0xFFFFB199), light: true),
  'cream': StoryTheme(bg: Color(0xFFFFF6EC), ink: Color(0xFF22181A), pop: Color(0xFFFF5A5F), popInk: Color(0xFFFFFFFF), chip: Color(0x0F22181A), ink2: Color(0xFF22181A), bg2: Color(0xFFFFF6EC), light: true),
  'navy': StoryTheme(bg: Color(0xFF2E2A7A), ink: Color(0xFFFFFFFF), pop: Color(0xFF7FE0FF), popInk: Color(0xFF16133F), chip: Color(0x1FFFFFFF), ink2: Color(0xFF7FE0FF), bg2: Color(0xFF16133F)),
  'lilac': StoryTheme(bg: Color(0xFFCDB8FF), ink: Color(0xFF1E1838), pop: Color(0xFFFF6B3D), popInk: Color(0xFFFFFFFF), chip: Color(0x141E1838), ink2: Color(0xFF1E1838), bg2: Color(0xFFCDB8FF), light: true),
  'yellow': StoryTheme(bg: Color(0xFFFFD84D), ink: Color(0xFF2B1B17), pop: Color(0xFF5B4BDB), popInk: Color(0xFFFFFFFF), chip: Color(0x142B1B17), ink2: Color(0xFF2B1B17), bg2: Color(0xFFFFD84D), light: true),
  'mint': StoryTheme(bg: Color(0xFFBFF0D4), ink: Color(0xFF123526), pop: Color(0xFFFF5A5F), popInk: Color(0xFFFFFFFF), chip: Color(0x14123526), ink2: Color(0xFF123526), bg2: Color(0xFFBFF0D4), light: true),
  'forest': StoryTheme(bg: Color(0xFF0F4D32), ink: Color(0xFFEFFFF5), pop: Color(0xFFC8F560), popInk: Color(0xFF0F4D32), chip: Color(0x1AEFFFF5), ink2: Color(0xFFC8F560), bg2: Color(0xFF0F4D32)),
};

StoryTheme storyThemeOf(Story s) => storyThemes[s['theme']] ?? storyThemes['coral']!;

const Map<String, String> storyModuleLabel = {'bump': 'Hamiləlik', 'mommy': 'Analıq', 'flow': 'Dövr', 'all': 'Hamı üçün'};

/// Bundled data (`STORIES_AZ`, `WEEKS`, `MONTHS`, `PHASES`).
class StoryTables {
  StoryTables._(this.stories, this.weeks, this.months, this.phases);
  final List<Story> stories;
  final List<List<Object?>> weeks, months, phases;

  static StoryTables? _az;
  static StoryTables get az {
    final cached = _az;
    if (cached != null) return cached;
    final m = jsonDecode(storiesAzJson) as Map<String, dynamic>;
    List<List<Object?>> rows(String k) => [for (final r in m[k] as List) List<Object?>.from(r as List)];
    return _az = StoryTables._([for (final s in m['stories'] as List) Map<String, dynamic>.from(s as Map)], rows('weeks'), rows('months'), rows('phases'));
  }
}

/// Azerbaijani ordinal suffix: by the last non-zero digit, or by the tens when the number ends in 0.
String azOrdinal(int n) {
  final d = n % 10;
  final t = (n ~/ 10) % 10;
  if (d != 0) return const {1: '-ci', 2: '-ci', 5: '-ci', 7: '-ci', 8: '-ci', 3: '-cü', 4: '-cü', 6: '-cı', 9: '-cu'}[d]!;
  if (n % 100 == 0) return '-cü';
  return const {1: '-cu', 2: '-ci', 3: '-cu', 4: '-cı', 5: '-ci', 6: '-cı', 7: '-ci', 8: '-ci', 9: '-cı'}[t]!;
}

class StoryContext {
  const StoryContext({required this.stage, this.week, this.fruit, this.babyMonths, this.babyName, this.cycleDay, this.isPremium = false});
  final String stage;
  final int? week;
  final ({String name, num lengthCm, num weightG})? fruit;
  final int? babyMonths;
  final String? babyName;
  final int? cycleDay;
  final bool isPremium;

  @override
  bool operator ==(Object other) =>
      other is StoryContext && other.stage == stage && other.week == week && other.fruit == fruit &&
      other.babyMonths == babyMonths && other.babyName == babyName && other.cycleDay == cycleDay && other.isPremium == isPremium;

  @override
  int get hashCode => Object.hash(stage, week, fruit, babyMonths, babyName, cycleDay, isPremium);
}

/// `toLocaleLowerCase('az-AZ')` (dotless ı for I, i for İ).
String azLower(String s) => s.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();

/// `n.toLocaleString('az-AZ', { maximumFractionDigits: n < 10 ? 1 : 0 })` (az uses `,` decimals, `.` groups).
String azNum(num n) {
  final digits = n < 10 ? 1 : 0;
  final f = digits == 1 ? jsRound(n * 10) / 10 : jsRound(n);
  final neg = f < 0;
  final abs = f.abs();
  final intPart = abs.truncate();
  final frac = digits == 1 ? ((abs - intPart) * 10).round() : 0;
  final s = intPart.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  return '${neg ? '-' : ''}$s${frac != 0 ? ',$frac' : ''}';
}

/// `storyVars(ctx, tables)`.
Map<String, String> storyVars(StoryContext ctx, StoryTables tables) {
  final out = <String, String>{};
  final week = ctx.week;
  if (week != null && week != 0) {
    final w = tables.weeks.reversed.firstWhere((x) => week >= (x[0] as num), orElse: () => tables.weeks.first);
    final f = ctx.fruit;
    num nz(num? v, Object? fb) => (v == null || v == 0) ? fb as num : v;
    out.addAll({
      'week': '$week',
      'weekLabel': '$week${azOrdinal(week)} həftə',
      'fruit': azLower((f?.name.isNotEmpty ?? false) ? f!.name : w[1] as String),
      'lengthCm': azNum(nz(f?.lengthCm, w[2])),
      'weightG': azNum(nz(f?.weightG, w[3])),
      'weekNote': w[4] as String,
    });
  }
  final months = ctx.babyMonths;
  if (months != null) {
    final m = tables.months.reversed.firstWhere((x) => months >= (x[0] as num), orElse: () => tables.months.first);
    final name = ctx.babyName?.trim();
    out.addAll({
      'babyMonths': '$months',
      'milestone': m[1] as String,
      'milestoneShort': m[2] as String,
      'babyName': name == null || name.isEmpty ? 'Körpən' : name,
    });
  }
  final day = ctx.cycleDay;
  if (day != null && day != 0) {
    final p = tables.phases.firstWhere((x) => day >= (x[0] as num) && day <= (x[1] as num), orElse: () => tables.phases.last);
    out.addAll({'cycleDay': '$day', 'cycleLabel': '$day${azOrdinal(day)} gün', 'phase': p[2] as String, 'phaseTip': p[3] as String});
  }
  return out;
}

final RegExp _varRe = RegExp(r'\{(\w+)\}');

/// `storyVarsUsed(story)` (title + slides).
List<String> storyVarsUsed(Story story) {
  final found = <String>{};
  void scan(Object? v) {
    if (v is String) {
      for (final m in _varRe.allMatches(v)) {
        found.add(m.group(1)!);
      }
    } else if (v is List) {
      v.forEach(scan);
    } else if (v is Map) {
      v.values.forEach(scan);
    }
  }

  scan(story['title']);
  scan(story['slides']);
  return found.toList();
}

/// `fillStory(text, vars)`.
String fillStory(String? text, Map<String, String> vars) => (text ?? '').replaceAllMapped(_varRe, (m) => vars[m.group(1)] ?? '');

const Set<String> _luteal = {'luteal', 'lüteal faza'};

/// Which stories this user should see right now.
bool storyMatches(Story story, StoryContext ctx, Map<String, String> vars) {
  final a = (story['audience'] as Map?) ?? const {};
  final st = a['stage'];
  final List<Object?>? stages = st is List ? st : (st is String ? [st] : null);
  if (story['module'] == 'all') {
    if (stages != null && !stages.contains(ctx.stage)) return false;
  } else if (story['module'] != ctx.stage) {
    return false;
  }
  if (a['premium'] == false && ctx.isPremium) return false;
  final goal = a['goal'];
  if (goal is String && goal.isNotEmpty) return false;
  num? n(Object? v) => v is num && v != 0 ? v : null;
  final week = ctx.week;
  if (ctx.stage == 'bump' && week != null && week != 0) {
    final from = n(a['weekFrom']), to = n(a['weekTo']);
    if ((from != null && week < from) || (to != null && week > to)) return false;
  }
  final months = ctx.babyMonths;
  if (ctx.stage == 'mommy' && months != null) {
    final from = n(a['monthsFrom']), to = n(a['monthsTo']);
    if ((from != null && months < from) || (to != null && months > to)) return false;
  }
  final phase = (story['schedule'] as Map?)?['phase'];
  final vp = vars['phase'];
  if (ctx.stage == 'flow' && phase is String && phase.isNotEmpty && vp != null && vp.isNotEmpty &&
      !(phase == vp || (_luteal.contains(phase) && _luteal.contains(vp)))) {
    return false;
  }
  if (ctx.stage == 'flow' && phase is String && phase.isNotEmpty && (vp == null || vp.isEmpty)) return false;
  return storyVarsUsed(story).every((k) => vars[k] != null);
}

enum StoryTextKind { plain, mark, hl, bold }

typedef StoryTextPart = ({String text, StoryTextKind kind});

/// Splits `==mark==`, `__accent__` and `**bold**` markers (no HTML is ever injected).
List<StoryTextPart> parseStoryText(String text) {
  final parts = <StoryTextPart>[];
  final re = RegExp(r'==(.+?)==|__(.+?)__|\*\*(.+?)\*\*');
  var last = 0;
  for (final m in re.allMatches(text)) {
    if (m.start > last) parts.add((text: text.substring(last, m.start), kind: StoryTextKind.plain));
    parts.add(m.group(1) != null
        ? (text: m.group(1)!, kind: StoryTextKind.mark)
        : m.group(2) != null
            ? (text: m.group(2)!, kind: StoryTextKind.hl)
            : (text: m.group(3)!, kind: StoryTextKind.bold));
    last = m.end;
  }
  if (last < text.length) parts.add((text: text.substring(last), kind: StoryTextKind.plain));
  return parts;
}

/// `app_settings.dashboard_stories` = off / admin / on; partners never, Azerbaijani only.
bool storiesEnabledFor(Object? setting, {required bool isAdmin, required String? language, String? role}) {
  if (role == 'partner') return false;
  if (language != 'az') return false;
  if (setting == 'on') return true;
  return setting == 'admin' && isAdmin;
}

// ── server stories ──

const List<String> _templates = ['cover', 'fact', 'list', 'myth', 'quiz', 'alert', 'quote', 'cta'];
const List<String> _modules = ['bump', 'mommy', 'flow', 'all'];
const List<String> _stages = ['bump', 'mommy', 'flow'];
final RegExp _idRe = RegExp(r'^[a-z0-9][a-z0-9-]{1,63}$');
final RegExp _navRe = RegExp(r'^[a-z0-9][a-z0-9_-]{0,63}$', caseSensitive: false);
const int _maxSlides = 20;

/// JS `String.prototype.slice(0, max)` counts UTF-16 code units, like Dart.
String? _str(Object? v, [int max = 600]) => v is String && v.trim().isNotEmpty ? (v.length > max ? v.substring(0, max) : v) : null;

int? _num(Object? v, int min, int max) => v is num && v.isFinite && v >= min && v <= max ? jsRound(v).toInt() : null;

List<String>? _strList(Object? v, int maxItems, [int max = 200]) {
  if (v is! List) return null;
  final out = [for (final x in v) ?_str(x, max)].take(maxItems).toList();
  return out.isEmpty ? null : out;
}

Map<String, dynamic> _prune(Map<String, dynamic> o) => o..removeWhere((_, v) => v == null);

/// One slide, or null when it cannot be shown.
StorySlide? sanitizeSlide(Object? raw) {
  if (raw is! Map || !_templates.contains(raw['t'])) return null;
  final t = raw['t'] as String;
  final size = raw['size'];
  final slide = _prune({
    't': t,
    'kicker': _str(raw['kicker'], 80),
    'title': _str(raw['title'], 220),
    'body': _str(raw['body'], 700),
    'size': size == 'm' || size == 'l' || size == 'xl' ? size : null,
    'illus': _str(raw['illus'], 24),
    'mascot': _stages.contains(raw['mascot']) ? raw['mascot'] : null,
    'value': _str(raw['value'], 24),
    'unit': _str(raw['unit'], 24),
    'items': _strList(raw['items'], 8),
    'myth': _str(raw['myth'], 300),
    'fact': _str(raw['fact'], 500),
    'options': _strList(raw['options'], 4, 120),
    'correct': _num(raw['correct'], 0, 3),
    'explain': _str(raw['explain'], 500),
    'quote': _str(raw['quote'], 400),
    'badge': _str(raw['badge'], 40),
    'src': _str(raw['src'], 160),
  });
  final cta = raw['cta'];
  if (cta is Map && cta['nav'] is Map) {
    final n = cta['nav'] as Map;
    String? nav(Object? v) => v is String && _navRe.hasMatch(v) ? v : null;
    final navMap = _prune({'tool': nav(n['tool']), 'tab': nav(n['tab']), 'screen': nav(n['screen'])});
    final label = _str(cta['label'], 40);
    if (label != null && navMap.isNotEmpty) slide['cta'] = _prune({'label': label, 'nav': navMap, 'premium': cta['premium'] == true ? true : null});
  }
  final options = slide['options'] as List?;
  final correct = slide['correct'] as int?;
  if (t == 'quiz' && (options == null || options.length < 2 || correct == null || correct >= options.length)) return null;
  if (t == 'cta' && slide['cta'] == null) return null;
  if (t == 'list' && slide['items'] == null) return null;
  if (t == 'myth' && !(slide['myth'] != null && slide['fact'] != null)) return null;
  if (t == 'quote' && slide['quote'] == null) return null;
  if (slide['title'] == null && slide['body'] == null && slide['items'] == null && slide['value'] == null &&
      slide['quote'] == null && slide['myth'] == null && slide['options'] == null) {
    return null;
  }
  return slide;
}

/// A whole story from the server, or null. The id comes from the row.
Story? sanitizeStory(String id, Object? raw) {
  if (!_idRe.hasMatch(id) || raw is! Map) return null;
  final module = _modules.contains(raw['module']) ? raw['module'] as String : null;
  final title = _str(raw['title'], 40);
  final rawSlides = raw['slides'];
  final slides = rawSlides is List ? [for (final s in rawSlides.take(_maxSlides)) ?sanitizeSlide(s)] : <StorySlide>[];
  if (module == null || title == null || slides.isEmpty) return null;
  final theme = raw['theme'];
  final story = <String, dynamic>{
    'id': id,
    'module': module,
    'title': title,
    'slides': slides,
    'theme': theme is String && storyThemes.containsKey(theme) ? theme : 'coral',
    'illus': _str(raw['illus'], 24) ?? 'blob',
  };
  final src = _str(raw['source'], 160);
  if (src != null) story['source'] = src;
  final a = raw['audience'];
  if (a is Map) {
    final s = a['stage'];
    Object? stage;
    if (s is List) {
      final l = s.where((x) => _stages.contains(x)).toList();
      stage = l.isEmpty ? null : l;
    } else if (_stages.contains(s)) {
      stage = s;
    }
    final audience = _prune({
      'stage': stage,
      'weekFrom': _num(a['weekFrom'], 1, 42),
      'weekTo': _num(a['weekTo'], 1, 42),
      'monthsFrom': _num(a['monthsFrom'], 0, 120),
      'monthsTo': _num(a['monthsTo'], 0, 120),
      'premium': a['premium'] == false ? false : null,
      'goal': _str(a['goal'], 24),
    });
    if (audience.isNotEmpty) story['audience'] = audience;
  }
  final sch = raw['schedule'];
  if (sch is Map && sch['phase'] is String) {
    final p = sch['phase'] as String;
    story['schedule'] = {'phase': p.length > 40 ? p.substring(0, 40) : p};
  }
  return story;
}

class ServerStories {
  const ServerStories(this.show, this.hide);
  final List<Story> show;
  final Set<String> hide;
}

/// Validates the RPC result; bad rows are skipped, never fatal.
ServerStories parseServerStories(Object? rows) {
  final show = <(Story, num)>[];
  final hide = <String>{};
  if (rows is! List) return ServerStories(const [], hide);
  for (final r in rows.take(200)) {
    if (r is! Map || r['id'] is! String || !_idRe.hasMatch(r['id'] as String)) continue;
    final id = r['id'] as String;
    if (r['action'] == 'hide') {
      hide.add(id);
      continue;
    }
    final story = sanitizeStory(id, r['story']);
    if (story != null && !show.any((x) => x.$1['id'] == id)) show.add((story, r['sort'] is num ? r['sort'] as num : 0));
  }
  // Array.prototype.sort is stable: keep insertion order for equal sorts.
  final indexed = [for (var i = 0; i < show.length; i++) (show[i], i)]
    ..sort((a, b) {
      final c = b.$1.$2.compareTo(a.$1.$2);
      return c != 0 ? c : a.$2.compareTo(b.$2);
    });
  return ServerStories([for (final x in indexed) x.$1.$1], hide);
}

/// Bundled + server: a server story with a bundled id replaces it in place, hidden ids disappear, new server
/// stories come first.
List<Story> mergeStories(List<Story> bundled, ServerStories? server) {
  if (server == null) return bundled;
  final byId = {for (final s in server.show) s['id']: s};
  final merged = [for (final s in bundled) if (!server.hide.contains(s['id'])) byId[s['id']] ?? s];
  final bundledIds = {for (final s in bundled) s['id']};
  final fresh = server.show.where((s) => !bundledIds.contains(s['id']) && !server.hide.contains(s['id']));
  return [...fresh, ...merged];
}

String storiesCacheKey(String language) => 'anacan-server-stories:v1:$language';

List<Object?>? readStoriesCache(LocalStore store, String language) {
  try {
    final v = store.readJson(storiesCacheKey(language));
    return v is List ? v : null;
  } catch (_) {
    return null;
  }
}

void writeStoriesCache(LocalStore store, String language, List<Object?> rows) {
  try {
    store.setItem(storiesCacheKey(language), jsonEncode(rows));
  } catch (_) {/* storage unavailable */}
}

String seenKey(String uid) => 'anacan-stories-seen:$uid';

Set<String> readSeen(LocalStore store, String uid) {
  try {
    final v = store.readJson(seenKey(uid));
    return v is List ? {for (final x in v) '$x'} : <String>{};
  } catch (_) {
    return <String>{};
  }
}

void writeSeen(LocalStore store, String uid, Set<String> seen) {
  try {
    final list = seen.toList();
    store.setItem(seenKey(uid), jsonEncode(list.length > 400 ? list.sublist(list.length - 400) : list));
  } catch (_) {/* storage unavailable */}
}
