// Ported from: src/lib/parenting-copy.ts (pt, pf, bandKey)
//
// Tərbiyə UI chrome strings through `tr(key, PARENTING_COPY[key])` (generated [kParentingCopy]). The long-form
// content lives in assets/i18n/parenting.<lang>.json.
import '../../../core/i18n/tr.dart';
import 'parenting_copy.g.dart';

export 'parenting_copy.g.dart';

/// Translated UI string of the parenting tool.
String pt(String key) => tr(key, kParentingCopy[key] ?? key);

/// Translated template with `{placeholders}` filled.
String pf(String key, Map<String, Object?> values) => formatTr(key, kParentingCopy[key] ?? key, values);

/// Age band label key.
String bandKey(String band) => 'par_band_${band.replaceFirst('-', '_')}';
