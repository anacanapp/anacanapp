// Ported from: src/data/parenting/types.ts (content model), src/data/parenting/index.ts (lazy registry, merged cache,
//              home content), src/lib/parenting-overrides.ts (CMS overrides merge + offline-safe fetch),
//              src/data/parenting/az/sources.ts (S, via assets/i18n/parenting-sources.json)
//
// Tərbiyə content per language: assets/i18n/parenting.<lang>.json (converted from src/data/parenting/<lang>/ by
// app/test/features/tools/parenting/tool/gen_programme_data.mjs). Editors' published overrides
// (public.parenting_content_overrides) are merged by item id on the JSON, then the typed model is built; overrides
// are cached per language on this device and never block or break the tool.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../domain/js_compat.dart';
import '../../../domain/parenting/data/parenting_data.g.dart' show parentingContentLanguages;
import '../../../domain/parenting/parenting.dart' show MilestoneCheckpoint, MilestoneItem;
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;

typedef Json = Map<String, dynamic>;

List<String> _strings(Object? v) => [for (final x in (v as List? ?? const [])) '$x'];
Map<String, String>? _stringMap(Object? v) => v is Map ? {for (final e in v.entries) '${e.key}': '${e.value}'} : null;
String? _opt(Object? v) => v is String ? v : null;

const List<String> ageBandIds = ['0-1', '1-3', '3-6', '6-12'];

class PSource {
  const PSource({required this.who, this.year, required this.title});
  factory PSource.fromJson(Object? j) {
    final m = j as Map;
    return PSource(who: '${m['who']}', year: _opt(m['year']), title: '${m['title']}');
  }
  final String who;
  final String? year;
  final String title;
}

List<PSource> _sources(Object? v) => [for (final x in (v as List? ?? const [])) if (x is Map) PSource.fromJson(x)];

class BandOverview {
  BandOverview.fromJson(Json j)
      : id = '${j['id']}',
        emoji = '${j['emoji']}',
        title = '${j['title']}',
        lead = '${j['lead']}',
        brain = _strings(j['brain']),
        needs = _strings(j['needs']),
        normal = _strings(j['normal']),
        tryThis = _strings(j['tryThis']),
        specialist = _strings(j['specialist']),
        sources = _sources(j['sources']),
        support = _opt(j['support']);
  final String id, emoji, title, lead;
  final List<String> brain, needs, normal, tryThis, specialist;
  final List<PSource> sources;
  final String? support;
}

class PArea {
  PArea.fromJson(Json j)
      : id = '${j['id']}',
        emoji = '${j['emoji']}',
        title = '${j['title']}';
  final String id, emoji, title;
}

class Article {
  Article.fromJson(Json j)
      : id = '${j['id']}',
        area = '${j['area']}',
        emoji = '${j['emoji']}',
        title = '${j['title']}',
        summary = '${j['summary']}',
        bands = _strings(j['bands']),
        free = j['free'] == true,
        science = _strings(j['science']),
        tryToday = _strings(j['tryToday']),
        mistakes = _strings(j['mistakes']),
        byAge = _stringMap(j['byAge']),
        specialist = _strings(j['specialist']),
        sources = _sources(j['sources']),
        tags = j['tags'] is List ? _strings(j['tags']) : null,
        support = _opt(j['support']);
  final String id, area, emoji, title, summary;
  final List<String> bands;
  final bool free;
  final List<String> science, tryToday, mistakes;
  final Map<String, String>? byAge;
  final List<String> specialist;
  final List<PSource> sources;
  final List<String>? tags;
  final String? support;
}

class SosStep {
  const SosStep({required this.title, required this.text});
  final String title, text;
}

class SosCard {
  SosCard.fromJson(Json j)
      : id = '${j['id']}',
        emoji = '${j['emoji']}',
        title = '${j['title']}',
        moment = '${j['moment']}',
        bands = _strings(j['bands']),
        free = j['free'] == true,
        steps = [for (final s in j['steps'] as List) SosStep(title: '${(s as Map)['title']}', text: '${s['text']}')],
        say = _strings(j['say']),
        avoid = _strings(j['avoid']),
        byAge = _stringMap(j['byAge']),
        redFlag = _opt(j['redFlag']),
        tags = j['tags'] is List ? _strings(j['tags']) : null,
        sources = j['sources'] is List ? _strings(j['sources']) : null,
        support = _opt(j['support']);
  final String id, emoji, title, moment;
  final List<String> bands;
  final bool free;
  final List<SosStep> steps;
  final List<String> say, avoid;
  final Map<String, String>? byAge;
  final String? redFlag;
  final List<String>? tags;
  final List<String>? sources;
  final String? support;
}

