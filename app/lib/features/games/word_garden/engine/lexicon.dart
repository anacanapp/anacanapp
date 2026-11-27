// Ported from: src/components/games/word-garden/lexicon.ts
library;

import 'dart:convert';

import '../../common/engine/js.dart';
import 'model.dart';

class CompiledWord {
  CompiledWord(this.entry, this.letters, this.signature);
  final LexiconWord entry;
  final List<String> letters;
  final String signature;
  String get word => entry.word;
  num get frequency => entry.frequency;
  WordTier get tier => entry.tier;
  String? get definition => entry.definition;
}

class CompiledLexicon {
  CompiledLexicon(this.data, this.words, this.bySignature, this.targets);
  final WordLexicon data;

  /// Insertion order = lexicon order (JS `Map`).
  final Map<String, CompiledWord> words;
  final Map<String, List<CompiledWord>> bySignature;
  final List<CompiledWord> targets;

  /// Per-lexicon memo tables (the TS WeakMaps keyed by lexicon). Values only speed things up;
  /// every cached value is a pure function of its key.
  final Map<String, Object> cache = {};
}

/// Parses an `anacan-word-garden-lexicon-v1` JSON document (asset text).
WordLexicon parseWordLexicon(String text) {
  final json = (jsonDecode(text) as Map).cast<String, Object?>();
  return WordLexicon(
    schema: json['schema'] as String? ?? '',
    language: json['language'] as String? ?? '',
    revision: json['revision'] as String? ?? '',
    locale: json['locale'] as String? ?? '',
    alphabet: ((json['alphabet'] as List?) ?? const []).cast<String>(),
    minLength: (json['minLength'] as num).toInt(),
    maxLength: (json['maxLength'] as num).toInt(),
    openingRacks: ((json['openingRacks'] as List?) ?? const []).cast<String>(),
    words: [
      for (final raw in (json['words'] as List? ?? const []))
        _word((raw as Map).cast<String, Object?>()),
    ],
    source: ((json['source'] as Map?) ?? const {}).cast<String, Object?>(),
  );
}

LexiconWord _word(Map<String, Object?> raw) {
  final tier = WordTier.parse(raw['tier']);
  final frequency = raw['frequency'];
  if (tier == null || frequency is! num || !frequency.isFinite) throw const GameError('WORD_GARDEN_LEXICON_ENTRY_INVALID');
  return LexiconWord(word: raw['word'] as String, frequency: frequency, tier: tier, definition: raw['definition'] as String?);
}

// --- Text: NFC (Latin subset), Azerbaijani/Turkish case mapping, grapheme splitting -----------

const Map<String, String> _compose = {
  'ç': 'ç', 'Ç': 'Ç', 'ş': 'ş', 'Ş': 'Ş', 'ğ': 'ğ', 'Ğ': 'Ğ',
  'ö': 'ö', 'Ö': 'Ö', 'ü': 'ü', 'Ü': 'Ü', 'İ': 'İ', 'ä': 'ä', 'Ä': 'Ä',
  'é': 'é', 'É': 'É', 'á': 'á', 'Á': 'Á',
};

/// `String.prototype.normalize('NFC')` for the Latin letters a Word Garden alphabet can contain.
/// Lexicon data is already NFC; this only recomposes decomposed keyboard input.
String nfcLatin(String value) {
  if (!value.runes.any((rune) => rune >= 0x300 && rune <= 0x36F)) return value;
  var out = value;
  _compose.forEach((from, to) => out = out.replaceAll(from, to));
  return out;
}

bool _isTurkic(String locale) {
  final language = locale.toLowerCase().split(RegExp('[-_]')).first;
  return language == 'az' || language == 'tr';
}

/// `toLocaleLowerCase(locale)` (Azerbaijani/Turkish dotted/dotless I rules).
String localeLower(String value, String locale) {
  if (!_isTurkic(locale)) return value.toLowerCase();
  return value.replaceAll('İ', 'i').replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();
}

/// `toLocaleUpperCase(locale)`.
String localeUpper(String value, String locale) {
  if (!_isTurkic(locale)) return value.toUpperCase();
  return value.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
}

bool _isExtender(int rune) =>
    (rune >= 0x300 && rune <= 0x36F) || rune == 0x200D || (rune >= 0xFE00 && rune <= 0xFE0F) ||
    (rune >= 0x1F3FB && rune <= 0x1F3FF) || (rune >= 0xE0100 && rune <= 0xE01EF);

/// `Intl.Segmenter(locale, {granularity: 'grapheme'})` for Latin text: a base code point plus
/// following combining marks / variation selectors / ZWJ continuations.
List<String> splitLetters(String value, [String locale = 'az-AZ']) {
  final normalized = nfcLatin(value);
  final out = <String>[];
  var joinNext = false;
  for (final rune in normalized.runes) {
    final char = String.fromCharCode(rune);
    if (out.isNotEmpty && (joinNext || _isExtender(rune))) {
      out[out.length - 1] += char;
    } else {
      out.add(char);
    }
    joinNext = rune == 0x200D;
  }
  return out;
}

String? normalizeGardenWord(String value, WordLexicon data) {
  final word = localeLower(nfcLatin(value), data.locale);
  final letters = splitLetters(word, data.locale);
  return letters.isNotEmpty && letters.every(data.alphabet.contains) ? word : null;
}

String displayGardenWord(String value, String locale) => localeUpper(value, locale);

String letterSignature(List<String> letters) => (List<String>.of(letters)..sort((a, b) => a.compareTo(b))).join('|');

bool canSpellWord(List<String> letters, List<String> word) {
  final counts = <String, int>{};
  for (final letter in letters) {
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  for (final letter in word) {
    final count = counts[letter] ?? 0;
    if (count == 0) return false;
    counts[letter] = count - 1;
  }
  return true;
}

CompiledLexicon compileLexicon(WordLexicon data, String language) {
  if (data.schema != 'anacan-word-garden-lexicon-v1' || data.language != language || data.revision.isEmpty ||
      data.alphabet.length < 10 || data.words.length < 3) {
    throw const GameError('WORD_GARDEN_LEXICON_INVALID');
  }
  final words = <String, CompiledWord>{};
  final bySignature = <String, List<CompiledWord>>{};
  for (final entry in data.words) {
    final normalized = normalizeGardenWord(entry.word, data);
    final letters = splitLetters(entry.word, data.locale);
    if (normalized == null || normalized != entry.word || letters.length < data.minLength ||
        letters.length > data.maxLength || words.containsKey(normalized)) {
      throw const GameError('WORD_GARDEN_LEXICON_ENTRY_INVALID');
    }
    final word = CompiledWord(entry, letters, letterSignature(letters));
    words[normalized] = word;
    (bySignature[word.signature] ??= []).add(word);
  }
  final targets = [for (final word in words.values) if (word.tier != WordTier.bonus) word];
  return CompiledLexicon(data, words, bySignature, targets);
}

List<CompiledWord> wordsFromRack(CompiledLexicon lexicon, List<String> letters) {
  final signatures = <String>{};
  final found = <String, CompiledWord>{};
  final limit = 1 << letters.length;
  for (var mask = 1; mask < limit; mask++) {
    final chosen = <String>[
      for (var index = 0; index < letters.length; index++)
        if (mask & (1 << index) != 0) letters[index],
    ];
    if (chosen.length < lexicon.data.minLength) continue;
    final signature = letterSignature(chosen);
    if (!signatures.add(signature)) continue;
    for (final word in lexicon.bySignature[signature] ?? const <CompiledWord>[]) {
      found.putIfAbsent(word.word, () => word);
    }
  }
  return found.values.toList();
}
