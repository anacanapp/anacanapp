// Ported from: src/lib/parenting-search.ts (searchParenting; foldText / foldWords are the hub's port),
//              src/lib/parenting-match.ts (matchParentingTopic)
//
// Search: diacritic-insensitive matching over article titles / summaries / tags, SOS titles / moments / tags and
// programme titles / summaries; every query word must match; title hits rank first.
// Anacan.AI → Tərbiyə link: is a chat message about a parenting topic, and which SOS card or article answers it best.
import 'dart:math' as math;

import '../../../domain/js_compat.dart';
import '../hub/fold_text.dart';
import 'parenting_content.dart';

export '../hub/fold_text.dart' show foldText, foldWords;

class SearchHit<T> {
  const SearchHit(this.item, this.score);
  final T item;
  final num score;
}

class ParentingSearchResults {
  const ParentingSearchResults({this.sos = const [], this.articles = const [], this.programmes = const []});
  final List<SearchHit<SosCard>> sos;
  final List<SearchHit<Article>> articles;
  final List<SearchHit<Programme>> programmes;
  int get total => sos.length + articles.length + programmes.length;
}

const int _minQuery = 2;

/// A tag stem (4+ letters) that starts the query word: tag 'isterik' matches the query 'isterika'.
bool _tagStemOf(String tags, String w) => tags.split(' ').any((t) => t.length >= 4 && w.startsWith(t));

/// Score one item: 0 when a query word is missing anywhere; title > tags > body.
int _scoreFields(List<String> words, String title, List<String>? tags, List<String> body) {
  final t = foldText(title);
  final g = foldText((tags ?? const []).join(' '));
  final b = foldText(body.join(' '));
  var score = 0;
  for (final w in words) {
    bool inWord(String hay) => hay.split(' ').any((x) => x.startsWith(w));
    if (inWord(t)) {
      score += 6;
    } else if (t.contains(w)) {
      score += 4;
    } else if (inWord(g) || g.contains(w) || _tagStemOf(g, w)) {
      score += 3;
    } else if (inWord(b)) {
      score += 2;
    } else if (b.contains(w)) {
      score += 1;
    } else {
      return 0;
    }
  }
  return score;
}

List<SearchHit<T>> _rank<T>(List<SearchHit<T>> hits) => jsSorted(hits.where((h) => h.score > 0), (SearchHit<T> a, SearchHit<T> b) => b.score - a.score);

/// Grouped results (SOS, articles, programmes); empty below 2 characters.
ParentingSearchResults searchParenting(ParentingContent content, String query) {
  final words = foldWords(query);
  if (foldText(query).length < _minQuery || words.isEmpty) return const ParentingSearchResults();
  return ParentingSearchResults(
    sos: _rank([for (final c in content.sos) SearchHit(c, _scoreFields(words, c.title, c.tags, [c.moment]))]),
    articles: _rank([for (final a in content.articles) SearchHit(a, _scoreFields(words, a.title, a.tags, [a.summary]))]),
    programmes: _rank([for (final p in content.programmes) SearchHit(p, _scoreFields(words, p.title, p.tags, [p.summary]))]),
  );
}

// ── Anacan.AI matcher ────────────────────────────────────────────────────────────────────────

class ParentingMatch {
  const ParentingMatch({required this.kind, required this.id, required this.title, required this.emoji, required this.score});

  /// 'sos' | 'article'
  final String kind;
  final String id;
  final String title;
  final String emoji;
  final num score;
}

const num _minScore = 3;
const int _stem = 5;

/// Chinese / Japanese write without spaces between words: tags are matched as substrings of the whole message.
final RegExp _noSpaceScript = RegExp('[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]');

/// Arabic: one spelling for alef / taa marbuta / alef maqsura, and the attached article / prepositions removed.
final RegExp _arPrefix = RegExp('^(?:وال|بال|كال|فال|لل|ال|و|ب|ل|ف|ك)(?=[\u0621-\u064a]{3,})');
String _arNorm(String w) =>
    w.replaceAll(RegExp('[\u064b-\u0652]'), '').replaceAll(RegExp('[أإآ]'), 'ا').replaceAll('ة', 'ه').replaceAll('ى', 'ي');
bool _isArabic(String w) => RegExp('[\u0621-\u064a]').hasMatch(w);

List<String> _wordForms(List<String> words) {
  final out = <String>[];
  for (final w in words) {
    if (!_isArabic(w)) {
      out.add(w);
      continue;
    }
    final n = _arNorm(w);
    out.add(n);
    final bare = n.replaceFirst(_arPrefix, '');
    if (bare != n) out.add(bare);
  }
  return out;
}

List<String> _tagWords(String tag) => foldWords(tag).map((w) => _isArabic(w) ? _arNorm(w).replaceFirst(_arPrefix, '') : w).toList();

/// Does one tag (possibly several words) occur in the message words? Each tag word must start a message word.
bool _tagHit(List<String> words, String tag, [String text = '']) {
  final parts = _tagWords(tag);
  if (parts.isNotEmpty && text.isNotEmpty && parts.every(_noSpaceScript.hasMatch)) return parts.every(text.contains);
  if (parts.isEmpty) return false;
  if (parts.length == 1) return words.any((w) => w.startsWith(parts[0]));
  // Multi-word: in order, allowing up to two words in between.
  for (var i = 0; i < words.length; i++) {
    if (!words[i].startsWith(parts[0])) continue;
    var at = i;
    var ok = true;
    for (final p in parts.skip(1)) {
      var found = -1;
      for (var j = at + 1; j <= math.min(words.length - 1, at + 3); j++) {
        if (words[j].startsWith(p)) {
          found = j;
          break;
        }
      }
      if (found < 0) {
        ok = false;
        break;
      }
      at = found;
    }
    if (ok) return true;
  }
  return false;
}

num _score(List<String> words, String title, List<String>? tags, [String text = '']) {
  num s = 0;
  for (final tag in tags ?? const <String>[]) {
    if (_tagHit(words, tag, text)) s += foldWords(tag).length > 1 ? 6 : 3;
  }
  final stems = {for (final w in foldWords(title)) if (w.length >= _stem) w.substring(0, _stem)};
  for (final stem in stems) {
    if (words.any((w) => w.startsWith(stem))) s += 1.5;
  }
  return s;
}

/// Best SOS card or article for a chat message, or null when the message is not about a parenting topic.
ParentingMatch? matchParentingTopic(ParentingContent? content, String? message) {
  if (content == null || message == null || foldText(message).length < 4) return null;
  final words = _wordForms(foldWords(message));
  final text = _noSpaceScript.hasMatch(message) ? foldText(message).replaceAll(RegExp(r'\s+'), '') : '';
  ParentingMatch? best;
  void consider(ParentingMatch m) {
    if (m.score < _minScore) return;
    if (best == null || m.score > best!.score || (m.score == best!.score && m.kind == 'article' && best!.kind == 'sos')) best = m;
  }

  for (final c in content.sos) {
    consider(ParentingMatch(kind: 'sos', id: c.id, title: c.title, emoji: c.emoji, score: _score(words, c.title, c.tags, text)));
  }
  for (final a in content.articles) {
    consider(ParentingMatch(kind: 'article', id: a.id, title: a.title, emoji: a.emoji, score: _score(words, a.title, a.tags, text)));
  }
  return best;
}