class ProgrammeDay {
  ProgrammeDay.fromJson(Json j)
      : title = '${j['title']}',
        task = '${j['task']}',
        why = '${j['why']}';
  final String title, task, why;
}

class Programme {
  Programme.fromJson(Json j)
      : id = '${j['id']}',
        emoji = '${j['emoji']}',
        title = '${j['title']}',
        summary = '${j['summary']}',
        bands = _strings(j['bands']),
        intro = _strings(j['intro']),
        days = [for (final d in j['days'] as List) ProgrammeDay.fromJson(Json.from(d as Map))],
        sources = _sources(j['sources']),
        tags = j['tags'] is List ? _strings(j['tags']) : null;
  final String id, emoji, title, summary;
  final List<String> bands, intro;
  final List<ProgrammeDay> days;
  final List<PSource> sources;
  final List<String>? tags;
}

class StyleQuiz {
  StyleQuiz.fromJson(Json j)
      : emoji = '${j['emoji']}',
        title = '${j['title']}',
        intro = '${j['intro']}',
        scale = _strings(j['scale']),
        items = [for (final i in j['items'] as List) (text: '${(i as Map)['text']}', dim: '${i['dim']}')],
        results = {
          for (final e in (j['results'] as Map).entries)
            '${e.key}': (
              title: '${(e.value as Map)['title']}',
              short: '${e.value['short']}',
              detail: _strings(e.value['detail']),
              next: _strings(e.value['next']),
            ),
        },
        note = '${j['note']}',
        sources = _sources(j['sources']);
  final String emoji, title, intro;
  final List<String> scale;
  final List<({String text, String dim})> items;
  final Map<String, ({String title, String short, List<String> detail, List<String> next})> results;
  final String note;
  final List<PSource> sources;
}

class MilestoneQuiz {
  MilestoneQuiz.fromJson(Json j)
      : emoji = '${j['emoji']}',
        title = '${j['title']}',
        intro = '${j['intro']}',
        answers = _stringMap(j['answers']) ?? const {},
        regression = '${j['regression']}',
        checkpoints = [
          for (final c in j['checkpoints'] as List)
            MilestoneCheckpoint(
              id: '${(c as Map)['id']}',
              fromMonths: c['fromMonths'] as num,
              title: '${c['title']}',
              items: [
                for (final it in c['items'] as List)
                  MilestoneItem(text: '${(it as Map)['text']}', flag: it['flag'] == true, support: '${it['support'] ?? ''}'),
              ],
            ),
        ],
        results = {
          for (final e in (j['results'] as Map).entries)
            '${e.key}': (title: '${(e.value as Map)['title']}', short: '${e.value['short']}', detail: _strings(e.value['detail'])),
        },
        note = '${j['note']}',
        sources = _sources(j['sources']);
  final String emoji, title, intro;
  final Map<String, String> answers;
  final String regression;
  final List<MilestoneCheckpoint> checkpoints;
  final Map<String, ({String title, String short, List<String> detail})> results;
  final String note;
  final List<PSource> sources;
}

class Tip {
  const Tip({required this.title, required this.text});
  final String title, text;
}

Map<String, List<Tip>> _tips(Object? v) => {
      for (final e in (v as Map? ?? const {}).entries)
        '${e.key}': [for (final t in e.value as List) Tip(title: '${(t as Map)['title']}', text: '${t['text']}')],
    };

/// `ParentingContent` built from its JSON (the JSON is kept for overrides / previews).
class ParentingContent {
  ParentingContent.fromJson(this.json)
      : bands = [for (final b in json['bands'] as List? ?? const []) BandOverview.fromJson(Json.from(b as Map))],
        areas = [for (final a in json['areas'] as List? ?? const []) PArea.fromJson(Json.from(a as Map))],
        articles = [for (final a in json['articles'] as List? ?? const []) Article.fromJson(Json.from(a as Map))],
        sos = [for (final s in json['sos'] as List? ?? const []) SosCard.fromJson(Json.from(s as Map))],
        programmes = [for (final p in json['programmes'] as List? ?? const []) Programme.fromJson(Json.from(p as Map))],
        styleQuiz = json['styleQuiz'] is Map ? StyleQuiz.fromJson(Json.from(json['styleQuiz'] as Map)) : null,
        milestoneQuiz = json['milestoneQuiz'] is Map ? MilestoneQuiz.fromJson(Json.from(json['milestoneQuiz'] as Map)) : null,
        tips = _tips(json['tips']);
  final Json json;
  final List<BandOverview> bands;
  final List<PArea> areas;
  final List<Article> articles;
  final List<SosCard> sos;
  final List<Programme> programmes;

