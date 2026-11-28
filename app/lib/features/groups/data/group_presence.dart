// Ported from: src/hooks/useGroupPresence.ts
//
// Who is online in a group and who is typing, over the realtime presence channel `group_presence:<groupId>`
// (shared by every member, so no random suffix), keyed by the user id. Typing stops by itself after 3 s.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show RealtimeChannel, RealtimeChannelConfig, RealtimeSubscribeStatus, SupabaseClient;

import '../../../core/data/data.dart';
import '../../../core/i18n/i18n.dart';
import '../../../domain/js_compat.dart' show jsToIsoString;
import '../../community/data/community_backend.dart' show communityBackendProvider, getPublicProfileCard;

@immutable
class PresenceUser {
  const PresenceUser({required this.id, required this.name, this.avatarUrl});
  final String id;
  final String name;
  final String? avatarUrl;
}

/// `{ onlineCount, onlineUsers, typingUsers }`.
@immutable
class GroupPresenceState {
  const GroupPresenceState({this.onlineCount = 0, this.onlineUsers = const [], this.typingUsers = const []});
  final int onlineCount;
  final List<PresenceUser> onlineUsers;
  final List<PresenceUser> typingUsers;
}

/// One presence entry (`presenceState()[key][0]`).
typedef PresenceEntry = ({String key, Map<String, dynamic> payload});

/// An open presence channel.
abstract interface class GroupPresenceConnection {
  Future<void> track(Map<String, dynamic> payload);
  void close();
}

/// `supabase.channel(name, { config: { presence: { key } } }).on('presence', { event: 'sync' }, …).subscribe(…)`.
abstract interface class GroupPresenceTransport {
  GroupPresenceConnection open({
    required String channelName,
    required String key,
    required void Function(List<PresenceEntry> state) onSync,
    required void Function() onSubscribed,
  });
}

class SupabaseGroupPresenceTransport implements GroupPresenceTransport {
  SupabaseGroupPresenceTransport(this.client);
  final SupabaseClient client;

  @override
  GroupPresenceConnection open({
    required String channelName,
    required String key,
    required void Function(List<PresenceEntry> state) onSync,
    required void Function() onSubscribed,
  }) {
    final channel = client.channel(channelName, opts: RealtimeChannelConfig(key: key));
    channel.onPresenceSync((_) {
      onSync([
        for (final entry in channel.presenceState())
          if (entry.presences.isNotEmpty) (key: entry.key, payload: Map<String, dynamic>.from(entry.presences.first.payload)),
      ]);
    });
    channel.subscribe((status, _) {
      if (status == RealtimeSubscribeStatus.subscribed) onSubscribed();
    });
    return _SupabasePresenceConnection(client, channel);
  }
}

class _SupabasePresenceConnection implements GroupPresenceConnection {
  _SupabasePresenceConnection(this.client, this.channel);
  final SupabaseClient client;
  final RealtimeChannel channel;

  @override
  Future<void> track(Map<String, dynamic> payload) async {
    await channel.track(payload);
  }

  @override
  void close() => unawaited(client.removeChannel(channel).then((_) {}, onError: (Object _) {}));
}

final groupPresenceTransportProvider = Provider<GroupPresenceTransport>((ref) => SupabaseGroupPresenceTransport(ref.watch(dbProvider).client));

String _userFallback() => tr('usegrouppresence_i_stifadeci_b6bdd6', 'İstifadəçi');

class GroupPresence extends Notifier<GroupPresenceState> {
  GroupPresence(this.groupId);
  final String? groupId;

  GroupPresenceConnection? _connection;
  Timer? _typingTimeout;
  bool _isTyping = false;
  PresenceUser? _self;
  String? _selfId;

  @override
  GroupPresenceState build() {
    final id = groupId;
    if (id == null || id.isEmpty) return const GroupPresenceState();
    var cancelled = false;
    ref.onDispose(() {
      cancelled = true;
      _typingTimeout?.cancel();
      _typingTimeout = null;
      _isTyping = false;
      _self = null;
      _connection?.close();
      _connection = null;
    });
    final backend = ref.read(communityBackendProvider);
    final transport = ref.read(groupPresenceTransportProvider);
    unawaited(() async {
      final userId = await backend.getUserId();
      if (userId == null || cancelled) return;
      final profile = await getPublicProfileCard(backend, userId).then<Map<String, dynamic>?>((p) => p, onError: (Object _) => null);
      if (cancelled) return;
      final name = profile?['name'] is String && (profile!['name'] as String).isNotEmpty ? profile['name'] as String : _userFallback();
      final avatar = profile?['avatar_url'] as String?;
      _selfId = userId;
      _self = PresenceUser(id: userId, name: name, avatarUrl: avatar);
      late final GroupPresenceConnection connection;
      connection = transport.open(
        channelName: 'group_presence:$id',
        key: userId,
        onSync: (entries) {
          if (cancelled) return;
          final users = <PresenceUser>[];
          final typing = <PresenceUser>[];
          for (final entry in entries) {
            final presenceName = entry.payload['name'] is String && (entry.payload['name'] as String).isNotEmpty ? entry.payload['name'] as String : _userFallback();
            users.add(PresenceUser(id: entry.key, name: presenceName, avatarUrl: entry.payload['avatar_url'] as String?));
            if (entry.payload['isTyping'] == true && entry.key != userId) typing.add(PresenceUser(id: entry.key, name: presenceName));
          }
          state = GroupPresenceState(onlineCount: users.length, onlineUsers: users, typingUsers: typing);
        },
        onSubscribed: () {
          if (cancelled) return;
          unawaited(connection.track({'name': name, 'avatar_url': avatar, 'isTyping': false, 'online_at': jsToIsoString(DateTime.now())}));
        },
      );
      _connection = connection;
    }());
    return const GroupPresenceState();
  }

  Future<void> _setTyping(bool isTyping) async {
    final connection = _connection;
    if (connection == null || _isTyping == isTyping) return;
    _isTyping = isTyping;
    var self = _self;
    if (self == null) {
      final backend = ref.read(communityBackendProvider);
      final userId = await backend.getUserId();
      if (userId == null) return;
      final profile = await getPublicProfileCard(backend, userId);
      self = _self = PresenceUser(
        id: userId,
        name: profile?['name'] is String && (profile!['name'] as String).isNotEmpty ? profile['name'] as String : _userFallback(),
        avatarUrl: profile?['avatar_url'] as String?,
      );
    }
    if (_connection != connection) return;
    await connection.track({'name': self.name, 'avatar_url': self.avatarUrl, 'isTyping': isTyping, 'online_at': jsToIsoString(DateTime.now())});
    // Typing stops by itself after 3 s.
    if (isTyping) {
      _typingTimeout?.cancel();
      _typingTimeout = Timer(const Duration(seconds: 3), () => unawaited(_setTyping(false)));
    }
  }

  Future<void> startTyping() => _setTyping(true);
  Future<void> stopTyping() => _setTyping(false);

  /// The signed-in member's presence key (tests).
  @visibleForTesting
  String? get selfId => _selfId;
}

final groupPresenceProvider = NotifierProvider.autoDispose.family<GroupPresence, GroupPresenceState, String?>(GroupPresence.new);
