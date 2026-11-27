// Ported from: (test support — no React counterpart)
import 'package:anacan/shell/shell.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mutable fixture for [shellUserProvider].
class TestUser extends Notifier<ShellUser> {
  TestUser(this.initial);
  final ShellUser initial;
  @override
  ShellUser build() => initial;
  void set(ShellUser user) => state = user;
  void update(ShellUser Function(ShellUser u) f) => state = f(state);
}

const ShellUser kWoman = ShellUser(
  isAuthenticated: true,
  authLoading: false,
  profileLoaded: true,
  language: 'az',
  backendUrl: 'https://app.anacan.az',
  userId: 'current-user',
  role: 'woman',
  lifeStage: 'mommy',
  profileCountryCode: 'AZ',
  linkedPartnerId: 'partner-profile-id',
  displayName: 'Fixture User',
);

final kPartner = kWoman.copyWith(role: 'partner', lifeStage: 'partner');

/// Records platform side effects.
class FakePlatform implements ShellPlatform {
  final List<String> languages = [];
  final List<Uri> external = [];
  final List<Uri> webPages = [];
  final List<(String, String)> views = [];
  bool webPageResult = true;
  int exits = 0;

  @override
  Future<void> changeLanguage(String code) async => languages.add(code);
  @override
  Future<bool> openExternalUrl(Uri uri) async {
    external.add(uri);
    return true;
  }

  @override
  Future<bool> openWebPage(Uri uri) async {
    webPages.add(uri);
    return webPageResult;
  }

  @override
  void logScreenView(String name, String screenClass) => views.add((name, screenClass));
  @override
  void exitApp() => exits++;
}

/// Runs scroll retries synchronously in the order they were scheduled (frame, then by delay).
class ManualScheduler implements ScrollScheduler {
  final List<(int, void Function())> _queue = [];
  int _now = 0;
  @override
  void frame(void Function() fn) => _queue.add((_now + 16, fn));
  @override
  void after(Duration delay, void Function() fn) => _queue.add((_now + delay.inMilliseconds, fn));

  /// Advances virtual time by [ms], running due callbacks in time order (stable).
  void advance(int ms) {
    final end = _now + ms;
    while (true) {
      final due = _queue.where((e) => e.$1 <= end).toList()..sort((a, b) => a.$1.compareTo(b.$1));
      if (due.isEmpty) break;
      final next = due.first;
      _queue.remove(next);
      _now = next.$1;
      next.$2();
    }
    _now = end;
  }
}

class FakeContainer implements ScrollContainerHandle {
  @override
  double offset = 0;
  @override
  void jumpTo(double value) => offset = value;
}

class Harness {
  Harness({ShellUser? user}) {
    userProvider = NotifierProvider<TestUser, ShellUser>(() => TestUser(user ?? kWoman));
    scheduler = ManualScheduler();
    memory = ScrollMemory(scheduler)..container = container;
    c = ProviderContainer(overrides: [
      shellUserProvider.overrideWith((ref) => ref.watch(userProvider)),
      shellPlatformProvider.overrideWithValue(platform),
      scrollMemoryProvider.overrideWithValue(memory),
    ]);
  }

  late final NotifierProvider<TestUser, ShellUser> userProvider;
  final FakePlatform platform = FakePlatform();
  final FakeContainer container = FakeContainer();
  late final ManualScheduler scheduler;
  late final ScrollMemory memory;
  late final ProviderContainer c;

  ShellController get shell => c.read(shellProvider.notifier);
  ShellState get state => c.read(shellProvider);
  PushNavRouter get push => c.read(pushNavRouterProvider);
  void setUser(ShellUser u) => c.read(userProvider.notifier).set(u);

  /// Builds the controller and lets its start-up microtask run.
  Future<void> start() async {
    c.listen(shellProvider, (_, _) {}, fireImmediately: true);
    await Future<void>.delayed(Duration.zero);
  }

  /// A notification tap (`navigateFromPush`) through the shell.
  void tap(Map<String, Object?> data) => shell.navigateFromPush(data);

  /// What Index renders after the gates.
  ShellLayer get layer => layerFor(state, c.read(shellUserProvider).guard);

  void dispose() => c.dispose();
}

class FakeGateActions implements GateActions {
  final List<String> calls = [];
  @override
  void setFunnelCompleted(bool value) => calls.add('funnel:$value');
  @override
  void setHasSeenIntro(bool value) => calls.add('intro:$value');
  @override
  void setHasSelectedLanguage(bool value) => calls.add('language:$value');
}

const readyInputs = GateInputs(
  hasSelectedLanguage: true,
  hasSeenIntro: true,
  isOnboarded: true,
  isAuthenticated: true,
  authLoading: false,
  hasUser: true,
  profileLoaded: true,
  hasProfile: true,
  profileCountryCode: 'AZ',
  profileName: 'Aysel',
  role: 'woman',
  lifeStage: 'mommy',
);
