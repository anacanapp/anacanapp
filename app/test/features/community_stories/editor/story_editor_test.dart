// Ported from: src/lib/story-editor.test.ts
import 'dart:convert';

import 'package:anacan/features/community_stories/editor/story_scene.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('story framing', () {
    for (final (width, height) in const [(4000.0, 3000.0), (3000.0, 4000.0), (1080.0, 1920.0), (5000.0, 1000.0)]) {
      test('starts with the whole ${width.toInt()} × ${height.toInt()} image visible', () {
        final scene = initialStoryScene(width, height);
        final box = storyMediaBox(scene);
        expect(box.width, lessThanOrEqualTo(kStoryWidth));
        expect(box.height, lessThanOrEqualTo(kStoryHeight));
        expect(box.x, kStoryWidth / 2);
        expect(box.y, kStoryHeight / 2);
        expect(box.width / box.height, closeTo(width / height, 0.005));
      });
    }

    test('can zoom out below the original fitted size and fill the frame without stretching', () {
      final scene = initialStoryScene(4000, 3000);
      final zoomed = scene.copyWith(media: scene.media.copyWith(zoom: 0.5));
      expect(storyMediaBox(zoomed).width, 540);
      final filled = storyMediaBox(fitStoryMedia(scene, cover: true));
      expect(filled.height, closeTo(kStoryHeight, 0.005));
      expect(filled.width / filled.height, closeTo(4 / 3, 0.005));
      expect(fitStoryMedia(zoomed).media.zoom, 1);
    });

    test('pans and pinches around the gesture center with the same export-space coordinates', () {
      final scene = initialStoryScene(1080, 1920);
      final panned = applyStoryGesture(scene, null, const [StoryPoint(100, 100)], const [StoryPoint(208, 292)]);
      expect(panned.media.x, closeTo(0.6, 0.005));
      expect(panned.media.y, closeTo(0.6, 0.005));
      final pinched = applyStoryGesture(scene, null, const [StoryPoint(440, 960), StoryPoint(640, 960)], const [StoryPoint(340, 960), StoryPoint(740, 960)]);
      expect(pinched.media, const StoryTransform(x: 0.5, y: 0.5, zoom: 2, rotation: 0));
    });

    test('fits the rotated photo and transforms a caption independently of the media', () {
      final scene = initialStoryScene(4000, 3000);
      final rotated = fitStoryMedia(scene.copyWith(media: scene.media.copyWith(rotation: 90)));
      final box = storyMediaBox(rotated);
      expect(box.height, lessThanOrEqualTo(kStoryWidth + 0.01));
      expect(box.width, lessThanOrEqualTo(kStoryHeight + 0.01));
      const caption = StoryTextLayer(
          id: 'text', text: 'Salam, körpəm!', x: 0.5, y: 0.5, size: 60, rotation: 0, color: '#ffffff', background: 'dark', font: 'sans', align: 'center');
      final changed = applyStoryGesture(scene.copyWith(texts: [caption]), caption.id, const [StoryPoint(0, 0)], const [StoryPoint(108, 192)]);
      expect(changed.media, scene.media);
      expect(changed.texts[0].x, closeTo(0.6, 1e-9));
      expect(changed.texts[0].y, closeTo(0.6, 1e-9));
      expect(changed.texts[0].text, caption.text);
    });

    test('hit-tests the topmost caption, including rotation', () {
      const boxes = [
        StoryTextBox(id: 'lower', x: 200, y: 200, width: 200, height: 50, rotation: 0),
        StoryTextBox(id: 'upper', x: 200, y: 200, width: 200, height: 50, rotation: 90),
      ];
      expect(hitStoryText(boxes, const StoryPoint(200, 200)), 'upper');
      expect(hitStoryText(boxes, const StoryPoint(200, 280)), 'upper');
      expect(hitStoryText(boxes, const StoryPoint(800, 800)), isNull);
    });

    test('validates persisted video scenes without treating legacy strings or corrupt data as layouts', () {
      final scene = initialStoryScene(1920, 1080);
      expect(parseStoryScene(jsonDecode(jsonEncode(scene.toJson()))), scene);
      final json = scene.toJson();
      for (final value in <Object?>[
        null,
        'legacy caption',
        <String, Object?>{},
        {...json, 'media': {...scene.media.toJson(), 'zoom': double.infinity}},
        {...json, 'background': 'url(javascript:bad)'},
        {...json, 'texts': List.filled(9, <String, Object?>{})},
      ]) {
        expect(parseStoryScene(value), isNull);
      }
    });
  });
}
