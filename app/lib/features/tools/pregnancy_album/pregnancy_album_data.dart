// Ported from: the supabase calls of src/components/tools/PregnancyAlbum.tsx (useQuery ['pregnancy-album-photos'],
//              upload / delete / caption mutations)
//
// Reuses the album helpers ported with the baby album (src/lib/album-photo-replace.ts, src/lib/image-compress.ts in
// features/tools/baby_album) and its image_picker picker (1600 px / 0.82 like the canvas re-encode).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/net/backend_providers.dart';
import '../baby_album/album_photo_replace.dart';
import '../baby_album/baby_album_data.dart' show babyAlbumPickerProvider, BabyAlbumPicker;
import '../baby_album/image_compress.dart' show UploadFile;

const String pregnancyAlbumBucket = 'pregnancy-album';
const String pregnancyAlbumTable = 'pregnancy_album_photos';

@immutable
class PregnancyAlbumPhoto {
  const PregnancyAlbumPhoto({
    required this.id,
    required this.userId,
    required this.weekNumber,
    required this.monthNumber,
    required this.photoUrl,
    required this.storagePath,
    this.caption,
    required this.photoDate,
    required this.createdAt,
  });
  final String id;
  final String userId;
  final int weekNumber;
  final int monthNumber;

  /// Signed URL when available (the stored value otherwise).
  final String photoUrl;

  /// Object path in the pregnancy-album bucket.
  final String storagePath;
  final String? caption;
  final String photoDate;
  final String createdAt;

  PregnancyAlbumPhoto withUrl(String url) => PregnancyAlbumPhoto(
        id: id,
        userId: userId,
        weekNumber: weekNumber,
        monthNumber: monthNumber,
        photoUrl: url,
        storagePath: storagePath,
        caption: caption,
        photoDate: photoDate,
        createdAt: createdAt,
      );

  factory PregnancyAlbumPhoto.fromRow(Map<String, dynamic> r) {
    final url = '${r['photo_url'] ?? ''}';
    return PregnancyAlbumPhoto(
      id: '${r['id'] ?? ''}',
      userId: '${r['user_id'] ?? ''}',
      weekNumber: (r['week_number'] as num?)?.toInt() ?? 0,
      monthNumber: (r['month_number'] as num?)?.toInt() ?? 0,
      photoUrl: url,
      storagePath: r['storage_path'] as String? ?? storagePathFromUrl(url, pregnancyAlbumBucket),
      caption: r['caption'] as String?,
      photoDate: '${r['photo_date'] ?? r['created_at'] ?? ''}',
      createdAt: '${r['created_at'] ?? ''}',
    );
  }

  Map<String, dynamic> toRow() => {
        'id': id,
        'user_id': userId,
        'week_number': weekNumber,
        'month_number': monthNumber,
        'photo_url': photoUrl,
        'storage_path': storagePath,
        'caption': caption,
        'photo_date': photoDate,
        'created_at': createdAt,
      };
}

abstract interface class PregnancyAlbumRepository implements AlbumDbClient {
  /// `select('*').eq('user_id').order('month_number')`; throws on error.
  Future<List<Map<String, dynamic>>> loadRows(String userId);

  /// `createSignedUrls(paths, 3600)` → one URL ('' when missing) per path; null when the call failed.
  Future<List<String>?> signedUrls(List<String> paths);

  /// `getPublicUrl(path)`.
  String publicUrl(String path);

  /// `insert(row)`; throws on error.
  Future<void> insertRow(Map<String, Object?> row);

  /// `delete().eq('id')`; throws on error.
  Future<void> deleteRow(String id);

  /// `update({ caption }).eq('id')`; throws on error.
  Future<void> updateCaption(String id, String? caption);
}

class SupabasePregnancyAlbumRepository implements PregnancyAlbumRepository {
  SupabasePregnancyAlbumRepository(this._client);
  final SupabaseClient Function() _client;
  StorageFileApi get _bucket => _client().storage.from(pregnancyAlbumBucket);

  @override
  Future<List<Map<String, dynamic>>> loadRows(String userId) async {
    final data = await _client().from(pregnancyAlbumTable).select().eq('user_id', userId).order('month_number', ascending: true);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<List<String>?> signedUrls(List<String> paths) async {
    try {
      final urls = await _bucket.createSignedUrlsResult(paths, 3600);
      return [for (final u in urls) u is SignedUrlSuccess ? u.signedUrl : ''];
    } catch (_) {
      return null;
    }
  }

  @override
  String publicUrl(String path) => _bucket.getPublicUrl(path);

  @override
  Future<void> insertRow(Map<String, Object?> row) => _client().from(pregnancyAlbumTable).insert(row);

  @override
  Future<void> deleteRow(String id) => _client().from(pregnancyAlbumTable).delete().eq('id', id);

  @override
  Future<void> updateCaption(String id, String? caption) => _client().from(pregnancyAlbumTable).update({'caption': caption}).eq('id', id);

  @override
  Future<Object?> updateRow(String table, Map<String, Object?> values, String id) async {
    try {
      await _client().from(table).update(values).eq('id', id);
      return null;
    } catch (e) {
      return e;
    }
  }

  @override
  AlbumStorageBucket bucket(String name) => _Bucket(_client().storage.from(name));
}

class _Bucket implements AlbumStorageBucket {
  _Bucket(this._api);
  final StorageFileApi _api;

  @override
  Future<Object?> upload(String path, UploadFile file) async {
    try {
      await _api.uploadBinary(path, file.bytes, fileOptions: FileOptions(contentType: file.type.isEmpty ? null : file.type));
      return null;
    } catch (e) {
      return e;
    }
  }

  @override
  Future<Object?> remove(List<String> paths) async {
    try {
      await _api.remove(paths);
      return null;
    } catch (e) {
      return e;
    }
  }
}

final pregnancyAlbumRepositoryProvider =
    Provider<PregnancyAlbumRepository>((ref) => SupabasePregnancyAlbumRepository(() => ref.read(supabaseClientProvider)));

/// `<input type="file" accept="image/*">` + `compressImageForUpload` (the baby album's image_picker picker).
final pregnancyAlbumPickerProvider = Provider<BabyAlbumPicker>((ref) => ref.watch(babyAlbumPickerProvider));

/// `Date.now()` for the object name (tests override it).
final pregnancyAlbumNowProvider = Provider<int Function()>((ref) => () => DateTime.now().millisecondsSinceEpoch);

/// `useQuery(['pregnancy-album-photos', userId])`: rows with signed URLs.
final pregnancyAlbumPhotosQuery = queryProvider<List<PregnancyAlbumPhoto>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(pregnancyAlbumRepositoryProvider);
  return QueryOptions<List<PregnancyAlbumPhoto>>(
    queryKey: ['pregnancy-album-photos', userId],
    enabled: userId != null,
    meta: const {'persist': false},
    queryFn: (_) async {
      if (userId == null) return const [];
      final photos = [for (final r in await repo.loadRows(userId)) PregnancyAlbumPhoto.fromRow(r)];
      if (photos.isEmpty) return photos;
      final signed = await repo.signedUrls([for (final p in photos) p.storagePath]);
      if (signed == null) return photos;
      return [for (var i = 0; i < photos.length; i++) i < signed.length && signed[i].isNotEmpty ? photos[i].withUrl(signed[i]) : photos[i]];
    },
  );
}, name: 'pregnancyAlbumPhotosQuery');
