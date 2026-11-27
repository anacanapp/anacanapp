// Ported from: src/lib/langDetect.ts, src/lib/community-language-evidence.ts,
// src/lib/community-language-vocabulary.json
import 'app_languages.dart';
import 'generated/intl_data.g.dart';

/// Feed lens order: every supported language.
const List<String> kFeedLangs = [
  'az', 'ru', 'tr', 'kk', 'uz', 'ka', 'de', 'ar', 'en', //
  'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk',
];

bool isFeedLang(Object? value) => value is String && kFeedLangs.contains(value);

/// `sanitizeFeedLangs`: supported, de-duplicated (first occurrence order); empty → [fallback].
List<String> sanitizeFeedLangs(Object? input, List<String> fallback) {
  final list = input is List ? input.where(isFeedLang).cast<String>() : const <String>[];
  final unique = <String>[];
  for (final item in list) {
    if (!unique.contains(item)) unique.add(item);
  }
  return unique.isNotEmpty ? unique : fallback;
}

/// `defaultFeedLanguages` (src/hooks/useFeedLanguages.ts): the UI language only.
List<String> defaultFeedLanguages(String? countryCode, String uiLang) => [normalizeAppLanguage(uiLang)];

// ── NFC (String.prototype.normalize('NFC')) for the scripts the detector inspects ──

/// Canonical composition of base + combining marks using generated pairs (Latin, Cyrillic,
/// Vietnamese). Dart has no built-in normalizer; other scripts pass through unchanged.
String composeNfc(String text) {
  if (!text.runes.any((rune) => rune >= 0x300 && rune <= 0x36f)) return text;
  final out = StringBuffer();
  String? pending;
  for (final rune in text.runes) {
    final char = String.fromCharCode(rune);
    if (pending != null) {
      final composed = kNfcPairs['$pending$char'];
      if (composed != null) {
        pending = composed;
        continue;
      }
      out.write(pending);
    }
    pending = char;
  }
  if (pending != null) out.write(pending);
  return out.toString();
}

// ── community-language-evidence.ts ──

const Map<String, List<String>> _vocabulary = {
  'az': ['cox', 'yox', 'nece', 'bilmirem', 'isteyirem', 'edirem', 'edirsiniz', 'etmisem', 'olmusam', 'hamileyem', 'qizlar', 'qizim', 'usaq', 'usagim', 'qarnim', 'xanimlar', 'mene', 'yaxsi', 'nese', 'hekim', 'hekime'],
  'tr': ['merhaba', 'nasil', 'degil', 'cunku', 'kizlar', 'bebegim', 'bebek', 'anne', 'hamileyim', 'istiyorum', 'diyorum', 'evet', 'hayir', 'icin', 'cok', 'ben', 'yok', 'tesekkur'],
  'uz': ['salom', 'qanday', 'uchun', 'bilan', 'emas', 'yaxshi', 'hozir', 'qachon', 'necha', 'menga', 'shifokor', 'homilador', 'homiladorman', 'farzandim', 'nima', 'mening', 'qilyapti'],
  'kkCyrillic': ['салем', 'кыздар', 'менин', 'балам', 'жаксы', 'кандай', 'сурак', 'калай', 'жок', 'осы', 'жатыр', 'апталык', 'жасаймын', 'болады', 'керек', 'ким', 'биледи', 'енди', 'ишим', 'бугин'],
  'uzCyrillic': ['салом', 'учун', 'билан', 'яхши', 'эмас', 'нима', 'менинг', 'хомиладор', 'хомиладорман', 'хозир', 'кизлар', 'шундай', 'нега', 'рахмат', 'буладими'],
  'ru': ['привет', 'девочки', 'мой', 'моя', 'ребенок', 'ребёнок', 'как', 'что', 'почему', 'хорошо', 'подскажите', 'пожалуйста', 'беременна', 'недели', 'месяцев', 'спит'],
};

final RegExp _nonLetters = RegExp(r'[^\p{L}]+', unicode: true);

/// JS `toLowerCase()` (Unicode default case mapping, locale-independent): İ → i̇ (i + U+0307).
String jsLowerCase(String text) => text.replaceAll('İ', 'i̇').toLowerCase();

List<String> _words(String text) => text.split(_nonLetters).where((word) => word.isNotEmpty).toList();

/// `languageText`: NFC, URLs and @mentions/#hashtags removed.
String languageText(String? text) =>
    composeNfc(text ?? '').replaceAll(RegExp(r'https?://\S+', caseSensitive: false), ' ').replaceAll(RegExp(r'[@#]\S+'), ' ');

typedef TurkicEvidence = ({int az, int tr, int uz, bool azGlyph, bool salutation});
typedef CyrillicEvidence = ({int kk, int uz, int ru});