  /// Null only in the home content stand-in (tips + programmes).
  final StyleQuiz? styleQuiz;
  final MilestoneQuiz? milestoneQuiz;
  final Map<String, List<Tip>> tips;
}

/// What the Ana home card needs: the daily tips and the programmes.
class ParentingHomeContent {
  const ParentingHomeContent({required this.tips, required this.programmes});
  final Map<String, List<Tip>> tips;
  final List<Programme> programmes;
}

/// Whether bundled content is registered for this app language.
bool hasParentingContent(String? language) => parentingContentLanguages.contains(language ?? '');

// ── Overrides (parenting-overrides.ts) ───────────────────────────────────────────────────────

/// 'article' | 'sos' | 'programme' | 'programme_day' | 'tip' | 'band' | 'area' | 'quiz'
const List<String> parentingItemTypes = ['article', 'sos', 'programme', 'programme_day', 'tip', 'band', 'area', 'quiz'];

class ParentingOverrideRow {
  const ParentingOverrideRow({required this.itemType, required this.itemId, required this.patch, this.updatedAt});
  final String itemType;
  final String itemId;
  final Object? patch;
  final String? updatedAt;

  Json toJson() => {'item_type': itemType, 'item_id': itemId, 'patch': patch, 'updated_at': updatedAt};
  static ParentingOverrideRow? fromJson(Object? r) {
    if (r is! Map) return null;
    return ParentingOverrideRow(itemType: '${r['item_type']}', itemId: '${r['item_id']}', patch: r['patch'], updatedAt: _opt(r['updated_at']));
  }
}

/// Never editable: identity, age bands, gating and scoring.
const Set<String> lockedKeys = {'id', 'bands', 'area', 'free', 'fromMonths', 'dim', 'flag', 'days', 'v'};

/// Structure that is not text although it sits in a text-shaped field: the support-card kind and an SOS card's source
/// ids (keys of the shared source list).
bool isLockedField(String key, Object? base) {
  if (lockedKeys.contains(key)) return true;
  if (key == 'support' && (base == 'mental-health' || base == 'child-safety')) return true;
  return key == 'sources' && base is List && base.isNotEmpty && base.every((x) => x is String);
}

/// Optional fields an editor may add although the bundled item lacks them.
const Map<String, Object> _optionalTemplates = {
  'byAge': {'0-1': '', '1-3': '', '3-6': '', '6-12': ''},
  'redFlag': '',
  'tags': [''],
};

/// Optional text that may be cleared (empty string hides it).
const Set<String> _clearable = {'redFlag', '0-1', '1-3', '3-6', '6-12'};

/// Arrays of objects whose length an editor may change.
const Set<String> _resizable = {'sources'};
const int _maxArray = 200;
const int _maxText = 8000;

const Object _invalid = Object();

Object? _mergeValue(Object? base, Object? patch, String key) {
  if (base is String) {
    if (patch is! String || patch.length > _maxText) return _invalid;
    if (patch.trim().isEmpty && !_clearable.contains(key)) return _invalid;
    return patch;
  }
  if (base is List) {
    if (patch is! List || patch.length > _maxArray) return _invalid;
    final template = base.isEmpty ? null : base.first;
    if (template == null || template is String) {
      if (patch.any((x) => x is! String || x.length > _maxText)) return _invalid;
      // Blank lines are dropped; a list the bundled item has may not become empty.
      final list = [for (final x in patch) if ((x as String).trim().isNotEmpty) x];
      return list.isNotEmpty || base.isEmpty ? list : _invalid;
    }
    if (template is Map && !_resizable.contains(key) && patch.length != base.length) return _invalid;
    final out = <Object?>[];
    for (var i = 0; i < patch.length; i++) {
      final v = _mergeValue(i < base.length ? base[i] : template, patch[i], key);
      if (identical(v, _invalid)) return _invalid;
      out.add(v);
    }
    return out;
  }
  if (base is Map) return _mergeObject(base, patch);
  return _invalid; // numbers, booleans: never editable
}

