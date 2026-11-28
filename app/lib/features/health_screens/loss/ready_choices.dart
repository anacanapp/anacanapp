// Ported from: src/components/pregnancy-loss/ReadyChoices.tsx
//
// "Hazır olanda": the mother's own choice to leave the recovery mode. Nothing is offered by the app on its own; each
// choice asks once more before it changes anything.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../profile/profile_interfaces.dart' show accountActionsProvider;
import '../../settings/ui/settings_ui.dart' show px;
import '../common/feature_text.dart';
import 'loss_ui.dart';
import 'pregnancy_loss.dart';

class ReadyChoices extends ConsumerStatefulWidget {
  const ReadyChoices({super.key, required this.text, this.onNavigate});
  final FeatureText text;
  final void Function(String screen)? onNavigate;
  @override
  ConsumerState<ReadyChoices> createState() => _ReadyChoicesState();
}

class _ReadyChoicesState extends ConsumerState<ReadyChoices> {
  /// 'cycle' | 'pregnant' | 'stay' | null.
  String? _asking;
  bool _saving = false;
  bool _failed = false;

  Future<void> _confirm() async {
    final asking = _asking;
    if (asking == null || asking == 'stay' || _saving) return;
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await ref.read(pregnancyLossActionsProvider).end(asking == 'cycle');
      await ref.read(accountActionsProvider).refreshProfile();
      if (mounted) setState(() => _asking = null);
      widget.onNavigate?.call(asking == 'pregnant' ? 'edit-profile' : 'home');
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.text.sub('ui');
    final a = context.a;
    final l = LossTokens.of(context);
    final rows = <(String, String, Color, String, String)>[
      ('cycle', '🌸', a.pink1, t.s('ready_cycle'), t.s('ready_cycle_sub')),
      ('pregnant', '🤰', a.peach1, t.s('ready_pregnant'), t.s('ready_pregnant_sub')),
      ('stay', '🌿', l.soft, t.s('ready_stay'), t.s('ready_stay_sub')),
    ];
    return LossCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(header: true, child: Text(t.s('ready_title'), style: px(15, weight: FontWeight.w900, color: a.ink))),
        Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t.s('ready_sub'), style: lossRowSub(context))),
        for (var i = 0; i < rows.length; i++)
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            LossRow(
              leading: LossRowIcon(emoji: rows[i].$2, color: rows[i].$3),
              title: rows[i].$4,
              sub: rows[i].$5,
              // Each row sits in its own <div>: `.loss-row:last-child` drops the border unless the confirm box follows.
              last: !(_asking == rows[i].$1 && rows[i].$1 != 'stay'),
              onTap: () => setState(() => _asking = rows[i].$1 == 'stay' ? null : (_asking == rows[i].$1 ? null : rows[i].$1)),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              alignment: Alignment.topCenter,
              child: _asking == rows[i].$1 && rows[i].$1 != 'stay'
                  ? Container(
                      margin: const EdgeInsets.fromLTRB(0, 4, 0, 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(16)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Text(rows[i].$1 == 'cycle' ? t.s('ready_confirm_cycle') : t.s('ready_confirm_pregnant'), style: lossBody(context, 13)),
                        if (_failed)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Semantics(liveRegion: true, child: Text(t.s('sheet_error'), style: px(12, color: a.alertInk))),
                          ),
                        const SizedBox(height: 10),
                        Row(children: [
                          Expanded(child: LossButton(label: t.s('ready_yes'), busy: _saving, padding: 11, fontSize: 13.5, onTap: _saving ? null : _confirm)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: LossButton(
                              label: t.s('ready_no'),
                              ghost: true,
                              padding: 11,
                              fontSize: 13.5,
                              background: a.surface,
                              onTap: _saving ? null : () => setState(() => _asking = null),
                            ),
                          ),
                        ]),
                      ]),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ]),
      ]),
    );
  }
}
