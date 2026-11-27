// Ported from: src/lib/story-editor.ts (scene model, framing, gestures, hit test, validation; the canvas painter is
//              in story_painter.dart)
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

const double kStoryWidth = 1080;
const double kStoryHeight = 1920;
const double kStoryMinZoom = 0.25;
const double kStoryMaxZoom = 8;

/// `STORY_FONTS` keys.
const List<String> kStoryFonts = ['sans', 'serif', 'mono'];

@immutable
class StoryPoint {
  const StoryPoint(this.x, this.y);
  final double x;
  final double y;
  @override
  bool operator ==(Object other) => other is StoryPoint && other.x == x && other.y == y;
  @override
  int get hashCode => Object.hash(x, y);
  @override
  String toString() => 'StoryPoint($x, $y)';
}

@immutable
class StoryTransform {
  const StoryTransform({required this.x, required this.y, required this.zoom, required this.rotation});
  final double x;
  final double y;
  final double zoom;
  final double rotation;

  StoryTransform copyWith({double? x, double? y, double? zoom, double? rotation}) =>
      StoryTransform(x: x ?? this.x, y: y ?? this.y, zoom: zoom ?? this.zoom, rotation: rotation ?? this.rotation);

  Map<String, Object?> toJson() => {'x': x, 'y': y, 'zoom': zoom, 'rotation': rotation};

  @override
  bool operator ==(Object other) =>
      other is StoryTransform && other.x == x && other.y == y && other.zoom == zoom && other.rotation == rotation;
  @override
  int get hashCode => Object.hash(x, y, zoom, rotation);
  @override
  String toString() => 'StoryTransform(x: $x, y: $y, zoom: $zoom, rotation: $rotation)';
}

/// `StoryTextLayer`. [font]: sans | serif | mono; [align]: left | center | right; [background]: none | dark | light.
@immutable
class StoryTextLayer {
  const StoryTextLayer({
    required this.id,
    required this.text,
    required this.x,
    required this.y,
    required this.size,
    required this.rotation,
    required this.color,
    required this.font,
    required this.align,
    required this.background,
  });
  final String id;
  final String text;
  final double x;
  final double y;
  final double size;
  final double rotation;
  final String color;
  final String font;
  final String align;
  final String background;

  StoryTextLayer copyWith({String? text, double? x, double? y, double? size, double? rotation, String? color, String? font, String? align, String? background}) =>
      StoryTextLayer(
        id: id,
        text: text ?? this.text,
        x: x ?? this.x,
        y: y ?? this.y,
        size: size ?? this.size,
        rotation: rotation ?? this.rotation,
        color: color ?? this.color,
        font: font ?? this.font,
        align: align ?? this.align,
        background: background ?? this.background,
      );

  Map<String, Object?> toJson() => {
        'id': id, 'text': text, 'x': x, 'y': y, 'size': size, 'rotation': rotation, //
        'color': color, 'font': font, 'align': align, 'background': background,
      };

  @override
  bool operator ==(Object other) =>
      other is StoryTextLayer &&
      other.id == id &&
      other.text == text &&
      other.x == x &&
      other.y == y &&
      other.size == size &&
      other.rotation == rotation &&
      other.color == color &&
      other.font == font &&
      other.align == align &&
      other.background == background;
  @override
  int get hashCode => Object.hash(id, text, x, y, size, rotation, color, font, align, background);
  @override
  String toString() => 'StoryTextLayer(${toJson()})';
}

/// `StoryScene` (version 1), the `editor_layout` JSON of a video story.
@immutable
class StoryScene {
  const StoryScene({
    required this.sourceWidth,
    required this.sourceHeight,
    required this.background,
    required this.media,
    this.texts = const [],
  });
  final double sourceWidth;
  final double sourceHeight;
  final String background;
  final StoryTransform media;
  final List<StoryTextLayer> texts;

  int get version => 1;

  StoryScene copyWith({String? background, StoryTransform? media, List<StoryTextLayer>? texts}) => StoryScene(
        sourceWidth: sourceWidth,
        sourceHeight: sourceHeight,
        background: background ?? this.background,
        media: media ?? this.media,
        texts: texts ?? this.texts,
      );

  Map<String, Object?> toJson() => {
        'version': 1,
        'sourceWidth': sourceWidth,
        'sourceHeight': sourceHeight,
        'background': background,
        'media': media.toJson(),
        'texts': [for (final t in texts) t.toJson()],
      };