Object? _mergeObject(Map base, Object? patch) {
  if (patch is! Map) return _invalid;
  final out = <String, dynamic>{for (final e in base.entries) '${e.key}': e.value};
  for (final e in patch.entries) {
    final k = '${e.key}';
    if (isLockedField(k, base[k])) continue;
    Object? b = base[k];
    if (_optionalTemplates.containsKey(k)) {
      final t = _optionalTemplates[k]!;
      b = b == null ? t : b is Map ? {...(t as Map), ...b} : b;
    }
    if (b == null) continue; // unknown field
    final merged = _mergeValue(b, e.value, k);
    if (!identical(merged, _invalid)) out[k] = merged; // a bad field is skipped, the rest still applies
  }
  return out;
}

/// Apply one patch to one item; the bundled item comes back unchanged when nothing valid is in the patch.
Json patchItem(Json item, Object? patch) {
  final out = _mergeObject(item, patch);
  return identical(out, _invalid) ? item : out as Json;
}

(String, int)? _splitIndex(String id) {
  final m = RegExp(r'^(.+):(\d{1,3})$').firstMatch(id);
  return m == null ? null : (m[1]!, int.parse(m[2]!) - 1);
}

/// Deep-merge the published rows into a copy of the content JSON (the bundled object itself is never mutated).
Json applyParentingOverrides(Json content, List<ParentingOverrideRow>? rows) {
  if (rows == null || rows.isEmpty) return content;
  List<dynamic> copy(String k) => [...(content[k] as List? ?? const [])];
  final c = <String, dynamic>{
    ...content,
    'articles': copy('articles'),
    'sos': copy('sos'),
    'programmes': copy('programmes'),
    'bands': copy('bands'),
    'areas': copy('areas'),
    'tips': {...(content['tips'] as Map? ?? const {})},
  };
  void replace(List<dynamic> list, String id, Object? patch) {
    final i = list.indexWhere((x) => x is Map && x['id'] == id);
    if (i >= 0) list[i] = patchItem(Json.from(list[i] as Map), patch);
  }

  for (final row in rows) {
    if (!parentingItemTypes.contains(row.itemType) || row.patch is! Map) continue;
    switch (row.itemType) {
      case 'article':
        replace(c['articles'] as List, row.itemId, row.patch);
      case 'sos':
        replace(c['sos'] as List, row.itemId, row.patch);
      case 'programme':
        replace(c['programmes'] as List, row.itemId, row.patch);
      case 'band':
        replace(c['bands'] as List, row.itemId, row.patch);
      case 'area':
        replace(c['areas'] as List, row.itemId, row.patch);
      case 'programme_day':
        final at = _splitIndex(row.itemId);
        final programmes = c['programmes'] as List;
        final pi = at == null ? -1 : programmes.indexWhere((p) => (p as Map)['id'] == at.$1);
        if (at == null || pi < 0) break;
        final days = [...((programmes[pi] as Map)['days'] as List)];
        if (at.$2 < 0 || at.$2 >= days.length) break;
        days[at.$2] = patchItem(Json.from(days[at.$2] as Map), row.patch);
        programmes[pi] = {...(programmes[pi] as Map), 'days': days};
      case 'tip':
        final at = _splitIndex(row.itemId);
        final tips = c['tips'] as Map;
        final list = at == null ? null : tips[at.$1] as List?;
        if (at == null || list == null || at.$2 < 0 || at.$2 >= list.length) break;
        final next = [...list];
        next[at.$2] = patchItem(Json.from(next[at.$2] as Map), row.patch);
        tips[at.$1] = next;
      case 'quiz':
        if (row.itemId == 'style' && c['styleQuiz'] is Map) c['styleQuiz'] = patchItem(Json.from(c['styleQuiz'] as Map), row.patch);
        if (row.itemId == 'milestones' && c['milestoneQuiz'] is Map) c['milestoneQuiz'] = patchItem(Json.from(c['milestoneQuiz'] as Map), row.patch);
    }
  }
  return c;
}

