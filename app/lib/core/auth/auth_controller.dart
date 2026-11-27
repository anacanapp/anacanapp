// Ported from: src/contexts/AuthContext.tsx, src/hooks/useAuth.ts, src/lib/native-auth.ts (Google/Apple
// token exchange, browser fallback, callback completion), src/components/AuthScreen.tsx (reset
// password call), src/pages/ResetPassword.tsx (updateUser), src/components/SettingsScreen.tsx +
// PrivacyScreen.tsx (delete-user-account).
//
// Single source of truth for the session is the SDK's auth event stream (gotrue replays every event
// to a new subscriber, so subscribing after startup sees INITIAL_SESSION first, like React).
// Sign-out goes through NativeSessionPersistence.signOut (tombstone) after the bounded logout cleanup.

import 'dart:async';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../state/calendar_utils.dart';
import '../../state/persisted_store.dart' show localStoreProvider;
import '../../state/user_store.dart';
import '../cache/providers.dart' show queryClientProvider;
import '../i18n/tr.dart';
import '../net/backend_client.dart' show BootstrapOpened;
import '../net/backend_providers.dart';
import '../net/build_config.dart';
import '../offline/connectivity.dart';
import '../offline/offline_cache.dart';
import '../offline/offline_providers.dart';
import '../session/logout_cleanup.dart';
import '../session/offline_session.dart';
import 'auth_models.dart';
import 'partner_link.dart';
import 'social_auth.dart';
import 'social_auth_errors.dart';

const String _profileCacheKey = 'profile';
const String _roleCacheKey = 'role';

/// auth-js emits SIGNED_IN on every visibility return; the same account is re-read at most this often.
const Duration sameUserRehydrate = Duration(minutes: 10);

/// Failsafe: never keep the app behind the auth loading screen longer than this.
const Duration authBootstrapTimeout = Duration(seconds: 5);

String _defaultName() => tr('authcontext_i_stifadeci_b6bdd6', 'İstifadəçi');

/// JS `a || b`: empty strings fall through.
String? _or(String? a, String? b) => (a != null && a.isNotEmpty) ? a : b;

/// Side effects that belong to other features (analytics, RevenueCat, crash reports, time zone).
class AuthSideEffects {
  const AuthSideEffects({
    this.onSignedIn,
    this.onLoggedOut,
    this.onLogin,
    this.onSignUp,
    this.reportAuthError,
    this.syncUserTimeZone,
    this.onProfileSynced,
  });

  /// INITIAL_SESSION with a user (`analytics.setUserId`, RevenueCat `identifyUser`).
  final void Function(String userId)? onSignedIn;

  /// Sign-out / SIGNED_OUT (RevenueCat logout on the managed realm, Mixpanel reset).
  final void Function()? onLoggedOut;
  final void Function(String method)? onLogin;
  final void Function(String method)? onSignUp;

  /// Crash-report the auth failure (never with tokens).
  final void Function(String provider, Object error)? reportAuthError;
  final Future<void> Function(String userId)? syncUserTimeZone;

  /// Analytics user properties after a profile sync.
  final void Function(String userId, Profile profile)? onProfileSynced;
}

/// Everything the controller needs from outside. Tests build it with fakes.
class AuthEnvironment {
  AuthEnvironment({
    required this.client,
    required this.signOutSdk,
    Stream<AuthState>? authEvents,
    Session? Function()? currentSession,
    this.readPersistedSession,
    this.refreshSession,
    this.logoutCleanup = const LogoutCleanupSteps(),
    this.social,
    this.appOrigin = 'https://app.anacan.az',
    this.partnerPairingEnabled = false,
    this.isNativePlatform = true,
    this.effects = const AuthSideEffects(),
    this.bootstrapTimeout = authBootstrapTimeout,
    int Function()? now,
  })  : authEvents = authEvents ?? client.auth.onAuthStateChange,
        currentSession = currentSession ?? (() => client.auth.currentSession),
        now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final SupabaseClient client;

  /// `supabase.auth.signOut()` as patched by session-persistence (NativeSessionPersistence.signOut).
  final Future<void> Function() signOutSdk;
  final Stream<AuthState> authEvents;
  final Session? Function() currentSession;

  /// The persisted SDK session (kept by gotrue after a retryable refresh failure), or null.
  final Future<StoredSession?> Function()? readPersistedSession;

