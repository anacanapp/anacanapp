// Ported from: src/plugins/LiveActivityPlugin.ts, src/lib/healthCycle.ts / healthVitals.ts (plugin calls),
//              src/lib/facebook-events.ts (plugin calls), src/lib/home-widgets.ts (pushWidgetSnapshot)
//
// The method-channel clients against a fake native side (TestDefaultBinaryMessenger): method names and arguments
// must match MainActivity's Kotlin handlers and the Runner's Swift channels.
import 'package:anacan/domain/cycle/health_cycle.dart';
import 'package:anacan/features/baby/live_timer/live_timer_bridge.dart';
import 'package:anacan/features/settings/widget_settings_screen.dart';
import 'package:anacan/native/platform/facebook_events_channel.dart';
import 'package:anacan/native/platform/health_channels.dart';
import 'package:anacan/native/platform/home_widgets/home_widget_snapshot.dart';
import 'package:anacan/native/platform/home_widgets/home_widgets_channel.dart';
import 'package:anacan/native/platform/live_timer_channel.dart';
import 'package:anacan/features/settings/copy/feature_copy.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

final List<MethodCall> calls = <MethodCall>[];

void answer(String channel, Object? Function(MethodCall call) handler) {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(MethodChannel(channel), (call) async {
    calls.add(call);
    return handler(call);
  });
}

void unanswer(String channel) =>
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(MethodChannel(channel), null);

