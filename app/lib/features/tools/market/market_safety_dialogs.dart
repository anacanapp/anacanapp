// Ported from: src/components/tools/market/MarketSafetyDialogs.tsx
//
// Report a listing, a user or a conversation (one reason plus an optional short note) and the block confirmation.
// The caller's submit / confirm returns whether the dialog closes (React closes it from the parent state).
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader;
import '../health_common/health_ui.dart' show APillButton, APillKind, ATextArea;
import '../more_common/more_ui.dart';
import 'market_reason_label.dart';
import 'market_safety.dart';

/// `<MarketReportDialog open target onSubmit />`.
Future<void> showMarketReportDialog(BuildContext context, {required MarketReportTarget target, required Future<bool> Function(MarketReportReason reason, String note) onSubmit}) =>
    showMoreDialog<void>(context, builder: (_) => _ReportDialog(target: target, onSubmit: onSubmit));

class _ReportDialog extends StatefulWidget {
  const _ReportDialog({required this.target, required this.onSubmit});
  final MarketReportTarget target;
  final Future<bool> Function(MarketReportReason reason, String note) onSubmit;
  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  MarketReportReason? _reason;
  final TextEditingController _note = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reason;
    if (reason == null || _sending) return;
    setState(() => _sending = true);
    var close = false;
    try {
      close = await widget.onSubmit(reason, _note.text);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
    if (close && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final disabled = _reason == null || _sending;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(
        icon: AIcon(AIcons.flag, size: 20, color: a.coralText),
        title: widget.target == 'listing' ? tr('market_report_listing_title', 'Elanı şikayət et') : tr('market_report_user_title', 'İstifadəçini şikayət et'),
        description: tr('market_report_reason_label', 'Səbəbi seçin'),
      ),
      const SizedBox(height: 24),
      Semantics(
        label: tr('market_report_reason_label', 'Səbəbi seçin'),
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          for (final r in marketReportReasons)
            Semantics(
              inMutuallyExclusiveGroup: true,
              checked: _reason == r,
              child: MorePillChip(
                key: ValueKey('market-reason-$r'),
                selected: _reason == r,
                onTap: () => setState(() => _reason = r),
                background: _reason == r ? a.peach1 : a.surfaceSoft,
                color: _reason == r ? a.accentInk : a.inkSoft,
                borderColor: _reason == r ? a.peach2 : const Color(0x00000000),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                children: [Text(marketReasonLabel(r))],
              ),
            ),
        ]),
      ),
      const SizedBox(height: 12),
      _LimitedTextArea(controller: _note, maxLength: marketReportNoteMax, placeholder: tr('market_report_note_placeholder', 'Əlavə qeyd (istəyə bağlı)'), fieldKey: const ValueKey('market-report-note')),
      const SizedBox(height: 12),
      APillButton(
        buttonKey: const ValueKey('market-report-send'),
        label: tr('market_report_send', 'Şikayəti göndər'),
        height: 46,
        expand: true,
        icon: _sending ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.flag, size: 15, strokeWidth: 2.2),
        opacity: disabled ? 0.5 : 1,
        onTap: disabled ? null : _submit,
      ),
    ]);
  }
}

/// `<textarea className="a-input w-full resize-none" rows={3} maxLength>` (min-height 72).
class _LimitedTextArea extends StatefulWidget {
  const _LimitedTextArea({required this.controller, required this.maxLength, required this.placeholder, this.fieldKey});
  final TextEditingController controller;
  final int maxLength;
  final String placeholder;
  final Key? fieldKey;
  @override
  State<_LimitedTextArea> createState() => _LimitedTextAreaState();
}

class _LimitedTextAreaState extends State<_LimitedTextArea> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_limit);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_limit);
    super.dispose();
  }

  // `maxLength`: input beyond the limit is dropped.
  void _limit() {
    final c = widget.controller;
    if (c.text.length > widget.maxLength) {
      c.value = TextEditingValue(text: c.text.substring(0, widget.maxLength), selection: TextSelection.collapsed(offset: widget.maxLength));
    }
  }

  @override
  Widget build(BuildContext context) => ATextArea(controller: widget.controller, placeholder: widget.placeholder, height: 72, fieldKey: widget.fieldKey);
}

/// `<MarketBlockDialog open onConfirm />`.
Future<void> showMarketBlockDialog(BuildContext context, {required Future<bool> Function() onConfirm}) =>
    showMoreDialog<void>(context, builder: (_) => _BlockDialog(onConfirm: onConfirm));

class _BlockDialog extends StatefulWidget {
  const _BlockDialog({required this.onConfirm});
  final Future<bool> Function() onConfirm;
  @override
  State<_BlockDialog> createState() => _BlockDialogState();
}

class _BlockDialogState extends State<_BlockDialog> {
  bool _busy = false;

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() => _busy = true);
    var close = false;
    try {
      close = await widget.onConfirm();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (close && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(
        icon: AIcon(AIcons.ban, size: 20, color: a.coralText),
        title: tr('market_block_title', 'İstifadəçini bloklayaq?'),
        description: tr('market_block_body', 'Onun elanlarını və mesajlarını görməyəcəksiniz, o da sizə yaza bilməyəcək.'),
      ),
      const SizedBox(height: 24),
      Row(children: [
        Expanded(
          child: APillButton(
            buttonKey: const ValueKey('market-block-cancel'),
            kind: APillKind.soft,
            label: tr('market_cancel', 'Ləğv et'),
            height: 44,
            expand: true,
            onTap: () => Navigator.of(context).pop(),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: APillButton(
            buttonKey: const ValueKey('market-block-confirm'),
            label: tr('market_block_confirm', 'Blokla'),
            height: 44,
            expand: true,
            icon: _busy ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.ban, size: 15, strokeWidth: 2.2),
            opacity: _busy ? 0.6 : 1,
            onTap: _busy ? null : _confirm,
          ),
        ),
      ]),
    ]);
  }
}
