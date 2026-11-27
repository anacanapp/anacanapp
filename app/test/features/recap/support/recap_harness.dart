// Ported from: (test harness for the recap port — no React counterpart)
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/domain/recap/recap_model.dart' show RecapLabels;
import 'package:anacan/features/recap/recap_audio.dart';
import 'package:anacan/features/recap/recap_export.dart';
import 'package:anacan/features/recap/recap_render.dart';
import 'package:anacan/features/recap/use_recap.dart';
import 'package:anacan/native/purchases/purchase_analytics.dart';
import 'package:anacan/native/purchases/purchases_providers.dart';
import 'package:anacan/state/shell_bindings.dart' show backendUrlProvider;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../settings/support/harness.dart';

export '../../settings/support/harness.dart' show pumpApp, screenTest, testUser;

class FakeRecapRepository implements RecapRepository {
  FakeRecapRepository({this.raw, this.error});
  Object? raw;
  Object? error;
  final List<int> calls = [];

  /// A response that is held until [release] (loading state tests).
  Completer<void>? gate;

  @override
  Future<Object?> recap(int year) async {
    calls.add(year);
    if (gate != null) await gate!.future;
    if (error != null) throw error!;
    return raw;
  }

  @override
  Future<Map<String, String>> toolLabels(String language) async => const {'baby-tracker': 'Körpə izləyici'};

  @override
  Future<Map<String, String>> symptomLabels(String language) async => const {'bloating': 'şişkinlik'};
}

PostgrestException missingRpc() => const PostgrestException(message: 'Could not find the function public.anacan_recap_v1(p_year)', code: 'PGRST202');

class FakeShare implements RecapShareService {
  FakeShare([this.outcome = 'shared']);
  String outcome;
  final List<({String fileName, String mimeType, String text, int bytes})> calls = [];
  @override
  Future<String> share(Uint8List bytes, {required String fileName, required String mimeType, required String text, String mode = 'share'}) async {
    calls.add((fileName: fileName, mimeType: mimeType, text: text, bytes: bytes.length));
    return outcome;
  }
}

class FakeEncoder implements RecapVideoEncoder {
  FakeEncoder({this.fail});
  final String? fail;
  Completer<void>? gate;
  RecapAbort? signal;
  @override
  bool get supported => true;
  @override
  Future<RecapVideo> record(Map<String, Object?> model, RecapAssets assets,
      {required String musicAsset, required RecapAbort signal, required void Function(double progress) onProgress}) async {
    this.signal = signal;
    onProgress(0.5);
    if (gate != null) await gate!.future;
    if (signal.aborted) throw const RecapExportError('ABORTED');
    if (fail != null) throw RecapExportError(fail!);
    return RecapVideo(Uint8List(8), 'video/mp4');
  }
}

class FakeAudio implements RecapAudio {
  bool refuse = false;
  bool _playing = false;
  bool isMuted = false;
  @override
  double position = 0;
  @override
  bool get playing => _playing;
  @override
  set muted(bool value) => isMuted = value;
  @override
  Future<void> play() async {
    if (refuse) throw StateError('NotAllowedError');
    _playing = true;
  }

  @override
  void pause() => _playing = false;
  @override
  void dispose() {}
}

/// Overrides for the recap screen and hooks (signed-in user-1 unless [signedIn] is false).
List<Override> recapOverrides({
  required FakeRecapRepository repo,
  RecordingAnalyticsSink? analytics,
  RecapShareService? share,
  RecapVideoEncoder? encoder,
  bool signedIn = true,
}) =>
    [
      ...baseOverrides(signedIn: signedIn),
      backendUrlProvider.overrideWithValue('https://api.test'),
      recapRepositoryProvider.overrideWithValue(repo),
      recapLabelsProvider.overrideWithValue(RecapLabels(milestone: (id) => id, symptom: (id) => id, tool: (id) => id)),
      recapAssetsLoaderProvider.overrideWithValue((_) => Future.value(const RecapAssets())),
      recapImageRendererProvider.overrideWithValue((_, _) async => Uint8List(4)),
      analyticsSinkProvider.overrideWithValue(analytics ?? RecordingAnalyticsSink()),
      recapShareServiceProvider.overrideWithValue(share ?? FakeShare()),
      if (encoder != null) recapVideoEncoderProvider.overrideWithValue(encoder),
    ];
