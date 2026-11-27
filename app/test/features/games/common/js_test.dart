// Ported from: JavaScript number/JSON semantics used by src/components/games/** (fixtures from
// app/tool/games/entries/common.ts, evaluated by Node/V8)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/games/common/data/game_messages.dart';
import 'package:crypto/crypto.dart';
import 'package:anacan/features/games/common/engine/js.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

void main() {
  final data = asMap(loadFixture('common_js'));

  test('Number.prototype.toString and Math.round', () {
    for (final raw in asList(data['numbers'])) {
      final item = asMap(raw), value = (item['value'] as num).toDouble();
      expect(jsNumberToString(value), item['text'], reason: '$value');
      if (value.abs() < 1e15) expect(jsRound(value), item['round'], reason: 'round $value');
    }
  });

  test('Number(string)', () {
    for (final raw in asList(data['toNumber'])) {
      final item = asMap(raw), value = jsToNumber(item['value'] as String);
      final expected = item['number'];
      expect(expected is String ? jsNumberToString(value) : value, expected, reason: '"${item['value']}"');
    }
  });

  test('ToInt32 / ToUint32 / Math.imul', () {
    for (final raw in asList(data['int32'])) {
      final item = asMap(raw);
      final value = item['value'] is String ? jsToNumber(item['value'] as String) : item['value'] as num;
      expect([toInt32(value), toUint32(value), imul(value, 0x9E3779B9)], [item['int32'], item['uint32'], item['imul']], reason: '$value');
    }
  });

  test('JSON.stringify property order and escaping', () {
    for (final raw in asList(data['objects'])) {
      final item = asMap(raw);
      final map = {for (final entry in asList(item['value'])) asList(entry)[0] as String: asList(entry)[1]};
      expect(jsonStringify(map), item['json']);
    }
  });

  test('app language list and normalizeAppLanguage', () {
    expect(gameAppLanguageCodes, data['appLanguages']);
    for (final raw in asList(data['normalized'])) {
      expect(normalizeGameLanguage(asMap(raw)['value']), asMap(raw)['code']);
    }
  });

  test('stable sort keeps insertion order for ties (V8 TimSort semantics)', () {
    final items = [for (var i = 0; i < 100; i++) (key: i % 7, index: i)];
    final sorted = stableSorted(items, (a, b) => a.key - b.key);
    for (var i = 1; i < sorted.length; i++) {
      final a = sorted[i - 1], b = sorted[i];
      expect(a.key < b.key || (a.key == b.key && a.index < b.index), isTrue);
    }
  });

  test('bundled game assets match their export manifest byte-for-byte', () {
    final manifest = asMap(jsonDecode(loadAssetText('assets/games/manifest.json')));
    expect(manifest.keys, containsAll(['word_garden/az.json', 'word_garden/az-v2.json', 'word_garden/az-v1.json', 'iki_dost/catalog.json']));
    for (final entry in manifest.entries) {
      final bytes = File('assets/games/${entry.key}').readAsBytesSync();
      expect(bytes.length, asMap(entry.value)['bytes'], reason: entry.key);
      expect(sha256.convert(bytes).toString(), asMap(entry.value)['sha256'], reason: entry.key);
    }
  });
}
