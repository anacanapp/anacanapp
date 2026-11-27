// Ported from: src/lib/story-export.ts (renderStorySlide), the `save()` of src/components/stories/StoryViewer.tsx
//              (renderStorySlide → shareMedia(blob, `anacan-story-<id>-<n>`, 'Anacan'))
//
// Draws one dashboard story slide to a 1080×1920 picture with dart:ui (no screenshot): rich text with ==mark== /
// __accent__ / **bold**, list / myth / quiz / alert / quote / CTA layouts, the slide art (our SVG or the brand
// mascot) and the anacan.az footer. Fonts: Plus Jakarta Sans for headlines, Inter for text (both bundled). The
// picture is encoded by [StoryImageEncoder] (PNG; React used JPEG 0.93) and shared with the baby-chat share sheet.
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../baby_chat/baby_chat_share.dart' show babyChatSharerProvider, shareMedia;
import '../../onboarding/onboarding_companion.dart' show companionAsset;
import '../../stories/dashboard_stories.dart' show storyIllustration;
import '../../stories/stories.dart';
import '../../stories/story_viewer.dart' show StoryExporter;
import '../editor/story_painter.dart';

const double kStoryExportW = 1080;
const double kStoryExportH = 1920;
const double _pad = 84;
const String _display = 'Plus Jakarta Sans';
const String _text = 'Inter';

typedef _Run = ({String text, StoryTextKind kind});

/// The parts of a 2D context the renderer uses (font, fill, alpha, alignment) over a dart:ui [Canvas].
class _Ctx {
  _Ctx(this.canvas);
  final Canvas canvas;
  String family = _text;
  FontWeight weight = FontWeight.w400;
  double size = 10;
  Color fill = const Color(0xFF000000);
  double alpha = 1;
  String align = 'left';

  void font(int w, double s, String f) {
    weight = FontWeight.values[((w ~/ 100) - 1).clamp(0, 8)];
    size = s;
    family = f;
  }

  TextPainter _painter(String text) => TextPainter(
        text: TextSpan(text: text, style: TextStyle(fontFamily: family, fontWeight: weight, fontSize: size, color: fill.withValues(alpha: fill.a * alpha), height: 1)),
        textDirection: TextDirection.ltr,
      )..layout();

  double measure(String text) {
    if (text.isEmpty) return 0;
    final p = _painter(text);
    final w = p.width;
    p.dispose();
    return w;
  }

  /// `fillText` with the alphabetic baseline at [y].
  void fillText(String text, double x, double y) {
    if (text.isEmpty) return;
    final p = _painter(text);
    final baseline = p.computeDistanceToActualBaseline(TextBaseline.alphabetic);
    final left = align == 'center' ? x - p.width / 2 : align == 'right' ? x - p.width : x;
    p.paint(canvas, Offset(left, y - baseline));
    p.dispose();
  }

  Paint get _paint => Paint()
    ..color = fill.withValues(alpha: fill.a * alpha)
    ..isAntiAlias = true;

  void fillRect(double x, double y, double w, double h) => canvas.drawRect(Rect.fromLTWH(x, y, w, h), _paint);

  RRect _rr(double x, double y, double w, double h, double r) => RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(math.min(r, math.min(w, h) / 2)));

  void fillRound(double x, double y, double w, double h, double r) => canvas.drawRRect(_rr(x, y, w, h, r), _paint);

  void strokeRound(double x, double y, double w, double h, double r, Color color, double width) => canvas.drawRRect(
        _rr(x, y, w, h, r),
        Paint()
          ..color = color.withValues(alpha: color.a * alpha)
          ..style = PaintingStyle.stroke
          ..strokeWidth = width,
      );

  void fillCircle(double x, double y, double r) => canvas.drawCircle(Offset(x, y), r, _paint);
}

