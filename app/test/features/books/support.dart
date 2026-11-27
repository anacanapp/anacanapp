// Ported from: (test support for the books port — no React counterpart)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/books/books_api.dart';
import 'package:anacan/features/books/books_catalog.dart';
import 'package:anacan/features/tools/play_together/play_content.dart' show playAssetLoaderProvider;
import 'package:flutter_riverpod/misc.dart' show Override;

/// The bundled catalogue read from disk (tests run in `app/`).
BookCatalog loadCatalog() =>
    BookCatalog([for (final b in jsonDecode(File('assets/books/catalog.json').readAsStringSync()) as List) Book.fromJson((b as Map).cast<String, Object?>())]);

/// Reads bundled files from disk instead of the asset bundle.
Override diskAssets() => playAssetLoaderProvider.overrideWithValue((path) => Future.value(File(path).readAsStringSync()));

class FakeBooksApi implements BooksApi {
  bool ready = false;
  List<OwnedBook> owned = [];
  BookCheckoutResult checkout = const BookCheckoutStarted(url: 'https://pay.example/1', orderId: 'order-1', amount: 7.5);
  bool grant = true;
  final List<String> calls = [];

  @override
  Future<bool> paymentsReady() async => ready;
  @override
  Future<List<OwnedBook>> myBooks() async => owned;
  @override
  Future<BookCheckoutResult> startCheckout(List<String> bookIds, String language, {double? cashback}) async {
    calls.add('checkout:${bookIds.join(',')}:$language');
    return checkout;
  }

  @override
  Future<String?> downloadUrl(String bookId) async => 'https://files.example/$bookId.pdf';
  @override
  Future<bool> adminTestGrant(List<String> bookIds, String email) async {
    calls.add('grant:${bookIds.join(',')}:$email');
    return grant;
  }

  @override
  Future<void> openExternal(String url) async => calls.add('open:$url');
}
