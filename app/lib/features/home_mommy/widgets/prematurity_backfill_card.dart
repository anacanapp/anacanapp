// Ported from: src/components/mommy/PrematurityBackfillCard.tsx
//
// One-time soft question for children without a due date: born on time (due_date = birth_date) or early
// (N weeks → due_date = birth_date + (280 − 7N) days, UTC calendar arithmetic). Dismissal is remembered per child
// on the device (`preemie-backfill-dismissed-<childId>` = '1').
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart';
import '../../baby/data/baby_repository.dart';
import '../../baby/models/child.dart';
import 'mommy_ui.dart';

String preemieDismissKey(String childId) => 'preemie-backfill-dismissed-$childId';

/// Due date for a preterm birth at [gestWeeks] weeks: `birth_date + (280 − gestWeeks × 7)` days (UTC).
String pretermDueDate(String birthDate, int gestWeeks) {
  final base = DateTime.parse('${birthDate.substring(0, 10)}T00:00:00Z');
  return base.add(Duration(days: 280 - gestWeeks * 7)).toIso8601String().substring(0, 10);
}

class PrematurityBackfillCard extends ConsumerStatefulWidget {
  const PrematurityBackfillCard({super.key, required this.child, required this.onSaved});
  final Child child;
  final VoidCallback onSaved;

  @override
  ConsumerState<PrematurityBackfillCard> createState() => _PrematurityBackfillCardState();
}

class _PrematurityBackfillCardState extends ConsumerState<PrematurityBackfillCard> {
  late bool _dismissed = _readDismissed();
  String _mode = 'ask';
  int _gestWeeks = 34;
  bool _saving = false;

  bool _readDismissed() {
    try {
      return ref.read(localStoreProvider).getItem(preemieDismissKey(widget.child.id)) == '1';
    } catch (_) {
      return false;
    }
  }

  @override
  void didUpdateWidget(PrematurityBackfillCard old) {
    super.didUpdateWidget(old);
    if (old.child.id != widget.child.id) _dismissed = _readDismissed();
  }

  void _dismiss() {
    try {
      ref.read(localStoreProvider).setItem(preemieDismissKey(widget.child.id), '1');
    } catch (_) {}
    setState(() => _dismissed = true);
  }

  Future<void> _save(String dueDate) async {
    final toast = AToastHost.of(context);
    setState(() => _saving = true);
    try {
      await ref.read(babyRepositoryProvider).updateChildDueDate(widget.child.id, dueDate);
      toast.success(tr('preemie_backfill_saved', 'Yadda saxlanıldı'));
      if (!mounted) return;
      setState(() => _dismissed = true);
      widget.onSaved();
    } catch (e) {
      final dynamic d = e;
      String message = '';
      try {
        message = '${d.message ?? ''}';
      } catch (_) {}
      toast.error(tr('preemie_backfill_error', 'Xəta: ') + message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    if (_dismissed || (widget.child.dueDate != null && widget.child.dueDate!.isNotEmpty)) return const SizedBox.shrink();
    final t = context.a;
    Widget choice(String label, {required Color bg, required Color fg, VoidCallback? onTap}) => Expanded(
          child: GestureDetector(
            onTap: _saving ? null : onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.peach2, width: 1.5)),
              child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: fg, height: 1.5)),
            ),
          ),
        );
    Widget stepper(String label, VoidCallback onTap) => GestureDetector(
          onTap: onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: t.peach2)),
            child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: t.ink, fontSize: 16)),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: AFadeIn(
        child: ACard(
          padding: const EdgeInsets.all(14),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 24),
                    child: Text(
                      tr('preemie_backfill_q', '{name} vaxtında doğulub?').replaceFirst('{name}', widget.child.name),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.ink, height: 1.5),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      tr('preemie_backfill_sub', 'Vaxtından əvvəl doğulan körpələr üçün inkişaf və böyümə korreksiya olunmuş yaşla izlənir.'),
                      style: TextStyle(fontSize: 11.5, color: t.inkSoft, height: 1.5),
                    ),
                  ),
                  if (_mode == 'ask')
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: IntrinsicHeight(
                        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          choice(tr('preemie_backfill_term', 'Bəli, vaxtında (37+ həftə)'),
                              bg: t.surface, fg: t.ink, onTap: () => _save(widget.child.birthDate)),
                          const SizedBox(width: 8),
                          choice(tr('preemie_backfill_preterm', 'Vaxtından əvvəl'),
                              bg: t.peach1, fg: t.accentInk, onTap: () => setState(() => _mode = 'weeks')),
                        ]),
                      ),
                    ),
                  if (_mode == 'weeks')
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(children: [
                            stepper('-', () => setState(() => _gestWeeks = (_gestWeeks - 1).clamp(22, 36))),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Container(
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(12)),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Text('$_gestWeeks', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.ink)),
                                  const SizedBox(width: 6),
                                  Text(tr('preemie_backfill_weeks', 'həftəlik doğulub'), style: TextStyle(fontSize: 11.5, color: t.inkSoft)),
                                ]),
                              ),
                            ),
                            const SizedBox(width: 8),
                            stepper('+', () => setState(() => _gestWeeks = (_gestWeeks + 1).clamp(22, 36))),
                          ]),
                          const SizedBox(height: 8),
                          GestureDetector(
                            onTap: _saving ? null : () => _save(pretermDueDate(widget.child.birthDate, _gestWeeks)),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 11),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: t.peach2, borderRadius: BorderRadius.circular(12)),
                              child: Text(
                                _saving ? tr('common_saving', 'Saxlanılır…') : tr('preemie_backfill_save', 'Yadda saxla'),
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFFFFFFFF), height: 1.5),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              PositionedDirectional(
                top: -4,
                end: -4,
                child: Semantics(
                  button: true,
                  label: tr('common_close', 'Bağla'),
                  child: GestureDetector(onTap: _dismiss, child: AIcon(AIcons.x, size: 16, color: t.inkSoft)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
