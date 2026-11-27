// Ported from: (no vitest file) src/lib/story-editor.ts `exportStoryImage` and src/lib/story-export.ts
//              `renderStorySlide` + the dashboard StoryViewer `save()` share hand-off
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:anacan/features/baby_chat/baby_chat_share.dart';
import 'package:anacan/features/community_stories/editor/story_painter.dart';
import 'package:anacan/features/community_stories/editor/story_scene.dart';
import 'package:anacan/features/community_stories/export/story_export.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Sharer implements BabyChatSharer {
  final List<(String, String, int)> shared = [];
  @override
  Future<String> share(Uint8List bytes, {required String fileName, required String mimeType, required String text}) async {
    shared.add((fileName, mimeType, bytes.length));
    return 'shared';
  }
}

Future<({int width, int height})> _size(Uint8List png) async {
  final codec = await ui.instantiateImageCodec(png);
  final frame = await codec.getNextFrame();
  final size = (width: frame.image.width, height: frame.image.height);
  frame.image.dispose();
  codec.dispose();
  return size;
}

void main() {
  testWidgets('exports the edited photo as a 1080×1920 image with its captions', (tester) async {
    await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawRect(const Rect.fromLTWH(0, 0, 40, 30), Paint()..color = const Color(0xFFFF0000));
      final source = await recorder.endRecording().toImage(40, 30);
      final scene = initialStoryScene(40, 30).copyWith(texts: const [
        StoryTextLayer(id: 't', text: 'Salam, körpəm!', x: 0.5, y: 0.3, size: 60, rotation: 10, color: '#ffffff', font: 'sans', align: 'center', background: 'dark'),
      ]);
      final file = await exportStoryImage(source, scene);
      source.dispose();
      expect(file.type, 'image/png');
      expect(file.extension, 'png');
      expect(await _size(file.bytes), (width: 1080, height: 1920));
    });
  });

  testWidgets('renders a dashboard slide and hands it to the share sheet as anacan-story-<id>-<n>', (tester) async {
    await tester.runAsync(() async {
      final sharer = _Sharer();
      final c = ProviderContainer(overrides: [babyChatSharerProvider.overrideWithValue(sharer)]);
      addTearDown(c.dispose);
      final story = <String, dynamic>{
        'id': 'kick',
        'theme': 'coral',
        'module': 'bump',
        'illus': 'blob',
        'slides': [
          {'t': 'cover', 'kicker': 'Bilirdiniz?', 'title': 'Körpə ==təpik== atır'},
          {'t': 'list', 'title': 'Siyahı', 'items': ['**Bir**', 'İki']},
        ],
      };
      await c.read(dashboardStoryExporterProvider)(story, 1, const {});
      expect(sharer.shared.single.$1, 'anacan-story-kick-2.png');
      expect(sharer.shared.single.$2, 'image/png');
      final bytes = await c.read(storySlideRendererProvider)(story, 0, const {}, null);
      expect(await _size(bytes), (width: 1080, height: 1920));
    });
  });

  test('parses #rrggbb and #rrggbbaa painter colours', () {
    expect(storyColor('#18181b'), const Color(0xFF18181B));
    expect(storyColor('#18181be8'), const Color(0xE818181B));
  });
}