  @override
  bool operator ==(Object other) =>
      other is StoryScene &&
      other.sourceWidth == sourceWidth &&
      other.sourceHeight == sourceHeight &&
      other.background == background &&
      other.media == media &&
      listEquals(other.texts, texts);
  @override
  int get hashCode => Object.hash(sourceWidth, sourceHeight, background, media, Object.hashAll(texts));
  @override
  String toString() => 'StoryScene(${toJson()})';
}

/// `StoryTextBox`: a painted caption in scene pixels.
@immutable
class StoryTextBox {
  const StoryTextBox({required this.id, required this.x, required this.y, required this.width, required this.height, required this.rotation});
  final String id;
  final double x;
  final double y;
  final double width;
  final double height;
  final double rotation;
}

/// `storyMediaBox(scene)`.
@immutable
class StoryMediaBox {
  const StoryMediaBox({required this.x, required this.y, required this.width, required this.height, required this.rotation});
  final double x;
  final double y;
  final double width;
  final double height;
  final double rotation;
}

double _clamp(double value, double min, double max) => math.max(min, math.min(max, value));
double _radians(double degrees) => degrees * math.pi / 180;

/// `((degrees + 180) % 360 + 360) % 360 - 180` (JS remainder keeps the sign of the dividend).
double _normalizeAngle(double degrees) {
  double jsRem(double a, double b) => a - b * (a / b).truncateToDouble();
  return jsRem(jsRem(degrees + 180, 360) + 360, 360) - 180;
}

StoryPoint _rotate(StoryPoint p, double angle) =>
    StoryPoint(p.x * math.cos(angle) - p.y * math.sin(angle), p.x * math.sin(angle) + p.y * math.cos(angle));

/// Thrown by [initialStoryScene] (`new Error('INVALID_STORY_MEDIA')`).
class StoryEditorException implements Exception {
  const StoryEditorException(this.message);
  final String message;
  @override
  String toString() => message;
}

StoryScene initialStoryScene(double width, double height) {
  if (!width.isFinite || !height.isFinite || width <= 0 || height <= 0) throw const StoryEditorException('INVALID_STORY_MEDIA');
  return StoryScene(
    sourceWidth: width,
    sourceHeight: height,
    background: '#18181b',
    media: const StoryTransform(x: 0.5, y: 0.5, zoom: 1, rotation: 0),
  );
}

StoryMediaBox storyMediaBox(StoryScene scene) {
  final scale = math.min(kStoryWidth / scene.sourceWidth, kStoryHeight / scene.sourceHeight) * scene.media.zoom;
  return StoryMediaBox(
    x: scene.media.x * kStoryWidth,
    y: scene.media.y * kStoryHeight,
    width: scene.sourceWidth * scale,
    height: scene.sourceHeight * scale,
    rotation: scene.media.rotation,
  );
}

/// `fitStoryMedia(scene, mode)`: [cover] fills the frame, otherwise the whole (rotated) media is visible.
StoryScene fitStoryMedia(StoryScene scene, {bool cover = false}) {
  final angle = _radians(scene.media.rotation);
  final width = (scene.sourceWidth * math.cos(angle)).abs() + (scene.sourceHeight * math.sin(angle)).abs();
  final height = (scene.sourceWidth * math.sin(angle)).abs() + (scene.sourceHeight * math.cos(angle)).abs();
  final scale = (cover ? math.max : math.min)(kStoryWidth / width, kStoryHeight / height);
  final base = math.min(kStoryWidth / scene.sourceWidth, kStoryHeight / scene.sourceHeight);
  return scene.copyWith(media: scene.media.copyWith(x: 0.5, y: 0.5, zoom: _clamp(scale / base, kStoryMinZoom, kStoryMaxZoom)));
}

