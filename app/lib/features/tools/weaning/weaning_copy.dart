// Ported from: src/lib/weaning-copy.ts (wt, wf, stepLabel)
//
// Every UI string of the weaning tool goes through `tr(key, WEANING_COPY[key])` with the Azerbaijani source text
// (generated table [kWeaningCopy]); translations come from the locale bundles under the same keys.
import '../../../core/i18n/tr.dart';
import '../../../domain/weaning/weaning.dart' show WeaningStep;
import 'weaning_copy.g.dart';

export 'weaning_copy.g.dart';

/// Translated UI string of the weaning tool.
String wt(String key) => tr(key, kWeaningCopy[key] ?? key);

/// Translated template with `{placeholders}` filled.
String wf(String key, Map<String, Object?> values) => formatTr(key, kWeaningCopy[key] ?? key, values);

/// Step name, numbered when the plan has several feeds of the same type ("Gündüz əmizdirməsi 2").
String stepLabel(WeaningStep s) {
  final label = wt('weaning_ft_${s.type}');
  return s.n != 0 ? '$label ${s.n}' : label;
}
