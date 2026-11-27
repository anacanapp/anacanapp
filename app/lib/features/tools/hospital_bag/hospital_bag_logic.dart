// Ported from: src/lib/hospital-bag.ts
//
// Hospital bag list logic shared by the mother's checklist (useHospitalBag) and the partner's view
// (usePartnerHospitalBag). Rows live in public.hospital_bag_items (one row per user + item_id).
//
// - Default items come from hospital_bag_templates (item_id = template id). They can be hidden, never deleted.
// - Own items have item_id `custom:<category>:<uuid>` (older partner items: `partner-<ms>`) and can be deleted.
//   The category is kept in the id too, so a "partner" item still shows in the right group while the
//   20261108150000_hospital_bag_custom migration (category 'partner' + is_hidden) is not applied.
// - Without the is_hidden column, hidden default items are remembered on this device only.
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../state/local_store.dart';

/// 'mom' | 'baby' | 'documents' | 'partner'
typedef BagCategory = String;
const List<BagCategory> bagCategories = ['documents', 'mom', 'baby', 'partner'];

/// Categories the original check constraint accepts (before the migration).
const List<BagCategory> legacyDbCategories = ['mom', 'baby', 'documents'];
const int customNameMax = 80;

typedef BagRow = Map<String, dynamic>;
typedef BagTemplate = Map<String, dynamic>;

