// Ported from: src/components/tools/market/MarketThread.tsx
//
// Shared chat thread for the second-hand market: my messages on the end side, the counterpart's on the start side,
// a 240px scrolling list kept at the bottom, and the composer (Enter sends).
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show jsParseDate;
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../health_common/health_ui.dart' show AField;

/// `ThreadMessage`.
class ThreadMessage {
  const ThreadMessage({required this.id, required this.senderId, required this.content, required this.createdAt});
  final String id;
  final String senderId;
  final String content;
  final String createdAt;
}

class MarketThread extends StatefulWidget {
  const MarketThread({
    super.key,
    required this.messages,
    required this.myId,
    required this.controller,
    required this.onSend,
    required this.sending,
    this.emptyHint,
  });
  final List<ThreadMessage> messages;
  final String? myId;

  /// The composer value (`value` / `onChange`).
  final TextEditingController controller;
  final VoidCallback onSend;
  final bool sending;

  /// Second line of the empty state, e.g. "Satıcıya mesaj göndərin".
  final String? emptyHint;

  @override
  State<MarketThread> createState() => _MarketThreadState();
}

class _MarketThreadState extends State<MarketThread> {
  final ScrollController _list = ScrollController();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _toBottom();
  }

  @override
  void didUpdateWidget(MarketThread old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
    }
    if (old.messages.length != widget.messages.length) _toBottom();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _list.dispose();
    super.dispose();
  }

  void _changed() => setState(() {});

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_list.hasClients) _list.jumpTo(_list.position.maxScrollExtent);
      });

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final disabled = widget.controller.text.trim().isEmpty || widget.sending;
    final placeholder = tr('secondhandmarket_mesajinizi_yazin_21d48f', 'Mesajınızı yazın...');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 240),
        child: Semantics(
          liveRegion: true,
          child: SingleChildScrollView(
            controller: _list,
            padding: const EdgeInsets.all(8),
            child: widget.messages.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.messageCircle, size: 40, color: a.inkFaint)),
                      Text(tr('secondhandmarket_hele_mesaj_yoxdur_cf0b5e', 'Hələ mesaj yoxdur'), textAlign: TextAlign.center, style: context.aText.aListSub),
                      if (widget.emptyHint != null) Text(widget.emptyHint!, textAlign: TextAlign.center, style: px(12, color: a.inkFaint, height: 16 / 12)),
                    ]),
                  )
                : Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    for (var i = 0; i < widget.messages.length; i++) ...[
                      if (i > 0) const SizedBox(height: 8),
                      _bubble(context, widget.messages[i]),
                    ],
                  ]),
          ),
        ),
      ),
      // The fragment's two blocks sit in the dialog's `space-y-4`.
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
          child: Semantics(
            label: placeholder,
            child: AField(
              fieldKey: const ValueKey('market-thread-input'),
              controller: widget.controller,
              placeholder: placeholder,
              fontSize: 13,
              inputFormatters: [LengthLimitingTextInputFormatter(2000)],
              onSubmitted: (_) {
                if (!disabled) widget.onSend();
              },
            ),
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          enabled: !disabled,
          label: tr('directmessagescreen_send', 'Göndər'),
          excludeSemantics: true,
          child: GestureDetector(
            key: const ValueKey('market-thread-send'),
            behavior: HitTestBehavior.opaque,
            onTap: disabled ? null : widget.onSend,
            child: Opacity(
              opacity: disabled ? 0.5 : 1,
              child: Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.green2, borderRadius: BorderRadius.circular(999)),
                child: widget.sending ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.send, size: 16, color: Color(0xFFFFFFFF)),
              ),
            ),
          ),
        ),
      ]),
    ]);
  }

  Widget _bubble(BuildContext context, ThreadMessage msg) {
    final a = context.a;
    final mine = msg.senderId == widget.myId;
    final d = jsParseDate(msg.createdAt)?.toLocal();
    return Align(
      alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: FractionallySizedBox(
        widthFactor: 0.75,
        alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: Align(
          alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: mine ? a.peach1 : a.surfaceSoft,
              borderRadius: BorderRadiusDirectional.only(
                topStart: const Radius.circular(16),
                topEnd: const Radius.circular(16),
                bottomStart: Radius.circular(mine ? 16 : 2),
                bottomEnd: Radius.circular(mine ? 2 : 16),
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(msg.content, style: px(14, color: mine ? a.accentInk : a.ink, height: 20 / 14)),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Opacity(
                  opacity: 0.6,
                  child: Text(d == null ? '' : formatDatePattern(d, 'HH:mm'), style: px(10, color: mine ? a.accentInk : a.ink, height: 15 / 10)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
