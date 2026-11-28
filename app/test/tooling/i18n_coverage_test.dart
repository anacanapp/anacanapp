// Ported from: src/lib/tr.ts (tr: dictionary value, else the az default), scripts/i18n/inline-localization.mjs
//              (inline keys), src/lib/app-languages.ts (25 app languages) — Flutter-only guard, no vitest file.
//
// The Flutter UI must serve the 25 app languages exactly like React:
//  1. every `tr` / `formatTr` / `t` key and every `trInline` / `formatTrInline` key used in lib/ exists in the
//     dictionaries exported from the React sources (app/assets/i18n, app/tool/i18n/export.mjs); a key known to no
//     language is a typo or an invented key (unless React itself uses it with an untranslated default);
//  2. `tr` resolves each of those keys in all 25 languages like React: the language's value, else the az default;
//  3. literal UI text that React localizes (an inline key exists for the ported React file + text) is not
//     hard-coded in Flutter;
//  4. the generated tables cover the React language sets, and no hand-written per-language table silently drops
//     languages.
// Paths are relative to app/ (flutter test runs there); the React sources are read from ../src when present.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/generated/app_languages.g.dart';
import 'package:anacan/core/i18n/generated/date_fns_names.g.dart';
import 'package:anacan/core/i18n/generated/intl_data.g.dart';
import 'package:anacan/core/i18n/generated/startup_copy.g.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

/// One `tr(key, azDefault)`-style use in lib/.
class _Use {
  const _Use(this.file, this.line, this.key, this.azDefault, {this.inline = false});
  final String file;
  final int line;
  final String key;
  final String? azDefault;
  final bool inline;
  @override
  String toString() => '$file:$line $key';
}

final List<File> _libFiles = Directory('lib')
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .toList()
  ..sort((a, b) => a.path.compareTo(b.path));

