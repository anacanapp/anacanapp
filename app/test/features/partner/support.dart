// Ported from: (test support) — the vi.mock setups of the partner tests: an in-memory PartnerBackend instead of the
// supabase client, a recording push sender, recorded haptics and the standard settings harness.
import 'dart:async';

import 'package:anacan/core/offline/offline_providers.dart' show appResumeEventsProvider;
import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/features/partner/data/partner_backend.dart';
import 'package:anacan/features/partner/data/sos_alert.dart' show sosLocationSharingProvider;
import 'package:anacan/features/partner/partner_ports.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart' show addTearDown;

import '../settings/support/harness.dart';

export '../settings/support/harness.dart';

typedef Row = Map<String, dynamic>;

/// One recorded backend call.
typedef Call = ({String op, String table, Object? payload});

/// An in-memory partner backend. Responses are set per table / RPC; writes are recorded in [calls].
class FakePartnerBackend implements PartnerBackend {
  final List<Call> calls = [];
  final Map<String, Object? Function(Map<String, dynamic>? params)> rpcs = {};
  final Map<String, String?> profileUserIds = {};
  final Map<String, Row?> womanProfiles = {};
  final Map<String, List<Row>> tables = {};
  final List<Row> sharingOfOthers = [];
  final List<Row> sos = [];
  final List<Row> babyLogs = [];
  final List<Row> appointments = [];
  final Map<String, int> sentCounts = {};

  /// Errors thrown for an `<op>:<table>` key (e.g. 'insert:partner_messages').
  final Map<String, Object> errors = {};

  /// Rows returned by insertReturning / upsertReturning per table (default: the payload + an id).
  final Map<String, Row Function(Row row)> returning = {};

  /// Realtime handlers by `table|filter`.
  final Map<String, List<void Function(PartnerChange change)>> handlers = {};

  int _id = 0;

  void _fail(String op, String table) {
    final e = errors['$op:$table'];
    if (e != null) throw e;
  }

  void emit(String table, String filter, PartnerChange change) {
    for (final h in [...?handlers['$table|$filter']]) {
      h(change);
    }
  }

  List<Call> callsOf(String op, [String? table]) => calls.where((c) => c.op == op && (table == null || c.table == table)).toList();

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) async {
    calls.add((op: 'rpc', table: fn, payload: params));
    _fail('rpc', fn);
    final r = rpcs[fn];
    return r == null ? null : r(params);
  }

  @override
  Future<String?> profileUserId(String profileId) async {
    calls.add((op: 'profileUserId', table: 'profiles', payload: profileId));
    return profileUserIds[profileId];
  }

  @override
  Future<Row?> womanProfile(String profileId) async {
    calls.add((op: 'womanProfile', table: 'profiles', payload: profileId));
    _fail('select', 'profiles');
    return womanProfiles[profileId];
  }

  @override
  Future<Row?> maybeSingle(String table, String columns, String column, String value) async {
    calls.add((op: 'maybeSingle', table: table, payload: {column: value, 'columns': columns}));
    _fail('select', table);
    if (table == 'profiles' && column == 'id') {
      final uid = profileUserIds[value];
      return uid == null ? null : {'user_id': uid};
    }
    return tables[table]?.where((r) => r[column] == value).firstOrNull;
  }

  @override
  Future<List<Row>> sharingSettingsOfOthers(String userId) async {
    _fail('select', 'partner_sharing_settings');
    return sharingOfOthers;
  }

  @override
  Future<void> upsert(String table, Row row, {required String onConflict}) async {
    calls.add((op: 'upsert', table: table, payload: row));
    _fail('upsert', table);
  }

  @override
  Future<Row> upsertReturning(String table, Row row, {required String onConflict}) async {
    calls.add((op: 'upsertReturning', table: table, payload: row));
    _fail('upsert', table);
    return returning[table]?.call(row) ?? {'id': 'row-${++_id}', ...row};
  }

  @override
  Future<Row> insertReturning(String table, Row row, {String columns = '*'}) async {
    calls.add((op: 'insertReturning', table: table, payload: row));
    _fail('insert', table);
    return returning[table]?.call(row) ?? {'id': 'row-${++_id}', ...row};
  }

  @override
  Future<void> insert(String table, Row row) async {
    calls.add((op: 'insert', table: table, payload: row));
    _fail('insert', table);
  }

  @override
  Future<void> update(String table, Row values, Map<String, Object> match) async {
    calls.add((op: 'update', table: table, payload: {...values, 'match': match}));
    _fail('update', table);
    if (table == 'sos_alerts') {
      for (final r in sos) {
        if (r['id'] == match['id']) r.addAll(values);
      }
    }
  }

  @override
  Future<void> delete(String table, Map<String, Object> match) async {
    calls.add((op: 'delete', table: table, payload: match));
    _fail('delete', table);
  }

  @override
  Future<List<Row>> select(String table, {String columns = '*', Map<String, Object> eq = const {}, String? orderBy, bool ascending = true, int? limit}) async {
    calls.add((op: 'select', table: table, payload: eq));
    _fail('select', table);
    return [
      for (final r in tables[table] ?? const <Row>[])
        if (eq.entries.every((e) => r[e.key] == e.value)) r,
    ];
  }

  @override
  Future<List<Row>> sosAlerts(String userId) async {
    calls.add((op: 'sosAlerts', table: 'sos_alerts', payload: userId));
    return [...sos];
  }

  @override
  Future<List<Row>> rangeRows(String table, String columns, String userId, String column, String from, String to) async {
    calls.add((op: 'range', table: table, payload: [from, to]));
    return tables[table] ?? const [];
  }

  @override
  Future<List<Row>> babyLogsSince(String userId, String fromIso) async => [...babyLogs];

  @override
  Future<List<Row>> nextAppointment(String userId, String today) async => appointments.take(1).toList();

  @override
  Future<int> countSentMessages(String userId, List<String> types) async => sentCounts[types.join(',')] ?? 0;

  @override
  Future<List<Row>> activeRows(String table, {String? extraColumn, Object? extraValue}) async => tables[table] ?? const [];

  @override
  void subscribe(Ref ref,
      {required String channelPrefix, required String table, String event = '*', String? filter, required void Function(PartnerChange change) onChange}) {
    final key = '$table|$filter';
    handlers.putIfAbsent(key, () => []).add(onChange);
    ref.onDispose(() => handlers[key]?.remove(onChange));
  }
}

