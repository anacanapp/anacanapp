// Ported from: (test support - no React counterpart) fakes for the health screens widget tests.
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/health_screens/common/health_ports.dart';
import 'package:anacan/features/health_screens/illness/illness_screen.dart' show illnessOtherParentProvider;
import 'package:anacan/features/partner/partner_ports.dart' show partnerChatSenderProvider;
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/tools/health_common/health_common.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ports.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../../settings/support/harness.dart';

class FakeHealthBackend implements HealthScreensBackend {
  final List<(String, Map<String, dynamic>?)> rpcs = [];
  final Map<String, Object? Function(Map<String, dynamic>? params)> rpcAnswers = {};
  final Map<String, String> profileUsers = {};
  List<Map<String, dynamic>> checkinRows = [];
  final List<Map<String, dynamic>> upserts = [];
  final List<(String, Map<String, dynamic>)> profileUpdates = [];
  final Map<String, List<Map<String, dynamic>>> reportTables = {};
  final List<ReportPageRequest> pages = [];

  List<String> get rpcNames => [for (final r in rpcs) r.$1];

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) async {
    rpcs.add((fn, params));
    final answer = rpcAnswers[fn];
    return answer == null ? null : answer(params);
  }

  @override
  Future<String?> profileUserId(String profileId) async => profileUsers[profileId];

  @override
  Future<List<Map<String, dynamic>>> checkins(String userId, String sinceDay) async => checkinRows;

  @override
  Future<void> upsertCheckin(Map<String, dynamic> row) async => upserts.add(row);

  @override
  Future<void> updateProfile(String userId, Map<String, dynamic> values) async => profileUpdates.add((userId, values));

  @override
  Future<List<Map<String, dynamic>>> reportPage(ReportPageRequest request, int from, int to) async {
    pages.add(request);
    final rows = reportTables[request.table] ?? const [];
    return from >= rows.length ? const [] : rows.sublist(from, to + 1 > rows.length ? rows.length : to + 1);
  }
}

class RecordingAccountActions implements AccountActions {
  int refreshes = 0;
  @override
  Future<void> refreshProfile() async => refreshes++;
  @override
  Future<AuthResult<void>> deleteAccount() => throw UnimplementedError();
  @override
  Future<String> partnerCodeForSharing(String currentCode) async => currentCode;
  @override
  Future<void> signOut() async {}
  @override
  Future<AuthResult<Profile>> updateProfile(Map<String, dynamic> updates) => throw UnimplementedError();
}

/// Everything the screens read, recorded.
class HealthEnv {
  HealthEnv({
    Map<String, dynamic> profile = const {},
    Map<String, Object?> user = const {},
    this.isPremium = false,
    this.children = const [],
    Map<String, String> extra = const {},
  })  : profileRow = profile,
        store = seededStore(user: user, extra: extra);

  final FakeHealthBackend backend = FakeHealthBackend();
  final Map<String, dynamic> profileRow;
  final LocalStore store;
  final bool isPremium;
  final List<Child> children;
  final RecordingAccountActions account = RecordingAccountActions();
  final List<Uri> launched = [];
  final List<String> paywalls = [];
  final List<(String, String, String)> partnerMessages = [];
  final List<(String, bool, String)> sos = [];
  bool hasPartner = false;
  String? otherParentUserId;

  List<Override> get overrides => [
        ...baseOverrides(store: store, profile: testProfile(profileRow)),
        healthScreensBackendProvider.overrideWithValue(backend),
        healthScreensIsPremiumProvider.overrideWithValue(isPremium),
        // The test binding reports en-US, which would start in °F.
        deviceLocaleProvider.overrideWithValue('az-AZ'),
        accountActionsProvider.overrideWithValue(account),
        healthLinkLauncherProvider.overrideWithValue((uri) async => launched.add(uri)),
        healthPaywallProvider.overrideWithValue((context, feature) async => paywalls.add(feature)),
        partnerChatSenderProvider.overrideWithValue((actor, partner, content) async => partnerMessages.add((actor, partner, content))),
        pregnancyHapticsProvider.overrideWithValue(PregnancyHaptics(light: () async {}, medium: () async {}, heavy: () async {})),
        sosAlertPortProvider.overrideWithValue(SosAlertPort(
          hasPartner: hasPartner,
          sendSOS: (message, includeLocation, type) async {
            sos.add((message, includeLocation, type));
            return null;
          },
        )),
        childrenProvider.overrideWithValue(ChildrenView(children: children, selectedChild: children.firstOrNull, loading: false, loadError: false)),
        illnessOtherParentProvider.overrideWithValue((userId: otherParentUserId, babyName: null, babyBirthDate: null)),
      ];
}

/// Pumps a full-height screen (sub-screens scroll themselves).
Future<void> pumpScreen(WidgetTester tester, Widget screen, HealthEnv env, {Size size = const Size(390, 1600)}) async {
  await pumpApp(tester, screen, overrides: env.overrides, scroll: false, size: size);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}