@immutable
class BagItem {
  const BagItem({
    required this.id,
    required this.userId,
    required this.itemId,
    required this.itemName,
    required this.category,
    required this.isChecked,
    required this.priority,
    required this.notes,
    required this.addedBy,
    required this.custom,
    required this.hidden,
    required this.virtual,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Row id, or `tpl:<template id>` for a default item that has no row yet.
  final String id;
  final String? userId;
  final String itemId;
  final String itemName;
  final BagCategory category;
  final bool isChecked;
  final num priority;
  final String? notes;
  final String? addedBy;
  final bool custom;
  final bool hidden;

  /// A default item without a database row yet (created on the first change).
  final bool virtual;
  final String createdAt;
  final String updatedAt;
}

bool _isCategory(Object? value) => value == 'mom' || value == 'baby' || value == 'documents' || value == 'partner';

bool isCustomItemId(String itemId) => itemId.startsWith('custom:') || itemId.startsWith('partner-');

String customItemId(BagCategory category, String uuid) => 'custom:$category:$uuid';

/// The display category: the one encoded in a custom id wins over the stored column.
BagCategory categoryOf({required String itemId, Object? category}) {
  final encoded = itemId.startsWith('custom:') ? (itemId.split(':').length > 1 ? itemId.split(':')[1] : null) : null;
  if (_isCategory(encoded)) return encoded!;
  return _isCategory(category) ? category! as String : 'mom';
}

/// The value written to the category column; 'partner' falls back to 'mom' while the old constraint is in place.
BagCategory dbCategoryFor(BagCategory category, bool partnerAllowed) => category == 'partner' && !partnerAllowed ? 'mom' : category;

/// Trimmed, single-spaced, at most [customNameMax] characters; empty when nothing is left.
String cleanItemName(String name) {
  final single = name.replaceAll(RegExp(r'\s+'), ' ').trim();
  final cut = single.length > customNameMax ? single.substring(0, customNameMax) : single;
  return cut.trim();
}

String _s(Object? v) => v == null ? '' : '$v';
num? _n(Object? v) => v is num ? v : null;

/// One list from the rows and the templates: templates in their order (with translated name / notes), then rows
/// whose template no longer exists, then own items oldest first.
List<BagItem> mergeBagItems(List<BagRow> rows, List<BagTemplate> templates, {Iterable<String> localHidden = const [], bool includeMissingTemplates = false}) {
  final hiddenSet = localHidden.toSet();
  final byItemId = <String, BagRow>{};
  for (final row in rows) {
    byItemId.putIfAbsent(_s(row['item_id']), () => row);
  }

  BagItem fromRow(BagRow row, [BagTemplate? template]) {
    final itemId = _s(row['item_id']);
    final tName = template == null ? null : _s(template['item_name']);
    return BagItem(
      id: _s(row['id']),
      userId: row['user_id'] as String?,
      itemId: itemId,
      itemName: (tName != null && tName.isNotEmpty) ? tName : _s(row['item_name']),
      category: template != null && _isCategory(template['category']) ? template['category'] as String : categoryOf(itemId: itemId, category: row['category']),
      isChecked: row['is_checked'] == true,
      priority: _n(template?['priority']) ?? _n(row['priority']) ?? 2,
      notes: template != null ? template['notes'] as String? : row['notes'] as String?,
      addedBy: row['added_by'] as String?,
      custom: isCustomItemId(itemId),
      hidden: row['is_hidden'] == true || hiddenSet.contains(itemId),
      virtual: false,
      createdAt: _s(row['created_at']),
      updatedAt: _s(row['updated_at']),
    );
  }

  final indexed = [for (var i = 0; i < templates.length; i++) (i, templates[i])];
  indexed.sort((a, b) {
    final c = (_n(a.$2['sort_order']) ?? 0).compareTo(_n(b.$2['sort_order']) ?? 0);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  final sortedTemplates = [for (final e in indexed) e.$2];
  final templateIds = {for (final t in sortedTemplates) _s(t['id'])};
  final items = <BagItem>[];
  for (final template in sortedTemplates) {
    final id = _s(template['id']);
    final row = byItemId[id];
    if (row != null) {
      items.add(fromRow(row, template));
    } else if (includeMissingTemplates && template['is_active'] != false) {
      items.add(BagItem(
        id: 'tpl:$id',
        userId: null,
        itemId: id,
        itemName: _s(template['item_name']),
        category: _isCategory(template['category']) ? template['category'] as String : 'mom',
        isChecked: false,
        priority: _n(template['priority']) ?? 2,
        notes: template['notes'] as String?,
        addedBy: null,
        custom: false,
        hidden: hiddenSet.contains(id),
        virtual: true,
        createdAt: '',
        updatedAt: '',
      ));
    }
  }
  final rest = byItemId.values.where((row) => !templateIds.contains(_s(row['item_id']))).toList();
  final orphans = rest.where((row) => !isCustomItemId(_s(row['item_id']))).toList()
    ..sort((a, b) => _s(a['item_id']).compareTo(_s(b['item_id'])));
  final custom = rest.where((row) => isCustomItemId(_s(row['item_id']))).toList();
  final customIndexed = [for (var i = 0; i < custom.length; i++) (i, custom[i])]
    ..sort((a, b) {
      final c = _s(a.$2['created_at']).compareTo(_s(b.$2['created_at']));
      if (c != 0) return c;
      final d = _s(a.$2['item_id']).compareTo(_s(b.$2['item_id']));
      return d != 0 ? d : a.$1.compareTo(b.$1);
    });
  for (final row in [...orphans, for (final e in customIndexed) e.$2]) {
    items.add(fromRow(row));
  }
  return items;
}

/// Templates that have no row yet (the owner's checklist creates them so the partner sees the same list).
List<Map<String, Object?>> missingTemplateRows(List<BagRow> rows, List<BagTemplate> templates, String userId) {
  final have = {for (final r in rows) _s(r['item_id'])};
  return [
    for (final t in templates)
      if (t['is_active'] != false && !have.contains(_s(t['id'])))
        {
          'user_id': userId,
          'item_id': _s(t['id']),
          'item_name': _s(t['item_name']),
          'category': _isCategory(t['category']) && t['category'] != 'partner' ? t['category'] : 'mom',
          'is_checked': false,
          'priority': _n(t['priority']) ?? 2,
          'notes': t['notes'],
        },
  ];
}

List<BagItem> visibleBagItems(List<BagItem> items) => items.where((i) => !i.hidden).toList();

({int checked, int total, double progress}) bagCounts(List<BagItem> items) {
  final visible = visibleBagItems(items);
  final checked = visible.where((i) => i.isChecked).length;
  return (checked: checked, total: visible.length, progress: visible.isNotEmpty ? checked / visible.length * 100 : 0);
}

String? _code(Object? error) {
  if (error == null) return null;
  if (error is Map) return error['code'] as String?;
  try {
    final dynamic d = error;
    final c = d.code;
    return c is String ? c : null;
  } catch (_) {
    return null;
  }
}

/// PostgREST / Postgres errors meaning "this column does not exist yet" (migration not applied).
bool isMissingColumnError(Object? error) {
  final c = _code(error);
  return c == '42703' || c == 'PGRST204';
}

/// Check-constraint violation (category 'partner' before the migration).
bool isCheckViolation(Object? error) => _code(error) == '23514';

// ── Device fallback for hidden default items ──

String _hiddenKey(String ownerUserId) => 'anacan.hospital-bag.hidden.$ownerUserId';

List<String> readLocalHidden(LocalStore store, String ownerUserId) {
  try {
    final parsed = jsonDecode(store.getItem(_hiddenKey(ownerUserId)) ?? '[]');
    return parsed is List ? parsed.whereType<String>().take(500).toList() : [];
  } catch (_) {
    return [];
  }
}

void writeLocalHidden(LocalStore store, String ownerUserId, List<String> itemIds) {
  try {
    store.setItem(_hiddenKey(ownerUserId), jsonEncode(itemIds.toSet().take(500).toList()));
  } catch (_) {
    // not remembered
  }
}

/// Toggle one item_id in a hidden list.
List<String> toggleHidden(List<String> list, String itemId, bool hidden) =>
    hidden ? {...list, itemId}.toList() : list.where((id) => id != itemId).toList();
