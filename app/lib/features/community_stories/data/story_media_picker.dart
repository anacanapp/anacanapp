// Ported from: the hidden file inputs of src/components/community/StoriesBar.tsx
//              (`accept="image/*,video/*"` gallery, `accept="image/*" capture="environment"` camera)
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../chat/platform/chat_media_picker.dart' show pickedMime;

/// A picked file (`File`): path, name, MIME type; [read] loads the bytes.
class StoryPickedFile {
  const StoryPickedFile({required this.path, required this.name, required this.type, required this.read});
  final String path;
  final String name;
  final String type;
  final Future<Uint8List> Function() read;
  bool get isVideo => type.startsWith('video/');
}

abstract interface class StoryMediaPicker {
  /// The gallery (photo or video).
  Future<StoryPickedFile?> pickFromGallery();

  /// The camera (photo).
  Future<StoryPickedFile?> pickFromCamera();
}

class ImagePickerStoryMediaPicker implements StoryMediaPicker {
  ImagePickerStoryMediaPicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  StoryPickedFile _wrap(XFile file) {
    final slash = file.path.replaceAll(r'\', '/').lastIndexOf('/');
    return StoryPickedFile(
      path: file.path,
      name: file.name.isNotEmpty ? file.name : file.path.substring(slash + 1),
      type: pickedMime(file.mimeType, file.path),
      read: file.readAsBytes,
    );
  }

  @override
  Future<StoryPickedFile?> pickFromGallery() async {
    final file = await _picker.pickMedia();
    return file == null ? null : _wrap(file);
  }

  @override
  Future<StoryPickedFile?> pickFromCamera() async {
    final file = await _picker.pickImage(source: ImageSource.camera);
    return file == null ? null : _wrap(file);
  }
}

final storyMediaPickerProvider = Provider<StoryMediaPicker>((ref) => ImagePickerStoryMediaPicker());
