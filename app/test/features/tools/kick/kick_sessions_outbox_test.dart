// Ported from: src/hooks/useBabyLogs.outbox.test.tsx ('useKickSessions with the offline outbox')
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/features/tools/kick/kick_sessions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../pregnancy_common/pregnancy_harness.dart';

class ServerKickRepository implements KickRepository {
  ServerKickRepository(this.server);
  final FakeOutboxServer server;

  @override
  Future<List<Map<String, dynamic>>> loadSessions(String userId) async {
    if (!server.online) throw StateError('TypeError: Failed to fetch');
    final rows = server.table('kick_sessions')..sort((a, b) => '${b['created_at']}'.compareTo('${a['created_at']}'));
    return rows;
  }

  @override
  void watch(Ref ref, String userId, void Function() onChange) {}
}

typedef Toast = ({String title, String? description, bool destructive});

void main() {
  late PregnancyEnv env;
  late ProviderContainer container;
  late List<Toast> toasts;

  void toast({required String title, String? description, bool destructive = false}) =>
      toasts.add((title: title, description: description, destructive: destructive));

  setUp(() async {
    installTestI18n();
    env = PregnancyEnv();
    toasts = [];
    container = ProviderContainer(overrides: [
      ...env.overrides,
      kickRepositoryProvider.overrideWithValue(ServerKickRepository(env.server)),
    ]);
    container.listen(kickSessionsProvider, (_, _) {});
    await Future<void>.delayed(Duration.zero);
  });

  tearDown(() => container.dispose());

  Future<void> waitFor(bool Function() condition) async {
    for (var i = 0; i < 50 && !condition(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    expect(condition(), isTrue);
  }

  group('useKickSessions with the offline outbox', () {
    test('shows the queued toast offline and keeps the session visible as pending', () async {
      await waitFor(() => !container.read(kickSessionsProvider).loading);
      env.server.online = false;
      env.connectivity.setOnline(false);
      final res = await container.read(kickSessionsActionsProvider).addSession(4, 120, startedAt: DateTime.now().millisecondsSinceEpoch, toast: toast);
      expect(res?.status, SaveStatus.queued);
      expect(toasts.single.title, 'Saxlanıldı, internet gələndə göndəriləcək');
      await waitFor(() => container.read(kickSessionsProvider).todayStats.totalKicks == 4);
      expect(container.read(kickSessionsProvider).sessions[0].pending, isTrue);
    });

    test('shows an error toast on a real rejection and a success toast only when confirmed', () async {
      await waitFor(() => !container.read(kickSessionsProvider).loading);
      env.server.reject = true;
      var res = await container.read(kickSessionsActionsProvider).addSession(2, 60, toast: toast);
      expect(res?.status, SaveStatus.error);
      expect(toasts.last.destructive, isTrue);
      expect(env.outbox.readOutbox('u1'), isEmpty);

      env.server.reject = false;
      toasts.clear();
      res = await container.read(kickSessionsActionsProvider).addSession(2, 60, quiet: true, toast: toast);
      expect(res?.status, SaveStatus.saved);
      expect(toasts, isEmpty);
    });
  });
}
