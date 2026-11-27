// Ported from: src/lib/hospital-bag.test.ts
// (src/lib/hospitalBagSql.test.ts checks the SQL migration file and its CDC manifest, not app code: not ported.)
import 'package:anacan/features/tools/hospital_bag/hospital_bag_logic.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

final templates = <BagTemplate>[
  {'id': 't-passport', 'item_name': 'Passport', 'category': 'documents', 'priority': 1, 'notes': 'ID', 'sort_order': 1},
  {'id': 't-gown', 'item_name': 'Gown', 'category': 'mom', 'priority': 2, 'notes': null, 'sort_order': 2},
  {'id': 't-diapers', 'item_name': 'Diapers', 'category': 'baby', 'priority': 1, 'notes': null, 'sort_order': 3},
  {'id': 't-old', 'item_name': 'Retired', 'category': 'baby', 'sort_order': 4, 'is_active': false},
];
var n = 0;
BagRow row(Map<String, dynamic> over) => {
      'id': 'r${n++}',
      'user_id': 'mom',
      'item_id': 't-passport',
      'item_name': 'Pasport',
      'category': 'documents',
      'is_checked': false,
      'priority': 2,
      'notes': null,
      'added_by': 'woman',
      'created_at': '2026-11-01T10:00:00Z',
      'updated_at': '2026-11-01T10:00:00Z',
      ...over,
    };