/// Records `invokeSendPush` calls.
class FakePushSender implements ChatPushSender {
  final List<SendPushPayload> sent = [];
  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    sent.add(payload);
    return const SendPushResult(ok: true, sent: 1);
  }
}

/// Recorded haptics.
class FakeHaptics {
  final List<String> calls = [];
  PartnerHaptics get haptics => PartnerHaptics(
        light: () async => calls.add('light'),
        medium: () async => calls.add('medium'),
        heavy: () async => calls.add('heavy'),
      );
}

const String kUserId = '11111111-1111-4111-8111-111111111111';
const String kPartnerUserId = '22222222-2222-4222-8222-222222222222';
const String kLinkedProfileId = '33333333-3333-4333-8333-333333333333';

/// The standard overrides of the partner tests: signed in as [userId] with [linked] as linked_partner_id.
List<Override> partnerOverrides({
  required FakePartnerBackend backend,
  FakePushSender? push,
  FakeHaptics? haptics,
  String userId = kUserId,
  String? linked = kLinkedProfileId,
  String lifeStage = 'bump',
  String role = 'woman',
  Map<String, Object?> profile = const {},
  bool locationSharing = false,
  LocalStore? store,
  PartnerMessagesFeed feed = const PartnerMessagesFeed(),
  List<Override> extra = const [],
}) =>
    [
      ...baseOverrides(
        user: testUser(id: userId),
        profile: testProfile({'user_id': userId, 'linked_partner_id': linked, 'life_stage': lifeStage, ...profile}),
        store: store ?? seededStore(user: {'userId': userId, 'role': role, 'name': 'Elvin'}),
      ),
      partnerBackendProvider.overrideWithValue(backend),
      chatPushSenderProvider.overrideWithValue(push ?? FakePushSender()),
      partnerHapticsProvider.overrideWithValue((haptics ?? FakeHaptics()).haptics),
      sosLocationSharingProvider.overrideWithValue(locationSharing),
      appResumeEventsProvider.overrideWithValue(const Stream<void>.empty()),
      partnerMessagesFeedProvider.overrideWithValue(feed),
      ...extra,
    ];

/// A container with [overrides]; disposed at the end of the test.
ProviderContainer partnerContainer(List<Override> overrides) {
  final c = ProviderContainer(overrides: overrides);
  addTearDown(c.dispose);
  return c;
}

/// Lets microtasks / fake async work finish.
Future<void> settle() async {
  for (var i = 0; i < 10; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}
