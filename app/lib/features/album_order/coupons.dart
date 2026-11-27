// Ported from: src/hooks/useCoupons.ts (useCouponValidator), src/hooks/usePaymentMethods.ts (usePaymentMethods)
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/data.dart';
import '../../core/i18n/i18n.dart';
import 'album_order_backend.dart';

/// `PaymentMethod` (public projection; `config` is not returned).
class PaymentMethod {
  const PaymentMethod({required this.id, required this.methodKey, required this.label, this.description, this.icon, required this.isActive, required this.sortOrder});
  final String id;
  final String methodKey;
  final String label;
  final String? description;
  final String? icon;
  final bool isActive;
  final int sortOrder;

  factory PaymentMethod.fromRow(Map<String, dynamic> r) => PaymentMethod(
        id: '${r['id']}',
        methodKey: '${r['method_key'] ?? ''}',
        label: '${r['label'] ?? ''}',
        description: r['description'] is String && (r['description'] as String).isNotEmpty ? r['description'] as String : null,
        icon: r['icon'] as String?,
        isActive: r['is_active'] == true,
        sortOrder: (r['sort_order'] as num?)?.toInt() ?? 0,
      );
}

/// `usePaymentMethods()`: refetched when the language changes; a failed fetch leaves the list empty.
final paymentMethodsProvider = FutureProvider.autoDispose<List<PaymentMethod>>((ref) async {
  final language = ref.watch(appLanguageProvider);
  try {
    final rows = await ref.watch(albumOrderBackendProvider).activePaymentMethods();
    final translated = mapRowsTranslation([for (final r in rows) {...r, 'config': <String, dynamic>{}}], language, const ['label', 'description']);
    return [for (final r in translated) PaymentMethod.fromRow(r)];
  } catch (error) {
    debugPrint('Error fetching payment methods: $error');
    return const [];
  }
}, name: 'paymentMethodsProvider');

/// `Coupon`.
class Coupon {
  const Coupon(this.row);
  final Row row;
  String get id => '${row['id']}';
  String get code => '${row['code'] ?? ''}';
  String get discountType => '${row['discount_type'] ?? ''}';
  num get discountValue => row['discount_value'] as num? ?? 0;
  num get minOrderAmount => row['min_order_amount'] as num? ?? 0;
  int? get maxUses => (row['max_uses'] as num?)?.toInt();
  int get usedCount => (row['used_count'] as num?)?.toInt() ?? 0;
  List<String> get applicableTo => row['applicable_to'] is List ? [for (final v in row['applicable_to'] as List) '$v'] : const [];
  DateTime? get expiresAt => row['expires_at'] is String ? DateTime.tryParse(row['expires_at'] as String) : null;
  DateTime? get startsAt => row['starts_at'] is String ? DateTime.tryParse(row['starts_at'] as String) : null;
}

/// `AppliedCoupon`.
class AppliedCoupon {
  const AppliedCoupon(this.coupon, this.discountAmount);
  final Coupon coupon;
  final double discountAmount;
}

/// Toast sink of the validator (`toast({ title, description, variant })`).
typedef CouponToast = void Function({required String title, String? description, bool destructive});

/// `useCouponValidator(orderType)`.
class CouponValidator extends ChangeNotifier {
  CouponValidator({required this.backend, required this.userId, required this.toast, this.orderType = 'shop', DateTime Function()? now}) : _now = now ?? DateTime.now;
  final AlbumOrderBackend backend;
  final String? userId;
  final CouponToast toast;
  final String orderType;
  final DateTime Function() _now;

  String couponCode = '';
  AppliedCoupon? appliedCoupon;
  bool validating = false;
  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void setCouponCode(String value) {
    couponCode = value;
    _notify();
  }

