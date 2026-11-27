// Ported from: src/lib/story-editor.ts (STORY_FONTS, wrapStoryText, roundedRect, drawStoryScene, exportStoryImage)
//
// One painter for the editor preview, the image export and the video text overlays, on a dart:ui [Canvas] in place of
// the 2D canvas context. The export renders a 1080×1920 picture and encodes it through [StoryImageEncoder] (PNG by
// default: Flutter ships no JPEG encoder; React uploaded `image/jpeg` at quality 0.94).
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'story_scene.dart';

/// `STORY_FONTS`: Arial / Georgia / Courier New with the platform's generic families as fallbacks.
({String? family, List<String> fallback}) storyFont(String font) => switch (font) {
      'serif' => (family: 'Georgia', fallback: const ['serif', 'Noto Serif', 'Times New Roman']),
      'mono' => (family: 'Courier New', fallback: const ['Courier', 'monospace', 'Droid Sans Mono']),
      _ => (family: 'Arial', fallback: const ['Helvetica', 'sans-serif', 'Roboto']),
    };

/// `#rrggbb` / `#rrggbbaa` → [Color] (invalid → black).
Color storyColor(String hex) {
  final value = hex.startsWith('#') ? hex.substring(1) : hex;
  if (value.length == 6) return Color(int.tryParse('FF$value', radix: 16) ?? 0xFF000000);
  if (value.length == 8) {
    final rgba = int.tryParse(value, radix: 16) ?? 0xFF;
    return Color(((rgba & 0xFF) << 24) | (rgba >> 8));
  }
  return const Color(0xFF000000);
}

TextStyle _textStyle(String font, double size, Color color, {List<Shadow>? shadows}) {
  final f = storyFont(font);
  return TextStyle(
    fontFamily: f.family,
    fontFamilyFallback: f.fallback,
    fontSize: size,
    fontWeight: FontWeight.w700,
    color: color,
    height: 1,
    shadows: shadows,
  );
}

/// `ctx.measureText(text).width` for `700 <size>px <font>`.
double _measure(String text, String font, double size) {
  if (text.isEmpty) return 0;
  final painter = TextPainter(text: TextSpan(text: text, style: _textStyle(font, size, const Color(0xFF000000))), textDirection: TextDirection.ltr)
    ..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}

final RegExp _whitespaceSplit = RegExp(r'(\s+)');

/// `text.split(/(\s+)/)` (separators kept).
List<String> _splitWords(String text) {
  final out = <String>[];
  var last = 0;
  for (final m in _whitespaceSplit.allMatches(text)) {
    out.add(text.substring(last, m.start));
    out.add(m[0]!);
    last = m.end;
  }
  out.add(text.substring(last));
  return out;
}

List<String> wrapStoryText(String text, double width, double Function(String line) measure) {
  final lines = <String>[];
  for (final paragraph in text.split('\n')) {
    var line = '';
    for (final word in _splitWords(paragraph)) {
      if (measure(line + word) <= width) {
        line += word;
        continue;
      }
      if (line.trim().isNotEmpty) {
        lines.add(line.trimRight());
        line = '';
      }
      for (final char in word.trimLeft().runes.map(String.fromCharCode)) {
        if (line.isNotEmpty && measure(line + char) > width) {
          lines.add(line);
          line = '';
        }
        line += char;
      }
    }
    lines.add(line.trimRight());
  }
  return lines;
}

RRect _roundedRect(double x, double y, double width, double height, double radius) =>
    RRect.fromRectAndRadius(Rect.fromLTWH(x, y, width, height), Radius.circular(math.min(radius, math.min(width, height) / 2)));

Path _dashed(Path source, List<double> pattern) {
  final out = Path();
  for (final metric in source.computeMetrics()) {
    var distance = 0.0;
    var index = 0;
    var draw = true;
    while (distance < metric.length) {
      final length = pattern[index % pattern.length];
      if (draw) out.addPath(metric.extractPath(distance, math.min(distance + length, metric.length)), Offset.zero);
      distance += length;
      draw = !draw;
      index++;
    }
  }
  return out;
}

final RegExp _rtlStart = RegExp(r'^[^\p{L}]*[\u0590-\u08ff]', unicode: true);

double _clamp(double value, double min, double max) => math.max(min, math.min(max, value));

