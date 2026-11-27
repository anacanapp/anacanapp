// Ported from: src/lib/app-feedback.test.ts (case names kept) + tests for HelpScreen (ticket creation, chat),
//              FeedbackSheet, useAppRating counters, LegalScreen (no vitest suites for those components)
import 'package:anacan/features/legal/legal_screen.dart';
import 'package:anacan/features/support/app_rating.dart';
import 'package:anacan/features/support/data/app_feedback.dart';
import 'package:anacan/features/support/data/support_tickets.dart';
import 'package:anacan/features/support/feedback_sheet.dart';
import 'package:anacan/features/support/help_screen.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

const int day = 86400000;

class FakeSupport implements SupportRepository {
  final tickets_ = <Map<String, dynamic>>[];
  final replies_ = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>> addReply(Map<String, dynamic> row) async {
    final r = {'id': 'r${replies_.length}', 'created_at': '2026-11-27T10:00:00Z', ...row};
    replies_.add(r);
    return r;
  }

  @override
  Future<List<Map<String, dynamic>>> categories() async => [
        {'category_key': 'general', 'name': 'Ümumi'},
        {'category_key': 'billing', 'name': 'Ödəniş'},
      ];
  @override
  Future<Map<String, dynamic>> createTicket(Map<String, dynamic> row) async {
    final r = {'id': 't${tickets_.length}', 'created_at': '2026-11-27T10:00:00Z', ...row};
    tickets_.insert(0, r);
    return r;
  }

  @override
  Future<List<Map<String, dynamic>>> faqs() async => [
        {'id': 'f1', 'question': 'Necə?', 'answer': 'Belə.'},
      ];
  @override
  Future<List<Map<String, dynamic>>> replies(String ticketId) async => replies_.where((r) => r['ticket_id'] == ticketId).toList();
  @override
  void subscribeReplies(Ref ref, String ticketId, void Function(Map<String, dynamic> row) onInsert) {}
  @override
  Future<List<Map<String, dynamic>>> tickets(String userId) async => tickets_;
}

class FakeLegal implements LegalDocumentsRepository {
  @override
  Future<List<Map<String, dynamic>>> active() async => [
        {'id': '2', 'document_type': 'privacy_policy', 'title_az': 'Gizlilik Siyasəti', 'title': 'Privacy', 'content_az': '# Gizlilik\n\nMətn **vacib**.\n\n- bir\n- iki', 'version': '2.0', 'updated_at': '2026-10-01T00:00:00Z'},
        {'id': '1', 'document_type': 'terms_of_service', 'title_az': 'İstifadə Şərtləri', 'title': 'Terms', 'content_az': '<h2>Şərtlər</h2><p>HTML mətn</p>', 'version': '2.0', 'updated_at': '2026-10-01T00:00:00Z'},
      ];
}

class FakeRating implements RatingRepository {
  Map<String, dynamic>? row;
  final writes = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>?> current(String userId) async => row;
  @override
  Future<void> insert(Map<String, dynamic> r) async => writes.add(r);
  @override
  Future<void> update(String userId, Map<String, dynamic> values) async => writes.add(values);
}