/// Pixel coordinates in the 1080×1920 scene; works identically at every preview size.
StoryScene applyStoryGesture(StoryScene scene, String? textId, List<StoryPoint> start, List<StoryPoint> next) {
  if (start.isEmpty || start.length != next.length) return scene;
  StoryPoint center(List<StoryPoint> points) => StoryPoint(
        points.fold<double>(0, (n, p) => n + p.x) / points.length,
        points.fold<double>(0, (n, p) => n + p.y) / points.length,
      );
  final a = center(start), b = center(next);
  double distance(List<StoryPoint> points) => math.sqrt(math.pow(points[1].x - points[0].x, 2) + math.pow(points[1].y - points[0].y, 2));
  double angle(List<StoryPoint> points) => math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  final factor = start.length >= 2 ? distance(next) / math.max(1, distance(start)) : 1.0;
  final turn = start.length >= 2 ? angle(next) - angle(start) : 0.0;
  StoryPoint move(double x, double y, double ratio) {
    final offset = _rotate(StoryPoint((x * kStoryWidth - a.x) * ratio, (y * kStoryHeight - a.y) * ratio), turn);
    return StoryPoint((b.x + offset.x) / kStoryWidth, (b.y + offset.y) / kStoryHeight);
  }

  if (textId != null) {
    return scene.copyWith(texts: [
      for (final text in scene.texts)
        if (text.id != textId)
          text
        else
          () {
            final size = _clamp(text.size * factor, 28, 120);
            final position = move(text.x, text.y, size / text.size);
            return text.copyWith(
              x: _clamp(position.x, 0.05, 0.95),
              y: _clamp(position.y, 0.05, 0.95),
              size: size,
              rotation: _normalizeAngle(text.rotation + turn * 180 / math.pi),
            );
          }(),
    ]);
  }
  final zoom = _clamp(scene.media.zoom * factor, kStoryMinZoom, kStoryMaxZoom);
  final position = move(scene.media.x, scene.media.y, zoom / scene.media.zoom);
  var media = StoryTransform(x: position.x, y: position.y, zoom: zoom, rotation: _normalizeAngle(scene.media.rotation + turn * 180 / math.pi));
  final box = storyMediaBox(scene.copyWith(media: media));
  // Keep a recoverable part of the photo visible while allowing free framing.
  media = media.copyWith(
    x: _clamp(media.x, -box.width / kStoryWidth / 2 + 0.04, 1 + box.width / kStoryWidth / 2 - 0.04),
    y: _clamp(media.y, -box.height / kStoryHeight / 2 + 0.04, 1 + box.height / kStoryHeight / 2 - 0.04),
  );
  return scene.copyWith(media: media);
}

/// The topmost caption under [point] (18 px slop, rotation aware).
String? hitStoryText(List<StoryTextBox> boxes, StoryPoint point) {
  for (final box in boxes.reversed) {
    final local = _rotate(StoryPoint(point.x - box.x, point.y - box.y), -_radians(box.rotation));
    if (local.x.abs() <= box.width / 2 + 18 && local.y.abs() <= box.height / 2 + 18) return box.id;
  }
  return null;
}

final RegExp _colorPattern = RegExp(r'^#[\da-f]{6}$', caseSensitive: false);

/// Validates a persisted `editor_layout` (legacy strings, corrupt data → null).
StoryScene? parseStoryScene(Object? input) {
  if (input is StoryScene) return input;
  if (input is! Map) return null;
  bool finite(Object? n, double min, double max) => n is num && n.isFinite && n >= min && n <= max;
  double d(Object? n) => (n as num).toDouble();
  final media = input['media'];
  final texts = input['texts'];
  final background = input['background'];
  if (input['version'] != 1 ||
      !finite(input['sourceWidth'], 1, 50000) ||
      !finite(input['sourceHeight'], 1, 50000) ||
      background is! String ||
      !_colorPattern.hasMatch(background) ||
      media is! Map ||
      !finite(media['zoom'], kStoryMinZoom, kStoryMaxZoom) ||
      !finite(media['x'], -100, 100) ||
      !finite(media['y'], -100, 100) ||
      !finite(media['rotation'], -360, 360) ||
      texts is! List ||
      texts.length > 8) {
    return null;
  }
  final layers = <StoryTextLayer>[];
  for (final text in texts) {
    if (text is! Map ||
        text['id'] is! String ||
        text['text'] is! String ||
        (text['text'] as String).length > 500 ||
        !finite(text['x'], 0, 1) ||
        !finite(text['y'], 0, 1) ||
        !finite(text['size'], 28, 120) ||
        !finite(text['rotation'], -360, 360) ||
        text['color'] is! String ||
        !_colorPattern.hasMatch(text['color'] as String) ||
        !kStoryFonts.contains(text['font']) ||
        !const ['left', 'center', 'right'].contains(text['align']) ||
        !const ['none', 'dark', 'light'].contains(text['background'])) {
      return null;
    }
    layers.add(StoryTextLayer(
      id: text['id'] as String,
      text: text['text'] as String,
      x: d(text['x']),
      y: d(text['y']),
      size: d(text['size']),
      rotation: d(text['rotation']),
      color: text['color'] as String,
      font: text['font'] as String,
      align: text['align'] as String,
      background: text['background'] as String,
    ));
  }
  return StoryScene(
    sourceWidth: d(input['sourceWidth']),
    sourceHeight: d(input['sourceHeight']),
    background: background,
    media: StoryTransform(x: d(media['x']), y: d(media['y']), zoom: d(media['zoom']), rotation: d(media['rotation'])),
    texts: layers,
  );
}
