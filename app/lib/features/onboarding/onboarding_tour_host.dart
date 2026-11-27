// Ported from: src/components/onboarding/OnboardingTourHost.tsx, src/pages/Index.tsx (tourNavigate wiring)
//
// Decides whether this user gets the in-app onboarding tour and runs it. Switch: app_settings.inapp_onboarding
// ('on'/'off'). Progress: profiles.onboarding_journey (+ localStorage `anacan_tour_v1_<uid>`), recorded at the
// start, so an interrupted tour is never shown again on any device. The tour waits for every first-run sheet
// to close (privacy consent decided, nothing blocking), a known entitlement, the tool list and the push state.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/data/data.dart' show dbProvider;
import '../../native/purchases/purchases.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../../shell/nav/shell_state.dart' as shell;
import '../../state/persisted_store.dart';
import '../../state/user_store.dart';
import 'glass_tour.dart';
import 'onboarding_journey.dart' show onboardingNativeProvider;
import 'onboarding_ports.dart';
import 'onboarding_tour.dart';

/// A tool row as the Tools page sees it (`useToolConfigs(stage)` minus `useDisabledTools`).
class TourToolConfig {
  const TourToolConfig({required this.toolId, required this.name, this.description, this.isPremium, this.flowLocked = false, this.bumpLocked = false, this.mommyLocked = false});
  final String toolId;

  /// `display_name || name`.
  final String name;
  final String? description;
  final bool? isPremium;
  final bool flowLocked;
  final bool bumpLocked;
  final bool mommyLocked;
}

/// The Tools hub feature overrides this with its tool configs of [stage] (disabled tools removed); null while
/// loading. Until then the tour does not start.
final tourToolConfigsProvider = Provider.family<List<TourToolConfig>?, String>((ref, stage) => null);

/// Something else owns the screen (lock offer / lock setup / feedback / blog article): the tour waits.
final tourBlockedProvider = Provider<bool>((ref) => false);

/// `usePrivacyConsent().decidedAt !== null`. The consent feature overrides it; until then the tour waits.
final tourConsentDecidedProvider = Provider<bool>((ref) => false);

/// Tour running (Index `tourActive`: the lock offer and the auto feedback wait).
final tourRunningProvider = NotifierProvider<_TourRunning, bool>(_TourRunning.new);

class _TourRunning extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool value) => state = value;
}

String tourLocalKey(String uid) => 'anacan_tour_v${tourVersion}_$uid';

class OnboardingTourHost extends ConsumerStatefulWidget {
  const OnboardingTourHost({super.key});
  @override
  ConsumerState<OnboardingTourHost> createState() => _OnboardingTourHostState();
}

class _OnboardingTourHostState extends ConsumerState<OnboardingTourHost> {
  String? _push;
  bool _running = false, _closed = false, _started = false, _previewRunning = false;
  List<TourStep> _plan = const [];
  bool? _preview = tourPreviewRequests.take();
  Timer? _startTimer;
  OverlayEntry? _entry;
  Widget? _tour;
  bool _readingPush = false;

  @override
  void initState() {
    super.initState();
    tourPreviewRequests.listen((premium) {
      if (!mounted) return;
      tourPreviewRequests.take();
      setState(() {
        _running = false;
        _previewRunning = false;
        _plan = const [];
        _preview = premium;
      });
    });
  }

  @override
  void dispose() {
    tourPreviewRequests.listen(null);
    _startTimer?.cancel();
    _removeEntry();
    super.dispose();
  }

  void _removeEntry() {
    _entry?.remove();
    _entry = null;
  }

  String? _readLocal(String uid) {
    try {
      return ref.read(localStoreProvider).getItem(tourLocalKey(uid));
    } catch (_) {
      return null;
    }
  }

  void _writeLocal(String uid, String value) {
    try {
      ref.read(localStoreProvider).setItem(tourLocalKey(uid), value);
    } catch (_) {}
  }

  Future<void> _readPush() async {
    if (_readingPush) return;
    _readingPush = true;
    String push;
    if (!ref.read(onboardingNativeProvider)) {
      push = 'unsupported';
    } else {
      try {
        final p = await ref.read(notificationPermissionProvider).check();
        push = p == 'granted' ? 'granted' : (p == 'prompt' || p == 'prompt-with-rationale') ? 'prompt' : 'denied';
      } catch (_) {
        push = 'unsupported';
      }
    }
    if (mounted) setState(() => _push = push);
  }

  void _setRunning(bool value) {
    _running = value;
    ref.read(tourRunningProvider.notifier).set(value);
  }

  void _navigate(TourNav nav) {
    final tab = ShellTab.values.where((t) => t.id == nav.tab).firstOrNull ?? ShellTab.home;
    ref.read(shellProvider.notifier).tourNavigate(shell.TourNav(tab: tab, tool: nav.tool));
  }

