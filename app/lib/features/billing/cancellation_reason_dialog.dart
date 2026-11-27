// Ported from: src/components/CancellationReasonDialog.tsx, src/hooks/useSubscriptionCancellation.ts (mutation),
//              src/components/ui/dialog.tsx (DialogContent / DialogHeader / DialogTitle / close button)
//
// "Why are you leaving?" before the store / anacan.az cancel flow. The reason goes to
// `subscription_cancellations` (`cancel_flow: 'in_app'`); a failed insert never blocks the cancel flow, and
// "Skip" continues without a reason. Closing the dialog (overlay, X, Android back) does not continue.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../native/purchases/subscription.dart';
import '../settings/ui/settings_ui.dart' show ALoader, px;

class _Reason {
  const _Reason(this.code, this.labelKey, this.labelDefault);
  final CancellationReasonCode code;
  final String labelKey;
  final String labelDefault;
}

const List<_Reason> _reasons = <_Reason>[
  _Reason('too_expensive', 'cancelreason_too_expensive', 'Qiymət mənim üçün baha oldu'),
  _Reason('not_using_enough', 'cancelreason_not_using_enough', 'Kifayət qədər istifadə etmirəm'),
  _Reason('missing_features', 'cancelreason_missing_features', 'İstədiyim funksiyaları tapmadım'),
  _Reason('technical_issues', 'cancelreason_technical_issues', 'Texniki problemlər yaşadım'),
  _Reason('found_alternative', 'cancelreason_found_alternative', 'Başqa bir tətbiq/alternativ tapdım'),
  _Reason('temporary_break', 'cancelreason_temporary_break', 'Müvəqqəti fasilə vermək istəyirəm'),
  _Reason('other', 'cancelreason_other', 'Digər səbəb'),
];

/// Shows the dialog. [onProceed] runs after a submitted reason or "Skip" (once the dialog is closed).
Future<void> showCancellationReasonDialog(
  BuildContext context, {
  required VoidCallback onProceed,
  String? planType,
  bool? wasTrial,
}) async {
  final proceed = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'close',
    barrierColor: const Color(0xCC000000), // bg-black/80
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => SafeArea(
      child: Center(child: SingleChildScrollView(child: CancellationReasonDialog(planType: planType, wasTrial: wasTrial))),
    ),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(anim), child: child),
    ),
  );
  if (proceed == true) onProceed();
}

class CancellationReasonDialog extends ConsumerStatefulWidget {
  const CancellationReasonDialog({super.key, this.planType, this.wasTrial});
  final String? planType;
  final bool? wasTrial;

  @override
  ConsumerState<CancellationReasonDialog> createState() => _CancellationReasonDialogState();
}

class _CancellationReasonDialogState extends ConsumerState<CancellationReasonDialog> {
  CancellationReasonCode? _selected;
  final TextEditingController _otherText = TextEditingController();
  bool _pending = false;

  @override
  void dispose() {
    _otherText.dispose();
    super.dispose();
  }

  void _skip() => Navigator.of(context).pop(true);

