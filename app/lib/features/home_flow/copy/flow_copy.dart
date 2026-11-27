// Ported from: src/lib/feature37-i18n.ts (feature37Text) — flow / mommy-period subset (flow_copy.g.dart).
import '../../../core/i18n/i18n.dart';
import 'flow_copy.g.dart';

/// `feature37Text(key, language)`: own language, else English, else the key.
String feature37Text(String key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kFlowFeature37Copy[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return kFlowFeature37Copy['en']?[key] ?? key;
}