  /// `supabase.auth.getSession()` on `online` while opened offline (refreshes an expired token).
  final Future<void> Function()? refreshSession;
  final LogoutCleanupSteps logoutCleanup;
  final SocialAuthProvider? social;

  /// `window.location.origin` of the Capacitor app (sign-up and reset-password redirects).
  final String appOrigin;
  final bool partnerPairingEnabled;
  final bool isNativePlatform;
  final AuthSideEffects effects;
  final Duration bootstrapTimeout;
  final int Function() now;
}

/// Overridden by the shell when native plugins exist.
final socialAuthProviderProvider = Provider<SocialAuthProvider?>((ref) => null);

/// Logout cleanup steps (local notifications, notification taps, device token) from their features.
final logoutCleanupStepsProvider = Provider<LogoutCleanupSteps>((ref) => const LogoutCleanupSteps());

/// Analytics/RevenueCat hooks from their features.
final authSideEffectsProvider = Provider<AuthSideEffects>((ref) => const AuthSideEffects());

/// Default environment over the admitted backend.
final authEnvironmentProvider = Provider<AuthEnvironment>((ref) {
  final client = ref.watch(supabaseClientProvider);
  final persistence = ref.watch(sessionPersistenceProvider);
  final opened = ref.watch(backendBootstrapProvider).requireValue as BootstrapOpened;
  const config = BuildConfig.fromEnvironment;
  return AuthEnvironment(
    client: client,
    signOutSdk: persistence.signOut,
    readPersistedSession: () => readStoredSession(opened.handle.sessionStore.readPersisted),
    refreshSession: () async {
      await client.auth.refreshSession();
    },
    logoutCleanup: ref.watch(logoutCleanupStepsProvider),
    social: ref.watch(socialAuthProviderProvider),
    partnerPairingEnabled: isAzurePairingBackend(
      buildMode: config.buildMode,
      azurePartnerPairing: config.azurePartnerPairing,
      sourceFirst: opened.backend.sourceFirst,
      azure: opened.backend.azure,
    ),
    effects: ref.watch(authSideEffectsProvider),
  );
});

/// `useAuth()` / `useAuthContext()`.
final authControllerProvider = NotifierProvider<AuthController, AuthViewState>(AuthController.new);

class AuthController extends Notifier<AuthViewState> {
  late AuthEnvironment _env;

  /// Account whose profile/roles/prefs were last hydrated, and when.
  ({String userId, int at})? _hydrated;

  /// Opened on the stored account while the token could not be refreshed (offline).
  bool _offline = false;
  bool _initialHandled = false;
  bool _mounted = false;
  Timer? _bootstrapTimer;
  final List<StreamSubscription<Object?>> _subscriptions = [];

  AuthEnvironment get environment => _env;
  SupabaseClient get _client => _env.client;
  UserStore get _store => ref.read(userStoreProvider.notifier);
  UserState get _storeState => ref.read(userStoreProvider);
  OfflineCache get _cache => ref.read(offlineCacheProvider);
  PartnerLink get _partner => PartnerLink(
        pairingEnabled: _env.partnerPairingEnabled,
        rpc: (fn, [params]) => _client.rpc<Object?>(fn, params: params),
      );

  @override
  AuthViewState build() {
    _env = ref.watch(authEnvironmentProvider);
    _mounted = true;
    _bootstrapTimer = Timer(_env.bootstrapTimeout, () {
      debugPrint('Auth bootstrap timeout - forcing loading=false');
      _finishLoading();
    });
    _subscriptions.add(_env.authEvents.listen((event) => unawaited(_onAuthEvent(event.event, event.session))));
    final connectivity = ref.read(connectivitySourceProvider);
    _subscriptions.add(connectivity.onlineChanges.listen((online) {
      // Network back while opened offline: refresh now (success → TOKEN_REFRESHED, invalid → SIGNED_OUT).
      if (online && _offline) unawaited((_env.refreshSession?.call() ?? Future.value()).catchError((Object _) {}));
    }));
    ref.onDispose(() {
      _mounted = false;
      _bootstrapTimer?.cancel();
      for (final sub in _subscriptions) {
        unawaited(sub.cancel());
      }
      _subscriptions.clear();
    });
    return const AuthViewState();
  }

  void _setState(AuthViewState next) {
    if (_mounted) state = next;
  }

