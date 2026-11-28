// Ported from: src/lib/feature-text.ts (createFeatureText: own file, else en, else az; fill)
//
// Read access to the generated per-language copy maps (illness, pregnancy loss).

/// `fill(template, values)`: replaces `{name}` placeholders present in [values].
String fill(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);

/// One language's copy (same shape as az.json).
class FeatureText {
  const FeatureText(this.data);
  final Map<String, Object?> data;

  /// `createFeatureText(...).load(language)`.
  static FeatureText of(Map<String, Map<String, Object?>> table, String language) =>
      FeatureText(table[language] ?? table['en'] ?? table['az']!);

  String s(String key) => data[key] is String ? data[key]! as String : '';
  List<String> list(String key) => [for (final v in (data[key] as List?) ?? const []) '$v'];
  FeatureText sub(String key) => FeatureText(((data[key] as Map?) ?? const {}).cast<String, Object?>());
  List<FeatureText> items(String key) => [for (final v in (data[key] as List?) ?? const []) FeatureText((v as Map).cast<String, Object?>())];

  /// `t.group[key]` (null when missing).
  String? at(String group, String key) {
    final m = data[group];
    return m is Map && m[key] is String ? m[key] as String : null;
  }
}
