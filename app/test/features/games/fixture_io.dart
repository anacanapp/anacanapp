// Ported from: app/tool/games/gen_fixtures.mjs (fixture loading for the cross-language tests).
import 'dart:convert';
import 'dart:io';

/// Fixtures produced by running the ORIGINAL TypeScript engines (see app/tool/games/).
Object? loadFixture(String name) => jsonDecode(File('test/features/games/fixtures/$name.json').readAsStringSync());

/// Asset text (tests run with `app/` as the working directory).
String loadAssetText(String path) => File(path).readAsStringSync();

/// The mulberry32 replacement for `Math.random` used by app/tool/games/entries/setup.ts.
double Function() mulberry32(int seed) {
  var state = seed & 0xFFFFFFFF;
  int imul(int a, int b) => ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF;
  return () {
    state = (state + 0x6D2B79F5) & 0xFFFFFFFF;
    var value = imul(state ^ (state >> 15), state | 1);
    value = (value ^ ((value + imul(value ^ (value >> 7), value | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF;
    return ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296;
  };
}
