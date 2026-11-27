// Ported from: src/components/tools/CryTranslator.test.tsx
import 'dart:async';
import 'dart:convert' show base64Encode;
import 'dart:typed_data';

import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/domain/billing/usage_limits.dart' show UsageDecision;
import 'package:anacan/features/tools/cry/cry_translator.dart';
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/media_common/audio_recording.dart';
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/audio_fakes.dart';
import '../media_common/media_harness.dart';

const _failed = 'Səsi emal etmək mümkün olmadı. Yenidən cəhd edin.';

class CryEnv {
  CryEnv() {
    world.recorders.supported = (type) => type == 'audio/webm';
    env.db.functions['analyze-cry'] = (_) => {
      'success': true,
      'analysis': {'cryType': 'hungry', 'confidence': 80, 'explanation': 'Test result', 'recommendations': <String>[], 'urgency': 'low'},
    };
  }

  final MediaEnv env = MediaEnv();
  final AudioWorld world = AudioWorld();
  final List<String> readMimeTypes = [];
  Completer<String>? pendingRead;
  int backs = 0;

  List<({String op, String table, Object? body})> get invokes => env.db.callsOf('invoke', 'analyze-cry');

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    CryTranslator(onBack: () => backs++),
    overrides: [
      ...env.overrides,
      audioPlatformProvider.overrideWithValue(world.platform),
      cryBase64ReaderProvider.overrideWithValue((Uint8List bytes, String mimeType) {
        readMimeTypes.add(mimeType);
        final pending = pendingRead;
        if (pending != null) return pending.future;
        return Future.value(base64Encode(bytes));
      }),
    ],
  );
}

Future<void> clickMic(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('cry-mic')));
  await settle(tester);
}

Future<void> clickBack(WidgetTester tester) async {
  await tester.tap(find.byWidgetPredicate((w) => w is ToolIconButton && w.semanticLabel == 'Geri'));
  await settle(tester);
}

Future<void> finishRecording(WidgetTester tester, CryEnv e) async {
  await tester.pump(const Duration(seconds: 3));
  await clickMic(tester);
  e.world.recorders.instances.first.finish();
  await settle(tester);
}

CryTranslatorState stateOf(WidgetTester tester) => tester.state<CryTranslatorState>(find.byType(CryTranslator));

