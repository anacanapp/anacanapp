// Ported from: the hidden `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">` /
//              `accept="video/mp4,video/webm,video/quicktime"` of src/components/chat/ConversationScreen.tsx and
//              src/lib/image-compress.ts (1600 px, quality 0.82)
//
// image_picker gallery pickers. Images are scaled to 1600 px / quality 82 by the picker, which stands in for
// compressImageForUpload (the canvas re-encode of the WebView).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../data/chat.dart' show ChatMediaFile;

abstract interface class ChatMediaPicker {
  Future<ChatMediaFile?> pickImage();
  Future<ChatMediaFile?> pickVideo();
}

const Map<String, String> _extensionMime = {
  'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif', //
  'heic': 'image/heic', 'heif': 'image/heif', 'mp4': 'video/mp4', 'm4v': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
};

/// `file.type` of a picked file: the platform MIME, else from the extension.
String pickedMime(String? mimeType, String path) {
  if (mimeType != null && mimeType.isNotEmpty) return mimeType;
  final dot = path.lastIndexOf('.');
  return dot < 0 ? '' : _extensionMime[path.substring(dot + 1).toLowerCase()] ?? '';
}

class ImagePickerChatMediaPicker implements ChatMediaPicker {
  ImagePickerChatMediaPicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  Future<ChatMediaFile?> _read(XFile? file) async {
    if (file == null) return null;
    return ChatMediaFile(await file.readAsBytes(), pickedMime(file.mimeType, file.path));
  }

  @override
  Future<ChatMediaFile?> pickImage() async =>
      _read(await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82));

  @override
  Future<ChatMediaFile?> pickVideo() async => _read(await _picker.pickVideo(source: ImageSource.gallery));
}

final chatMediaPickerProvider = Provider<ChatMediaPicker>((ref) => ImagePickerChatMediaPicker());
