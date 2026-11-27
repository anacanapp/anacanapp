// Ported from: src/components/ads/AdPreferencesScreen.tsx
//
// Ad choices: premium / pause state, rewarded ad-free pause, UMP privacy options. Everything ad-related comes from
// the ads feature through [AdPreferencesController] (`useAdExperience()` + `useSubscription().isPremium`).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/ads/ads_policy.dart' show adReasonLabels;
import '../profile/profile_interfaces.dart';
import 'ui/settings_ui.dart';

/// `ads.decisionFor('ads_pause_rewarded')`.
class AdDecision {
  const AdDecision({required this.allowed, required this.reason, this.waitSeconds = 0});
  final bool allowed;
  final String reason;
  final int waitSeconds;
}

/// The `useAdExperience()` surface this screen uses (ads feature).
abstract interface class AdPreferencesController {
  AdDecision rewardedDecision();
  bool get previewEnabled;
  bool get previewPremium;
  int get pauseUntilMs;
  int get rewardPauseMinutes;
  bool get busy;
  bool get nativeAvailable;
  bool get privacyOptionsRequired;

  /// Resolves true when the reward was earned.
  Future<bool> showRewarded();
  Future<void> openPrivacy();

  /// Notifies the screen of state changes (busy, pause…).
  Listenable get changes;
}

class NoopAdPreferencesController implements AdPreferencesController {
  NoopAdPreferencesController();
  @override
  AdDecision rewardedDecision() => const AdDecision(allowed: false, reason: 'unsupported');
  @override
  bool get busy => false;
  @override
  Listenable get changes => _n;
  final ChangeNotifier _n = ChangeNotifier();
  @override
  bool get nativeAvailable => false;
  @override
  Future<void> openPrivacy() async {}
  @override
  int get pauseUntilMs => 0;
  @override
  bool get previewEnabled => false;
  @override
  bool get previewPremium => false;
  @override
  bool get privacyOptionsRequired => false;
  @override
  int get rewardPauseMinutes => 30;
  @override
  Future<bool> showRewarded() async => false;
}

final adPreferencesControllerProvider = Provider<AdPreferencesController>((ref) => NoopAdPreferencesController());

class AdPreferencesScreen extends ConsumerStatefulWidget {
  const AdPreferencesScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<AdPreferencesScreen> createState() => _AdPreferencesScreenState();
}

class _AdPreferencesScreenState extends ConsumerState<AdPreferencesScreen> {
  bool _requesting = false;

  @override
  Widget build(BuildContext context) {
    final ads = ref.watch(adPreferencesControllerProvider);
    return ListenableBuilder(listenable: ads.changes, builder: (context, _) => _build(context, ads));
  }

