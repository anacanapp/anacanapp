// Ported from: src/lib/promo.test.ts (+ PromoRedeemer / PromoCodeDialog behaviour)
//
// `promoCodeFromUrl` is ported in app/deep_links.dart (its cases run in test/app); the copy-file case reads the
// generated settings pack (src/data/promo/*.json → feature_copy.g.dart kPromoPack) and the JSON files on disk.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/app/deep_links.dart' show promoCodeFromUrl;
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/promo/promo.dart';
import 'package:anacan/features/commerce/promo/promo_redeemer.dart';
import 'package:anacan/features/settings/copy/feature_copy.dart' as copy show promoText;
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import '../support.dart';

final _dir = Directory('../src/data/promo');
Map<String, dynamic> _json(String file) => jsonDecode(File('${_dir.path}/$file').readAsStringSync()) as Map<String, dynamic>;

void main() {
  group('promo codes', () {
    test('normalizes and validates codes like the server', () {
      expect(normalizePromoCode(' rossmann-2026 '), 'ROSSMANN-2026');
      expect(normalizePromoCode('ab'), isNull);
      expect(normalizePromoCode('-ABC'), isNull);
      expect(normalizePromoCode('A' * 33), isNull);
      expect(normalizePromoCode("X'; drop"), isNull);
    });

    test('reads the code from web, universal and scheme links only on /h/', () {
      expect(promoCodeFromUrl('https://app.anacan.az/h/expo26'), 'EXPO26');
      expect(promoCodeFromUrl('https://app.anacan.az/h/EXPO26/?utm=qr'), 'EXPO26');
      expect(promoCodeFromUrl('anacan://h/EXPO26'), 'EXPO26');
      expect(promoCodeFromUrl('https://app.anacan.az/tool/h/EXPO26'), isNull);
      expect(promoCodeFromUrl('https://app.anacan.az/blog/x'), isNull);
    });

    test('keeps a pending code for 30 days', () {
      final store = LocalStore.memory();
      final now = DateTime.utc(2026, 11, 21);
      expect(savePendingPromo(store, 'expo26', now: now), 'EXPO26');
      expect(readPendingPromo(store, now: now.add(const Duration(days: 29))), 'EXPO26');
      expect(readPendingPromo(store, now: now.add(const Duration(days: 31))), isNull);
      expect(store.containsKey(kPendingPromoKey), false);
      savePendingPromo(store, 'EXPO26');
      clearPendingPromo(store);
      expect(readPendingPromo(store), isNull);
      expect(savePendingPromo(store, 'x'), isNull);
    });

    test('maps function results and errors', () async {
      final answers = <Object>[
        const DbResult<Object?>(data: {'ok': true, 'duration': 'monthly', 'title': 'Expo', 'expires_at': '2026-12-21T00:00:00Z'}),
        const DbResult<Object?>(error: FunctionException(status: 409, details: {'error': 'PROMO_ALREADY_USED'}), status: 409),
        Exception('network'),
      ];
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) {
          final next = answers.removeAt(0);
          if (next is Exception) throw next;
          return next as DbResult<Object?>;
        },
      );
      expect(await redeemPromo(backend, 'EXPO26'), const PromoResult.ok(duration: 'monthly', title: 'Expo', expiresAt: '2026-12-21T00:00:00Z'));
      expect(await redeemPromo(backend, 'EXPO26'), const PromoResult.failed('PROMO_ALREADY_USED'));
      expect(await redeemPromo(backend, 'EXPO26'), const PromoResult.failed('grant_failed'));
      expect(promoErrorCode({'message': 'x PROMO_NOT_NEW_USER y'}), 'PROMO_NOT_NEW_USER');
    });

    test('reads the public campaign card in the server shape', () async {
      final answers = <Object?>[
        {'state': 'not_found'},
        {'state': 'active', 'code': 'EXPO26', 'title': 'Expo', 'duration': 'monthly', 'eligibility': 'new_users', 'ends_at': null},
        null,
      ];
      final backend = FakeCommerceBackend(onRpc: (_, _) => DbResult<Object?>(data: answers.removeAt(0)));
      expect((await fetchPromoCampaign(backend, 'NOPE-1')).state, 'not_found');
      expect((await fetchPromoCampaign(backend, 'EXPO26')).state, 'active');
      expect((await fetchPromoCampaign(backend, 'X-1')).state, 'not_found');
    });

    test('retries only failures that can change', () {
      expect(promoFinalErrors.contains('grant_failed'), false);
      expect(promoFinalErrors.contains('PROMO_IN_PROGRESS'), false);
      expect(promoFinalErrors.contains('PROMO_NOT_STARTED'), false);
      expect(promoFinalErrors.contains('PROMO_ALREADY_USED'), true);
    });

    test('has copy for every duration and error', () {
      final az = copy.promoText('az');
      for (final d in promoDurations) {
        expect(promoDurationLabel(az, d), isNot(d));
      }
      for (final code in [
        'PROMO_ALREADY_USED',
        'PROMO_NOT_NEW_USER',
        'PROMO_FULL',
        'PROMO_EXPIRED',
        'PROMO_NOT_FOUND',
        'premium_store_subscription_active',
        'grant_failed',
      ]) {
        expect(promoErrorText(az, code), isNotEmpty);
      }
    });
  });

  group('promo copy files', () {
    test('ships all 25 app languages with the same keys and placeholders', () {
      final files = _dir.listSync().whereType<File>().where((f) => f.path.endsWith('.json')).map((f) => f.uri.pathSegments.last).toList();
      expect(files, hasLength(25));
      final az = _json('az.json');
      final keys = az.keys.toList()..sort();
      List<String> ph(String s) => RegExp(r'\{\w+\}').allMatches(s).map((m) => m[0]!).toList()..sort();
      for (final file in files) {
        final text = _json(file);
        expect(text.keys.toList()..sort(), keys, reason: file);
        for (final key in keys) {
          expect((text[key] as String).trim(), isNot(''), reason: '$file:$key');
          expect(ph(text[key] as String), ph(az[key] as String), reason: '$file:$key');
        }
      }
    });
  });

  group('PromoRedeemer', () {
    screenTest('grants a saved code once signed in and drops it', (tester) async {
      final backend = FakeCommerceBackend(onInvoke: (_, _) => const DbResult<Object?>(data: {'ok': true, 'duration': 'monthly'}));
      final store = LocalStore.memory();
      savePendingPromo(store, 'EXPO26');
      await pumpApp(tester, const PromoRedeemer(), overrides: commerceOverrides(backend, store: store));
      await tester.pumpAndSettle();
      expect(backend.invokeCalls.single.$1, 'promo-redeem');
      expect(backend.invokeCalls.single.$2, {'code': 'EXPO26'});
      expect(readPendingPromo(store), isNull);
      expect(find.text('Premium aktivdir: 1 ay hədiyyə!'), findsOneWidget);
    });

    screenTest('keeps the code after a failure that can change', (tester) async {
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) => const DbResult<Object?>(error: FunctionException(status: 500, details: {'error': 'grant_failed'}), status: 500),
      );
      final store = LocalStore.memory();
      savePendingPromo(store, 'EXPO26');
      await pumpApp(tester, const PromoRedeemer(), overrides: commerceOverrides(backend, store: store));
      await tester.pumpAndSettle();
      expect(readPendingPromo(store), 'EXPO26');
    });

    screenTest('the profile dialog applies a typed code', (tester) async {
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) => const DbResult<Object?>(error: FunctionException(status: 409, details: {'error': 'PROMO_FULL'}), status: 409),
      );
      await pumpApp(
        tester,
        Builder(
          builder: (context) => GestureDetector(onTap: () => showPromoCodeDialog(context), child: const Text('open')),
        ),
        overrides: commerceOverrides(backend),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Hədiyyə kodu'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('promo-code-input')), 'expo-26');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('promo-apply')));
      await tester.pumpAndSettle();
      expect(backend.invokeCalls.single.$2, {'code': 'EXPO-26'});
      expect(find.text('Bu kampaniyanın hədiyyələri bitib.'), findsOneWidget);
    });
  });
}
