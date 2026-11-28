// Ported from: src/components/games/GameReviveAction.tsx
//
// The rewarded-revive offer under a lost round: renders nothing unless [GameAdsController.canOffer].
library;

import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import 'game_ads.dart';
import 'game_widgets.dart';

class ReviveLabels {
  const ReviveLabels({required this.action, required this.note, required this.failed, required this.unavailable});
  final String action;
  final String note;
  final String failed;
  final String unavailable;
}

/// `game`: `'basket'` (lives / seconds) or `'match'` (moves). [canOffer] overrides `ads.canOffer`
/// (Word Garden passes `canOffer && benefits.seconds > 0`).
class GameReviveAction extends StatelessWidget {
  const GameReviveAction({super.key, required this.ads, required this.game, this.labels, this.canOffer});
  final GameAdsController ads;
  final String game;
  final ReviveLabels? labels;
  final bool? canOffer;

  @override
  Widget build(BuildContext context) {
    if (!(canOffer ?? ads.canOffer)) return const SizedBox.shrink();
    final b = ads.benefits;
    // React literals (GameReviveAction.tsx).
    final benefit = game == 'basket' ? '+${b.lives} can${b.seconds != 0 ? ' / ən azı ${b.seconds} san.' : ''}' : '+${b.moves} gediş';
    final muted = context.tokens.shadcn.mutedForeground;
    final small = px(10, color: muted, height: 15 / 10);
    final enabled = !ads.waiting && ads.canRequest;
    return Column(
      key: const ValueKey('game-revive-offer'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        GameButton(
          enabled: enabled,
          onTap: () => ads.revive(),
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: TwColors.violet50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: TwColors.violet200),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (ads.waiting)
                  const ALoader(size: 17, color: TwColors.violet800)
                else
                  const AIcon(AIcons.gift, size: 17, color: TwColors.violet800),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    labels?.action ?? (ads.premium ? 'Premium ilə davam et · $benefit' : 'Videoya bax · $benefit'),
                    textAlign: TextAlign.center,
                    style: px(14, weight: FontWeight.w700, color: TwColors.violet800, height: 20 / 14),
                  ),
                ),
              ]),
            ),
          ),
        ),
        if (ads.message.isNotEmpty) ...[const SizedBox(height: 6), Text(labels?.failed ?? ads.message, style: small)],
        if (!ads.canRequest && ads.message.isEmpty) ...[const SizedBox(height: 6), Text(labels?.unavailable ?? ads.reason, style: small)],
        const SizedBox(height: 6),
        Text(labels?.note ?? 'Xal və lövhə saxlanır. Video bağlanarsa bərpa verilmir.', style: small),
      ],
    );
  }
}
