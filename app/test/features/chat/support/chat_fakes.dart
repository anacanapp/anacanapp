// Ported from: (test support for the chat ports — the vi.mock fakes of src/lib/chat.test.ts,
//              src/components/MessagesScreen.test.tsx, src/components/chat/*.test.tsx, src/hooks/*.test.tsx)
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/db.dart' show UploadResult;
import 'package:anacan/core/offline/offline_providers.dart' show appResumeEventsProvider;
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/features/chat/data/chat.dart';
import 'package:anacan/features/chat/data/chat_backend.dart';
import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/features/chat/platform/chat_audio.dart';
import 'package:anacan/features/chat/platform/chat_media_picker.dart';
import 'package:anacan/features/moderation/moderation_queries.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../support/i18n_fakes.dart';

User chatUser(String id) => User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

Profile chatProfile(String userId, {String? linkedPartnerId}) =>
    Profile({'id': 'profile-$userId', 'user_id': userId, 'name': 'Leyla', 'linked_partner_id': linkedPartnerId});

/// One recorded backend call.
class Call {
  Call(this.name, this.args);
  final String name;
  final List<Object?> args;
  @override
  String toString() => '$name$args';
}

/// In-memory [ChatBackend]: every call is recorded in [calls]; behaviour comes from the handler fields.
class FakeChatBackend implements ChatBackend {
  final List<Call> calls = [];
  Future<Object?> Function(String fn, Map<String, dynamic>? params) onRpc = (fn, params) async => null;
  Future<List<ChatRow>> Function(String table, String column, List<String> values, String columns) onSelectIn =
      (table, column, values, columns) async => const [];
  Future<ChatRow?> Function(String table, String columns, String column, String value) onMaybeSingle =
      (table, columns, column, value) async => null;
  Future<List<ChatRow>> Function(String userId) onPartnerMessages = (userId) async => const [];
  Future<List<ChatRow>> Function(String userId) onDirectInbox = (userId) async => const [];
  Future<List<ChatRow>> Function(String userId, String other) onDirectThread = (userId, other) async => const [];
  Future<ChatRow> Function(ChatRow values) onInsertDirect = (values) async => {...values, 'id': 'dm-1'};
  Future<ChatRow> Function(ChatRow values) onInsertPartner = (values) async => {...values, 'id': 'pm-1'};
  Future<UploadResult> Function(String bucket, String path, Uint8List bytes, String contentType) onUpload =
      (bucket, path, bytes, contentType) async => UploadResult(path: path);
  Future<void> Function(String bucket, List<String> paths) onRemove = (bucket, paths) async {};
  Future<String> Function(String bucket, String path, int ttl) onSignedUrl = (bucket, path, ttl) async => 'https://signed.example/$path';
  final List<({String table, String? filter, String event, void Function(ChatChange) onChange})> subscriptions = [];

  List<Call> named(String name) => [for (final c in calls) if (c.name == name) c];

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) {
    calls.add(Call('rpc', [fn, params]));
    return onRpc(fn, params);
  }

  @override
  Future<List<ChatRow>> selectIn(String table, String column, List<String> values, {String columns = '*'}) {
    calls.add(Call('selectIn', [table, column, values, columns]));
    return onSelectIn(table, column, values, columns);
  }

  @override
  Future<ChatRow?> maybeSingle(String table, String columns, String column, String value) {
    calls.add(Call('maybeSingle', [table, columns, column, value]));
    return onMaybeSingle(table, columns, column, value);
  }

  @override
  Future<List<ChatRow>> partnerMessages(String userId) {
    calls.add(Call('partnerMessages', [userId]));
    return onPartnerMessages(userId);
  }

  @override
  Future<ChatRow> insertPartnerMessage(ChatRow values) {
    calls.add(Call('insertPartnerMessage', [values]));
    return onInsertPartner(values);
  }

  @override
  Future<void> markPartnerMessageRead(String id, String receiverId) async => calls.add(Call('markPartnerMessageRead', [id, receiverId]));

  @override
  Future<List<ChatRow>> directInbox(String userId) {
    calls.add(Call('directInbox', [userId]));
    return onDirectInbox(userId);
  }

  @override
  Future<List<ChatRow>> directThread(String userId, String otherUserId) {
    calls.add(Call('directThread', [userId, otherUserId]));
    return onDirectThread(userId, otherUserId);
  }

  @override
  Future<void> markDirectRead(List<String> ids) async => calls.add(Call('markDirectRead', [ids]));

  @override
  Future<ChatRow> insertDirectMessage(ChatRow values) {
    calls.add(Call('insertDirectMessage', [values]));
    return onInsertDirect(values);
  }

  @override
  Future<List<ChatRow>> searchProfileCards(String term, int limit) async {
    calls.add(Call('searchProfileCards', [term, limit]));
    return const [];
  }

  @override
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType) {
    calls.add(Call('upload', [bucket, path, bytes, contentType]));
    return onUpload(bucket, path, bytes, contentType);
  }

  @override
  Future<void> remove(String bucket, List<String> paths) {
    calls.add(Call('remove', [bucket, paths]));
    return onRemove(bucket, paths);
  }

  @override
  Future<String> signedUrl(String bucket, String path, int ttlSeconds) {
    calls.add(Call('signedUrl', [bucket, path, ttlSeconds]));
    return onSignedUrl(bucket, path, ttlSeconds);
  }

  @override
  String publicUrl(String bucket, String path) => 'https://public.example/$bucket/$path';

  @override
  void subscribe(Ref ref, {required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(ChatChange change) onChange}) {
    final entry = (table: table, filter: filter, event: event, onChange: onChange);
    subscriptions.add(entry);
    ref.onDispose(() => subscriptions.remove(entry));
  }

  /// Delivers a realtime change to the matching subscriptions.
  void emit(String table, {String? filter, ChatRow newRecord = const {}, ChatRow oldRecord = const {}}) {
    for (final s in [...subscriptions]) {
      if (s.table == table && (filter == null || s.filter == filter)) s.onChange(ChatChange(newRecord: newRecord, oldRecord: oldRecord));
    }
  }
}