void main() {
  setUpAll(loadAnacanFonts);

  group('in-app feedback', () {
    final now = DateTime.utc(2026, 11, 20).millisecondsSinceEpoch;
    bool due({int? firstUseAt, int sessions = 8, int? sentAt, int? dismissedAt, int? lastStoreRequestAt, bool lossRecovery = false}) => feedbackPromptDue(
          now: now,
          firstUseAt: firstUseAt ?? now - 20 * day,
          sessions: sessions,
          sentAt: sentAt,
          dismissedAt: dismissedAt,
          lastStoreRequestAt: lastStoreRequestAt,
          lossRecovery: lossRecovery,
        );
    test('asks on its own once from day 14, respecting dismissals and store requests', () {
      expect(due(), isTrue);
      expect(due(firstUseAt: now - 10 * day), isFalse);
      expect(due(sessions: 3), isFalse);
      expect(due(sentAt: now - 200 * day), isFalse);
      expect(due(dismissedAt: now - 30 * day), isFalse);
      expect(due(dismissedAt: now - 100 * day), isTrue);
      expect(due(lastStoreRequestAt: now - 2 * day), isFalse);
      expect(due(lossRecovery: true), isFalse);
    });
    test('sends the rating to the team as a support ticket, never to a store', () {
      final row = buildFeedbackTicket(userId: 'u1', rating: 2, reasons: ['crash', 'slow'], message: 'It closes on the feeding screen', subject: 'App feedback', platform: 'ios', version: '', lifeStage: 'mommy', language: 'en');
      expect(row, containsPair('user_id', 'u1'));
      expect(row['category'], 'app_feedback');
      expect(row['priority'], 'high');
      expect(row['status'], 'open');
      expect(row['subject'], 'App feedback 2★');
      expect(row['message'], contains('★★☆☆☆ (2/5)'));
      expect(row['message'], contains('Reasons: crash, slow'));
      expect(row['message'], contains('It closes on the feeding screen'));
      expect(row['message'], isNot(matches(RegExp(r'apps\.apple\.com|play\.google\.com'))));
    });
  });

  screenTest('feedback sheet: low rating needs a reason, then sends a ticket and marks it sent', (tester) async {
    final rows = <Map<String, dynamic>>[];
    final store = seededStore();
    await pumpApp(tester, Builder(builder: (context) => GestureDetector(key: const ValueKey<String>('open'), behavior: HitTestBehavior.opaque, onTap: () => showFeedbackSheet(context), child: const SizedBox(width: 100, height: 100))),
        scroll: false, overrides: [...baseOverrides(store: store), ticketInserterProvider.overrideWithValue((row) async => rows.add(row)), appInfoSourceProvider.overrideWithValue(_Info())]);
    await tester.tap(find.byKey(const ValueKey<String>('open')));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Pis'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Göndər'));
    await tester.pump();
    expect(rows, isEmpty);
    await tester.tap(find.text('Yavaşdır'));
    await tester.pump();
    await tester.tap(find.text('Göndər'));
    await tester.pumpAndSettle();
    expect(rows.single['priority'], 'high');
    expect(rows.single['message'], contains('Reasons: slow'));
    expect(store.getItem(kFeedbackSentKey), isNotNull);
  });

  screenTest('help: creates a ticket with the chosen category and lists it', (tester) async {
    final repo = FakeSupport();
    await pumpApp(tester, HelpScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), supportRepositoryProvider.overrideWithValue(repo)]);
    await tester.tap(find.byKey(const ValueKey<String>('help-tab-tickets')));
    await tester.pumpAndSettle();
    expect(find.text('Hələ müraciət yoxdur'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('help-new-ticket')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('help-submit')));
    await tester.pumpAndSettle();
    expect(find.text('Mövzu və mesaj daxil edin'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('help-cat-billing')));
    await tester.enterText(find.byKey(const ValueKey<String>('help-subject')), 'Ödəniş');
    await tester.enterText(find.byKey(const ValueKey<String>('help-message')), 'Kömək edin');
    await tester.tap(find.byKey(const ValueKey<String>('help-submit')));
    await tester.pumpAndSettle();
    expect(repo.tickets_.single, containsPair('category', 'billing'));
    expect(repo.tickets_.single, containsPair('status', 'open'));
    expect(find.text('Müraciətiniz göndərildi'), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('ticket-t0')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('ticket-t0')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey<String>('ticket-reply')), 'Əlavə');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey<String>('ticket-send')));
    await tester.pumpAndSettle();
    expect(repo.replies_.single, containsPair('message', 'Əlavə'));
    expect(find.text('Əlavə'), findsOneWidget);
  });

  screenTest('help FAQ accordion opens an answer', (tester) async {
    await pumpApp(tester, HelpScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), supportRepositoryProvider.overrideWithValue(FakeSupport())]);
    await tester.pumpAndSettle();
    expect(find.text('Belə.'), findsNothing);
    await tester.tap(find.byKey(const ValueKey<String>('faq-0')));
    await tester.pumpAndSettle();
    expect(find.text('Belə.'), findsOneWidget);
  });

  screenTest('rating prompt: counts sessions and shows from the 3rd, never again after "never"', (tester) async {
    final store = seededStore(extra: {kUsageCountKey: '2'});
    final repo = FakeRating();
    await pumpApp(tester, const SizedBox(width: 390, height: 844, child: AppRatingPrompt()), scroll: false, overrides: [...baseOverrides(store: store), ratingRepositoryProvider.overrideWithValue(repo)]);
    await tester.pumpAndSettle();
    expect(store.getItem(kUsageCountKey), '3');
    expect(find.text('Anacan-ı bəyəndiniz?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('rating-never')));
    await tester.pumpAndSettle();
    expect(repo.writes.single['last_action'], 'never');
    expect(store.getItem(kRatingDoneKey), 'true');
    expect(find.text('Anacan-ı bəyəndiniz?'), findsNothing);
  });

  screenTest('legal: opens the initial document; markdown and HTML documents render', (tester) async {
    await pumpApp(tester, LegalScreen(onBack: () {}, initialDocument: 'privacy_policy'), scroll: false, overrides: [...baseOverrides(), legalDocumentsRepositoryProvider.overrideWithValue(FakeLegal())]);
    await tester.pumpAndSettle();
    expect(find.text('Gizlilik Siyasəti'), findsOneWidget);
    expect(find.textContaining('Versiya: 2.0'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('legal-back')));
    await tester.pumpAndSettle();
    expect(find.text('Hüquqi Sənədlər'), findsOneWidget);
    final terms = tester.getTopLeft(find.byKey(const ValueKey<String>('legal-doc-terms_of_service')));
    final privacy = tester.getTopLeft(find.byKey(const ValueKey<String>('legal-doc-privacy_policy')));
    expect(terms.dy, lessThan(privacy.dy));
    await tester.tap(find.byKey(const ValueKey<String>('legal-doc-terms_of_service')));
    await tester.pumpAndSettle();
    expect(find.textContaining('HTML mətn', findRichText: true), findsOneWidget);
  });

  test('legal field fallback chains', () {
    final d = {'title': 'T', 'title_az': 'Az', 'title_en': 'En', 'title_ru': ''};
    expect(pickLegalField(d, 'title', 'az'), 'Az');
    expect(pickLegalField(d, 'title', 'ru'), 'En');
    expect(pickLegalField(d, 'title', 'kk'), 'En');
    expect(pickLegalField({'title': 'T', 'title_az': 'Az'}, 'title', 'de'), 'T');
  });

  group('goldens', () {
    for (final mode in ['light', 'dark', 'rtl']) {
      screenTest('help faq $mode', (tester) async {
        await pumpApp(tester, HelpScreen(onBack: () {}), scroll: false, dark: mode == 'dark', rtl: mode == 'rtl', overrides: [...baseOverrides(), supportRepositoryProvider.overrideWithValue(FakeSupport())]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'help_$mode');
      });
    }
    for (final mode in ['light', 'dark']) {
      screenTest('legal document $mode', (tester) async {
        await pumpApp(tester, LegalScreen(onBack: () {}, initialDocument: 'privacy_policy'), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(), legalDocumentsRepositoryProvider.overrideWithValue(FakeLegal())]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'legal_doc_$mode');
      });
      screenTest('legal list $mode', (tester) async {
        await pumpApp(tester, LegalScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(), legalDocumentsRepositoryProvider.overrideWithValue(FakeLegal())]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'legal_list_$mode');
      });
    }
  });
}

class _Info implements AppInfoSource {
  @override
  String get platform => 'ios';
  @override
  Future<String> version() async => '48.0 (1)';
}
