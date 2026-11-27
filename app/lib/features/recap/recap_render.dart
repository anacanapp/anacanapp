// Ported from: src/lib/recap/render.ts
//
// renderRecapFrame — draws one 1080×1920 frame of the Anacan Recap video at time t (seconds).
// Pure drawing on a [RecapCtx]: no clock, no Random. The same function draws the in-app player and the exported
// PNG, so a frame at t is identical everywhere (given the same fonts). Scenes are the JSON-shaped maps of
// domain/recap/recap_model.dart.
//
// Safe areas: logo lockup top-centre (~120 px from the top), story segments under it,
// all critical content inside the central 1080×1420 band (y 250–1670).
import 'dart:math' as math;

import '../../domain/recap/recap_model.dart' show formatRecapNumber;
import '../../domain/recap/recap_pace.dart';
import 'recap_anim.dart';
import 'recap_canvas.dart';
import 'recap_fonts.dart';

typedef _J = Map<String, Object?>;

const double recapW = 1080;
const double recapH = 1920;
const int recapFps = 30;
const double _cx = recapW / 2;
const double _safeX = 96;
const double _safeW = recapW - _safeX * 2;
const double _pi = math.pi;

class RecapAssets {
  const RecapAssets({this.logoWhite, this.logoCoral, this.grain, this.fonts});

  /// White Anacan mark (for dark/saturated backgrounds).
  final RecapImage? logoWhite;

  /// Coral Anacan mark (for light backgrounds).
  final RecapImage? logoCoral;

  /// A small tile of noise, drawn as film grain.
  final RecapImage? grain;

  /// Font families per role; defaults to the brand fonts (Plus Jakarta Sans / Switzer / Inter).
  final RecapFonts? fonts;
}

// ── Model access ──────────────────────────────────────────────────────────────────────────────
double _d(Object? v) => v is num ? v.toDouble() : 0;
List<_J> _scenes(_J model) => (model['scenes']! as List).cast<_J>();
_J _look(_J s) => (s['look']! as Map).cast<String, Object?>();
String _ink(_J s) => _look(s)['ink']! as String;
bool _light(_J s) => _ink(s) == 'light';
String _accent(_J s) => _look(s)['accent']! as String;
List<String> _bg(_J s) => (_look(s)['bg']! as List).cast<String>();
int _seed(_J s) => (s['seed']! as num).toInt();
String _str(_J s, String k) => s[k] as String? ?? '';
List<String> _strs(_J s, String k) => (s[k] as List? ?? const []).cast<String>();
List<_J> _stats(_J s, String k) => [for (final x in (s[k] as List? ?? const [])) (x as Map).cast<String, Object?>()];
_J _stat(_J s, String k) => (s[k]! as Map).cast<String, Object?>();
bool _truthy(Object? v) => v is String && v.isNotEmpty;
double _jsRound(double v) {
  final f = v.floorToDouble();
  return (v - f) >= 0.5 ? f + 1 : f;
}

/// Index of the scene playing at t.
int sceneIndexAt(Map<String, Object?> model, double t) {
  final scenes = _scenes(model);
  for (var i = 0; i < scenes.length; i++) {
    if (t < _d(scenes[i]['end'])) return i;
  }
  return scenes.length - 1;
}

// ── Colours ───────────────────────────────────────────────────────────────────────────────────
// One-off literals of render.ts (the video's own palette, not the app's design tokens).
const String _inkLight = '#FFFFFF';
const String _inkDark = '#2B1520';
String _inkOf(_J s) => _light(s) ? _inkLight : _inkDark;
String _pillFill(_J s) => _light(s) ? 'rgba(255,255,255,0.16)' : 'rgba(43,21,32,0.07)';
const String _coral = '#FF5A5F';
const String _gold = '#FFC977';

// ── Text ──────────────────────────────────────────────────────────────────────────────────────
class _Word {
  _Word(this.text, this.width);
  final String text;
  final double width;
}

class _Line {
  final List<_Word> words = [];
  double width = 0;
}

class _Layout {
  _Layout(this.lines, this.size, this.weight, this.space);
  final List<_Line> lines;
  final double size;
  final int weight;
  final double space;
}

RecapFont _fontOf(int weight, double size, RecapFamily family) => RecapFont(weight, _jsRound(size), family);

_Layout _layoutText(RecapCtx ctx, String text, double size, int weight, double maxW, RecapFamily family, bool cjk) {
  ctx.font = _fontOf(weight, size, family);
  final space = cjk ? 0.0 : ctx.measureText(' ');
  final lines = <_Line>[];
  for (final para in text.split('\n')) {
    var cur = _Line();
    for (final tok in tokenize(para, cjk)) {
      final w = ctx.measureText(tok);
      final next = cur.words.isNotEmpty ? cur.width + space + w : w;
      if (next > maxW && cur.words.isNotEmpty) {
        lines.add(cur);
        cur = _Line()
          ..words.add(_Word(tok, w))
          ..width = w;
      } else {
        cur.words.add(_Word(tok, w));
        cur.width = next;
      }
    }
    if (cur.words.isNotEmpty) lines.add(cur);
  }
  return _Layout(lines, size, weight, space);
}

/// Largest size (step 2 px) at which the text fits into maxLines lines and every word fits the width.
_Layout _fitText(RecapCtx ctx, String text,
    {required double max, required double min, required int weight, required double maxW, required int maxLines, required RecapFamily family, required bool cjk}) {
  var size = max;
  for (; size > min; size -= 2) {
    final lay = _layoutText(ctx, text, size, weight, maxW, family, cjk);
    if (lay.lines.length <= maxLines && lay.lines.every((l) => l.width <= maxW + 0.5)) return lay;
  }
  return _layoutText(ctx, text, min, weight, maxW, family, cjk);
}

/// Kinetic typography: each word rises and fades in, staggered. Returns the block height.
double _drawKinetic(RecapCtx ctx, _Layout lay, double top, double lt,
    {required String color,
    double? lineH,
    double delay = 0,
    double stagger = Pace.stagger,
    double rise = 0.42,
    required bool rtl,
    required RecapFamily family,
    String? shadow,
    double cx = _cx}) {
  final lh = lineH ?? lay.size * 1.18;
  ctx.font = _fontOf(lay.weight, lay.size, family);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  var idx = 0;
  for (var li = 0; li < lay.lines.length; li++) {
    final line = lay.lines[li];
    final baseline = top + li * lh + lay.size * 0.92;
    var x = rtl ? cx + line.width / 2 : cx - line.width / 2;
    for (final word in line.words) {
      final p = easeOutCubic(prog(lt, delay + idx * stagger, Pace.word));
      idx++;
      final wx = rtl ? x - word.width : x;
      if (p > 0.001) {
        ctx.save();
        ctx.globalAlpha *= p;
        if (shadow != null) {
          ctx.shadowColor = shadow;
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 4;
        }
        ctx.fillStyle = color;
        ctx.fillText(word.text, wx, baseline + (1 - p) * lay.size * rise);
        ctx.restore();
      }
      x = rtl ? x - word.width - lay.space : x + word.width + lay.space;
    }
  }
  return lay.lines.length * lh;
}

