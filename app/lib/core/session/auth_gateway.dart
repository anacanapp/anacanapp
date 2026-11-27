// Ported from: src/lib/session-persistence.ts (the slice of supabase-js `auth` it uses).
//
// supabase-js returns `{ data, error }`; gotrue (Dart) throws. The gateway restores the
// `{ data, error }` shape so the persistence logic stays line-for-line comparable,
// and lets tests drive it without a network.

import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart' as supa;

/// The part of an SDK session the persistence logic reads.
class AuthSessionView {
  const AuthSessionView({this.accessToken, this.refreshToken, this.userId});

  final String? accessToken;
  final String? refreshToken;
  final String? userId;

  factory AuthSessionView.fromSession(supa.Session session) => AuthSessionView(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        userId: session.user.id,
      );

  @override
  String toString() => 'AuthSessionView(user: $userId)';
}

/// supabase-js `AuthChangeEvent` names the logic cares about.
enum AuthEventKind { initialSession, signedIn, signedOut, tokenRefreshed, userUpdated, other }

/// `{ data: { session }, error }`.
class AuthCallResult {
  const AuthCallResult({this.session, this.error});

  final AuthSessionView? session;
  final Object? error;
}

typedef AuthEventListener = void Function(AuthEventKind event, AuthSessionView? session);

abstract interface class SessionAuthGateway {
  Future<AuthCallResult> getSession();

  /// With a token: refresh grant for that token. Without: refresh the current session.
  Future<AuthCallResult> refreshSession([String? refreshToken]);

  /// Returns an unsubscribe function.
  void Function() onAuthStateChange(AuthEventListener listener);

  /// Local scope signs this device out; [others] keeps this session.
  Future<void> signOut({bool others = false});

  Future<void> stopAutoRefresh();
}

/// [SessionAuthGateway] over a real `GoTrueClient`.
class GoTrueSessionGateway implements SessionAuthGateway {
  GoTrueSessionGateway(this.auth);

  final supa.GoTrueClient auth;

  @override
  Future<AuthCallResult> getSession() async {
    try {
      final session = await auth.getSession();
      return AuthCallResult(session: session == null ? null : AuthSessionView.fromSession(session));
    } catch (error) {
      return AuthCallResult(error: error);
    }
  }

  @override
  Future<AuthCallResult> refreshSession([String? refreshToken]) async {
    try {
      final response = await auth.refreshSession(refreshToken);
      final session = response.session;
      return AuthCallResult(session: session == null ? null : AuthSessionView.fromSession(session));
    } catch (error) {
      return AuthCallResult(error: error);
    }
  }

  @override
  void Function() onAuthStateChange(AuthEventListener listener) {
    final subscription = auth.onAuthStateChange.listen(
      (state) => listener(
        mapAuthEvent(state.event),
        state.session == null ? null : AuthSessionView.fromSession(state.session!),
      ),
      // Network errors arrive as stream errors; they carry no session decision.
      onError: (Object _) {},
    );
    return () => unawaited(subscription.cancel());
  }

  @override
  Future<void> signOut({bool others = false}) =>
      auth.signOut(scope: others ? supa.SignOutScope.others : supa.SignOutScope.local);

  @override
  Future<void> stopAutoRefresh() async => auth.stopAutoRefresh();
}

AuthEventKind mapAuthEvent(supa.AuthChangeEvent event) => switch (event) {
      supa.AuthChangeEvent.initialSession => AuthEventKind.initialSession,
      supa.AuthChangeEvent.signedIn => AuthEventKind.signedIn,
      supa.AuthChangeEvent.signedOut => AuthEventKind.signedOut,
      supa.AuthChangeEvent.tokenRefreshed => AuthEventKind.tokenRefreshed,
      supa.AuthChangeEvent.userUpdated => AuthEventKind.userUpdated,
      _ => AuthEventKind.other,
    };
