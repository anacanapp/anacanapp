// Ported from: src/lib/native.ts (saveImageToGallery), src/lib/image-compress.ts (createImageBitmap + canvas
//              toBlob('image/jpeg', quality) on a white background), src/components/community-stories (canvas.toBlob
//              'image/jpeg' 0.94), src/components/shop/AlbumOrderScreen.tsx (`<input type="file"
//              accept="image/*,application/pdf">`), src/lib/pdfReport.ts (deliverPdf: @capacitor/filesystem Cache +
//              @capacitor/share)
//
// The media plugins of the app build: gal (photo library), the `image` package (JPEG encoder; decoding and scaling
// stay with the engine), file_picker (PDF proof), share_plus + path_provider (report files).
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:gal/gal.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../features/album_order/album_order_screen.dart' show AlbumProofFile;
import '../../features/community_stories/editor/story_painter.dart' show StoryImageEncoder, StoryImageFile;
import '../../features/community_stories/editor/story_scene.dart' show StoryEditorException;
import '../../features/health_screens/doctor_report/pdf_report.dart';
import '../../features/tools/baby_album/image_compress.dart' show ImageCodec;
import 'mobile_host.dart';

// ── Save to the photo library ──

Future<Uint8List> _imageBytes(String url) async {
  if (url.startsWith('data:')) {
    final comma = url.indexOf(',');
    return base64Decode(url.substring(comma + 1));
  }
  final response = await http.get(Uri.parse(url));
  if (response.statusCode < 200 || response.statusCode >= 300) throw HttpException('Failed to fetch image: ${response.statusCode}');
  return response.bodyBytes;
}

/// `saveImageToGallery(url, fileName)`: downloads the image and adds it to the photo library (the WebView build
/// wrote it to Pictures on Android and opened the share sheet on iOS). Never throws.
Future<bool> saveImageToPhotoLibrary(String url, String fileName) async {
  try {
    final bytes = await _imageBytes(url);
    final dot = fileName.lastIndexOf('.');
    final name = dot > 0 ? fileName.substring(0, dot) : (fileName.isEmpty ? 'anacan-photo-${DateTime.now().millisecondsSinceEpoch}' : fileName);
    await Gal.putImageBytes(bytes, name: name);
    return true;
  } catch (error) {
    debugPrint('Save to gallery failed: $error');
    return false;
  }
}

// ── JPEG encoding ──

Uint8List _encodeJpeg(({Uint8List rgba, int width, int height, int quality}) job) {
  final source = img.Image.fromBytes(width: job.width, height: job.height, bytes: job.rgba.buffer, numChannels: 4, order: img.ChannelOrder.rgba);
  // JPEG has no alpha: draw on white, like the canvas fill before drawImage.
  final flat = img.Image(width: job.width, height: job.height)..clear(img.ColorRgb8(255, 255, 255));
  img.compositeImage(flat, source);
  return img.encodeJpg(flat, quality: job.quality);
}

Future<Uint8List?> _jpegFromImage(ui.Image image, double quality) async {
  final data = await image.toByteData(format: ui.ImageByteFormat.rawStraightRgba);
  if (data == null) return null;
  return compute(_encodeJpeg, (
    rgba: data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
    width: image.width,
    height: image.height,
    quality: (quality * 100).round().clamp(1, 100),
  ));
}

/// [ImageCodec] for compressImageForUpload: the engine decodes (EXIF orientation applied) and scales, the `image`
/// package encodes JPEG. WebP has no encoder here: those uploads keep the original (`toBlob` gave nothing).
class EngineJpegImageCodec implements ImageCodec {
  const EngineJpegImageCodec();

  @override
  Future<({int width, int height})> decodeSize(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final size = (width: frame.image.width, height: frame.image.height);
    frame.image.dispose();
    codec.dispose();
    return size;
  }

  @override
  Future<Uint8List?> encode(Uint8List bytes, {required int width, required int height, required String type, required double quality}) async {
    if (type != 'image/jpeg') return null;
    final codec = await ui.instantiateImageCodec(bytes, targetWidth: width, targetHeight: height);
    final frame = await codec.getNextFrame();
    try {
      return await _jpegFromImage(frame.image, quality);
    } finally {
      frame.image.dispose();
      codec.dispose();
    }
  }
}

/// `canvas.toBlob(cb, 'image/jpeg', 0.94)` for the story export.
class JpegStoryImageEncoder implements StoryImageEncoder {
  const JpegStoryImageEncoder();
  @override
  Future<StoryImageFile> encode(ui.Image image) async {
    final bytes = await _jpegFromImage(image, 0.94);
    if (bytes == null) throw const StoryEditorException('STORY_EXPORT_FAILED');
    return StoryImageFile(bytes: bytes, type: 'image/jpeg', extension: 'jpg');
  }
}

// ── Album payment proof ──

const Map<String, String> _proofMime = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'heic': 'image/heic',
  'heif': 'image/heif',
  'gif': 'image/gif',
  'pdf': 'application/pdf',
};

/// `accept="image/*,application/pdf"`. Android: the system document picker (images and PDFs, as the WebView's
/// chooser). iOS: the photo library (where transfer screenshots are); the Files picker cannot show Photos.
Future<AlbumProofFile?> pickAlbumProof() async {
  if (isIOSHost) {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (x == null) return null;
    return (name: x.name, bytes: await x.readAsBytes(), mimeType: x.mimeType);
  }
  final file = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: _proofMime.keys.toList());
  if (file == null) return null;
  final ext = (file.extension ?? '').toLowerCase();
  return (name: file.name, bytes: await file.readAsBytes(), mimeType: _proofMime[ext]);
}

// ── Doctor report files ──

/// `deliverPdf`'s native branch: the cache folder (Capacitor `Directory.Cache` = the app cache directory) and the
/// system share sheet.
class SharePlusPdfDelivery implements PdfDeliveryPlatform {
  const SharePlusPdfDelivery();

  Future<String> _root() async => (await getTemporaryDirectory()).path;

  @override
  bool get canShareFiles => true;

  @override
  Future<List<CachedPdfFile>> listCache(String folder) async {
    final dir = Directory('${await _root()}/$folder');
    final files = <CachedPdfFile>[];
    await for (final entity in dir.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.last;
      files.add(CachedPdfFile(name: name, mtime: (await entity.lastModified()).millisecondsSinceEpoch));
    }
    return files;
  }

  @override
  Future<void> deleteCache(String path) async => File('${await _root()}/$path').delete();

  @override
  Future<String> writeCache(String path, Uint8List bytes) async {
    final file = File('${await _root()}/$path');
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  @override
  Future<void> share({required String title, required List<String> files, required String dialogTitle}) async {
    final result = await SharePlus.instance.share(ShareParams(
      files: [for (final f in files) XFile(f, mimeType: 'application/pdf')],
      title: dialogTitle,
      subject: title,
    ));
    if (result.status == ShareResultStatus.dismissed) throw const PdfShareCancelled();
  }

  @override
  Future<void> saveDownload(String fileName, Uint8List bytes) async {
    final path = await writeCache('doctor-reports/$fileName', bytes);
    await share(title: fileName, files: [path], dialogTitle: fileName);
  }
}