/// Delivers a native → Dart method call on [channel].
Future<void> fromNative(String channel, MethodCall call) async {
  final data = const StandardMethodCodec().encodeMethodCall(call);
  await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.handlePlatformMessage(channel, data, (_) {});
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(calls.clear);

  group('LiveActivity (anacan/live_timer)', () {
    tearDown(() => unanswer('anacan/live_timer'));

    test('sends the Capacitor options and parses pending stops', () async {
      answer('anacan/live_timer', (call) => switch (call.method) {
            'getPendingStops' => {
                'stops': [
                  {'id': 't1', 'type': 'feeding', 'feedType': 'left', 'startTime': 1000, 'stoppedAt': 5000},
                  {'id': 'bad'},
                ],
              },
            _ => null,
          });
      final bridge = MethodChannelLiveTimerBridge(isNative: true);
      await bridge.startActivity(const LiveActivityStart(id: 't1', type: 'sleep', label: 'Yuxu', startTime: 42, channelName: 'Taymerlər'));
      expect(calls.last.method, 'startActivity');
      expect(calls.last.arguments, {'id': 't1', 'type': 'sleep', 'label': 'Yuxu', 'startTime': 42, 'channelName': 'Taymerlər'});
      await bridge.stopActivity(timerId: 't1');
      expect(calls.last.arguments, {'timerId': 't1'});
      await bridge.stopActivity();
      expect(calls.last.arguments, <String, Object?>{});
      final stops = await bridge.getPendingStops();
      expect(stops.map((s) => s.toJson()), [
        {'id': 't1', 'type': 'feeding', 'feedType': 'left', 'startTime': 1000, 'stoppedAt': 5000},
      ]);
      await bridge.clearPendingStops();
      expect(calls.last.method, 'clearPendingStops');
    });

    test('a missing or failing native side throws (the live timer falls back to its notification)', () async {
      final bridge = MethodChannelLiveTimerBridge(isNative: true);
      await expectLater(bridge.startActivity(const LiveActivityStart(id: 'x', type: 'sleep', label: 'l', startTime: 1)),
          throwsA(isA<MissingPluginException>()));
      answer('anacan/live_timer', (call) => throw PlatformException(code: 'START_FAILED'));
      await expectLater(bridge.startActivity(const LiveActivityStart(id: 'x', type: 'sleep', label: 'l', startTime: 1)),
          throwsA(isA<PlatformException>()));
    });

    test('delivers the Android timerStopped event until the listener is removed', () async {
      final bridge = MethodChannelLiveTimerBridge(isNative: true);
      final seen = <String>[];
      final remove = await bridge.addTimerStoppedListener((stop) => seen.add(stop.id));
      await fromNative('anacan/live_timer',
          const MethodCall('timerStopped', {'id': 't9', 'type': 'sleep', 'startTime': 1, 'stoppedAt': 2}));
      expect(seen, ['t9']);
      remove();
      await fromNative('anacan/live_timer',
          const MethodCall('timerStopped', {'id': 't10', 'type': 'sleep', 'startTime': 1, 'stoppedAt': 2}));
      expect(seen, ['t9']);
    });
  });

  group('HealthCycle / HealthVitals', () {
    tearDown(() {
      unanswer('anacan/health_cycle');
      unanswer('anacan/health_vitals');
    });

    test('cycle: availability with the API version, permission, one write per range', () async {
      answer('anacan/health_cycle', (call) => switch (call.method) {
            'isAvailable' => {'available': true, 'apiVersion': 2},
            'requestWritePermission' => {'granted': true},
            _ => {'written': 3},
          });
      const cycle = MethodChannelHealthCycle();
      final a = await cycle.isAvailable();
      expect(a.available, isTrue);
      expect(a.apiVersion, 2);
      expect(await cycle.requestWritePermission(), isTrue);
      await cycle.writeMenstruation(const MenstruationWrite(startDate: '2026-11-01', endDate: '2026-11-03', flow: 'light', cycleStart: true));
      expect(calls.last.arguments, {'startDate': '2026-11-01', 'endDate': '2026-11-03', 'flow': 'light', 'cycleStart': true});
    });

    test('cycle: the Android stub answer reads as unavailable; a rejected write throws', () async {
      answer('anacan/health_cycle', (call) => switch (call.method) {
            'isAvailable' => {'available': false, 'apiVersion': 2},
            'requestWritePermission' => {'granted': false},
            _ => throw PlatformException(code: 'health_connect_unavailable'),
          });
      const cycle = MethodChannelHealthCycle();
      expect((await cycle.isAvailable()).available, isFalse);
      expect(await cycle.requestWritePermission(), isFalse);
      await expectLater(
          cycle.writeMenstruation(const MenstruationWrite(startDate: '2026-11-01', endDate: '2026-11-01', flow: 'clear', cycleStart: false)),
          throwsA(isA<PlatformException>()));
    });

    test('vitals: argument names of the Capacitor plugin, date only when given', () async {
      answer('anacan/health_vitals', (call) => switch (call.method) {
            'isAvailable' => {'available': true},
            'requestWritePermission' => {'granted': true},
            _ => {'written': true},
          });
      const vitals = MethodChannelHealthVitals();
      expect(await vitals.isAvailable(), isTrue);
      expect(await vitals.requestWritePermission(), isTrue);
      await vitals.writeWeight(kg: 61.5, date: '2026-11-01T10:00:00.000Z');
      expect(calls.last.arguments, {'kg': 61.5, 'date': '2026-11-01T10:00:00.000Z'});
      await vitals.writeBloodPressure(systolic: 120, diastolic: 80);
      expect(calls.last.arguments, {'systolic': 120.0, 'diastolic': 80.0});
      await vitals.writeBloodGlucose(mgdl: 95, date: 'd');
      expect(calls.last.method, 'writeBloodGlucose');
      expect(calls.last.arguments, {'mgdl': 95.0, 'date': 'd'});
    });
  });

  group('FbEvents (anacan/fb_events)', () {
    tearDown(() => unanswer('anacan/fb_events'));

    test('passes the event, cleaned params and consent switches', () async {
      answer('anacan/fb_events', (_) => null);
      const fb = MethodChannelFacebookEvents();
      await fb.logEvent(event: 'fb_mobile_purchase', params: {'_valueToSum': 4.99, 'fb_currency': 'AZN'});
      expect(calls.last.arguments, {
        'event': 'fb_mobile_purchase',
        'params': {'_valueToSum': 4.99, 'fb_currency': 'AZN'},
      });
      await fb.setConsent(true);
      expect(calls.last.method, 'setConsent');
      expect(calls.last.arguments, {'enabled': true});
      await fb.setAdvertiserTrackingEnabled(false);
      expect(calls.last.arguments, {'enabled': false});
    });
  });

  group('AnacanWidgets (anacan/widgets)', () {
    tearDown(() => unanswer('anacan/widgets'));

    test('sends a snapshot once per content change and retries after a failure', () async {
      var fail = true;
      answer('anacan/widgets', (call) {
        if (fail) throw PlatformException(code: 'app_group_unavailable');
        return {'ok': true};
      });
      final channel = HomeWidgetsChannel();
      final text = widgetText('az');
      WidgetSnapshot snap(DateTime now, {bool premium = false}) =>
          buildWidgetSnapshot(text: text, premium: premium, settings: const WidgetSettings(), journey: null, care: null, now: now);
      expect(await channel.push(snap(DateTime(2026, 11, 10, 9))), isFalse);
      fail = false;
      expect(await channel.push(snap(DateTime(2026, 11, 10, 9))), isTrue);
      expect(calls.last.method, 'update');
      expect((calls.last.arguments as Map)['snapshot'], contains('"careLocked":true'));
      final count = calls.length;
      // Same content again: not re-sent.
      expect(await channel.push(snap(DateTime(2026, 11, 10, 9))), isFalse);
      expect(calls.length, count);
      expect(await channel.push(snap(DateTime(2026, 11, 10, 9), premium: true)), isTrue);
    });
  });
}