/// `drawStoryScene(ctx, media, scene, { textOnly, selectedId, placeholder })` on a [size] canvas; returns the
/// caption boxes in scene pixels.
List<StoryTextBox> drawStoryScene(
  Canvas canvas,
  Size size,
  ui.Image? media,
  StoryScene scene, {
  bool textOnly = false,
  String? selectedId,
  String placeholder = '',
}) {
  final boxes = <StoryTextBox>[];
  canvas.save();
  canvas.clipRect(Offset.zero & size);
  canvas.scale(size.width / kStoryWidth, size.height / kStoryHeight);
  if (!textOnly) {
    canvas.drawRect(const Rect.fromLTWH(0, 0, kStoryWidth, kStoryHeight), Paint()..color = storyColor(scene.background));
    if (media != null) {
      final box = storyMediaBox(scene);
      canvas.save();
      canvas.translate(box.x, box.y);
      canvas.rotate(box.rotation * math.pi / 180);
      canvas.drawImageRect(
        media,
        Rect.fromLTWH(0, 0, media.width.toDouble(), media.height.toDouble()),
        Rect.fromLTWH(-box.width / 2, -box.height / 2, box.width, box.height),
        Paint()
          ..filterQuality = FilterQuality.high
          ..isAntiAlias = true,
      );
      canvas.restore();
    }
  }
  for (final text in scene.texts) {
    final value = text.text.isNotEmpty ? text.text : (selectedId == text.id ? placeholder : '');
    if (value.isEmpty) continue;
    var fontSize = text.size;
    List<String> lines;
    while (true) {
      final s = fontSize;
      lines = wrapStoryText(value, kStoryWidth - 144, (line) => _measure(line, text.font, s));
      if (lines.length * fontSize * 1.25 <= kStoryHeight - 200 || fontSize <= 28) break;
      fontSize -= 2;
    }
    final widths = [for (final line in lines) _measure(line, text.font, fontSize)];
    final widest = widths.fold<double>(32, (a, b) => a > b ? a : b);
    final double width = math.min(kStoryWidth - 80, widest + 48);
    final height = lines.length * fontSize * 1.25 + 32;
    final x = _clamp(text.x * kStoryWidth, width / 2 + 24, kStoryWidth - width / 2 - 24);
    final y = _clamp(text.y * kStoryHeight, height / 2 + 24, kStoryHeight - height / 2 - 24);
    boxes.add(StoryTextBox(id: text.id, x: x, y: y, width: width, height: height, rotation: text.rotation));
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(text.rotation * math.pi / 180);
    List<Shadow>? shadows;
    if (text.background != 'none') {
      canvas.drawRRect(
        _roundedRect(-width / 2, -height / 2, width, height, 20),
        Paint()..color = text.background == 'dark' ? const Color(0xE818181B) : const Color(0xF2FFFFFF), // #18181be8 / #fffffff2
      );
    } else {
      // shadowColor #000000aa, shadowBlur 8 (σ 4), shadowOffsetY 3
      shadows = const [Shadow(color: Color(0xAA000000), offset: Offset(0, 3), blurRadius: 6.06)];
    }
    final direction = _rtlStart.hasMatch(value) ? TextDirection.rtl : TextDirection.ltr;
    final textX = text.align == 'center' ? 0.0 : text.align == 'left' ? -width / 2 + 24 : width / 2 - 24;
    for (var index = 0; index < lines.length; index++) {
      final painter = TextPainter(
        text: TextSpan(text: lines[index], style: _textStyle(text.font, fontSize, storyColor(text.color), shadows: shadows)),
        textDirection: direction,
      )..layout();
      final lineWidth = painter.width;
      final left = text.align == 'center' ? textX - lineWidth / 2 : text.align == 'left' ? textX : textX - lineWidth;
      painter.paint(canvas, Offset(left, -height / 2 + 16 + index * fontSize * 1.25));
      painter.dispose();
    }
    if (selectedId == text.id) {
      final outline = Path()..addRRect(_roundedRect(-width / 2 - 7, -height / 2 - 7, width + 14, height + 14, 22));
      canvas.drawPath(
        _dashed(outline, const [12, 8]),
        Paint()
          ..color = const Color(0xFFFFFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }
    canvas.restore();
  }
  canvas.restore();
  return boxes;
}

/// The encoded export (`Blob`).
class StoryImageFile {
  const StoryImageFile({required this.bytes, required this.type, required this.extension});
  final Uint8List bytes;

  /// MIME type (`image/png`, `image/jpeg`).
  final String type;
  final String extension;
}

/// `canvas.toBlob(cb, 'image/jpeg', 0.94)`. The default encodes PNG (no JPEG encoder ships with Flutter); a JPEG
/// encoder package can override [storyImageEncoderProvider].
abstract interface class StoryImageEncoder {
  Future<StoryImageFile> encode(ui.Image image);
}

class PngStoryImageEncoder implements StoryImageEncoder {
  const PngStoryImageEncoder();
  @override
  Future<StoryImageFile> encode(ui.Image image) async {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) throw const StoryEditorException('STORY_EXPORT_FAILED');
    return StoryImageFile(bytes: data.buffer.asUint8List(), type: 'image/png', extension: 'png');
  }
}

final storyImageEncoderProvider = Provider<StoryImageEncoder>((ref) => const PngStoryImageEncoder());

/// `exportStoryImage(media, scene)`: the 1080×1920 composite.
Future<StoryImageFile> exportStoryImage(ui.Image media, StoryScene scene, {StoryImageEncoder encoder = const PngStoryImageEncoder()}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, kStoryWidth, kStoryHeight));
  drawStoryScene(canvas, const Size(kStoryWidth, kStoryHeight), media, scene);
  final picture = recorder.endRecording();
  final image = await picture.toImage(kStoryWidth.toInt(), kStoryHeight.toInt());
  picture.dispose();
  try {
    return await encoder.encode(image);
  } finally {
    image.dispose();
  }
}
