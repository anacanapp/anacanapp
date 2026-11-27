// Ported from: src/lib/app-languages.ts, src/lib/rtl.ts
import 'dart:convert';

import 'package:flutter/widgets.dart';

import 'generated/app_languages.g.dart';

/// One bundled UI language. Region (locale tag) controls formatting, not the account country.
@immutable
class AppLanguageInfo {
  const AppLanguageInfo({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.localeTag,
    required this.flag,
  });

  final String code;
  final String name;
  final String nativeName;

  /// BCP-47 tag used by `Intl` in the React app (`az-AZ`, `ar`, `zh-CN`, ...).
  final String localeTag;
  final String flag;

  bool get isRtl => isRtlLang(code);
  TextDirection get textDirection => isRtl ? TextDirection.rtl : TextDirection.ltr;

  /// `Locale` built from [localeTag].
  Locale get locale {
    final parts = localeTag.split('-');
    return parts.length > 1 ? Locale(parts[0], parts[1]) : Locale(parts[0]);
  }

  /// Locale identifier for `package:intl` (`DateFormat(pattern, intlLocale)`): `en_US`, `zh_CN`, `tk`.
  /// `tk` has no intl data; see `date_utils.dart` (`ensureDateLocales`) which registers a custom one,
  /// mirroring the custom date-fns locale of date-utils.ts.
  String get intlLocale => switch (code) {
        'en' => 'en_US',
        'zh' => 'zh_CN',
        _ => code,
      };

  /// date-fns locale used by `getCurrentDateLocale()` in date-utils.ts.
  /// `ky` = Russian patterns + Intl ky-KG names; `tk` = Turkish patterns + fixed Turkmen names.
  String get dateFnsLocale => switch (code) {
        'en' => 'enUS',
        'tr' => 'tr',
        'zh' => 'zhCN',
        'ky' => 'ky(custom: ru + Intl ky-KG names)',
        'tk' => 'tk(custom: tr + Turkmen names)',
        _ => code,
      };
}

/// The 25 bundled languages in bundle order (APP_LANGUAGES).
final List<AppLanguageInfo> kAppLanguages = List.unmodifiable(kAppLanguageRows.map((row) => AppLanguageInfo(
      code: row.$1,
      name: row.$2,
      nativeName: row.$3,
      localeTag: row.$4,
      flag: row.$5,
    )));
final List<String> kAppLanguageCodes = List.unmodifiable(kAppLanguages.map((language) => language.code));
final Map<String, AppLanguageInfo> _byCode = {for (final language in kAppLanguages) language.code: language};

/// The 16 content-pack languages (NEW_LANGUAGE_CODES).
const List<String> kPackLanguageCodes = kNewLanguageCodes;

/// Languages excluded from the public website / brand portal (21-language contract).
const Set<String> kAppOnlyLanguages = {'ky', 'et', 'tk', 'uk'};

bool isAppLanguage(String code) => _byCode.containsKey(code);
bool isPackLanguage(String code) => kNewLanguageCodes.contains(code);
bool isWebsiteLanguage(String code) => isAppLanguage(code) && !kAppOnlyLanguages.contains(code);

/// `normalizeAppLanguage`: trims, lower-cases, `_`→`-`, keeps the primary subtag; unknown → `az`.
String normalizeAppLanguage(Object? value) {
  final code = value is String ? value.trim().toLowerCase().replaceAll('_', '-').split('-').first : '';
  return isAppLanguage(code) ? code : 'az';
}

AppLanguageInfo appLanguage(String code) => _byCode[normalizeAppLanguage(code)]!;

/// `appLanguageLocale`: the locale tag (`az-AZ`, `ar`, `pt-PT`).
String appLanguageLocale(String code) => appLanguage(code).localeTag;

