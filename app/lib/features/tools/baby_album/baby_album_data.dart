// Ported from: the storage calls of src/components/baby/BabyMonthlyAlbum.tsx (useQuery ['baby-album-photos'],
//              upload / replace / remove) and its `<input type="file" accept="image/*">`
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/net/backend_providers.dart';
import 'album_photo_replace.dart';
import 'image_compress.dart';

const String babyAlbumBucket = 'baby-album';

/// `AlbumPhoto`.
class AlbumPhoto {
  const AlbumPhoto({required this.name, required this.month, required this.url});
  final String name;
  final int month;
  final String url;
}

/// Storage access of the album (tests override it with a fake).
abstract interface class BabyAlbumStorage implements AlbumStorageClient {
  /// `list(userId, { sortBy: name asc })` → object names.
  Future<List<String>> list(String userId);

  /// `createSignedUrls(paths, 3600)` → one URL (or '') per path; throws on error.
  Future<List<String>> signedUrls(List<String> paths);
}

class SupabaseBabyAlbumStorage implements BabyAlbumStorage {
  SupabaseBabyAlbumStorage(this._client);
  final SupabaseClient Function() _client;
  StorageFileApi get _bucket => _client().storage.from(babyAlbumBucket);

  @override
  Future<List<String>> list(String userId) async {
    final files = await _bucket.list(path: userId, searchOptions: const SearchOptions(sortBy: SortBy(column: 'name', order: 'asc')));
    return [for (final f in files) f.name];
  }

  @override
  Future<List<String>> signedUrls(List<String> paths) async {
    final urls = await _bucket.createSignedUrlsResult(paths, 3600);
    return [for (final u in urls) u is SignedUrlSuccess ? u.signedUrl : ''];
  }

  @override
  AlbumStorageBucket bucket(String name) => _SupabaseBucket(_client().storage.from(name));
}

class _SupabaseBucket implements AlbumStorageBucket {
  _SupabaseBucket(this._api);
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

final babyAlbumStorageProvider =
    Provider<BabyAlbumStorage>((ref) => SupabaseBabyAlbumStorage(() => ref.read(supabaseClientProvider)), name: 'babyAlbumStorageProvider');

/// `useQuery(['baby-album-photos', userId])`: month photos (`month-<n>-…`) with signed URLs, by name.
final babyAlbumPhotosQuery = queryProvider<List<AlbumPhoto>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final storage = ref.watch(babyAlbumStorageProvider);
  return QueryOptions(
    queryKey: ['baby-album-photos', userId],
    enabled: userId != null,
    meta: const {'persist': false},
    queryFn: (_) async {
      if (userId == null) return const <AlbumPhoto>[];
      List<String> names;
      try {
        names = await storage.list(userId);
      } catch (_) {
        return const <AlbumPhoto>[];
      }
      final files = names.where((n) => n != '.emptyFolderPlaceholder').toList();
      var signed = <String>[];
      if (files.isNotEmpty) {
        try {
          signed = await storage.signedUrls([for (final f in files) '$userId/$f']);
        } catch (_) {}
      }
      return [
        for (var i = 0; i < files.length; i++)
          () {
            final m = RegExp(r'^month-(\d+)').firstMatch(files[i]);
            return AlbumPhoto(name: files[i], month: m != null ? int.parse(m[1]!) : 0, url: i < signed.length ? signed[i] : '');
          }(),
      ].where((p) => p.month > 0).toList();
    },
  );
}, name: 'babyAlbumPhotosQuery');

/// The photo picker (`<input type="file" accept="image/*">` + `compressImageForUpload`): image_picker scales to
/// 1600 px at quality 82 like the canvas re-encode; null when cancelled.
typedef BabyAlbumPicker = Future<UploadFile?> Function();

final babyAlbumPickerProvider = Provider<BabyAlbumPicker>((ref) => () async {
      final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
      if (x == null) return null;
      final bytes = await x.readAsBytes();
      final name = x.name;
      final ext = name.contains('.') ? name.split('.').last.toLowerCase() : '';
      final type = x.mimeType ??
          switch (ext) {
            'jpg' || 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'heic' => 'image/heic',
            _ => '',
          };
      return compressImageForUpload(UploadFile(bytes: bytes, name: name, type: type));
    });

/// `Date.now()` for the object name (tests override it).
final babyAlbumNowProvider = Provider<int Function()>((ref) => () => DateTime.now().millisecondsSinceEpoch);

/// `${user.id}/month-${month}-${Date.now()}.${ext}`.
String babyAlbumPath(String userId, int month, int now, String fileName) => '$userId/month-$month-$now.${fileName.split('.').last}';
