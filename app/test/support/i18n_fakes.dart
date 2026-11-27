// Ported from: (test support) — an in-memory i18n runtime so `tr` returns the az defaults.

import 'package:anacan/core/i18n/sources.dart';
import 'package:anacan/core/i18n/tr.dart';
import 'package:anacan/core/i18n/translation_store.dart';

class EmptyI18nAssets implements I18nAssetSource {
  @override
  Future<Map<String, String>> load(String lang) async => {};
}

/// Installs a runtime with no dictionaries (tr → azDefault) and returns it.
I18nRuntime installTestI18n() => I18nRuntime.instance = I18nRuntime(store: TranslationStore(assets: EmptyI18nAssets()));
