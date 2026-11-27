// Ported from: src/components/shop/AlbumOrderScreen.tsx, src/hooks/useCoupons.ts, src/hooks/usePaymentMethods.ts
//              (behaviour checks; React has no vitest for these)
import 'dart:typed_data';

import 'package:anacan/core/data/data.dart';
import 'package:anacan/features/album_order/album_order_backend.dart';
import 'package:anacan/features/album_order/album_order_screen.dart';
import 'package:anacan/features/album_order/coupons.dart';
import 'package:flutter/widgets.dart' hide Row;
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

class FakeAlbumBackend implements AlbumOrderBackend {
  Rows methods = [
    {'id': 'm1', 'method_key': 'cash', 'label': 'Nağd', 'description': 'Çatdırılmada', 'icon': 'Wallet', 'is_active': true, 'sort_order': 1},
    {'id': 'm2', 'method_key': 'c2c_transfer', 'label': 'Kartdan karta', 'description': null, 'icon': null, 'is_active': true, 'sort_order': 2},
    {'id': 'm3', 'method_key': 'old', 'label': 'Köhnə', 'is_active': false, 'sort_order': 3},
  ];
  Map<String, Row> coupons = {};
  Set<String> used = {};
  final List<Map<String, dynamic>> orders = [];
  final List<String> uploads = [];
  final List<String> usage = [];
  bool failInsert = false;

  @override
  Future<Rows> activePaymentMethods() async => methods;
  @override
  Future<Row?> activeCoupon(String code) async => coupons[code.trim().toUpperCase()];
  @override
  Future<bool> couponUsedBy(String couponId, String userId) async => used.contains(couponId);
  @override
  Future<void> recordCouponUsage({required String couponId, required String userId, required String orderType, String? orderId, required double discountAmount}) async =>
      usage.add('$couponId:$orderType:$discountAmount');
  @override
  Future<String?> uploadProof(String path, Uint8List bytes, {String? contentType}) async {
    uploads.add(path);
    return 'https://cdn.example/$path';
  }

  @override
  Future<void> insertAlbumOrder(Map<String, dynamic> row) async {
    if (failInsert) throw StateError('insert failed');
    orders.add(row);
  }
}

Row _coupon(String code, {String type = 'fixed', num value = 5, num min = 0, int? maxUses, int usedCount = 0, List<String> applicable = const ['album', 'shop'], String? expires, String starts = '2026-01-01T00:00:00Z'}) => {
      'id': 'c-$code', 'code': code, 'discount_type': type, 'discount_value': value, 'min_order_amount': min, 'max_uses': maxUses, 'used_count': usedCount,
      'applicable_to': applicable, 'is_active': true, 'starts_at': starts, 'expires_at': expires,
    };

