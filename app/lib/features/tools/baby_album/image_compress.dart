// Ported from: src/lib/image-compress.ts
//
// Client-side downscale + re-encode before upload. Phone photos (2–5 MB) become ~150–400 KB at 1600 px. Anything
// that cannot be decoded (HEIC on Android, corrupt files), animated GIF, SVG and small files are uploaded unchanged.
// The canvas decode / draw / toBlob of the WebView is the [ImageCodec] seam: Flutter has no JPEG/WebP encoder
// without a package, so the default codec decodes nothing (the original is uploaded) and the album picker asks
// image_picker for the same 1600 px / 0.82 limits instead (see baby_album_data.dart).
import 'dart:math' as math;
import 'dart:typed_data';

import '../../../domain/js_compat.dart';

const int _maxDimension = 1600;
const double _quality = 0.82;
const int _minBytes = 300 * 1024;
final RegExp _passThrough = RegExp(r'^image/(gif|svg\+xml)$', caseSensitive: false);
const Map<String, String> _ext = {'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png'};

/// A file to upload (`File` / `Blob`).
class UploadFile {
  const UploadFile({required this.bytes, required this.name, required this.type});
  final Uint8List bytes;
  final String name;

  /// MIME type ('' when unknown).
  final String type;
  int get size => bytes.length;
}

/// `createImageBitmap` + canvas: [decodeSize] returns the image size or throws; [encode] draws the image at
/// width×height (white background for JPEG) and returns the encoded bytes, or null (`toBlob` gave nothing).
abstract interface class ImageCodec {
  Future<({int width, int height})> decodeSize(Uint8List bytes);
  Future<Uint8List?> encode(Uint8List bytes, {required int width, required int height, required String type, required double quality});
}

/// No canvas: every image is uploaded unchanged (`typeof createImageBitmap !== 'function'`).
class NoImageCodec implements ImageCodec {
  const NoImageCodec();
  @override
  Future<({int width, int height})> decodeSize(Uint8List bytes) => throw UnsupportedError('no image codec');
  @override
  Future<Uint8List?> encode(Uint8List bytes, {required int width, required int height, required String type, required double quality}) async => null;
}

String _renamed(String name, String type) {
  final ext = _ext[type];
  if (ext == null) return name;
  final dot = name.lastIndexOf('.');
  return '${dot > 0 ? name.substring(0, dot) : (name.isEmpty ? 'image' : name)}.$ext';
}

/// Returns a smaller image file, or the original when compression would not help.
Future<UploadFile> compressImageForUpload(
  UploadFile file, {
  ImageCodec codec = const NoImageCodec(),
  int maxDimension = _maxDimension,
  double quality = _quality,
  int minBytes = _minBytes,
  bool jpeg = false,
}) async {
  final type = file.type.toLowerCase();
  if (!type.startsWith('image/') || _passThrough.hasMatch(type) || file.size < minBytes) return file;
  ({int width, int height}) bitmap;
  try {
    bitmap = await codec.decodeSize(file.bytes);
  } catch (_) {
    return file;
  }
  try {
    final scale = math.min(1, maxDimension / math.max(bitmap.width, bitmap.height));
    final width = math.max(1, jsRoundInt(bitmap.width * scale));
    final height = math.max(1, jsRoundInt(bitmap.height * scale));
    // PNG may carry transparency: ask for WebP (keeps alpha). Everything else becomes JPEG.
    final target = type == 'image/png' && !jpeg ? 'image/webp' : 'image/jpeg';
    final blob = await codec.encode(file.bytes, width: width, height: height, type: target, quality: quality);
    if (blob == null || blob.length >= file.size) return file;
    return UploadFile(bytes: blob, name: _renamed(file.name, target), type: target);
  } catch (_) {
    return file;
  }
}
