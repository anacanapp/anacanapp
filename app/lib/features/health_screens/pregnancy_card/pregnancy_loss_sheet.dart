// Ported from: src/components/pregnancy-loss/PregnancyLossSheet.tsx
//
// "Hamiləliyim davam etmir": one calm confirmation. No reason is asked. Only the date (for the recovery weeks) and
// whether to tell the linked partner. The portal sheet (overlay rgba(40,30,50,.38), spring slide-up, max 92vh) is
// a general dialog route; tapping the overlay closes it unless saving.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../profile/profile_interfaces.dart' show accountActionsProvider;
import '../../settings/ui/settings_ui.dart' show px;
import '../loss/loss_ui.dart';
import '../loss/pregnancy_loss.dart';

/// Opens the sheet; completes with true when the loss was recorded (`onDone`).
Future<bool?> showPregnancyLossSheet(BuildContext context) => showGeneralDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierColor: const Color(0x61281E32), // rgba(40, 30, 50, 0.38)
      transitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (ctx, _, _) => const PregnancyLossSheet(),
      transitionBuilder: (ctx, anim, _, child) => FadeTransition(
        opacity: anim,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: child,
        ),
      ),
    );

class PregnancyLossSheet extends ConsumerStatefulWidget {
  const PregnancyLossSheet({super.key});
  @override
  ConsumerState<PregnancyLossSheet> createState() => _PregnancyLossSheetState();
}

class _PregnancyLossSheetState extends ConsumerState<PregnancyLossSheet> {
  late String _date = isoDay(DomainClock.now());
  bool _share = true;
  bool _saving = false;
  bool _failed = false;

  Future<void> _confirm(String today, String earliest) async {
    final user = ref.read(authUserProvider);
    final profile = ref.read(authProfileProvider);
    if (user == null || _saving) return;
    final hasPartner = (profile?.linkedPartnerId ?? '').isNotEmpty;
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      final date = _date.isNotEmpty && _date.compareTo(today) <= 0 && _date.compareTo(earliest) >= 0 ? _date : today;
      await ref.read(pregnancyLossActionsProvider).begin(
            date: date,
            sharePartner: hasPartner && _share,
            userId: user.id,
            linkedPartnerProfileId: profile?.linkedPartnerId,
            partnerMessage: ref.read(pregnancyLossTextProvider).sub('ui').s('partner_message'),
          );
      await ref.read(accountActionsProvider).refreshProfile();
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate(String today, String earliest) async {
    final now = DomainClock.now();
    final first = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 365));
    final last = DateTime(now.year, now.month, now.day);
    final current = DateTime.tryParse(_date) ?? last;
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isBefore(first) ? first : (current.isAfter(last) ? last : current),
      firstDate: first,
      lastDate: last,
    );
    if (picked != null) setState(() => _date = isoDay(picked));
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(pregnancyLossTextProvider).sub('ui');
    final profile = ref.watch(authProfileProvider);
    final hasPartner = (profile?.linkedPartnerId ?? '').isNotEmpty;
    final now = DomainClock.now();
    final today = isoDay(now);
    final earliest = isoDay(DateTime.fromMillisecondsSinceEpoch(now.millisecondsSinceEpoch - 365 * 86400000));
    final a = context.a;
    final l = LossTokens.of(context);
    final mq = MediaQuery.of(context);
    const white = Color(0xFFFFFFFF);

    Widget point(AIconData icon, String line) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            LossRowIcon(icon: icon, size: 30, radius: 10),
            const SizedBox(width: 12),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: 5), child: Text(line, style: px(13, color: a.bodyText, height: 1.45)))),
          ]),
        );
    final shown = DateTime.tryParse(_date);

    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: Stack(children: [
          Positioned.fill(child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => _saving ? null : Navigator.of(context).pop(false))),
          Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 448, maxHeight: mq.size.height * 0.92),
              child: Semantics(
                scopesRoute: true,
                explicitChildNodes: true,
                namesRoute: true,
                label: t.s('sheet_title'),
                child: Container(
                  decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(20, 10, 20, 24 + mq.padding.bottom),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 5,
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(9)),
                        ),
                      ),
                      const ExcludeSemantics(child: Text('🤍', textAlign: TextAlign.center, style: TextStyle(fontSize: 30, height: 1.2))),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(0, 6, 0, 4),
                        child: Text(t.s('sheet_title'), textAlign: TextAlign.center, style: px(19, weight: FontWeight.w900, color: a.ink)),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(t.s('sheet_body'), textAlign: TextAlign.center, style: px(13.5, color: a.bodyText)),
                      ),
                      point(AIcons.bellOff, t.s('sheet_stop')),
                      point(AIcons.folderHeart, t.s('sheet_keep')),
                      point(AIcons.leaf, t.s('sheet_guide')),
                      Container(
                        margin: const EdgeInsets.fromLTRB(0, 10, 0, 8),
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                        decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(16)),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(t.s('sheet_date'), style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                              Text(t.s('sheet_date_sub'), style: px(11.5, color: a.inkSoft)),
                            ]),
                          ),
                          const SizedBox(width: 12),
                          Semantics(
                            button: true,
                            label: t.s('sheet_date'),
                            child: GestureDetector(
                              onTap: () => _pickDate(today, earliest),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12)),
                                child: Text(
                                  shown == null ? _date : '${pad2(shown.day)}.${pad2(shown.month)}.${shown.year}',
                                  style: px(13, weight: FontWeight.w700, color: a.ink),
                                ),
                              ),
                            ),
                          ),
                        ]),
                      ),
                      if (hasPartner)
                        Semantics(
                          toggled: _share,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _share = !_share),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                              decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(16)),
                              child: Row(children: [
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(t.s('sheet_partner'), style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                                    Text(t.s('sheet_partner_sub'), style: px(11.5, color: a.inkSoft, height: 1.4)),
                                  ]),
                                ),
                                const SizedBox(width: 12),
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: 44,
                                  height: 26,
                                  padding: const EdgeInsets.all(3),
                                  alignment: _share ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                                  decoration: BoxDecoration(color: _share ? l.accent : a.lineStrong, borderRadius: BorderRadius.circular(99)),
                                  child: Container(width: 20, height: 20, decoration: const BoxDecoration(color: white, shape: BoxShape.circle)),
                                ),
                              ]),
                            ),
                          ),
                        ),
                      if (_failed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Semantics(liveRegion: true, child: Text(t.s('sheet_error'), textAlign: TextAlign.center, style: px(12.5, color: a.alertInk))),
                        ),
                      Padding(
                        padding: EdgeInsets.only(top: hasPartner ? 0 : 8),
                        child: LossButton(label: t.s('sheet_continue'), busy: _saving, onTap: _saving ? null : () => _confirm(today, earliest)),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: LossButton(label: t.s('sheet_back'), ghost: true, padding: 13, onTap: _saving ? null : () => Navigator.of(context).pop(false)),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
