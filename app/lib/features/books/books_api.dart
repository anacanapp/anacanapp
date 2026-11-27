// Ported from: src/lib/books/api.ts (fetchBookPaymentsReady, fetchMyBooks, startBookCheckout, bookDownloadUrl,
//              openExternal, readCart / writeCart, adminTestGrant), src/components/books/BookStoreScreen.tsx (the
//              `anacan_books_pending_v1` checkout record)
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException, HttpMethod;
import 'package:url_launcher/url_launcher.dart';

import '../../core/data/data.dart';
import '../../state/state.dart' show LocalStore, localStoreProvider;

/// `OwnedBook`.
class OwnedBook {
  const OwnedBook({required this.bookId, required this.grantedAt, required this.orderId});
  final String bookId;
  final String grantedAt;
  final String orderId;
  factory OwnedBook.fromRow(Map<String, dynamic> r) => OwnedBook(bookId: '${r['book_id']}', grantedAt: '${r['granted_at'] ?? ''}', orderId: '${r['order_id'] ?? ''}');
  Map<String, dynamic> toRow() => {'book_id': bookId, 'granted_at': grantedAt, 'order_id': orderId};
}

/// `CheckoutResult`.
sealed class BookCheckoutResult {
  const BookCheckoutResult();
}

class BookCheckoutStarted extends BookCheckoutResult {
  const BookCheckoutStarted({required this.url, required this.orderId, this.amount, this.cashback});
  final String url;
  final String orderId;
  final double? amount;
  final double? cashback;
}

/// `{ ok: false, reason: 'unavailable' | 'owned' | 'error' | 'qaygicash', owned?, code? }`.
class BookCheckoutFailed extends BookCheckoutResult {
  const BookCheckoutFailed(this.reason, {this.owned = const [], this.code});
  final String reason;
  final List<String> owned;
  final String? code;
}

abstract interface class BooksApi {
  Future<bool> paymentsReady();
  Future<List<OwnedBook>> myBooks();

  /// [cashback]: QayğıCash bonus in AZN (the card is charged the rest).
  Future<BookCheckoutResult> startCheckout(List<String> bookIds, String language, {double? cashback});
  Future<String?> downloadUrl(String bookId);

  /// Admins only, while card payments are off: the books for free on the admin's own account.
  Future<bool> adminTestGrant(List<String> bookIds, String email);

  /// `window.open(url, '_blank')`: outside the app (payment page, PDF).
  Future<void> openExternal(String url);
}

Object? _errorBody(Object? error) {
  if (error is FunctionException) {
    final d = error.details;
    if (d is String) {
      try {
        return jsonDecode(d);
      } catch (_) {
        return null;
      }
    }
    return d;
  }
  return null;
}

class SupabaseBooksApi implements BooksApi {
  SupabaseBooksApi(this.db);
  final Db db;

  @override
  Future<bool> paymentsReady() async {
    try {
      final res = await db.invoke('book-checkout', method: HttpMethod.get);
      final data = res.data;
      return res.ok && data is Map && data['ready'] == true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<List<OwnedBook>> myBooks() async {
    final data = await db.rpc<Object?>('my_books_v1');
    return [for (final r in asRows(data)) OwnedBook.fromRow(r)];
  }

  @override
  Future<BookCheckoutResult> startCheckout(List<String> bookIds, String language, {double? cashback}) async {
    final res = await db.invoke('book-checkout', body: {
      'book_ids': bookIds,
      'language': language,
      // The cart only enables the pay button after the digital-delivery consent, so it is always sent.
      'consent': 'digital-delivery-v1',
      if (cashback != null && cashback > 0) 'cashback': cashback,
    });
    final data = res.data;
    if (res.ok && data is Map && data['checkout_url'] is String) {
      return BookCheckoutStarted(
        url: data['checkout_url'] as String,
        orderId: '${data['order_id']}',
        amount: data['amount'] is num ? (data['amount'] as num).toDouble() : null,
        cashback: data['cashback'] is num ? (data['cashback'] as num).toDouble() : null,
      );
    }
    final body = _errorBody(res.error);
    final error = body is Map ? body['error'] : null;
    if (error == 'payments_unavailable') return const BookCheckoutFailed('unavailable');
    if (error == 'already_owned') return BookCheckoutFailed('owned', owned: [for (final id in (body as Map)['book_ids'] as List? ?? const []) '$id']);
    if (error is String && RegExp(r'^QC_[A-Z_]+$').hasMatch(error)) return BookCheckoutFailed('qaygicash', code: error);
    return const BookCheckoutFailed('error');
  }

  @override
  Future<String?> downloadUrl(String bookId) async {
    final res = await db.invoke('book-download', body: {'book_id': bookId});
    final data = res.data;
    return res.ok && data is Map && data['url'] is String ? data['url'] as String : null;
  }

  @override
  Future<bool> adminTestGrant(List<String> bookIds, String email) async {
    final res = await db.invoke('book-admin', body: {'action': 'grant', 'email': email, 'book_ids': bookIds, 'note': 'admin test (tətbiqdən)'});
    final data = res.data;
    return res.ok && data is Map && data['order_id'] is String;
  }

  @override
  Future<void> openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }
}

final booksApiProvider = Provider<BooksApi>((ref) => SupabaseBooksApi(ref.watch(dbProvider)), name: 'booksApiProvider');

const String kBooksCartKey = 'anacan_books_cart_v1';
const String kBooksPendingKey = 'anacan_books_pending_v1';

/// `readCart()`.
List<String> readBooksCart(LocalStore store) {
  final value = store.readJson(kBooksCartKey);
  return value is List ? [for (final id in value) if (id is String) id] : const [];
}

/// `writeCart(ids)`.
void writeBooksCart(LocalStore store, List<String> ids) => store.writeJson(kBooksCartKey, ids);

/// `PendingBooks` of the last checkout (purchase confirmation once the books appear in "Kitablarım").
class PendingBooks {
  const PendingBooks({required this.orderId, required this.ids, required this.value, this.qcEarn, this.qcUsed});
  final String orderId;
  final List<String> ids;
  final num value;
  final int? qcEarn;
  final int? qcUsed;

  Map<String, dynamic> toJson() => {'orderId': orderId, 'ids': ids, 'value': value, 'qcEarn': ?qcEarn, 'qcUsed': ?qcUsed};

  static PendingBooks? read(LocalStore store) {
    final v = store.readJson(kBooksPendingKey);
    if (v is! Map || v['ids'] is! List) return null;
    return PendingBooks(
      orderId: '${v['orderId']}',
      ids: [for (final id in v['ids'] as List) '$id'],
      value: v['value'] is num ? v['value'] as num : 0,
      qcEarn: (v['qcEarn'] as num?)?.toInt(),
      qcUsed: (v['qcUsed'] as num?)?.toInt(),
    );
  }

  void write(LocalStore store) => store.writeJson(kBooksPendingKey, toJson());
  static void clear(LocalStore store) => store.removeItem(kBooksPendingKey);
}

/// The persisted store (`localStorage`).
final booksLocalStoreProvider = Provider<LocalStore>((ref) => ref.watch(localStoreProvider));