/// The bundled item an override row targets (admin editor, tests).
Object? findParentingItem(Json content, String type, String id) {
  final at = _splitIndex(id);
  Object? byId(String list) {
    for (final x in content[list] as List? ?? const []) {
      if (x is Map && x['id'] == id) return x;
    }
    return null;
  }

  switch (type) {
    case 'article':
      return byId('articles');
    case 'sos':
      return byId('sos');
    case 'programme':
      return byId('programmes');
    case 'band':
      return byId('bands');
    case 'area':
      return byId('areas');
    case 'programme_day':
      if (at == null) return null;
      for (final p in content['programmes'] as List? ?? const []) {
        if (p is Map && p['id'] == at.$1) {
          final days = p['days'] as List;
          return at.$2 >= 0 && at.$2 < days.length ? days[at.$2] : null;
        }
      }
      return null;
    case 'tip':
      if (at == null) return null;
      final list = (content['tips'] as Map?)?[at.$1] as List?;
      return list != null && at.$2 >= 0 && at.$2 < list.length ? list[at.$2] : null;
    case 'quiz':
      return id == 'style' ? content['styleQuiz'] : id == 'milestones' ? content['milestoneQuiz'] : null;
    default:
      return null;
  }
}

/// Top-level fields of [edited] that differ from [base] (what an editor's draft stores).
Json diffPatch(Map base, Map edited) {
  final out = <String, dynamic>{};
  for (final e in edited.entries) {
    final k = '${e.key}';
    if (isLockedField(k, base[k])) continue;
    if (jsonEncode(e.value) != jsonEncode(base[k])) out[k] = e.value;
  }
  return out;
}

// ── Fetching (cached, offline-safe) ──────────────────────────────────────────────────────────
String overridesCacheKey(String language) => 'anacan.parenting.overrides.v1.$language';

/// Re-check the server at most this often per language.
const int overridesFreshMs = 10 * 60 * 1000;
const Duration overridesTimeout = Duration(milliseconds: 4000);

/// `parenting_content_overrides` (language, published) rows; throws on an error.
typedef ParentingOverridesFetcher = Future<List<Object?>> Function(String language);

final parentingOverridesFetcherProvider = Provider<ParentingOverridesFetcher>((ref) => (language) async {
      final SupabaseClient client = ref.read(supabaseClientProvider);
      return await client.from('parenting_content_overrides').select('item_type, item_id, patch, updated_at').eq('language', language).eq('published', true);
    });

({int at, List<ParentingOverrideRow> rows})? readCachedOverrides(LocalStore store, String language) {
  try {
    final raw = jsonDecode(store.getItem(overridesCacheKey(language)) ?? 'null');
    if (raw is! Map || raw['at'] is! num || raw['rows'] is! List) return null;
    return (at: (raw['at'] as num).toInt(), rows: [for (final r in raw['rows'] as List) ?ParentingOverrideRow.fromJson(r)]);
  } catch (_) {
    return null;
  }
}

void _writeCachedOverrides(LocalStore store, String language, List<ParentingOverrideRow> rows, int now) {
  try {
    store.setItem(overridesCacheKey(language), jsonEncode({'at': now, 'rows': [for (final r in rows) r.toJson()]}));
  } catch (_) {}
}

/// Published overrides for a language: fresh cache → no request; otherwise the server with a timeout; on any failure
/// the last cached rows (any age) or none. Never throws.
Future<List<ParentingOverrideRow>> fetchPublishedOverrides(LocalStore store, ParentingOverridesFetcher fetch, String language,
    {int? now, bool force = false}) async {
  final at = now ?? DomainClock.nowMs();
  final cached = readCachedOverrides(store, language);
  if (cached != null && !force && at - cached.at < overridesFreshMs) return cached.rows;
  try {
    final data = await fetch(language).timeout(overridesTimeout);
    final rows = [for (final r in data) if (r is Map && r['patch'] is Map) ?ParentingOverrideRow.fromJson(r)];
    _writeCachedOverrides(store, language, rows, at);
    return rows;
  } catch (_) {
    return cached?.rows ?? const [];
  }
}

// ── Registry (data/parenting/index.ts) ───────────────────────────────────────────────────────

/// Reads one bundled language file (null when missing).
typedef ParentingAssetLoader = Future<String?> Function(String file);

final parentingAssetLoaderProvider = Provider<ParentingAssetLoader>((ref) => (file) async {
      try {
        return await rootBundle.loadString('assets/i18n/$file');
      } catch (_) {
        return null;
      }
    });

const int _refreshMs = 10 * 60 * 1000;