class FakePushSender implements ChatPushSender {
  final List<SendPushPayload> payloads = [];
  final List<SendPushResult> results = [];
  SendPushResult fallback = const SendPushResult(ok: true, sent: 1);

  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    payloads.add(payload);
    return results.isNotEmpty ? results.removeAt(0) : fallback;
  }
}

/// Scriptable [ChatAudioPlayer] (the HTMLMediaElement spies of the vitest files).
class FakeAudioPlayer implements ChatAudioPlayer {
  static final List<FakeAudioPlayer> created = [];
  FakeAudioPlayer() {
    created.add(this);
  }

  final List<String> loads = [];
  int plays = 0, pauses = 0;
  Future<void> Function() onPlay = () async {};
  final StreamController<ChatAudioEvent> controller = StreamController<ChatAudioEvent>.broadcast(sync: true);
  bool isPaused = true;
  bool isEnded = false;
  double time = 0;
  double length = double.nan;

  String? get src => loads.isEmpty ? null : loads.last;

  void fire(ChatAudioEvent event) {
    if (event == ChatAudioEvent.play) isPaused = false;
    if (event == ChatAudioEvent.pause || event == ChatAudioEvent.ended) isPaused = true;
    controller.add(event);
  }

  @override
  Stream<ChatAudioEvent> get events => controller.stream;
  @override
  bool get paused => isPaused;
  @override
  bool get ended => isEnded;
  @override
  double get currentTime => time;
  @override
  double get duration => length;
  @override
  Future<void> load(String url) async => loads.add(url);
  @override
  Future<void> play() async {
    plays++;
    await onPlay();
  }

  @override
  Future<void> pause() async => pauses++;
  @override
  Future<void> seek(Duration position) async => time = position.inMilliseconds / 1000;
  @override
  Future<void> dispose() async {}
}

/// Scriptable recorder (the MediaRecorder mocks): `stop()` yields [recording].
class FakeRecorder implements ChatAudioRecorder {
  FakeRecorder({this.recording});
  ChatMediaFile? recording;
  bool opened = false, started = false, released = false;
  @override
  Future<void> open() async => opened = true;
  @override
  Future<void> start() async => started = true;
  @override
  Future<ChatMediaFile?> stop() async => recording;
  @override
  Future<void> release() async => released = true;
}

class FakeMediaPicker implements ChatMediaPicker {
  ChatMediaFile? image, video;
  @override
  Future<ChatMediaFile?> pickImage() async => image;
  @override
  Future<ChatMediaFile?> pickVideo() async => video;
}

class FakeModerationBackend implements ModerationBackend {
  FakeModerationBackend(this.status);
  Map<String, dynamic>? Function() status;
  @override
  Future<Object?> rpc(String name, [Map<String, dynamic>? args]) async => status();
}

/// Overrides of a signed-in chat test: memory LocalStore, a no-retry query client, the user / profile, the fake
/// backend + push sender, no lifecycle stream, the moderation status.
List<Override> chatOverrides({
  required FakeChatBackend backend,
  FakePushSender? push,
  String? userId = 'sender',
  Profile? profile,
  Map<String, dynamic>? Function()? moderation,
  QueryClient? client,
  FeatureRegistry? registry,
  bool overrideUser = true,
  LocalStore? store,
}) =>
    [
      localStoreProvider.overrideWithValue(store ?? LocalStore.memory()),
      queryClientProvider.overrideWithValue(client ?? QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      if (overrideUser) authUserProvider.overrideWithValue(userId == null ? null : chatUser(userId)),
      authProfileProvider.overrideWithValue(profile ?? (userId == null ? null : chatProfile(userId))),
      chatBackendProvider.overrideWithValue(backend),
      chatBackendUrlProvider.overrideWithValue('https://api.anacan.az'),
      chatPushSenderProvider.overrideWithValue(push ?? FakePushSender()),
      appResumeEventsProvider.overrideWithValue(const Stream<void>.empty()),
      moderationBackendProvider.overrideWithValue(FakeModerationBackend(moderation ?? () => {'user_id': userId, 'message': false})),
      if (registry != null) featureRegistryProvider.overrideWithValue(registry),
    ];

/// Pumps [child] in the app theme without an outer scroll view.
Future<void> pumpChat(WidgetTester tester, Widget child, {required List<Override> overrides, Size size = const Size(390, 844)}) async {
  installTestI18n();
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

/// Unmounts and flushes cache gc / store timers (like `screenTest` of the settings harness).
Future<void> flushChat(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(days: 8));
}

/// A `ChatMessage` row.
ChatRow messageRow(String id, {String sender = 'peer', String? receiver = 'sender', String content = 'Original message', String type = 'text',
        String createdAt = '2026-09-21T10:00:00Z', Map<String, Object?> extra = const {}}) =>
    {'id': id, 'sender_id': sender, 'receiver_id': receiver, 'content': content, 'message_type': type, 'created_at': createdAt, ...extra};

/// [ChatMessage] alias for readability in tests.
ChatMessage msg(ChatRow row) => ChatMessage(row);
