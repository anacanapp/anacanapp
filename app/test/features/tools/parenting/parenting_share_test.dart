// Ported from: src/lib/parenting-share.test.ts
// The supabase / chat mocks are FakeShareRemote. `openParentingDeeplink` lives in the shell machine (its routing is
// covered by the shell's own tests); here the link → target part is checked.
import 'package:anacan/features/tools/parenting/parenting_share.dart';
import 'package:anacan/shell/links/deeplink.dart';
import 'package:anacan/shell/links/nav_handoffs.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

const ShareItem sos = ShareItem(kind: 'sos', id: 'shop-tantrum', emoji: '🛒', title: 'Mağazada yerə yıxılıb ağlayır', summary: 'Konfet istədi, “yox” dedin.');

ShareItem copy(ShareItem s, {String? kind, String? id, String? summary}) =>
    ShareItem(kind: kind ?? s.kind, id: id ?? s.id, emoji: s.emoji, title: s.title, summary: summary ?? s.summary);

void main() {
  late FakeShareRemote db;
  setUp(() => db = FakeShareRemote());

  group('Tərbiyə links (parseDeeplink)', () {
    test('parses anacan:// and universal links to the parenting tool with the item', () {
      for (final url in ['anacan://parenting/sos/shop-tantrum', 'https://app.anacan.az/parenting/sos/shop-tantrum', '/parenting/sos/shop-tantrum/']) {
        expect(parseDeeplink(url), const ParsedDeeplink('tool', {'tool_id': 'parenting', 'parenting_kind': 'sos', 'parenting_id': 'shop-tantrum'}), reason: url);
      }
      expect(parseDeeplink('anacan://parenting/article/body-safety')?.params, containsPair('parenting_id', 'body-safety'));
      expect(parseDeeplink('anacan://parenting/article/body-safety')?.params, containsPair('parenting_kind', 'article'));
      expect(parseDeeplink('anacan://parenting/programme/sleep-7')?.params, containsPair('parenting_kind', 'programme'));
      expect(parseDeeplink('anacan://parenting/programme/sleep-7')?.params, containsPair('parenting_id', 'sleep-7'));
    });

    test('rejects unknown kinds, bad ids and foreign hosts', () {
      expect(parseDeeplink('anacan://parenting/quiz/style'), isNull);
      expect(parseDeeplink('anacan://parenting/sos/Shop_Tantrum'), isNull);
      expect(parseDeeplink('anacan://parenting/sos/a/b'), isNull);
      expect(parseDeeplink('https://evil.example/parenting/sos/shop-tantrum'), isNull);
    });

    test('turns a parsed link into the tool target and opens the mother’s tool or the partner’s screen', () {
      final parsed = parseDeeplink('https://app.anacan.az/parenting/sos/shop-tantrum');
      expect(parentingTargetFromDeeplink(parsed), const ParentingTarget('sos', 'shop-tantrum'));
      expect(parentingTargetFromDeeplink(parseDeeplink('anacan://tool/parenting')), isNull);
      expect(parentingTargetFromDeeplink(const ParsedDeeplink('tool', {'tool_id': 'parenting', 'parenting_kind': 'sos', 'parenting_id': '../x'})), isNull);
      final store = ParentingTargetStore()..set(parentingTargetFromDeeplink(parsed));
      expect(store.peek(), const ParentingTarget('sos', 'shop-tantrum'));
    });
  });

  group('Tərbiyə share texts', () {
    test('the partner message carries the title, summary, hint and a link that parses back to the item', () {
      final text = partnerShareText(sos, 'Birlikdə → Tərbiyə:');
      expect(text.split('\n'), ['🛒 Mağazada yerə yıxılıb ağlayır', 'Konfet istədi, “yox” dedin.', '', 'Birlikdə → Tərbiyə:', 'https://app.anacan.az/parenting/sos/shop-tantrum']);
      expect(parseParentingShare(text), (kind: 'sos', id: 'shop-tantrum'));
      expect(parseDeeplink(parentingItemLink('article', 'body-safety'))?.params['parenting_id'], 'body-safety');
    });

    test('the share-sheet text has no link and long summaries are cut', () {
      final text = plainShareText(copy(sos, summary: 'x' * 600), 'Anacan');
      expect(text, isNot(contains('https://')));
      expect(text.split('\n')[1], hasLength(400));
      expect(text.endsWith('Anacan'), true);
    });

    test('ignores ordinary messages and other links', () {
      expect(parseParentingShare('Salam!'), isNull);
      expect(parseParentingShare(null), isNull);
      expect(parseParentingShare('https://app.anacan.az/blog/x'), isNull);
      expect(parseParentingShare('https://app.anacan.az/parenting/sos/shop-tantrum-but-longer'), (kind: 'sos', id: 'shop-tantrum-but-longer'));
    });
  });

  group('Tərbiyə: send to partner and the partner’s received list', () {
    test('resolves the partner’s user id from his profile and sends one chat message', () async {
      expect(await sendParentingToPartner(db, (userId: 'me', partnerProfileId: 'p-profile'), 'hello'), true);
      expect(db.sent, [(actor: 'me', target: 'partner-user', content: 'hello')]);
      expect(db.calls, contains('profiles.eq id p-profile'));
    });

    test('sends nothing when the partner profile cannot be read', () async {
      db.partnerUser = null;
      expect(await sendParentingToPartner(db, (userId: 'me', partnerProfileId: 'p-profile'), 'hello'), false);
      expect(db.sent, isEmpty);
    });

    test('lists the items she sent him, newest first, one row per item', () async {
      db.rows = [
        {'id': 'm3', 'content': partnerShareText(sos, 'h'), 'created_at': '2026-11-08T10:00:00Z', 'is_read': false},
        {'id': 'm2', 'content': partnerShareText(copy(sos, kind: 'article', id: 'body-safety'), 'h'), 'created_at': '2026-11-07T10:00:00Z', 'is_read': true},
        {'id': 'm1', 'content': partnerShareText(sos, 'h'), 'created_at': '2026-11-06T10:00:00Z', 'is_read': true},
        {'id': 'm0', 'content': 'not a share', 'created_at': '2026-11-05T10:00:00Z'},
      ];
      final list = await readPartnerShares(db, 'him', now: DateTime.parse('2026-11-08T12:00:00Z').millisecondsSinceEpoch);
      expect(list, const [
        PartnerShare(kind: 'sos', id: 'shop-tantrum', messageId: 'm3', at: '2026-11-08T10:00:00Z', read: false),
        PartnerShare(kind: 'article', id: 'body-safety', messageId: 'm2', at: '2026-11-07T10:00:00Z', read: true),
      ]);
      expect(db.calls, contains('partner_messages.eq receiver_id him'));
      expect(db.calls, contains('partner_messages.eq message_type text'));
      expect(dedupeShares(db.rows, 1), hasLength(1));
    });
  });
}