/// Word-wraps rich text into lines of styled runs.
List<List<_Run>> _wrap(_Ctx ctx, List<StoryTextPart> parts, void Function(bool bold) font, double maxW) {
  final words = <_Run>[];
  for (final p in parts) {
    for (final w in _splitKeep(p.text)) {
      if (w.isNotEmpty) words.add((text: w, kind: p.kind));
    }
  }
  final lines = <List<_Run>>[[]];
  var width = 0.0;
  final space = RegExp(r'^\s+$');
  for (final w in words) {
    font(w.kind == StoryTextKind.bold);
    final ww = ctx.measure(w.text);
    final isSpace = space.hasMatch(w.text);
    if (!isSpace && width + ww > maxW && lines.last.isNotEmpty) {
      lines.add([]);
      width = 0;
    }
    if (isSpace && width == 0) continue;
    lines.last.add(w);
    width += ww;
  }
  for (final l in lines) {
    while (l.isNotEmpty && space.hasMatch(l.last.text)) {
      l.removeLast();
    }
  }
  return lines;
}

List<String> _splitKeep(String text) {
  final out = <String>[];
  var last = 0;
  for (final m in RegExp(r'\s+').allMatches(text)) {
    out.add(text.substring(last, m.start));
    out.add(m[0]!);
    last = m.end;
  }
  out.add(text.substring(last));
  return out;
}

/// Draws rich text; returns the y below it.
double _drawRich(_Ctx ctx, StoryTheme th, String text, double x, double y, double maxW, double size,
    {bool display = false, int? weight, double? lh, Color? color}) {
  final w = weight ?? (display ? 800 : 600);
  final family = display ? _display : _text;
  void font(bool bold) => ctx.font(bold ? math.max(w, 800) : w, size, family);
  final lineHeight = size * (lh ?? 1.12);
  final lines = _wrap(ctx, parseStoryText(text), font, maxW);
  final padX = size * 0.14;
  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    var cx = x;
    final base = y + i * lineHeight + size * 0.92;
    for (var k = 0; k < line.length; k++) {
      final r = line[k];
      if (r.kind == StoryTextKind.mark) {
        // One chip per run of highlighted words on this line, with breathing room on both sides.
        var j = k;
        var width = 0.0;
        while (j < line.length && line[j].kind == StoryTextKind.mark) {
          font(false);
          width += ctx.measure(line[j].text);
          j++;
        }
        if (k > 0) cx += padX * 0.6;
        ctx.fill = th.pop;
        ctx.fillRound(cx - padX, base - size * 0.9, width + padX * 2, size * 1.12, size * 0.22);
        ctx.fill = th.popInk;
        for (var m = k; m < j; m++) {
          font(false);
          ctx.fillText(line[m].text, cx, base);
          cx += ctx.measure(line[m].text);
        }
        cx += padX * 1.6;
        k = j - 1;
        continue;
      }
      font(r.kind == StoryTextKind.bold);
      final rw = ctx.measure(r.text);
      ctx.fill = r.kind == StoryTextKind.hl ? th.pop : (color ?? th.ink);
      ctx.fillText(r.text, cx, base);
      cx += rw;
    }
  }
  return y + lines.length * lineHeight;
}

double _boxH(_Ctx ctx, String text, double size, double maxW, [int weight = 600]) =>
    _wrap(ctx, parseStoryText(text), (b) => ctx.font(b ? 800 : weight, size, _text), maxW).length * size * 1.25;

/// `toLocaleUpperCase('az-AZ')`.
String _azUpper(String s) => s.replaceAll('i', 'İ').toUpperCase();

String? _str(Object? v) => v is String ? v : null;
List<String> _strs(Object? v) => v is List ? [for (final x in v) '$x'] : const [];

Future<ui.Image> _decodeAsset(String asset) async {
  final data = await rootBundle.load(asset);
  final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
  final frame = await codec.getNextFrame();
  codec.dispose();
  return frame.image;
}

