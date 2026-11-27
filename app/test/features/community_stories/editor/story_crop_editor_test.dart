// Ported from: (no vitest file) src/components/community/StoryCropEditor.tsx - confirm exports the framed photo
//              with the non-empty captions only
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/editor/story_crop_editor.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

Future<Uint8List> _png() async {
  final recorder = ui.PictureRecorder();
  Canvas(recorder).drawRect(const Rect.fromLTWH(0, 0, 40, 30), Paint()..color = const Color(0xFF3366FF));
  final image = await recorder.endRecording().toImage(40, 30);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return data!.buffer.asUint8List();
}

void main() {
  testWidgets('shares the framed photo with its typed caption and drops empty captions', (tester) async {
    final bytes = (await tester.runAsync(_png))!;
    StoryEditorResult? result;
    var cancelled = 0;
    await pumpCommunity(
      tester,
      StoryCropEditor(media: StoryEditorMedia.image(bytes), onConfirm: (r) async => result = r, onCancel: () => cancelled++),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend(), userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    final preview = find.bySemanticsLabel('Story önizləməsi');
    for (var i = 0; i < 50 && preview.evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump();
    }
    expect(preview, findsOneWidget);

    // Two captions: one typed, one left empty.
    await tester.tap(find.bySemanticsLabel('Mətn əlavə et'));
    await tester.pump();
    await tester.enterText(find.byType(EditableText), 'Salam');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Hazır'));
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Mətn əlavə et'));
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Hazır'));
    await tester.pump();

    await tester.tap(find.text('Paylaş'));
    for (var i = 0; i < 50 && result == null; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump();
    }
    expect(result, isNotNull);
    expect(result!.image!.type, 'image/png');
    expect([for (final t in result!.scene.texts) t.text], ['Salam']);
    expect(result!.scene.sourceWidth, 40);
    expect(cancelled, 0);
    await flushCommunity(tester);
  }, semanticsEnabled: true);
}
