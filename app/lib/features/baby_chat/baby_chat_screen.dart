// Ported from: src/components/baby-chat/BabyChatScreen.tsx, src/components/baby-chat/baby-chat.css
//
// "Körpəmdən mesajlar": the unborn baby's daily message and its replies, shareable as a photo.
import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show HapticFeedback, LengthLimitingTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../shell/widgets/android_back_scope.dart' show OverlayBackHandler;
import '../settings/ui/settings_ui.dart' show ALoader;
import 'baby_chat.dart';
import 'baby_chat_ai.dart';
import 'baby_chat_notifications.dart';
import 'baby_chat_safety.dart';
import 'baby_chat_share.dart';
import 'baby_chat_widgets.dart';
import 'use_baby_chat.dart';

/// Typing pause before the reply (`1100 + Math.random() * 700` ms); overridable in tests.
final babyChatReplyDelayProvider = Provider<Duration Function()>((ref) {
  final random = math.Random();
  return () => Duration(milliseconds: 1100 + (random.nextDouble() * 700).floor());
});

class BabyChatScreen extends ConsumerStatefulWidget {
  const BabyChatScreen({super.key, required this.onBack, this.onOpenAssistant});
  final VoidCallback onBack;
  final VoidCallback? onOpenAssistant;

  @override
  ConsumerState<BabyChatScreen> createState() => _BabyChatScreenState();
}

class _Ready {
  const _Ready(this.bytes);
  final Uint8List bytes;
}

class _BabyChatScreenState extends ConsumerState<BabyChatScreen> {
  final ScrollController _list = ScrollController();
  final TextEditingController _draft = TextEditingController();
  final FocusNode _focus = FocusNode();
  bool _typing = false;
  bool _care = false;
  String? _busy;
  _Ready? _ready;
  bool _delivering = false;
  bool _disposed = false;
  String? _scheduledFor;
  int _lastLength = -1;
  bool _lastTyping = false;

  @override
  void initState() {
    super.initState();
    _draft.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _disposed = true;
    _list.dispose();
    _draft.dispose();
    _focus.dispose();
    super.dispose();
  }

  List<BabyChatMessage> get _thread => ref.read(babyChatProvider).thread;

  void _setThread(List<BabyChatMessage> messages) =>
      ref.read(babyChatThreadsProvider.notifier).setThread(ref.read(babyChatProvider).today, messages);

  // Ask for notifications here (a natural moment) and keep the next week scheduled.
  void _schedule(BabyChatView chat) {
    final key = '${chat.text.language}:${chat.userId}';
    if (_scheduledFor == key) return;
    _scheduledFor = key;
    unawaited(scheduleBabyChatNotifications(ref.read(babyChatNotificationPlannerProvider), chat.text, chat.userId, ask: true)
        .catchError((Object _) {}));
  }

  // Deliver today's messages with a typing pause before each.
  Future<void> _deliver(List<BabyChatMessage> pending) async {
    if (_delivering) return;
    _delivering = true;
    try {
      for (final msg in pending) {
        if (_thread.any((m) => m.id == msg.id)) continue;
        setState(() => _typing = true);
        await Future<void>.delayed(const Duration(milliseconds: 1300));
        if (_disposed) return;
        setState(() => _typing = false);
        _setThread([..._thread, msg.copyWith(at: DateTime.now().millisecondsSinceEpoch)]);
        unawaited(HapticFeedback.lightImpact());
        await Future<void>.delayed(const Duration(milliseconds: 350));
        if (_disposed) return;
      }
    } finally {
      _delivering = false;
    }
  }

