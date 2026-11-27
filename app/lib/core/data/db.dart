// Ported from: src/integrations/supabase/client.ts (`supabase.from / rpc / functions.invoke / storage`)
//
// Thin access helpers so feature ports stay close to the TypeScript:
//   TS:   const { data, error } = await supabase.from('notifications').select('*').eq('user_id', id);
//   Dart: final rows = asRows(await db.from('notifications').select().eq('user_id', id));   // throws
//         final res = await db.query(() => db.from('notifications').select().eq('user_id', id)); // {data,error}
// Timeouts are applied by the SDK's AnacanHttpClient (REST/RPC 20 s, Functions 20 s / AI 90 s,
// Storage upload 120 s); a timeout surfaces as RequestTimeoutException (core/net/network_timeout.dart).

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../net/backend_providers.dart';
import '../net/network_timeout.dart';

/// `{ data, error }` of supabase-js.
class DbResult<T> {
  const DbResult({this.data, this.error, this.status});
  final T? data;
  final Object? error;

  /// HTTP status when known (functions; PostgREST errors without a code).
  final int? status;
  bool get ok => error == null;
}

class Db {
  Db(this.client);
  final SupabaseClient client;

  /// `supabase.from(table)`.
  SupabaseQueryBuilder from(String table) => client.from(table);

  /// `supabase.rpc(fn, params)`; throws [PostgrestException].
  PostgrestFilterBuilder<T> rpc<T>(String fn, {Map<String, dynamic>? params}) => client.rpc<T>(fn, params: params);

  /// Runs a PostgREST call and returns `{data, error}` instead of throwing.
  Future<DbResult<T>> query<T>(FutureOr<T> Function() run) async {
    try {
      return DbResult<T>(data: await run());
    } on PostgrestException catch (error) {
      final code = error.code;
      return DbResult<T>(error: error, status: code != null && RegExp(r'^\d{3}$').hasMatch(code) ? int.parse(code) : null);
    } catch (error) {
      return DbResult<T>(error: error, status: 0);
    }
  }

  /// `supabase.rpc(fn, params)` as `{data, error}`.
  Future<DbResult<Object?>> rpcResult(String fn, {Map<String, dynamic>? params}) =>
      query<Object?>(() => client.rpc<Object?>(fn, params: params));

  /// `supabase.functions.invoke(name, { body, headers })` as `{data, error}`. On a non-2xx answer
  /// `error` is the [FunctionException] whose `details` hold the parsed body (supabase-js:
  /// `await error.context.json()`).
  Future<DbResult<Object?>> invoke(String name, {Object? body, Map<String, String>? headers, HttpMethod method = HttpMethod.post}) async {
    try {
      final response = await client.functions.invoke(name, body: body, headers: headers, method: method);
      return DbResult(data: response.data, status: response.status);
    } on FunctionException catch (error) {
      return DbResult(error: error, status: error.status);
    } catch (error) {
      return DbResult(error: error, status: 0);
    }
  }

  /// Storage upload (`storage.from(bucket).upload(path, bytes, { contentType, upsert })`).
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes,
      {String? contentType, bool upsert = false, String cacheControl = '3600'}) async {
    try {
      final key = await client.storage
          .from(bucket)
          .uploadBinary(path, bytes, fileOptions: FileOptions(contentType: contentType, upsert: upsert, cacheControl: cacheControl));
      return UploadResult(path: path, fullPath: key);
    } catch (error) {
      return UploadResult(error: error, timedOut: isRequestTimeoutError(error));
    }
  }

  /// `storage.from(bucket).getPublicUrl(path)`.
  String publicUrl(String bucket, String path) => client.storage.from(bucket).getPublicUrl(path);

  /// `storage.from(bucket).createSignedUrl(path, expiresIn)`.
  Future<String> signedUrl(String bucket, String path, int expiresInSeconds) =>
      client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
}

class UploadResult {
  const UploadResult({this.path, this.fullPath, this.error, this.timedOut = false});
  final String? path;
  final String? fullPath;
  final Object? error;

  /// The 120 s upload bound fired (show the localized timeout text, `requestTimeoutMessage`).
  final bool timedOut;
  bool get ok => error == null;
}

/// `supabase` for feature code. Throws until startup opened the app.
final dbProvider = Provider<Db>((ref) => Db(ref.watch(supabaseClientProvider)));
