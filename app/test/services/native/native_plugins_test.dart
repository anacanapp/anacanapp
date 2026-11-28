// Ported from: the plugin behaviour the WebView build relied on (Capacitor LocalNotifications `extra`, FCM
//              permission states, src/store/whiteNoiseStore.ts generateNoiseBuffer, word-garden audio.ts tones,
//              the AnalyserNode byte scale) — the pure parts of the native plugin adapters
import 'dart:typed_data';

import 'package:anacan/services/native/audio_players.dart';
import 'package:anacan/services/native/mobile_host.dart';
import 'package:anacan/services/native/permissions.dart';
import 'package:anacan/services/native/record_audio.dart';
import 'package:anacan/services/native/services_wiring.dart';
import 'package:anacan/services/notifications/flutter_local_notification_backend.dart';
import 'package:anacan/services/notifications/local_notification_backend.dart';
import 'package:anacan/services/push/firebase_push_platform.dart';
import 'package:anacan/services/push/notification_tap_listeners.dart';
import 'package:anacan/services/push/push_platform.dart';
import 'package:firebase_messaging/firebase_messaging.dart' show AuthorizationStatus;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('host gate', () {
    test('a desktop test host keeps every web default', () {
      expect(isMobileHost, isFalse);
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(localNotificationBackendProvider), isA<UnavailableLocalNotificationBackend>());
      expect(container.read(pushPlatformProvider), isA<WebPushPlatform>());
      expect(container.read(nativePermissionsProvider).isNative, isFalse);
      expect(defaultNotificationTapSources().isNative, isFalse);
    });
  });

  group('local notification payload', () {
    test('carries `extra` as JSON and gives it back on a tap', () {
      final payload = encodeLocalExtra({'type': 'vaccine', 'deeplink': '/tools/vaccines', 'n': 2});
      expect(decodeLocalExtra(payload), {'type': 'vaccine', 'deeplink': '/tools/vaccines', 'n': 2});
      expect(encodeLocalExtra(null), isNull);
      expect(decodeLocalExtra(null), isNull);
      expect(decodeLocalExtra('not json'), isNull);
    });
  });

  group('push permission', () {
    test('maps iOS authorization like the Capacitor plugin', () {
      expect(receiveFromAuthorization(AuthorizationStatus.authorized), 'granted');
      expect(receiveFromAuthorization(AuthorizationStatus.provisional), 'granted');
      expect(receiveFromAuthorization(AuthorizationStatus.denied), 'denied');
      expect(receiveFromAuthorization(AuthorizationStatus.notDetermined), 'prompt');
    });
  });

  group('audio', () {
    test('writes 16-bit mono WAV', () {
      final wav = wavBytes(Float32List.fromList([0, 1, -1, 0.5]), sampleRate: 8000);
      expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(wav.sublist(8, 12)), 'WAVE');
      final data = ByteData.sublistView(wav);
      expect(data.getUint32(24, Endian.little), 8000);
      expect(data.getUint32(40, Endian.little), 8);
      expect(data.getInt16(46, Endian.little), 32767);
      expect(data.getInt16(48, Endian.little), -32767);
    });

    test('generates 4 s of bounded noise for every type', () {
      for (final type in ['white', 'pink', 'brown']) {
        final noise = generateNoise(type, sampleRate: 1000);
        expect(noise.length, 4000);
        expect(noise.every((s) => s.abs() <= 1.5), isTrue, reason: type);
        expect(noise.any((s) => s != 0), isTrue, reason: type);
      }
    });

    test('renders the garden tones with the React envelope', () {
      final letter = JustAudioGameTonePlayer.render('letter', sampleRate: 8000);
      final win = JustAudioGameTonePlayer.render('win', sampleRate: 8000);
      // letter: one 0.2 s tone; win: four tones 0.09 s apart.
      expect((letter.length - 44) ~/ 2, (0.2 * 8000).ceil());
      expect((win.length - 44) ~/ 2, ((0.09 * 3 + 0.2) * 8000).ceil());
      final samples = ByteData.sublistView(letter);
      var peak = 0;
      for (var i = 44; i < letter.length; i += 2) {
        peak = samples.getInt16(i, Endian.little).abs() > peak ? samples.getInt16(i, Endian.little).abs() : peak;
      }
      expect(peak / 32767, closeTo(0.025, 0.003));
    });

    test('the analyser reports silence without a stream and accepts only AAC/MP4 recordings', () {
      final analyser = RecordAnalyser()..fftSize = 256;
      expect(analyser.frequencyBinCount, 128);
      final bytes = Uint8List(128)..fillRange(0, 128, 7);
      analyser.getByteFrequencyData(bytes);
      expect(bytes.every((b) => b == 0), isTrue);
      const api = RecordMediaRecorderApi();
      expect(api.isTypeSupported('audio/mp4'), isTrue);
      expect(api.isTypeSupported('audio/webm'), isFalse);
    });
  });

  test('the push port of the app build has no Capacitor fallback', () {
    final platform = FirebasePushPlatform(platform: 'ios');
    expect(platform.isNative, isTrue);
    expect(platform.fallback, isNull);
    expect(platform.messaging, isA<PushMessagingPort>());
  });
}
