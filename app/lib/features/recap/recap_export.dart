// Ported from: src/lib/recap/export.ts, src/lib/recap/font-loader.ts (loadRecapFonts: nothing to wait for here)
//
// Assets (logos + the grain tile), the summary PNG, sharing, and the video-recording seam.
// The frames come from renderRecapFrame (recap_render.dart), the same function the player draws with.
//
// Video: the web records canvas.captureStream(30) + the music (WebAudio) with MediaRecorder (MP4 first, then
// WebM) in real time (~52 s). Flutter has no equivalent without a native encoder, so recording sits behind
// [RecapVideoEncoder]; the default reports "not supported" and the screen follows React's
// `recordingSupported() === false` branch (share the summary card as an image only).
import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'recap_anim.dart';
import 'recap_canvas.dart';
import 'recap_render.dart';

/// `RECAP_MUSIC_2026.src` (`/recap/recap-2026.mp3`) as a bundled asset path.
const String recapMusicAsset = 'assets/recap/recap-2026.mp3';

/// public/brand-mark-white.png → this asset (to be added, see README).
const String recapLogoWhiteAsset = 'assets/images/recap/brand-mark-white.png';

/// public/brand-mark-coral.png (byte-identical copy already bundled for the profile).
const String recapLogoCoralAsset = 'assets/images/profile/brand-mark-coral.png';

class RecapExportError implements Exception {
  const RecapExportError(this.code, [this.cause]);
  final String code;
  final Object? cause;
  @override
  String toString() => 'RecapExportError($code)';
}

/// 256×256 RGBA noise (the same LCG as the web tile).
Uint8List recapGrainPixels() {
  final data = Uint8List(256 * 256 * 4);
  var a = 1234567;
  for (var i = 0; i < data.length; i += 4) {
    a = grainLcgNext(a);
    final v = a >> 24;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return data;
}

Future<RecapImage?> _grainTile() {
  final done = Completer<RecapImage?>();
  try {
    ui.decodeImageFromPixels(recapGrainPixels(), 256, 256, ui.PixelFormat.rgba8888, (img) => done.complete(UiRecapImage(img)));
  } catch (_) {
    done.complete(null);
  }
  return done.future;
}

Future<RecapImage?> _loadImage(String asset) async {
  try {
    final data = await rootBundle.load(asset);
    final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
    final frame = await codec.getNextFrame();
    return UiRecapImage(frame.image);
  } catch (_) {
    return null;
  }
}

/// Brand fonts are bundled (no FontFace step), then the real Anacan marks and the grain. Never throws.
Future<RecapAssets> loadRecapAssets(Map<String, Object?>? model) async {
  final results = await Future.wait([_loadImage(recapLogoWhiteAsset), _loadImage(recapLogoCoralAsset), _grainTile()]);
  return RecapAssets(logoWhite: results[0], logoCoral: results[1], grain: results[2]);
}

/// The summary card as a PNG (the "share as image" fallback).
Future<Uint8List> renderRecapImage(Map<String, Object?> model, RecapAssets assets) async {
  final recorder = ui.PictureRecorder();
  final canvas = ui.Canvas(recorder, const ui.Rect.fromLTWH(0, 0, recapW, recapH));
  renderRecapFrame(UiRecapCtx(canvas), summaryStillTime(model), model, assets);
  final picture = recorder.endRecording();
  final image = await picture.toImage(recapW.toInt(), recapH.toInt());
  picture.dispose();
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  if (bytes == null) throw const RecapExportError('PNG');
  return bytes.buffer.asUint8List();
}

/// `'shared' | 'downloaded' | 'cancelled'`.
typedef RecapShareOutcome = String;

/// shareRecap: native writes the file and opens the share sheet (Instagram, TikTok, WhatsApp, Save).
abstract interface class RecapShareService {
  Future<RecapShareOutcome> share(Uint8List bytes, {required String fileName, required String mimeType, required String text, String mode = 'share'});
}

class SharePlusRecapShare implements RecapShareService {
  const SharePlusRecapShare();
  @override
  Future<RecapShareOutcome> share(Uint8List bytes, {required String fileName, required String mimeType, required String text, String mode = 'share'}) async {
    try {
      final result = await SharePlus.instance.share(ShareParams(
        title: fileName,
        text: text,
        files: [XFile.fromData(bytes, name: fileName, mimeType: mimeType)],
        fileNameOverrides: [fileName],
      ));
      return result.status == ShareResultStatus.dismissed ? 'cancelled' : 'shared';
    } catch (error) {
      if (RegExp('cancel', caseSensitive: false).hasMatch('$error')) return 'cancelled';
      throw RecapExportError('SHARE_SHEET', error);
    }
  }
}

final recapShareServiceProvider = Provider<RecapShareService>((ref) => const SharePlusRecapShare());

/// Renders the summary card PNG (overridable in tests; `toImage` needs a real engine frame).
final recapImageRendererProvider = Provider<Future<Uint8List> Function(Map<String, Object?> model, RecapAssets assets)>((ref) => renderRecapImage);

/// Loads the logos and grain (overridable in tests).
final recapAssetsLoaderProvider = Provider<Future<RecapAssets> Function(Map<String, Object?> model)>((ref) => loadRecapAssets);

/// `AbortController` for a recording.
class RecapAbort {
  bool _aborted = false;
  bool get aborted => _aborted;
  void abort() => _aborted = true;
}

class RecapVideo {
  const RecapVideo(this.bytes, this.mimeType);
  final Uint8List bytes;

  /// `video/mp4` or `video/webm`.
  final String mimeType;
}

/// recordRecapVideo seam. A native implementation (phase 9) renders frames at 30 fps with renderRecapFrame on a
/// PictureRecorder (`toImage` → RGBA), feeds them to a platform H.264 encoder (AVAssetWriter on iOS,
/// MediaCodec + MediaMuxer on Android), muxes [recapMusicAsset] with a linear fade from `model.fadeStart` to
/// `model.duration` into an MP4, and reports progress 0→1. It throws [RecapExportError] with `ABORTED`
/// (abort signalled), `INTERRUPTED` (app sent to the background), `EMPTY`, or `RECORDER`.
abstract interface class RecapVideoEncoder {
  /// `recordingSupported()`.
  bool get supported;
  Future<RecapVideo> record(Map<String, Object?> model, RecapAssets assets,
      {required String musicAsset, required RecapAbort signal, required void Function(double progress) onProgress});
}

class UnsupportedRecapVideoEncoder implements RecapVideoEncoder {
  const UnsupportedRecapVideoEncoder();
  @override
  bool get supported => false;
  @override
  Future<RecapVideo> record(Map<String, Object?> model, RecapAssets assets,
          {required String musicAsset, required RecapAbort signal, required void Function(double progress) onProgress}) =>
      Future.error(const RecapExportError('UNSUPPORTED'));
}

final recapVideoEncoderProvider = Provider<RecapVideoEncoder>((ref) => const UnsupportedRecapVideoEncoder());