  Widget _build(BuildContext context, AdPreferencesController ads) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final decision = ads.rewardedDecision();
    final premium = ads.previewEnabled ? ads.previewPremium : ref.watch(subscriptionIsPremiumProvider);
    final now = DateTime.now().millisecondsSinceEpoch;
    final paused = ads.pauseUntilMs > now;
    final minutes = ads.rewardPauseMinutes;
    Widget card(List<Widget> children) => Container(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          decoration: BoxDecoration(
            color: s.card,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: s.border),
            boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
          ),
          child: VGap(gap: 12, crossAxisAlignment: CrossAxisAlignment.start, children: children),
        );
    final h2 = Tw.base.copyWith(fontWeight: FontWeight.w600, color: s.cardForeground);
    final muted = Tw.sm.copyWith(color: s.mutedForeground);
    final small = Tw.xs.copyWith(color: s.mutedForeground);
    final canReward = !(_requesting || ads.busy || (!decision.allowed && decision.reason != 'consent'));
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 16 + MediaQuery.paddingOf(context).top * 0, 20, 96),
          child: VGap(gap: 20, children: <Widget>[
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(children: <Widget>[
                  AIconBtn(size: 44, onTap: widget.onBack, semanticLabel: tr('ads_back', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(tr('ads_preferences_title', 'Reklam seçimləri'), style: Tw.lg.copyWith(fontWeight: FontWeight.w700, color: a.ink))),
                  const SizedBox(width: 12),
                  AIcon(AIcons.slidersHorizontal, size: 18, color: a.ink),
                ]),
              ),
            ),
            card(<Widget>[
              AIcon(AIcons.shieldCheck, size: 28, color: s.primary),
              Text(
                premium ? tr('ads_premium_free', 'Premium ilə reklamsız istifadə') : paused ? tr('ads_pause_active', 'Reklamsız fasilə aktivdir') : tr('ads_your_choices', 'Seçim sizindir'),
                style: h2,
              ),
              Text(
                premium
                    ? tr('ads_premium_description', 'Premium və ailə Premium-u reklam göstərilmədən işləyir.')
                    : paused
                        ? '${((ads.pauseUntilMs - now) / 60000).ceil().clamp(1, 1 << 30)} ${tr('ads_minutes_left', 'dəqiqə qalıb. Bu cihazda yeni reklam açılmır.')}'
                        : tr('ads_choices_description', 'Reklamlar yalnız müəyyən ekranlarda və tezlik limitləri ilə göstərilir. Tibbi profil məlumatları reklam sorğusuna əlavə edilmir.'),
                style: muted,
              ),
            ]),
            if (!premium)
              card(<Widget>[
                const AIcon(AIcons.gift, size: 26, color: Color(0xFF8B5CF6)), // text-violet-500
                Text('$minutes ${tr('ads_reward_title', 'dəqiqə reklamsız fasilə')}', style: h2),
                Text(tr('ads_reward_description', 'İstəyə bağlı videonu tamamladıqdan sonra bu cihazda reklam fasiləsi açılır. Videonu bağlamaq kifayət etmir; Premium və ödənişli imkanlar bu mükafata daxil deyil.'), style: muted),
                if (ads.previewEnabled)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(8)), // bg-violet-50
                    child: Text('DEMO · ${tr('ads_demo_reward_note', 'Bu sınaq yalnız demo reklamların fasiləsini dəyişir.')}', style: Tw.xs.copyWith(color: const Color(0xFF6D28D9))), // text-violet-700
                  ),
                SizedBox(
                  width: double.infinity,
                  child: ShadButton(
                    key: const ValueKey<String>('ads-reward'),
                    expand: true,
                    onPressed: canReward
                        ? () async {
                            final toast = toasts(context);
                            setState(() => _requesting = true);
                            try {
                              final earned = await ads.showRewarded();
                              if (earned) {
                                toast.success(tr('ads_reward_success', 'Reklamsız fasilə aktivləşdirildi.'));
                              } else {
                                toast.info(tr('ads_reward_incomplete', 'Video tamamlanmadı və ya reklam hazır deyil.'));
                              }
                            } finally {
                              if (mounted) setState(() => _requesting = false);
                            }
                          }
                        : null,
                    child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                      _requesting ? ALoader(size: 16, color: s.primaryForeground) : AIcon(AIcons.gift, size: 16, color: s.primaryForeground),
                      const SizedBox(width: 8),
                      Flexible(child: Text(tr('ads_watch_reward', 'Reklama bax və fasilə qazan'))),
                    ]),
                  ),
                ),
                if (!decision.allowed)
                  Semantics(
                    liveRegion: true,
                    child: Text('${adReasonLabels[decision.reason] ?? decision.reason}${decision.waitSeconds > 0 ? ' · ${decision.waitSeconds} san.' : ''}', style: small),
                  ),
              ]),
            card(<Widget>[
              Text(tr('ads_privacy_title', 'Reklam məxfilik seçimləri'), style: h2),
              Text(tr('ads_privacy_description', 'Google UMP tərəfindən təqdim edilən razılıq və məxfilik seçimlərini native tətbiqdə buradan idarə edə bilərsiniz.'), style: muted),
              ShadButton(
                key: const ValueKey<String>('ads-privacy'),
                variant: ShadButtonVariant.outline,
                onPressed: !ads.nativeAvailable || !ads.privacyOptionsRequired || ads.busy ? null : () => unawaited(ads.openPrivacy()),
                child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                  AIcon(AIcons.circleCheck, size: 16, color: s.foreground),
                  const SizedBox(width: 8),
                  Text(tr('ads_manage_privacy', 'Məxfilik seçimlərini aç')),
                ]),
              ),
              if (!ads.nativeAvailable) Text(tr('ads_native_required', 'Real AdMob reklamları və UMP seçimləri SDK daxil edilmiş yeni iOS/Android versiyasında işləyir.'), style: small),
            ]),
          ]),
        ),
      ),
    );
  }
}
