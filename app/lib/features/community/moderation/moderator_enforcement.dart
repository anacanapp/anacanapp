// Ported from: src/components/moderation/ModeratorEnforcement.tsx (wrapped around the routed app in App.tsx)
//
// Account-bound one-time moderator warnings and the full-app restriction screen:
// - a pending warning is claimed (`claim_my_moderator_warning_v1`, a per-account claim id), shown once, and
//   acknowledged on close (`ack_my_moderator_warning_v1`); offline acknowledgements wait in LocalStore
//   `anacan-moderator-warning-acks-v1:<encodeURIComponent(backend:user)>` (ids + claims only, max 100) and are
//   retried before the next claim; the claim lease is renewed every 45 s / on resume while the popup shows;
// - `full` restrictions replace the whole app with the block screen (appeals = MyModerationDecisions, sign out),
//   and stop the white-noise player.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialType;
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/white_noise_store.dart' show whiteNoiseStoreProvider;
import '../../moderation/moderation_queries.dart';
import '../../moderation/moderator.dart';
import '../../moderation/my_moderation_decisions.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, shadTitle, shadDescription, Tw;
import '../data/community_env.dart';
import '../ui/community_widgets.dart';

final RegExp _uuid = RegExp(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$', caseSensitive: false);

/// `anacan-moderation-overlay` (`{ open }`): StoryViewer pauses while the warning popup is open.
class ModerationOverlayOpen extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool open) {
    if (state != open) state = open;
  }
}

final moderationOverlayOpenProvider = NotifierProvider<ModerationOverlayOpen, bool>(ModerationOverlayOpen.new);

/// `signOut()` of the block screen (replaceable in tests).
final moderatorSignOutProvider = Provider<Future<void> Function()>((ref) => () async {
      await ref.read(authControllerProvider.notifier).signOut();
    });

/// `encodeURIComponent`.
String encodeUriComponentJs(String value) => Uri.encodeComponent(value).replaceAll('%21', '!').replaceAll('%27', "'")
    .replaceAll('%28', '(').replaceAll('%29', ')').replaceAll('%2A', '*');

typedef _PendingAck = ({String id, String claim});

