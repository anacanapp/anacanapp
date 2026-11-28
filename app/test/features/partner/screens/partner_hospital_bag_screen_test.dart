// Ported from: src/components/partner/PartnerHospitalBagScreen.test.tsx
import 'package:anacan/features/partner/data/partner_hospital_bag.dart';
import 'package:anacan/features/partner/screens/partner_hospital_bag_screen.dart';
import 'package:anacan/features/tools/hospital_bag/hospital_bag_logic.dart';
import 'package:anacan/features/tools/hospital_bag/hospital_bag_sync.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ui.dart' show confirmPromptProvider;
import 'dart:ui' show Tristate;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'screens_support.dart';

BagItem _make({required String itemId, required String itemName, String category = 'mom', bool isChecked = false, bool custom = false, String? addedBy, bool hidden = false}) =>
    BagItem(
      id: itemId,
      userId: 'mom',
      itemId: itemId,
      itemName: itemName,
      category: category,
      isChecked: isChecked,
      priority: 2,
      notes: null,
      addedBy: addedBy,
      custom: custom,
      hidden: hidden,
      virtual: false,
      createdAt: '',
      updatedAt: '',
    );

/// The hook's actions as recorded mocks (`vi.fn()`).
class _FakeBag extends HospitalBagController {
  _FakeBag() : super((owner: 'mom', role: 'partner'));
  final List<String> toggled = [];
  final List<(String, String)> added = [];
  final List<String> deleted = [];
  final List<(String, bool)> hiddenCalls = [];

  @override
  Future<void> toggleItem(String itemId) async => toggled.add(itemId);

  @override
  Future<({BagItem? data, Object? error})> addItem(String name, BagCategory category) async {
    added.add((name, category));
    return (data: null, error: null);
  }

  @override
  Future<Object?> deleteItem(String itemId) async {
    deleted.add(itemId);
    return null;
  }

  @override
  Future<Object?> setHidden(String itemId, bool hidden) async {
    hiddenCalls.add((itemId, hidden));
    return null;
  }
}

void main() {
  late _FakeBag bag;
  late List<bool> confirms;
  late int confirmCalls;

  setUp(() {
    bag = _FakeBag();
    confirms = [];
    confirmCalls = 0;
  });

  Future<void> pump(WidgetTester tester) async {
    final items = [
      _make(itemId: 'passport', itemName: 'Pasport', category: 'documents', isChecked: true),
      _make(itemId: 'robe', itemName: 'Xalat'),
      _make(itemId: 'custom:partner:1', itemName: 'Şarj cihazı', category: 'partner', custom: true, addedBy: 'partner'),
      _make(itemId: 'socks', itemName: 'Corab', hidden: true),
    ];
    final state = PartnerHospitalBag(
      items: [for (final i in items) if (!i.hidden) PartnerHospitalBagItem(i)],
      hiddenItems: [for (final i in items) if (i.hidden) PartnerHospitalBagItem(i)],
      loading: false,
      checkedCount: 1,
      totalCount: 3,
      progress: 1 / 3 * 100,
      controller: bag,
    );
    await pumpApp(
      tester,
      PartnerHospitalBagScreen(onBack: () {}),
      scroll: false,
      overrides: [
        ...baseOverrides(),
        partnerHospitalBagProvider.overrideWithValue(state),
        confirmPromptProvider.overrideWithValue((context, text) async {
          confirmCalls++;
          return confirms.isEmpty ? true : confirms.removeAt(0);
        }),
      ],
    );
    await tester.pump();
  }

  Finder tab(String id) => find.byKey(ValueKey('bag-tab-$id'));

  screenTest('shows a Partnyor tab with partner items and counts based on visible items', (tester) async {
    await pump(tester);
    expect(find.text('1 / 3'), findsOneWidget);
    expect(find.text('Xalat'), findsOneWidget);
    // The partner item is not in the "Ana üçün" tab even though its legacy category is 'mom'.
    expect(find.text('Şarj cihazı'), findsNothing);
    expect(find.descendant(of: tab('partner'), matching: find.text('Partnyor')), findsOneWidget);
    await tester.ensureVisible(tab('partner'));
    await tester.tap(tab('partner'));
    await tester.pump();
    expect(find.text('Şarj cihazı'), findsOneWidget);
    expect(find.descendant(of: tab('partner'), matching: find.text('(0/1)')), findsOneWidget);
  });

  screenTest('deletes an own item only after confirmation', (tester) async {
    confirms = [false, true];
    await pump(tester);
    await tester.ensureVisible(tab('partner'));
    await tester.tap(tab('partner'));
    await tester.pump();
    final del = find.bySemanticsLabel('Sil: Şarj cihazı');
    await tester.tap(del);
    await tester.pump();
    expect(bag.deleted, isEmpty);
    await tester.tap(del);
    await tester.pump();
    expect(bag.deleted, ['custom:partner:1']);
    expect(confirmCalls, 2);
  });

  screenTest('hides a default item and lists hidden items in a collapsible group to show again', (tester) async {
    await pump(tester);
    await tester.tap(find.bySemanticsLabel('Gizlət: Xalat'));
    await tester.pump();
    expect(bag.hiddenCalls, [('robe', true)]);

    final toggle = find.byKey(const ValueKey('bag-hidden-toggle'));
    expect(find.text('Gizlədilənlər (1)'), findsOneWidget);
    expect(tester.getSemantics(toggle).flagsCollection.isExpanded, Tristate.isFalse);
    expect(find.text('Corab'), findsNothing);
    await tester.tap(toggle);
    await tester.pump();
    expect(find.text('Corab'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Göstər: Corab'));
    await tester.pump();
    expect(bag.hiddenCalls.last, ('socks', false));
  });

  screenTest('adds an own item in the active category', (tester) async {
    await pump(tester);
    await tester.ensureVisible(tab('partner'));
    await tester.tap(tab('partner'));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('bag-add-own')));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Öz əşyanız'), findsWidgets);
    await tester.enterText(find.byKey(const ValueKey('bag-new-name')), '  Su   şüşəsi ');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('bag-new-submit')));
    await tester.pumpAndSettle();
    expect(bag.added, [('Su şüşəsi', 'partner')]);
  });

  screenTest('toggles an item from its row button', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Xalat'));
    await tester.pump();
    expect(bag.toggled, ['robe']);
  });
}
