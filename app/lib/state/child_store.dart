// Ported from: src/store/childStore.ts
//
// `selected-child-storage` = `{"state":{"selectedChildId":…},"version":0}`.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'local_store.dart';
import 'persisted_store.dart';

/// `ChildData` (a `children` row as the app uses it).
class ChildData {
  const ChildData({
    required this.id,
    required this.userId,
    required this.name,
    required this.birthDate,
    required this.gender,
    required this.avatarEmoji,
    required this.isActive,
    required this.sortOrder,
    this.notes,
    required this.createdAt,
  });

  factory ChildData.fromRow(Map<String, dynamic> row) => ChildData(
        id: row['id'] as String,
        userId: row['user_id'] as String,
        name: row['name'] as String? ?? '',
        birthDate: row['birth_date'] as String? ?? '',
        gender: row['gender'] as String? ?? 'unknown',
        avatarEmoji: row['avatar_emoji'] as String? ?? '',
        isActive: row['is_active'] as bool? ?? true,
        sortOrder: (row['sort_order'] as num?)?.toInt() ?? 0,
        notes: row['notes'] as String?,
        createdAt: row['created_at'] as String? ?? '',
      );

  final String id;
  final String userId;
  final String name;
  final String birthDate;

  /// 'boy' | 'girl' | 'unknown'.
  final String gender;
  final String avatarEmoji;
  final bool isActive;
  final int sortOrder;
  final String? notes;
  final String createdAt;

  Map<String, dynamic> toRow() => {
        'id': id,
        'user_id': userId,
        'name': name,
        'birth_date': birthDate,
        'gender': gender,
        'avatar_emoji': avatarEmoji,
        'is_active': isActive,
        'sort_order': sortOrder,
        'notes': notes,
        'created_at': createdAt,
      };
}

class ChildState {
  const ChildState({this.selectedChildId});
  final String? selectedChildId;
}

const PersistedEnvelope childStoreEnvelope = PersistedEnvelope(name: 'selected-child-storage');

/// `useChildStore`.
final childStoreProvider = NotifierProvider<ChildStore, ChildState>(ChildStore.new);

class ChildStore extends Notifier<ChildState> {
  late LocalStore _store;

  @override
  ChildState build() {
    _store = ref.watch(localStoreProvider);
    return _hydrate();
  }

  ChildState _hydrate() {
    final persisted = childStoreEnvelope.read(_store).state;
    if (persisted == null || !persisted.containsKey('selectedChildId')) return const ChildState();
    final id = persisted['selectedChildId'];
    return ChildState(selectedChildId: id is String ? id : null);
  }

  void rehydrate() => state = _hydrate();

  void setSelectedChildId(String? childId) {
    state = ChildState(selectedChildId: childId);
    childStoreEnvelope.write(_store, {'selectedChildId': childId});
  }
}
