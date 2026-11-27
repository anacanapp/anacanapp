// Ported from: (no React suite) src/lib/premium-sponsor.ts, src/components/premium/SponsorEntry.tsx and
// SponsorSheet.tsx: language-scoped pay link, flag-gated entry, spouse link with the partner message.
import 'package:anacan/core/data/app_settings.dart' show appSettingProvider;
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/sponsor/premium_sponsor.dart';
import 'package:anacan/features/commerce/sponsor/sponsor_sheet.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

void main() {
  test('builds the pay link in the requester language (unknown → az)', () {
    expect(sponsorUrl('tok', 'ru'), 'https://anacan.az/ru/p/?t=tok');
    expect(sponsorUrl('tok', 'xx'), 'https://anacan.az/az/p/?t=tok');
    expect(sponsorLang('uk'), 'uk');
  });

  test('creates the link through create_premium_sponsor_link_v1 and fails without a token', () async {
    final answers = <Object?>[
      [
        {'token': 'abc', 'expires_at': '2026-12-01T00:00:00Z', 'kind': 'partner'},
      ],
      <Object?>[],
    ];
    final backend = FakeCommerceBackend(onRpc: (_, _) => DbResult<Object?>(data: answers.removeAt(0)));
    final link = await createSponsorLink(backend, 'partner', 'spouse', 'az');
    expect(link.url, 'https://anacan.az/az/p/?t=abc');
    expect(backend.rpcCalls.single.$2, {'p_kind': 'partner', 'p_relation': 'spouse', 'p_language': 'az'});
    expect(() => createSponsorLink(backend, 'gift', 'mother', 'az'), throwsA(isA<StateError>()));
  });

  screenTest('the entry stays hidden unless premium_sponsor is enabled', (tester) async {
    await pumpApp(
      tester,
      SponsorEntry(onSelf: () {}),
      overrides: commerceOverrides(FakeCommerceBackend(), extra: [appSettingProvider('premium_sponsor').overrideWithValue(null)]),
    );
    await tester.pump();
    expect(find.byKey(const ValueKey('sponsor-entry')), findsNothing);
  });

  screenTest('spouse: mints a partner link and prefills the partner message', (tester) async {
    final backend = FakeCommerceBackend(onRpc: (_, _) => const DbResult<Object?>(data: {'token': 'abc', 'kind': 'partner'}));
    var self = 0;
    await pumpApp(
      tester,
      SponsorEntry(onSelf: () => self++),
      overrides: commerceOverrides(
        backend,
        extra: [
          appSettingProvider('premium_sponsor').overrideWithValue({'enabled': true}),
        ],
      ),
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('sponsor-entry')));
    await tester.pumpAndSettle();
    expect(find.text('Premium-u kim ödəyəcək?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('sponsor-spouse')));
    await tester.pumpAndSettle();
    expect(backend.rpcCalls.single.$2!['p_kind'], 'partner');
    expect(find.text('https://anacan.az/az/p/?t=abc'), findsOneWidget);
    expect(find.textContaining('partnyor rejimində'), findsOneWidget);
    expect(self, 0);
  });
}