  // Stable references: keep equal user/session/profile/role objects.
  void _applyUser(User? next) {
    if (!sameAuthUser(state.user, next)) _setState(state.copyWith(user: next));
  }

  void _applySession(Session? next) {
    if (!sameSession(state.session, next)) _setState(state.copyWith(session: next));
  }

  void _applyProfile(Profile? next) {
    final prev = state.profile;
    if (identical(prev, next) || (prev != null && next != null && prev.sameAs(next))) return;
    _setState(state.copyWith(profile: next));
  }

  void _applyRole(UserRole? next) {
    if ((state.userRole?.role) == (next?.role)) return;
    _setState(state.copyWith(userRole: next));
  }

  void _finishLoading() {
    if (!_mounted) return;
    _bootstrapTimer?.cancel();
    _bootstrapTimer = null;
    if (state.loading) _setState(state.copyWith(loading: false));
  }

  // ── Helpers ─────────────────────────────────────────────

  /// Strict: throws on network/server errors, so "no profile" (null) differs from "fetch failed".
  Future<Profile?> fetchProfileStrict(String userId) async {
    final data = await _client.from('profiles').select().eq('user_id', userId).maybeSingle();
    if (data == null) return null;
    final profile = Profile(data);
    _cache.writeCache(_profileCacheKey, userId, profile.row);
    return profile;
  }

  /// Offline/server error → last cached profile.
  Future<Profile?> fetchProfile(String userId) async {
    try {
      return await fetchProfileStrict(userId);
    } catch (error) {
      debugPrint('Error fetching profile');
      return _cachedProfile(userId);
    }
  }

  Profile? _cachedProfile(String userId) {
    final row = _cache.readCache<Map<String, dynamic>>(_profileCacheKey, userId);
    return row == null ? null : Profile(row);
  }

  UserRole? _cachedRole(String userId) => UserRole.fromJson(_cache.readCache<Map<String, dynamic>>(_roleCacheKey, userId));

  Future<UserRole?> fetchUserRole(String userId) async {
    try {
      final data = await _client.from('user_roles').select('role').eq('user_id', userId);
      if (data.isEmpty) return null;
      const priority = ['admin', 'moderator', 'user'];
      final roles = data.map((r) => r['role']).toSet();
      final highest = priority.where(roles.contains).firstOrNull;
      final role = highest == null ? null : UserRole(highest);
      if (role != null) _cache.writeCache(_roleCacheKey, userId, role.toJson());
      return role;
    } catch (_) {
      debugPrint('Error fetching user role');
      // Offline → cache (UI convenience; real permissions are in RLS).
      return _cachedRole(userId);
    }
  }

  static int? _dateMs(Object? value) {
    if (value == null || value == '') return null;
    if (value is DateTime) return value.millisecondsSinceEpoch;
    if (value is String && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
      return storedCalendarDate(value)?.millisecondsSinceEpoch;
    }
    return parseJsDate(value)?.millisecondsSinceEpoch;
  }

  static bool _sameDate(Object? a, Object? b) => _dateMs(a) == _dateMs(b);