void _roundRect(RecapCtx ctx, double x, double y, double w, double h, double r) {
  final rr = math.min(r, math.min(w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRectPath(x, y, w, h, rr);
}

class _Pill {
  _Pill(this.text, this.w);
  final String text;
  final double w;
}

/// Centered pills that wrap to rows; each pops in. Returns the height used.
double _drawPills(RecapCtx ctx, _J s, List<String> texts, double top, double lt, double delay, RecapFamily family,
    {double size = 40, String? fill, String? color, int weight = 600, double? gap}) {
  if (texts.isEmpty) return 0;
  final padX = size * 0.75, h = size * 1.9;
  const g = 16.0;
  ctx.font = _fontOf(weight, size, family);
  final items = texts.map((t) {
    var text = t;
    while (ctx.measureText(text) + padX * 2 > _safeW && text.length > 4) {
      text = '${text.substring(0, text.length - 2)}…';
    }
    return _Pill(text, ctx.measureText(text) + padX * 2);
  }).toList();
  final rows = <List<_Pill>>[[]];
  var rowW = 0.0;
  for (final it in items) {
    if (rowW + it.w + (rows.last.isNotEmpty ? g : 0) > _safeW && rows.last.isNotEmpty) {
      rows.add([]);
      rowW = 0;
    }
    rowW += it.w + (rows.last.isNotEmpty ? g : 0);
    rows.last.add(it);
  }
  var i = 0;
  for (var ri = 0; ri < rows.length; ri++) {
    final row = rows[ri];
    final total = row.fold<double>(0, (sum, it) => sum + it.w) + g * (row.length - 1);
    var x = _cx - total / 2;
    final y = top + ri * (h + g);
    for (final it in row) {
      final p = prog(lt, delay + i * (gap ?? Pace.chipGap), Pace.pill);
      i++;
      if (p > 0) {
        final k = easeOutBack(p, 1.4);
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 1.6);
        ctx.translate(x + it.w / 2, y + h / 2);
        ctx.scale(lerp(0.7, 1, k), lerp(0.7, 1, k));
        _roundRect(ctx, -it.w / 2, -h / 2, it.w, h, h / 2);
        ctx.fillStyle = fill ?? _pillFill(s);
        ctx.fill();
        ctx.fillStyle = color ?? (_light(s) ? '#FFFFFF' : _inkDark);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.text, 0, size * 0.06);
        ctx.restore();
      }
      x += it.w + g;
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  return rows.length * h + (rows.length - 1) * g;
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────────────
void _heartPath(RecapCtx ctx, double x, double y, double size) {
  final s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 1.0, y - s * 1.05, x, y - s * 0.42);
  ctx.bezierCurveTo(x + s * 1.0, y - s * 1.05, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
  ctx.closePath();
}

void _sparklePath(RecapCtx ctx, double x, double y, double r) {
  final k = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

void _crescent(RecapCtx ctx, double x, double y, double r, String color) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.arc(x + r * 0.42, y - r * 0.28, r * 0.86, 0, _pi * 2, true);
  ctx.clip(evenOdd: true);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, _pi * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

void _glow(RecapCtx ctx, double x, double y, double r, String color, double alpha) {
  if (alpha <= 0.002 || r <= 1) return;
  final g = RecapGradient.radial(x, y, 0, x, y, r)
    ..addColorStop(0, rgba(color, alpha))
    ..addColorStop(0.45, rgba(color, alpha * 0.45))
    ..addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/// Music beat envelope: 1 on the beat, decaying.
double _beatPulse(double t, double period) => math.exp(-(t.remainder(period) / period) * 5);

// ── Background ────────────────────────────────────────────────────────────────────────────────
void _drawBackground(RecapCtx ctx, _J s, double t) {
  final bg = _bg(s);
  final top = bg[0], bottom = bg[1], glowC = bg[2];
  final lt = t - _d(s['start']);
  final g = RecapGradient.linear(0, 0, recapW * 0.35, recapH)
    ..addColorStop(0, top)
    ..addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, recapW, recapH);
  final r = prng(_seed(s));
  final a = r() * _pi * 2, b = r() * _pi * 2;
  var warm = 0.32;
  final cold = s['kind'] == 'cold';
  if (cold) warm = lerp(0.05, 0.55, easeInOutCubic(prog(lt, 0.3, 4.2)));
  _glow(ctx, recapW * (0.25 + 0.12 * math.sin(t * 0.21 + a)), recapH * (0.3 + 0.06 * math.cos(t * 0.17 + b)), 820, glowC, warm);
  _glow(ctx, recapW * (0.8 + 0.1 * math.cos(t * 0.19 + b)), recapH * (0.78 + 0.05 * math.sin(t * 0.23 + a)), 900, glowC, warm * 0.8);
  if (cold) _glow(ctx, _cx, recapH * 1.02, 1300, '#FF7A59', lerp(0, 0.75, easeInOutCubic(prog(lt, 0.2, 4.6))));
}

void _drawAmbient(RecapCtx ctx, _J s, double t) {
  final r = prng(0xa11ce ^ _seed(s));
  final cold = s['kind'] == 'cold';
  final n = cold ? 34 : 18;
  final color = _light(s) ? (cold ? '#FFB59E' : '#FFFFFF') : _accent(s);
  const span = recapH + 300;
  for (var i = 0; i < n; i++) {
    final x0 = r() * recapW, y0 = r() * span, speed = 18 + r() * 46, size = (cold ? 6 : 26) + r() * (cold ? 16 : 70);
    final ph = r() * 6.28, alpha = (cold ? 0.35 : 0.06) + r() * (cold ? 0.4 : 0.1);
    final y = ((y0 - t * speed).remainder(span) + span).remainder(span) - 150;
    final x = x0 + math.sin(t * 0.6 + ph) * 30;
    final tw = 0.6 + 0.4 * math.sin(t * 1.7 + ph);
    _glow(ctx, x, y, size, color, alpha * tw * (_light(s) ? 1 : 0.9));
  }
}

void _drawGrain(RecapCtx ctx, RecapAssets assets, double t) {
  final grain = assets.grain;
  if (grain == null) return;
  // Film-like grain that changes 10× a second (cheap to encode, still alive).
  final frame = (t * 10).floor();
  final r = prng(frame * 7919 + 13);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-(r() * 256).floorToDouble(), -(r() * 256).floorToDouble());
  ctx.fillStyle = RecapPattern(grain);
  ctx.fillRect(0, 0, recapW + 256, recapH + 256);
  ctx.restore();
}

void _drawVignette(RecapCtx ctx) {
  final g = RecapGradient.radial(_cx, recapH * 0.48, recapH * 0.28, _cx, recapH * 0.5, recapH * 0.78)
    ..addColorStop(0, 'rgba(0,0,0,0)')
    ..addColorStop(1, 'rgba(20,4,12,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, recapW, recapH);
}

// ── Chrome: logo lockup + story segments (always on top) ───────────────────────────────────────
void _drawLockup(RecapCtx ctx, RecapAssets assets, String ink, double cy, double markH, RecapFamily family, double alpha) {
  if (alpha <= 0.001) return;
  final mark = ink == 'light' ? assets.logoWhite ?? assets.logoCoral : assets.logoCoral ?? assets.logoWhite;
  final textSize = markH * 0.78;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = _fontOf(700, textSize, family);
  final wordW = ctx.measureText('Anacan');
  var markW = 0.0;
  if (mark != null) markW = (markH * math.max(1, mark.width)) / math.max(1, mark.height);
  final gap = mark != null ? markH * 0.22 : 0.0;
  final x0 = _cx - (markW + gap + wordW) / 2;
  if (mark != null) {
    ctx.shadowColor = ink == 'light' ? 'rgba(40,0,10,0.25)' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = ink == 'light' ? 12 : 0;
    ctx.drawImage(mark, x0, cy - markH / 2, markW, markH);
  }
  ctx.fillStyle = ink == 'light' ? '#FFFFFF' : _coral;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Anacan', x0 + markW + gap, cy + textSize * 0.04);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

void _drawChrome(RecapCtx ctx, _J model, double t, int index, RecapAssets assets, RecapFamily family) {
  final s = _scenes(model)[index];
  final lt = t - _d(s['start']);
  // The logo is always fully opaque (it switches colour family at the cut, never fades).
  _drawLockup(ctx, assets, _ink(s), 124, 66, family, 1);
  final alpha = s['kind'] == 'outro' ? 1 - easeInOutCubic(prog(lt, 0.1, 0.5)) : 1.0;
  // Story segments (outro excluded).
  final segs = _scenes(model).where((x) => x['kind'] != 'outro').toList();
  if (segs.isEmpty || alpha <= 0) return;
  const gap = 10.0, y = 196.0, h = 7.0;
  final w = (_safeW - gap * (segs.length - 1)) / segs.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (var i = 0; i < segs.length; i++) {
    final seg = segs[i];
    final x = _safeX + i * (w + gap);
    final ss = _d(seg['start']), se = _d(seg['end']);
    final f = t >= se ? 1.0 : (t <= ss ? 0.0 : (t - ss) / (se - ss));
    final light = _light(s);
    _roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(43,21,32,0.14)';
    ctx.fill();
    if (f > 0) {
      _roundRect(ctx, x, y, math.max(h, w * f), h, h / 2);
      ctx.fillStyle = light ? '#FFFFFF' : _coral;
      ctx.fill();
    }
  }
  ctx.restore();
}

/// Digit groups ("1 576"): the display face's spaces are too narrow, so groups are drawn with an explicit gap.
const String _group = '\u2009';
final RegExp _groupRe = RegExp(r'(\d)[\u00A0\u202F\u2009 ](?=\d)');
String _bigDigits(String text) => text.replaceAllMapped(_groupRe, (m) => '${m[1]}$_group');
double _groupGap(RecapCtx ctx) => (ctx.font.size > 0 ? ctx.font.size : 100) * 0.3;
double _measureGrouped(RecapCtx ctx, String text) {
  final parts = text.split(_group);
  return parts.fold<double>(0, (w, p) => w + ctx.measureText(p)) + _groupGap(ctx) * (parts.length - 1);
}

/// fillText, centred on x, with the digit-group gap.
void _fillGrouped(RecapCtx ctx, String text, double x, double y) {
  final parts = text.split(_group);
  if (parts.length == 1) {
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    return;
  }
  final gap = _groupGap(ctx);
  var cx = x - _measureGrouped(ctx, text) / 2;
  ctx.textAlign = 'left';
  for (final part in parts) {
    ctx.fillText(part, cx, y);
    cx += ctx.measureText(part) + gap;
  }
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────────
String _lang(_J model) => model['language']! as String;
bool _rtl(_J model) => model['rtl'] == true;
bool _cjk(_J model) => model['cjk'] == true;
int _decimals(_J v) => (v['decimals'] as num? ?? 0).toInt();

String _final(_J model, _J v) => formatRecapNumber(_lang(model), v['n']! as num, _decimals(v));

/// Value shown at local time lt: counts up with an expo ease, or a fixed text.
String _valueText(_J model, _J v, double lt, [double start = Pace.numberStart, double dur = Pace.numberCount]) {
  if (_truthy(v['text'])) return v['text']! as String;
  final p = easeOutExpo(prog(lt, start, dur));
  final n = _d(v['n']) * p;
  final dec = _decimals(v);
  final shown = dec != 0 ? _jsRound(n * math.pow(10, dec)) / math.pow(10, dec) : _jsRound(n);
  return formatRecapNumber(_lang(model), shown, dec);
}

double _drawBigNumber(RecapCtx ctx, _J s, String text, String finalText, double cx, double baseline, double maxSize, double maxW, double lt, RecapFamily family,
    [double start = Pace.numberStart, double count = Pace.numberCount]) {
  // Plus Jakarta Sans draws the no-break space very narrow: show the thousands gap as a visible thin space.
  text = _bigDigits(text);
  finalText = _bigDigits(finalText);
  ctx.font = _fontOf(800, maxSize, family);
  final w = _measureGrouped(ctx, finalText);
  final size = w > maxW ? (maxSize * maxW) / w : maxSize;
  final appear = easeOutCubic(prog(lt, start - 0.25, 0.5));
  final pop = prog(lt, start + count, Pace.numberPop);
  final scale = lerp(0.86, 1, easeOutBack(prog(lt, start - 0.25, 0.7), 1.2)) * (1 + 0.05 * math.sin(_pi * pop) * (pop < 1 ? 1 : 0));
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.translate(cx, baseline - size * 0.35);
  ctx.scale(scale, scale);
  ctx.font = _fontOf(800, size, family);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  final g = RecapGradient.linear(0, -size * 0.75, 0, size * 0.35);
  if (_light(s)) {
    g
      ..addColorStop(0, '#FFFFFF')
      ..addColorStop(1, mix('#FFFFFF', _accent(s), 0.75));
  } else {
    g
      ..addColorStop(0, '#FF6A5F')
      ..addColorStop(1, '#D6304A');
  }
  ctx.shadowColor = _light(s) ? 'rgba(30,0,10,0.28)' : 'rgba(230,62,75,0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = g;
  _fillGrouped(ctx, text, 0, size * 0.35);
  ctx.restore();
  return size;
}

// ── Motifs ────────────────────────────────────────────────────────────────────────────────────
const int _calCols = 26, _calRows = 14;
const double _calStep = 32, _calR = 6;
const double _calH = _calRows * _calStep;

void _motifCalendar(RecapCtx ctx, _J s, double lt, double top, double delay) {
  final x0 = _cx - ((_calCols - 1) * _calStep) / 2, y0 = top + _calR;
  const total = _calCols * _calRows; // 364 ≈ one dot per day
  final lit = _jsRound(clamp01(_d(s['param'])) * total);
  final order = List<int>.generate(total, (i) => i);
  final rnd = prng(_seed(s) ^ 0x5eed);
  for (var i = total - 1; i > 0; i--) {
    final j = (rnd() * (i + 1)).floor();
    final tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  final rank = List<int>.filled(total, 0);
  for (var i = 0; i < total; i++) {
    rank[order[i]] = i;
  }
  final appear = easeOutCubic(prog(lt, delay, 0.4));
  final shown = lit * easeOutCubic(prog(lt, delay + 0.1, Pace.calendar));
  final on = _light(s) ? '#FFFFFF' : _coral;
  for (var d = 0; d < total; d++) {
    final cx = x0 + (d % _calCols) * _calStep, cy = y0 + (d ~/ _calCols) * _calStep;
    final isLit = rank[d] < shown;
    ctx.beginPath();
    ctx.arc(cx, cy, isLit ? _calR + 1.5 : _calR * 0.75, 0, _pi * 2);
    ctx.fillStyle = isLit ? rgba(on, 0.92 * appear) : rgba(on, 0.2 * appear);
    ctx.fill();
  }
}

void _motifBloom(RecapCtx ctx, _J s, double lt, double t, double cy, double beat) {
  final b = _beatPulse(t, beat * 2);
  final appear = easeOutCubic(prog(lt, 0.1, 1.2));
  _glow(ctx, _cx, cy, 480, _bg(s)[2], 0.35 * appear);
  for (var i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(_cx, cy, (200 + i * 62) * (0.92 + 0.08 * appear) + b * 10 * (3 - i), 0, _pi * 2);
    ctx.strokeStyle = rgba('#FFFFFF', (0.16 - i * 0.04) * appear);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const dots = 28;
  for (var i = 0; i < dots; i++) {
    final p = prog(lt, 0.4 + i * 0.05, 0.4);
    if (p <= 0) continue;
    final a = (i / dots) * _pi * 2 + t * 0.25;
    final rr = 340 + math.sin(i * 1.7 + t) * 8;
    ctx.beginPath();
    ctx.arc(_cx + math.cos(a) * rr, cy + math.sin(a) * rr, 6 + 4 * ((i % 3) / 2), 0, _pi * 2);
    ctx.fillStyle = rgba(i % 4 == 0 ? _gold : '#FFFFFF', 0.75 * easeOutCubic(p));
    ctx.fill();
  }
}

void _motifMoons(RecapCtx ctx, _J s, double lt, double t, double arcY) {
  final r = prng(_seed(s));
  for (var i = 0; i < 70; i++) {
    final x = r() * recapW, y = 260 + r() * 1400, size = 1.5 + r() * 3.5, ph = r() * 6.28;
    final a = (0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 2.2 + ph))) * easeOutCubic(prog(lt, r() * 0.8, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, _pi * 2);
    ctx.fillStyle = rgba('#FFFFFF', a * 0.85);
    ctx.fill();
  }
  final n = math.max(3, math.min(9, _jsRound(_d(s['param'])).toInt()));
  for (var i = 0; i < n; i++) {
    final p = easeOutBack(prog(lt, 0.3 + i * 0.12, 0.6), 1.5);
    if (p <= 0) continue;
    final f = n == 1 ? 0.5 : i / (n - 1);
    final x = lerp(200, 880, f), y = arcY + 110 - math.sin(f * _pi) * 110 + math.sin(t * 1.3 + i) * 6;
    final rr = (i.isOdd ? 30 : 40) * p;
    _glow(ctx, x, y, rr * 3, '#C9C0FF', 0.35 * p);
    _crescent(ctx, x, y, rr, '#F4EEFF');
  }
}

void _motifBubbles(RecapCtx ctx, _J s, double lt, double t) {
  final r = prng(_seed(s));
  for (var i = 0; i < 22; i++) {
    final x0 = 80 + r() * 920, speed = 60 + r() * 90, size = 18 + r() * 46, ph = r() * 6.28, y0 = r() * 1900;
    final y = recapH + 100 - ((y0 + t * speed).remainder(recapH + 200));
    final x = x0 + math.sin(t * 1.4 + ph) * 26;
    final a = easeOutCubic(prog(lt, 0.1 + r() * 0.6, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, _pi * 2);
    ctx.fillStyle = rgba('#FFFFFF', 0.45 * a);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(_accent(s), 0.35 * a);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.35, size * 0.18, 0, _pi * 2);
    ctx.fillStyle = rgba('#FFFFFF', 0.9 * a);
    ctx.fill();
  }
}

void _motifPulse(RecapCtx ctx, _J s, double lt, double t, double cy, double beat) {
  final period = beat * 2;
  final appear = easeOutCubic(prog(lt, 0.1, 0.8));
  for (var k = 0; k < 3; k++) {
    final ph = ((t / period) + k / 3).remainder(1);
    ctx.beginPath();
    ctx.arc(_cx, cy, 220 + ph * 300, 0, _pi * 2);
    ctx.strokeStyle = rgba('#FFFFFF', (1 - ph) * 0.28 * appear);
    ctx.lineWidth = 6 * (1 - ph) + 1;
    ctx.stroke();
  }
  final b = _beatPulse(t, period) + 0.6 * _beatPulse(t - period * 0.22, period);
  final size = 500 * (0.96 + 0.05 * b) * lerp(0.6, 1, easeOutBack(prog(lt, 0.05, 0.8)));
  ctx.save();
  ctx.globalAlpha *= appear;
  _heartPath(ctx, _cx, cy - 10, size);
  final g = RecapGradient.radial(_cx, cy - 80, 40, _cx, cy, size * 0.7)
    ..addColorStop(0, 'rgba(255,255,255,0.32)')
    ..addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

void _motifRing(RecapCtx ctx, _J s, double lt, double cy, double radius) {
  final isWeeks = s['id'] == 'bump_weeks';
  final appear = easeOutCubic(prog(lt, 0.1, 0.7));
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.arc(_cx, cy, radius, 0, _pi * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
  const start = -_pi / 2;
  final param = _d(s['param']), param2 = _d(s['param2']);
  if (isWeeks) {
    final from = clamp01(param / 40), to = clamp01(param2 / 40);
    final p = easeInOutCubic(prog(lt, 0.4, 1.8));
    final cur = lerp(from, to, p);
    if (from > 0.005) {
      ctx.beginPath();
      ctx.arc(_cx, cy, radius, start, start + _pi * 2 * from);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.stroke();
    }
    final g = RecapGradient.linear(_cx - radius, cy - radius, _cx + radius, cy + radius)
      ..addColorStop(0, '#FFFFFF')
      ..addColorStop(1, _accent(s));
    ctx.beginPath();
    ctx.arc(_cx, cy, radius, start + _pi * 2 * from, start + _pi * 2 * math.max(from + 0.001, cur));
    ctx.strokeStyle = g;
    ctx.stroke();
    final ea = start + _pi * 2 * cur;
    _glow(ctx, _cx + math.cos(ea) * radius, cy + math.sin(ea) * radius, 70, '#FFFFFF', 0.6);
    // 40 week ticks
    for (var i = 0; i < 40; i++) {
      final a = start + (i / 40) * _pi * 2;
      final inner = radius - (i % 10 == 0 ? 66 : 56);
      ctx.beginPath();
      ctx.moveTo(_cx + math.cos(a) * (radius - 46), cy + math.sin(a) * (radius - 46));
      ctx.lineTo(_cx + math.cos(a) * inner, cy + math.sin(a) * inner);
      ctx.lineWidth = i % 10 == 0 ? 4 : 2;
      ctx.strokeStyle = rgba('#FFFFFF', i / 40 <= cur ? 0.6 : 0.18);
      ctx.stroke();
    }
  } else {
    // Cycle wheel: period part (accent) + rest of the cycle; spins in once.
    final cycle = math.max(15.0, param2 != 0 ? param2 : 28.0);
    final period = math.max(1.0, math.min(cycle, param != 0 ? param : 5.0));
    final spin = easeOutQuint(prog(lt, 0.2, 1.8));
    final rot = start + (1 - spin) * -_pi;
    final frac = period / cycle;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.arc(_cx, cy, radius, rot + _pi * 2 * frac + 0.06, rot + _pi * 2 * spin - 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    if (spin > frac) ctx.stroke();
    ctx.beginPath();
    ctx.arc(_cx, cy, radius, rot, rot + _pi * 2 * math.min(frac, spin));
    ctx.strokeStyle = _accent(s);
    ctx.stroke();
    final n = _jsRound(cycle).toInt();
    for (var i = 0; i < n; i++) {
      final a = rot + (i / cycle) * _pi * 2;
      ctx.beginPath();
      ctx.arc(_cx + math.cos(a) * (radius - 58), cy + math.sin(a) * (radius - 58), i < period ? 6 : 4, 0, _pi * 2);
      ctx.fillStyle = rgba(i < period ? _accent(s) : '#FFFFFF', i / cycle <= spin ? 0.8 : 0.15);
      ctx.fill();
    }
  }
  ctx.restore();
}

void _motifOrb(RecapCtx ctx, _J s, double lt, double t, double cy) {
  final appear = easeOutCubic(prog(lt, 0.05, 1.2));
  final breathe = 1 + 0.04 * math.sin(t * 1.6);
  final r = 290 * breathe * lerp(0.7, 1, appear);
  final col = _accent(s);
  _glow(ctx, _cx, cy, r * 1.7, col, 0.45 * appear);
  final g = RecapGradient.radial(_cx - r * 0.3, cy - r * 0.35, r * 0.1, _cx, cy, r)
    ..addColorStop(0, rgba('#FFFFFF', 0.85 * appear))
    ..addColorStop(0.35, rgba(col, 0.9 * appear))
    ..addColorStop(1, rgba(mix(col, '#2B1520', 0.45), 0.85 * appear));
  ctx.beginPath();
  ctx.arc(_cx, cy, r, 0, _pi * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

void _motifGlasses(RecapCtx ctx, _J s, double lt, double top) {
  const n = 8, w = 74.0, h = 110.0, gap = 30.0;
  const x0 = _cx - (n * w + (n - 1) * gap) / 2;
  for (var i = 0; i < n; i++) {
    final x = x0 + i * (w + gap);
    final p = easeInOutCubic(prog(lt, 0.4 + i * 0.1, 0.6));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.86, top + h);
    ctx.lineTo(x + w * 0.14, top + h);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = rgba(_accent(s), 0.85);
    ctx.fillRect(x - 4, top + h - h * 0.85 * p, w + 8, h);
    ctx.restore();
  }
}

void _motifClock(RecapCtx ctx, _J s, double lt, double t, double cy, double r) {
  final ink = _light(s) ? '#FFFFFF' : _inkDark;
  final appear = easeOutCubic(prog(lt, 0.05, 0.7));
  ctx.save();
  ctx.globalAlpha *= appear;
  _glow(ctx, _cx, cy, r * 1.6, _bg(s)[2], 0.4);
  ctx.beginPath();
  ctx.arc(_cx, cy, r, 0, _pi * 2);
  ctx.fillStyle = _light(s) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(ink, 0.85);
  ctx.stroke();
  for (var i = 0; i < 12; i++) {
    final a = (i / 12) * _pi * 2;
    ctx.beginPath();
    ctx.moveTo(_cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8);
    ctx.lineTo(_cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r * 0.9);
    ctx.lineWidth = i % 3 == 0 ? 8 : 4;
    ctx.strokeStyle = rgba(ink, i % 3 == 0 ? 0.9 : 0.5);
    ctx.stroke();
  }
  // Hands sweep to the favourite hour.
  final hour = _d(s['param']);
  final p = easeOutQuint(prog(lt, 0.3, 1.8));
  final hourA = -_pi / 2 + ((hour.remainder(12)) / 12) * _pi * 2 * p + (1 - p) * -_pi * 2;
  final minA = -_pi / 2 + p * _pi * 2 * 3 + math.sin(t) * 0.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(_cx, cy);
  ctx.lineTo(_cx + math.cos(minA) * r * 0.72, cy + math.sin(minA) * r * 0.72);
  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(ink, 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(_cx, cy);
  ctx.lineTo(_cx + math.cos(hourA) * r * 0.5, cy + math.sin(hourA) * r * 0.5);
  ctx.lineWidth = 16;
  ctx.strokeStyle = _light(s) ? _gold : _coral;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(_cx, cy, 16, 0, _pi * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  if (hour >= 20 || hour < 6) {
    _crescent(ctx, _cx + r * 0.98, cy - r * 0.92, 44, '#FFE7C2');
  } else {
    _glow(ctx, _cx + r * 0.98, cy - r * 0.92, 90, '#FFD36E', 0.9);
  }
  ctx.restore();
}

void _motifSparkle(RecapCtx ctx, _J s, double lt, double t) {
  final r = prng(_seed(s));
  for (var i = 0; i < 16; i++) {
    final side = i.isOdd ? 1 : -1;
    final x = _cx + side * (400 + r() * 110), y = 320 + r() * 1320, size = 14 + r() * 30, ph = r() * 6.28;
    final a = (0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 2.4 + ph))) * easeOutCubic(prog(lt, 0.2 + r() * 0.8, 0.5));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(math.sin(t * 0.7 + ph) * 0.3);
    _sparklePath(ctx, 0, 0, size * (0.8 + 0.2 * math.sin(t * 3 + ph)));
    ctx.fillStyle = rgba(i % 3 == 0 ? _gold : '#FFFFFF', a);
    ctx.fill();
    ctx.restore();
  }
}

void _motifHearts(RecapCtx ctx, _J s, double lt, double t) {
  final r = prng(_seed(s));
  for (var i = 0; i < 16; i++) {
    final side = i.isOdd ? 1 : -1;
    final x0 = _cx + side * (390 + r() * 120), speed = 50 + r() * 70, size = 30 + r() * 50, ph = r() * 6.28, y0 = r() * 1900;
    final y = recapH + 100 - ((y0 + t * speed).remainder(recapH + 200));
    final x = x0 + math.sin(t * 1.1 + ph) * 24;
    final a = easeOutCubic(prog(lt, 0.1 + r() * 0.7, 0.6)) * (0.18 + r() * 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(math.sin(t + ph) * 0.25);
    _heartPath(ctx, 0, 0, size);
    ctx.fillStyle = rgba(_light(s) ? '#FFFFFF' : _coral, a * (_light(s) ? 1.6 : 1));
    ctx.fill();
    ctx.restore();
  }
}

void _motifStars(RecapCtx ctx, _J s, double lt, double t) {
  final r = prng(_seed(s));
  for (var i = 0; i < 30; i++) {
    final a0 = r() * _pi * 2, dist = 260 + r() * 360, size = 10 + r() * 22, ph = r() * 6.28;
    final p = easeOutExpo(prog(lt, 0.3 + r() * 0.3, 1.2));
    final x = _cx + math.cos(a0 + t * 0.1) * dist * p, y = 830 + math.sin(a0 + t * 0.1) * dist * p;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.8 + ph);
    _sparklePath(ctx, 0, 0, size);
    ctx.fillStyle = rgba(i.isOdd ? _gold : '#FFFFFF', 0.75 * p);
    ctx.fill();
    ctx.restore();
  }
}

void _motifGift(RecapCtx ctx, _J s, double lt, double cy) {
  // A hospital bag: rounded body, handle, a row of ticks that fill in.
  final appear = easeOutBack(prog(lt, 0.05, 0.7), 1.3);
  const w = 360.0, h = 260.0;
  ctx.save();
  ctx.globalAlpha *= clamp01(appear * 1.4);
  ctx.translate(_cx, cy);
  ctx.scale(lerp(0.7, 1, appear), lerp(0.7, 1, appear));
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = _coral;
  ctx.beginPath();
  ctx.arc(0, -h / 2 + 6, 74, _pi, 0);
  ctx.stroke();
  _roundRect(ctx, -w / 2, -h / 2, w, h, 48);
  final g = RecapGradient.linear(0, -h / 2, 0, h / 2)
    ..addColorStop(0, '#FF7A70')
    ..addColorStop(1, '#E63E4B');
  ctx.fillStyle = g;
  ctx.fill();
  for (var i = 0; i < 3; i++) {
    final p = easeOutBack(prog(lt, 0.7 + i * 0.25, 0.4), 2);
    final x = -100.0 + i * 100;
    ctx.beginPath();
    ctx.arc(x, 10, 32, 0, _pi * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    if (p > 0) {
      ctx.save();
      ctx.translate(x, 10);
      ctx.scale(p, p);
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-4, 11);
      ctx.lineTo(16, -12);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ── Scenes ────────────────────────────────────────────────────────────────────────────────────
class _R {
  _R(this.model, this.assets, this.f, this.t);
  final _J model;
  final RecapAssets assets;
  final RecapFonts f;
  final double t;
}

double _drawEyebrow(RecapCtx ctx, _J s, String text, double top, double lt, _R r, [double delay = 0.05]) {
  final lay = _fitText(ctx, text, max: 52, min: 34, weight: 500, maxW: _safeW, maxLines: 2, family: r.f.body, cjk: _cjk(r.model));
  final color = _light(s) ? rgba(_accent(s) == '#FFFFFF' ? '#FFFFFF' : mix('#FFFFFF', _accent(s), 0.5), 0.95) : '#C8323F';
  return _drawKinetic(ctx, lay, top, lt, color: color, delay: delay, stagger: 0.03, rtl: _rtl(r.model), family: r.f.body);
}

double _drawLine(RecapCtx ctx, _J s, String text, double top, double lt, _R r, double delay,
    [double maxSize = 66, int maxLines = 3, bool body = false, double stagger = Pace.stagger]) {
  final family = body ? r.f.body : r.f.display;
  final lay = _fitText(ctx, text, max: maxSize, min: 38, weight: body ? 500 : 700, maxW: _safeW, maxLines: maxLines, family: family, cjk: _cjk(r.model));
  return _drawKinetic(ctx, lay, top, lt,
      color: _inkOf(s), delay: delay, stagger: stagger, rtl: _rtl(r.model), family: family, shadow: _light(s) ? 'rgba(30,0,10,0.22)' : null);
}

void _drawBadge(RecapCtx ctx, _J s, String text, double cy, double lt, _R r, double delay) {
  final p = prog(lt, delay, 0.55);
  if (p <= 0) return;
  ctx.font = _fontOf(700, 38, r.f.ui);
  final w = math.min(_safeW, ctx.measureText(text) + 130);
  const h = 84.0;
  final k = easeOutBack(p, 1.8);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 1.5);
  ctx.translate(_cx, cy);
  ctx.rotate(-0.025);
  ctx.scale(lerp(0.5, 1, k), lerp(0.5, 1, k));
  _roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  final g = RecapGradient.linear(-w / 2, 0, w / 2, 0)
    ..addColorStop(0, '#FFD98A')
    ..addColorStop(1, '#FFB65C');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(60,10,20,0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)';
  _sparklePath(ctx, -w / 2 + 46, 0, 18);
  ctx.fillStyle = '#7A2E10';
  ctx.fill();
  ctx.fillStyle = '#4A1A08';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 22, 2, w - 110);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

double _pillsHeight(RecapCtx ctx, List<String> texts, double size, RecapFamily family) {
  if (texts.isEmpty) return 0;
  final padX = size * 0.75, h = size * 1.9;
  const gap = 16.0;
  ctx.font = _fontOf(600, size, family);
  var rows = 1;
  var rowW = 0.0;
  for (final t in texts) {
    final w = math.min(_safeW, ctx.measureText(t) + padX * 2);
    if (rowW != 0 && rowW + gap + w > _safeW) {
      rows++;
      rowW = w;
    } else {
      rowW += (rowW != 0 ? gap : 0) + w;
    }
  }
  return rows * h + (rows - 1) * gap;
}

double _lineHeight(_Layout lay, [double k = 1.18]) => lay.lines.length * lay.size * k;

void _drawStat(RecapCtx ctx, _J s, double lt, _R r) {
  final model = r.model, t = r.t;
  final m = s['motif'] as String?;
  final fam = r.f.display, cjk = _cjk(model);
  final plan = statPlan(s, cjk);
  final value = _stat(s, 'value');
  final finalText = value['text'] as String? ?? _final(model, value);
  final subs = _strs(s, 'subs'), chips = _strs(s, 'chips');
  final badge = s['badge'] as String?;
  // Background-level motifs
  if (m == 'bubbles') _motifBubbles(ctx, s, lt, t);
  if (m == 'sparkle') _motifSparkle(ctx, s, lt, t);
  if (m == 'hearts' || m == 'names') _motifHearts(ctx, s, lt, t);
  if (m == 'stars') _motifStars(ctx, s, lt, t);

  // ── Measure ──
  final eyebrow = _fitText(ctx, _str(s, 'eyebrow'), max: 52, min: 34, weight: 500, maxW: _safeW, maxLines: 2, family: r.f.body, cjk: cjk);
  final line = _fitText(ctx, _str(s, 'line'), max: 66, min: 40, weight: 700, maxW: _safeW, maxLines: 3, family: fam, cjk: cjk);
  final double numMax = _truthy(value['text'])
      ? (m == 'clock' ? 200 : 210)
      : m == 'ring'
          ? 220
          : (m == 'clock' || m == 'gift')
              ? 220
              : 300;
  ctx.font = _fontOf(800, numMax, fam);
  final numW = _measureGrouped(ctx, _bigDigits(finalText));
  final numMaxW = m == 'ring' ? 370.0 : _safeW;
  final numSize = numW > numMaxW ? (numMax * numMaxW) / numW : numMax;
  final showCal = m == 'calendar' && _d(s['param']) * 365 >= 30;
  final double heroH = switch (m) {
    'ring' => 640,
    'bloom' => 700,
    'pulse' => 560,
    'orb' => 620,
    'clock' => 460 + 50 + numSize * 0.78,
    'gift' => 360 + 50 + numSize * 0.78,
    'moons' => 230 + numSize * 0.78,
    'glasses' => numSize * 0.78 + 60 + 110,
    _ => numSize * 0.8,
  };
  final subsH = subs.fold<double>(0, (sum, x) => sum + _pillsHeight(ctx, [x], 36, r.f.ui) + 18);
  final chipsH = chips.isNotEmpty ? _pillsHeight(ctx, chips, 34, r.f.ui) + 18 : 0.0;
  final badgeH = _truthy(badge) ? 84.0 + 30 : 0.0;
  const gapA = 46.0, gapB = 56.0, gapC = 40.0;
  final total = _lineHeight(eyebrow) +
      gapA +
      heroH +
      gapB +
      _lineHeight(line) +
      (showCal ? gapC + _calH : 0) +
      (subsH != 0 || chipsH != 0 ? gapC : 0) +
      subsH +
      chipsH +
      (badgeH != 0 ? 20 + badgeH : 0);
  var y = math.max(280.0, 250 + (1420 - total) / 2);

  // ── Draw ──
  y += _drawKinetic(ctx, eyebrow, y, lt,
          color: _light(s) ? rgba(mix('#FFFFFF', _accent(s), 0.5), 0.95) : '#C8323F', delay: 0.05, stagger: 0.03, rtl: _rtl(model), family: r.f.body) +
      gapA;
  final heroTop = y;
  final shown = _valueText(model, value, lt);
  if (m == 'ring') {
    final cy = heroTop + 320;
    _motifRing(ctx, s, lt, cy, 290);
    _drawBigNumber(ctx, s, shown, finalText, _cx, cy + numSize * 0.36, numSize, numMaxW + 1, lt, fam);
  } else if (m == 'bloom' || m == 'pulse' || m == 'orb') {
    final cy = heroTop + heroH / 2;
    if (m == 'bloom') _motifBloom(ctx, s, lt, t, cy, _d(model['beat']));
    if (m == 'pulse') _motifPulse(ctx, s, lt, t, cy, _d(model['beat']));
    if (m == 'orb') _motifOrb(ctx, s, lt, t, cy);
    _drawBigNumber(ctx, s, shown, finalText, _cx, cy + numSize * 0.36, numSize, _safeW + 1, lt, fam);
  } else if (m == 'clock' || m == 'gift') {
    if (m == 'clock') {
      _motifClock(ctx, s, lt, t, heroTop + 230, 220);
    } else {
      _motifGift(ctx, s, lt, heroTop + 200);
    }
    final top = heroTop + (m == 'clock' ? 460 : 360) + 50;
    _drawBigNumber(ctx, s, shown, finalText, _cx, top + numSize * 0.74, numSize, _safeW + 1, lt, fam);
  } else if (m == 'moons') {
    _motifMoons(ctx, s, lt, t, heroTop);
    _drawBigNumber(ctx, s, shown, finalText, _cx, heroTop + 230 + numSize * 0.74, numSize, _safeW + 1, lt, fam);
  } else if (m == 'glasses') {
    _drawBigNumber(ctx, s, shown, finalText, _cx, heroTop + numSize * 0.74, numSize, _safeW + 1, lt, fam);
    _motifGlasses(ctx, s, lt, heroTop + numSize * 0.78 + 60);
  } else {
    _drawBigNumber(ctx, s, shown, finalText, _cx, heroTop + numSize * 0.76, numSize, _safeW + 1, lt, fam);
  }
  y = heroTop + heroH + gapB;
  y += _drawKinetic(ctx, line, y, lt, color: _inkOf(s), delay: plan.line, rtl: _rtl(model), family: fam, shadow: _light(s) ? 'rgba(30,0,10,0.22)' : null);
  if (showCal) {
    y += gapC;
    _motifCalendar(ctx, s, lt, y, plan.calendar);
    y += _calH;
  }
  if (subsH != 0 || chipsH != 0) y += gapC;
  for (var i = 0; i < subs.length; i++) {
    y += _drawPills(ctx, s, [subs[i]], y, lt, plan.subs[i], r.f.ui, size: 36, weight: 600) + 18;
  }
  if (chips.isNotEmpty) {
    y += _drawPills(ctx, s, chips, y, lt, plan.chips, r.f.ui, size: 34, weight: 600, fill: _light(s) ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.7)') + 18;
  }
  if (_truthy(badge)) _drawBadge(ctx, s, badge!, y + 20 + 42, lt, r, plan.badge);
}

void _drawCold(RecapCtx ctx, _J s, double lt, _R r) {
  final kick = easeOutCubic(prog(lt, 0.3, 0.8));
  ctx.save();
  ctx.globalAlpha *= kick;
  ctx.font = _fontOf(700, 40, r.f.body);
  ctx.fillStyle = rgba('#FFB59E', 0.95);
  ctx.textAlign = 'center';
  const label = 'ANACAN RECAP';
  // letter-spaced brand kicker
  final chars = [for (final c in label.runes) String.fromCharCode(c)];
  final widths = [for (final ch in chars) ctx.measureText(ch)];
  const track = 14.0;
  final total = widths.fold<double>(0, (a, b) => a + b) + track * (chars.length - 1);
  var x = _cx - total / 2;
  ctx.textAlign = 'left';
  for (var i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, 660 + (1 - kick) * 20);
    x += widths[i] + track;
  }
  ctx.restore();

  // The year, digit by digit.
  final year = jsYear(s['year']);
  const size = 320.0;
  ctx.font = _fontOf(800, size, r.f.display);
  final digits = [for (final c in year.runes) String.fromCharCode(c)];
  final ws = [for (final d in digits) ctx.measureText(d)];
  final tw = ws.fold<double>(0, (a, b) => a + b);
  var dx = _cx - tw / 2;
  for (var i = 0; i < digits.length; i++) {
    final p = prog(lt, 0.5 + i * 0.12, 0.8);
    final k = easeOutBack(p, 1.3);
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 1.5);
    ctx.translate(dx + ws[i] / 2, 960);
    ctx.scale(lerp(1.4, 1, k), lerp(1.4, 1, k));
    ctx.translate(0, (1 - k) * -80);
    final g = RecapGradient.linear(0, -size * 0.75, 0, 0)
      ..addColorStop(0, '#FFE3D3')
      ..addColorStop(0.55, '#FF9A7A')
      ..addColorStop(1, '#FF5A5F');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,90,95,0.55)';
    ctx.shadowBlur = 60 * easeOutCubic(prog(lt, 1.6, 2));
    ctx.textAlign = 'center';
    ctx.fillText(digits[i], 0, 0);
    ctx.restore();
    dx += ws[i];
  }
  final lay = _fitText(ctx, _str(s, 'title'), max: 76, min: 46, weight: 700, maxW: _safeW, maxLines: 3, family: r.f.display, cjk: _cjk(r.model));
  _drawKinetic(ctx, lay, 1060, lt, color: '#FFFFFF', delay: 1.2, stagger: 0.06, rtl: _rtl(r.model), family: r.f.display, shadow: 'rgba(0,0,0,0.3)');
}

/// `String(year)`.
String jsYear(Object? v) => v is num ? (v == v.truncate() ? '${v.toInt()}' : '$v') : '$v';

void _drawJourney(RecapCtx ctx, _J s, double lt, _R r) {
  var y = 320.0;
  y += _drawEyebrow(ctx, s, _str(s, 'eyebrow'), y, lt, r) + 60;
  final stages = _strs(s, 'stages');
  final n = stages.length;
  if (n == 0) return;
  const cy = 820.0;
  final xs = [for (var i = 0; i < n; i++) n == 1 ? _cx : lerp(250, 830, i / (n - 1))];
  // Path
  final p = easeInOutCubic(prog(lt, 0.3, 0.3 + (n - 1) * 0.45));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(xs[0], cy);
  ctx.lineTo(xs[n - 1], cy);
  ctx.stroke();
  ctx.strokeStyle = _gold;
  ctx.beginPath();
  ctx.moveTo(xs[0], cy);
  ctx.lineTo(lerp(xs[0], xs[n - 1], p), cy);
  ctx.stroke();
  ctx.restore();
  for (var i = 0; i < n; i++) {
    final label = stages[i];
    final k = easeOutBack(prog(lt, 0.3 + i * 0.45, 0.6), 1.8);
    if (k <= 0) continue;
    final rr = 74 * k;
    _glow(ctx, xs[i], cy, rr * 2.4, _gold, 0.45 * clamp01(k));
    ctx.beginPath();
    ctx.arc(xs[i], cy, rr, 0, _pi * 2);
    ctx.fillStyle = i == n - 1 ? _gold : '#FFFFFF';
    ctx.fill();
    // Stage glyphs: simple, brand-neutral hearts.
    ctx.save();
    ctx.translate(xs[i], cy);
    ctx.scale(k, k);
    ctx.fillStyle = i == n - 1 ? '#7A2E10' : _coral;
    _heartPath(ctx, 0, 4, 64);
    ctx.fill();
    ctx.restore();
    final lay = _fitText(ctx, label, max: 50, min: 30, weight: 700, maxW: n == 3 ? 270 : 380, maxLines: 2, family: r.f.body, cjk: _cjk(r.model));
    _drawKinetic(ctx, lay, cy + 110, lt, color: '#FFFFFF', delay: 0.35 + i * 0.45, rtl: _rtl(r.model), family: r.f.body, cx: xs[i]);
  }
  _drawLine(ctx, s, _str(s, 'line'), 1120, lt, r, 0.4 + n * 0.45, 72, 3);
}

void _drawMilestones(RecapCtx ctx, _J s, double lt, _R r) {
  final model = r.model;
  final more = s['more'] as String?;
  final items = [..._strs(s, 'items'), if (_truthy(more)) more!];
  const rowH = 96.0;
  final eyebrow = _fitText(ctx, _str(s, 'eyebrow'), max: 52, min: 34, weight: 500, maxW: _safeW, maxLines: 2, family: r.f.body, cjk: _cjk(model));
  final line = _fitText(ctx, _str(s, 'line'),
      max: items.isNotEmpty ? 60 : 68, min: 38, weight: 700, maxW: _safeW, maxLines: items.isNotEmpty ? 2 : 3, family: r.f.display, cjk: _cjk(model));
  final total = _lineHeight(eyebrow) + 10 + 240 + 50 + (items.isNotEmpty ? items.length * rowH + 40 : 40) + _lineHeight(line);
  var y = math.max(280.0, 250 + (1420 - total) / 2);
  y += _drawEyebrow(ctx, s, _str(s, 'eyebrow'), y, lt, r) + 10;
  final value = _stat(s, 'value');
  final fin = formatRecapNumber(_lang(model), value['n']! as num);
  final size = _drawBigNumber(ctx, s, _valueText(model, value, lt, 0.3, 1.0), fin, _cx, y + 210, 240, _safeW, lt, r.f.display, 0.3, 1.0);
  y += 210 + size * 0.15 + 30;
  final lineDelay = 0.9 + items.length * 0.22;
  if (items.isNotEmpty) {
    // Vertical timeline: dot + label, in the order they happened.
    const x0 = 250.0;
    final top = y;
    final p = easeInOutCubic(prog(lt, 0.8, 0.2 + 0.22 * items.length));
    ctx.save();
    ctx.strokeStyle = rgba(_coral, 0.35);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, top + rowH * 0.5);
    ctx.lineTo(x0, top + rowH * 0.5 + (items.length - 1) * rowH * p);
    ctx.stroke();
    ctx.restore();
    for (var i = 0; i < items.length; i++) {
      final label = items[i];
      final k = easeOutBack(prog(lt, 0.8 + i * 0.22, 0.5), 1.6);
      if (k <= 0) continue;
      final cy = top + rowH * 0.5 + i * rowH;
      final isMore = _truthy(more) && i == items.length - 1;
      ctx.beginPath();
      ctx.arc(x0, cy, 20 * k, 0, _pi * 2);
      ctx.fillStyle = isMore ? rgba(_coral, 0.4) : _coral;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x0, cy, 8 * k, 0, _pi * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= clamp01(k);
      final lay = _fitText(ctx, label, max: 52, min: 32, weight: isMore ? 500 : 700, maxW: 600, maxLines: 1, family: r.f.body, cjk: _cjk(model));
      ctx.font = _fontOf(lay.weight, lay.size, r.f.body);
      ctx.fillStyle = isMore ? rgba(_inkDark, 0.6) : _inkDark;
      ctx.textBaseline = 'middle';
      ctx.textAlign = _rtl(model) ? 'right' : 'left';
      final text = lay.lines.map((l) => l.words.map((w) => w.text).join(_cjk(model) ? '' : ' ')).join(' ');
      ctx.fillText(text, _rtl(model) ? x0 - 50 : x0 + 50 + (1 - k) * 30, cy + 2);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    y = top + items.length * rowH + 40;
  } else {
    y += 40;
  }
  _drawKinetic(ctx, line, math.min(y, 1480), lt, color: _inkDark, delay: lineDelay, rtl: _rtl(model), family: r.f.display);
}

class _Bar {
  const _Bar(this.x, this.h, this.value, this.caption, this.delay, this.strong);
  final double x, h;
  final String value, caption;
  final double delay;
  final bool strong;
}

void _drawGrowth(RecapCtx ctx, _J s, double lt, _R r) {
  final fam = r.f.display, model = r.model;
  final eyebrow = _fitText(ctx, _str(s, 'eyebrow'), max: 54, min: 36, weight: 500, maxW: _safeW, maxLines: 2, family: r.f.body, cjk: _cjk(model));
  final line = _fitText(ctx, _str(s, 'line'), max: 72, min: 44, weight: 700, maxW: _safeW, maxLines: 3, family: fam, cjk: _cjk(model));
  const chartH = 640.0, gainH = 200.0;
  final total = _lineHeight(eyebrow) + 30 + gainH + 30 + chartH + 60 + _lineHeight(line);
  var y = math.max(280.0, 250 + (1420 - total) / 2);
  y += _drawKinetic(ctx, eyebrow, y, lt, color: rgba(mix('#FFFFFF', _accent(s), 0.5), 0.95), delay: 0.05, stagger: 0.03, rtl: _rtl(model), family: r.f.body) + 30;
  // Big gain ("+6,2 kq") counts up.
  final from = _stat(s, 'from'), to = _stat(s, 'to');
  final gain = _str(s, 'gain');
  final gainN = _jsRound((_d(to['n']) - _d(from['n'])) * 10) / 10;
  final lang = _lang(model);
  final counted = gain.replaceFirst(formatRecapNumber(lang, gainN, 1), formatRecapNumber(lang, _jsRound(gainN * easeOutExpo(prog(lt, 0.5, 1.1)) * 10) / 10, 1));
  _drawBigNumber(ctx, s, counted, gain, _cx, y + 170, 210, _safeW, lt, fam, 0.5, 1.1);
  y += gainH + 30;
  // Chart: axis, two bars (start of the year → now), value labels on top, captions under the axis.
  final axisY = y + chartH - 90;
  const maxH = chartH - 200, bw = 250.0;
  final ratio = clamp01(_d(from['n']) / math.max(_d(to['n']), 0.1));
  final ap = easeOutCubic(prog(lt, 0.15, 0.5));
  ctx.save();
  ctx.globalAlpha *= ap;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(_safeX + 40, axisY);
  ctx.lineTo(recapW - _safeX - 40, axisY);
  ctx.stroke();
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  for (var i = 1; i <= 3; i++) {
    final gy = axisY - (maxH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(_safeX + 40, gy);
    ctx.lineTo(recapW - _safeX - 40, gy);
    ctx.stroke();
  }
  ctx.restore();
  final bars = [
    _Bar(_cx - 190, maxH * math.max(0.2, ratio), from['label'] as String? ?? '', _str(s, 'fromLabel'), 0.2, false),
    _Bar(_cx + 190, maxH, to['label'] as String? ?? '', _str(s, 'toLabel'), 0.6, true),
  ];
  for (final b in bars) {
    final p = easeOutQuint(prog(lt, b.delay, 1.0));
    final h = math.max(8.0, b.h * p);
    _roundRect(ctx, b.x - bw / 2, axisY - h, bw, h, 36);
    final g = RecapGradient.linear(0, axisY - h, 0, axisY)
      ..addColorStop(0, b.strong ? '#FFFFFF' : 'rgba(255,255,255,0.6)')
      ..addColorStop(1, b.strong ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)');
    ctx.fillStyle = g;
    ctx.globalAlpha = ap;
    ctx.fill();
    ctx.globalAlpha = 1;
    final vp = easeOutCubic(prog(lt, b.delay + 0.4, 0.4));
    ctx.save();
    ctx.globalAlpha *= vp;
    ctx.textAlign = 'center';
    ctx.font = _fontOf(800, 60, fam);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(80,10,0,0.25)';
    ctx.shadowBlur = 12;
    ctx.fillText(b.value, b.x, axisY - h - 28, bw + 140);
    ctx.shadowBlur = 0;
    ctx.font = _fontOf(600, 36, r.f.ui);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(b.caption, b.x, axisY + 60, bw + 140);
    ctx.restore();
  }
  y += chartH + 60;
  _drawKinetic(ctx, line, y, lt, color: '#FFFFFF', delay: 0.9, rtl: _rtl(model), family: fam, shadow: 'rgba(80,10,0,0.3)');
}

void _drawConfetti(RecapCtx ctx, int seed, double tau, double ox, double oy) {
  if (tau < 0 || tau > 4.5) return;
  final r = prng(seed);
  const colors = ['#FFFFFF', _gold, '#FFB59E', '#FF8FA3', '#FFE3D3'];
  for (var i = 0; i < 150; i++) {
    final a = r() * _pi * 2, v = 700 + r() * 1500, k = 1.6 + r() * 1.2;
    final vx = math.cos(a) * v, vy = math.sin(a) * v - 500;
    final drag = (1 - math.exp(-k * tau)) / k;
    final x = ox + vx * drag, y = oy + vy * drag + 0.5 * 900 * tau * tau * 0.55;
    final rot = r() * 6 + tau * (r() * 10 - 5);
    final size = 12 + r() * 18;
    final fade = 1 - clamp01((tau - 2.8) / 1.6);
    final col = colors[i % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= fade;
    ctx.fillStyle = col;
    if (i % 3 == 0) {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, _pi * 2);
      ctx.fill();
    } else if (i % 3 == 1) {
      ctx.fillRect(-size / 2, -size * 0.2, size, size * 0.4);
    } else {
      _sparklePath(ctx, 0, 0, size * 0.6);
      ctx.fill();
    }
    ctx.restore();
  }
}

void _drawPeak(RecapCtx ctx, _J s, double lt, _R r) {
  final model = r.model;
  final burst = _d(s['burst']);
  final stats = _stats(s, 'stats');
  final dim = 1 - easeOutCubic(prog(lt, burst - 0.2, 0.5));
  // During the breath the scene is darker and quieter.
  if (dim > 0) {
    ctx.fillStyle = 'rgba(40,6,20,${(0.45 * dim).toStringAsFixed(3)})';
    ctx.fillRect(0, 0, recapW, recapH);
  }
  final lay = _fitText(ctx, _str(s, 'lead'), max: 84, min: 50, weight: 800, maxW: _safeW, maxLines: 2, family: r.f.display, cjk: _cjk(model));
  final close = _fitText(ctx, _str(s, 'close'), max: 80, min: 48, weight: 800, maxW: _safeW, maxLines: 2, family: r.f.display, cjk: _cjk(model));
  const rowH = 262.0;
  final total = _lineHeight(lay) + 40 + stats.length * rowH + 30 + _lineHeight(close);
  var y = math.max(280.0, 250 + (1420 - total) / 2);
  y += _drawKinetic(ctx, lay, y, lt, color: '#FFFFFF', delay: 0.15, stagger: 0.12, rtl: _rtl(model), family: r.f.display, shadow: 'rgba(40,0,10,0.25)') + 40;
  for (var i = 0; i < stats.length; i++) {
    final st = stats[i];
    final at = burst + i * 0.25;
    final p = prog(lt, at, 0.6);
    if (p <= 0) continue;
    final k = easeOutBack(p, 1.4);
    final cy = y + i * rowH;
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2);
    ctx.translate(_cx, cy + 120);
    ctx.scale(lerp(1.5, 1, k), lerp(1.5, 1, k));
    ctx.translate(-_cx, -(cy + 120));
    final text = _valueText(model, st, lt, at, 0.8);
    _drawBigNumber(ctx, s, text, _final(model, st), _cx, cy + 150, 170, _safeW, 10, r.f.display, 0);
    final label = st['label'] as String? ?? '';
    final ll = _fitText(ctx, label, max: 46, min: 32, weight: 600, maxW: _safeW, maxLines: 1, family: r.f.ui, cjk: _cjk(model));
    ctx.font = _fontOf(600, ll.size, r.f.ui);
    ctx.fillStyle = rgba('#FFFFFF', 0.92);
    ctx.textAlign = 'center';
    ctx.fillText(label, _cx, cy + 232, _safeW);
    ctx.restore();
  }
  y += stats.length * rowH + 30;
  _drawKinetic(ctx, close, math.min(y, 1520), lt,
      color: '#FFFFFF', delay: burst + 0.2 + stats.length * 0.2, stagger: 0.06, rtl: _rtl(model), family: r.f.display, shadow: 'rgba(40,0,10,0.3)');
  _drawConfetti(ctx, _seed(s), lt - burst, _cx, 900);
}

void _personaGlyph(RecapCtx ctx, String persona, double size, String color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (persona == 'night') {
    _crescent(ctx, 0, 0, size * 0.55, color);
    _sparklePath(ctx, size * 0.42, -size * 0.38, size * 0.16);
    ctx.fill();
  } else if (persona == 'community') {
    _heartPath(ctx, 0, size * 0.04, size * 1.05);
    ctx.fill();
  } else if (persona == 'knowledge') {
    _sparklePath(ctx, 0, 0, size * 0.62);
    ctx.fill();
    _sparklePath(ctx, size * 0.5, -size * 0.45, size * 0.2);
    ctx.fill();
  } else if (persona == 'planner') {
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.52, 0, _pi * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.24, size * 0.02);
    ctx.lineTo(-size * 0.05, size * 0.22);
    ctx.lineTo(size * 0.28, -size * 0.18);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, _pi * 2);
    ctx.fill();
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      final a = (i / 8) * _pi * 2;
      ctx.beginPath();
      ctx.moveTo(math.cos(a) * size * 0.44, math.sin(a) * size * 0.44);
      ctx.lineTo(math.cos(a) * size * 0.62, math.sin(a) * size * 0.62);
      ctx.stroke();
    }
  }
}

void _drawPersona(RecapCtx ctx, _J s, double lt, _R r) {
  final t = r.t;
  var y = 320.0;
  y += _drawEyebrow(ctx, s, _str(s, 'eyebrow'), y, lt, r) + 20;
  const cy = 740.0;
  final k = easeOutBack(prog(lt, 0.2, 0.9), 1.3);
  _glow(ctx, _cx, cy, 420, _gold, 0.35 * clamp01(k));
  ctx.save();
  ctx.translate(_cx, cy);
  ctx.globalAlpha *= clamp01(k);
  for (var i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(t * (0.15 + i * 0.08) * (i.isOdd ? -1 : 1));
    ctx.setLineDash([18.0 + i * 10, 14.0 + i * 6]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(_gold, 0.55 - i * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, (180 + i * 50) * k, 0, _pi * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(0, 0, 150 * k, 0, _pi * 2);
  final g = RecapGradient.radial(-40, -50, 10, 0, 0, 150 * k)
    ..addColorStop(0, '#FFE6B0')
    ..addColorStop(1, '#F2A33A');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.scale(k, k);
  _personaGlyph(ctx, _str(s, 'persona'), 170, '#5A1A0C');
  ctx.restore();
  final title = _fitText(ctx, _str(s, 'title'), max: 124, min: 64, weight: 800, maxW: _safeW, maxLines: 2, family: r.f.display, cjk: _cjk(r.model));
  ctx.save();
  // Gold title
  const ty = 1010.0;
  final th = _drawKinetic(ctx, title, ty, lt,
      color: _gold, delay: 0.5, stagger: 0.1, rise: 0.3, rtl: _rtl(r.model), family: r.f.display, shadow: 'rgba(255,201,119,0.35)');
  ctx.restore();
  _drawLine(ctx, s, _str(s, 'reason'), ty + th + 50, lt, r, 0.9, 52, 4, true, 0.03);
}

void _drawSummary(RecapCtx ctx, _J s, double lt, _R r) {
  final model = r.model, assets = r.assets;
  final p = easeOutQuint(prog(lt, 0.05, 0.9));
  const x = 84.0, h = 1240.0, y = 250 + (1420 - h) / 2, w = recapW - 168;
  ctx.save();
  ctx.translate(0, (1 - p) * 220);
  ctx.globalAlpha *= clamp01(p * 1.4);
  ctx.save();
  _roundRect(ctx, x, y, w, h, 64);
  ctx.shadowColor = 'rgba(120,20,40,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#FFF8F4';
  ctx.fill();
  ctx.restore();
  // Card top: brand ribbon
  ctx.save();
  _roundRect(ctx, x, y, w, h, 64);
  ctx.clip();
  final rib = RecapGradient.linear(x, y, x + w, y + 360)
    ..addColorStop(0, '#FF5A5F')
    ..addColorStop(1, '#FF9A7A');
  ctx.fillStyle = rib;
  ctx.fillRect(x, y, w, 360);
  _glow(ctx, x + w * 0.85, y + 40, 300, '#FFC977', 0.55);
  ctx.restore();
  // Name and year on the ribbon
  final year = jsYear(s['year']);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = _fontOf(600, 38, r.f.ui);
  ctx.fillStyle = rgba('#FFFFFF', 0.92);
  ctx.fillText('${_str(s, 'kicker')} · $year', _cx, y + 100, w - 120);
  final nameText = s['name'] as String? ?? 'Anacan $year';
  final nl = _fitText(ctx, nameText, max: 128, min: 64, weight: 800, maxW: w - 140, maxLines: 1, family: r.f.display, cjk: _cjk(model));
  ctx.font = _fontOf(800, nl.size, r.f.display);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(nameText, _cx, y + 100 + 30 + nl.size * 0.95, w - 140);
  // Persona pill
  final persona = _str(s, 'persona');
  ctx.font = _fontOf(700, 38, r.f.ui);
  final pw = math.min(w - 160, ctx.measureText(persona) + 120);
  const py = y + 360;
  ctx.save();
  _roundRect(ctx, _cx - pw / 2, py - 42, pw, 84, 42);
  ctx.fillStyle = '#2B1520';
  ctx.fill();
  _sparklePath(ctx, _cx - pw / 2 + 44, py, 16);
  ctx.fillStyle = _gold;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.fillText(persona, _cx + 18, py + 2, pw - 110);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  // 2×2 stats
  const cellW = (w - 120) / 2, cellH = 330.0;
  const gx = x + 60, gy = y + 450;
  final all = _stats(s, 'stats');
  final stats = all.take(4).toList();
  for (var i = 0; i < stats.length; i++) {
    final st = stats[i];
    // 4 → 2×2; 3 → two on top and one wide below; 1–2 → one row.
    final wide = (stats.length == 3 && i == 2) || stats.length == 1;
    final cx = wide ? _cx : gx + (i % 2) * cellW + cellW / 2, top = gy + (i ~/ 2) * cellH;
    final cw = wide ? cellW * 2 : cellW;
    final k = easeOutBack(prog(lt, 0.4 + i * 0.15, 0.55), 1.4);
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= clamp01(k * 1.5);
    _roundRect(ctx, cx - cw / 2 + 12, top, cw - 24, cellH - 30, 40);
    ctx.fillStyle = '#FFEDE6';
    ctx.fill();
    final text = _bigDigits(_valueText(model, st, lt, 0.6 + i * 0.15, 1.0));
    final fin = _bigDigits(_final(model, st));
    ctx.font = _fontOf(800, 118, r.f.display);
    final fw = _measureGrouped(ctx, fin);
    final size = fw > cellW - 70 ? (118 * (cellW - 70)) / fw : 118.0;
    ctx.font = _fontOf(800, size, r.f.display);
    final g = RecapGradient.linear(0, top + 40, 0, top + 170)
      ..addColorStop(0, '#FF6A5F')
      ..addColorStop(1, '#D6304A');
    ctx.fillStyle = g;
    _fillGrouped(ctx, text, cx, top + 60 + size * 0.8);
    final ll = _fitText(ctx, st['label'] as String? ?? '', max: 40, min: 28, weight: 600, maxW: cw - 70, maxLines: 2, family: r.f.ui, cjk: _cjk(model));
    _drawKinetic(ctx, ll, top + 60 + size * 0.8 + 22, 10, color: rgba(_inkDark, 0.75), rtl: _rtl(model), family: r.f.ui, cx: cx);
    ctx.restore();
  }
  // Footer: mark + site
  const fy = y + h - 96;
  ctx.save();
  ctx.globalAlpha *= easeOutCubic(prog(lt, 1.0, 0.5));
  final mark = assets.logoCoral;
  final site = _str(s, 'site');
  ctx.font = _fontOf(700, 44, r.f.body);
  final sw = ctx.measureText(site);
  var mw = 0.0;
  if (mark != null) mw = (56 * math.max(1, mark.width)) / math.max(1, mark.height);
  final fx = _cx - (mw + (mark != null ? 16 : 0) + sw) / 2;
  if (mark != null) ctx.drawImage(mark, fx, fy - 28, mw, 56);
  ctx.fillStyle = _coral;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(site, fx + mw + (mark != null ? 16 : 0), fy + 2);
  ctx.restore();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

void _drawOutro(RecapCtx ctx, _J s, double lt, _R r) {
  final assets = r.assets;
  const cy = 740.0;
  // The white Anacan mark on its own (no disc, no rings).
  final k = easeOutBack(prog(lt, 0.2, 0.9), 1.4);
  final mark = assets.logoWhite ?? assets.logoCoral;
  if (mark != null && k > 0) {
    const mh = 330.0;
    final mw = (mh * math.max(1, mark.width)) / math.max(1, mark.height);
    ctx.save();
    ctx.translate(_cx, cy);
    ctx.scale(lerp(0.6, 1, k), lerp(0.6, 1, k));
    ctx.globalAlpha *= clamp01(k * 1.5);
    ctx.shadowColor = 'rgba(110,10,30,0.28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(mark, -mw / 2, -mh / 2, mw, mh);
    ctx.restore();
  }
  final wp = easeOutCubic(prog(lt, 0.5, 0.6));
  ctx.save();
  ctx.globalAlpha *= wp;
  ctx.font = _fontOf(700, 150, r.f.body);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(80,0,20,0.25)';
  ctx.shadowBlur = 24;
  ctx.fillText('Anacan', _cx, 1110 + (1 - wp) * 30);
  ctx.restore();
  final tl = _fitText(ctx, _str(s, 'tagline'), max: 62, min: 40, weight: 500, maxW: _safeW, maxLines: 2, family: r.f.body, cjk: _cjk(r.model));
  final th = _drawKinetic(ctx, tl, 1170, lt, color: rgba('#FFFFFF', 0.95), delay: 0.7, stagger: 0.06, rtl: _rtl(r.model), family: r.f.body);
  final sy = 1170 + th + 50;
  _drawPills(ctx, s, [_str(s, 'site')], sy, lt, 1.1, r.f.ui, size: 44, weight: 700, fill: '#FFFFFF', color: _coral);
  final st = _fitText(ctx, _str(s, 'stores'), max: 38, min: 28, weight: 500, maxW: _safeW, maxLines: 1, family: r.f.ui, cjk: _cjk(r.model));
  _drawKinetic(ctx, st, sy + 44 * 1.9 + 40, lt, color: rgba('#FFFFFF', 0.88), delay: 1.3, rtl: _rtl(r.model), family: r.f.ui);
}

void _drawSceneContent(RecapCtx ctx, _J s, double lt, _R r) {
  switch (s['kind']) {
    case 'cold':
      return _drawCold(ctx, s, lt, r);
    case 'stat':
      return _drawStat(ctx, s, lt, r);
    case 'journey':
      return _drawJourney(ctx, s, lt, r);
    case 'milestones':
      return _drawMilestones(ctx, s, lt, r);
    case 'growth':
      return _drawGrowth(ctx, s, lt, r);
    case 'peak':
      return _drawPeak(ctx, s, lt, r);
    case 'persona':
      return _drawPersona(ctx, s, lt, r);
    case 'summary':
      return _drawSummary(ctx, s, lt, r);
    case 'outro':
      return _drawOutro(ctx, s, lt, r);
  }
}

/// Draws the frame at time t (seconds) into a 1080×1920 context (the caller scales the canvas to its size).
void renderRecapFrame(RecapCtx ctx, double tSeconds, Map<String, Object?> model, [RecapAssets assets = const RecapAssets()]) {
  final t = math.max(0.0, math.min(_d(model['duration']) - 1e-4, tSeconds));
  final scenes = _scenes(model);
  if (scenes.isEmpty) return;
  final index = sceneIndexAt(model, t);
  final s = scenes[index];
  final lt = t - _d(s['start']);
  final dur = _d(s['end']) - _d(s['start']);
  final f = assets.fonts ?? recapFonts;
  final r = _R(model, assets, f, t);

  ctx.save();
  // setTransform(1, 0, 0, 1, 0, 0) / direction = 'ltr': the caller's transform is kept (the painter scales
  // 1080×1920 to the widget); text runs are laid out left-to-right like the canvas.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  final prev = index > 0 ? scenes[index - 1] : null;
  final mixIn = prev != null ? easeInOutCubic(prog(lt, 0, 0.55)) : 1.0;
  if (prev != null && mixIn < 1) _drawBackground(ctx, prev, t);
  ctx.globalAlpha = mixIn;
  _drawBackground(ctx, s, t);
  ctx.globalAlpha = 1;
  _drawAmbient(ctx, s, t);

  final last = index == scenes.length - 1;
  final exit = last ? 0.0 : easeInCubic(prog(lt, dur - 0.36, 0.36));
  ctx.save();
  ctx.globalAlpha = 1 - exit;
  if (exit > 0) {
    ctx.translate(_cx, recapH / 2);
    ctx.scale(1 - 0.04 * exit, 1 - 0.04 * exit);
    ctx.translate(-_cx, -recapH / 2 - 50 * exit);
  }
  _drawSceneContent(ctx, s, lt, r);
  ctx.restore();

  // Light flash on the musical hits.
  for (final hit in (model['hits'] as List? ?? const [])) {
    final fl = t - _d(hit);
    if (fl >= 0 && fl < 0.7) {
      final a = math.pow(1 - fl / 0.7, 2).toDouble();
      _glow(ctx, _cx, recapH * 0.45, 1400 * (0.6 + fl), '#FFFFFF', 0.55 * a);
    }
  }

  _drawVignette(ctx);
  _drawGrain(ctx, assets, t);
  _drawChrome(ctx, model, t, index, assets, f.body);
  ctx.restore();
}

/// Time at which the summary card is fully on screen (for the "share as image" PNG).
double summaryStillTime(Map<String, Object?> model) {
  for (final s in _scenes(model)) {
    if (s['kind'] == 'summary') return math.min(_d(s['end']) - 0.5, _d(s['start']) + 2.6);
  }
  return _d(model['duration']) / 2;
}
