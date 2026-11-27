// Ported from: src/hooks/useFavoriteNames.ts, the `name-ai-lookup` call of src/components/tools/BabyNames.tsx
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/net/backend_providers.dart';

@immutable
class FavoriteName {
  const FavoriteName({required this.id, required this.userId, required this.name, required this.gender, this.meaning, this.origin, required this.createdAt});
  final String id;
  final String userId;
  final String name;

  /// 'boy' | 'girl' | 'unisex'.
  final String gender;
  final String? meaning;
  final String? origin;
  final String createdAt;

  factory FavoriteName.fromRow(Map<String, dynamic> r) => FavoriteName(
        id: '${r['id'] ?? ''}',
        userId: '${r['user_id'] ?? ''}',
        name: '${r['name'] ?? ''}',
        gender: '${r['gender'] ?? 'unisex'}',
        meaning: r['meaning'] as String?,
        origin: r['origin'] as String?,
        createdAt: '${r['created_at'] ?? ''}',
      );
}

abstract interface class NamesRepository {
  /// `favorite_names`: `select('*').eq('user_id').order('created_at', desc)`.
  Future<List<Map<String, dynamic>>> loadFavorites(String userId);

  /// `insert(row).select().single()`.
  Future<Map<String, dynamic>> insertFavorite(Map<String, Object?> row);

  /// `delete().eq('user_id').eq('name')`.
  Future<void> deleteFavorite(String userId, String name);

  /// `functions.invoke('name-ai-lookup', { body: { name, language } })` → `{ data, error }`.
  Future<({Object? data, Object? error})> aiLookup(String name, String language);
}

class SupabaseNamesRepository implements NamesRepository {
  SupabaseNamesRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> loadFavorites(String userId) async {
    final data = await _client().from('favorite_names').select().eq('user_id', userId).order('created_at', ascending: false);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<Map<String, dynamic>> insertFavorite(Map<String, Object?> row) async =>
      Map<String, dynamic>.from(await _client().from('favorite_names').insert(row).select().single());

  @override
  Future<void> deleteFavorite(String userId, String name) => _client().from('favorite_names').delete().eq('user_id', userId).eq('name', name);

  @override
  Future<({Object? data, Object? error})> aiLookup(String name, String language) async {
    try {
      final res = await _client().functions.invoke('name-ai-lookup', body: {'name': name, 'language': language});
      return (data: res.data, error: null);
    } catch (e) {
      return (data: null, error: e);
    }
  }
}

final namesRepositoryProvider = Provider<NamesRepository>((ref) => SupabaseNamesRepository(() => ref.read(supabaseClientProvider)));

@immutable
class FavoriteNamesState {
  const FavoriteNamesState({this.favorites = const [], this.loading = true});
  final List<FavoriteName> favorites;
  final bool loading;

  bool isFavorite(String name) => favorites.any((f) => f.name == name);
}

class FavoriteNamesController extends Notifier<FavoriteNamesState> {
  NamesRepository get _repo => ref.read(namesRepositoryProvider);
  String? get _uid => ref.read(authUserProvider)?.id;

  @override
  FavoriteNamesState build() {
    final uid = ref.watch(authUserProvider)?.id;
    if (uid != null) {
      Future.microtask(() {
        if (ref.mounted) unawaited(fetch());
      });
    }
    return const FavoriteNamesState();
  }

  Future<void> fetch() async {
    final uid = _uid;
    if (uid == null) return;
    try {
      final rows = await _repo.loadFavorites(uid);
      if (ref.mounted) state = FavoriteNamesState(favorites: [for (final r in rows) FavoriteName.fromRow(r)], loading: false);
    } catch (e) {
      debugPrint('Error fetching favorite names: $e');
      if (ref.mounted) state = FavoriteNamesState(favorites: state.favorites, loading: false);
    }
  }

  Future<void> addFavorite(String name, String gender, {String? meaning, String? origin}) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      final row = await _repo.insertFavorite({
        'user_id': uid,
        'name': name,
        'gender': gender,
        'meaning': (meaning == null || meaning.isEmpty) ? null : meaning,
        'origin': (origin == null || origin.isEmpty) ? null : origin,
      });
      if (ref.mounted) state = FavoriteNamesState(favorites: [FavoriteName.fromRow(row), ...state.favorites], loading: state.loading);
    } catch (e) {
      debugPrint('Error adding favorite name: $e');
    }
  }

  Future<void> removeFavorite(String name) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.deleteFavorite(uid, name);
      if (ref.mounted) state = FavoriteNamesState(favorites: state.favorites.where((f) => f.name != name).toList(), loading: state.loading);
    } catch (e) {
      debugPrint('Error removing favorite name: $e');
    }
  }

  Future<void> toggleFavorite(String name, String gender, {String? meaning, String? origin}) async {
    if (state.isFavorite(name)) {
      await removeFavorite(name);
    } else {
      await addFavorite(name, gender, meaning: meaning, origin: origin);
    }
  }
}

final favoriteNamesProvider = NotifierProvider.autoDispose<FavoriteNamesController, FavoriteNamesState>(FavoriteNamesController.new);