void main() {
  group('CryTranslator microphone lifecycle', () {
    testWidgets('acquires once, reuses that live stream, and ignores taps while acquisition is pending', (tester) async {
      final e = CryEnv();
      final grant = e.world.pendingGrant();
      await e.pump(tester);
      await clickMic(tester);
      await clickMic(tester);
      grant.complete(e.world.stream);
      await settle(tester);

      expect(e.world.devices.requests, [true]);
      expect(e.world.context.sources, [e.world.stream]);
      expect(e.world.recorders.constructed.single.stream, same(e.world.stream));
      expect(e.world.recorders.constructed.single.mimeType, 'audio/webm');
      expect(e.world.recorders.instances.first.state, 'recording');
      expect(e.world.stream.track.stops, 0);
      expect(e.world.context.closes, 0);
      await unmountMediaTool(tester);
    });

    for (final action in ['back', 'unmount']) {
      testWidgets('releases a late microphone grant after $action without starting a recorder', (tester) async {
        final e = CryEnv();
        final grant = e.world.pendingGrant();
        await e.pump(tester);
        await clickMic(tester);
        if (action == 'back') {
          await clickBack(tester);
        } else {
          await unmountMediaTool(tester);
        }
        grant.complete(e.world.stream);
        await settle(tester);

        expect(e.world.stream.track.stops, 1);
        expect(e.world.contextConstructions, 0);
        expect(e.world.recorders.constructed, isEmpty);
        expect(e.invokes, isEmpty);
        expect(e.env.toasts, isEmpty);
        await unmountMediaTool(tester);
      });
    }

    testWidgets('discards active recording on unmount and releases its timer, stream and AudioContext', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      final recorder = e.world.recorders.instances.first;
      expect(stateOf(tester).hasRecordingTimer, isTrue);
      await unmountMediaTool(tester);
      recorder.finish();

      expect(recorder.stops, 1);
      expect(recorder.ondataavailable, isNull);
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      expect(e.world.frames.cancelled, contains(0));
      expect(e.env.usage.consumed, isEmpty);
      expect(e.invokes, isEmpty);
    });

    testWidgets('discards a recording shorter than three seconds instead of analyzing it', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      await tester.pump(const Duration(seconds: 2));
      await clickMic(tester);
      e.world.recorders.instances.first.finish();
      await settle(tester);

      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      expect(stateOf(tester).hasRecordingTimer, isFalse);
      expect(e.env.usage.consumed, isEmpty);
      expect(e.env.toasts.map((t) => t.title), contains('Çox qısa'));
      await unmountMediaTool(tester);
    });

    for (final phase in ['context', 'analyser', 'recorder', 'start']) {
      testWidgets('releases acquired resources when $phase setup fails without calling it a permission denial', (tester) async {
        final e = CryEnv();
        const fail = AudioException('SecurityError', 'permission-related recorder failure');
        if (phase == 'context') e.world.failNextContext = fail;
        if (phase == 'analyser') e.world.context.failSource = fail;
        if (phase == 'recorder') e.world.recorders.failNextConstruct = fail;
        if (phase == 'start') e.world.recorders.failNextStart = fail;
        await e.pump(tester);
        await clickMic(tester);

        expect(e.world.stream.track.stops, 1);
        expect(e.world.context.closes, phase == 'context' ? 0 : 1);
        expect(stateOf(tester).hasRecordingTimer, isFalse);
        expect(e.invokes, isEmpty);
        expect(e.env.toasts.map((t) => t.description), contains(_failed));
        await unmountMediaTool(tester);
      });
    }

    for (final (name, description) in [
      ('NotAllowedError', 'Parametrlərdən mikrofon icazəsini aktivləşdirin'),
      ('NotReadableError', 'Mikrofonu yoxlayın, ondan istifadə edən digər tətbiqləri bağlayın və yenidən cəhd edin.'),
      ('NotSupportedError', 'Bu cihazda mikrofonla işləmək dəstəklənmir. Tətbiqi və ya brauzeri yeniləyin.'),
    ]) {
      testWidgets('reports capture $name accurately', (tester) async {
        final e = CryEnv();
        e.world.devices.answer = () => Future<MicStream>.error(AudioException(name, 'Capture failed'));
        await e.pump(tester);
        await clickMic(tester);
        expect(e.env.toasts.map((t) => t.description), contains(description));
        expect(e.world.contextConstructions, 0);
        await unmountMediaTool(tester);
      });
    }

    for (final supported in ['audio/mp4', 'audio/ogg', null]) {
      testWidgets('rejects unavailable WebM instead of falling back to $supported, with cleanup and no permission-denied toast', (tester) async {
        final e = CryEnv();
        e.world.recorders.supported = (type) => type == supported;
        await e.pump(tester);
        await clickMic(tester);

        expect(e.world.devices.requests, hasLength(1));
        expect(e.world.recorders.constructed, isEmpty);
        expect(e.world.stream.track.stops, 1);
        expect(e.world.context.closes, 1);
        expect(e.world.frames.cancelled, contains(0));
        expect(stateOf(tester).hasRecordingTimer, isFalse);
        expect(e.env.usage.consumed, isEmpty);
        expect(e.invokes, isEmpty);
        expect(e.env.toasts, [
          const MediaToastData(
            title: 'Mikrofon xətası',
            description: 'Bu cihazda mikrofonla işləmək dəstəklənmir. Tətbiqi və ya brauzeri yeniləyin.',
            destructive: true,
          ),
        ]);
        await unmountMediaTool(tester);
      });
    }

    testWidgets('releases resources and discards data after a MediaRecorder error event', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      final recorder = e.world.recorders.instances.first;
      recorder.onerror?.call('error event');
      recorder.finish();
      await settle(tester);
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      expect(stateOf(tester).hasRecordingTimer, isFalse);
      expect(e.invokes, isEmpty);
      expect(e.env.toasts.map((t) => t.description), contains(_failed));
      await unmountMediaTool(tester);
    });
  });

  group('CryTranslator recording completion', () {
    for (final actual in ['audio/webm', 'audio/webm;codecs=opus']) {
      testWidgets('records $actual and uses the deployed analyze-cry payload without a MIME field', (tester) async {
        final e = CryEnv();
        e.world.recorders.reportedMimeType = actual;
        await e.pump(tester);
        await clickMic(tester);
        await finishRecording(tester, e);

        expect(e.world.recorders.constructed.single.mimeType, 'audio/webm');
        expect(e.readMimeTypes.single, actual);
        expect(e.invokes, hasLength(1));
        expect(e.invokes.single.body, {'audioBase64': 'Y3J5', 'audioDuration': 3, 'userContext': <String, Object?>{}, 'language': 'en'});
        expect(e.world.stream.track.stops, 1);
        expect(e.world.context.closes, 1);
        expect(find.text('Analiz tamamlandı'), findsOneWidget);
        await unmountMediaTool(tester);
      });
    }

    testWidgets('auto-stops at ten seconds using current recorder state and duration', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      await tester.pump(const Duration(seconds: 10));
      final recorder = e.world.recorders.instances.first;
      expect(recorder.stops, 1);
      recorder.finish();
      await settle(tester);
      expect(e.invokes, hasLength(1));
      expect((e.invokes.single.body as Map)['audioDuration'], 10);
      expect(stateOf(tester).hasRecordingTimer, isFalse);
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      await unmountMediaTool(tester);
    });

    testWidgets('ignores a stop callback already queued when the user leaves', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      await tester.pump(const Duration(seconds: 3));
      await clickMic(tester);
      final queuedStop = e.world.recorders.instances.first.onstop;
      await clickBack(tester);
      queuedStop?.call();
      await settle(tester);
      expect(e.backs, 1);
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      expect(e.env.usage.consumed, isEmpty);
      expect(e.invokes, isEmpty);
      await unmountMediaTool(tester);
    });

    testWidgets('does not upload after unmount while the usage check is pending', (tester) async {
      final e = CryEnv();
      final allow = Completer<UsageDecision>();
      e.env.usage.onConsume = (_) => allow.future;
      await e.pump(tester);
      await clickMic(tester);
      await finishRecording(tester, e);
      await unmountMediaTool(tester);
      allow.complete(const UsageDecision(allowed: true, remaining: 1, limit: 3));
      await settle(tester);
      expect(e.readMimeTypes, isEmpty);
      expect(e.invokes, isEmpty);
    });

    testWidgets('does not upload after unmount while FileReader is pending', (tester) async {
      final e = CryEnv();
      e.pendingRead = Completer<String>();
      await e.pump(tester);
      await clickMic(tester);
      await finishRecording(tester, e);
      await unmountMediaTool(tester);
      e.pendingRead!.complete('Y3J5');
      await settle(tester);
      expect(e.invokes, isEmpty);
      expect(e.env.toasts, isEmpty);
    });

    testWidgets('aborts an in-flight analysis and ignores its late response after unmount', (tester) async {
      final e = CryEnv();
      final respond = Completer<Object?>();
      e.env.db.functions['analyze-cry'] = (_) => respond.future;
      await e.pump(tester);
      await clickMic(tester);
      await finishRecording(tester, e);
      expect(e.invokes, hasLength(1));
      await unmountMediaTool(tester);
      respond.complete(DbResult<Object?>(error: StateError('Aborted request')));
      await settle(tester);
      expect(e.env.toasts, isEmpty);
    });

    testWidgets('handles asynchronous analysis failures instead of leaking a FileReader callback rejection', (tester) async {
      final e = CryEnv();
      e.env.db.functions['analyze-cry'] = (_) => Future<Object?>.error(StateError('Analysis unavailable'));
      await e.pump(tester);
      await clickMic(tester);
      await finishRecording(tester, e);
      expect(e.env.toasts.map((t) => t.title), contains('Analiz xətası'));
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);
      await unmountMediaTool(tester);
    });
  });

  group('CryTranslator safety copy', () {
    testWidgets('always shows the red-flag line with a call link to the emergency number', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      expect(find.textContaining('3 aydan kiçik körpədə hərarət'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cry-call')));
      expect(e.env.calls.single.toString(), matches(RegExp(r'^tel:\d+$')));
      await unmountMediaTool(tester);
    });

    testWidgets('shows a qualitative hint instead of the uncalibrated confidence percentage', (tester) async {
      final e = CryEnv();
      await e.pump(tester);
      await clickMic(tester);
      await finishRecording(tester, e);
      expect(find.text('Ehtimal olunan səbəb'), findsOneWidget);
      expect(find.textContaining('80'), findsNothing);
      expect(find.textContaining('Əminlik'), findsNothing);
      await unmountMediaTool(tester);
    });
  });
}
