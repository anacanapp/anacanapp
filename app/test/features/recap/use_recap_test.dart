// Ported from: src/hooks/useRecap.ts, src/components/recap/RecapEntry.tsx (useRecapProfileRow) — no vitest file;
//              cases follow the hook's documented behaviour.
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/home/dashboard/recap_home_card.dart' show recapHomeYearQuery;
import 'package:anacan/features/profile/profile_interfaces.dart' show recapProfileRowProvider;
import 'package:anacan/features/recap/use_recap.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';
import 'support/recap_fixtures.dart';
import 'support/recap_harness.dart';

Map<String, Object?> rawAvailable() => {...recapFixtureData('mommy'), 'available': true};

Future<ProviderContainer> start(WidgetTester tester, FakeRecapRepository repo, {bool signedIn = true, List<Override> extra = const []}) async {
  installTestI18n();
  final c = ProviderContainer(overrides: [...recapOverrides(repo: repo, signedIn: signedIn), ...extra]);
  addTearDown(c.dispose);
  c.listen(recapProvider(recapYear), (_, _) {});
  for (var i = 0; i < 5; i++) {
    await tester.pump();
  }
  return c;
}

void main() {
  testWidgets('available: recap is set, cached under [anacan-recap, backend url, uid, year]', (tester) async {
    final repo = FakeRecapRepository(raw: rawAvailable());
    final c = await start(tester, repo);
    final s = c.read(recapProvider(recapYear));
    expect(repo.calls, [2026]);
    expect(s.recap?['available'], isTrue);
    expect(s.recap?['name'], 'Aynur');
    expect(s.isLoading, isFalse);
    final cached = c.read(queryClientProvider).getQueryData<Map<String, Object?>>(['anacan-recap', 'https://api.test', 'user-1', 2026]);
    expect(cached?['year'], 2026);
  });

  testWidgets('not available yet: result is kept, recap stays null', (tester) async {
    final repo = FakeRecapRepository(raw: {'available': false, 'reason': 'not_open', 'opens_at': '2026-12-10T00:00:00+04:00'});
    final c = await start(tester, repo);
    final s = c.read(recapProvider(recapYear));
    expect(s.recap, isNull);
    expect(s.result, {'available': false, 'reason': 'not_open', 'opens_at': '2026-12-10T00:00:00+04:00'});
  });

  testWidgets('RPC not deployed on this backend: hidden (reason missing), no error', (tester) async {
    final repo = FakeRecapRepository(error: missingRpc());
    final c = await start(tester, repo);
    final s = c.read(recapProvider(recapYear));
    expect(s.result, {'available': false, 'reason': 'missing', 'opens_at': null});
    expect(s.isError, isFalse);
  });

  testWidgets('other errors: retried once, then isError', (tester) async {
    final repo = FakeRecapRepository(error: StateError('boom'));
    final c = await start(tester, repo);
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    final s = c.read(recapProvider(recapYear));
    expect(repo.calls, [2026, 2026]);
    expect(s.isError, isTrue);
    expect(s.recap, isNull);
  });

  testWidgets('signed out: nothing is fetched', (tester) async {
    final repo = FakeRecapRepository(raw: rawAvailable());
    final c = await start(tester, repo, signedIn: false);
    final s = c.read(recapProvider(recapYear));
    expect(repo.calls, isEmpty);
    expect(s.result, isNull);
    expect(s.isLoading, isFalse);
  });

  testWidgets('profile row: "Anacan Recap 2026" with the sub line while available', (tester) async {
    final c = await start(tester, FakeRecapRepository(raw: rawAvailable()));
    c.listen(recapProfileRowFromRecapProvider, (_, _) {});
    final row = c.read(recapProfileRowFromRecapProvider);
    expect(row?.id, 'recap');
    expect(row?.label, 'Anacan Recap 2026');
    expect(row?.sub, 'Sənin ilin bir videoda');

    final hidden = await start(tester, FakeRecapRepository(raw: {'available': false}));
    hidden.listen(recapProfileRowFromRecapProvider, (_, _) {});
    expect(hidden.read(recapProfileRowFromRecapProvider), isNull);
  });

  testWidgets('profile interface: recapProfileRowProvider wired to the recap row', (tester) async {
    final c = await start(tester, FakeRecapRepository(raw: rawAvailable()),
        extra: [recapProfileRowProvider.overrideWith((ref) => ref.watch(recapProfileRowFromRecapProvider))]);
    c.listen(recapProfileRowProvider, (_, _) {});
    await tester.pump();
    expect(c.read(recapProfileRowProvider)?.label, 'Anacan Recap 2026');
  });

  testWidgets('home card year: RecapHomeYearNotifier replaces the home query with useRecap', (tester) async {
    final c = await start(tester, FakeRecapRepository(raw: rawAvailable()), extra: [recapHomeYearQuery.overrideWith(RecapHomeYearNotifier.new)]);
    c.listen(recapHomeYearQuery, (_, _) {});
    expect(c.read(recapHomeYearQuery).data, 2026);
    expect(c.read(recapHomeYearQuery).isSuccess, isTrue);
  });
}
