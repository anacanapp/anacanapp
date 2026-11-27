// Ported from: (test support) — the hook mocks of the baby chat tests: frozen clocks, in-memory stores, the home
// repository fake for the day content / fruit queries and fakes for the AI function, share sheet and photo render.
import 'dart:convert';
import 'dart:typed_data';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/db.dart' show DbResult;
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/baby_chat/baby_chat_ai.dart';
import 'package:anacan/features/baby_chat/baby_chat_screen.dart';
import 'package:anacan/features/baby_chat/baby_chat_share.dart';
import 'package:anacan/features/baby_chat/use_baby_chat.dart';
import 'package:anacan/features/home/data/home_repository.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../support/i18n_fakes.dart';
import '../home/home_test_support.dart' show FakeHomeRepository;

class _NoPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}

class FixedBabyChatClock extends BabyChatClock {
  FixedBabyChatClock(this.now);
  final DateTime now;
  @override
  DateTime build() => now;
}

class FakeSharer implements BabyChatSharer {
  final List<String> shared = [];
  @override
  Future<String> share(Uint8List bytes, {required String fileName, required String mimeType, required String text}) async {
    shared.add(fileName);
    return 'shared';
  }
}

class BabyChatEnv {
  BabyChatEnv({DateTime? now, this.aiReply, this.aiCare = false, DateTime? lastPeriod, this.language = 'az', this.extra = const []}) {
    this.now = now ?? DateTime(2026, 11, 27, 21);
    DomainClock.setSystemTime(this.now);
    container = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(store),
      userStorePlatformProvider.overrideWithValue(_NoPlatform()),
      queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      homeRepositoryProvider.overrideWithValue(repo),
      authUserProvider.overrideWithValue(User(id: 'user-1', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z')),
      babyChatClockProvider.overrideWith(() => FixedBabyChatClock(this.now)),
      babyChatReplyDelayProvider.overrideWithValue(() => Duration.zero),
      babyChatInvokeProvider.overrideWithValue((name, body) async {
        aiCalls.add(body);
        return DbResult<Object?>(data: {'reply': aiReply, 'care': aiCare});
      }),
      babyChatPhotoRendererProvider.overrideWithValue((input) async {
        rendered.add(input);
        return base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
      }),
      babyChatSharerProvider.overrideWithValue(sharer),
      ...extra,
    ]);
    final s = container.read(userStoreProvider.notifier);
    s.setAuth(true, 'user-1', null, 'Leyla');
    s.setLanguage(language);
    s.setLifeStage('bump');
    s.setLastPeriodDate(lastPeriod ?? DateTime(2026, 6, 17)); // day 164 → week 23 on 27 Nov
  }

  late final DateTime now;
  final String? aiReply;
  final bool aiCare;
  final String language;
  final List<Override> extra;
  final LocalStore store = LocalStore.memory();
  final FakeHomeRepository repo = FakeHomeRepository();
  final FakeSharer sharer = FakeSharer();
  final List<Map<String, Object?>> aiCalls = [];
  final List<ShareChatInput> rendered = [];
  late final ProviderContainer container;

  Future<void> pump(WidgetTester tester, Widget child, {bool dark = false}) async {
    installTestI18n();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(
          data: const MediaQueryData(size: Size(390, 844), disableAnimations: true),
          child: GalleryFrame(dark: dark, rtl: false, child: nav!),
        ),
        home: child,
      ),
    ));
    await tester.pump();
  }

  /// Unmounts and flushes the LocalStore write debounce.
  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }
}