class ModeratorEnforcement extends ConsumerStatefulWidget {
  const ModeratorEnforcement({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<ModeratorEnforcement> createState() => _ModeratorEnforcementState();
}

class _ModeratorEnforcementState extends ConsumerState<ModeratorEnforcement> {
  ({String owner, Map<String, dynamic> data})? _warning;
  final Map<String, bool> _dismissed = {};
  bool _showDecisions = false;
  String? _claimOwner;
  String _claim = '';
  String? _runKey;
  int _runId = 0;
  String? _renewKey;
  Timer? _renewTimer;
  AppLifecycleListener? _lifecycle;
  bool _overlayReported = false;
  bool _stoppedAudio = false;

  @override
  void dispose() {
    _runId++;
    _stopRenew();
    if (_overlayReported) {
      final notifier = ref.read(moderationOverlayOpenProvider.notifier);
      scheduleMicrotask(() {
        try {
          notifier.set(false);
        } catch (_) {}
      });
    }
    super.dispose();
  }

  String get _backend => ref.read(communityBackendUrlProvider);

  List<_PendingAck> _readPending(String key) {
    try {
      final value = jsonDecode(ref.read(localStoreProvider).getItem(key) ?? '[]');
      if (value is! List) return const [];
      final list = [
        for (final x in value)
          if (x is Map && x['id'] is String && x['claim'] is String && _uuid.hasMatch(x['id'] as String) && _uuid.hasMatch(x['claim'] as String))
            (id: x['id'] as String, claim: x['claim'] as String),
      ];
      return list.length > 100 ? list.sublist(list.length - 100) : list;
    } catch (_) {
      return const [];
    }
  }

  void _writePending(String key, List<_PendingAck> list) {
    try {
      ref.read(localStoreProvider).setItem(key, jsonEncode([for (final e in list) {'id': e.id, 'claim': e.claim}]));
    } catch (_) {}
  }

  Map<String, dynamic>? _visible(String ownerKey) {
    final w = _warning;
    if (w == null || w.owner != ownerKey || _dismissed['$ownerKey:${w.data['id']}'] == true) return null;
    return w.data;
  }

  void _run({required String userId, required String ownerKey, required String ackKey, required Map<String, dynamic> status, required bool hasVisible}) {
    final id = ++_runId;
    final claim = _claim;
    final backend = ref.read(moderationBackendProvider);
    Future<void> run() async {
      for (final item in _readPending(ackKey).take(10)) {
        if (id != _runId) return;
        try {
          final data = await backend.rpc('ack_my_moderator_warning_v1', {'p_actor': userId, 'p_warning': item.id, 'p_claim': item.claim});
          if (data == true) _writePending(ackKey, [for (final v in _readPending(ackKey)) if (v.id != item.id) v]);
        } catch (_) {}
      }
      final pending = status['pending_warnings'];
      if (id != _runId || pending == null || pending == 0 || pending == false || hasVisible) return;
      final data = await backend.rpc('claim_my_moderator_warning_v1', {'p_actor': userId, 'p_claim': claim});
      if (id != _runId || !mounted || data is! Map) return;
      final warningId = data['id'];
      if (_readPending(ackKey).any((v) => v.id == warningId) || _dismissed['$ownerKey:$warningId'] == true) return;
      setState(() => _warning = (owner: ownerKey, data: Map<String, dynamic>.from(data)));
    }

    unawaited(run().catchError((Object _) {}));
  }

  void _stopRenew() {
    _renewTimer?.cancel();
    _renewTimer = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    _renewKey = null;
  }

  void _startRenew(String userId, String warningId) {
    final claim = _claim;
    var cancelled = false;
    Future<void> renew() async {
      final data = await ref.read(moderationBackendProvider).rpc('claim_my_moderator_warning_v1', {'p_actor': userId, 'p_claim': claim});
      // Another device may already have acknowledged this warning.
      if (!cancelled && mounted && (data is! Map || data['id'] != warningId)) setState(() => _warning = null);
    }

    void refresh() => unawaited(renew().catchError((Object _) {}));
    _renewTimer = Timer.periodic(const Duration(seconds: 45), (_) => refresh());
    try {
      _lifecycle = AppLifecycleListener(onResume: refresh);
    } catch (_) {}
    addDisposer(() => cancelled = true);
  }

  final List<void Function()> _disposers = [];
  void addDisposer(void Function() fn) => _disposers.add(fn);

  void _close(String userId, String ownerKey, String ackKey) {
    final visible = _visible(ownerKey);
    if (visible == null) return;
    final entry = (id: '${visible['id']}', claim: '${visible['claim_id']}');
    setState(() {
      _dismissed['$ownerKey:${entry.id}'] = true;
      _warning = null;
    });
    _writePending(ackKey, [...[for (final v in _readPending(ackKey)) if (v.id != entry.id) v], entry].reversed.take(100).toList().reversed.toList());
    final backend = ref.read(moderationBackendProvider);
    unawaited(() async {
      try {
        final data = await backend.rpc('ack_my_moderator_warning_v1', {'p_actor': userId, 'p_warning': entry.id, 'p_claim': entry.claim});
        if (data == true) {
          _writePending(ackKey, [for (final v in _readPending(ackKey)) if (v.id != entry.id) v]);
          if (mounted) unawaited(ref.read(myModerationStatusQuery.notifier).refetch());
        }
      } catch (_) {}
    }());
  }

  @override
  Widget build(BuildContext context) {
    final language = currentLanguage();
    final userId = ref.watch(authUserProvider)?.id;
    final status = ref.watch(myModerationStatusQuery).data;
    final ownerKey = '$_backend:${userId ?? ''}';
    final ackKey = 'anacan-moderator-warning-acks-v1:${encodeUriComponentJs(ownerKey)}';
    if (_claimOwner != ownerKey) {
      _claimOwner = ownerKey;
      _claim = ref.read(communityUuidProvider)();
    }
    final visible = _visible(ownerKey);

    // overlay event
    final open = visible != null;
    if (open != _overlayReported) {
      _overlayReported = open;
      final notifier = ref.read(moderationOverlayOpenProvider.notifier);
      scheduleMicrotask(() {
        try {
          notifier.set(open);
        } catch (_) {}
      });
    }

    // claim / pending acks effect
    if (userId != null && status != null) {
      final key = '$userId|$ownerKey|${identityHashCode(status)}|${visible?['id']}|${_dismissed.length}';
      if (key != _runKey) {
        _runKey = key;
        final hasVisible = visible != null;
        scheduleMicrotask(() {
          if (mounted) _run(userId: userId, ownerKey: ownerKey, ackKey: ackKey, status: status, hasVisible: hasVisible);
        });
      }
    } else if (_runKey != null) {
      _runKey = null;
      _runId++;
    }

    // lease renewal while the popup shows
    final renewKey = userId != null && visible != null ? '$ownerKey|$_claim|${visible['id']}' : null;
    if (renewKey != _renewKey) {
      for (final d in _disposers) {
        d();
      }
      _disposers.clear();
      _stopRenew();
      if (renewKey != null) {
        _renewKey = renewKey;
        _startRenew(userId!, '${visible!['id']}');
      }
    }

    // a resolved pending count clears the popup
    if (status != null && status['user_id'] == userId && status['pending_warnings'] == 0 && _warning != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _warning = null);
      });
    }

    final full = status?['full'] == true && status?['user_id'] == userId;
    if (full && !_stoppedAudio) {
      _stoppedAudio = true;
      scheduleMicrotask(() {
        try {
          ref.read(whiteNoiseStoreProvider.notifier).stop();
        } catch (_) {}
      });
    } else if (!full) {
      _stoppedAudio = false;
    }

