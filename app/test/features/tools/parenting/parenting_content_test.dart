// Ported from: src/data/parenting/parenting-content.test.ts
// The content is the bundled JSON (assets/i18n/parenting.<lang>.json, generated from src/data/parenting by
// test/features/tools/parenting/tool/gen_programme_data.mjs); the tag maps are merged into the items there.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/domain/parenting/data/parenting_data.g.dart' show parentingContentLanguages;
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

final ParentingContent c = contentOf('az');
final String allText = jsonEncode(contentJson('az'));

Map<String, String> support(Iterable<({String id, String? support})> list) => {for (final x in list) if (x.support != null) x.id: x.support!};

void main() {
  group('Tərbiyə content (az)', () {
    test('loads lazily through the registry, the same object as the az chunk', () async {
      final registry = ParentingContentRegistry(load: diskAsset, store: LocalStore.memory(), fetchOverrides: (_) async => const []);
      final a = await registry.loadBundled('az');
      expect(identical(await registry.loadBundled('az'), a), true);
      expect(jsonEncode(a), jsonEncode(contentJson('az')));
      expect(await registry.loadBundled('xx'), isNull);
    });

    test('carries search / Anacan.AI tags on SOS cards and articles (ids all exist)', () {
      expect(c.sos.every((s) => (s.tags ?? const []).isNotEmpty), true);
      expect(c.articles.any((a) => (a.tags ?? const []).isNotEmpty), true);
      expect(c.programmes.any((p) => (p.tags ?? const []).isNotEmpty), true);
    });

    test('exists only in Azerbaijani for now', () {
      // Since then translated into every app language: the registry is the generated language list.
      expect(parentingContentLanguages, contains('az'));
      for (final lang in parentingContentLanguages) {
        expect(File('assets/i18n/parenting.$lang.json').existsSync(), true, reason: lang);
      }
      expect(hasParentingContent('az'), true);
      expect(hasParentingContent('xx'), false);
      expect(hasParentingContent(null), false);
      expect(hasParentingContent('constructor'), false);
    });

    test('is a rich library: 4 bands, 60+ articles, 25+ SOS cards, 6 programmes, 2 quizzes, 30 daily tips per band', () {
      expect(c.bands.map((b) => b.id).toList(), ageBandIds);
      expect(c.articles.length, greaterThanOrEqualTo(60));
      expect(c.sos.length, greaterThanOrEqualTo(25));
      expect([for (final p in c.programmes) [p.id, p.days.length]], [
        ['no-shouting-21', 21], ['tantrums-14', 14], ['sleep-7', 7], ['siblings-7', 7], ['screen-reset-7', 7], ['special-time-7', 7], //
      ]);
      expect(c.styleQuiz!.items.length, greaterThanOrEqualTo(10));
      expect(c.milestoneQuiz!.checkpoints.length, greaterThanOrEqualTo(5));
      for (final band in ageBandIds) {
        expect(c.tips[band]!.length, greaterThanOrEqualTo(30));
      }
    });

    test('has unique ids and every age band is covered by articles and SOS cards', () {
      final ids = c.articles.map((a) => a.id).toList();
      expect(ids.toSet().length, ids.length);
      final sosIds = c.sos.map((s) => s.id).toList();
      expect(sosIds.toSet().length, sosIds.length);
      for (final band in ageBandIds) {
        expect(c.articles.where((a) => a.bands.contains(band)).length, greaterThanOrEqualTo(8), reason: band);
        expect(c.sos.where((s) => s.bands.contains(band)).length, greaterThanOrEqualTo(3), reason: band);
      }
    });

    test('gives every topic area at least one full free article and keeps several SOS cards free', () {
      for (final area in c.areas) {
        final inArea = c.articles.where((a) => a.area == area.id);
        expect(inArea, isNotEmpty, reason: area.id);
        expect(inArea.any((a) => a.free), true, reason: area.id);
      }
      expect(c.articles.where((a) => !a.free).length, greaterThanOrEqualTo(15));
      expect(c.sos.where((s) => s.free).length, greaterThanOrEqualTo(6));
      expect(c.sos.where((s) => !s.free).length, greaterThanOrEqualTo(10));
    });

    test('every article is complete: science, a practical step, mistakes, specialist signals and real sources', () {
      for (final a in c.articles) {
        expect(a.science, isNotEmpty, reason: a.id);
        expect(a.tryToday.length, greaterThanOrEqualTo(2), reason: a.id);
        expect(a.mistakes.length, greaterThanOrEqualTo(2), reason: a.id);
        expect(a.specialist, isNotEmpty, reason: a.id);
        expect(a.sources.length, greaterThanOrEqualTo(2), reason: a.id);
        for (final s in a.sources) {
          expect(s.who.isNotEmpty && s.title.isNotEmpty, true, reason: a.id);
          if (s.year != null && s.year!.isNotEmpty) expect(RegExp(r'^(19|20)\d\d$').hasMatch(s.year!), true, reason: a.id);
        }
      }
      for (final s in c.sos) {
        expect(s.steps, hasLength(3));
        expect(s.say, isNotEmpty, reason: s.id);
        expect(s.avoid, isNotEmpty, reason: s.id);
      }
    });

    test('never hardcodes an emergency number (the country helper fills {emergency})', () {
      expect(RegExp(r'(^|[^\d])(103|112|911|999)(?!\d)').hasMatch(allText), false);
      expect(allText, contains('{emergency}'));
    });

    test('never recommends physical punishment or sleep training as mandatory', () {
      expect(RegExp(r'şillə vur|vurmaq lazımdır|ağlamağa burax(ın|) mütləq', caseSensitive: false).hasMatch(allText), false);
      final sleep = c.articles.firstWhere((a) => a.id == 'sleep-routine');
      expect(sleep.mistakes.join(' '), contains('Heç bir üsul hamı üçün vacib deyil'));
    });

    test('every SOS card cites 1–3 sources from the shared list; support cards sit on the safety content', () {
      final shared = jsonDecode(File('assets/i18n/parenting-sources.json').readAsStringSync()) as Map;
      for (final s in c.sos) {
        expect(s.sources!.length, inInclusiveRange(1, 3), reason: s.id);
        for (final id in s.sources!) {
          expect(shared.containsKey(id), true, reason: '${s.id}: $id');
        }
        expect(s.sources!.toSet().length, s.sources!.length, reason: s.id);
      }
      expect(support(c.sos.map((x) => (id: x.id, support: x.support))), {'about-to-lose-it': 'mental-health', 'baby-crying': 'mental-health'});
      final articles = support(c.articles.map((x) => (id: x.id, support: x.support)));
      expect(articles, containsPair('fourth-trimester', 'mental-health'));
      expect(articles, containsPair('body-safety', 'child-safety'));
      expect(support(c.bands.map((x) => (id: x.id, support: x.support))), {'0-1': 'mental-health', '6-12': 'child-safety'});
    });

    test('every language mirrors the SOS source ids and support kinds of az', () {
      for (final lang in parentingContentLanguages) {
        final other = contentOf(lang);
        expect([for (final s in other.sos) [s.id, s.sources, s.support]], [for (final s in c.sos) [s.id, s.sources, s.support]], reason: lang);
        expect([for (final a in other.articles) a.support], [for (final a in c.articles) a.support], reason: lang);
        expect([for (final b in other.bands) b.support], [for (final b in c.bands) b.support], reason: lang);
      }
    });
  });
}
