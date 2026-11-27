// Ported from: src/lib/recap/fonts.ts, src/lib/recap/font-loader.ts (recapTextSample)
//
// Brand typography for the Recap video (brand book):
//  - Plus Jakarta Sans – display: headlines, big numbers (Regular / Semibold / ExtraBold)
//  - Switzer – body text and the "Anacan" wordmark (Regular / Medium / Bold)
//  - Inter – small UI labels: pills, chips, captions
// The web registers the faces with FontFace from public/recap/fonts and public/fonts. Flutter resolves families
// registered in pubspec.yaml; a family that is not bundled falls back per glyph to the next one in the list and
// then to the platform font (the same order as the CSS stack). Inter and Noto Sans Arabic are bundled today;
// Plus Jakarta Sans, Switzer, Noto Sans and Noto Naskh Arabic must be added (see the feature README).
// There is no FontFace loading step: bundled fonts are ready before the first frame.

/// A font family with its per-glyph fallbacks.
class RecapFamily {
  const RecapFamily(this.primary, [this.fallback = recapFallbackFamilies]);
  final String primary;
  final List<String> fallback;

  @override
  String toString() => primary;
}

/// The CSS fallback stack (fonts.ts FALLBACK) minus the generic system names Flutter resolves itself.
const List<String> recapFallbackFamilies = ['Recap Noto Sans', 'Noto Sans', 'Noto Sans Arabic', 'Recap Noto Naskh Arabic'];

class RecapFonts {
  const RecapFonts({this.display = const RecapFamily('Plus Jakarta Sans'), this.body = const RecapFamily('Switzer'), this.ui = const RecapFamily('Inter')});
  final RecapFamily display;
  final RecapFamily body;
  final RecapFamily ui;
}

const RecapFonts recapFonts = RecapFonts();

/// Every character the video will draw (font-loader.ts `recapTextSample`).
String recapTextSample(Map<String, Object?> model) {
  final chars = <String>{...'Anacan0123456789 →+%:·—'.split('')};
  void add(Object? v) {
    if (v is String) {
      for (final r in v.runes) {
        chars.add(String.fromCharCode(r));
      }
    } else if (v is List) {
      v.forEach(add);
    } else if (v is Map) {
      v.values.forEach(add);
    }
  }

  (model['scenes'] as List? ?? const []).forEach(add);
  return chars.join();
}
