// Ported from: src/lib/appUpdate-i18n.ts
import '../../core/i18n/app_languages.dart' show normalizeAppLanguage;
import '../../core/i18n/tr.dart' show I18nRuntime;
import 'generated/app_update_copy.g.dart';

/// Keys of `appUpdate-i18n.ts` (`Key`).
enum AppUpdateText { update, later, newVersion, whatsNew, yourVersion, required, requiredBody, banner }

/// `APP_UPDATE_TEXT_LANGUAGES`.
List<String> get appUpdateTextLanguages => kAppUpdateCopy.keys.toList();

/// `updateText(key, language = readAppLanguage())`: the language's label, else English (JS `||`: an empty
/// label also falls back). Unknown codes normalise to the app default (az).
String updateText(AppUpdateText key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? I18nRuntime.instance.language);
  final own = kAppUpdateCopy[lang]?[key.name];
  if (own != null && own.isNotEmpty) return own;
  return kAppUpdateCopy['en']![key.name]!;
}
