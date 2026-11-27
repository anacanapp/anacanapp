// Ported from: src/contexts/AuthContext.tsx (Profile, UserRole, the `{data, error}` results)

import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart' show Session, User;

import '../data/row.dart';

/// A `profiles` row. Kept as the raw row (offline cache and `updateProfile` use the same JSON)
/// with typed getters for the columns the app reads.
class Profile {
  Profile(Map<String, dynamic> row) : row = Map.unmodifiable(row);

  final Map<String, dynamic> row;

  String get id => row.str('id') ?? '';
  String get userId => row.str('user_id') ?? '';
  String get name => row.str('name') ?? '';
  String? get email => row.str('email');

  /// 'flow' | 'bump' | 'mommy' | 'partner' | null.
  String? get lifeStage => row.str('life_stage');
  String? get partnerCode => row.str('partner_code');
  String? get linkedPartnerId => row.str('linked_partner_id');
  String? get avatarUrl => row.str('avatar_url');
  int? get cycleLength => row.integer('cycle_length');
  int? get periodLength => row.integer('period_length');
  String? get lastPeriodDate => row.str('last_period_date');
  String? get dueDate => row.str('due_date');
  String? get babyBirthDate => row.str('baby_birth_date');
  String? get babyName => row.str('baby_name');
  String? get babyGender => row.str('baby_gender');
  int? get babyCount => row.integer('baby_count');
  String? get multiplesType => row.str('multiples_type');
  String? get deliveryType => row.str('delivery_type');
  double? get startWeight => row.number('start_weight');
  bool? get isPremium => row.boolean('is_premium');
  String? get premiumUntil => row.str('premium_until');
  String? get badgeType => row.str('badge_type');
  String? get bio => row.str('bio');
  String? get countryCode => row.str('country_code');
  String? get pregnancyLossDate => row.str('pregnancy_loss_date');
  bool? get lossRecoveryActive => row.boolean('loss_recovery_active');
  bool? get lossSharePartner => row.boolean('loss_share_partner');
  Object? get onboardingAnswers => row['onboarding_answers'];
  String get createdAt => row.str('created_at') ?? '';
  String get updatedAt => row.str('updated_at') ?? '';

  Object? operator [](String key) => row[key];

  /// `JSON.stringify(a) === JSON.stringify(b)` (key order included).
  bool sameAs(Profile? other) => other != null && (identical(this, other) || jsonEncode(row) == jsonEncode(other.row));

  Map<String, dynamic> toJson() => row;
}

/// `user_roles.role` ('admin' | 'user' | 'moderator').
class UserRole {
  const UserRole(this.role);
  final String role;
  Map<String, Object?> toJson() => {'role': role};
  static UserRole? fromJson(Object? json) => json is Map && json['role'] is String ? UserRole(json['role'] as String) : null;
}

/// `{ data, error }` of the AuthContext actions.
class AuthResult<T> {
  const AuthResult({this.data, this.error});
  final T? data;
  final Object? error;
  bool get ok => error == null;
}

/// AuthContext value (minus the actions, which live on the controller).
class AuthViewState {
  const AuthViewState({
    this.user,
    this.session,
    this.profile,
    this.userRole,
    this.loading = true,
    this.profileLoaded = false,
  });

  final User? user;
  final Session? session;
  final Profile? profile;
  final UserRole? userRole;
  final bool loading;

  /// hydrateUser finished (profile read from DB/cache). Onboarding must not be decided before.
  final bool profileLoaded;

  bool get isAdmin => userRole?.role == 'admin';
  bool get isModerator => userRole?.role == 'moderator' || isAdmin;
  bool get isAuthenticated => user != null;

  AuthViewState copyWith({
    Object? user = _keep,
    Object? session = _keep,
    Object? profile = _keep,
    Object? userRole = _keep,
    bool? loading,
    bool? profileLoaded,
  }) =>
      AuthViewState(
        user: identical(user, _keep) ? this.user : user as User?,
        session: identical(session, _keep) ? this.session : session as Session?,
        profile: identical(profile, _keep) ? this.profile : profile as Profile?,
        userRole: identical(userRole, _keep) ? this.userRole : userRole as UserRole?,
        loading: loading ?? this.loading,
        profileLoaded: profileLoaded ?? this.profileLoaded,
      );
}

const Object _keep = Object();

String _json(Object? value) {
  try {
    return jsonEncode(value);
  } catch (_) {
    return '';
  }
}

/// Same account and no field the app reads changed: keep the previous object reference.
bool sameAuthUser(User? a, User? b) {
  if (identical(a, b)) return true;
  if (a == null || b == null) return false;
  return a.id == b.id &&
      a.email == b.email &&
      a.phone == b.phone &&
      a.role == b.role &&
      a.aud == b.aud &&
      a.createdAt == b.createdAt &&
      a.updatedAt == b.updatedAt &&
      a.lastSignInAt == b.lastSignInAt &&
      a.emailConfirmedAt == b.emailConfirmedAt &&
      a.phoneConfirmedAt == b.phoneConfirmedAt &&
      _json(a.userMetadata) == _json(b.userMetadata) &&
      _json(a.appMetadata) == _json(b.appMetadata) &&
      _json(a.identities?.map((i) => [i.id, i.provider]).toList()) ==
          _json(b.identities?.map((i) => [i.id, i.provider]).toList());
}

bool sameSession(Session? a, Session? b) =>
    identical(a, b) ||
    (a != null &&
        b != null &&
        a.accessToken == b.accessToken &&
        a.refreshToken == b.refreshToken &&
        a.expiresAt == b.expiresAt);
