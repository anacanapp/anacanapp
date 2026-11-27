// Ported from: (test support) — the vi.mock setups of the AI chat tests: a scripted streaming http client for
// dr-anacan-chat, an in-memory ai_chat_messages store, the usage limit, session token, backend config and the
// paywall opener.
import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/offline/connectivity.dart' show onlineStatusProvider, OnlineStatus;
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/domain/billing/usage_limits.dart' show UsageDecision;
import 'package:anacan/features/ai_chat/ai_chat_history.dart';
import 'package:anacan/features/ai_chat/ai_chat_inputs.dart';
import 'package:anacan/features/ai_chat/ai_chat_logic.dart' show AiWomanContext;
import 'package:anacan/features/legal/medical_disclaimer.dart' show emergencyNumberProvider;
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart' show MaterialApp, Navigator, PageRouteBuilder;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../support/i18n_fakes.dart';

/// SSE line of one delta.
String sse(String content) => 'data: ${jsonEncode({
      'choices': [
        {'delta': {'content': content}},
      ],
    })}\n';

/// A dr-anacan-chat call in flight: push chunks, finish, or fail.
class StreamCall {
  StreamCall(this.request, this.body);
  final http.BaseRequest request;
  final String body;
  final StreamController<List<int>> chunks = StreamController<List<int>>();
  final Completer<http.StreamedResponse> response = Completer<http.StreamedResponse>();
  bool aborted = false;

  Map<String, dynamic> get json => jsonDecode(body) as Map<String, dynamic>;

  /// Sends the headers (status 200 by default) so the body starts streaming.
  void open({int status = 200, Map<String, String> headers = const {'content-type': 'text/event-stream'}}) {
    if (!response.isCompleted) response.complete(http.StreamedResponse(chunks.stream, status, headers: headers, request: request));
  }

  void add(String text) => chunks.add(utf8.encode(text));
  void addBytes(List<int> bytes) => chunks.add(bytes);
  Future<void> close() => chunks.close();
}

/// http client whose responses are driven by the test; honours the request's abort trigger like IOClient.
class ScriptedClient extends http.BaseClient {
  final List<StreamCall> calls = [];
  void Function(StreamCall call)? onCall;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final bytes = await request.finalize().toBytes();
    final call = StreamCall(request, utf8.decode(bytes));
    calls.add(call);
    if (request is http.Abortable) {
      unawaited(request.abortTrigger?.then((_) {
        call.aborted = true;
        if (!call.response.isCompleted) {
          call.response.completeError(http.RequestAbortedException(request.url));
        } else if (!call.chunks.isClosed) {
          call.chunks.addError(http.RequestAbortedException(request.url));
          unawaited(call.chunks.close());
        }
      }));
    }
    onCall?.call(call);
    return call.response.future;
  }
}

class MemoryHistoryStore implements AiChatHistoryStore {
  final List<AiHistoryRow> rows = [];
  final List<Map<String, Object?>> inserts = [];
  int clears = 0;
  int _id = 0;

  @override
  Future<List<AiHistoryRow>> fetch(String userId, String chatType) async =>
      [for (final r in rows) if (r['user_id'] == userId && r['chat_type'] == chatType) r];

  @override
  Future<AiHistoryRow> insert(Map<String, Object?> row) async {
    inserts.add(row);
    final r = <String, dynamic>{'id': 'row-${++_id}', 'created_at': '2026-11-27T10:00:00Z', ...row};
    rows.add(r);
    return r;
  }

  @override
  Future<void> clear(String userId, String chatType) async {
    clears++;
    rows.removeWhere((r) => r['user_id'] == userId && r['chat_type'] == chatType);
  }
}

class _NoPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}

class _FixedOnline extends OnlineStatus {
  _FixedOnline(this.value);
  final bool value;
  @override
  bool build() => value;
}

class AiChatEnv {
  AiChatEnv({
    this.remaining = double.infinity,
    this.allowed = true,
    this.online = true,
    this.token = 'jwt-1',
    List<Override> extra = const [],
  }) {
    container = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(store),
      userStorePlatformProvider.overrideWithValue(_NoPlatform()),
      queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      authUserProvider.overrideWithValue(User(id: 'user-1', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z')),
      authProfileProvider.overrideWithValue(null),
      onlineStatusProvider.overrideWith(() => _FixedOnline(online)),
      emergencyNumberProvider.overrideWithValue('103'),
      aiChatHistoryStoreProvider.overrideWithValue(history),
      aiChatConsumeProvider.overrideWithValue(() async {
        consumed++;
        return UsageDecision(allowed: allowed, remaining: remaining, limit: 5);
      }),
      aiChatAccessTokenProvider.overrideWithValue(() async => token),
      aiChatBackendProvider.overrideWithValue((url: 'https://api.anacan.az', publishableKey: 'pk-1')),
      aiChatHttpClientProvider.overrideWithValue(client),
      aiChatUploadProvider.overrideWithValue((path, bytes) async {
        uploads.add(path);
        return path;
      }),
      aiWomanContextProvider.overrideWithValue(const AiWomanContext()),
      aiSuggestedQuestionsFetcherProvider.overrideWithValue((lifeStage, userType) async {
        suggestedArgs.add((lifeStage, userType));
        return suggested;
      }),
      aiPremiumModalProvider.overrideWithValue((context, {analyticsSource}) async {
        paywalls.add(analyticsSource);
        await Navigator.of(context).push(PageRouteBuilder<void>(
          pageBuilder: (context, _, _) => Center(
            child: GestureDetector(onTap: () => Navigator.of(context).pop(), child: const Text('Standard Premium paywall')),
          ),
        ));
      }),
      ...extra,
    ]);
    final s = container.read(userStoreProvider.notifier);
    s.setAuth(true, 'user-1', null, 'Leyla');
    s.setLanguage('az');
    s.setLifeStage('mommy');
  }

  final double remaining;
  final bool allowed;
  final bool online;
  final String? token;
  final LocalStore store = LocalStore.memory();
  final MemoryHistoryStore history = MemoryHistoryStore();
  final ScriptedClient client = ScriptedClient();
  final List<String> uploads = [];
  final List<String?> paywalls = [];
  List<Map<String, dynamic>> suggested = [];
  final List<(String, String)> suggestedArgs = [];
  int consumed = 0;
  late final ProviderContainer container;

  Future<void> pump(WidgetTester tester, Widget child, {Size size = const Size(390, 760), bool dark = false}) async {
    installTestI18n();
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(
          data: MediaQueryData(size: size, disableAnimations: true),
          child: GalleryFrame(dark: dark, rtl: false, child: nav!),
        ),
        home: child,
      ),
    ));
    await tester.pump();
  }

  /// Unmounts and flushes timers (LocalStore debounce, toasts).
  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
    await tester.pump(const Duration(days: 8));
  }
}
