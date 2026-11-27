// Ported from: src/lib/content-i18n.ts, src/lib/content-pack-refresh.ts
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../i18n/app_languages.dart';
import 'content_pack_loader.dart';
import 'pack_store.dart';

/// Native origin of the packs (the web build fetches same-origin).
const String kContentPackOrigin = 'https://app.anacan.az';

/// `fetchPack` over package:http. `fresh` adds `Cache-Control: no-cache` (manifest); non-200 and
/// timeouts throw. The body is decoded as UTF-8 regardless of the response charset.
FetchPack httpFetchPack(http.Client client) => (String url, {required bool fresh, required Duration timeout}) async {
      final response = await client.get(Uri.parse(url), headers: fresh ? const {'Cache-Control': 'no-cache'} : const {}).timeout(timeout);
      if (response.statusCode != 200) throw HttpException('CONTENT_PACK_HTTP ${response.statusCode}', uri: Uri.parse(url));
      return utf8.decode(response.bodyBytes);
    };

/// Hot shard list kept in memory and handed to a persistence callback (web: localStorage
/// `anacan_content_pack_hot:<lang>`, a JSON array of shard ids).
class CallbackHotShardList implements HotShardList {
  CallbackHotShardList({Map<String, List<String>>? initial, this.onWrite}) : _values = {...?initial};

  final Map<String, List<String>> _values;
  final void Function(String language, List<String> ids)? onWrite;

  @override
  List<String> read(String language) => _values[language] ?? const [];

  @override
  void write(String language, List<String> ids) {
    _values[language] = ids;
    onWrite?.call(language, ids);
  }
}

/// Process-wide content translation service: the 16 pack languages, packs under
/// `<application support>/content-packs/`.
class ContentTranslations {
  ContentTranslations(this.loader) {
    loader.subscribe(() => version.value = loader.version);
  }

  /// Default wiring for the app.
  static Future<ContentTranslations> create({http.Client? client, HotShardList? hot}) async {
    final support = await getApplicationSupportDirectory();
    return ContentTranslations(ContentPackLoader(
      baseUrl: kContentPackOrigin,
      languages: kPackLanguageCodes,
      fetchPack: httpFetchPack(client ?? http.Client()),
      store: FilePackStore(Directory('${support.path}/content-packs')),
      hot: hot,
    ));
  }

  static ContentTranslations? instance;

  final ContentPackLoader loader;

  /// Incremented when a shard a lookup waited for arrives (`getContentTranslationsVersion`).
  final ValueNotifier<int> version = ValueNotifier<int>(0);

  /// `prepareContentLanguage`: never throws; must not be awaited before the first frame.
  Future<void> prepare(String language) => loader.prepare(normalizeAppLanguage(language));

  /// `getBundledContentTranslation`.
  Object? lookup(Map<String, dynamic> row, String field, String language) => loader.lookup(row, field, normalizeAppLanguage(language));

  /// Call on connectivity regained (web: `online` event).
  void retry() => loader.retry();
}

/// The content translation service. Override in tests / at bootstrap.
final contentTranslationsProvider = Provider<ContentTranslations?>((ref) => ContentTranslations.instance);

/// Re-render signal (`useContentTranslationsVersion`): watch it in widgets that map rows during build.
final contentTranslationsVersionProvider = NotifierProvider<ContentTranslationsVersion, int>(ContentTranslationsVersion.new);

class ContentTranslationsVersion extends Notifier<int> {
  @override
  int build() {
    final service = ref.watch(contentTranslationsProvider);
    if (service == null) return 0;
    void listener() => state = service.version.value;
    service.version.addListener(listener);
    ref.onDispose(() => service.version.removeListener(listener));
    return service.version.value;
  }
}

/// `installContentTranslationRefresh`: coalesces shard arrivals (default 300 ms) into one
/// [onRefresh] call with the current language, so cached query results mapped with the en/ru
/// fallback get refetched. Returns the uninstall function.
void Function() installContentTranslationRefresh(
  ContentTranslations service, {
  required String Function() language,
  required void Function(String language) onRefresh,
  Duration delay = const Duration(milliseconds: 300),
}) {
  Timer? timer;
  final unsubscribe = service.loader.subscribe(() {
    timer?.cancel();
    timer = Timer(delay, () => onRefresh(language()));
  });
  return () {
    timer?.cancel();
    unsubscribe();
  };
}
