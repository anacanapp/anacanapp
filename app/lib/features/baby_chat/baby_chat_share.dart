// Ported from: src/lib/baby-chat-share.ts
//
// Shareable "Körpəmdən mesajlar" media: a 1080×1920 photo of the chat drawn on a canvas (dart:ui), shared through
// the native share sheet. The video variant (MediaRecorder over a canvas stream) has no Flutter counterpart
// without a video encoder plugin: [videoRecordingSupported] is false, so the Video button is hidden, exactly as
// React hides it where MediaRecorder / captureStream are missing. The photo is a PNG (dart:ui has no JPEG
// encoder); React wrote a JPEG at quality 0.92.
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'baby_chat.dart';

class ShareChatInput {
  const ShareChatInput({required this.messages, required this.text, required this.subtitle, this.chip, required this.dayLabel, required this.rtl});
  final List<BabyChatMessage> messages;
  final BabyChatText text;
  final String subtitle;
  final String? chip;
  final String dayLabel;
  final bool rtl;
}

/// A stage-tagged failure, shown with the error message so a device problem can be traced.
class ShareError implements Exception {
  const ShareError(this.code, [this.cause]);
  final String code;
  final Object? cause;
  @override
  String toString() => code;
}

const double _w = 1080;
const double _h = 1920;
// One-off canvas palette of src/lib/baby-chat-share.ts (`C`), not design tokens.
const Color _bg1 = Color(0xFFFFF1EC);
const Color _bg2 = Color(0xFFFDDDD6);
const Color _ink = Color(0xFF2B2326);
const Color _soft = Color(0xFF8A7A7E);
const Color _coral = Color(0xFFFF5A5F);
const Color _white = Color(0xFFFFFFFF);
const Color _lav = Color(0xFFE9DDFB);
const Color _chip = Color(0xFFFFE3DF);
const Color _green = Color(0xFF3BB273);
const Color _placeholder = Color(0xFFB9AAAD);

const _bubbleFont = 46.0, _bubbleLine = 60.0, _padX = 38.0, _padY = 26.0, _bubbleMax = 740.0, _gap = 20.0;

TextPainter _painter(String text, double size, FontWeight weight, Color color, {TextAlign align = TextAlign.left}) => TextPainter(
      text: TextSpan(text: text, style: TextStyle(fontFamily: 'Inter', fontSize: size, fontWeight: weight, color: color, height: 1)),
      textDirection: TextDirection.ltr,
      textAlign: align,
    )..layout();

double _measure(String text, double size, FontWeight weight) => _painter(text, size, weight, _ink).width;

/// `ctx.fillText(text, x, y)` with `textBaseline: alphabetic` and the given `textAlign`.
void _fillText(Canvas c, String text, double x, double y, double size, FontWeight weight, Color color, {String align = 'left', bool middle = false}) {
  final p = _painter(text, size, weight, color);
  final dx = switch (align) { 'center' => x - p.width / 2, 'right' => x - p.width, _ => x };
  final dy = middle ? y - p.height / 2 : y - p.computeDistanceToActualBaseline(TextBaseline.alphabetic);
  p.paint(c, Offset(dx, dy));
}

void _roundRect(Canvas c, double x, double y, double w, double h, double r, Paint paint) =>
    c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)), paint);

/// Word wrap by measured width (`wrap`).
List<String> wrapText(String text, double max, double Function(String) measure) {
  final lines = <String>[];
  for (final para in text.split('\n')) {
    var line = '';
    for (final word in _splitKeepingSpaces(para)) {
      final next = line + word;
      if (measure(next) <= max || line.trim().isEmpty) {
        line = next;
      } else {
        lines.add(line.trim());
        line = word.trimLeft();
      }
    }
    if (line.trim().isNotEmpty) lines.add(line.trim());
  }
  return lines.isEmpty ? [''] : lines;
}

/// `para.split(/(\s+)/)`.
List<String> _splitKeepingSpaces(String s) {
  final out = <String>[];
  var last = 0;
  for (final m in RegExp(r'\s+').allMatches(s)) {
    out.add(s.substring(last, m.start));
    out.add(m.group(0)!);
    last = m.end;
  }
  out.add(s.substring(last));
  return out;
}

({List<String> lines, double width, double height}) _bubbleSize(BabyChatMessage msg) {
  double m(String s) => _measure(s, _bubbleFont, FontWeight.w500);
  final lines = wrapText(msg.text, _bubbleMax - _padX * 2, m);
  final width = math.min(_bubbleMax, lines.map(m).fold<double>(0, math.max) + _padX * 2);
  return (lines: lines, width: width, height: lines.length * _bubbleLine + _padY * 2);
}

void _drawBackground(Canvas c) {
  c.drawRect(
    const Rect.fromLTWH(0, 0, _w, _h),
    Paint()..shader = ui.Gradient.linear(Offset.zero, const Offset(0, _h), const [_bg1, _bg2]),
  );
}