  /// `syncProfileToStore(profile, userId)`.
  void syncProfileToStore(Profile? profile, [String? userId]) {
    final store = _store;
    if (profile == null) {
      store.setOnboarded(false);
      return;
    }
    final partnerCode = profile.partnerCode;
    if (partnerCode != null && partnerCode.isNotEmpty) store.setPartnerCode(partnerCode);
    // LMP / due date are always synced (null included): a cleared LMP must not come back.
    // New DateTime objects only when the value changed.
    var current = _storeState;
    if (!_sameDate(current.lastPeriodDate, profile.lastPeriodDate)) {
      store.setLastPeriodDate(profile.lastPeriodDate == null ? null : storedCalendarDate(profile.lastPeriodDate));
    }
    if (!_sameDate(current.dueDate, profile.dueDate)) {
      store.setDueDate(profile.dueDate == null ? null : storedCalendarDate(profile.dueDate));
    }
    final cycle = profile.cycleLength, period = profile.periodLength;
    if (cycle != null && cycle != 0) store.setCycleLength(cycle);
    if (period != null && period != 0) store.setPeriodLength(period);
    store.setLinkedPartnerId(profile.linkedPartnerId);

    // Keep the count/type pair coherent (also after logout reset the store to one child).
    final rawCount = profile.babyCount ?? 0;
    final babyCount = const [1, 2, 3, 4].contains(rawCount) ? rawCount : 1;
    const types = ['single', 'twins', 'triplets', 'quadruplets'];
    final multipleType = types[babyCount - 1];
    current = _storeState;
    if (current.babyCount != babyCount || current.multiplesType != multipleType) {
      store.setMultiplesData(babyCount, multipleType);
    }
    final birth = profile.babyBirthDate, name = profile.babyName, gender = profile.babyGender;
    if (birth != null && birth.isNotEmpty && name != null && name.isNotEmpty && gender != null && gender.isNotEmpty) {
      current = _storeState;
      if (!_sameDate(current.babyBirthDate, birth) ||
          current.babyName != name ||
          current.babyGender != gender ||
          current.babyCount != babyCount ||
          current.multiplesType != multipleType) {
        final date = storedCalendarDate(birth) ?? parseJsDate(birth);
        if (date != null) store.setBabyData(date, name, gender, babyCount, multipleType);
      }
    }
    store.setDeliveryType(profile.deliveryType);
    store.setRole(profile.lifeStage == 'partner' ? 'partner' : 'woman');
    final stage = profile.lifeStage;
    if (stage != null && stage.isNotEmpty) {
      store.setLifeStage(stage);
      store.setOnboarded(true);
    } else {
      store.setOnboarded(false);
    }
    if (userId != null) _env.effects.onProfileSynced?.call(userId, profile);
  }

  // ── Auth actions ────────────────────────────────────────

  /// `signUp(email, password, name, countryCode)`; metadata `{name, country_code, language}`.
  Future<AuthResult<AuthResponse>> signUp(String email, String password, String name, [String? countryCode]) async {
    try {
      final data = await _client.auth.signUp(
        email: email,
        password: password,
        emailRedirectTo: _env.appOrigin,
        data: {'name': name, 'country_code': countryCode, 'language': _storeState.language},
      );
      _env.effects.onSignUp?.call('email');
      return AuthResult(data: data);
    } catch (error) {
      debugPrint('Sign up error');
      return AuthResult(error: error);
    }
  }

  /// `signIn(email, password)` (`signInWithPassword`).
  Future<AuthResult<AuthResponse>> signIn(String email, String password) async {
    try {
      final data = await _client.auth.signInWithPassword(email: email, password: password);
      _env.effects.onLogin?.call('email');
      return AuthResult(data: data);
    } catch (error) {
      debugPrint('Sign in error');
      return AuthResult(error: error);
    }
  }

  /// Provider name written only while the profile still has the trigger's placeholder.
  Future<void> _applyProviderNameIfDefault(String? userId, String? providerName) async {
    final name = providerName?.trim();
    if (name == null || name.isEmpty || userId == null) return;
    try {
      await _client.from('profiles').update({'name': name}).eq('user_id', userId).eq('name', defaultPlaceholderName);
    } catch (_) {
      // not critical: onboarding's name step is the fallback
    }
  }

  /// Google: native picker + `signInWithIdToken`; cancel is silent; old Android → browser OAuth.
  Future<AuthResult<AuthResponse>> signInWithGoogle() async {
    final social = _env.social;
    try {
      if (social == null) throw StateError('Google sign-in is not available on this build');
      try {
        final credential = await social.pickGoogleAccount();
        if (credential.idToken.isEmpty) {
          throw GoogleNativePickerError(StateError('Google Sign-In returned no idToken'));
        }
        final data = await _client.auth.signInWithIdToken(provider: OAuthProvider.google, idToken: credential.idToken);
        await _applyProviderNameIfDefault(data.user?.id, credential.displayName);
        _env.effects.onLogin?.call('google');
        return AuthResult(data: data);
      } on GoogleNativePickerError catch (error) {
        final outcome = resolveGoogleNativeFailure(error, social.platform);
        if (outcome.report) _env.effects.reportAuthError?.call('google', error);
        switch (outcome.action) {
          case NativeFailureAction.silent:
            return const AuthResult();
          case NativeFailureAction.browser:
            // Old Android (no Credential Manager / Play Services, DEVELOPER_ERROR 10, 12500).
            await signInWithGoogleBrowserFallback();
            return const AuthResult();
          default:
            return AuthResult(error: outcome.error ?? error);
        }
      }
    } catch (error) {
      debugPrint('Google sign in error');
      _env.effects.reportAuthError?.call('google', error);
      return AuthResult(error: error);
    }
  }

