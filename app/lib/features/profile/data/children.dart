// Ported from: src/hooks/useChildren.ts
//
// The profile's view of `useChildren()`. The hook has ONE port: features/baby/hooks/use_children.dart (query key
// `['user-children', userId]`, 5 min stale, 30 min gc, no retry, offline cache `children_v1`, first-child seeding
// from the profile). The profile used to carry its own copy with the same key but a different model type, so the
// two observers overwrote each other's cache entry with data the other could not read (an empty children list on
// the profile after the mommy home fetched, and vice versa). This file now only adapts the shared hook to the
// API the profile screens use.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart';
import '../../../state/state.dart' show childStoreProvider;
import '../../baby/hooks/use_children.dart';

export '../../baby/data/baby_repository.dart' show BabyRepository, babyRepositoryProvider;
export '../../baby/hooks/use_children.dart' show childrenQuery;
export '../../baby/models/child.dart' show Child;

/// `getChildAge(child).displayText` (chronological, like the profile list).
String childAgeText(Child child) => getRealCalendarAge(child.birthDate, tr: tr).displayText;

/// `useChildren()` actions + derived values, as the profile screens call them.
class ChildrenController {
  ChildrenController(this._ref);
  final Ref _ref;

  ChildrenActions get _actions => _ref.read(childrenActionsProvider);

  List<Child> get children => _ref.read(childrenQuery).data ?? const <Child>[];

  /// `selectedChild`: the stored id when it is in the list, else the first child.
  Child? get selectedChild {
    final id = _ref.read(childStoreProvider).selectedChildId;
    final list = children;
    return list.where((c) => c.id == id).firstOrNull ?? list.firstOrNull;
  }

  Future<Child?> addChild({required String name, required String birthDate, String? gender, String? avatarEmoji, String? dueDate}) =>
      _actions.addChild(name: name, birthDate: birthDate, gender: gender, avatarEmoji: avatarEmoji, dueDate: dueDate);

  Future<bool> updateChild(String childId, Map<String, dynamic> updates) => _actions.updateChild(childId, updates);

  Future<bool> deleteChild(String childId) => _actions.deleteChild(childId);
}

final childrenControllerProvider = Provider<ChildrenController>((ref) => ChildrenController(ref));
