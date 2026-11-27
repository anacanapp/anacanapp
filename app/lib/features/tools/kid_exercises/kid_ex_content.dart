// Ported from: src/data/kid-exercises/index.ts (KIDEX_LANGUAGE_LOADERS, mergeKidExLocale, loadKidExContent),
//              src/data/kid-exercises/types.ts, src/lib/kid-exercises.ts (exerciseImage)
//
// Uşaq məşqləri content per language. assets/kid_exercises/az.json is the source (age groups, exercise order, groups
// and Azerbaijani text); every other language is its own file with the UI strings and the text of every set, group
// and exercise by id; the structure stays the Azerbaijani one. Images (assets/exercises/<id>.webp) carry no text.
// The files are verbatim copies of src/data/kid-exercises/*.json (gen_kid_ex_content.mjs).
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/kid_exercises/kid_exercises.dart';
import '../hub/hub_copy.dart' show hasKidExContent;
import '../hub/hub_copy.g.dart' show kKidExContentLanguages;
import 'kid_ex_ui_az.g.dart';

/// `exerciseImage(id)` (`/exercises/<id>.webp`) as a bundled asset.
String exerciseImageAsset(String id) => 'assets/exercises/$id.webp';

/// One age group of az.json (`KidExerciseSet`).
class KidExSet {
  const KidExSet({required this.id, required this.label, required this.months, required this.minM, required this.maxM, required this.rules});
  final String id;
  final String label;
  final String months;
  final num minM;
  final num maxM;
  final List<String> rules;
}

/// `KidExContent`.
class KidExContent {
  const KidExContent({required this.language, required this.ui, required this.sets, required this.exercises});
  final String language;

  /// `KidExUiText` (every key of [kKidExUiAz]).
  final Map<String, String> ui;
  final List<KidExSet> sets;
  final List<KidExercise> exercises;

  String u(String key) => ui[key] ?? kKidExUiAz[key] ?? '';
}

/// `KIDEX_LANGUAGE_LOADERS` keys (az is built in; the others are `assets/kid_exercises/<lang>.json`).
const List<String> kKidExLanguageLoaders = kKidExContentLanguages;

/// The empty Azerbaijani locale (`{ ui: KIDEX_UI_AZ, sets: {}, groups: {}, exercises: {} }`).
const Map<String, Object?> kKidExAzLocale = {'ui': kKidExUiAz, 'sets': <String, Object?>{}, 'groups': <String, Object?>{}, 'exercises': <String, Object?>{}};

Map<String, Object?> _map(Object? v) => v is Map ? v.cast<String, Object?>() : const {};
List<String> _strings(Object? v) => v is List ? [for (final s in v) '$s'] : const [];
String? _str(Object? v) => v is String ? v : null;

/// `mergeKidExLocale(language, src, loc)`: applies a locale's text to the Azerbaijani structure; anything missing
/// keeps the source text.
KidExContent mergeKidExLocale(String language, Map<String, Object?> src, Map<String, Object?> loc) {
  final locSets = _map(loc['sets']);
  final locGroups = _map(loc['groups']);
  final locExercises = _map(loc['exercises']);
  final sets = [
    for (final raw in (src['sets'] as List? ?? const []))
      () {
        final s = _map(raw);
        final t = locSets[s['id']] is Map ? _map(locSets[s['id']]) : null;
        final rules = _strings(s['rules']);
        final tRules = t == null || t['rules'] is! List ? null : _strings(t['rules']);
        return KidExSet(
          id: '${s['id']}',
          label: _str(t?['label']) ?? '${s['label']}',
          months: _str(t?['months']) ?? '${s['months']}',
          minM: s['minM'] as num? ?? 0,
          maxM: s['maxM'] as num? ?? 0,
          rules: tRules != null && tRules.length == rules.length ? tRules : rules,
        );
      }(),
  ];
  final exercises = [
    for (final raw in (src['exercises'] as List? ?? const []))
      () {
        final e = _map(raw);
        final group = '${e['group']}';
        final t = locExercises[e['id']] is Map ? _map(locExercises[e['id']]) : null;
        final caution = _str(e['caution']);
        return KidExercise(
          id: '${e['id']}',
          set: '${e['set']}',
          groupKey: group,
          group: _str(locGroups[group]) ?? group,
          title: _str(t?['title']) ?? '${e['title']}',
          age: (t != null ? _str(t['age']) : _str(e['age'])) ?? '',
          how: _str(t?['how']) ?? '${e['how']}',
          duration: (t != null ? _str(t['duration']) : _str(e['duration'])) ?? '',
          benefit: _str(t?['benefit']) ?? '${e['benefit']}',
          caution: t == null ? caution : (caution != null && caution.isNotEmpty ? (_str(t['caution']) ?? caution) : null),
        );
      }(),
  ];
  return KidExContent(
    language: language,
    ui: {...kKidExUiAz, for (final e in _map(loc['ui']).entries) e.key: '${e.value}'},
    sets: sets,
    exercises: exercises,
  );
}

/// Reads one bundled file (tests read the files from disk).
typedef KidExAssetLoader = Future<String> Function(String assetPath);

final kidExAssetLoaderProvider = Provider<KidExAssetLoader>((ref) => rootBundle.loadString, name: 'kidExAssetLoaderProvider');

/// `loadKidExContent(language)`: an unknown language loads Azerbaijani; a failed locale load falls back to the
/// source text. Results are cached per language for the app's lifetime (the module-level promise cache).
final kidExContentProvider = FutureProvider.family<KidExContent, String>((ref, language) async {
  final load = ref.watch(kidExAssetLoaderProvider);
  final lang = hasKidExContent(language) ? language : 'az';
  final src = _map(jsonDecode(await load('assets/kid_exercises/az.json')));
  if (lang == 'az') return mergeKidExLocale('az', src, kKidExAzLocale);
  try {
    final loc = _map(jsonDecode(await load('assets/kid_exercises/$lang.json')));
    return mergeKidExLocale(lang, src, loc);
  } catch (_) {
    return mergeKidExLocale('az', src, kKidExAzLocale);
  }
}, name: 'kidExContentProvider');
