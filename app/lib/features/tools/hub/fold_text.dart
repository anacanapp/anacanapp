// Ported from: src/lib/parenting-search.ts (foldText, foldWords)
//
// The Tools hub search (and the parenting search, when it is ported) folds text this way. Dart has no
// `String.normalize('NFD')`, so the NFD + combining-mark removal step reuses the table generated from Node's ICU
// for the kid-exercises search (domain/kid_exercises/data/search_fold_data.g.dart) plus the algorithmic Hangul
// syllable decomposition, exactly like `foldSearch` there.
import '../../../domain/kid_exercises/data/search_fold_data.g.dart';

final RegExp _punctuation = RegExp('[“”"«»„\'’`´.,;:!?()\\[\\]{}…/\\\\|—–_-]+');
final RegExp _spaces = RegExp(r'\s+');

String _nfdWithoutMarks(String text) {
  final out = StringBuffer();
  for (final r in text.runes) {
    if (r >= 0x300 && r <= 0x36f) continue;
    if (r >= 0xac00 && r <= 0xd7a3) {
      final s = r - 0xac00;
      out.writeCharCode(0x1100 + s ~/ 588);
      out.writeCharCode(0x1161 + (s % 588) ~/ 28);
      if (s % 28 != 0) out.writeCharCode(0x11a7 + s % 28);
      continue;
    }
    final ch = String.fromCharCode(r);
    out.write(searchFoldMap[ch] ?? ch);
  }
  return out.toString();
}

/// Lower-case, strip diacritics and fold Azerbaijani letters; punctuation becomes a space.
String foldText(String? text) {
  final lower = (text ?? '').replaceAll(RegExp('[İI]'), 'i').toLowerCase().replaceAll('ə', 'e').replaceAll('ı', 'i');
  return _nfdWithoutMarks(lower).replaceAll(_punctuation, ' ').replaceAll(_spaces, ' ').trim();
}

/// ToolsHub `foldQuery` (the Aptek product search query): trimmed, lower-cased, NFD without combining marks.
String foldQuery(String value) => _nfdWithoutMarks(value.trim().toLowerCase());

/// `foldWords(text)`.
List<String> foldWords(String? text) => foldText(text).split(' ').where((w) => w.isNotEmpty).toList();