  Future<void> _submit() async {
    final selected = _selected;
    if (selected == null || _pending) return;
    setState(() => _pending = true);
    try {
      await submitCancellationReason(
        ref.read(subscriptionBackendProvider),
        userId: ref.read(authUserProvider)?.id,
        reasonCode: selected,
        reasonText: selected == 'other' ? _otherText.text : null,
        planType: widget.planType,
        wasTrial: widget.wasTrial ?? false,
      );
      ref.read(analyticsSinkProvider).logEvent('premium_cancelled');
    } catch (_) {
      // Recording the reason is internal feedback only; it must never block the cancel flow.
    }
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final width = MediaQuery.sizeOf(context).width;
    // `max-w-[92vw]` below 640 px, `sm:max-w-md` (448) above.
    final maxWidth = width >= 640 ? 448.0 : width * 0.92;
    final canSubmit = _selected != null && !_pending;
    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          key: const ValueKey<String>('cancel-reason-dialog'),
          width: maxWidth,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: a.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: s.border),
            boxShadow: const <BoxShadow>[
              // shadow-lg
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
            ],
          ),
          child: Stack(clipBehavior: Clip.none, children: <Widget>[
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: <Widget>[
              // DialogHeader: flex-col space-y-1.5, text-center below 640 px.
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Container(
                      width: 44,
                      height: 44,
                      margin: const EdgeInsets.only(bottom: 4),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(16)),
                      child: AIcon(AIcons.frown, size: 20, color: a.warnInk),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr('cancelreason_title', 'Getməzdən əvvəl bir sualımız var'),
                    textAlign: width >= 640 ? TextAlign.start : TextAlign.center,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, height: 1, letterSpacing: -0.025 * 18, color: a.ink),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr('cancelreason_subtitle', 'Ayrıldığınız üçün üzgünük. Səbəbini bilmək Anacan-ı sizin üçün daha yaxşı etməyə kömək edir.'),
                    textAlign: width >= 640 ? TextAlign.start : TextAlign.center,
                    style: TextStyle(fontSize: 14, height: 20 / 14, color: a.inkSoft),
                  ),
                ],
              ),
              const SizedBox(height: 16 + 4),
              for (var i = 0; i < _reasons.length; i++) ...<Widget>[
                if (i > 0) const SizedBox(height: 8),
                _ReasonButton(
                  key: ValueKey<String>('cancel-reason-${_reasons[i].code}'),
                  label: tr(_reasons[i].labelKey, _reasons[i].labelDefault),
                  active: _selected == _reasons[i].code,
                  onTap: () => setState(() => _selected = _reasons[i].code),
                ),
              ],
              if (_selected == 'other') ...<Widget>[
                const SizedBox(height: 8 + 2),
                _OtherTextField(controller: _otherText),
              ],
              const SizedBox(height: 16 + 12),
              Row(children: <Widget>[
                Expanded(
                  child: GestureDetector(
                    key: const ValueKey<String>('cancel-reason-skip'),
                    behavior: HitTestBehavior.opaque,
                    onTap: _skip,
                    child: SizedBox(
                      height: 44,
                      child: Center(child: Text(tr('cancelreason_skip', 'Keç'), style: px(14, weight: FontWeight.w700, color: a.inkSoft, height: 20 / 14))),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Semantics(
                    button: true,
                    enabled: canSubmit,
                    child: GestureDetector(
                      key: const ValueKey<String>('cancel-reason-submit'),
                      behavior: HitTestBehavior.opaque,
                      onTap: canSubmit ? _submit : null,
                      child: Opacity(
                        opacity: canSubmit ? 1 : 0.5,
                        child: Container(
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                          child: _pending
                              ? const ALoader(size: 16, color: Color(0xFFFFFFFF))
                              : Text(tr('cancelreason_continue', 'Göndər və davam et'),
                                  style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 20 / 14)),
                        ),
                      ),
                    ),
                  ),
                ),
              ]),
            ]),
            // Radix close button: absolute end-4 top-4 (inside the p-6 box: -8 / -8), opacity .7.
            PositionedDirectional(
              end: -8,
              top: -8,
              child: Semantics(
                button: true,
                label: 'Close',
                child: GestureDetector(
                  key: const ValueKey<String>('cancel-reason-close'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).pop(false),
                  child: Opacity(opacity: 0.7, child: AIcon(AIcons.x, size: 16, color: s.foreground)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _ReasonButton extends StatelessWidget {
  const _ReasonButton({super.key, required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: active,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: active ? a.peach1 : a.surfaceSoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: active ? a.peach2 : a.line, width: 1.5),
          ),
          child: Row(children: <Widget>[
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: active ? a.peach2 : a.inkFaint, width: active ? 5 : 1.5),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: px(13, weight: FontWeight.w600, color: a.ink))),
          ]),
        ),
      ),
    );
  }
}

/// The auto-growing "other" textarea (`useAutoGrowTextarea(value, 100)`: grows to 100 px, then scrolls).
class _OtherTextField extends StatelessWidget {
  const _OtherTextField({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = TextStyle(fontSize: 13, height: 1.4, color: a.ink);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 100),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: a.lineStrong)),
        child: TextField(
          key: const ValueKey<String>('cancel-reason-other'),
          controller: controller,
          autofocus: true,
          minLines: 1,
          maxLines: null,
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            hintText: tr('cancelreason_other_placeholder', 'İstəsəniz, ətraflı yaza bilərsiniz...'),
            // Tailwind preflight textarea::placeholder colour (gray-400).
            hintStyle: style.copyWith(color: const Color(0xFF9CA3AF)),
          ),
        ),
      ),
    );
  }
}