/// The lazy registry with its in-memory caches (module-level maps in React).
class ParentingContentRegistry {
  ParentingContentRegistry({required this.load, required this.store, required this.fetchOverrides});
  final ParentingAssetLoader load;
  final LocalStore store;
  final ParentingOverridesFetcher fetchOverrides;

  final Map<String, Future<Json?>> _bundled = {};
  final Map<String, ({int at, ParentingContent content})> _merged = {};
  final Map<String, Future<ParentingContent?>> _inflight = {};
  Map<String, PSource>? _sourceList;

  /// The bundled content JSON of a language (no overrides), loaded once; null when not registered.
  Future<Json?> loadBundled(String language) {
    if (!hasParentingContent(language)) return Future.value(null);
    return _bundled.putIfAbsent(language, () async {
      try {
        final raw = await load('parenting.$language.json');
        if (raw == null) throw StateError('missing');
        return Json.from(jsonDecode(raw) as Map);
      } catch (_) {
        unawaited(Future<void>.microtask(() => _bundled.remove(language))); // a failed load can be retried
        rethrow;
      }
    });
  }

  /// Last loaded content (with overrides) for synchronous first renders.
  ParentingContent? peek(String? language) => _merged[language ?? '']?.content;

  /// Bundled content + published overrides; re-uses the in-memory result for 10 minutes.
  Future<ParentingContent?> loadContent(String language, {bool overrides = true, int? now}) {
    final at = now ?? DomainClock.nowMs();
    final hit = _merged[language];
    if (hit != null && at - hit.at < _refreshMs) return Future.value(hit.content);
    final running = _inflight[language];
    if (running != null) return running;
    final job = () async {
      try {
        final base = await loadBundled(language);
        if (base == null) return null;
        var json = base;
        if (overrides) {
          try {
            json = applyParentingOverrides(base, await fetchPublishedOverrides(store, fetchOverrides, language, now: at));
          } catch (_) {}
        }
        final content = ParentingContent.fromJson(json);
        _merged[language] = (at: at, content: content);
        return content;
      } finally {
        unawaited(Future<void>.microtask(() => _inflight.remove(language)));
      }
    }();
    _inflight[language] = job;
    return job;
  }

  /// Tips + programmes for the home card (with tip / programme overrides). Re-uses the full content when loaded.
  Future<ParentingHomeContent?> loadTips(String language, {bool overrides = true, int? now}) async {
    if (!hasParentingContent(language)) return null;
    final at = now ?? DomainClock.nowMs();
    final full = _merged[language];
    if (full != null && at - full.at < _refreshMs) return ParentingHomeContent(tips: full.content.tips, programmes: full.content.programmes);
    final content = await loadContent(language, overrides: overrides, now: at);
    return content == null ? null : ParentingHomeContent(tips: content.tips, programmes: content.programmes);
  }

  /// The shared SOS reference list (`S` of az/sources.ts).
  Future<Map<String, PSource>> sources() async {
    if (_sourceList != null) return _sourceList!;
    final raw = await load('parenting-sources.json');
    final map = raw == null ? const <String, dynamic>{} : Json.from(jsonDecode(raw) as Map);
    return _sourceList = {for (final e in map.entries) e.key: PSource.fromJson(e.value)};
  }

  /// Test / admin hook: forget the merged content so the next load re-reads overrides.
  void reset([String? language]) => language == null ? _merged.clear() : _merged.remove(language);
}

final parentingContentRegistryProvider = Provider<ParentingContentRegistry>((ref) => ParentingContentRegistry(
      load: ref.watch(parentingAssetLoaderProvider),
      store: ref.watch(localStoreProvider),
      fetchOverrides: ref.watch(parentingOverridesFetcherProvider),
    ));

/// `useParentingContent(language)`: the content of a language (null when not registered).
final parentingContentProvider = FutureProvider.autoDispose.family<ParentingContent?, String>(
    (ref, language) => ref.watch(parentingContentRegistryProvider).loadContent(language),
    name: 'parentingContentProvider');

/// `useParentingTips(language)`.
final parentingTipsProvider = FutureProvider.autoDispose.family<ParentingHomeContent?, String>(
    (ref, language) => ref.watch(parentingContentRegistryProvider).loadTips(language),
    name: 'parentingTipsProvider');

/// The shared source list.
final parentingSourcesProvider = FutureProvider<Map<String, PSource>>((ref) => ref.watch(parentingContentRegistryProvider).sources());
