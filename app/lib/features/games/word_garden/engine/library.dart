// Ported from: src/components/games/word-garden/library.ts
library;

import '../../common/engine/js.dart';
import 'lexicon.dart';

class GardenLibraryDescriptor {
  const GardenLibraryDescriptor({required this.name, required this.revision, required this.locale, required this.words, required this.targets, required this.asset});
  final String name;
  final String revision;
  final String locale;
  final int words;
  final int targets;

  /// Asset path of the lexicon JSON (loaded by the UI layer through rootBundle).
  final String asset;
}

const Map<String, GardenLibraryDescriptor> wordGardenLibraries = {
  'az': GardenLibraryDescriptor(
      name: 'Azərbaycan dili', revision: 'az-202611-v3', locale: 'az-AZ', words: 7745, targets: 5606, asset: 'assets/games/word_garden/az.json'),
};

/// Newest first: a profile without a current-revision save adopts the newest older save.
const Map<String, List<String>> wordGardenPreviousRevisions = {
  'az': ['az-202610-v2', 'az-202610-v1'],
};

const Map<String, String> publishedLibraryAssets = {
  'az-202610-v1': 'assets/games/word_garden/az-v1.json',
  'az-202610-v2': 'assets/games/word_garden/az-v2.json',
};

String wordGardenLanguage(String language) => language.trim().toLowerCase().replaceAll('_', '-').split('-').first;

bool hasWordGardenLibrary(String language) => wordGardenLibraries.containsKey(wordGardenLanguage(language));

/// Resolves the asset for `loadGardenLexicon(language, revision)` with the same errors.
({String code, String revision, String locale, String asset}) gardenLexiconAsset(String language, [String? revision]) {
  final code = wordGardenLanguage(language);
  final descriptor = wordGardenLibraries[code];
  if (descriptor == null) throw const GameError('WORD_GARDEN_LANGUAGE_NOT_AVAILABLE');
  final requested = revision == null || revision.isEmpty ? descriptor.revision : revision;
  if (requested != descriptor.revision && !(wordGardenPreviousRevisions[code]?.contains(requested) ?? false)) {
    throw const GameError('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
  }
  final asset = requested == descriptor.revision ? descriptor.asset : publishedLibraryAssets[requested];
  if (asset == null) throw const GameError('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
  return (code: code, revision: requested, locale: descriptor.locale, asset: asset);
}

/// Second half of `loadGardenLexicon`: validates the loaded asset text against the request.
CompiledLexicon compileGardenLexiconAsset(String text, String language, [String? revision]) {
  final target = gardenLexiconAsset(language, revision);
  final data = parseWordLexicon(text);
  if (data.revision != target.revision || data.locale != target.locale) throw const GameError('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
  return compileLexicon(data, target.code);
}