  void _journey(String uid, Map<String, Object?> value) {
    unawaited(ref.read(dbProvider).query(() => ref.read(dbProvider).from('profiles').update({'onboarding_journey': value}).eq('user_id', uid)));
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final sub = ref.watch(subscriptionProvider);
    final setting = ref.watch(appSettingProvider('inapp_onboarding'));
    final since = ref.watch(appSettingProvider('inapp_onboarding_since'));
    final store = ref.watch(userStoreProvider);
    final consentDecided = ref.watch(tourConsentDecidedProvider);
    final blocked = ref.watch(tourBlockedProvider);
    final lifeStage = store.lifeStage;
    final stage = lifeStage == 'mommy' || lifeStage == 'bump' || lifeStage == 'flow' ? lifeStage : null;
    final configs = stage == null ? null : ref.watch(tourToolConfigsProvider(stage));
    final uid = user?.id ?? '';
    final journey = profile?.row['onboarding_journey'];
    final eligible = uid.isNotEmpty &&
        !_closed &&
        _readLocal(uid) == null &&
        isTourEligible(
          setting: setting,
          since: since,
          accountCreatedAt: user?.createdAt,
          journey: journey,
          role: store.role,
          lifeStage: lifeStage,
          lossRecoveryActive: profile?.lossRecoveryActive,
          onboarded: store.isOnboarded,
        );
    if ((eligible || _preview != null) && _push == null) WidgetsBinding.instance.addPostFrameCallback((_) => _readPush());
    final tourPremium = _preview ?? sub.isPremium;
    final tools = <TourTool>[
      for (final c in configs ?? const <TourToolConfig>[])
        TourTool(
          id: c.toolId,
          name: c.name,
          description: c.description,
          open: isToolOpenForUser(
            toolId: c.toolId,
            isPremiumFlag: c.isPremium,
            stageLocked: stage == 'flow' ? c.flowLocked : stage == 'bump' ? c.bumpLocked : c.mommyLocked,
            isPremium: tourPremium,
          ),
        ),
    ];
    final ready = _preview == null && eligible && !blocked && consentDecided && stage != null && configs != null && _push != null && !sub.loading && sub.entitlementReady;
    if (ready && !_started && _startTimer == null) {
      _startTimer = Timer(const Duration(milliseconds: 1200), () {
        _startTimer = null;
        if (!mounted || _started) return;
        _started = true;
        _writeLocal(uid, 'started');
        _journey(uid, {'version': tourVersion, 'status': 'started', 'at': DateTime.now().toUtc().toIso8601String()});
        setState(() {
          _plan = buildTourPlan(stage: stage, isPremium: sub.isPremium, push: _push!, tools: tools);
          _setRunning(true);
        });
      });
    } else if (!ready && _startTimer != null && !_started) {
      _startTimer!.cancel();
      _startTimer = null;
    }
    if (_preview != null && !_previewRunning && !blocked && stage != null && configs != null && _push != null && _startTimer == null) {
      final premium = _preview!;
      _startTimer = Timer(const Duration(milliseconds: 600), () {
        _startTimer = null;
        if (!mounted) return;
        setState(() {
          _plan = buildTourPlan(stage: stage, isPremium: premium, push: _push!, tools: tools);
          _previewRunning = true;
          _setRunning(true);
        });
      });
    }

    final show = _running && _plan.isNotEmpty && stage != null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!show) {
        _removeEntry();
        return;
      }
      final freeLimits = sub.freeLimits['ai_chat_count_per_day'];
      final aiFreePerDay = freeLimits is num && freeLimits != 0 ? freeLimits.toInt() : 10;
      final tour = GlassTour(
        key: ValueKey(_preview != null ? 'preview-$_preview' : 'tour'),
        plan: _plan,
        name: profile?.name ?? '',
        stage: stage,
        isPremium: tourPremium,
        aiFreePerDay: aiFreePerDay,
        tools: tools,
        onNavigate: _navigate,
        onPush: () async {
          try {
            if (await ref.read(notificationPermissionProvider).request() == 'granted') ref.read(pushGrantedCallbackProvider)();
          } catch (_) {
            // plugin unavailable: nothing to ask
          }
        },
        onPremium: () => ref.read(shellProvider.notifier).openScreenId(ScreenId.billing),
        onFinish: (status, step) {
          if (_preview != null) {
            setState(() {
              _previewRunning = false;
              _preview = null;
              _plan = const [];
              _setRunning(false);
            });
            _navigate(const TourNav(tab: 'home'));
            return;
          }
          _writeLocal(uid, status);
          setState(() {
            _closed = true;
            _setRunning(false);
          });
          _journey(uid, {'version': tourVersion, 'status': status, 'step': step, 'at': DateTime.now().toUtc().toIso8601String()});
          _navigate(const TourNav(tab: 'home'));
        },
      );
      _tour = tour;
      if (_entry == null) {
        _entry = OverlayEntry(builder: (_) => _tour ?? const SizedBox.shrink());
        Overlay.of(context, rootOverlay: true).insert(_entry!);
      } else {
        _entry!.markNeedsBuild();
      }
    });
    return const SizedBox.shrink();
  }
}
