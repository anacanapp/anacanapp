// Ported from: src/components/ProfileEditScreen.tsx (save payload rules — no vitest suite; cases for the port)
import 'dart:typed_data';

import 'package:anacan/features/profile/data/children.dart';
import 'package:anacan/features/profile/profile_edit_screen.dart';
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/profile/profile_screen.dart' show profileAvatarBuilderProvider;
import 'package:anacan/core/auth/auth.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';
import 'profile_screen_test.dart' show FakeChildren;

Map<String, dynamic> form({String stage = 'bump', String lmp = '', String due = '', String multiples = 'single', String chorion = '', String birth = '', String gender = ''}) => {
      'name': 'Leyla',
      'avatar_url': '',
      'bio': '',
      'life_stage': stage,
      'baby_name': '',
      'cycle_length': 28,
      'country_code': 'AZ',
      'last_period_date': lmp,
      'due_date': due,
      'multiples_type': multiples,
      'chorionicity': chorion,
      'baby_birth_date': birth,
      'baby_gender': gender,
    };

class FakeEditRepo implements ProfileEditRepository {
  final updates = <Map<String, dynamic>>[];
  @override
  Future<String?> loadBio(String userId) async => 'Hello';
  @override
  Future<void> updateProfileRow(String userId, Map<String, dynamic> data) async => updates.add(data);
  @override
  Future<String> uploadAvatar(String path, Uint8List bytes, String contentType) async => 'https://cdn/$path';
}

class FakeActions implements AccountActions {
  final profileUpdates = <Map<String, dynamic>>[];
  @override
  Future<AuthResult<void>> deleteAccount() async => const AuthResult();
  @override
  Future<String> partnerCodeForSharing(String currentCode) async => currentCode;
  @override
  Future<void> refreshProfile() async {}
  @override
  Future<void> signOut() async {}
  @override
  Future<AuthResult<Profile>> updateProfile(Map<String, dynamic> updates) async {
    profileUpdates.add(updates);
    return const AuthResult();
  }
}

void main() {
  setUpAll(loadAnacanFonts);

  group('buildProfileUpdate', () {
    test('LMP mode on a new bump stage writes both dates (due = LMP + 280)', () {
      final u = buildProfileUpdate(form: form(lmp: '2026-03-01'), mode: DateInputMode.lmp, profileRow: {'life_stage': 'flow'});
      expect(u['last_period_date'], '2026-03-01');
      expect(u['due_date'], '2026-12-06');
      expect(u['baby_count'], 1);
      expect(u['chorionicity'], isNull);
    });

    test('a plain edit with unchanged dates does not touch them', () {
      final u = buildProfileUpdate(form: form(lmp: '2026-03-01'), mode: DateInputMode.lmp, profileRow: {'life_stage': 'bump', 'last_period_date': '2026-03-01', 'due_date': '2026-12-06'});
      expect(u.containsKey('last_period_date'), isFalse);
      expect(u.containsKey('due_date'), isFalse);
    });

    test('due-date mode recomputes the LMP only when the due date was touched', () {
      final row = {'life_stage': 'bump', 'last_period_date': '2026-03-03', 'due_date': '2026-12-06'};
      // dueDate unchanged but the derived LMP differs from the stored (user-entered) LMP: keep the stored dates.
      expect(buildProfileUpdate(form: form(due: '2026-12-06'), mode: DateInputMode.dueDate, profileRow: row).containsKey('last_period_date'), isFalse);
      final u = buildProfileUpdate(form: form(due: '2026-12-10'), mode: DateInputMode.dueDate, profileRow: row);
      expect(u['due_date'], '2026-12-10');
      expect(u['last_period_date'], '2026-03-05');
    });

    test('twins set baby_count 2 and keep the chorionicity', () {
      final u = buildProfileUpdate(form: form(multiples: 'twins', chorion: 'dichorionic'), mode: DateInputMode.lmp, profileRow: {'life_stage': 'bump'});
      expect(u['baby_count'], 2);
      expect(u['chorionicity'], 'dichorionic');
    });

    test('switching to mommy clears the pregnancy dates and writes the baby fields', () {
      final u = buildProfileUpdate(form: form(stage: 'mommy', birth: '2026-05-01', gender: 'girl'), mode: DateInputMode.lmp, profileRow: {'life_stage': 'bump', 'loss_recovery_active': true});
      expect(u['last_period_date'], isNull);
      expect(u.containsKey('last_period_date'), isTrue);
      expect(u['due_date'], isNull);
      expect(u['baby_birth_date'], '2026-05-01');
      expect(u['baby_gender'], 'girl');
      expect(u['loss_recovery_active'], false);
    });

    test('flow keeps loss recovery and writes the LMP when changed', () {
      final u = buildProfileUpdate(form: form(stage: 'flow', lmp: '2026-10-01'), mode: DateInputMode.lmp, profileRow: {'life_stage': 'flow', 'loss_recovery_active': true});
      expect(u.containsKey('loss_recovery_active'), isFalse);
      expect(u['last_period_date'], '2026-10-01');
      expect(u['due_date'], isNull);
    });
  });

  screenTest('saves through the repository, syncs the store and goes back', (tester) async {
    final repo = FakeEditRepo();
    final actions = FakeActions();
    var back = 0;
    await pumpApp(
      tester,
      ProfileEditScreen(onBack: () => back++),
      scroll: false,
      overrides: [
        ...baseOverrides(store: seededStore(user: {'lifeStage': 'flow'}), profile: testProfile({'life_stage': 'flow'})),
        profileEditRepositoryProvider.overrideWithValue(repo),
        accountActionsProvider.overrideWithValue(actions),
        babyRepositoryProvider.overrideWithValue(FakeChildren()),
        profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
      ],
    );
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey<String>('edit-name')), 'Aysel');
    await tester.tap(find.byKey(const ValueKey<String>('edit-save')));
    await tester.pumpAndSettle();
    expect(repo.updates.single['name'], 'Aysel');
    expect(repo.updates.single['bio'], 'Hello');
    expect(actions.profileUpdates.single, {'name': 'Aysel'});
    expect(back, 1);
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      screenTest('edit profile bump ${dark ? 'dark' : 'light'}', (tester) async {
        await pumpApp(
          tester,
          ProfileEditScreen(onBack: () {}),
          scroll: false,
          dark: dark,
          overrides: [
            ...baseOverrides(store: seededStore(user: {'lifeStage': 'bump', 'lastPeriodDate': '2026-05-01T00:00:00.000Z'}), profile: testProfile({'life_stage': 'bump'})),
            profileEditRepositoryProvider.overrideWithValue(FakeEditRepo()),
            babyRepositoryProvider.overrideWithValue(FakeChildren()),
            profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
          ],
        );
        await expectGolden(tester, 'edit_profile_${dark ? 'dark' : 'light'}');
      });
    }
  });
}