/// `renderStorySlide(story, slideIndex, vars, { mascotSrc })` → the encoded 1080×1920 image.
Future<StoryImageFile> renderStorySlide(Story story, int slideIndex, Map<String, String> vars,
    {String? mascotAsset, StoryImageEncoder encoder = const PngStoryImageEncoder()}) async {
  final slides = story['slides'] as List? ?? const [];
  final sl = Map<String, dynamic>.from(slides[slideIndex] as Map);
  final th = storyThemeOf(story);
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, kStoryExportW, kStoryExportH));
  final ctx = _Ctx(canvas);
  const w = kStoryExportW, h = kStoryExportH, maxW = w - _pad * 2;
  String f(Object? t) => fillStory(_str(t), vars);
  final artInk = th.light ? th.ink : const Color(0xFFFFFFFF);
  final t = '${sl['t'] ?? 'cover'}';

  ctx.fill = th.bg;
  ctx.fillRect(0, 0, w, h);

  // Header: Anacan badge + module, like the in-app story.
  ctx.fill = const Color(0xFFFFFFFF);
  ctx.fillCircle(_pad + 36, 120, 36);
  ctx
    ..fill = const Color(0xFFFF5A5F)
    ..font(800, 38, _display)
    ..align = 'center';
  ctx.fillText('A', _pad + 36, 134);
  ctx.align = 'left';
  ctx
    ..fill = th.ink
    ..font(700, 34, _text);
  ctx.fillText('Anacan', _pad + 92, 132);
  final nameW = ctx.measure('Anacan');
  ctx
    ..alpha = 0.72
    ..font(500, 34, _text);
  ctx.fillText('· ${storyModuleLabel[story['module']] ?? ''}', _pad + 104 + nameW, 132);
  ctx.alpha = 1;

  var y = 230.0;
  void kicker() {
    final k = _str(sl['kicker']);
    if (k == null || k.isEmpty) return;
    ctx
      ..alpha = 0.8
      ..fill = th.ink
      ..font(700, 32, _text);
    ctx.fillText(_azUpper(f(k)).split('').join(' '), _pad, y + 30);
    ctx.alpha = 1;
    y += 70;
  }

  void title(double size) {
    final value = _str(sl['title']);
    if (value != null && value.isNotEmpty) y = _drawRich(ctx, th, f(value), _pad, y, maxW, size, display: true, lh: 1.08) + 24;
  }

  void source() {
    final src = _str(story['source']);
    if (src == null || src.isEmpty || !const ['list', 'alert', 'myth', 'fact'].contains(t)) return;
    ctx
      ..alpha = 0.7
      ..fill = th.ink
      ..font(600, 28, _text);
    ctx.fillText('Mənbə: $src', _pad, y + 36);
    ctx.alpha = 1;
    y += 60;
  }

  void chipBox(double x, double yy, double bw, double bh, [double r = 44]) {
    ctx.fill = th.chip;
    ctx.fillRound(x, yy, bw, bh, r);
  }

  switch (t) {
    case 'cover':
      kicker();
      title(sl['size'] == 'm' ? 78 : sl['size'] == 'l' ? 92 : 112);
    case 'fact':
      kicker();
      ctx
        ..fill = th.ink
        ..font(800, 250, _display);
      final v = f(sl['value']);
      ctx.fillText(v, _pad - 6, y + 220);
      final vw = ctx.measure(v);
      if (_str(sl['unit'])?.isNotEmpty == true) {
        ctx.font(800, 60, _display);
        ctx.fillText(f(sl['unit']), _pad + vw + 16, y + 220);
      }
      y += 270;
      y = _drawRich(ctx, th, f(sl['body']), _pad, y, maxW, 42, lh: 1.35) + 10;
      source();
    case 'list':
      kicker();
      title(84);
      final items = _strs(sl['items']);
      for (var i = 0; i < items.length; i++) {
        final text = f(items[i]);
        const tw = maxW - 160;
        final bh = math.max(110.0, _boxH(ctx, text, 40, tw) + 56);
        chipBox(_pad, y, maxW, bh, 48);
        ctx.fill = th.pop;
        ctx.fillCircle(_pad + 66, y + bh / 2, 34);
        ctx
          ..fill = th.popInk
          ..font(800, 36, _text)
          ..align = 'center';
        ctx.fillText('${i + 1}', _pad + 66, y + bh / 2 + 13);
        ctx.align = 'left';
        _drawRich(ctx, th, text, _pad + 124, y + (bh - _boxH(ctx, text, 40, tw)) / 2 - 4, tw, 40, lh: 1.25);
        y += bh + 22;
      }
      source();
    case 'myth':
      ctx
        ..alpha = 0.8
        ..fill = th.ink
        ..font(700, 32, _text);
      ctx.fillText('MİF VƏ FAKT', _pad, y + 30);
      ctx.alpha = 1;
      y += 70;
      for (final (lbl, text, fact) in [('MİF', f(sl['myth']), false), ('FAKT', f(sl['fact']), true)]) {
        final bh = _boxH(ctx, text, 46, maxW - 96, 700) + 150;
        chipBox(_pad, y, maxW, bh, 60);
        ctx.font(800, 30, _text);
        final lw = ctx.measure(lbl) + 48;
        ctx.fill = fact ? th.pop : th.ink2;
        ctx.fillRound(_pad + 48, y + 44, lw, 54, 27);
        ctx.fill = fact ? th.popInk : th.bg2;
        ctx.fillText(lbl, _pad + 72, y + 82);
        _drawRich(ctx, th, text, _pad + 48, y + 120, maxW - 96, 46, weight: 700, lh: 1.25);
        y += bh + 28;
      }
      source();
    case 'quiz':
      kicker();
      title(80);
      final options = _strs(sl['options']);
      for (var i = 0; i < options.length; i++) {
        final ok = i == sl['correct'];
        const bh = 128.0;
        if (ok) {
          ctx.fill = th.pop;
          ctx.fillRound(_pad, y, maxW, bh, 48);
        } else {
          ctx.alpha = 0.5;
          ctx.strokeRound(_pad, y, maxW, bh, 48, th.ink, 5);
          ctx.alpha = 1;
        }
        _drawRich(ctx, th, '${f(options[i])}${ok ? '  ✓' : ''}', _pad + 44, y + 38, maxW - 88, 40, weight: 700, color: ok ? th.popInk : th.ink);
        y += bh + 22;
      }
      if (_str(sl['explain'])?.isNotEmpty == true) y = _drawRich(ctx, th, f(sl['explain']), _pad, y + 10, maxW, 38, lh: 1.35) + 10;
    case 'alert':
      kicker();
      title(80);
      for (final it in _strs(sl['items'])) {
        final text = f(it);
        const tw = maxW - 120;
        final bh = math.max(104.0, _boxH(ctx, text, 42, tw, 700) + 50);
        chipBox(_pad, y, maxW, bh, 44);
        ctx.fill = th.pop;
        ctx.fillCircle(_pad + 52, y + bh / 2, 14);
        _drawRich(ctx, th, text, _pad + 92, y + (bh - _boxH(ctx, text, 42, tw, 700)) / 2 - 4, tw, 42, weight: 700, lh: 1.25);
        y += bh + 20;
      }
      source();
    case 'quote':
      final badge = _str(sl['badge']);
      if (badge != null && badge.isNotEmpty) {
        ctx.font(800, 32, _text);
        final bw = ctx.measure('✦ $badge') + 56;
        chipBox(_pad, y, bw, 70, 35);
        ctx.fill = th.ink;
        ctx.fillText('✦ $badge', _pad + 28, y + 46);
        y += 110;
      }
      ctx
        ..fill = th.pop
        ..font(800, 200, _display);
      ctx.fillText('“', _pad - 8, y + 150);
      y += 140;
      y = _drawRich(ctx, th, f(sl['quote']), _pad, y, maxW, 72, display: true, lh: 1.18) + 20;
      final src = _str(sl['src']);
      if (src != null && src.isNotEmpty) {
        ctx
          ..alpha = 0.7
          ..fill = th.ink
          ..font(600, 30, _text);
        ctx.fillText(src, _pad, y + 30);
        ctx.alpha = 1;
        y += 60;
      }
    case 'cta':
      kicker();
      title(84);
      y = _drawRich(ctx, th, f(sl['body']), _pad, y, maxW, 42, lh: 1.35) + 30;
      final cta = sl['cta'];
      if (cta is Map) {
        ctx.font(800, 40, _text);
        final label = '${cta['label'] ?? ''}  →';
        final bw = ctx.measure(label) + 100;
        ctx.fill = th.ink2;
        ctx.fillRound(_pad, y, bw, 120, 60);
        ctx.fill = th.bg2;
        ctx.fillText(label, _pad + 50, y + 74);
        y += 150;
      }
  }

  // Art at the bottom: the mascot when the slide asks for it, else our SVG (skipped when the text needs the room).
  const footer = h - 110;
  final room = footer - y - 40;
  try {
    final mascot = sl['mascot'];
    if (mascot != null && mascotAsset != null) {
      final img = await _decodeAsset(mascotAsset);
      final size = math.min(w * 0.86, room);
      if (size > 300) {
        canvas.drawImageRect(img, Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()), Rect.fromLTWH((w - size) / 2, footer - size + 40, size, size),
            Paint()..filterQuality = FilterQuality.high);
      }
      img.dispose();
    } else {
      final items = _strs(sl['items']);
      final name = _str(sl['illus']) ??
          (const ['fact', 'quote', 'myth'].contains(t) || (t == 'list' && items.length <= 3) ? (t == 'quote' ? 'blob' : _str(story['illus'])) : null);
      if (name != null && room > 320) {
        final info = await vg.loadPicture(SvgStringLoader(storyIllustration(name, th.pop, artInk)), null);
        final peek = t == 'cover';
        final iw = info.size.width, ih = info.size.height;
        final dw = peek ? w : math.min(w * 0.72, room * 1.44);
        final dh = dw * (iw > 0 ? ih / iw : 0.69);
        final drawH = math.min(dh, peek ? room + 110 : room);
        final drawW = drawH * (dw / dh);
        canvas.save();
        canvas.translate((w - drawW) / 2, (peek ? h : footer) - drawH);
        if (iw > 0 && ih > 0) canvas.scale(drawW / iw, drawH / ih);
        canvas.drawPicture(info.picture);
        canvas.restore();
        info.picture.dispose();
      }
    }
  } catch (_) {
    // Art is decorative; the text still exports.
  }

  // Brand footer.
  ctx
    ..alpha = 0.85
    ..fill = th.light ? th.ink : const Color(0xFFFFFFFF)
    ..font(700, 30, _text)
    ..align = 'right';
  ctx.fillText('anacan.az', w - _pad, h - 56);
  ctx
    ..align = 'left'
    ..alpha = 1;

  final picture = recorder.endRecording();
  final image = await picture.toImage(w.toInt(), h.toInt());
  picture.dispose();
  try {
    return await encoder.encode(image);
  } finally {
    image.dispose();
  }
}