String _rel(File f) => f.path.replaceAll(r'\', '/');

/// Dart single/double-quoted literal body → value; null when it interpolates (`$`).
String? _unescape(String body) {
  final out = StringBuffer();
  for (var i = 0; i < body.length; i++) {
    final c = body[i];
    if (c == r'$') return null;
    if (c != r'\') {
      out.write(c);
      continue;
    }
    final n = body[++i];
    switch (n) {
      case 'n':
        out.write('\n');
      case 't':
        out.write('\t');
      case 'u':
        if (body[i + 1] == '{') {
          final end = body.indexOf('}', i);
          out.writeCharCode(int.parse(body.substring(i + 2, end), radix: 16));
          i = end;
        } else {
          out.writeCharCode(int.parse(body.substring(i + 1, i + 5), radix: 16));
          i += 4;
        }
      default:
        out.write(n);
    }
  }
  return out.toString();
}

int _lineOf(String text, int offset) => '\n'.allMatches(text.substring(0, offset)).length + 1;

/// Index of the last character of the string literal starting at [i] (a quote; `r` raw prefix honoured).
int _stringEnd(String s, int i) {
  final c = s[i];
  if (s.startsWith(c * 3, i)) {
    final end = s.indexOf(c * 3, i + 3);
    return end < 0 ? s.length - 1 : end + 2;
  }
  final raw = i > 0 && s[i - 1] == 'r' && (i < 2 || !RegExp(r'[\w$]').hasMatch(s[i - 2]));
  var j = i + 1;
  while (j < s.length && s[j] != c && s[j] != '\n') {
    if (!raw && s[j] == r'\') j++;
    j++;
  }
  return j;
}

/// Index of the top-level `,` (or `)`) ending the call argument that starts at [from] (`(` at [open]: the end of
/// the whole call when [from] is null), skipping string literals and comments.
int _scan(String s, int open, {int? from}) {
  var depth = from == null ? 0 : 1;
  for (var i = from ?? open; i < s.length; i++) {
    final c = s[i];
    if (c == "'" || c == '"') {
      i = _stringEnd(s, i);
      continue;
    }
    if (c == '/' && i + 1 < s.length && s[i + 1] == '/') {
      i = s.indexOf('\n', i);
      if (i < 0) return s.length;
      continue;
    }
    if (from != null && depth == 1 && c == ',') return i;
    if (c == '(' || c == '[' || c == '{') depth++;
    if (c == ')' || c == ']' || c == '}') {
      depth--;
      if (depth == 0) return from == null ? i + 1 : i;
    }
  }
  return s.length;
}

/// Index just after the `)` closing the `(` at [open].
int _closeParen(String s, int open) => _scan(s, open);

const String _lit = r"""'((?:[^'\\\n]|\\.)*)'""";
final RegExp _keyCall = RegExp(
    r'''(?<![\w.$])(?:tr|formatTr|t)\(\s*'([^'\\\n$]+)'\s*,\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")''');
final RegExp _inlineHead = RegExp(r'''(?<![\w.$])(?:trInline|formatTrInline)\(\s*'([^'\\\n$]+)'\s*,''');
final RegExp _anyLiteral = RegExp(_lit);

/// The texts a `trInline(file, …)` argument can evaluate to: a literal, or the literal branches of `?:` / switch
/// expressions (literals compared with `==` or used as switch patterns are conditions, not texts).
List<(String, int)> _inlineTexts(String s, int from, int to) {
  final texts = <(String, int)>[];
  for (final m in _anyLiteral.allMatches(s.substring(from, to))) {
    final start = from + m.start;
    final before = s.substring(from, start).trimRight();
    final after = s.substring(start + m[0]!.length).trimLeft();
    final isText = before.isEmpty || before.endsWith('?') || before.endsWith(':') || before.endsWith('=>');
    if (!isText || after.startsWith('=>') || after.startsWith('==') || after.startsWith('!=')) continue;
    final value = _unescape(m[1]!);
    if (value != null) texts.add((value, start));
  }
  return texts;
}

List<_Use> _collectUses() {
  final uses = <_Use>[];
  for (final file in _libFiles) {
    final s = file.readAsStringSync();
    for (final m in _keyCall.allMatches(s)) {
      final body = m[2] ?? m[3];
      uses.add(_Use(_rel(file), _lineOf(s, m.start), m[1]!, body == null ? null : _unescape(body)));
    }
    for (final m in _inlineHead.allMatches(s)) {
      // trInline(file, text) / formatTrInline(file, template, [values]): the second argument only.
      final textEnd = _scan(s, s.indexOf('(', m.start), from: m.end);
      for (final (text, at) in _inlineTexts(s, m.end, textEnd)) {
        uses.add(_Use(_rel(file), _lineOf(s, at), inlineKey(m[1]!, text), text, inline: true));
      }
    }
  }
  return uses;
}

Map<String, String> _readMap(String path) => (jsonDecode(File(path).readAsStringSync()) as Map).cast<String, String>();

void main() {
  final codes = kAppLanguageCodes;
  final maps = {for (final lang in codes) lang: _readMap('assets/i18n/$lang.json')};
  final index = jsonDecode(File('assets/i18n/_inline_index.json').readAsStringSync()) as Map<String, dynamic>;
  final uses = _collectUses();
  final keys = {for (final u in uses) u.key: u};

  /// Every quoted key-like literal of the React sources (`'snake_key'` / `"snake_key"`).
  Set<String>? reactLiterals;
  Set<String> react() => reactLiterals ??= () {
        final src = Directory('../src');
        final found = <String>{};
        if (!src.existsSync()) return found;
        final quoted = RegExp(r'''['"]([A-Za-z][A-Za-z0-9_.]*)['"]''');
        for (final f in src.listSync(recursive: true).whereType<File>()) {
          if (!f.path.endsWith('.ts') && !f.path.endsWith('.tsx')) continue;
          for (final m in quoted.allMatches(f.readAsStringSync())) {
            found.add(m[1]!);
          }
        }
        return found;
      }();

  test('the scan finds the tr / trInline uses of lib/', () {
    expect(codes, hasLength(25));
    expect(uses.where((u) => !u.inline).length, greaterThan(4000));
    expect(uses.where((u) => u.inline), isNotEmpty);
  });

  test('every tr / formatTr / t key used in lib/ exists in the React dictionaries', () {
    final unknown = keys.keys.where((k) => !keys[k]!.inline && !codes.any((lang) => maps[lang]!.containsKey(k))).toList();
    // React uses these keys too but no bundled dictionary has them (both apps show the az default; the DB overlay
    // can still translate them).
    final reactOnly = unknown.where(react().contains).toList();
    final invented = unknown.where((k) => !reactOnly.contains(k)).map((k) => keys[k].toString()).toList();
    // ignore: avoid_print
    print('i18n coverage: ${keys.length} keys used; ${reactOnly.length} React keys without any bundled translation'
        '${reactOnly.isEmpty ? '' : ' (${reactOnly.take(12).join(', ')}${reactOnly.length > 12 ? ', ...' : ''})'}');
    expect(invented, isEmpty, reason: 'keys unknown to React (typo or invented key):\n${invented.join('\n')}');
  });

  test('every trInline / formatTrInline call derives an inline key React has', () {
    final missing = uses.where((u) => u.inline && !index.containsKey(u.key)).map((u) => '$u "${u.azDefault}"').toList();
    expect(missing, isEmpty, reason: 'React file name or Azerbaijani text does not match the inline index:\n${missing.join('\n')}');
  });

  test('tr resolves every used key in all 25 languages like React (missing key -> az default)', () async {
    final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')));
    final report = <String>[];
    for (final lang in codes) {
      await runtime.ensureLanguageReady(lang);
      runtime.setLanguageInMemory(lang);
      var missing = 0;
      for (final use in uses) {
        final azDefault = use.azDefault ?? '__DEFAULT__';
        final expected = maps[lang]![use.key] ?? azDefault;
        expect(runtime.tr(use.key, azDefault), expected, reason: '$lang $use');
        if (!maps[lang]!.containsKey(use.key)) missing++;
      }
      report.add('$lang:$missing');
    }
    // ignore: avoid_print
    print('used keys falling back to the az default, per language: ${report.join(' ')}');
  });

  test('dictionary values of used keys are not corrupt (known React data bugs are guarded in Dart)', () {
    final mojibake = RegExp('[\u00c2-\u00c5\u00c9\u00d0\u00d1\u00d8\u00d9\u00e2][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178'
        '\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]');
    final escaped = RegExp(r'\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}');
    final broken = <String>{};
    for (final key in keys.keys) {
      for (final lang in codes) {
        final value = maps[lang]![key];
        if (value != null && (value == r'\' || mojibake.hasMatch(value) || escaped.hasMatch(value))) broken.add(key);
      }
    }
    // src/locales/az.json and scripts/i18n/{de,ar,ka,kk,uz}.seed.json: `\` (a cut `\"…\"` literal) and a
    // double-encoded az value; settings_screen.dart, safety_lookup.dart and appearance_screen.dart fall back.
    const guarded = {'settingsscreen_sil_27792d', 'safetylookup_ai_ile_axtaris_edin_780816', 'appearancescreen_vurgu'};
    expect(broken.difference(guarded), isEmpty, reason: 'corrupt dictionary values: ${broken.difference(guarded)}');
  });

  test('literal UI text that React inline-localizes is not hard-coded', () {
    // file|text pairs that are not UI copy or belong to other work streams (reported, see docs/flutter).
    const allowed = {
      'lib/features/games/color_sort/ui/color_sort_game.dart|from', // notice parameter names
      'lib/features/games/color_sort/ui/color_sort_game.dart|to',
      // story-export.ts canvas text (not inline-localized in React); the header names StoryViewer.tsx.
      'lib/features/community_stories/export/story_export.dart|MİF',
      'lib/features/community_stories/export/story_export.dart|FAKT',
      // community/StoryViewer.tsx uses groupTr('common_close'); 'Bağla' is the stories/StoryViewer.tsx key.
      'lib/features/community_stories/ui/story_viewer.dart|Bağla',
    };
    final hardCoded = <String>[];
    final header = RegExp(r'([A-Za-z0-9_-]+)\.tsx?\b');
    final literal = RegExp(r"""'((?:[^'\\\n$]|\\[^$])*)'""");
    final letter = RegExp(r'\p{L}', unicode: true);
    final callHead = RegExp(r'(?<![\w.$])(?:tr|t|formatTr|trInline|formatTrInline|inlineKey)\(');
    for (final file in _libFiles) {
      final path = _rel(file);
      if (path.endsWith('.g.dart')) continue;
      final s = file.readAsStringSync();
      final comments = s.split('\n').where((l) => l.startsWith('//')).take(15).join('\n');
      final bases = {for (final m in header.allMatches(comments)) m[1]!};
      if (bases.isEmpty) continue;
      final spans = [for (final m in callHead.allMatches(s)) (m.start, _closeParen(s, m.end - 1))];
      for (final m in literal.allMatches(s)) {
        if (spans.any((span) => m.start > span.$1 && m.start < span.$2)) continue;
        final text = _unescape(m[1]!)?.trim();
        if (text == null || !letter.hasMatch(text)) continue;
        for (final base in bases) {
          final key = inlineKey(base, text);
          final entry = index[key] as Map<String, dynamic>?;
          if (entry == null || entry['admin'] == true) continue;
          if (allowed.contains('$path|$text') || allowed.contains('$path|*')) continue;
          hardCoded.add('$path:${_lineOf(s, m.start)} "$text" -> trInline(\'$base.tsx\', ...) [$key]');
        }
      }
    }
    expect(hardCoded, isEmpty, reason: 'React translates these (use trInline):\n${hardCoded.join('\n')}');
  });

  group('generated tables cover the React language sets', () {
    test('registry, startup copy and ICU format data', () {
      final manifest = jsonDecode(File('assets/i18n/_manifest.json').readAsStringSync()) as Map<String, dynamic>;
      expect(kAppLanguageRows.map((r) => r.$1).toList(), codes);
      expect((manifest['languages'] as Map).keys.toSet(), codes.toSet());
      // src/lib/startup-i18n.ts has no az entry: az callers pass the Azerbaijani fallback.
      expect(codes.toSet().difference(kStartupCopy.keys.toSet()), {'az'});
      expect(kWeekdayShort.keys.toSet(), codes.toSet());
      expect(kNumberSymbols.keys.toSet(), codes.toSet());
      expect(kDateTemplates.keys.toSet(), kNewLanguageCodes.toSet());
      expect(kUnitPatterns.keys.toSet(), {...kLanguageExpansion21, ...kLanguageExpansion23, ...kLanguageExpansion25});
      expect(kDateFnsNames.keys.toSet(), codes.toSet());
      for (final lang in codes) {
        final names = kDateFnsNames[lang]!;
        expect([names.$1.length, names.$2.length, names.$3.length, names.$4.length, names.$5.length], [12, 12, 12, 7, 7]);
      }
    });

    test('per-language map literals in lib/ cover all 25 languages unless React does not', () {
      String pack(String extra) => '$extra${extra.isEmpty ? '' : ','}${kNewLanguageCodes.join(',')}';
      // file -> missing-language sets that mirror React (React has the same partial table and its own fallback).
      final allowed = <String, Set<String>>{
        // count-plural.ts / getOrdinal: switch-like tables, other languages take the generic branch.
        'lib/core/i18n/count_format.dart': {'az,tr,ka,kk,uz,zh,id,vi,ja,ko,ky,tk', 'az,tr'},
        // Intl templates only for the pack languages, unit patterns only for the expansion languages.
        'lib/core/i18n/generated/intl_data.g.dart': {'az,en,tr,ru,de,ar,ka,kk,uz', 'az,en,tr,ru,de,ar,ka,kk,uz,zh,id,fr,es,pt'},
        'lib/core/i18n/generated/startup_copy.g.dart': {'az'},
        'lib/core/i18n/lang_detect.dart': {'az,en,tr,ru,de,ar,ka,kk,uz,zh,hi,ja,ko,ky,uk'}, // stop-word tables
        'lib/domain/recap/data/recap_data.g.dart': {'en,tr,de,uz,id,fr,es,pt,vi,pl,nl,sv,et,tk'}, // numbers.ts KG unit
        'lib/features/chat/copy/chat_copy.g.dart': {pack('')}, // CHAT_TRANSLATIONS (DB / dictionary first)
        'lib/features/entry/language/initial_language_screen.dart': {pack('')}, // startup copy covers the pack
        'lib/features/games/hub/data/game_score_sync.dart': {pack('')}, // game-score-messages.ts
        'lib/features/tools/nutrition/nutrition.dart': {pack('az')}, // Nutrition.tsx inline per-language copy
        'lib/features/tools/recipes/recipes_logic.dart': {pack('ka,uz')}, // Recipes.tsx fallback dictionary
        'lib/features/tools/vaccines/vaccine_labels.g.dart': {'az'}, // az is the source text
        'lib/native/purchases/data/premium_copy.g.dart': {'az'}, // az is the source text
      };
      final unexpected = <String>[];
      for (final file in _libFiles) {
        final path = _rel(file);
        for (final missing in _partialLanguageMaps(file.readAsStringSync(), codes)) {
          if (!(allowed[path]?.contains(missing) ?? false)) unexpected.add('$path: missing $missing');
        }
      }
      expect(unexpected.toSet(), isEmpty, reason: unexpected.toSet().join('\n'));
    });
  });
}

/// Map literals whose keys are (mostly) app-language codes and that miss some of [codes]; one comma-joined missing
/// set (registry order) per such literal.
List<String> _partialLanguageMaps(String s, List<String> codes) {
  final result = <String>[];
  final stack = <(String, List<String>)>[];
  for (var i = 0; i < s.length; i++) {
    final c = s[i];
    if (c == '/' && i + 1 < s.length && s[i + 1] == '/') {
      final end = s.indexOf('\n', i);
      if (end < 0) break;
      i = end;
      continue;
    }
    if (c == "'" || c == '"') {
      final j = _stringEnd(s, i) + 1;
      final literal = s.substring(i + 1, (j - 1).clamp(i + 1, s.length));
      var k = j;
      while (k < s.length && s[k] == ' ') {
        k++;
      }
      if (k < s.length && s[k] == ':' && stack.isNotEmpty && stack.last.$1 == '{') stack.last.$2.add(literal);
      i = j - 1;
      continue;
    }
    if (c == '{' || c == '[' || c == '(') stack.add((c, <String>[]));
    if ((c == '}' || c == ']' || c == ')') && stack.isNotEmpty) {
      final (type, keys) = stack.removeLast();
      if (type != '{') continue;
      final langKeys = keys.where(codes.contains).toSet();
      if (langKeys.length >= 5 && langKeys.length >= keys.length * 0.8 && langKeys.length < codes.length) {
        result.add(codes.where((code) => !langKeys.contains(code)).join(','));
      }
    }
  }
  return result;
}
