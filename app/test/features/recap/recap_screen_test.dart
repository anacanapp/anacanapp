// Ported from: src/components/recap/RecapScreen.tsx (behaviour; there is no vitest file for the screen)
import 'dart:async';

import 'package:anacan/domain/recap/data/recap_data.g.dart' show recapCopy;
import 'package:anacan/features/recap/recap_audio.dart';
import 'package:anacan/features/recap/recap_export.dart';
import 'package:anacan/features/recap/recap_render.dart';
import 'package:anacan/features/recap/recap_screen.dart';
import 'package:anacan/features/recap/register.dart';
import 'package:anacan/native/purchases/purchase_analytics.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/recap_fixtures.dart';
import 'support/recap_harness.dart';

Map<String, Object?> rawAvailable() => {...recapFixtureData('mommy'), 'available': true};
String az(String key) => recapCopy[key]!;

double timeOf(WidgetTester tester) => (tester.widget<CustomPaint>(find.byKey(const ValueKey('recap-canvas'))).painter! as RecapFramePainter).time.value;

Future<void> openPlayer(WidgetTester tester, {required FakeRecapRepository repo, RecordingAnalyticsSink? analytics, FakeShare? share, RecapVideoEncoder? encoder, VoidCallback? onBack}) async {
  // Wide enough that the preview badge (square test glyphs) does not cover the top-right buttons.
  await pumpApp(tester, RecapScreen(onBack: onBack ?? () {}),
      overrides: recapOverrides(repo: repo, analytics: analytics, share: share, encoder: encoder), scroll: false, size: const Size(600, 1000));
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

Future<void> tapAtFraction(WidgetTester tester, double fx) async {
  final rect = tester.getRect(find.byKey(const ValueKey('recap-canvas')));
  await tester.tapAt(Offset(rect.left + rect.width * fx, rect.center.dy));
  await tester.pump(const Duration(milliseconds: 16));
}

void main() {
  screenTest('loading, then "not open yet" when the server says unavailable', (tester) async {
    final repo = FakeRecapRepository(raw: {'available': false, 'reason': 'not_open'})..gate = Completer<void>();
    await pumpApp(tester, RecapScreen(onBack: () {}), overrides: recapOverrides(repo: repo), scroll: false);
    await tester.pump();
    expect(find.text(az('recap_loading')), findsOneWidget);
    expect(find.byKey(const ValueKey('recap-mute')), findsNothing);
    expect(find.byKey(const ValueKey('recap-close')), findsOneWidget);
    repo.gate!.complete();
    await tester.pump();
    await tester.pump();
    expect(find.text(az('recap_unavailable')), findsOneWidget);
    expect(find.byKey(const ValueKey('recap-share-image')), findsNothing);
  });

  screenTest('plays on open: recap_opened, preview badge, no video buttons without an encoder; close calls onBack', (tester) async {
    final analytics = RecordingAnalyticsSink();
    var closed = 0;
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), analytics: analytics, onBack: () => closed++);
    expect(find.byKey(const ValueKey('recap-canvas')), findsOneWidget);
    final opened = analytics.events.where((e) => e.$1 == 'recap_opened').toList();
    expect(opened, hasLength(1));
    expect(opened.single.$2.single, {'year': 2026, 'stage': 'mommy', 'scenes': 10});
    expect(find.text(az('recap_preview_badge')), findsOneWidget);
    expect(find.byKey(const ValueKey('recap-download')), findsNothing);
    expect(find.byKey(const ValueKey('recap-share')), findsNothing);
    expect(find.text(az('recap_share_image')), findsOneWidget);
    expect(find.bySemanticsLabel(az('recap_pause')), findsOneWidget);
    expect(timeOf(tester), greaterThan(0));
    await tester.tap(find.byKey(const ValueKey('recap-close')));
    expect(closed, 1);
  });

  screenTest('story taps: right → next scene, left → scene start or the previous scene, middle → pause / resume', (tester) async {
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()));
    await tester.pump(const Duration(seconds: 1));
    final t0 = timeOf(tester);
    expect(t0, inInclusiveRange(0.9, 1.3));
    await tapAtFraction(tester, 0.9);
    final t1 = timeOf(tester);
    expect(t1, greaterThan(4)); // the cold open ends ≥ 4.5 s
    await tester.pump(const Duration(seconds: 2));
    await tapAtFraction(tester, 0.1);
    expect(timeOf(tester), closeTo(t1 - 0.001, 0.05)); // > 1.2 s into the scene → its start
    await tester.pump(const Duration(milliseconds: 400));
    await tapAtFraction(tester, 0.1);
    expect(timeOf(tester), closeTo(0, 0.05)); // < 1.2 s into the scene → the previous scene
    await tapAtFraction(tester, 0.5);
    expect(find.byKey(const ValueKey('recap-big-play')), findsOneWidget);
    expect(find.bySemanticsLabel(az('recap_replay')), findsOneWidget);
    final paused = timeOf(tester);
    await tester.pump(const Duration(seconds: 2));
    expect(timeOf(tester), paused);
    await tapAtFraction(tester, 0.5);
    await tester.pump(const Duration(seconds: 1));
    expect(timeOf(tester), greaterThan(paused + 0.5));
    // A horizontal swipe to the left also moves forward.
    final before = timeOf(tester);
    final rect = tester.getRect(find.byKey(const ValueKey('recap-canvas')));
    await tester.dragFrom(rect.center, const Offset(-120, 0));
    await tester.pump(const Duration(milliseconds: 16));
    expect(timeOf(tester), greaterThan(before + 1));
  });

  screenTest('reaching the end: recap_completed once, replay icon, the play button restarts', (tester) async {
    final analytics = RecordingAnalyticsSink();
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), analytics: analytics);
    await tester.pump(const Duration(seconds: 70));
    await tester.pump(const Duration(milliseconds: 16));
    expect(analytics.events.where((e) => e.$1 == 'recap_completed'), hasLength(1));
    expect(find.byKey(const ValueKey('recap-big-play')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('recap-play')));
    await tester.pump(const Duration(milliseconds: 500));
    expect(timeOf(tester), lessThan(1));
    await tester.pump(const Duration(seconds: 70));
    expect(analytics.events.where((e) => e.$1 == 'recap_completed'), hasLength(1));
  });

  screenTest('mute toggles the speaker button', (tester) async {
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()));
    expect(find.bySemanticsLabel(az('recap_mute')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('recap-mute')));
    await tester.pump();
    expect(find.bySemanticsLabel(az('recap_unmute')), findsOneWidget);
  });

  screenTest('share as image: the summary PNG goes to the share sheet and recap_shared is logged', (tester) async {
    final analytics = RecordingAnalyticsSink();
    final share = FakeShare();
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), analytics: analytics, share: share);
    await tester.tap(find.byKey(const ValueKey('recap-share-image')));
    await tester.pump();
    await tester.pump();
    expect(share.calls, hasLength(1));
    expect(share.calls.single.fileName, 'anacan-recap-2026-card.png');
    expect(share.calls.single.mimeType, 'image/png');
    expect(share.calls.single.text, az('recap_share_text').replaceAll('{year}', '2026'));
    expect(analytics.events.where((e) => e.$1 == 'recap_shared').single.$2.single, {'year': 2026, 'kind': 'image', 'outcome': 'shared'});
  });

  screenTest('share as image cancelled: nothing logged', (tester) async {
    final analytics = RecordingAnalyticsSink();
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), analytics: analytics, share: FakeShare('cancelled'));
    await tester.tap(find.byKey(const ValueKey('recap-share-image')));
    await tester.pump();
    await tester.pump();
    expect(analytics.events.where((e) => e.$1 == 'recap_shared'), isEmpty);
  });

  screenTest('video (encoder wired): rendering overlay, then shared, "ready" notice and events', (tester) async {
    final analytics = RecordingAnalyticsSink();
    final share = FakeShare();
    final encoder = FakeEncoder()..gate = Completer<void>();
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), analytics: analytics, share: share, encoder: encoder);
    expect(find.byKey(const ValueKey('recap-download')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('recap-download')));
    await tester.pump();
    expect(find.byKey(const ValueKey('recap-rendering')), findsOneWidget);
    expect(find.text(az('recap_rendering').replaceAll('{pct}', '50%')), findsOneWidget);
    encoder.gate!.complete();
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const ValueKey('recap-rendering')), findsNothing);
    expect(share.calls.single.fileName, 'anacan-recap-2026.mp4');
    expect(find.text(az('recap_saved')), findsOneWidget);
    expect(analytics.events.where((e) => e.$1 == 'recap_exported').single.$2.single, {'year': 2026, 'format': 'mp4', 'mode': 'download'});
    expect(analytics.events.where((e) => e.$1 == 'recap_shared').single.$2.single, {'year': 2026, 'kind': 'video', 'outcome': 'shared'});
  });

  screenTest('video cancelled from the overlay: no notice, nothing shared', (tester) async {
    final share = FakeShare();
    final encoder = FakeEncoder()..gate = Completer<void>();
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), share: share, encoder: encoder);
    await tester.tap(find.byKey(const ValueKey('recap-share')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('recap-cancel')));
    encoder.gate!.complete();
    await tester.pump();
    await tester.pump();
    expect(encoder.signal?.aborted, isTrue);
    expect(find.byKey(const ValueKey('recap-rendering')), findsNothing);
    expect(find.byKey(const ValueKey('recap-notice')), findsNothing);
    expect(share.calls, isEmpty);
  });

  screenTest('video interrupted (app in the background): the "keep the screen on" hint', (tester) async {
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), encoder: FakeEncoder(fail: 'INTERRUPTED'));
    await tester.tap(find.byKey(const ValueKey('recap-download')));
    await tester.pump();
    await tester.pump();
    expect(find.text(az('recap_rendering_hint')), findsOneWidget);
  });

  screenTest('music follows the picture: plays on start, pauses with the video and when muted; a refused play mutes', (tester) async {
    final audio = FakeAudio();
    await pumpApp(tester, RecapScreen(onBack: () {}),
        overrides: [...recapOverrides(repo: FakeRecapRepository(raw: rawAvailable())), recapAudioFactoryProvider.overrideWithValue(() => audio)],
        scroll: false, size: const Size(600, 1000));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(audio.playing, isTrue);
    expect(audio.position, 0);
    await tester.tap(find.byKey(const ValueKey('recap-play')));
    await tester.pump();
    expect(audio.playing, isFalse);
    await tester.tap(find.byKey(const ValueKey('recap-play')));
    await tester.pump();
    expect(audio.playing, isTrue);
    await tester.tap(find.byKey(const ValueKey('recap-mute')));
    await tester.pump();
    expect(audio.playing, isFalse);
    audio.refuse = true;
    await tester.tap(find.byKey(const ValueKey('recap-mute')));
    await tester.pump();
    await tester.pump();
    expect(find.bySemanticsLabel(az('recap_unmute')), findsOneWidget);
  });

  testWidgets('registerRecapFeature registers the recap screen', (tester) async {
    final r = FeatureRegistry();
    registerRecapFeature(r);
    expect(r.screen(ScreenId.recap), isNotNull);
  });

  testWidgets('renderRecapImage: a 1080×1920 PNG of the summary card', (tester) async {
    final png = await tester.runAsync(() => renderRecapImage(recapFixtureModel('mommy', 'az'), const RecapAssets()));
    expect(png!.sublist(1, 4), 'PNG'.codeUnits);
    // IHDR width / height.
    expect((png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19], 1080);
    expect((png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23], 1920);
  });

  screenTest('video failure: the error notice suggests the image', (tester) async {
    await openPlayer(tester, repo: FakeRecapRepository(raw: rawAvailable()), encoder: FakeEncoder(fail: 'RECORDER'));
    await tester.tap(find.byKey(const ValueKey('recap-download')));
    await tester.pump();
    await tester.pump();
    expect(find.text(az('recap_error')), findsOneWidget);
  });
}
