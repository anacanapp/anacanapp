// Ported from: src/components/tools/parenting/ParentingTool.test.tsx
// The vi.mock setups are the ProgrammeHarness overrides (useAuth / useChildren / useSubscription / share / reminders
// / pushNav); `openParentingTool(target)` is the shell's ParentingTargetStore; aria-pressed is `Tap.pressed`;
// CSS upper-case labels are compared upper-cased.
import 'dart:convert';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/premium/premium_gates.dart' show PremiumBlurGate;
import 'package:anacan/features/tools/kit/kit.dart' show ToolHeader, ToolIconButton;
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_copy.dart';
import 'package:anacan/features/tools/parenting/parenting_screens.dart';
import 'package:anacan/features/tools/parenting/parenting_share.dart' show partnerShareText, ShareItem;
import 'package:anacan/features/tools/parenting/parenting_store.dart';
import 'package:anacan/features/tools/parenting/parenting_tool.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/parenting/programme_ui.dart' show Tap;
import 'package:anacan/shell/shell.dart' show ParentingTarget;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import 'support/programme_harness.dart';

final DateTime now = DateTime(2026, 11, 7, 10); // Aysel is 2 years 4 months
const String key = 'anacan.parenting.v1.u1';
const String intro = 'anacan.parenting.intro.v1.u1';
final ParentingContent content = contentOf('az');

String up(String s) => s.toUpperCase();

class _Env {
  _Env({this.premium = false, this.birth = '2024-07-07', this.due, this.kids, this.selected, this.linkedPartner, bool introSeen = true, Map<String, Object?>? stored}) {
    if (introSeen) h.store.setItem(intro, '1'); // the first-run intro has its own tests below
    if (stored != null) h.store.setItem(key, jsonEncode(stored));
    final ProgrammeChild? child;
    final List<ProgrammeChild> list;
    if (kids != null) {
      list = kids!;
      child = list.where((k) => k.id == selected).firstOrNull ?? list.first;
    } else {
      child = birth != null ? ProgrammeChild(id: 'c1', name: 'Aysel', birthDate: birth, dueDate: due, gender: 'girl') : null;
      list = [?child];
    }
    h.inputs = ProgrammeInputs(
      userId: 'u1',
      lifeStage: 'mommy',
      language: 'az',
      children: list,
      selectedChild: child,
      isPremium: premium,
      parentingSetting: 'on',
      profileUserId: linkedPartner != null ? 'u1' : null,
      linkedPartnerId: linkedPartner,
    );
  }
  final bool premium;
  final String? birth;
  final String? due;
  final List<ProgrammeChild>? kids;
  final String? selected;
  final String? linkedPartner;
  final h = ProgrammeHarness();

  Map<String, dynamic> stored() => jsonDecode(h.store.getItem(key) ?? 'null') as Map<String, dynamic>;
  void target(String kind, String id) => h.targets.set(ParentingTarget(kind, id));
  Future<void> open(WidgetTester tester) => h.pump(tester, ParentingTool(onBack: () {}, now: now));
}

bool? pressed(WidgetTester tester, String k) => tester.widget<Tap>(find.byKey(ValueKey(k))).pressed;