  Future<AppliedCoupon?> validateCoupon(String code, num orderTotal) async {
    final uid = userId;
    if (uid == null || code.trim().isEmpty) return null;
    validating = true;
    _notify();
    try {
      final data = await backend.activeCoupon(code);
      if (data == null) {
        toast(title: tr('usecoupons_kupon_tapilmadi_e41e4e', 'Kupon tapılmadı'), description: tr('usecoupons_bu_kupon_kodu_movcud_deyil_6b3eb9', 'Bu kupon kodu mövcud deyil'), destructive: true);
        return null;
      }
      final coupon = Coupon(data);
      if (!coupon.applicableTo.contains(orderType)) {
        toast(
          title: tr('usecoupons_kupon_kecersizdir_42186d', 'Kupon keçərsizdir'),
          description: tr('usecoupons_bu_kupon_bu_nov_sifaris_ucun_kecerli_dey_17536c', 'Bu kupon bu növ sifariş üçün keçərli deyil'),
          destructive: true,
        );
        return null;
      }
      final now = _now();
      final expires = coupon.expiresAt;
      if (expires != null && expires.isBefore(now)) {
        toast(title: tr('usecoupons_kupon_muddeti_bitib_242f3f', 'Kupon müddəti bitib'), destructive: true);
        return null;
      }
      // `new Date(coupon.starts_at) > new Date()` (a missing start is an Invalid Date: never in the future).
      final starts = coupon.startsAt;
      if (starts != null && starts.isAfter(now)) {
        toast(title: tr('usecoupons_kupon_hele_aktiv_deyil_1247d5', 'Kupon hələ aktiv deyil'), destructive: true);
        return null;
      }
      final maxUses = coupon.maxUses;
      if (maxUses != null && maxUses != 0 && coupon.usedCount >= maxUses) {
        // React literal (no tr key).
        toast(title: 'Kupon limiti dolub', destructive: true);
        return null;
      }
      if (coupon.minOrderAmount != 0 && orderTotal < coupon.minOrderAmount) {
        toast(
          title: tr('usecoupons_minimum_mebleg_435135', 'Minimum məbləğ'),
          description: tr('usecoupons_min_order_desc', 'Bu kupon minimum {amount}₼ sifariş üçün keçərlidir').replaceAll('{amount}', _jsNumber(coupon.minOrderAmount)),
          destructive: true,
        );
        return null;
      }
      if (await backend.couponUsedBy(coupon.id, uid)) {
        toast(title: tr('usecoupons_artiq_istifade_edilib_709c3e', 'Artıq istifadə edilib'), description: tr('usecoupons_bu_kuponu_artiq_istifade_etmisiniz_a8e01e', 'Bu kuponu artıq istifadə etmisiniz'), destructive: true);
        return null;
      }
      var discount = coupon.discountType == 'percentage' ? orderTotal * coupon.discountValue / 100 : (coupon.discountValue < orderTotal ? coupon.discountValue : orderTotal);
      discount = (discount * 100).round() / 100;
      final applied = AppliedCoupon(coupon, discount.toDouble());
      appliedCoupon = applied;
      toast(title: tr('usecoupons_kupon_tetbiq_edildi_e2143c', 'Kupon tətbiq edildi! ✅'), description: tr('usecoupons_discount_desc', '{amount}₼ endirim').replaceAll('{amount}', applied.discountAmount.toStringAsFixed(2)));
      return applied;
    } catch (_) {
      toast(title: tr('usecoupons_xeta_3cdbb6', 'Xəta'), description: tr('usecoupons_kupon_yoxlanarken_xeta_bas_verdi_9f76a4', 'Kupon yoxlanarkən xəta baş verdi'), destructive: true);
      return null;
    } finally {
      validating = false;
      _notify();
    }
  }

  Future<void> recordUsage([String? orderId]) async {
    final uid = userId, applied = appliedCoupon;
    if (uid == null || applied == null) return;
    try {
      await backend.recordCouponUsage(couponId: applied.coupon.id, userId: uid, orderType: orderType, orderId: orderId, discountAmount: applied.discountAmount);
    } catch (error) {
      debugPrint('Error recording coupon usage: $error');
    }
  }

  void removeCoupon() {
    appliedCoupon = null;
    couponCode = '';
    _notify();
  }
}

/// `String(number)` (integers without a trailing `.0`).
String _jsNumber(num v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';