  /// Google OAuth in the system browser; the session arrives through [completeNativeOAuthCallback].
  Future<void> signInWithGoogleBrowserFallback() async {
    final social = _env.social;
    if (social == null) throw StateError('No browser available');
    final response = await _client.auth.getOAuthSignInUrl(
      provider: OAuthProvider.google,
      redirectTo: nativeOAuthRedirect,
      queryParams: {'prompt': 'select_account'},
    );
    if (response.url.isEmpty) throw StateError('Google OAuth URL unavailable');
    await social.openBrowser(Uri.parse(response.url));
  }

  /// Deep link `com.atlasoon.anacan://auth-callback…` (wired by the shell's link handler).
  /// Returns true when a session was stored.
  Future<bool> completeNativeOAuthCallback(String url) async {
    if (!isNativeOAuthCallback(url)) return false;
    final callback = parseNativeOAuthCallback(url);
    try {
      await _env.social?.closeBrowser();
    } catch (_) {
      // system browser or already closed
    }
    try {
      final access = callback.accessToken, refresh = callback.refreshToken, code = callback.code;
      if (access != null && refresh != null) {
        await _client.auth.setSession(refresh, accessToken: access);
        return true;
      }
      if (code != null) {
        await _client.auth.exchangeCodeForSession(code);
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  /// Apple: native on iOS (nonce, `signInWithIdToken`); other platforms use the OAuth page.
  Future<AuthResult<AuthResponse>> signInWithApple() async {
    final social = _env.social;
    try {
      if (social != null && social.platform == 'ios') {
        final rawNonce = generateNonce();
        final AppleCredential credential;
        try {
          credential = await social.authorizeApple(hashedNonce: sha256Hex(rawNonce));
        } catch (error) {
          // ASAuthorizationError 1001 (sheet closed) = silent; 1000 = clear message, never the raw code.
          final outcome = resolveAppleNativeFailure(error);
          if (outcome.action == NativeFailureAction.rethrow_) rethrow;
          if (outcome.report) _env.effects.reportAuthError?.call('apple', error);
          return AuthResult(error: outcome.action == NativeFailureAction.error ? outcome.error : null);
        }
        if (credential.identityToken.isEmpty) throw StateError('Apple Sign-In returned no identityToken');
        final data = await _client.auth.signInWithIdToken(
          provider: OAuthProvider.apple,
          idToken: credential.identityToken,
          nonce: rawNonce,
        );
        await _applyProviderNameIfDefault(data.user?.id, appleFullName(credential));
        _env.effects.onLogin?.call('apple');
        return AuthResult(data: data);
      }
      final response = await _client.auth.getOAuthSignInUrl(provider: OAuthProvider.apple, redirectTo: _env.appOrigin);
      if (social == null) throw StateError('No browser available');
      await social.openBrowser(Uri.parse(response.url));
      return const AuthResult();
    } catch (error) {
      debugPrint('Apple sign in error');
      _env.effects.reportAuthError?.call('apple', error);
      return AuthResult(error: error);
    }
  }

  /// AuthScreen "forgot password": `resetPasswordForEmail(email, {redirectTo: origin/reset-password})`.
  Future<AuthResult<void>> resetPassword(String email) async {
    try {
      await _client.auth.resetPasswordForEmail(email, redirectTo: '${_env.appOrigin}/reset-password');
      return const AuthResult();
    } catch (error) {
      return AuthResult(error: error);
    }
  }

  /// ResetPassword page: `updateUser({password})`.
  Future<AuthResult<UserResponse>> updatePassword(String password) async {
    try {
      return AuthResult(data: await _client.auth.updateUser(UserAttributes(password: password)));
    } catch (error) {
      return AuthResult(error: error);
    }
  }

  void _clearLocalState() {
    _offline = false;
    _hydrated = null;
    _setState(state.copyWith(user: null, session: null, profile: null, userRole: null));
    _store.logout();
    try {
      ref.read(queryClientProvider).clear();
    } catch (_) {
      // in-memory only
    }
    _cache.clearAllCaches(); // offline "last state" caches too
    _env.effects.onLoggedOut?.call();
  }

  /// `signOut()`: bounded privacy cleanup while the session exists → SDK sign-out (tombstone first)
  /// → always clear local state, stores and caches. The outbox stays (keyed by user id).
  Future<AuthResult<void>> signOut() async {
    try {
      await runLogoutCleanup(state.user?.id ?? _storeState.userId, _env.logoutCleanup,
          isNativePlatform: _env.isNativePlatform);
    } catch (_) {
      // best effort
    }
    try {
      await _env.signOutSdk();
    } on AuthSessionMissingException {
      // session already gone
    } catch (_) {
      debugPrint('Sign out error');
    } finally {
      _clearLocalState();
    }
    return const AuthResult();
  }

  /// Settings / Privacy "delete account": `functions.invoke('delete-user-account')` with the bearer
  /// token, then sign out. Error when there is no session (`settingsscreen_sessiya_tapilmadi_2d6594`).
  Future<AuthResult<void>> deleteAccount() async {
    final session = _env.currentSession();
    if (session == null) {
      return AuthResult(error: StateError(tr('settingsscreen_sessiya_tapilmadi_2d6594', 'Sessiya tapılmadı')));
    }
    try {
      await _client.functions.invoke('delete-user-account', headers: {'Authorization': 'Bearer ${session.accessToken}'});
    } catch (error) {
      debugPrint('Delete account error');
      return AuthResult(error: error);
    }
    await signOut();
    return const AuthResult();
  }

  /// `updateProfile(updates)`: update by user_id; creates the row when the signup trigger did not.
  Future<AuthResult<Profile>> updateProfile(Map<String, dynamic> updates) async {
    final user = state.user;
    if (user == null) return const AuthResult(error: 'No user logged in');
    try {
      final rows = await _client.from('profiles').update(updates).eq('user_id', user.id).select();
      Map<String, dynamic>? row = rows.isEmpty ? null : rows.first;
      if (row == null) {
        final inserted = await _client.from('profiles').insert({'user_id': user.id, 'email': user.email, ...updates}).select();
        row = inserted.isEmpty ? null : inserted.first;
      }
      if (row == null) throw StateError('Profile row could not be created');
      final profile = Profile(row);
      _setState(state.copyWith(profile: profile));
      _cache.writeCache(_profileCacheKey, user.id, profile.row);
      syncProfileToStore(profile, user.id);
      return AuthResult(data: profile);
    } catch (error) {
      debugPrint('Error updating profile');
      return AuthResult(error: error);
    }
  }

  /// `linkPartner(code)`: code-only RPC; a server-confirmed one-sided legacy link is cleared once.
  Future<AuthResult<void>> linkPartner(String partnerCode) async {
    final user = state.user;
    if (user == null) return const AuthResult(error: 'No user logged in');
    try {
      final partner = _partner;
      try {
        await partner.linkPartnerByCode(partnerCode);
      } catch (error) {
        final linked = state.profile?.linkedPartnerId;
        if (!(error is PartnerLinkError &&
            error.code == 'PAIRING_CONFLICT' &&
            linked != null &&
            linked.isNotEmpty &&
            await partner.clearStaleOneSidedLink(user.id))) {
          rethrow;
        }
        await partner.linkPartnerByCode(partnerCode);
      }
      final profile = await fetchProfileStrict(user.id);
      if (profile == null) throw StateError('Profile could not be refreshed after pairing');
      _setState(state.copyWith(profile: profile));
      syncProfileToStore(profile, user.id);
      return const AuthResult();
    } catch (error) {
      debugPrint('Link partner error');
      return AuthResult(error: error);
    }
  }

  /// Rotated invitation code to share (`getPartnerCodeForSharing`).
  Future<String> partnerCodeForSharing(String currentCode) => _partner.getPartnerCodeForSharing(currentCode);

  /// `refreshProfile()`: a null (offline, no cache) answer keeps the current state.
  Future<void> refreshProfile() async {
    final user = state.user;
    if (user == null) return;
    final results = await Future.wait<Object?>([fetchProfile(user.id), fetchUserRole(user.id)]);
    final profile = results[0] as Profile?, role = results[1] as UserRole?;
    if (profile != null) {
      _applyProfile(profile);
      syncProfileToStore(profile, user.id);
    }
    if (role != null) _applyRole(role);
  }

  // ── Init & listener ─────────────────────────────────────

  static Future<({Object? value, Object? error})> _settle(Future<Object?> future) =>
      future.then((value) => (value: value, error: null), onError: (Object e) => (value: null, error: e));

  Future<void> _upsertLanguage(String userId, String language) async {
    try {
      await _client.from('user_preferences').upsert({'user_id': userId, 'language': language}, onConflict: 'user_id');
    } catch (_) {
      debugPrint('user_preferences upsert failed');
    }
  }

  Future<void> _hydrateUser(User u) async {
    try {
      final results = await Future.wait([
        _settle(fetchProfileStrict(u.id)),
        _settle(fetchUserRole(u.id)),
        _settle(_client.from('user_preferences').select('language').eq('user_id', u.id).maybeSingle()),
      ]);
      if (!_mounted) return;
      // Server answer vs network error: null = no profile (new user); error = offline → cache.
      final profileFailed = results[0].error != null;
      final profile = profileFailed ? _cachedProfile(u.id) : results[0].value as Profile?;
      if (profileFailed) debugPrint('Profile fetch failed — using cached profile: ${profile != null}');
      final role = results[1].error == null ? results[1].value as UserRole? : _cachedRole(u.id);
      final prefs = results[2].error == null ? results[2].value as Map<String, dynamic>? : null;
      final created = parseJsDate(u.createdAt)?.millisecondsSinceEpoch ?? 0;
      final lastSignIn = parseJsDate(u.lastSignInAt)?.millisecondsSinceEpoch ?? created;
      final isFirstLogin = (lastSignIn - created).abs() < 60000;
      final localLang = _storeState.language;
      final localHasSelected = _storeState.hasSelectedLanguage;
      final serverLang = prefs?['language'] as String?;
      if (isFirstLogin) {
        // New account: push the local choice over the trigger's default 'az'.
        unawaited(_upsertLanguage(u.id, localLang));
      } else if (localHasSelected && localLang.isNotEmpty) {
        // An explicit choice on this device wins; the server copy only follows (push language).
        if (serverLang != localLang) unawaited(_upsertLanguage(u.id, localLang));
      } else if (serverLang != null && serverLang.isNotEmpty) {
        _store.setLanguage(serverLang);
        _store.setHasSelectedLanguage(true);
      } else {
        unawaited(_upsertLanguage(u.id, localLang));
      }
      final tz = _env.effects.syncUserTimeZone;
      if (tz != null) unawaited(tz(u.id).catchError((Object _) {}));
      _applyProfile(profile);
      _applyRole(role);
      _store.setAuth(
        true,
        u.id,
        u.email ?? '',
        _or(profile?.name, _or(u.userMetadata?['name'] as String?, _defaultName())),
      );
      if (profile != null) {
        syncProfileToStore(profile, u.id);
      } else if (!profileFailed) {
        syncProfileToStore(null, u.id); // the server said: no profile → onboarding
      }
      // profileFailed && no cache: keep the persisted store state (offline-first).
    } catch (_) {
      debugPrint('Error hydrating user');
    } finally {
      if (_mounted) _setState(state.copyWith(profileLoaded: true));
    }
  }

  /// Same account came back (resume): re-read profile/role only, no prefs upsert.
  Future<void> _refreshSameUser(User u) async {
    try {
      final results = await Future.wait([_settle(fetchProfileStrict(u.id)), _settle(fetchUserRole(u.id))]);
      if (!_mounted || state.user?.id != u.id) return;
      final profile = results[0].value as Profile?;
      if (results[0].error == null && profile != null && !profile.sameAs(state.profile)) {
        _applyProfile(profile);
        syncProfileToStore(profile, u.id);
      }
      final role = results[1].value as UserRole?;
      if (results[1].error == null && role != null) _applyRole(role);
    } catch (_) {
      // keep current state
    }
  }

  void _beginHydration(User u) {
    _hydrated = (userId: u.id, at: _env.now());
    unawaited(_hydrateUser(u));
  }

  /// Read-only open on the stored account: cached profile/role, no network, no logout.
  void _restoreOfflineSession(StoredSession stored) {
    if (!_mounted) return;
    final u = User.fromJson(Map<String, dynamic>.from(stored.raw['user'] as Map));
    if (u == null) return;
    final already = _offline && state.user?.id == u.id;
    _offline = true;
    if (already) {
      _finishLoading();
      return;
    }
    // at: 0 → the first real session triggers a fresh server read.
    _hydrated = (userId: u.id, at: 0);
    final raw = stored.raw;
    _applySession(Session(
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      tokenType: raw['token_type'] is String ? raw['token_type'] as String : 'bearer',
      expiresIn: raw['expires_in'] is num ? (raw['expires_in'] as num).toInt() : null,
      user: u,
    ));
    _applyUser(u);
    _store.setAuth(true, u.id, u.email ?? '', _or(u.userMetadata?['name'] as String?, _defaultName()));
    final cachedProfile = _cachedProfile(u.id), cachedRole = _cachedRole(u.id);
    if (cachedProfile != null) {
      _applyProfile(cachedProfile);
      syncProfileToStore(cachedProfile, u.id);
    }
    if (cachedRole != null) _applyRole(cachedRole);
    _setState(state.copyWith(profileLoaded: true));
    _finishLoading();
  }

  /// The token was refreshed after an offline open: full server read, then send queued writes.
  bool _leaveOfflineSession(User u) {
    if (!_offline) return false;
    _offline = false;
    _beginHydration(u);
    unawaited(ref.read(offlineOutboxProvider).flush(u.id).then((_) {}, onError: (Object _) {}));
    return true;
  }

  bool get isOfflineSession => _offline;

  Future<void> _onAuthEvent(AuthChangeEvent event, Session? session) async {
    if (!_mounted) return;

    if (event == AuthChangeEvent.signedOut) {
      _clearLocalState();
      _setState(state.copyWith(profileLoaded: false));
      _finishLoading();
      return;
    }

    if (event == AuthChangeEvent.initialSession) {
      _initialHandled = true;
      var current = session;
      // Subscribed after startup: the restore may have stored a session since INITIAL_SESSION.
      current ??= _env.currentSession();
      if (current == null) {
        // Auth keeps the stored session only when the refresh failed for a network reason.
        final stored = await _env.readPersistedSession?.call();
        if (!_mounted) return;
        if (stored != null) {
          _restoreOfflineSession(stored);
          return;
        }
        _store.logout();
        _finishLoading();
        return;
      }
      final u = current.user;
      _offline = false;
      _applySession(current);
      _applyUser(u);
      _store.setAuth(true, u.id, u.email ?? '', _or(u.userMetadata?['name'] as String?, _defaultName()));
      _finishLoading();
      _env.effects.onSignedIn?.call(u.id);
      _beginHydration(u);
      return;
    }

    if (event == AuthChangeEvent.signedIn) {
      if (session == null) return;
      final u = session.user;
      final hydrated = _hydrated;
      if (_offline && hydrated?.userId == u.id) {
        _applySession(session);
        _applyUser(u);
        _finishLoading();
        _leaveOfflineSession(u);
        return;
      }
      if (hydrated?.userId == u.id) {
        // Same account (resume / duplicate after INITIAL_SESSION): keep references, light refresh.
        _applySession(session);
        _applyUser(u);
        _finishLoading();
        if (_env.now() - hydrated!.at >= sameUserRehydrate.inMilliseconds) {
          _hydrated = (userId: u.id, at: _env.now());
          unawaited(_refreshSameUser(u));
        }
        return;
      }
      _applySession(session);
      _applyUser(u);
      _store.setAuth(true, u.id, u.email ?? '', _or(u.userMetadata?['name'] as String?, _defaultName()));
      _finishLoading();
      _beginHydration(u);
      return;
    }

    if (event == AuthChangeEvent.tokenRefreshed) {
      if (session != null) {
        // Silent update; the user keeps its reference unless a field changed.
        _applySession(session);
        _applyUser(session.user);
        _leaveOfflineSession(session.user);
      }
      // No storeLogout on a refresh without session: it may still be recoverable.
      return;
    }

    // USER_UPDATED and other events.
    if (session != null) {
      _applySession(session);
      _applyUser(session.user);
      _finishLoading();
      _beginHydration(session.user);
    }
  }

  /// True once INITIAL_SESSION was handled.
  bool get initialHandled => _initialHandled;
}

/// LocalStore key of the e-mail gate cache, re-exported for the Index port.
String emailVerifiedKey(String userId) => 'anacan_email_verified_v1:$userId';

/// Whether this device already knows the e-mail of [userId] is verified (`anacan_email_verified_v1`).
final emailVerifiedCachedProvider = Provider.family<bool, String>(
  (ref, userId) => ref.watch(localStoreProvider).getItem(emailVerifiedKey(userId)) == '1',
);