Future<void> back(WidgetTester tester) async {
  final f = find.descendant(of: find.byType(ToolHeader), matching: find.byType(ToolIconButton)).first;
  await tester.ensureVisible(f);
  await tester.tap(f);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

Future<void> enter(WidgetTester tester, String k, String text) async {
  await tester.enterText(find.byKey(ValueKey(k)), text);
  await tester.pump();
}

int scaleIndex(String label) => content.styleQuiz!.scale.indexOf(label);
PremiumBlurGate gate(WidgetTester tester) => tester.widget<PremiumBlurGate>(find.byType(PremiumBlurGate));
List<DateTime> reminderTimes(ProgrammeHarness h) => [for (final n in h.notifications.last('parenting')) DateTime.fromMillisecondsSinceEpoch(n.at)];

const List<ProgrammeChild> kids = [
  ProgrammeChild(id: 'teen', name: 'Ali', birthDate: '2010-02-01'),
  ProgrammeChild(id: 'kid-a', name: 'Aysel', birthDate: '2024-07-07'),
  ProgrammeChild(id: 'kid-b', name: 'Nur', birthDate: '2020-03-01'),
];

Map<String, Object?> state({Map<String, Object?> programmes = const {}, List<String> saved = const [], Map<String, Object?>? extra}) =>
    {'v': 1, 'band': null, 'quizzes': {}, 'saved': saved, 'programmes': programmes, ...?extra};

void main() {
  setUp(() {
    installTestI18n();
    DomainClock.setSystemTime(now);
  });
  tearDown(DomainClock.reset);

  group('Tərbiyə tool', () {
    testWidgets('opens on the child’s age band with the daily tip and the child chip', (tester) async {
      final e = _Env();
      await e.open(tester);
      expect(find.text('Aysel · 2 yaş 4 ay'), findsWidgets);
      expect(find.text(up('Günün məsləhəti')), findsOneWidget);
      expect(pressed(tester, 'par-band-1-3'), true);
      expect(content.tips['1-3']!.any((t) => find.text(t.title).evaluate().isNotEmpty), true);
      expect(find.text('Aysel üçün seçildi'), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('switches the age band and remembers the choice', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-band-6-12');
      expect(e.stored()['band'], '6-12');
      expect(find.text('6–12 yaş: bacarıq, dostluq, özünəinam'), findsOneWidget);
      await tapKey(tester, 'par-band-1-3');
      expect(e.stored()['band'], isNull);
      await e.h.finish(tester);
    });

    testWidgets('lets the parent pick a band when there is no child', (tester) async {
      final e = _Env(birth: null);
      await e.open(tester);
      expect(pressed(tester, 'par-band-1-3'), true);
      await tapKey(tester, 'par-band-0-1');
      expect(find.text('İlk il: güvən təməli'), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('shows a free article in full and gates a Premium one, keeping specialist signals free', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, 'Emosiyalar və tantrumlar');
      await tapKey(tester, 'par-article-tantrum-brain');
      expect(find.textContaining(up('Bu gün sına')), findsOneWidget);
      expect(find.byType(PremiumBlurGate), findsNothing);
      await back(tester);
      await tapKey(tester, 'par-article-whining');
      expect(gate(tester).title, 'Davamı Premium-dadır');
      expect(find.textContaining(up('Bu gün sına')), findsNothing);
      expect(find.textContaining(up('Nə vaxt mütəxəssisə müraciət etməli')), findsOneWidget);
      expect(find.text('Elmi mənbələr'), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('shows Premium articles in full for Premium users', (tester) async {
      final e = _Env(premium: true);
      await e.open(tester);
      await tapText(tester, 'Emosiyalar və tantrumlar');
      await tapKey(tester, 'par-article-whining');
      expect(find.byType(PremiumBlurGate), findsNothing);
      expect(find.textContaining(up('Bu gün sına')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('opens a free SOS card with 3 steps, the script and an age switch; Premium cards are gated', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-sos-shop-tantrum');
      expect(find.text('Əvvəlcə özünü sakitləşdir'), findsOneWidget);
      expect(find.text(up('Belə deyə bilərsən')), findsOneWidget);
      expect(find.textContaining('Yayındırmaq çox işləyir'), findsOneWidget);
      await tapKey(tester, 'par-seg-3-6');
      expect(find.textContaining('siyahını tutan köməkçimsən'), findsOneWidget);
      await back(tester);
      await tapKey(tester, 'par-sos-bedtime-refusal');
      expect(find.byType(PremiumBlurGate), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('fills the emergency number from the country helper in red-flag boxes', (tester) async {
      final e = _Env();
      await e.open(tester);
      final call = find.text('Zəng et: 103');
      expect(call, findsWidgets);
      await tester.ensureVisible(call.first);
      await tester.tap(call.first);
      expect(e.h.calls.single.toString(), 'tel:103');
      await e.h.finish(tester);
    });

    testWidgets('bookmarks an article and lists it under saved', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, 'Emosiyalar və tantrumlar');
      await tapKey(tester, 'par-article-tantrum-brain');
      await tapKey(tester, 'par-save');
      expect(e.stored()['saved'], ['a:tantrum-brain']);
      await back(tester);
      await back(tester);
      await tapKey(tester, 'par-saved-open');
      expect(find.text('Tantrum: beyində nə baş verir?'), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('runs a programme: one day per calendar day, free days then a Premium gate', (tester) async {
      final p = content.programmes[0];
      final e = _Env(stored: state());
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      await tapKey(tester, 'par-prog-start');
      expect(e.stored()['programmes'][p.id]['done'], <String>[]);
      await tapKey(tester, 'par-prog-done');
      expect(e.stored()['programmes'][p.id]['done'], ['2026-11-07']);
      expect(find.byKey(const ValueKey('par-prog-done')), findsNothing);
      expect(find.textContaining('Sabah növbəti gün açılacaq'), findsOneWidget);
      await e.h.finish(tester);
      // Three free days done → day 4 is behind the Premium gate.
      final e2 = _Env(stored: state(programmes: {
        p.id: {'startedAt': '2026-11-01', 'done': ['2026-11-01', '2026-11-02', '2026-11-03'], 'updatedAt': '2026-11-03'},
      }));
      await e2.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      expect(find.text('3/21'), findsOneWidget);
      expect(gate(tester).title, 'Proqramlar Premium-dadır');
      expect(find.byKey(const ValueKey('par-prog-done')), findsNothing);
      await e2.h.finish(tester);
    });

    testWidgets('lets Premium users continue the programme past the free days', (tester) async {
      final p = content.programmes[0];
      final e = _Env(premium: true, stored: state(programmes: {
        p.id: {'startedAt': '2026-11-01', 'done': ['2026-11-01', '2026-11-02', '2026-11-03'], 'updatedAt': '2026-11-03'},
      }));
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      await tapKey(tester, 'par-prog-done');
      expect(e.stored()['programmes'][p.id]['done'], hasLength(4));
      await e.h.finish(tester);
    });

    testWidgets('scores the style quiz; the short result is free and the detail is Premium', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-quiz-style');
      await tapKey(tester, 'par-quiz-start');
      for (final item in content.styleQuiz!.items) {
        final harshOrGiveIn = const ['harsh', 'giveIn'].contains(item.dim);
        await tapKey(tester, 'par-answer-${scaleIndex(harshOrGiveIn ? 'Demək olar ki, heç vaxt' : 'Demək olar ki, həmişə')}');
      }
      expect(find.text('İsti və aydın'), findsOneWidget);
      expect(find.byType(PremiumBlurGate), findsOneWidget);
      expect(e.stored()['quizzes']['style']['result'], 'balanced');
      await e.h.finish(tester);
    });

    testWidgets('sends a flagged milestone answer to the doctor for free', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-quiz-milestones');
      expect(find.text('18 ay'), findsOneWidget); // 28 months → the 18-month checkpoint
      await tapKey(tester, 'par-quiz-start');
      final cp = content.milestoneQuiz!.checkpoints.firstWhere((x) => x.id == 'm18');
      for (final it in cp.items) {
        await tapKey(tester, it.text == 'Dəstəksiz yeriyir.' ? 'par-answer-1' : 'par-answer-0');
      }
      expect(find.text(content.milestoneQuiz!.regression), findsOneWidget);
      await tapKey(tester, 'par-answer-1');
      expect(find.text('Pediatrla danışmağı tövsiyə edirik'), findsOneWidget);
      expect(find.text('Dəstəksiz yeriyir.'), findsOneWidget);
      expect(e.stored()['quizzes']['milestones']['result'], 'talk');
      await e.h.finish(tester);
    });

    testWidgets('opens directly on the item an Anacan.AI card points to; back returns to the tool home', (tester) async {
      final e = _Env()..target('sos', 'shop-tantrum');
      await e.open(tester);
      expect(find.text('Əvvəlcə özünü sakitləşdir'), findsOneWidget);
      await back(tester);
      expect(find.byKey(const ValueKey('par-tip')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('searches the library diacritic-insensitively with grouped results and lock state', (tester) async {
      final e = _Env();
      await e.open(tester);
      await enter(tester, 'par-search', 'yatmaq istemir');
      expect(find.text(up('SOS kartları')), findsOneWidget);
      expect(find.byKey(const ValueKey('par-tip')), findsNothing);
      final row = find.byKey(const ValueKey('par-result-sos-bedtime-refusal'));
      expect(find.descendant(of: row, matching: find.byKey(const ValueKey('par-lock'))), findsOneWidget); // Premium card keeps its lock
      await tapKey(tester, 'par-result-sos-bedtime-refusal');
      expect(find.byType(PremiumBlurGate), findsOneWidget);
      await back(tester);
      expect(tester.widget<EditableText>(find.descendant(of: find.byKey(const ValueKey('par-search')), matching: find.byType(EditableText))).controller.text,
          'yatmaq istemir');
      await enter(tester, 'par-search', 'zzqqxx');
      expect(find.text('Heç nə tapılmadı. Başqa sözlə yoxla.'), findsOneWidget);
      await tapKey(tester, 'par-search-clear');
      expect(find.byKey(const ValueKey('par-tip')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('Premium: turns the daily programme reminder on (default 20:30), keeps it on the phone and pauses with the programme', (tester) async {
      final p = content.programmes[2];
      final e = _Env(premium: true, stored: state(programmes: {
        p.id: {'startedAt': '2026-11-06', 'done': ['2026-11-06'], 'updatedAt': '2026-11-06T08:00:00.000Z'},
      }));
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      expect(tester.widget<Semantics>(find.ancestor(of: find.byKey(const ValueKey('par-reminder-switch')), matching: find.byType(Semantics)).first).properties.toggled, false);
      await tapKey(tester, 'par-reminder-switch');
      await e.h.flush(tester);
      expect(e.stored()['reminder'], {'on': true, 'time': '20:30'});
      expect(find.text('20:30'), findsOneWidget);
      expect(reminderTimes(e.h).first, DateTime(2026, 11, 7, 20, 30));
      expect(e.h.notifications.last('parenting').first.body, contains(pf('par_notif_body', {'n': 2, 'task': p.days[1].title})));
      await enter(tester, 'par-reminder-time', '21:15');
      await e.h.flush(tester);
      expect(e.stored()['reminder']['time'], '21:15');
      expect(reminderTimes(e.h).first, DateTime(2026, 11, 7, 21, 15));
      await tapKey(tester, 'par-prog-pause');
      await e.h.flush(tester);
      expect(e.stored()['programmes'][p.id]['paused'], true);
      expect(e.h.notifications.last('parenting'), isEmpty);
      expect(find.text('Proqram fasilədədir — xatırlatma göndərilmir.'), findsOneWidget);
      expect(find.byKey(const ValueKey('par-prog-done')), findsNothing);
      await tapKey(tester, 'par-prog-pause'); // "Davam et"
      await e.h.flush(tester);
      expect(e.h.notifications.last('parenting'), isNotEmpty);
      await e.h.finish(tester);
    });

    testWidgets('free users can turn the reminder on for the free days (1–3) only', (tester) async {
      final p = content.programmes[2];
      final e = _Env(stored: state(programmes: {
        p.id: {'startedAt': '2026-11-07', 'done': <String>[], 'updatedAt': '2026-11-07'},
      }));
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      final card = find.byKey(const ValueKey('parenting-reminder'));
      expect(find.descendant(of: card, matching: find.text('İlk 3 gün üçün xatırlatma pulsuzdur.')), findsOneWidget);
      await tapKey(tester, 'par-reminder-switch');
      await e.h.flush(tester);
      expect(e.stored()['reminder'], {'on': true, 'time': '20:30'});
      expect(e.h.notifications.last('parenting'), hasLength(3)); // days 0, 1, 2
      await e.h.finish(tester);
    });

    testWidgets('free users see the reminder as a Premium feature once the free days are done', (tester) async {
      final p = content.programmes[2];
      final e = _Env(stored: state(programmes: {
        p.id: {'startedAt': '2026-11-04', 'done': ['2026-11-04', '2026-11-05', '2026-11-06'], 'updatedAt': '2026-11-06'},
      }, extra: {'reminder': {'on': true, 'time': '20:30'}}));
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      expect(find.byKey(const ValueKey('par-reminder-switch')), findsNothing);
      expect(find.descendant(of: find.byKey(const ValueKey('parenting-reminder')), matching: find.text('Xatırlatmalar Premium ilə')), findsOneWidget);
      // Nothing is scheduled for Premium days (an older list would be cancelled).
      expect(e.h.notifications.calls.every((c) => c.items.isEmpty), true);
      await e.h.finish(tester);
    });
  });

  group('Tərbiyə first-run intro', () {
    testWidgets('shows a skippable 3-step intro once per device and account', (tester) async {
      final e = _Env(introSeen: false);
      await e.open(tester);
      final box = find.byKey(const ValueKey('parenting-intro'));
      expect(find.descendant(of: box, matching: find.text('Yaşa görə bələdçi')), findsOneWidget);
      expect(find.descendant(of: box, matching: find.text('Addım 1/3')), findsOneWidget);
      await tapKey(tester, 'par-intro-next');
      expect(find.descendant(of: box, matching: find.text('Çətin anlar üçün SOS')), findsOneWidget);
      await tapKey(tester, 'par-intro-next');
      expect(find.descendant(of: box, matching: find.text('Qısa proqramlar və testlər')), findsOneWidget);
      expect(find.descendant(of: box, matching: find.text('Başla')), findsOneWidget);
      await tapKey(tester, 'par-intro-next');
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      expect(e.h.store.getItem(intro), '1');
      await tester.pumpWidget(const SizedBox());
      await e.open(tester);
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      await e.h.finish(tester);
    });

    testWidgets('asks for the age band when there is no birth date instead of defaulting to 1–3', (tester) async {
      final e = _Env(introSeen: false, birth: null);
      await e.open(tester);
      for (var i = 0; i < 3; i++) {
        await tapKey(tester, 'par-intro-next');
      }
      expect(find.descendant(of: find.byKey(const ValueKey('parenting-intro')), matching: find.text('Uşağın neçə yaşındadır?')), findsOneWidget);
      await tapKey(tester, 'par-intro-band-3-6');
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      expect(e.stored()['band'], '3-6');
      expect(pressed(tester, 'par-band-3-6'), true);
      await e.h.finish(tester);
    });

    testWidgets('can be skipped at once; never shown to a parent who already used the tool or on a deep link', (tester) async {
      final e = _Env(introSeen: false);
      await e.open(tester);
      await tapKey(tester, 'par-intro-skip');
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      expect(e.h.store.getItem(intro), '1');
      await e.h.finish(tester);

      final used = _Env(introSeen: false, stored: state(saved: ['a:lying']));
      await used.open(tester);
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      expect(used.h.store.getItem(intro), '1');
      await used.h.finish(tester);

      final linked = _Env(introSeen: false)..target('sos', 'shop-tantrum');
      await linked.open(tester);
      expect(find.byKey(const ValueKey('parenting-intro')), findsNothing);
      await linked.h.finish(tester);
    });
  });

  group('Tərbiyə with several children', () {
    testWidgets('offers a switcher for the children under 13 and follows the selected child’s band', (tester) async {
      final e = _Env(kids: kids, selected: 'teen'); // 13+: the tool starts on the first younger sibling
      await e.open(tester);
      await tapKey(tester, 'parenting-child-switch');
      expect(find.byKey(const ValueKey('parenting-child-teen')), findsNothing);
      expect([for (final id in ['kid-a', 'kid-b']) find.byKey(ValueKey('parenting-child-$id')).evaluate().length], [1, 1]);
      expect(pressed(tester, 'parenting-child-kid-a'), true);
      await tester.tap(find.byKey(const ValueKey('parenting-child-kid-a')));
      await tester.pumpAndSettle();
      expect(pressed(tester, 'par-band-1-3'), true);
      await tapKey(tester, 'parenting-child-switch');
      await tester.tap(find.byKey(const ValueKey('parenting-child-kid-b')));
      await tester.pumpAndSettle();
      expect(pressed(tester, 'par-band-6-12'), true);
      expect(find.text('Nur · 6 yaş'), findsWidgets);
      await e.h.finish(tester);
    });

    testWidgets('keeps quiz results and programme progress per child; old account data becomes the first child’s', (tester) async {
      final p = content.programmes[0];
      final e = _Env(kids: kids.sublist(1), stored: {
        'v': 1, 'band': null, 'saved': <String>[], 'quizzes': {'style': {'at': '2026-11-01', 'result': 'gentle'}}, //
        'programmes': {p.id: {'startedAt': '2026-11-01', 'done': ['2026-11-01'], 'updatedAt': '2026-11-01'}},
      });
      await e.open(tester);
      expect(e.stored()['rootChild'], 'kid-a');
      expect(find.textContaining('Son nəticə:'), findsOneWidget);
      await tapKey(tester, 'parenting-child-switch');
      await tester.tap(find.byKey(const ValueKey('parenting-child-kid-b')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Son nəticə:'), findsNothing);
      await tapKey(tester, 'par-quiz-style');
      await tapKey(tester, 'par-quiz-start');
      for (final _ in content.styleQuiz!.items) {
        await tapKey(tester, 'par-answer-${scaleIndex('Bəzən')}');
      }
      expect(e.stored()['children']['kid-b']['quizzes']['style'], isNotNull);
      expect(e.stored()['quizzes']['style']['result'], 'gentle'); // the first child's result is untouched
      await e.h.finish(tester);
    });

    testWidgets('a manual band chosen for a child expires when the child has moved to another band', (tester) async {
      final e = _Env(kids: [kids[1]], stored: {
        'v': 1, 'band': '6-12', 'bandAt': '2026-01-01T00:00:00.000Z', 'bandFor': '0-1', 'saved': <String>[], 'quizzes': {}, 'programmes': {}, //
      });
      await e.open(tester);
      expect(pressed(tester, 'par-band-1-3'), true);
      expect(e.stored()['band'], isNull);
      expect(e.stored()['bandFor'], '1-3');
      await e.h.finish(tester);
    });
  });

  group('Tərbiyə quiz back and programme completion', () {
    testWidgets('style quiz: the previous question keeps the answers', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-quiz-style');
      await tapKey(tester, 'par-quiz-start');
      expect(find.byKey(const ValueKey('par-quiz-back')), findsNothing);
      final always = scaleIndex('Demək olar ki, həmişə');
      await tapKey(tester, 'par-answer-$always');
      final total = content.styleQuiz!.items.length;
      expect(find.text('Sual 2/$total'), findsOneWidget);
      await tapKey(tester, 'par-quiz-back');
      expect(find.text('Sual 1/$total'), findsOneWidget);
      expect(pressed(tester, 'par-answer-$always'), true);
      await e.h.finish(tester);
    });

    testWidgets('milestone check: back from the regression question returns to the last item with its answer', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-quiz-milestones');
      await tapKey(tester, 'par-quiz-start');
      final cp = content.milestoneQuiz!.checkpoints.firstWhere((x) => x.id == 'm18');
      for (final _ in cp.items) {
        await tapKey(tester, 'par-answer-0');
      }
      expect(find.text(content.milestoneQuiz!.regression), findsOneWidget);
      await tapKey(tester, 'par-quiz-back');
      expect(find.text(cp.items.last.text), findsOneWidget);
      expect(pressed(tester, 'par-answer-0'), true);
      await tapKey(tester, 'par-answer-1');
      await tapKey(tester, 'par-answer-1');
      expect(e.stored()['quizzes']['milestones'], isNotNull);
      await e.h.finish(tester);
    });

    testWidgets('free users see "first days free" on programme rows instead of a bare Premium badge', (tester) async {
      final e = _Env();
      await e.open(tester);
      final rows = content.programmes.where((p) => p.bands.contains('1-3')).toList();
      expect(rows, isNotEmpty);
      for (final p in rows) {
        final row = find.byKey(ValueKey('par-programme-${p.id}'));
        expect(find.descendant(of: row, matching: find.textContaining('İlk 3 gün pulsuz')), findsOneWidget);
        expect(find.descendant(of: row, matching: find.textContaining('Premium')), findsNothing);
      }
      await e.h.finish(tester);
    });

    testWidgets('a finished programme shows a summary with the days and a next programme suggestion', (tester) async {
      final p = content.programmes[2];
      final done = [for (var i = 0; i < p.days.length; i++) '2026-10-${(10 + i).toString().padLeft(2, '0')}'];
      final e = _Env(premium: true, stored: state(programmes: {p.id: {'startedAt': done[0], 'done': done, 'updatedAt': '2026-10-20'}}));
      await e.open(tester);
      await tapKey(tester, 'par-programme-${p.id}');
      final sum = find.byKey(const ValueKey('par-programme-summary'));
      expect(find.descendant(of: sum, matching: find.textContaining('${p.days.length} gün tamamlandı')), findsOneWidget);
      final next = tester.widget<Tap>(find.descendant(of: find.byKey(const ValueKey('par-programme-next')), matching: find.byType(Tap)).first).label!;
      expect(content.programmes.any((x) => x.id != p.id && next.contains(x.title)), true);
      await tapKey(tester, 'par-programme-next');
      expect(find.byKey(const ValueKey('par-prog-start')), findsOneWidget);
      await e.h.finish(tester);
    });
  });

  group('Tərbiyə milestone check limits and corrected age', () {
    testWidgets('offers no milestone check for a child older than the last checkpoint + 12 months (8 years)', (tester) async {
      final e = _Env(birth: '2018-05-01');
      await e.open(tester);
      expect(find.byKey(const ValueKey('par-quiz-milestones')), findsNothing);
      expect(find.byKey(const ValueKey('par-quiz-style')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('offers no milestone check to a 6-year-old (6–12 band, owner decision)', (tester) async {
      final e = _Env(birth: '2020-03-01');
      await e.open(tester);
      expect(find.byKey(const ValueKey('par-quiz-milestones')), findsNothing);
      await e.h.finish(tester);
    });

    testWidgets('opened directly for an older child it shows a short note instead of the quiz', (tester) async {
      final e = _Env();
      final ctx = ParentingCtx(
        content: content, band: '6-12', childBand: '6-12', childName: 'Aysel', childAgeLabel: null, ageMonths: 100, milestoneMonths: 100, //
        milestoneKnown: true, isPremium: false, emergency: '103', today: '2026-11-07', locale: 'az', local: emptyParenting(), slot: emptySlot(),
        updateSlot: (_) {}, update: (_) {}, updateLocal: (_) {}, go: (_) {}, track: (_, [_]) {}, query: '', setQuery: (_) {}, reminderAllowed: true,
      );
      await e.h.pump(tester, QuizScreen(ctx: ctx, id: 'milestones'));
      expect(find.descendant(of: find.byKey(const ValueKey('par-milestone-late')), matching: find.textContaining('Bu yoxlama 7 yaşa qədər olan uşaqlar üçündür.')),
          findsOneWidget);
      expect(find.byKey(const ValueKey('par-quiz-start')), findsNothing);
      await e.h.finish(tester);
    });

    testWidgets('uses the corrected age for a preterm baby (10 months, born ~31 weeks → the 4-month checkpoint)', (tester) async {
      final e = _Env(birth: '2026-01-08', due: '2026-03-15');
      await e.open(tester);
      await tapKey(tester, 'par-quiz-milestones');
      expect(find.text('4 ay'), findsOneWidget);
      expect(tester.widget<Text>(find.byKey(const ValueKey('par-milestone-corrected'))).data, contains('düzəldilmiş yaşa görə aparılır: 7 ay'));
      await e.h.finish(tester);
    });

    testWidgets('a term baby of the same age gets the 9-month checkpoint and no correction note', (tester) async {
      final e = _Env(birth: '2026-01-08', due: '2026-01-10');
      await e.open(tester);
      await tapKey(tester, 'par-quiz-milestones');
      expect(find.text('9 ay'), findsOneWidget);
      expect(find.byKey(const ValueKey('par-milestone-corrected')), findsNothing);
      await e.h.finish(tester);
    });
  });

  group('Tərbiyə sources, support cards and sharing', () {
    testWidgets('shows the SOS card’s sources from the shared list', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-sos-shop-tantrum');
      final src = find.byKey(const ValueKey('par-sources'));
      expect(find.descendant(of: src, matching: find.text('Elmi mənbələr')), findsOneWidget);
      expect(find.descendant(of: src, matching: find.byType(RichText)).evaluate().length, 4); // the heading + 3 entries
      expect(find.descendant(of: src, matching: find.textContaining('AAP — HealthyChildren.org', findRichText: true)), findsWidgets);
      await e.h.finish(tester);
    });

    testWidgets('the daily tip links to the band overview’s sources', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapKey(tester, 'par-tip-sources');
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Elmi mənbələr'), findsOneWidget);
      expect(tester.widget<ToolHeader>(find.byType(ToolHeader)).title, 'Bu yaşda nə baş verir?');
      await e.h.finish(tester);
    });

    testWidgets('shows the mental-health support card with the mood tool and the emergency call on “about to lose it”', (tester) async {
      final e = _Env(birth: '2026-03-01')..target('sos', 'about-to-lose-it');
      await e.open(tester);
      final card = find.byKey(const ValueKey('par-support-mental-health'));
      expect(find.descendant(of: card, matching: find.text(up('Sənin üçün də dəstək var'))), findsOneWidget);
      final call = find.descendant(of: card, matching: find.text('Zəng et: 103'));
      await tester.ensureVisible(call);
      await tester.tap(call);
      expect(e.h.calls.single.toString(), 'tel:103');
      await tapKey(tester, 'par-support-open');
      expect(find.descendant(of: card, matching: find.text('Əhval testi və dəstək')), findsOneWidget);
      expect(e.h.openedTools, contains('mental-health'));
      await e.h.finish(tester);
    });

    testWidgets('shows the child-safety card on the body-safety article; no support card on ordinary articles', (tester) async {
      final e = _Env()..target('article', 'body-safety');
      await e.open(tester);
      expect(find.descendant(of: find.byKey(const ValueKey('par-support-child-safety')), matching: find.textContaining('dərhal 103 nömrəsinə zəng et')), findsOneWidget);
      await e.h.finish(tester);
      final w = _Env()..target('article', 'whining');
      await w.open(tester);
      expect(find.byKey(const ValueKey('par-support-child-safety')), findsNothing);
      expect(find.byKey(const ValueKey('par-support-mental-health')), findsNothing);
      await w.h.finish(tester);
    });

    testWidgets('a mother with a linked partner sends an SOS card to him; the message links to the card', (tester) async {
      final e = _Env(linkedPartner: 'partner-profile')..target('sos', 'shop-tantrum');
      await e.open(tester);
      await tapKey(tester, 'par-share-partner');
      await e.h.flush(tester);
      expect(find.text('Partnyoruna göndərildi ✓'), findsOneWidget);
      expect(e.h.shareRemote.calls, contains('profiles.eq id partner-profile'));
      final sent = e.h.shareRemote.sent.single;
      expect(sent.actor, 'u1');
      expect(sent.content, contains('Mağazada yerə yıxılıb ağlayır'));
      expect(sent.content, contains('https://app.anacan.az/parenting/sos/shop-tantrum'));
      await e.h.finish(tester);
    });

    testWidgets('without a linked partner only the share sheet is offered (title + summary)', (tester) async {
      final e = _Env()..target('article', 'whining');
      await e.open(tester);
      expect(find.byKey(const ValueKey('par-share-partner')), findsNothing);
      await tapKey(tester, 'par-share-sheet');
      final article = content.articles.firstWhere((a) => a.id == 'whining');
      expect(e.h.shares.single.title, article.title);
      expect(e.h.shares.single.text, contains(article.summary));
      await e.h.finish(tester);
    });

    testWidgets('the partner sees the items she sent him and opens one in his Tərbiyə screen', (tester) async {
      final e = _Env();
      final sos = content.sos.firstWhere((s) => s.id == 'shop-tantrum');
      e.h.shareRemote.rows = [
        {'id': 'm1', 'content': partnerShareText(ShareItem(kind: 'sos', id: sos.id, emoji: sos.emoji, title: sos.title, summary: sos.moment), 'h'), //
          'created_at': '2026-11-07T10:00:00Z', 'is_read': false},
      ];
      await e.h.pump(tester, ParentingToolView(onBack: () {}, now: now, child: const ProgrammeChild(id: 'c1', name: 'Aysel', birthDate: '2024-07-07'), partner: true));
      final list = find.byKey(const ValueKey('par-partner-shares'));
      expect(find.descendant(of: list, matching: find.text('Sənə göndərilənlər')), findsOneWidget);
      await tapKey(tester, 'par-shared-sos-shop-tantrum');
      expect(find.text('Əvvəlcə özünü sakitləşdir'), findsOneWidget);
      expect(e.h.shareRemote.reads, ['m1']);
      // His screen: no "send to partner" and no Tools-tab mood tool button.
      expect(find.byKey(const ValueKey('par-share-partner')), findsNothing);
      await e.h.finish(tester);
    });
  });
}
