// Ported from: src/lib/parenting-search.test.ts
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_search.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

final ParentingContent az = contentOf('az');

void main() {
  group('Tərbiyə search normalisation', () {
    test('folds Azerbaijani letters and diacritics', () {
      expect(foldText('Uşaq YATMIR, gecə qorxur!'), 'usaq yatmir gece qorxur');
      expect(foldText('ƏŞÇĞÖÜİI əşçğöüıi'), 'escgouii escgouii');
      expect(foldText('“Səni sevmirəm!” — dedi'), 'seni sevmirem dedi');
      expect(foldText('Éducation à l’école'), 'education a l ecole');
    });
  });

  group('Tərbiyə search', () {
    test('finds the same items with or without Azerbaijani letters', () {
      final a = searchParenting(az, 'yatmaq istəmir');
      final b = searchParenting(az, 'yatmaq istemir');
      expect(a.total, greaterThan(0));
      expect([for (final h in b.sos) h.item.id], [for (final h in a.sos) h.item.id]);
      expect(a.sos[0].item.id, 'bedtime-refusal');
    });

    test('groups results (SOS, articles, programmes) and ranks title hits first', () {
      final r = searchParenting(az, 'isterika');
      expect(r.articles[0].item.id, 'tantrum-brain');
      expect([for (final h in r.sos) h.item.id], contains('shop-tantrum'));
      expect([for (final h in r.programmes) h.item.id], contains('tantrums-14'));
      final y = searchParenting(az, 'yalan');
      expect(y.articles[0].item.id, 'lying');
      expect(y.sos[0].item.id, 'caught-lying');
      expect(searchParenting(az, 'ekran').articles[0].item.id, 'screen-time');
    });

    test('needs every query word and at least 2 characters', () {
      expect(searchParenting(az, 'y').total, 0);
      expect(searchParenting(az, '   ').total, 0);
      expect(searchParenting(az, 'yalan zzzqqq').total, 0);
    });

    test('includes Premium items (the list shows their lock)', () {
      final r = searchParenting(az, 'qardaş');
      expect([...r.sos.map((h) => h.item.free), ...r.articles.map((h) => h.item.free)].any((free) => !free), true);
    });
  });

  group('Anacan.AI → Tərbiyə matcher', () {
    ParentingMatch? m(String text) => matchParentingTopic(az, text);

    for (final (text, kind, id) in const [
      ('Uşağım hər gün isterika edir, nə edim?', 'article', 'tantrum-brain'),
      ('Mağazada isterika edir, yerə yıxılır', 'sos', 'shop-tantrum'),
      ('3 yaşlı oğlum axşamlar yatmaq istəmir', 'sos', 'bedtime-refusal'),
      ('usagim yatmaq istemir', 'sos', 'bedtime-refusal'),
      ('Qızım qardaşını vurur, necə dayandırım?', 'sos', 'hit-sibling'),
      ('Oğlum yeni körpəyə qısqanclıq edir', 'article', 'new-baby'),
      ('Telefonu alanda ekran üçün ağlayır', 'sos', 'screen-off'),
      ('5 yaşlı uşaq yalan danışır', 'article', 'lying'),
      ('Bağçada uşaqları dişləyir', 'sos', 'biting-daycare'),
      ('Uşağa bağırdım, özümü pis hiss edirəm', 'sos', 'i-shouted'),
      ('Gecə kabus görüb oyanır', 'sos', 'nightmare'),
      ('Uşağı vurmaq olarmı? Şillə tərbiyədir?', 'article', 'no-hitting'),
    ]) {
      test('$text → $kind $id', () {
        final r = m(text);
        expect(r?.kind, kind);
        expect(r?.id, id);
      });
    }

    for (final text in const [
      'Körpəmin qızdırması 38.5-dir, nə verim?',
      '6 aylıq körpəyə hansı vitaminlər lazımdır?',
      'Hamiləliyin 20-ci həftəsində nə baş verir?',
      'Salam',
      '',
    ]) {
      test('stays silent for a non-parenting message: $text', () => expect(m(text), isNull));
    }

    for (final (lang, text, id) in const [
      ('zh', '孩子在商场里哭闹打滚怎么办', 'shop-tantrum'),
      ('ar', 'ابني لا يريد النوم في الليل', 'bedtime-refusal'),
    ]) {
      test('matches languages without spaces / with attached Arabic prefixes ($lang)', () {
        expect(matchParentingTopic(contentOf(lang), text)?.id, id);
      });
    }

    test('needs content (no match before the language chunk is loaded)', () {
      expect(matchParentingTopic(null, 'isterika'), isNull);
    });
  });
}
