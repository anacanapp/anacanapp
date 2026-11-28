// Ported from: src/hooks/useGameScores.test.tsx
import 'package:anacan/core/auth/auth_providers.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/games/hub/data/game_score_sync.dart';
import 'package:anacan/features/games/hub/data/game_scores.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show User;

User _user(String id) => User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

class _Value<T> extends Notifier<T> {
  _Value(this.initial);
  final T initial;
  @override
  T build() => initial;
  void set(T value) => state = value;
}

final _userFixture = NotifierProvider<_Value<User?>, User?>(() => _Value<User?>(null));
final _loadingFixture = NotifierProvider<_Value<bool>, bool>(() => _Value<bool>(false));
final _realmFixture = NotifierProvider<_Value<String>, String>(() => _Value<String>('source'));

class _Backend implements GameScoresBackend {
  List<Map<String, dynamic>> rows = [
    {'user_id': 'player', 'best_score': 42, 'best_level': 2},
  ];
  Future<Map<String, Map<String, dynamic>>> Function(List<String> ids)? cards;
  int cardCalls = 0;

  @override
  Future<List<Map<String, dynamic>>> leaderboardRows(String gameId, int limit) async => rows;
  @override
  Future<Map<String, dynamic>?> myScore(String gameId, String userId) async => null;
  @override
  Future<Map<String, Map<String, dynamic>>> profileCards(List<String> userIds) {
    cardCalls++;
    return cards!(userIds);
  }

  @override
  GameScoreClient get client => throw UnimplementedError();
}

void main() {
  late _Backend backend;
  late ProviderContainer container;
  setUp(() {
    backend = _Backend();
    container = ProviderContainer(overrides: [
      queryClientProvider.overrideWithValue(QueryClient()),
      authUserProvider.overrideWith((ref) => ref.watch(_userFixture)),
      gameAuthLoadingProvider.overrideWith((ref) => ref.watch(_loadingFixture)),
      gameRealmProvider.overrideWith((ref) => ref.watch(_realmFixture)),
      gameScoresBackendProvider.overrideWithValue(backend),
    ]);
  });
  tearDown(() => container.dispose());

  Future<void> until(bool Function() done) async {
    for (var i = 0; i < 100 && !done(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
    expect(done(), isTrue);
  }

  final board = gameLeaderboardQuery((gameId: 'color-sort', limit: 20));

  group('authenticated, realm-bound game leaderboard', () {
    test('waits for authentication instead of caching anonymous generic names', () async {
      container.read(_loadingFixture.notifier).set(true);
      final sub = container.listen(board, (_, _) {});
      expect(sub.read().fetchStatus, FetchStatus.idle);
      expect(backend.cardCalls, 0);
      backend.cards = (_) async => {'player': {'name': 'Aysel', 'avatar_url': null}};
      container.read(_loadingFixture.notifier).set(false);
      container.read(_userFixture.notifier).set(_user('account-a'));
      await until(() => container.read(board).data?.first.name == 'Aysel');
      sub.close();
    });

    test('refetches when an account or backend changes', () async {
      container.read(_userFixture.notifier).set(_user('account-a'));
      backend.cards = (_) async => {'player': {'name': 'Aysel', 'avatar_url': null}};
      final sub = container.listen(board, (_, _) {});
      await until(() => container.read(board).data?.first.name == 'Aysel');
      backend.cards = (_) async => {'player': {'name': 'Leyla', 'avatar_url': null}};
      container.read(_userFixture.notifier).set(_user('account-b'));
      await until(() => container.read(board).data?.first.name == 'Leyla');
      backend.cards = (_) async => {'player': {'name': 'Nigar', 'avatar_url': null}};
      container.read(_realmFixture.notifier).set('azure');
      await until(() => container.read(board).data?.first.name == 'Nigar');
      expect(backend.cardCalls, 3);
      sub.close();
    });

    test('surfaces a failed profile query instead of substituting everyone with a fallback name', () async {
      container.read(_userFixture.notifier).set(_user('account-a'));
      backend.cards = (_) async => throw StateError('read failed');
      final sub = container.listen(board, (_, _) {});
      await until(() => container.read(board).isError);
      expect(container.read(board).data, isNull);
      sub.close();
    });
  });
}