void _drawHeader(Canvas c, ShareChatInput input) {
  c.drawRect(const Rect.fromLTWH(0, 0, _w, 230), Paint()..color = const Color.fromRGBO(255, 255, 255, 0.72));
  c.drawCircle(const Offset(130, 140), 62, Paint()..color = _lav);
  _fillText(c, '👶', 130, 144, 64, FontWeight.w400, _ink, align: 'center', middle: true);
  _fillText(c, '${input.text.u('title')} 💛', 220, 128, 52, FontWeight.w800, _ink);
  _fillText(c, input.subtitle, 220, 182, 36, FontWeight.w500, _soft);
  final chip = input.chip;
  if (chip != null) {
    final w = _measure(chip, 36, FontWeight.w700) + 92;
    _roundRect(c, _w - 60 - w, 104, w, 72, 36, Paint()..color = _chip);
    c.drawCircle(Offset(_w - 60 - w + 40, 140), 13, Paint()..color = _green);
    _fillText(c, chip, _w - 60 - w + 66, 153, 36, FontWeight.w700, _coral);
  }
}

void _drawInput(Canvas c, ShareChatInput input) {
  _roundRect(c, 50, _h - 230, _w - 210, 104, 52, Paint()..color = _white);
  _fillText(c, input.text.u('placeholder'), 96, _h - 164, 40, FontWeight.w500, _placeholder);
  c.drawCircle(const Offset(_w - 100, _h - 178), 52, Paint()..color = _chip);
  _fillText(c, '➤', _w - 96, _h - 162, 46, FontWeight.w700, _coral, align: 'center');
  _fillText(c, 'Anacan · ${input.text.u('end_line1')} ${input.text.u('end_line2')}', _w / 2, _h - 62, 30, FontWeight.w600, _soft, align: 'center');
}

void _drawChat(Canvas c, ShareChatInput input, List<BabyChatMessage> shown) {
  _drawBackground(c);
  _drawHeader(c, input);
  final sizes = shown.map(_bubbleSize).toList();
  const bottom = _h - 270;
  var y = bottom - sizes.fold<double>(0, (s, b) => s + b.height + _gap);
  // Day chip above the first bubble (kept below the header).
  final chipW = _measure(input.dayLabel, 32, FontWeight.w600) + 56;
  final chipY = math.max(270.0, y - 100);
  _roundRect(c, (_w - chipW) / 2, chipY, chipW, 60, 30, Paint()..color = const Color.fromRGBO(255, 255, 255, 0.75));
  _fillText(c, input.dayLabel, _w / 2, chipY + 41, 32, FontWeight.w600, _soft, align: 'center');
  y = math.max(y, chipY + 90);
  for (var i = 0; i < shown.length; i++) {
    final msg = shown[i];
    final b = sizes[i];
    final mine = msg.from == 'mom';
    final leftSide = mine == input.rtl;
    final x = leftSide ? 50.0 : _w - 50 - b.width;
    final rect = RRect.fromRectAndRadius(Rect.fromLTWH(x, y, b.width, b.height), const Radius.circular(44));
    c.drawRRect(rect, Paint()
      ..color = const Color.fromRGBO(160, 80, 80, 0.12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 9));
    c.drawRRect(rect, Paint()..color = mine ? _coral : _white);
    for (var li = 0; li < b.lines.length; li++) {
      _fillText(c, b.lines[li], input.rtl ? x + b.width - _padX : x + _padX, y + _padY + 45 + li * _bubbleLine, _bubbleFont, FontWeight.w500,
          mine ? _white : _ink,
          align: input.rtl ? 'right' : 'left');
    }
    y += b.height + _gap;
  }
  _drawInput(c, input);
}

/// The chat as a 1080×1920 PNG (the last 8 messages).
Future<Uint8List> renderChatPhoto(ShareChatInput input) async {
  try {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, _w, _h));
    _drawChat(canvas, input, input.messages.length > 8 ? input.messages.sublist(input.messages.length - 8) : input.messages);
    final image = await recorder.endRecording().toImage(_w.toInt(), _h.toInt());
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (data == null) throw const ShareError('PHOTO');
    return data.buffer.asUint8List();
  } catch (error) {
    if (error is ShareError) rethrow;
    throw ShareError('PHOTO', error);
  }
}

/// MediaRecorder canvas recording: not available natively (see the header).
bool videoRecordingSupported() => false;

/// `isNativeShare()`: the native share sheet (always, in the Flutter app).
bool isNativeShare() => true;

/// `'shared' | 'cancelled'`.
abstract interface class BabyChatSharer {
  Future<String> share(Uint8List bytes, {required String fileName, required String mimeType, required String text});
}

class SharePlusBabyChatSharer implements BabyChatSharer {
  const SharePlusBabyChatSharer();
  @override
  Future<String> share(Uint8List bytes, {required String fileName, required String mimeType, required String text}) async {
    try {
      final result = await SharePlus.instance.share(ShareParams(
        title: fileName,
        files: [XFile.fromData(bytes, name: fileName, mimeType: mimeType)],
        fileNameOverrides: [fileName],
      ));
      return result.status == ShareResultStatus.dismissed ? 'cancelled' : 'shared';
    } catch (error) {
      if (RegExp('cancel', caseSensitive: false).hasMatch('$error')) return 'cancelled';
      throw ShareError('SHARE_SHEET', error);
    }
  }
}

final babyChatSharerProvider = Provider<BabyChatSharer>((ref) => const SharePlusBabyChatSharer());

/// Renders the photo (overridable in tests; `toImage` needs a real engine frame).
final babyChatPhotoRendererProvider = Provider<Future<Uint8List> Function(ShareChatInput input)>((ref) => renderChatPhoto);

/// `shareMedia(blob, baseName, text)`.
Future<String> shareMedia(BabyChatSharer sharer, Uint8List bytes, String baseName, String text) =>
    sharer.share(bytes, fileName: '$baseName.png', mimeType: 'image/png', text: text);