/// `readStoredAppLanguage` over the web storage snapshot: `anacan-user-store` (zustand JSON,
/// `state.language`) first, then the separate `language` key; default `az`. Pure so the
/// localStorage migration (bridge release 53) can reuse it.
String languageFromWebStorage({String? userStoreJson, String? languageKey}) {
  if (userStoreJson != null && userStoreJson.isNotEmpty) {
    try {
      final decoded = jsonDecode(userStoreJson);
      if (decoded is Map && decoded['state'] is Map) {
        final language = (decoded['state'] as Map)['language'];
        if (language != null && language != '' && language != false && language != 0) return normalizeAppLanguage(language);
      }
    } catch (_) {
      // damaged snapshot: the separate preference below
    }
  }
  return normalizeAppLanguage(languageKey);
}

/// A row of the remote `app_languages` table.
@immutable
class RemoteAppLanguage {
  const RemoteAppLanguage({
    required this.code,
    required this.name,
    required this.nativeName,
    this.isActive,
    this.sortOrder,
    this.disabledTools,
  });

  factory RemoteAppLanguage.fromRow(Map<String, dynamic> row) => RemoteAppLanguage(
        code: '${row['code']}',
        name: '${row['name'] ?? ''}',
        nativeName: '${row['native_name'] ?? ''}',
        isActive: row['is_active'] as bool?,
        sortOrder: (row['sort_order'] as num?)?.toInt(),
        disabledTools: row['disabled_tools'] is List ? List<String>.from((row['disabled_tools'] as List).map((item) => '$item')) : null,
      );

  final String code;
  final String name;
  final String nativeName;
  final bool? isActive;
  final int? sortOrder;
  final List<String>? disabledTools;

  RemoteAppLanguage copyWith({bool? isActive, List<String>? disabledTools}) => RemoteAppLanguage(
        code: code,
        name: name,
        nativeName: nativeName,
        isActive: isActive ?? this.isActive,
        sortOrder: sortOrder,
        disabledTools: disabledTools ?? this.disabledTools,
      );
}

/// `resolveAppLanguages`: only this bundle's registry determines the choices. Known remote rows are
/// forced active (keeping their names/tool restrictions, in remote order); bundled languages missing
/// remotely follow in bundle order, and pack languages inherit English's `disabled_tools`.
List<RemoteAppLanguage> resolveAppLanguages([List<RemoteAppLanguage> remote = const []]) {
  final known = {for (final language in remote) language.code};
  final enabled = remote.where((language) => isAppLanguage(language.code)).map((language) => language.copyWith(isActive: true));
  List<String>? referenceTools;
  for (final language in remote) {
    if (language.code == 'en') {
      referenceTools = language.disabledTools;
      break;
    }
  }
  final missing = kAppLanguages.where((language) => !known.contains(language.code)).map((language) => RemoteAppLanguage(
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        disabledTools: isPackLanguage(language.code) && referenceTools != null ? List<String>.of(referenceTools) : null,
      ));
  return [...enabled, ...missing];
}

// ── RTL (src/lib/rtl.ts) ──

bool isRtlLang(String? lang) => lang != null && kRtlLanguages.contains(lang);

TextDirection textDirectionFor(String? lang) => isRtlLang(lang) ? TextDirection.rtl : TextDirection.ltr;

/// `rtlX`: mirrors a horizontal animation offset for RTL.
double rtlX(double value, bool isRtl) => isRtl ? -value : value;

/// `rtlX` for CSS-like strings (`"20%"`, `"-12px"`).
String rtlXString(String value, bool isRtl) {
  if (!isRtl) return value;
  final match = RegExp(r'^(-?[\d.]+)(.*)$').firstMatch(value);
  if (match == null) return value;
  final number = double.tryParse(match[1]!);
  if (number == null) return value;
  final negated = -number;
  final text = negated == negated.truncateToDouble() ? negated.toInt().toString() : negated.toString();
  return '$text${match[2]}';
}

/// Locale for Flutter's Material/Cupertino localizations. `flutter_localizations` has no Turkmen
/// tables; Turkmen falls back to Russian (the same bridge the content fallback uses for ky/tk).
Locale materialLocaleFor(String code) {
  final language = appLanguage(code);
  if (language.code == 'tk') return const Locale('ru', 'RU');
  return language.locale;
}