/// The slide renderer (overridable in tests: `toImage` needs a real engine frame).
final storySlideRendererProvider = Provider<Future<Uint8List> Function(Story story, int slide, Map<String, String> vars, String? mascotAsset)>((ref) {
  final encoder = ref.watch(storyImageEncoderProvider);
  return (story, slide, vars, mascotAsset) async => (await renderStorySlide(story, slide, vars, mascotAsset: mascotAsset, encoder: encoder)).bytes;
});

/// The `storyExporterProvider` value of the dashboard StoryViewer: render, then the share sheet.
final dashboardStoryExporterProvider = Provider<StoryExporter>((ref) {
  final render = ref.watch(storySlideRendererProvider);
  final sharer = ref.watch(babyChatSharerProvider);
  return (story, slide, vars) async {
    final slides = story['slides'] as List? ?? const [];
    final sl = slide < slides.length && slides[slide] is Map ? slides[slide] as Map : const {};
    final mascot = sl['mascot'];
    String? asset;
    if (mascot is String) {
      try {
        asset = companionAsset(mascot, 'success');
      } catch (_) {
        asset = null;
      }
    }
    final bytes = await render(story, slide, vars, asset);
    await shareMedia(sharer, bytes, 'anacan-story-${story['id']}-${slide + 1}', 'Anacan');
  };
});
