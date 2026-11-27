// Ported from: src/lib/recap/recap.test.ts (renderRecapFrame - determinism), src/lib/recap/anim.ts,
//              src/lib/recap/export.ts (grain tile)
//
// Besides the vitest cases, every frame in fixtures/render_log.json.gz (drawn by the TypeScript renderer into a
// recording context, see gen_render_log.ts) must produce the same drawing calls in Dart.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:anacan/features/recap/recap_anim.dart';
import 'package:anacan/features/recap/recap_canvas.dart';
import 'package:anacan/features/recap/recap_export.dart';
import 'package:anacan/features/recap/recap_render.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/recap_fixtures.dart';

class FakeImage implements RecapImage {
  const FakeImage(this.width, this.height);
  @override
  final int width;
  @override
  final int height;
}

const assets = RecapAssets(logoWhite: FakeImage(300, 200), logoCoral: FakeImage(300, 200), grain: FakeImage(256, 256));

String hash(List<String> lines) {
  var h = 2166136261;
  for (final line in lines) {
    for (final c in line.codeUnits) {
      h = ((h ^ c) * 16777619) & 0xFFFFFFFF;
    }
  }
  return h.toRadixString(16);
}

final RegExp _num = RegExp(r'-?\d+');

/// Same text; numbers (thousandths) may differ by 2 (libm last-ulp differences between V8 and Dart).
bool sameCall(String a, String b) {
  if (a == b) return true;
  if (a.replaceAll(_num, '#') != b.replaceAll(_num, '#')) return false;
  final na = _num.allMatches(a).map((m) => int.parse(m[0]!)).toList();
  final nb = _num.allMatches(b).map((m) => int.parse(m[0]!)).toList();
  for (var i = 0; i < na.length; i++) {
    if ((na[i] - nb[i]).abs() > 2) return false;
  }
  return true;
}

void main() {
  group('renderRecapFrame - determinism', () {
    final m = recapFixtureModel('mommy', 'az');
    String frame(double t) {
      final ctx = RecordingRecapCtx();
      renderRecapFrame(ctx, t, m);
      return hash(ctx.log);
    }

    test('the same time draws the same frame; another time draws a different one', () {
      for (final t in [0.5, 12.0, 17.3, 31.0, 33.4, 44.0, 50.0]) {
        expect(frame(t), frame(t));
      }
      expect(frame(17.3), isNot(frame(17.4)));
    });

    test('every scene renders without throwing, also in Arabic and Japanese', () {
      for (final lang in ['az', 'ar', 'ja', 'ru']) {
        final model = recapFixtureModel('flow', lang);
        final duration = (model['duration']! as num).toDouble();
        for (var t = 0.0; t < duration; t += 0.7) {
          expect(() => renderRecapFrame(RecordingRecapCtx(), t, model), returnsNormally);
        }
        expect(sceneIndexAt(model, duration + 5), (model['scenes']! as List).length - 1);
      }
    });
  });

  group('renderRecapFrame - parity with render.ts', () {
    final cases = (jsonDecode(utf8.decode(gzip.decode(File('test/features/recap/fixtures/render_log.json.gz').readAsBytesSync()))) as List).cast<Map>();
    test('the comparison notices a frame drawn at another time', () {
      final c = cases.first;
      final model = recapFixtureModel(c['name'] as String, c['lang'] as String);
      final t = ((c['times'] as List).first as num).toDouble();
      final want = ((c['frames'] as List).first as List).cast<String>();
      expect(want.length, greaterThan(100));
      final ctx = RecordingRecapCtx();
      renderRecapFrame(ctx, t + 0.3, model, assets);
      var same = ctx.log.length == want.length;
      for (var k = 0; same && k < want.length; k++) {
        same = sameCall(ctx.log[k], want[k]);
      }
      expect(same, isFalse);
    });

    for (final c in cases) {
      test('${c['name']}/${c['lang']}: the same drawing calls as the TypeScript renderer', () {
        final model = recapFixtureModel(c['name'] as String, c['lang'] as String);
        final times = (c['times'] as List).cast<num>();
        final frames = (c['frames'] as List).cast<List>();
        for (var i = 0; i < times.length; i++) {
          final ctx = RecordingRecapCtx();
          renderRecapFrame(ctx, times[i].toDouble(), model, assets);
          final want = frames[i].cast<String>();
          for (var k = 0; k < want.length && k < ctx.log.length; k++) {
            if (!sameCall(ctx.log[k], want[k])) fail('t=${times[i]} call $k\n dart: ${ctx.log[k]}\n   ts: ${want[k]}');
          }
          expect(ctx.log.length, want.length, reason: 't=${times[i]}');
        }
      });
    }
  });

  group('renderRecapFrame - dart:ui canvas', () {
    test('draws every scene of every persona on a real canvas without throwing', () {
      for (final (name, lang) in [('mommy', 'az'), ('bump', 'az'), ('flow', 'ar'), ('light', 'ja')]) {
        final model = recapFixtureModel(name, lang);
        final duration = (model['duration']! as num).toDouble();
        for (var t = 0.0; t < duration; t += 1.3) {
          final recorder = ui.PictureRecorder();
          renderRecapFrame(UiRecapCtx(ui.Canvas(recorder)), t, model);
          recorder.endRecording().dispose();
        }
      }
    });

    test('summaryStillTime: the card is fully on screen', () {
      final m = recapFixtureModel('mommy', 'az');
      final s = (m['scenes']! as List).cast<Map>().firstWhere((x) => x['kind'] == 'summary');
      expect(summaryStillTime(m), closeTo(((s['start'] as num) + 2.6).toDouble(), 1e-9));
    });
  });

  group('anim', () {
    test('prng is Mulberry32, bit for bit', () {
      final r = prng(0xa11ce ^ 2166136261);
      expect([r(), r(), r()], [0.029012206941843033, 0.1712799184024334, 0.649796940619126]);
      final q = prng(13);
      expect([q(), q()], [0.5663226493634284, 0.36011716164648533]);
    });

    test('rgba and mix match the TypeScript strings', () {
      expect(rgba('#FFC977', 0.35), 'rgba(255,201,119,0.350)');
      expect(rgba('#abc', 2), 'rgba(170,187,204,1.000)');
      expect(mix('#FFFFFF', '#FF5A5F', 0.75), '#ff8387');
      expect(mix('#9C8CF0', '#2B1520', 0.45), '#695692');
    });

    test('easings are clamped', () {
      expect(prog(5, 0, 2), 1);
      expect(easeOutCubic(-1), 0);
      expect(easeInOutCubic(0.5), 0.5);
      expect(easeOutExpo(1), 1);
      expect(easeOutBack(1), closeTo(1, 1e-12));
    });

    test('grain tile uses the export.ts LCG', () {
      final px = recapGrainPixels();
      expect([px[0], px[4], px[8], px[12], px[16]], [178, 39, 14, 218, 161]);
      expect(px[3], 255);
    });
  });
}