  void _scrollToEnd(BabyChatView chat) {
    if (chat.thread.length == _lastLength && _typing == _lastTyping) return;
    _lastLength = chat.thread.length;
    _lastTyping = _typing;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_list.hasClients) return;
      _list.animateTo(_list.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    });
  }

  Future<void> _send() async {
    final chat = ref.read(babyChatProvider);
    final value = _draft.text.trim();
    if (value.isEmpty || _typing) return;
    final text = chat.text;
    final mine = BabyChatMessage(
      id: '${chat.today}-m${DateTime.now().millisecondsSinceEpoch}',
      from: 'mom',
      text: value.length > 300 ? value.substring(0, 300) : value,
      at: DateTime.now().millisecondsSinceEpoch,
    );
    final next = [..._thread, mine];
    _setThread(next);
    _draft.clear();
    unawaited(HapticFeedback.lightImpact());
    setState(() => _typing = true);
    final seed = '${chat.userId}:${chat.today}:${next.length}';
    // Health or worry: a loving curated line plus the "talk to your doctor" card, never AI.
    final careLocal = hasCareTopic(value, chat.language);
    final results = await Future.wait<Object?>([
      careLocal ? Future.value(const BabyAiResult(care: true)) : askBabyAi(ref.read(babyChatInvokeProvider), value, chat.facts, chat.language),
      Future<void>.delayed(ref.read(babyChatReplyDelayProvider)()),
    ]);
    if (_disposed) return;
    final ai = results.first! as BabyAiResult;
    setState(() => _typing = false);
    final care = text.reply('care');
    final reply = ai.care ? care[next.length % care.length] : (ai.reply ?? babyReply(value, text, chat.facts, chat.language, seed));
    _setThread([..._thread, BabyChatMessage(id: '${chat.today}-b${DateTime.now().millisecondsSinceEpoch}', from: 'baby', text: reply, at: DateTime.now().millisecondsSinceEpoch)]);
    if (ai.care) setState(() => _care = true);
    unawaited(HapticFeedback.lightImpact());
  }

  void _fail(Object error, BabyChatText text) {
    final code = error is ShareError ? error.code : 'UNKNOWN';
    AToastHost.of(context).show(title: text.u('share_error'), description: code, destructive: true);
  }

  // Step 1: render. Step 2 (a fresh tap in the preview) shares or saves.
  Future<void> _render(ShareChatInput input, BabyChatText text) async {
    setState(() => _busy = 'photo');
    try {
      final bytes = await ref.read(babyChatPhotoRendererProvider)(input);
      if (mounted) setState(() => _ready = _Ready(bytes));
    } catch (error) {
      if (mounted) _fail(error, text);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _shareReady(String fileBase, BabyChatText text) async {
    final ready = _ready;
    if (ready == null) return;
    try {
      await shareMedia(ref.read(babyChatSharerProvider), ready.bytes, fileBase, text.u('share_text'));
    } catch (error) {
      if (mounted) _fail(error, text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = ref.watch(babyChatProvider);
    final a = context.a;
    final text = chat.text;
    final facts = chat.facts;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    _schedule(chat);
    if (chat.pendingDaily.isNotEmpty && !_delivering) {
      final pending = chat.pendingDaily;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_disposed) unawaited(_deliver(pending));
      });
    }
    _scrollToEnd(chat);

    String u(String k) => text.u(k);
    final sizeLine = facts.fruit != null ? u('size').replaceAll('{fruit}', facts.fruit!) : '';
    final weekLine = u('week').replaceAll('{n}', '${facts.week}');
    final subtitle = [weekLine, sizeLine].where((s) => s.isNotEmpty).join(' · ');
    final cm = facts.cm;
    final chip = cm != null && cm >= 1 ? '${babyChatOneDecimal(cm)} ${tr('common_sm', 'sm')}' : null;
    final dayLabel = '$weekLine · ${u('today')}';
    final shown = chat.thread.isNotEmpty ? chat.thread : chat.previousThread;
    final canShare = chat.thread.any((m) => m.from == 'mom') && chat.thread.any((m) => m.from == 'baby');
    final fileBase = 'anacan-korpem-${chat.today}';
    final pad = MediaQuery.paddingOf(context);
    final insets = MediaQuery.viewInsetsOf(context);
    final ready = _ready;

    final header = ClipRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: a.surface.withValues(alpha: a.surface.a * 0.78),
            border: Border(bottom: BorderSide(color: a.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(children: [
              PressScale(
                onTap: widget.onBack,
                child: Semantics(
                  button: true,
                  label: tr('common_geri', 'Geri'),
                  child: SizedBox.square(dimension: 36, child: Center(child: AIcon(AIcons.arrowLeft, size: 22, color: a.coral, mirrorInRtl: true))),
                ),
              ),
              const SizedBox(width: 10),
              const BabyChatAvatar(),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text('${u('title')} 💛', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: a.ink, height: 1.5)),
                  Text(
                    _typing ? u('typing') : subtitle,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, height: 1.5, color: _typing ? a.coral : a.inkSoft, fontWeight: _typing ? FontWeight.w600 : FontWeight.w400),
                  ),
                ]),
              ),
              if (chip != null) ...[
                const SizedBox(width: 10),
                Container(
                  key: const ValueKey('bc-chip'),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    // `.bc-chip i { background: #3bb273 }` (one-off literal of baby-chat.css).
                    Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF3BB273), shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text(chip, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: a.coral, height: 1.5)),
                  ]),
                ),
              ],
            ]),
          ),
        ),
      ),
    );

    final items = <Widget>[
      Center(
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: a.surface.withValues(alpha: a.surface.a * 0.75), borderRadius: BorderRadius.circular(999)),
          child: Text(dayLabel, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5)),
        ),
      ),
      if (chat.thread.isEmpty && !chat.arrived)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Text(u('card_wait'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13.5, color: a.inkSoft, height: 1.5)),
        ),
      for (final m in shown) BabyChatBubble(key: ValueKey(m.id), message: m),
      if (_typing) BabyChatTypingBubble(key: const ValueKey('typing'), label: u('typing')),
      if (_care && !_typing) _careCard(a, u),
      if (canShare && !_typing) _shareCard(a, u, ShareChatInput(messages: chat.thread, text: text, subtitle: subtitle, chip: chip, dayLabel: dayLabel, rtl: rtl), text),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
        child: Text(u('about'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: a.inkFaint, height: 1.5)),
      ),
    ];

    final list = ListView.separated(
      key: const ValueKey('bc-list'),
      controller: _list,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (_, i) => items[i],
    );

    final canSend = _draft.text.trim().isNotEmpty && !_typing;
    final input = DecoratedBox(
      decoration: BoxDecoration(color: a.surface.withValues(alpha: a.surface.a * 0.7), border: Border(top: BorderSide(color: a.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + (insets.bottom > 0 ? 0 : pad.bottom)),
        child: Row(children: [
          Expanded(
            child: Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: AlignmentDirectional.centerStart,
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: _focus.hasFocus ? a.coral : a.line),
              ),
              child: Semantics(
                label: u('placeholder'),
                textField: true,
                child: Stack(alignment: AlignmentDirectional.centerStart, children: [
                  if (_draft.text.isEmpty)
                    IgnorePointer(
                      child: Text(u('placeholder'), maxLines: 1, overflow: TextOverflow.clip, style: phoneInputStyle(context, TextStyle(fontSize: 15, color: a.inkFaint, height: 1.2))),
                    ),
                  EditableText(
                    key: const ValueKey('bc-input'),
                    controller: _draft,
                    focusNode: _focus,
                    maxLines: 1,
                    inputFormatters: [LengthLimitingTextInputFormatter(300)],
                    // `.bc-input input` (15px) loses to keyboard.css's phone rule.
                    style: phoneInputStyle(context, TextStyle(fontSize: 15, color: a.ink, height: 1.2)),
                    cursorColor: a.ink,
                    backgroundCursorColor: a.inkFaint,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => unawaited(_send()),
                  ),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 8),
          PressScale(
            onTap: canSend ? () => unawaited(_send()) : null,
            child: Semantics(
              button: true,
              enabled: canSend,
              label: tr('helpscreen_gonder_3f11bd', 'Göndər'),
              child: Container(
                key: const ValueKey('bc-send'),
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: canSend ? a.coral : a.pink1, shape: BoxShape.circle),
                child: Center(child: AIcon(AIcons.send, size: 19, color: canSend ? const Color(0xFFFFFFFF) : a.coral, mirrorInRtl: true)),
              ),
            ),
          ),
        ]),
      ),
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [a.bg, Color.lerp(a.bg, a.peach1, 0.2)!],
        ),
      ),
      child: Stack(children: [
        Padding(
          padding: EdgeInsets.only(bottom: insets.bottom),
          child: Column(children: [
            header,
            Expanded(child: list),
            input,
          ]),
        ),
        if (ready != null)
          Positioned.fill(
            child: OverlayBackHandler(
              open: true,
              onClose: () => setState(() => _ready = null),
              child: BabyChatShareSheet(
                bytes: ready.bytes,
                title: u('share_ready_photo'),
                shareLabel: isNativeShare() ? '${u('share_now')} · ${u('save')}' : u('share_now'),
                onClose: () => setState(() => _ready = null),
                onShare: () => unawaited(_shareReady(fileBase, text)),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _careCard(ATokens a, String Function(String) u) => Container(
        key: const ValueKey('bc-care'),
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(18)),
        child: Semantics(
          container: true,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(u('care_text'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.45, color: a.lavInk)),
            if (widget.onOpenAssistant != null) ...[
              const SizedBox(height: 8),
              PressScale(
                onTap: widget.onOpenAssistant,
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(u('care_cta'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: a.lavInk)),
                  ]),
                ),
              ),
            ],
          ]),
        ),
      );

  Widget _shareCard(ATokens a, String Function(String) u, ShareChatInput input, BabyChatText text) {
    final busy = _busy != null;
    return Container(
      key: const ValueKey('bc-share'),
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          AIcon(AIcons.share2, size: 15, color: a.ink),
          const SizedBox(width: 6),
          Flexible(child: Text(u('share_title'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink, height: 1.5))),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 3, bottom: 10),
          child: Text(u('share_sub'), style: TextStyle(fontSize: 12, color: a.inkSoft, height: 1.5)),
        ),
        Row(children: [
          Expanded(
            child: BabyChatPillButton(
              key: const ValueKey('bc-share-photo'),
              label: u('share_photo'),
              icon: _busy == 'photo' ? ALoader(size: 16, color: a.ink) : AIcon(AIcons.image, size: 16, color: a.ink),
              onTap: busy ? null : () => unawaited(_render(input, text)),
            ),
          ),
          if (videoRecordingSupported()) ...[
            const SizedBox(width: 8),
            Expanded(
              child: BabyChatPillButton(
                label: u('share_video'),
                primary: true,
                icon: AIcon(AIcons.clapperboard, size: 16, color: const Color(0xFFFFFFFF)),
                onTap: null,
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}

/// JS `String(Math.round(n * 10) / 10)`.
String babyChatOneDecimal(num n) {
  final v = (n * 10).round() / 10;
  return v == v.roundToDouble() ? v.toInt().toString() : v.toString();
}
