// Ported from: the hidden file inputs + `uploadMedia` / `uploadCommentImage` of src/components/community/
//              {CreatePostScreen,PostCard}.tsx (bucket `community-media`, path `<user>/<now>-<random>.<ext>`),
//              src/lib/image-compress.ts (through the tools port), the `translate-post` call and the session
//              translation cache of PostCard.tsx
import 'dart:collection';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/i18n/i18n.dart';
import '../../chat/platform/chat_media_picker.dart' show pickedMime;
import '../../tools/baby_album/image_compress.dart';
import 'community_backend.dart';

export '../../tools/baby_album/image_compress.dart' show UploadFile, ImageCodec, NoImageCodec;

/// A picked file (`File`): bytes, name, MIME; `video` when picked from the video input.
class CommunityMediaFile {
  const CommunityMediaFile({required this.file, required this.video, this.path});
  final UploadFile file;
  final bool video;

  /// Local path for previews (null in tests).
  final String? path;
  int get size => file.size;
}

/// `<input type="file" accept="image/*" multiple>` / `accept="video/*"` / the comment's single image input.
abstract interface class CommunityMediaPicker {
  Future<List<CommunityMediaFile>> pickImages();
  Future<CommunityMediaFile?> pickVideo();
  Future<CommunityMediaFile?> pickImage();
}

class ImagePickerCommunityMediaPicker implements CommunityMediaPicker {
  ImagePickerCommunityMediaPicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  Future<CommunityMediaFile> _read(XFile file, bool video) async {
    final slash = file.path.replaceAll(r'\', '/').lastIndexOf('/');
    final name = file.name.isNotEmpty ? file.name : file.path.substring(slash + 1);
    return CommunityMediaFile(
      file: UploadFile(bytes: await file.readAsBytes(), name: name, type: pickedMime(file.mimeType, file.path)),
      video: video,
      path: file.path,
    );
  }

  @override
  Future<List<CommunityMediaFile>> pickImages() async {
    final files = await _picker.pickMultiImage(maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
    return [for (final f in files) await _read(f, false)];
  }

  @override
  Future<CommunityMediaFile?> pickVideo() async {
    final file = await _picker.pickVideo(source: ImageSource.gallery);
    return file == null ? null : _read(file, true);
  }

  @override
  Future<CommunityMediaFile?> pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
    return file == null ? null : _read(file, false);
  }
}

final communityMediaPickerProvider = Provider<CommunityMediaPicker>((ref) => ImagePickerCommunityMediaPicker());

/// The canvas codec of `compressImageForUpload`. No JPEG/WebP encoder ships with Flutter: the default uploads the
/// (picker-scaled) original, like the WebView without `createImageBitmap`.
final communityImageCodecProvider = Provider<ImageCodec>((ref) => const NoImageCodec());

const String kCommunityMediaBucket = 'community-media';

/// `Math.random().toString(36).substring(7)` (a short random tail).
String _randomTail() {
  final r = math.Random();
  return List.generate(6, (_) => '0123456789abcdefghijklmnopqrstuvwxyz'[r.nextInt(36)]).join();
}

/// Thrown upload error (`new Error('Fayl yüklənə bilmədi: <message>')`).
class CommunityUploadException implements Exception {
  const CommunityUploadException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// `uploadMedia` / `uploadCommentImage`: compress, upload to `community-media/<user>/<now>-<random>.<ext>`, return the
/// public URL.
Future<String> uploadCommunityMedia(CommunityBackend backend, String userId, UploadFile original, {ImageCodec codec = const NoImageCodec()}) async {
  final file = await compressImageForUpload(original, codec: codec);
  final dot = file.name.lastIndexOf('.');
  final ext = dot >= 0 && dot < file.name.length - 1 ? file.name.substring(dot + 1) : 'jpg';
  final path = '$userId/${DateTime.now().millisecondsSinceEpoch}-${_randomTail()}.$ext';
  final result = await backend.upload(kCommunityMediaBucket, path, file.bytes, file.type);
  if (!result.ok) {
    throw CommunityUploadException('${tr('community_file_upload_failed', 'Fayl yüklənə bilmədi:')} ${errorMessage(result.error)}');
  }
  return backend.publicUrl(kCommunityMediaBucket, path);
}

/// The session translation cache of PostCard (FIFO, 200 entries; key `<postId>:<lang>`).
class PostTranslationCache {
  static const int max = 200;
  final LinkedHashMap<String, String> _entries = LinkedHashMap();

  String? operator [](String key) => _entries[key];
  void remember(String key, String value) {
    _entries.remove(key);
    _entries[key] = value;
    while (_entries.length > max) {
      _entries.remove(_entries.keys.first);
    }
  }

  void remove(String key) => _entries.remove(key);
  int get length => _entries.length;
}

final postTranslationCacheProvider = Provider<PostTranslationCache>((ref) => PostTranslationCache());

/// `supabase.functions.invoke('translate-post', { body: { post_id, target_lang } })` → the translated text.
Future<String> translatePost(CommunityBackend backend, String postId, String targetLang) async {
  final result = await backend.invoke('translate-post', {'post_id': postId, 'target_lang': targetLang});
  final data = result.data;
  if (result.error != null || data is! Map || data['success'] != true || data['content'] is! String || (data['content'] as String).isEmpty) {
    throw CommunityBackendError(message: data is Map && data['error'] != null ? '${data['error']}' : errorMessage(result.error));
  }
  return data['content'] as String;
}