/// Shared Turkic words are not evidence for moving an Azerbaijani post to TR.
TurkicEvidence turkicLanguageEvidence(String text) {
  final clean = languageText(text);
  const fold = {'ə': 'e', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ş': 's', 'ç': 'c'};
  final folded = jsLowerCase(clean).replaceAll('i̇', 'i').replaceAllMapped(RegExp('[əğıöüşç]'), (m) => fold[m[0]]!);
  final words = _words(folded).toSet();
  int hits(String language) => _vocabulary[language]!.where(words.contains).length;
  return (az: hits('az'), tr: hits('tr'), uz: hits('uz'), azGlyph: RegExp('[Əə]').hasMatch(clean), salutation: words.contains('salam'));
}

CyrillicEvidence cyrillicLanguageEvidence(String text) {
  final words = _words(jsLowerCase(languageText(text))).toSet();
  int hits(String language) => _vocabulary[language]!.where(words.contains).length;
  return (kk: hits('kkCyrillic'), uz: hits('uzCyrillic'), ru: hits('ru'));
}

final RegExp _nonLatinScript = RegExp(r'[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]', unicode: true);

/// Conservative correction for old composers whose inferred labels are unmarked.
String legacyPostLanguage(String text, String submitted, String? preferred) {
  final clean = languageText(text);
  if (submitted == 'ru' || submitted == 'kk') {
    final evidence = cyrillicLanguageEvidence(clean);
    if (preferred == 'kk' && submitted == 'ru' && evidence.kk >= 2 && evidence.kk > evidence.ru && evidence.kk > evidence.uz) return 'kk';
    if (preferred == 'uz' && evidence.uz >= 2 && evidence.uz > evidence.ru && evidence.uz > evidence.kk) return 'uz';
    return submitted;
  }
  if (!const ['az', 'tr', 'en'].contains(submitted)) return submitted;
  if (_nonLatinScript.hasMatch(clean)) return submitted;
  final evidence = turkicLanguageEvidence(clean);
  if (preferred == 'az' && submitted != 'az' && evidence.az > evidence.tr && evidence.az > evidence.uz &&
      (evidence.az >= 2 || evidence.azGlyph || evidence.salutation)) {
    return 'az';
  }
  if (preferred == 'uz' && submitted != 'uz' && evidence.uz >= 2 && evidence.uz > evidence.az && evidence.uz > evidence.tr) return 'uz';
  return submitted;
}

// ── langDetect.ts ──

const Set<String> _trStopwords = {
  've', 'bir', 'bu', 'su', 'icin', 'için', 'cok', 'çok', 'ama', 'fakat', 'gibi', 'daha',
  'mi', 'mı', 'mu', 'mü', 'ne', 'evet', 'hayır', 'hayir', 'ben', 'sen', 'biz', 'siz',
  'degil', 'değil', 'var', 'yok', 'ile', 'olarak', 'bebek', 'bebeğim', 'hamile', 'anne',
};
const Set<String> _enStopwords = {
  'the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'my', 'your', 'for',
  'with', 'have', 'has', 'it', 'this', 'that', 'baby', 'you', 'i', 'am', 'be', 'not',
  'so', 'but', 'we', 'she', 'he', 'her', 'his', 'do', 'does', 'what', 'how',
};
const Set<String> _deStopwords = {
  'der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'ich', 'du', 'wir', 'ihr',
  'mein', 'meine', 'dein', 'mit', 'für', 'fur', 'auf', 'aus', 'bei', 'nach', 'wenn',
  'aber', 'auch', 'schon', 'noch', 'sehr', 'kann', 'hat', 'haben', 'sind', 'wird',
  'schlafen', 'schläft', 'monate', 'wochen', 'stillen', 'schwanger', 'mütter', 'mutter',
};
// Insertion order matters (ties resolve to the first listed language when no fallback matches).
const Map<String, Set<String>> _expandedStopwords = {
  'id': {'dan', 'yang', 'saya', 'anda', 'bayi', 'anak', 'ibu', 'hamil', 'tidak', 'dengan', 'untuk', 'ini', 'apakah', 'bagaimana', 'sudah', 'belum', 'menyusui'},
  'fr': {'le', 'la', 'les', 'des', 'une', 'un', 'et', 'est', 'je', 'vous', 'mon', 'ma', 'bébé', 'grossesse', 'enceinte', 'avec', 'pour', 'pas', 'votre', 'comment'},
  'es': {'el', 'la', 'los', 'las', 'una', 'uno', 'es', 'y', 'mi', 'bebé', 'embarazo', 'embarazada', 'con', 'para', 'que', 'cómo', 'tengo', 'estoy', 'hola'},
  'pt': {'o', 'a', 'os', 'as', 'uma', 'um', 'é', 'e', 'não', 'meu', 'minha', 'bebé', 'bebê', 'gravidez', 'grávida', 'com', 'para', 'que', 'como', 'estou', 'olá'},
  'vi': {'tôi', 'của', 'bé', 'mẹ', 'và', 'trẻ', 'không', 'thai', 'cho', 'hôm', 'nay', 'con', 'ngủ', 'đang', 'mình', 'bạn'},
  'pl': {'jest', 'jestem', 'moje', 'mój', 'moja', 'dziecko', 'ciąża', 'ciąży', 'nie', 'jak', 'się', 'dla', 'mam', 'bardzo', 'dzisiaj', 'dobrze'},
  'nl': {'de', 'het', 'een', 'en', 'ik', 'mijn', 'je', 'jij', 'wij', 'zwanger', 'baby', 'borstvoeding', 'vandaag', 'goed', 'hoe', 'voor', 'met', 'niet', 'dat', 'heb'},
  'sv': {'och', 'att', 'är', 'jag', 'min', 'mitt', 'barn', 'bebis', 'gravid', 'för', 'inte', 'det', 'du', 'vi', 'med', 'har', 'som', 'vad', 'hur', 'bra'},
  'et': {'ja', 'on', 'ei', 'ma', 'mina', 'sa', 'sina', 'minu', 'laps', 'beebi', 'rase', 'raseduse', 'kuidas', 'täna', 'väga', 'aga', 'see', 'kas', 'oli', 'olen'},
  'tk': {'bilen', 'üçin', 'men', 'meniň', 'siz', 'siziň', 'näme', 'nähili', 'çaga', 'çagam', 'göwreli', 'göwrelilik', 'gaty', 'hem', 'däl', 'eje', 'bäbek', 'indi', 'näçe', 'ýaly', 'ýok', 'şu', 'hepde', 'aýbaşy'},
};
const Set<String> _ukStopwords = {
  'що', 'як', 'це', 'та', 'чи', 'й', 'мене', 'мені', 'дуже', 'також', 'але', 'вже', 'ще', 'або', 'коли', 'щоб', 'тому',
  'мій', 'моя', 'моє', 'дитина', 'дитини', 'вагітна', 'вагітність', 'тижнів', 'місяців', 'привіт', 'дякую', 'немає', 'зараз', 'сьогодні',
};

int _count(RegExp pattern, String text) => pattern.allMatches(text).length;

final RegExp _arabic = RegExp(r'[؀-ۿݐ-ݿ]');
final RegExp _georgian = RegExp(r'[ა-ჿ]');
final RegExp _cyrillic = RegExp('[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІіЇїЄєҐґЎўҲҳ]');
final RegExp _han = RegExp(r'\p{Script=Han}', unicode: true);
final RegExp _kana = RegExp(r'[\p{Script=Hiragana}\p{Script=Katakana}]', unicode: true);
final RegExp _hangul = RegExp(r'\p{Script=Hangul}', unicode: true);
final RegExp _devanagari = RegExp(r'\p{Script=Devanagari}', unicode: true);
final RegExp _latin = RegExp('[A-Za-zÀ-ÖØ-öø-ÿƏəĞğIıİŞşŒœŇňŽž]');
final RegExp _vietnamese = RegExp(
    '[ĐđĂăƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉĨĩỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỶỷỸỹỴỵ]');

/// `detectLang`: lightweight first guess of a community post's language; [fallback] is the UI
/// language and wins for short or ambiguous text.
String detectLang(String text, [String fallback = 'az']) {
  final t = languageText(text);

  final arb = _count(_arabic, t);
  final geo = _count(_georgian, t);
  final cyr = _count(_cyrillic, t);
  final han = _count(_han, t);
  final kana = _count(_kana, t);
  final hangul = _count(_hangul, t);
  final devanagari = _count(_devanagari, t);
  final lat = _count(_latin, t);
  final totalLetters = arb + geo + cyr + lat + han + kana + hangul + devanagari;
  if (kana >= 1 && kana + han >= 3 && kana + han > totalLetters * 0.3) return 'ja';
  if (hangul >= 2 && hangul > totalLetters * 0.3) return 'ko';
  if (devanagari >= 2 && devanagari > totalLetters * 0.3) return 'hi';
  if (han >= 2 && han > totalLetters * 0.3) return fallback == 'ja' ? 'ja' : 'zh';

  if (totalLetters < 6) return fallback;
  if (arb > totalLetters * 0.3) return 'ar';
  if (geo > totalLetters * 0.3) return 'ka';

  if (cyr > totalLetters * 0.4) {
    if (RegExp('[ЎўҲҳ]').hasMatch(t)) return 'uz';
    final kazakhLetters = RegExp('[ӘәҒғҚқҢңӨөҰұҮүҺһ]').hasMatch(t);
    if (!kazakhLetters && RegExp('[ЇїЄєҐґІі]').hasMatch(t)) return 'uk';
    if (!kazakhLetters && !RegExp('[ЫыЭэЪъЁё]').hasMatch(t)) {
      final ukHits = jsLowerCase(t).split(_nonLetters).where(_ukStopwords.contains).length;
      if (ukHits >= 2) return 'uk';
    }
    final evidence = cyrillicLanguageEvidence(t);
    if (evidence.uz >= 2 && evidence.uz > evidence.kk && evidence.uz > evidence.ru) return 'uz';
    if (evidence.kk >= 2 && evidence.kk > evidence.uz && evidence.kk > evidence.ru) return 'kk';
    if (RegExp('[ӘәҒғҚқҰұҺһІі]').hasMatch(t)) return 'kk';
    return RegExp('[ҢңӨөҮү]').hasMatch(t) ? 'ky' : 'ru';
  }

  if (RegExp('[Əə]').hasMatch(t)) return 'az';
  if (RegExp('[ŇňÝý]').hasMatch(t) || (RegExp('[Ää]').hasMatch(t) && RegExp('[ŞşŽž]').hasMatch(t))) return 'tk';
  if (RegExp("[OoGg][ʻʼ'’‘`]").hasMatch(t)) return 'uz';

  if (_vietnamese.hasMatch(t)) return 'vi';
  if (RegExp('[ŁłĄąĘęŚśĆćŹźŻżŃń]').hasMatch(t)) return 'pl';
  if (RegExp('[Åå]').hasMatch(t)) return 'sv';
  if (RegExp('[ß]').hasMatch(t)) return 'de';
  if (RegExp('[Ññ¿¡]').hasMatch(t)) return 'es';
  if (RegExp('[Õõ]').hasMatch(t) && !RegExp('[ÃãÇç]').hasMatch(t)) return 'et';
  if (RegExp('[ÃãÕõ]').hasMatch(t)) return 'pt';

  final evidence = turkicLanguageEvidence(t);
  if (evidence.az >= 2 && evidence.az > evidence.tr && evidence.az > evidence.uz) return 'az';
  if (evidence.uz >= 2 && evidence.uz > evidence.tr && evidence.uz > evidence.az) return 'uz';

  final hasStrongTurkic = RegExp('[ĞğıİŞş]').hasMatch(t);
  final lowerWords = _words(jsLowerCase(t));
  final tkHits = lowerWords.where(_expandedStopwords['tk']!.contains).length;
  if (hasStrongTurkic && !RegExp('[ĞğıİQqXx]').hasMatch(t) && tkHits >= 2 && tkHits > lowerWords.where(_trStopwords.contains).length) {
    return 'tk';
  }
  final hasQX = RegExp('[QqXx]').hasMatch(t.replaceAll(RegExp('[^A-Za-z]'), ''));
  if (hasStrongTurkic) {
    return hasQX || (fallback == 'az' && evidence.tr == 0) ? 'az' : 'tr';
  }

  final words = _words(jsLowerCase(t));
  var trHits = 0, enHits = 0, deHits = 0;
  for (final word in words) {
    if (_trStopwords.contains(word)) trHits++;
    if (_enStopwords.contains(word)) enHits++;
    if (_deStopwords.contains(word)) deHits++;
  }
  final expandedScores = [
    for (final entry in _expandedStopwords.entries) (language: entry.key, score: words.where(entry.value.contains).length),
  ];
  final bestExpanded = expandedScores.map((item) => item.score).reduce((a, b) => a > b ? a : b);
  final maxBasic = [enHits, trHits, deHits].reduce((a, b) => a > b ? a : b);
  if (bestExpanded >= 2 && bestExpanded > maxBasic) {
    final best = expandedScores.where((item) => item.score == bestExpanded).toList();
    for (final item in best) {
      if (item.language == fallback) return item.language;
    }
    return best.length == 1 ? best.first.language : fallback;
  }
  if (deHits > enHits && deHits > trHits && deHits >= 2) return 'de';
  if (enHits > trHits && enHits >= 2) return 'en';
  if (trHits > enHits && trHits >= 2 && (evidence.tr > 0 || fallback == 'tr')) return 'tr';
  if (RegExp('[Ää]').hasMatch(t) && fallback != 'sv') return 'de';
  if (RegExp('[ÖöÜü]').hasMatch(t) && trHits > 0 && (evidence.tr > 0 || fallback == 'tr')) return 'tr';
  return fallback;
}