void main() {
  group('custom item ids and categories', () {
    test('encodes the category in own items and recognises older partner items', () {
      final id = customItemId('partner', 'abc');
      expect(id, 'custom:partner:abc');
      expect(isCustomItemId(id), isTrue);
      expect(isCustomItemId('partner-1730000000000'), isTrue);
      expect(isCustomItemId('t-passport'), isFalse);
    });

    test('reads the display category from the id when the column had to fall back', () {
      expect(categoryOf(itemId: 'custom:partner:abc', category: 'mom'), 'partner');
      expect(categoryOf(itemId: 'custom:bogus:abc', category: 'baby'), 'baby');
      expect(categoryOf(itemId: 'partner-1', category: 'documents'), 'documents');
      expect(categoryOf(itemId: 'x', category: 'weird'), 'mom');
    });

    test('writes "partner" only when the database accepts it', () {
      expect(dbCategoryFor('partner', true), 'partner');
      expect(dbCategoryFor('partner', false), 'mom');
      expect(dbCategoryFor('baby', false), 'baby');
    });

    test('cleans item names', () {
      expect(cleanItemName('  phone   charger '), 'phone charger');
      expect(cleanItemName('   '), '');
      expect(cleanItemName('x' * 200), hasLength(80));
    });
  });

  group('mergeBagItems', () {
    test('lists templates in order with translated names, then orphan rows, then own items oldest first', () {
      final rows = [
        row({'item_id': 'custom:mom:b', 'item_name': 'Snacks', 'category': 'mom', 'created_at': '2026-11-03T00:00:00Z'}),
        row({'item_id': 't-gown', 'item_name': 'Xalat', 'category': 'mom', 'is_checked': true}),
        row({'item_id': 'partner-1', 'item_name': 'Charger', 'category': 'documents', 'added_by': 'partner', 'created_at': '2026-11-02T00:00:00Z'}),
        row({'item_id': 't-passport'}),
        row({'item_id': 't-removed', 'item_name': 'Old template', 'category': 'baby'}),
      ];
      final items = mergeBagItems(rows, templates);
      expect(items.map((i) => i.itemId).toList(), ['t-passport', 't-gown', 't-removed', 'partner-1', 'custom:mom:b']);
      expect((items[0].itemName, items[0].notes, items[0].priority, items[0].custom, items[0].virtual), ('Passport', 'ID', 1, false, false));
      expect((items[1].itemName, items[1].isChecked), ('Gown', true));
      expect((items[2].itemName, items[2].custom), ('Old template', false));
      expect((items[3].custom, items[3].addedBy, items[3].category), (true, 'partner', 'documents'));
      expect((items[4].custom, items[4].itemName), (true, 'Snacks'));
    });

    test('adds missing active templates as virtual items only for the owner', () {
      final rows = [row({'item_id': 't-passport'})];
      final owner = mergeBagItems(rows, templates, includeMissingTemplates: true);
      expect(owner.map((i) => (i.itemId, i.virtual)).toList(), [('t-passport', false), ('t-gown', true), ('t-diapers', true)]);
      expect(owner[1].id, 'tpl:t-gown');
      expect(mergeBagItems(rows, templates).map((i) => i.itemId).toList(), ['t-passport']);
    });

    test('marks hidden items from the column or from this device', () {
      final rows = [row({'item_id': 't-passport', 'is_hidden': true}), row({'item_id': 't-gown'}), row({'item_id': 't-diapers'})];
      final items = mergeBagItems(rows, templates, localHidden: ['t-diapers']);
      expect(items.where((i) => i.hidden).map((i) => i.itemId).toList(), ['t-passport', 't-diapers']);
      expect(visibleBagItems(items).map((i) => i.itemId).toList(), ['t-gown']);
    });

    test('keeps one entry per item_id', () {
      final items = mergeBagItems([row({'id': 'a', 'item_id': 't-gown'}), row({'id': 'b', 'item_id': 't-gown'})], templates);
      expect(items.map((i) => i.id).toList(), ['a']);
    });

    test('shows a "partner" item in its group even when stored as "mom"', () {
      final item = mergeBagItems([row({'item_id': 'custom:partner:x', 'category': 'mom', 'item_name': 'Snacks for dad'})], []).single;
      expect(item.category, 'partner');
    });
  });

  group('counts and seeding', () {
    test('counts only visible items', () {
      final items = mergeBagItems([
        row({'item_id': 't-passport', 'is_checked': true}),
        row({'item_id': 't-gown', 'is_checked': true, 'is_hidden': true}),
        row({'item_id': 't-diapers'}),
      ], templates);
      expect(bagCounts(items), (checked: 1, total: 2, progress: 50.0));
      expect(bagCounts([]), (checked: 0, total: 0, progress: 0.0));
    });

    test('creates rows only for active templates that have none', () {
      final missing = missingTemplateRows([{'item_id': 't-passport'}], templates, 'mom');
      expect(missing.map((m) => m['item_id']).toList(), ['t-gown', 't-diapers']);
      expect(missing[0], {'user_id': 'mom', 'item_id': 't-gown', 'item_name': 'Gown', 'category': 'mom', 'is_checked': false, 'priority': 2, 'notes': null});
    });
  });

  group('migration tolerance helpers', () {
    late LocalStore store;
    setUp(() => store = LocalStore.memory());

    test('recognises a missing column and a check violation', () {
      expect(isMissingColumnError({'code': '42703'}), isTrue);
      expect(isMissingColumnError({'code': 'PGRST204'}), isTrue);
      expect(isMissingColumnError({'code': '23514'}), isFalse);
      expect(isMissingColumnError(null), isFalse);
      expect(isCheckViolation({'code': '23514'}), isTrue);
    });

    test('remembers hidden default items per bag owner on this device', () {
      expect(readLocalHidden(store, 'mom'), isEmpty);
      writeLocalHidden(store, 'mom', toggleHidden([], 't-gown', true));
      expect(readLocalHidden(store, 'mom'), ['t-gown']);
      expect(readLocalHidden(store, 'other'), isEmpty);
      writeLocalHidden(store, 'mom', toggleHidden(readLocalHidden(store, 'mom'), 't-gown', false));
      expect(readLocalHidden(store, 'mom'), isEmpty);
      store.setItem('anacan.hospital-bag.hidden.mom', '{bad json');
      expect(readLocalHidden(store, 'mom'), isEmpty);
    });
  });
}
