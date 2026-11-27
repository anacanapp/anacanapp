// Ported from: (test harness — no React counterpart)
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

bool _fontsLoaded = false;

/// Registers the bundled TTFs so goldens render real glyphs instead of boxes.
Future<void> loadAnacanFonts() async {
  if (_fontsLoaded) return;
  _fontsLoaded = true;
  const families = <String, String>{
    'Nunito': 'assets/fonts/nunito',
    'Inter': 'assets/fonts/inter',
    'Noto Sans Arabic': 'assets/fonts/noto_sans_arabic',
  };
  for (final e in families.entries) {
    final loader = FontLoader(e.key);
    final files = Directory(e.value).listSync().whereType<File>().where((f) => f.path.endsWith('.ttf')).toList()
      ..sort((a, b) => a.path.compareTo(b.path));
    for (final f in files) {
      final bytes = f.readAsBytesSync();
      loader.addFont(Future<ByteData>.value(ByteData.view(Uint8List.fromList(bytes).buffer)));
    }
    await loader.load();
  }
}

/// Pumps, then lets SVG decoding (flutter_svg compiles off the fake-async zone) finish.
Future<void> settleSvgs(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
    await tester.pump();
  }
  await tester.pump(const Duration(seconds: 2));
}
