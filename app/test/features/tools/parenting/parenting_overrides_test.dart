// Ported from: src/lib/parenting-overrides.test.ts
import 'dart:async';
import 'dart:convert';

import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

ParentingOverrideRow row(String type, String id, Map<String, Object?> patch) => ParentingOverrideRow(itemType: type, itemId: id, patch: patch);
final Json az = contentJson('az');
Json item(String list, String id) => Json.from((az[list] as List).firstWhere((x) => (x as Map)['id'] == id) as Map);

/// The `db` mock: rows, call count, filters, mode ok / error / hang.
class _Db {
  List<ParentingOverrideRow> rows = [];
  int calls = 0;
  String mode = 'ok';
  final List<String> languages = [];
  Future<List<Object?>> fetch(String language) {
    calls++;
    languages.add(language);
    if (mode == 'hang') return Completer<List<Object?>>().future;
    if (mode == 'error') return Future.error(StateError('x'));
    return Future.value([for (final r in rows) r.toJson()]);
  }
}

List<Json> rowsJson(List<ParentingOverrideRow> rows) => [for (final r in rows) r.toJson()];

void main() {
  late _Db db;
  late LocalStore store;
  setUp(() {
    db = _Db();
    store = LocalStore.memory();
  });

  group('Tərbiyə content overrides merge', () {
    test('patches an article by id and never mutates the bundled content', () {
      final before = jsonEncode(az);
      final out = applyParentingOverrides(az, [row('article', 'lying', {'title': 'Yalan: yeni başlıq', 'tryToday': ['Bir', 'İki']})]);
      final a = (out['articles'] as List).firstWhere((x) => x['id'] == 'lying') as Map;
      expect(a['title'], 'Yalan: yeni başlıq');
      expect(a['tryToday'], ['Bir', 'İki']);
      expect(a['science'], item('articles', 'lying')['science']);
      expect(jsonEncode(az), before);
      expect(jsonEncode([for (final x in out['articles'] as List) if (x['id'] != 'lying') x]),
          jsonEncode([for (final x in az['articles'] as List) if (x['id'] != 'lying') x]));
    });

    test('ignores structural fields, unknown fields and wrong types; keeps the rest of the patch', () {
      final base = item('sos', 'shop-tantrum');
      final out = patchItem(base, {'id': 'hack', 'free': !(base['free'] as bool), 'bands': ['6-12'], 'title': 42, 'moment': 'Yeni an', 'bogus': 'x', 'say': 'not an array'});
      expect(out['id'], base['id']);
      expect(out['free'], base['free']);
      expect(out['bands'], base['bands']);
      expect(out['title'], base['title']);
      expect(out['moment'], 'Yeni an');
      expect(out['say'], base['say']);
      expect(out.containsKey('bogus'), false);
    });

    test('keeps the three SOS steps (object arrays keep their length) and merges a step partially', () {
      final base = Json.from((az['sos'] as List).first as Map);
      expect(patchItem(base, {'steps': [{'title': 'Tək'}]})['steps'], base['steps']);
      final out = patchItem(base, {'steps': [{'title': 'Bir'}, {}, {'text': 'Üç mətn'}]});
      final steps = base['steps'] as List;
      expect((out['steps'] as List)[0], {'title': 'Bir', 'text': steps[0]['text']});
      expect((out['steps'] as List)[2], {'title': steps[2]['title'], 'text': 'Üç mətn'});
    });

    test('lets an editor add optional fields (byAge, redFlag, tags) and drops blank lines', () {
      final base = Json.from((az['articles'] as List).firstWhere((a) => (a as Map)['byAge'] == null) as Map);
      final out = patchItem(base, {'byAge': {'3-6': 'Bağça yaşında…'}, 'tags': ['yeni', '  '], 'science': ['', '']});
      expect((out['byAge'] as Map)['3-6'], 'Bağça yaşında…');
      expect(out['tags'], ['yeni']);
      expect(out['science'], base['science']); // a required list may not become empty
    });

    test('patches programme days, tips, bands, areas and quizzes by their ids', () {
      final cps = (az['milestoneQuiz'] as Map)['checkpoints'] as List;
      final out = ParentingContent.fromJson(applyParentingOverrides(az, [
        row('programme_day', 'sleep-7:2', {'task': 'Yeni tapşırıq'}),
        row('tip', '1-3:1', {'title': 'Yeni məsləhət'}),
        row('band', '0-1', {'lead': 'Yeni giriş'}),
        row('area', 'emotions', {'title': 'Hisslər'}),
        row('quiz', 'style', {'results': {'balanced': {'title': 'Tarazlı'}}}),
        row('quiz', 'milestones', {'checkpoints': [for (final _ in cps) {'id': 'x', 'fromMonths': 99}]}),
        row('programme_day', 'sleep-7:99', {'task': 'yoxdur'}),
        row('tip', 'zz:1', {'title': 'yoxdur'}),
      ]));
      final base = contentOf('az');
      final sleep = out.programmes.firstWhere((p) => p.id == 'sleep-7');
      expect(sleep.days[1].task, 'Yeni tapşırıq');
      expect(sleep.days[1].title, base.programmes.firstWhere((p) => p.id == 'sleep-7').days[1].title);
      expect(sleep.days, hasLength(7));
      expect(out.tips['1-3']![0].title, 'Yeni məsləhət');
      expect(out.bands.firstWhere((b) => b.id == '0-1').lead, 'Yeni giriş');
      expect(out.areas.firstWhere((a) => a.id == 'emotions').title, 'Hisslər');
      expect(out.styleQuiz!.results['balanced']!.title, 'Tarazlı');
      expect(out.styleQuiz!.results['balanced']!.detail, base.styleQuiz!.results['balanced']!.detail);
      expect([for (final c in out.milestoneQuiz!.checkpoints) [c.id, c.fromMonths]], [for (final c in base.milestoneQuiz!.checkpoints) [c.id, c.fromMonths]]);
      expect(base.tips['1-3']![0].title, isNot('Yeni məsləhət'));
    });

    test('never lets an editor change the support kind or an SOS card’s source ids; milestone support text stays editable', () {
      final cps = (az['milestoneQuiz'] as Map)['checkpoints'] as List;
      final out = ParentingContent.fromJson(applyParentingOverrides(az, [
        row('sos', 'about-to-lose-it', {'support': 'child-safety', 'sources': ['nope'], 'title': 'Yeni ad'}),
        row('article', 'body-safety', {'support': 'x'}),
        row('quiz', 'milestones', {
          'checkpoints': [
            for (final cp in cps) {'items': [for (final _ in (cp as Map)['items'] as List) {'support': 'Yeni dəstək'}]},
          ],
        }),
      ]));
      final card = out.sos.firstWhere((s) => s.id == 'about-to-lose-it');
      expect(card.title, 'Yeni ad');
      expect(card.support, 'mental-health');
      expect(card.sources, item('sos', 'about-to-lose-it')['sources']);
      expect(out.articles.firstWhere((x) => x.id == 'body-safety').support, 'child-safety');
      expect(out.milestoneQuiz!.checkpoints[0].items[0].support, 'Yeni dəstək');
      expect(isLockedField('support', 'mental-health'), true);
      expect(isLockedField('support', 'Bu bacarığı dəstəkləyin'), false);
      expect(isLockedField('sources', ['purple']), true);
      expect(isLockedField('sources', [{'who': 'x', 'title': 'y'}]), false);
      final sos = item('sos', 'about-to-lose-it');
      expect(diffPatch(sos, {...sos, 'support': 'child-safety', 'sources': []}), isEmpty);
    });

    test('finds items and diffs an edited copy by top-level field', () {
      final sleep = (az['programmes'] as List).firstWhere((p) => (p as Map)['id'] == 'sleep-7') as Map;
      expect(identical(findParentingItem(az, 'programme_day', 'sleep-7:1'), (sleep['days'] as List)[0]), true);
      expect(findParentingItem(az, 'quiz', 'nope'), isNull);
      final base = Json.from((az['articles'] as List).first as Map);
      expect(diffPatch(base, {...base, 'title': 'X', 'id': 'y'}), {'title': 'X'});
    });
  });

  group('Tərbiyə overrides fetch (offline-safe)', () {
    test('fetches published rows for the language and caches them for 10 minutes', () async {
      db.rows = [row('article', 'lying', {'title': 'Server'})];
      expect(rowsJson(await fetchPublishedOverrides(store, db.fetch, 'az', now: 1000)), rowsJson(db.rows));
      expect(db.languages, ['az']);
      db.rows = [];
      expect(await fetchPublishedOverrides(store, db.fetch, 'az', now: 1000 + overridesFreshMs - 1), hasLength(1));
      expect(db.calls, 1);
      expect(await fetchPublishedOverrides(store, db.fetch, 'az', now: 1000 + overridesFreshMs + 1), isEmpty);
      expect(db.calls, 2);
    });

    test('falls back to the cached rows on an error, and to none without a cache', () async {
      db.mode = 'error';
      expect(await fetchPublishedOverrides(store, db.fetch, 'az', now: 1), isEmpty);
      db.mode = 'ok';
      db.rows = [row('sos', 'nightmare', {'title': 'Cache'})];
      await fetchPublishedOverrides(store, db.fetch, 'az', now: 2, force: true);
      db.mode = 'error';
      expect(rowsJson(await fetchPublishedOverrides(store, db.fetch, 'az', now: 2 + overridesFreshMs * 3)), rowsJson(db.rows));
    });

    // testWidgets runs in fake time (vi.useFakeTimers + advanceTimersByTimeAsync).
    testWidgets('times out instead of blocking the tool', (tester) async {
      db.mode = 'hang';
      List<ParentingOverrideRow>? res;
      unawaited(fetchPublishedOverrides(store, db.fetch, 'az', now: 5).then((r) => res = r));
      await tester.pump(const Duration(milliseconds: 4100));
      expect(res, isEmpty);
    });

    test('loadParentingContent merges published overrides over the lazy az chunk', () async {
      db.rows = [row('sos', 'nightmare', {'title': 'Gecə kabusu (redaktə)'})];
      final registry = ParentingContentRegistry(load: diskAsset, store: store, fetchOverrides: db.fetch);
      final c = (await registry.loadContent('az'))!;
      expect(c.sos.firstWhere((s) => s.id == 'nightmare').title, 'Gecə kabusu (redaktə)');
      expect(await registry.loadContent('xx'), isNull);
    });
  });
}
