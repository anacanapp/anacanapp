// Ported from: (none — Flutter-only guard)
//
// Catches UTF-8 text that was decoded as Windows-1252 and saved again (PowerShell redirection on Windows), which
// garbled user-visible copy (e.g. the Azerbaijani "İstifadəçi" fallback) in a few files.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('no Dart file under lib/ or test/ contains double-encoded UTF-8', () {
    // Lead byte of a 2/3-byte UTF-8 sequence as a Latin-1 char, followed by a continuation byte shown as Latin-1 or
    // its Windows-1252 substitute.
    final pattern = RegExp(
        '[\u00c2-\u00c5\u00c9\u00d0\u00d1\u00d8\u00d9\u00e2][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc'
        '\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]');
    final offenders = <String>[];
    for (final root in ['lib', 'test']) {
      for (final entity in Directory(root).listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        final lines = entity.readAsLinesSync();
        for (var i = 0; i < lines.length; i++) {
          if (pattern.hasMatch(lines[i])) offenders.add('${entity.path}:${i + 1}');
        }
      }
    }
    expect(offenders, isEmpty);
  });
}
