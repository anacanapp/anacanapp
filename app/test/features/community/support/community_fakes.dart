// Ported from: (test support for the community ports - the vi.mock fakes of src/hooks/useCommunity*.test.ts(x),
//              useCommunitySocial.test.tsx, useUnreadCommunityPosts*.test.ts(x), src/components/community/*.test.tsx,
//              src/components/moderation/*.test.tsx)
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/db.dart' show DbResult, UploadResult;
import 'package:anacan/core/i18n/tr.dart';
import 'package:anacan/core/offline/offline_providers.dart' show appResumeEventsProvider;
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/features/chat/data/chat_backend.dart' show chatBackendProvider, chatBackendUrlProvider;
import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/data/community_env.dart';
import 'package:anacan/features/moderation/moderation_queries.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override, ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../support/i18n_fakes.dart';
import '../../chat/support/chat_fakes.dart' show FakeChatBackend;

User communityUser(String id) => User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

/// One recorded backend call.
class Call {
  Call(this.name, this.args);
  final String name;
  final List<Object?> args;
  @override
  String toString() => '$name$args';
}

/// In-memory [CommunityBackend]: every call is recorded; behaviour comes from the handler fields.
class FakeCommunityBackend implements CommunityBackend {
  final List<Call> calls = [];
  Future<String?> Function() onGetUser = () async => null;
  Future<Object?> Function(String fn, Map<String, dynamic>? params) onRpc = (fn, params) async => null;
  Future<List<CRow>> Function(CQuery q) onSelect = (q) async => const [];
  Future<CRow?> Function(CQuery q) onMaybeSingle = (q) async => null;
  Future<CRow> Function(String table, CRow values, String columns) onInsert = (table, values, columns) async => {...values, 'id': 'row-1'};
  Future<List<CRow>> Function(String table, List<CFilter> filters, String? returning) onDelete =
      (table, filters, returning) async => [if (returning != null) {'id': 'row-1'}];
  Future<void> Function(String table, CRow values, List<CFilter> filters) onUpdate = (table, values, filters) async {};
  Future<void> Function(String table, List<CRow> rows, String onConflict) onUpsert = (table, rows, onConflict) async {};
  Future<DbResult<Object?>> Function(String fn, Object? body) onInvoke = (fn, body) async => const DbResult(data: null);
  Future<UploadResult> Function(String bucket, String path, Uint8List bytes, String type) onUpload =
      (bucket, path, bytes, type) async => UploadResult(path: path);
  Future<Map<String, CRow>> Function(List<String> ids)? onProfileCards;
  final List<({String table, String? filter, String event, void Function(CommunityChange) onChange})> subscriptions = [];
  int removedChannels = 0;

  List<Call> named(String name) => [for (final c in calls) if (c.name == name) c];
  List<Map<String, dynamic>?> rpcArgs(String fn) =>
      [for (final c in calls) if (c.name == 'rpc' && c.args[0] == fn) c.args[1] as Map<String, dynamic>?];
  List<CQuery> selects(String table) => [for (final c in calls) if ((c.name == 'select' || c.name == 'maybeSingle') && (c.args[0] as CQuery).table == table) c.args[0] as CQuery];

  @override
  Future<String?> getUserId() {
    calls.add(Call('getUser', const []));
    return onGetUser();
  }

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) {
    calls.add(Call('rpc', [fn, params]));
    return onRpc(fn, params);
  }

  @override
  Future<List<CRow>> select(CQuery query) {
    calls.add(Call('select', [query]));
    return onSelect(query);
  }

  @override
  Future<CRow?> maybeSingle(CQuery query) {
    calls.add(Call('maybeSingle', [query]));
    return onMaybeSingle(query);
  }

  @override
  Future<CRow> insertSingle(String table, CRow values, {String columns = '*'}) {
    calls.add(Call('insert', [table, values, columns]));
    return onInsert(table, values, columns);
  }

  @override
  Future<List<CRow>> delete(String table, List<CFilter> filters, {String? returning}) {
    calls.add(Call('delete', [table, filters, returning]));
    return onDelete(table, filters, returning);
  }

  @override
  Future<void> update(String table, CRow values, List<CFilter> filters) {
    calls.add(Call('update', [table, values, filters]));
    return onUpdate(table, values, filters);
  }

  @override
  Future<void> upsert(String table, List<CRow> rows, {required String onConflict}) {
    calls.add(Call('upsert', [table, rows, onConflict]));
    return onUpsert(table, rows, onConflict);
  }

  @override
  Future<DbResult<Object?>> invoke(String fn, Object? body) {
    calls.add(Call('invoke', [fn, body]));
    return onInvoke(fn, body);
  }

  @override
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType) {
    calls.add(Call('upload', [bucket, path, bytes, contentType]));
    return onUpload(bucket, path, bytes, contentType);
  }

  @override
  String publicUrl(String bucket, String path) => 'https://public.example/$bucket/$path';

  @override
  Future<Map<String, CRow>> profileCards(List<String> userIds) async {
    calls.add(Call('profileCards', [userIds]));
    if (onProfileCards != null) return onProfileCards!(userIds);
    final unique = {...userIds.where((id) => id.isNotEmpty)}.toList();
    if (unique.isEmpty) return {};
    final data = await rpc('get_public_community_profiles_v2', {'p_user_ids': unique});
    if (data is! List) return {};
    return {for (final card in data) if (card is Map) '${card['user_id']}': Map<String, dynamic>.from(card)};
  }

  @override
  void Function() subscribe({required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(CommunityChange change) onChange}) {
    final entry = (table: table, filter: filter, event: event, onChange: onChange);
    subscriptions.add(entry);
    calls.add(Call('channel', [channelPrefix, table, filter]));
    return () {
      removedChannels++;
      subscriptions.remove(entry);
    };
  }

  /// Delivers a realtime change to the matching subscriptions.
  void emit(String table, {required String eventType, String? filter, CRow newRecord = const {}, CRow oldRecord = const {}}) {
    for (final s in [...subscriptions]) {
      if (s.table == table && (filter == null || s.filter == filter)) {
        s.onChange(CommunityChange(eventType: eventType, newRecord: newRecord, oldRecord: oldRecord));
      }
    }
  }
}

