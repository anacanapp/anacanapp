// Ported from: src/lib/album-photo-replace.ts
//
// Safe photo replacement for the pregnancy and baby albums. Order: upload the new file to a NEW path, then point the
// record at it, and only then delete the old storage object. If the upload or the record update fails, the original
// photo is left untouched (a half-uploaded new object is cleaned up). A failed delete of the old object only leaves
// an orphan file; the user still sees the new photo.
import 'package:flutter/foundation.dart';

import 'image_compress.dart';

/// `{ error }` of a storage / table call: null = ok.
typedef StorageError = Object?;

abstract interface class AlbumStorageBucket {
  Future<StorageError> upload(String path, UploadFile file);
  Future<StorageError> remove(List<String> paths);
}

abstract interface class AlbumStorageClient {
  AlbumStorageBucket bucket(String name);
}

abstract interface class AlbumDbClient implements AlbumStorageClient {
  /// `from(table).update(values).eq('id', id)`.
  Future<StorageError> updateRow(String table, Map<String, Object?> values, String id);
}

/// Extracts the object path inside [bucket] from a stored public/signed URL or a bare path (query string stripped).
String storagePathFromUrl(String url, String bucket) {
  final marker = '/$bucket/';
  final index = url.indexOf(marker);
  var path = index >= 0 ? url.substring(index + marker.length) : url;
  path = path.split(RegExp('[?#]'))[0];
  try {
    return Uri.decodeComponent(path);
  } catch (_) {
    return path;
  }
}

Future<void> _removeQuietly(AlbumStorageBucket bucket, String path) async {
  try {
    final error = await bucket.remove([path]);
    if (error != null) debugPrint('[album] could not remove object $error');
  } catch (error) {
    debugPrint('[album] could not remove object $error');
  }
}

/// Pregnancy album: storage object + DB row. Throws the upload / update error.
Future<void> replaceRecordPhoto(
  AlbumDbClient client, {
  required String bucket,
  required String table,
  required String recordId,
  required String? oldPath,
  required String newPath,
  required String newUrl,
  required UploadFile file,
  String column = 'photo_url',
}) async {
  final b = client.bucket(bucket);
  final uploadError = await b.upload(newPath, file);
  if (uploadError != null) throw uploadError;
  final dbError = await client.updateRow(table, {column: newUrl}, recordId);
  if (dbError != null) {
    await _removeQuietly(b, newPath);
    throw dbError;
  }
  if (oldPath != null && oldPath.isNotEmpty && oldPath != newPath) await _removeQuietly(b, oldPath);
}

/// Baby album: storage only (the listing is the record). Throws the upload error.
Future<void> replaceStoragePhoto(
  AlbumStorageClient client, {
  required String bucket,
  required String oldPath,
  required String newPath,
  required UploadFile file,
}) async {
  final b = client.bucket(bucket);
  final uploadError = await b.upload(newPath, file);
  if (uploadError != null) throw uploadError;
  if (oldPath != newPath) await _removeQuietly(b, oldPath);
}