void main() {
  setUpAll(loadAnacanFonts);

  group('useCouponValidator', () {
    late FakeAlbumBackend backend;
    late List<String> toasts;
    CouponValidator validator({String? user = 'user-1', String type = 'album'}) => CouponValidator(
          backend: backend,
          userId: user,
          orderType: type,
          now: () => DateTime.utc(2026, 6, 1),
          toast: ({required title, description, destructive = false}) => toasts.add('${destructive ? '!' : ''}$title${description == null ? '' : ' | $description'}'),
        );
    setUp(() {
      backend = FakeAlbumBackend();
      toasts = [];
    });

    test('rejects missing, other-type, expired, future, exhausted, below-minimum and already used coupons', () async {
      backend.coupons = {
        'SHOP': _coupon('SHOP', applicable: ['shop']),
        'OLD': _coupon('OLD', expires: '2026-05-01T00:00:00Z'),
        'SOON': _coupon('SOON', starts: '2026-07-01T00:00:00Z'),
        'FULL': _coupon('FULL', maxUses: 3, usedCount: 3),
        'MIN': _coupon('MIN', min: 20),
        'USED': _coupon('USED'),
      };
      backend.used = {'c-USED'};
      final v = validator();
      for (final code in ['nope', 'SHOP', 'OLD', 'SOON', 'FULL', 'MIN', 'USED']) {
        expect(await v.validateCoupon(code, 10), isNull, reason: code);
      }
      expect(toasts, [
        '!Kupon tapılmadı | Bu kupon kodu mövcud deyil',
        '!Kupon keçərsizdir | Bu kupon bu növ sifariş üçün keçərli deyil',
        '!Kupon müddəti bitib',
        '!Kupon hələ aktiv deyil',
        '!Kupon limiti dolub',
        '!Minimum məbləğ | Bu kupon minimum 20₼ sifariş üçün keçərlidir',
        '!Artıq istifadə edilib | Bu kuponu artıq istifadə etmisiniz',
      ]);
      expect(v.validating, isFalse);
    });

    test('percentage and capped fixed discounts, rounded to cents; usage recorded; remove clears the code', () async {
      backend.coupons = {'P15': _coupon('P15', type: 'percentage', value: 15), 'F50': _coupon('F50', value: 50)};
      final v = validator()..setCouponCode('P15');
      expect((await v.validateCoupon('p15', 12.99))?.discountAmount, 1.95);
      expect(toasts.last, 'Kupon tətbiq edildi! ✅ | 1.95₼ endirim');
      expect((await v.validateCoupon('F50', 30))?.discountAmount, 30);
      await v.recordUsage('order-1');
      expect(backend.usage, ['c-F50:album:30.0']);
      v.removeCoupon();
      expect(v.appliedCoupon, isNull);
      expect(v.couponCode, '');
    });

    test('does nothing without a user or a code', () async {
      expect(await validator(user: null).validateCoupon('X', 1), isNull);
      expect(await validator().validateCoupon('  ', 1), isNull);
      expect(toasts, isEmpty);
    });
  });

  group('AlbumOrderScreen', () {
    screenTest('requires name, phone and address, uploads the transfer proof and stores the order', (tester) async {
      final backend = FakeAlbumBackend();
      var backs = 0;
      await pumpApp(
        tester,
        AlbumOrderScreen(albumType: 'baby', onBack: () => backs++),
        overrides: [
          ...baseOverrides(),
          albumOrderBackendProvider.overrideWithValue(backend),
          albumProofPickerProvider.overrideWithValue(() async => (name: 'receipt.photo.png', bytes: Uint8List.fromList([1, 2, 3]), mimeType: 'image/png')),
          albumOrderClockProvider.overrideWithValue(() => DateTime.fromMillisecondsSinceEpoch(1700000000000)),
        ],
        scroll: false,
      );
      await tester.pump();
      expect(find.text('Körpə Albomu'), findsOneWidget);
      expect(find.text('✓ 12 aylıq xatirələr'), findsOneWidget);
      expect(find.text('Köhnə'), findsNothing, reason: 'inactive methods are hidden');
      await tester.tap(find.byKey(const ValueKey('album-submit')));
      await tester.pump();
      expect(backend.orders, isEmpty, reason: 'the button is disabled until name, phone and address are filled');

      await tester.enterText(find.byKey(const ValueKey('album-name')), 'Leyla Ə');
      await tester.enterText(find.byKey(const ValueKey('album-phone')), '+994501234567');
      await tester.enterText(find.byKey(const ValueKey('album-address')), 'Nizami 5, mənzil 12');
      await tester.ensureVisible(find.byKey(const ValueKey('album-method-c2c_transfer')));
      await tester.tap(find.byKey(const ValueKey('album-method-c2c_transfer')));
      await tester.pump();
      await tester.ensureVisible(find.byKey(const ValueKey('album-proof')));
      await tester.tap(find.byKey(const ValueKey('album-proof')));
      await tester.pump();
      expect(find.text('receipt.photo.png'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('album-submit')));
      await tester.pump();
      await tester.pump();
      expect(backend.uploads, ['album-proofs/user-1/1700000000000.png']);
      expect(backend.orders.single, {
        'user_id': 'user-1',
        'album_type': 'baby',
        'customer_name': 'Leyla Ə',
        'contact_phone': '+994501234567',
        'delivery_address': 'Bakı, Nizami 5, mənzil 12',
        'notes': '',
        'payment_method': 'c2c_transfer',
        'payment_proof_url': 'https://cdn.example/album-proofs/user-1/1700000000000.png',
        'total_price': 0,
      });
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Sifarişiniz qəbul edildi! 🎉'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('album-success-back')));
      expect(backs, 1);
    });

    screenTest('a failed insert shows the error toast and keeps the form; the flow layout works inside a scroll view', (tester) async {
      final backend = FakeAlbumBackend()..failInsert = true;
      await pumpApp(
        tester,
        AlbumOrderScreen(albumType: 'pregnancy', onBack: () {}),
        overrides: [...baseOverrides(), albumOrderBackendProvider.overrideWithValue(backend)],
      );
      await tester.pump();
      expect(find.text('Hamiləlik Albomu'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('album-name')), 'A');
      await tester.enterText(find.byKey(const ValueKey('album-phone')), '1');
      await tester.enterText(find.byKey(const ValueKey('album-address')), 'B');
      await tester.pump();
      await tester.ensureVisible(find.byKey(const ValueKey('album-submit')));
      await tester.tap(find.byKey(const ValueKey('album-submit')));
      await tester.pump();
      await tester.pump();
      expect(find.text('Xəta baş verdi'), findsOneWidget);
      expect(find.byKey(const ValueKey('album-name')), findsOneWidget);
      await tester.pump(const Duration(seconds: 6));
    });
  });
}
