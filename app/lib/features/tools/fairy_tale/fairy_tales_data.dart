// Ported from: src/hooks/useFairyTales.ts
//
// The user's tales (`fairy_tales`), the active themes, and the generate / favourite / play-count / delete actions.
// Generation is a plain JSON POST to `generate-fairy-tale` (the function answers `{ success, title, content, … }`,
// it does not stream) through the AI chat's backend, session-token and HTTP client providers.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../state/user_store.dart';
import '../../ai_chat/ai_chat_inputs.dart' show aiChatAccessTokenProvider, aiChatBackendProvider, aiChatHttpClientProvider;
import '../health_common/health_db.dart' show HQuery, eqF;
import '../media_common/media_ports.dart';

/// `useFairyTales()` → `['fairy-tales', userId]` (newest first; disabled signed out).
final fairyTalesQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(mediaAuthUserIdProvider);
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['fairy-tales', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => userId == null
        ? <Map<String, dynamic>>[]
        : await db.select(HQuery('fairy_tales', filters: [eqF('user_id', userId)], order: const [(column: 'created_at', ascending: false)])),
  );
}, name: 'fairyTalesQuery');

/// `useFairyTaleThemes()` → `['fairy-tale-themes', language]` (30 min; name / description translated).
final fairyTaleThemesQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['fairy-tale-themes', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('fairy_tale_themes', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['name', 'description'],
    ),
  );
}, name: 'fairyTaleThemesQuery');

/// A failed generation (`new Error(message)`); [message] is what the toast shows.
class FairyTaleError implements Exception {
  const FairyTaleError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// The `fetch(`${backend}/functions/v1/generate-fairy-tale`)` call: the JSON answer, or a [FairyTaleError] with the
/// server's `error` (`'Failed to generate story'` without one).
final fairyTaleRequestProvider = Provider<Future<Map<String, dynamic>> Function(Map<String, Object?> body)>(
  (ref) => (body) async {
    final token = await ref.read(aiChatAccessTokenProvider)();
    if (token == null) throw FairyTaleError(tr('usefairytales_sessiya_tapilmadi_2d6594', 'Sessiya tapılmadı'));
    final backend = ref.read(aiChatBackendProvider);
    if (backend == null) throw const FairyTaleError('Backend is not configured');
    final response = await ref
        .read(aiChatHttpClientProvider)
        .post(
          Uri.parse('${backend.url}/functions/v1/generate-fairy-tale'),
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
          body: jsonEncode(body),
        );
    Object? data;
    try {
      data = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = data is Map && data['error'] is String && (data['error'] as String).isNotEmpty ? data['error'] as String : 'Failed to generate story';
      throw FairyTaleError(message);
    }
    if (data is! Map) throw const FairyTaleError('Failed to generate story');
    return Map<String, dynamic>.from(data);
  },
);

/// The generation parameters (`useGenerateFairyTale().mutateAsync(params)`).
class FairyTaleParams {
  const FairyTaleParams({required this.childName, this.theme, this.hero, this.moralLesson, this.language, this.ageRange, this.storyStyle, this.customPrompt});
  final String childName;
  final String? theme;
  final String? hero;
  final String? moralLesson;
  final String? language;
  final String? ageRange;
  final String? storyStyle;
  final String? customPrompt;
}

class FairyTaleActions {
  FairyTaleActions(this.ref);
  final Ref ref;

  MediaDb get _db => ref.read(mediaDbProvider);

  void _invalidate() => ref.read(queryClientProvider).invalidateQueries(queryKey: ['fairy-tales']);

  /// `useGenerateFairyTale`: generate, store the tale, refresh the list. Throws (the caller toasts).
  Future<Map<String, dynamic>> generate(FairyTaleParams p) async {
    final userId = ref.read(mediaAuthUserIdProvider);
    if (userId == null) throw const FairyTaleError('User not authenticated');
    final result = await ref.read(fairyTaleRequestProvider)({
      'childName': p.childName,
      'theme': ?p.theme,
      'hero': ?p.hero,
      'moralLesson': ?p.moralLesson,
      'language': (p.language?.isNotEmpty ?? false)
          ? p.language
          : (ref.read(userStoreProvider).language.isNotEmpty ? ref.read(userStoreProvider).language : 'az'),
      'ageRange': ?p.ageRange,
      'storyStyle': ?p.storyStyle,
      'customPrompt': ?p.customPrompt,
    });
    final row = await _db.insert('fairy_tales', {
      'user_id': userId,
      'title': result['title'],
      'content': result['content'],
      'child_name': p.childName,
      'theme': p.theme,
      'hero': p.hero,
      'moral_lesson': p.moralLesson,
    });
    _invalidate();
    return row;
  }

  /// `useToggleFavorite`.
  Future<void> toggleFavorite(String id, bool isFavorite) async {
    await _db.update('fairy_tales', {'is_favorite': isFavorite}, [eqF('id', id)]);
    _invalidate();
  }

  /// `useIncrementPlayCount`.
  Future<void> incrementPlayCount(String id) async {
    final rows = await _db.select(HQuery('fairy_tales', columns: 'play_count', filters: [eqF('id', id)]));
    final current = rows.isEmpty ? 0 : (rows.first['play_count'] as num? ?? 0);
    await _db.update('fairy_tales', {'play_count': current + 1}, [eqF('id', id)]);
    _invalidate();
  }

  /// `useDeleteFairyTale`.
  Future<void> delete(String id) async {
    await _db.delete('fairy_tales', [eqF('id', id)]);
    _invalidate();
  }
}

final fairyTaleActionsProvider = Provider<FairyTaleActions>(FairyTaleActions.new);

/// `getReadingTime(content)`: words / 150, rounded up.
int fairyTaleReadingTime(String content) => (content.split(RegExp(r'\s+')).length / 150).ceil();
