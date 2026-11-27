// Ported from: src/pages/Index.tsx (gate inputs fed by useAuth/useUserStore, e-mail gate, pending funnel flag)

import 'package:anacan/core/net/backend_providers.dart';
import 'package:anacan/shell/gates/gate_sequence.dart';
import 'package:anacan/shell/shell_inputs.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth/support.dart';

void main() {
  test('shell user, gate inputs and gate actions come from auth + user store', () async {
    final backend = FakeBackend();
    final h = AuthHarness(extraOverrides: [
      backendUrlProvider.overrideWithValue(''),
      supabaseClientProvider.overrideWithValue(backend.client),
    ])..start();
    addTearDown(h.dispose);
    h.backend.tables['profiles'] = [
      {'id': 'p', 'user_id': 'user-a', 'name': 'Leyla', 'life_stage': 'mommy', 'country_code': 'AZ', 'baby_count': 1},
    ];
    final c = h.container;
    await h.emit(AuthChangeEvent.signedIn, fakeSession('t', fakeUser('user-a')));
    final user = c.read(shellUserFromStateProvider);
    expect(user.isAuthenticated, isTrue);
    expect(user.userId, 'user-a');
    expect(user.lifeStage, 'mommy');
    expect(user.profileCountryCode, 'AZ');
    final sub = c.listen(gateInputsFromStateProvider, (_, _) {});
    await h.settle();
    final inputs = c.read(gateInputsFromStateProvider);
    expect(inputs.hasUser, isTrue);
    expect(inputs.isOnboarded, isTrue);
    expect(inputs.profileLoaded, isTrue);
    expect(inputs.fullBlock, isFalse);
    expect(inputs.emailGate, isA<EmailGateDecided>()); // onboarded: never asked
    expect(inputs.needsName, isFalse);
    sub.close();

    UserStoreGateActions(c.read(userStoreProvider.notifier)).setFunnelCompleted(false);
    expect(c.read(userStoreProvider).hasCompletedFunnel, isFalse);
    h.store.setItem('anacan_pending_funnel', '{"userId":"user-a","backend":""}');
    expect(c.read(legacyFunnelFlagMatchesProvider), isTrue);
    expect(shellStateOverrides(), hasLength(6));
    expect(BottomNavStyle.classic, isNotNull);
  });
}