    final body = full
        ? (_showDecisions
            ? MyModerationDecisions(onBack: () => setState(() => _showDecisions = false))
            : _FullBlock(status: status!, language: language, onAppeals: () => setState(() => _showDecisions = true)))
        : widget.child;
    if (visible == null) return body;
    return Stack(children: [
      body,
      Positioned.fill(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _close(userId!, ownerKey, ackKey),
          child: const ColoredBox(color: Color(0xCC000000)), // bg-black/80 overlay
        ),
      ),
      Center(
        child: SingleChildScrollView(
          child: Directionality(
            textDirection: textDirectionFor(language),
            child: Semantics(
              container: true,
              identifier: 'moderator-warning',
              child: KeyedSubtree(
                key: const ValueKey('moderator-warning'),
                child: ShadDialogFrame(maxWidth: 448, inset: 12, radius: 8, children: [
                  Row(children: [
                    const AIcon(AIcons.shieldAlert, size: 24, color: Color(0xFFD97706)), // text-amber-600
                    const SizedBox(width: 8),
                    Expanded(child: Text(moderatorText('warning_title', language), style: shadTitle(context))),
                    CommunityButton(
                      label: moderatorText('close', language),
                      onTap: () => _close(userId!, ownerKey, ackKey),
                      child: AIcon(AIcons.x, size: 16, color: context.tokens.shadcn.mutedForeground),
                    ),
                  ]),
                  Text(moderatorText('warning_body', language), style: shadDescription(context)),
                  Text(moderatorReason(visible['reason'] as String?, language), style: Tw.base.copyWith(fontWeight: FontWeight.w600)),
                  Text(moderatorReason(visible['reason'] as String?, language, true), style: Tw.sm.copyWith(height: 1.625)),
                  if ('${visible['detail'] ?? ''}'.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: context.tokens.shadcn.muted, borderRadius: BorderRadius.circular(12)),
                      child: Text('${visible['detail']}', style: Tw.sm),
                    ),
                  ShadButton(
                    height: 44,
                    expand: true,
                    onPressed: () => _close(userId!, ownerKey, ackKey),
                    child: Text(moderatorText('warning_close', language), textAlign: TextAlign.center),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _FullBlock extends ConsumerWidget {
  const _FullBlock({required this.status, required this.language, required this.onAppeals});
  final Map<String, dynamic> status;
  final String language;
  final VoidCallback onAppeals;

  String _expires(Object? value) {
    final date = value is String ? DateTime.tryParse(value) : null;
    if (date == null) return moderatorText('duration_permanent', language);
    try {
      return formatIntlDateTemplate(normalizeAppLanguage(language), 'dmyhm', date.toLocal());
    } catch (_) {
      return date.toLocal().toString();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final restrictions = [for (final r in (status['restrictions'] is List ? status['restrictions'] as List : const [])) if (r is Map && r['scope'] == 'full') r];
    return Material(
      type: MaterialType.transparency,
      child: KeyedSubtree(
        key: const ValueKey('moderator-full-block'),
        child: AScope(
          child: ColoredBox(
            color: context.a.bg,
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.ban, size: 48, color: context.tokens.shadcn.destructive),
                    const SizedBox(height: 20),
                    Text(moderatorText('restriction_notice', language), textAlign: TextAlign.center, style: px(20, weight: FontWeight.w700, color: context.a.ink)),
                    const SizedBox(height: 20),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 448),
                      child: Text(moderatorText('full_restricted', language),
                          textAlign: TextAlign.center, style: Tw.sm.copyWith(color: context.tokens.shadcn.mutedForeground)),
                    ),
                    const SizedBox(height: 20),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 448),
                      child: VGap(gap: 12, children: [
                        for (final r in restrictions)
                          ACard(
                            child: VGap(gap: 8, children: [
                              Text(moderatorReason(r['reason'] as String?, language), style: Tw.sm.copyWith(fontWeight: FontWeight.w600)),
                              if ('${r['detail'] ?? ''}'.isNotEmpty) Text('${r['detail']}', style: Tw.sm),
                              Text(_expires(r['expires_at']), style: Tw.sm.copyWith(color: context.tokens.shadcn.mutedForeground)),
                            ]),
                          ),
                      ]),
                    ),
                    const SizedBox(height: 20),
                    Wrap(alignment: WrapAlignment.center, spacing: 12, runSpacing: 12, children: [
                      ShadButton(
                        onPressed: onAppeals,
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          AIcon(AIcons.messageSquare, size: 16, color: context.tokens.shadcn.primaryForeground),
                          const SizedBox(width: 8),
                          Text(moderatorText('appeals', language)),
                        ]),
                      ),
                      ShadButton(
                        variant: ShadButtonVariant.outline,
                        onPressed: () => unawaited(ref.read(moderatorSignOutProvider)()),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const AIcon(AIcons.logOut, size: 16),
                          const SizedBox(width: 8),
                          Text(moderatorText('sign_out', language)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 20),
                    CommunityButton(
                      label: moderatorText('contact_support', language),
                      onTap: () => unawaited(launchUrl(Uri.parse('mailto:info@anacan.az')).then((_) {}, onError: (Object _) {})),
                      child: Text(moderatorText('contact_support', language),
                          style: Tw.sm.copyWith(color: context.tokens.shadcn.primary, decoration: TextDecoration.underline)),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