class FakePushSender implements ChatPushSender {
  final List<SendPushPayload> payloads = [];
  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    payloads.add(payload);
    return const SendPushResult(ok: true, sent: 1);
  }
}

class FakeModerationBackend implements ModerationBackend {
  FakeModerationBackend(this.handler);
  Future<Object?> Function(String name, Map<String, dynamic>? args) handler;
  final List<Call> calls = [];
  @override
  Future<Object?> rpc(String name, [Map<String, dynamic>? args]) {
    calls.add(Call(name, [args]));
    return handler(name, args);
  }
}

/// A mutable test value (`mocks.auth.user = ...; rerender()`).
class TestValue<T> extends Notifier<T> {
  TestValue(this.initial);
  final T initial;
  @override
  T build() => initial;
  void set(T value) => state = value;
}

/// The signed-in user id of provider tests with `userFromState: true`.
final testUserProvider = NotifierProvider<TestValue<String?>, String?>(() => TestValue<String?>('viewer-a'));

/// `useAuth().loading` of provider tests with `loadingFromState: true`.
final testAuthLoadingProvider = NotifierProvider<TestValue<bool>, bool>(() => TestValue<bool>(false));

/// The UI language of provider tests with `languageFromState: true`.
final testLanguageProvider = NotifierProvider<TestValue<String>, String>(() => TestValue<String>('az'));

/// Overrides of a community test: memory LocalStore, a no-retry query client, the fake backend + push sender.
List<Override> communityOverrides({
  required FakeCommunityBackend backend,
  FakePushSender? push,
  String? userId = 'viewer-a',
  bool userFromState = false,
  Profile? profile,
  bool isAdmin = false,
  bool isModerator = false,
  bool authLoading = false,
  bool loadingFromState = false,
  String language = 'az',
  bool languageFromState = false,
  QueryClient? client,
  LocalStore? store,
  String backendUrl = 'https://api.anacan.az',
  FakeModerationBackend? moderation,
}) =>
    [
      localStoreProvider.overrideWithValue(store ?? LocalStore.memory()),
      queryClientProvider.overrideWithValue(client ?? QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      if (userFromState)
        authUserProvider.overrideWith((ref) {
          final id = ref.watch(testUserProvider);
          return id == null ? null : communityUser(id);
        })
      else
        authUserProvider.overrideWithValue(userId == null ? null : communityUser(userId)),
      authProfileProvider.overrideWithValue(profile),
      isAdminProvider.overrideWithValue(isAdmin),
      isModeratorProvider.overrideWithValue(isModerator || isAdmin),
      if (loadingFromState)
        communityAuthLoadingProvider.overrideWith((ref) => ref.watch(testAuthLoadingProvider))
      else
        communityAuthLoadingProvider.overrideWithValue(authLoading),
      if (languageFromState)
        communityLanguageProvider.overrideWith((ref) => ref.watch(testLanguageProvider))
      else
        communityLanguageProvider.overrideWithValue(language),
      communityBackendUrlProvider.overrideWithValue(backendUrl),
      backendUrlProvider.overrideWithValue(backendUrl),
      communityBackendProvider.overrideWithValue(backend),
      chatBackendProvider.overrideWithValue(FakeChatBackend()),
      chatBackendUrlProvider.overrideWithValue(backendUrl),
      chatPushSenderProvider.overrideWithValue(push ?? FakePushSender()),
      appResumeEventsProvider.overrideWithValue(const Stream<void>.empty()),
      moderationBackendProvider.overrideWithValue(moderation ?? FakeModerationBackend((name, args) async => null)),
    ];

ProviderContainer communityContainer(List<Override> overrides) {
  installTestI18n();
  final container = ProviderContainer(overrides: overrides);
  addTearDown(container.dispose);
  return container;
}

/// Sets the `tr` / `currentLanguage()` language.
void setTestLanguage(String language) => I18nRuntime.instance.setLanguageInMemory(language);

/// Keeps a provider alive (like a mounted hook) and returns a reader of its current value.
T Function() listen<T>(ProviderContainer container, ProviderListenable<T> provider) {
  final sub = container.listen<T>(provider, (_, _) {}, fireImmediately: true);
  addTearDown(sub.close);
  return () => sub.read();
}

/// Lets pending futures / microtasks run.
Future<void> settle([int rounds = 20]) async {
  for (var i = 0; i < rounds; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// Waits until [condition] holds (like `waitFor`).
Future<void> until(bool Function() condition, {int rounds = 200}) async {
  for (var i = 0; i < rounds; i++) {
    if (condition()) return;
    await Future<void>.delayed(Duration.zero);
  }
  expect(condition(), isTrue, reason: 'condition not reached');
}

/// Pumps [child] in the app theme.
Future<void> pumpCommunity(WidgetTester tester, Widget child,
    {required List<Override> overrides, Size size = const Size(390, 844), String language = 'az'}) async {
  installTestI18n();
  setTestLanguage(language);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
      builder: (context, nav) => MediaQuery(
        data: MediaQueryData(size: size, disableAnimations: true),
        child: AToastHost(child: GalleryFrame(dark: false, rtl: false, child: nav!)),
      ),
      home: child,
    ),
  ));
  await tester.pump();
}

/// Unmounts and flushes cache gc / store timers.
Future<void> flushCommunity(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(days: 8));
}
