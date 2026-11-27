// Ported from: the supabase-js calls of src/lib/marketSafety.ts, src/lib/marketInbox.ts,
//              src/components/tools/market/useMarketInbox.ts and src/components/tools/SecondHandMarket.tsx
//              (marketplace_listings, marketplace_messages, market_reports, market_blocks, storage community-media),
//              the hidden `<input type="file" accept="image/*" multiple>` + src/lib/image-compress.ts
//
// supabase-js returns `{ data, error }`; these helpers keep that shape ([MarketResult]) so the ported functions can
// branch on `error.code` exactly like the TypeScript. Tests replace [marketDbProvider] with a recording fake.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/data/data.dart';
import '../../chat/data/chat_backend.dart' show chatBackendProvider, getPublicProfileCards;
import '../baby_album/image_compress.dart';
import '../health_common/health_db.dart' show HFilter;

export '../health_common/health_db.dart' show HFilter, eqF, inF;

/// A PostgREST `error` (`{ code, message }`).
@immutable
class MarketDbError {
  const MarketDbError({this.code, this.message});
  final String? code;
  final String? message;
  @override
  String toString() => 'MarketDbError($code, $message)';
}

/// `{ data, error }`.
@immutable
class MarketResult {
  const MarketResult({this.data, this.error});
  final Object? data;
  final MarketDbError? error;
}

/// `from(table).select(columns)` + `.eq/.in` filters + `.or(filter)` + `.order(...)` + `.limit(n)`.
@immutable
class MarketQuery {
  const MarketQuery(this.table, {this.columns = '*', this.filters = const [], this.or, this.order, this.limit});
  final String table;
  final String columns;
  final List<HFilter> filters;
  final String? or;
  final ({String column, bool ascending})? order;
  final int? limit;
}

abstract interface class MarketDb {
  /// The rows as `{ data, error }`. A transport failure throws (supabase-js rejects in the same cases the callers
  /// catch).
  Future<MarketResult> select(MarketQuery query);

  /// `from(table).insert(row)` (no `.select()`).
  Future<MarketResult> insert(String table, Map<String, dynamic> row);

  /// `from(table).update(patch)` + filters (+ `.or(filter)`).
  Future<MarketResult> update(String table, Map<String, dynamic> patch, List<HFilter> filters, {String? or});

  /// `from(table).delete()` + filters.
  Future<MarketResult> delete(String table, List<HFilter> filters);

  /// `storage.from(bucket).upload(path, file)`: the error, or null.
  Future<Object?> upload(String bucket, String path, Uint8List bytes, String contentType);

  /// `storage.from(bucket).getPublicUrl(path).data.publicUrl`.
  String publicUrl(String bucket, String path);
}

class SupabaseMarketDb implements MarketDb {
  SupabaseMarketDb(this._db);
  final Db _db;

  dynamic _filtered(dynamic q, List<HFilter> filters) {
    for (final f in filters) {
      q = switch (f.op) {
        'eq' => q.eq(f.column, f.value as Object),
        'in' => q.inFilter(f.column, f.value as List),
        _ => throw ArgumentError('filter ${f.op}'),
      };
    }
    return q;
  }

  Future<MarketResult> _run(Future<Object?> Function() call) async {
    try {
      return MarketResult(data: await call());
    } on PostgrestException catch (e) {
      return MarketResult(error: MarketDbError(code: e.code, message: e.message));
    }
  }

  @override
  Future<MarketResult> select(MarketQuery query) => _run(() async {
        dynamic q = _filtered(_db.from(query.table).select(query.columns), query.filters);
        if (query.or != null) q = q.or(query.or!);
        if (query.order != null) q = q.order(query.order!.column, ascending: query.order!.ascending);
        if (query.limit != null) q = q.limit(query.limit!);
        return await q as Object?;
      });

  @override
  Future<MarketResult> insert(String table, Map<String, dynamic> row) => _run(() async {
        await _db.from(table).insert(row);
        return null;
      });

  @override
  Future<MarketResult> update(String table, Map<String, dynamic> patch, List<HFilter> filters, {String? or}) => _run(() async {
        dynamic q = _filtered(_db.from(table).update(patch), filters);
        if (or != null) q = q.or(or);
        await q;
        return null;
      });

  @override
  Future<MarketResult> delete(String table, List<HFilter> filters) => _run(() async {
        await _filtered(_db.from(table).delete(), filters);
        return null;
      });

  @override
  Future<Object?> upload(String bucket, String path, Uint8List bytes, String contentType) async =>
      (await _db.upload(bucket, path, bytes, contentType: contentType)).error;

  @override
  String publicUrl(String bucket, String path) => _db.publicUrl(bucket, path);
}

final marketDbProvider = Provider<MarketDb>((ref) => SupabaseMarketDb(ref.watch(dbProvider)), name: 'marketDbProvider');

/// `getPublicProfileCards(ids)` → `{ user_id: name }` (the chat feature's port of lib/public-profile-cards.ts).
final marketProfileNamesProvider = Provider<Future<Map<String, String>> Function(List<String> userIds)>(
  (ref) => (ids) async {
    final cards = await getPublicProfileCards(ref.read(chatBackendProvider), ids);
    return {for (final e in cards.entries) e.key: '${e.value['name'] ?? ''}'};
  },
  name: 'marketProfileNamesProvider',
);

/// The hidden multiple image input + `compressImageForUpload` for every file: image_picker scales to 1600 px at
/// quality 82 like the canvas re-encode. Empty when cancelled.
final marketImagePickerProvider = Provider<Future<List<UploadFile>> Function()>(
  (ref) => () async {
    final files = await ImagePicker().pickMultiImage(maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
    return [
      for (final x in files)
        await compressImageForUpload(UploadFile(
          bytes: await x.readAsBytes(),
          name: x.name,
          type: x.mimeType ?? _mimeOf(x.name),
        )),
    ];
  },
  name: 'marketImagePickerProvider',
);

String _mimeOf(String name) => switch (name.contains('.') ? name.split('.').last.toLowerCase() : '') {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      'heic' => 'image/heic',
      _ => '',
    };

/// `Date.now()` (tests pin it).
final marketNowProvider = Provider<int Function()>((ref) => () => DateTime.now().millisecondsSinceEpoch, name: 'marketNowProvider');
