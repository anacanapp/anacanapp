// Ported from: src/components/FeedbackSheet.tsx, src/styles/care.css (.cx-stack, .cx-sub, .cx-chips, .cx-chip,
//              .cx-input, .cx-warn, .cx-celebrate, .cx-big, .a3-btn.cx-wide)
//
// In-app feedback: stars, then what to fix (1–3) or what works (4–5), then a thank-you. Never links to a store.
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../design/design.dart';
import '../../state/state.dart';
import '../settings/copy/feature_copy.dart';
import '../settings/ui/settings_ui.dart';
import 'data/app_feedback.dart';

/// Opens the feedback sheet (`<FeedbackSheet open auto? onClose />`). [auto] = the day-14 prompt (adds "Later",
/// marks a dismissal when closed without sending).
Future<void> showFeedbackSheet(BuildContext context, {bool auto = false}) {
  final key = GlobalKey<_FeedbackSheetBodyState>();
  return Navigator.of(context, rootNavigator: true).push<void>(ASheetRoute<void>(
    onBack: () => key.currentState?._close(),
    builder: (ctx) => FeedbackSheetBody(key: key, auto: auto, onClose: () => Navigator.of(ctx).maybePop()),
  ));
}

class FeedbackSheetBody extends ConsumerStatefulWidget {
  const FeedbackSheetBody({super.key, required this.onClose, this.auto = false});
  final VoidCallback onClose;
  final bool auto;
  @override
  ConsumerState<FeedbackSheetBody> createState() => _FeedbackSheetBodyState();
}

enum _SendState { idle, sending, done, error }

class _FeedbackSheetBodyState extends ConsumerState<FeedbackSheetBody> {
  int _rating = 0;
  final List<String> _reasons = <String>[];
  final TextEditingController _message = TextEditingController();
  _SendState _state = _SendState.idle;
  bool _closed = false;

  bool get _low => _rating > 0 && _rating <= 3;

  void _close() {
    if (_closed) return;
    _closed = true;
    if (widget.auto && _state != _SendState.done) ref.read(feedbackStoreProvider).markFeedbackDismissed();
    widget.onClose();
  }

  @override
  void dispose() {
    if (!_closed && widget.auto && _state != _SendState.done) ref.read(feedbackStoreProvider).markFeedbackDismissed();
    _message.dispose();
    super.dispose();
  }

  Future<void> _send(FeatureText t) async {
    final user = ref.read(authUserProvider);
    if (user == null || _rating == 0) return;
    setState(() => _state = _SendState.sending);
    try {
      final store = ref.read(userStoreProvider);
      await ref.read(feedbackSenderProvider).send(
            userId: user.id,
            rating: _rating,
            reasons: List.of(_reasons),
            message: _message.text,
            subject: t('subject'),
            lifeStage: store.lifeStage,
            language: store.language,
          );
      if (!mounted) return;
      setState(() => _state = _SendState.done);
      HapticFeedback.mediumImpact();
    } catch (_) {
      if (mounted) setState(() => _state = _SendState.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final t = feedbackText(language);
    final a = context.a;
    final done = _state == _SendState.done;
    final canSend = _rating > 0 && _state != _SendState.sending && !(_low && _reasons.isEmpty && _message.text.trim().isEmpty);
    final footer = done
        ? AButton(variant: AButtonVariant.accent, block: true, onPressed: () {
            _closed = true;
            widget.onClose();
          }, child: Text(t('close')))
        : Row(children: <Widget>[
            if (widget.auto) ...<Widget>[
              Expanded(child: AButton(variant: AButtonVariant.ghost, block: true, onPressed: _close, child: Text(t('later')))),
              const SizedBox(width: 8),
            ],
            Expanded(
              flex: widget.auto ? 2 : 1,
              child: AButton(
                variant: AButtonVariant.accent,
                block: true,
                onPressed: canSend ? () => _send(t) : null,
                child: Text(_state == _SendState.sending ? t('sending') : t('send')),
              ),
            ),
          ]);
    final stars = t.list('stars');
    final options = _low ? kLowReasons : kHighReasons;
    final labels = t.map(_low ? 'low_reasons' : 'high_reasons');
    final sub = px(13, color: a.inkSoft, height: 1.45);
    final body = done
        ? FadeRise(
            dy: 0,
            scaleFrom: 0.9,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 8, 0, 4),
              child: Column(children: <Widget>[
                Text(_low ? '🙏' : '🥰', style: const TextStyle(fontSize: 64, height: 1)),
                const SizedBox(height: 12),
                Text(_low ? t('thanks_low') : t('thanks_high'), textAlign: TextAlign.center, style: sub.copyWith(fontSize: 15, color: a.ink)),
              ]),
            ),
          )
        : VGap(gap: 16, children: <Widget>[
            Text(t('subtitle'), textAlign: TextAlign.center, style: sub),
            Semantics(
              label: t('title'),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                for (var n = 1; n <= 5; n++) ...<Widget>[
                  if (n > 1) const SizedBox(width: 6),
                  Semantics(
                    inMutuallyExclusiveGroup: true,
                    checked: _rating == n,
                    label: stars.length >= n ? stars[n - 1] : '$n',
                    button: true,
                    child: PressScale(
                      scale: 0.85,
                      onTap: () {
                        setState(() {
                          _rating = n;
                          _reasons.clear();
                        });
                        HapticFeedback.lightImpact();
                      },
                      child: AnimatedScale(
                        scale: _rating == n ? 1.15 : 1,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOutBack,
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: _Star(filled: n <= _rating),
                        ),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 20),
              child: Text(_rating > 0 && stars.length >= _rating ? stars[_rating - 1] : '', textAlign: TextAlign.center, style: px(16, weight: FontWeight.w800, color: a.ink)),
            ),
            if (_rating > 0)
              FadeRise(
                key: ValueKey<bool>(_low),
                dy: 8,
                child: VGap(gap: 16, children: <Widget>[
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    Text(_low ? t('low_title') : t('high_title'), style: px(15, weight: FontWeight.w700, color: a.ink)),
                    Text(_low ? t('low_sub') : t('high_sub'), style: sub),
                  ]),
                  Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
                    for (final r in options) CxChip(label: labels[r] ?? r, pressed: _reasons.contains(r), onTap: () => setState(() => _reasons.contains(r) ? _reasons.remove(r) : _reasons.add(r))),
                  ]),
                  CxInput(controller: _message, placeholder: _low ? t('message_low') : t('message_high'), minHeight: 90, maxLength: 1500, onChanged: (_) => setState(() {})),
                  if (_state == _SendState.error) CxWarn(t('error')),
                ]),
              ),
          ]);
    return ASheet(
      full: false,
      title: Text(done ? '💛' : t('title')),
      onClose: _close,
      footer: footer,
      children: <Widget>[body],
    );
  }
}

class _Star extends StatelessWidget {
  const _Star({required this.filled});
  final bool filled;
  @override
  Widget build(BuildContext context) {
    // <Star size={40} strokeWidth={1.6} fill={#ffc94d | none} color={#f0a500 | --a-ink-faint} />
    const fill = Color(0xFFFFC94D); // FeedbackSheet.tsx literal
    const stroke = Color(0xFFF0A500); // FeedbackSheet.tsx literal
    return SizedBox(
      width: 40,
      height: 40,
      child: Stack(children: <Widget>[
        if (filled) Positioned.fill(child: CustomPaint(painter: _StarFill(fill))),
        AIcon(AIcons.star, size: 40, strokeWidth: 1.6, color: filled ? stroke : context.a.inkFaint),
      ]),
    );
  }
}

/// lucide `star` polygon filled (the SVG asset is stroke-only).
class _StarFill extends CustomPainter {
  _StarFill(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    const pts = <Offset>[
      Offset(12, 2), Offset(15.09, 8.26), Offset(22, 9.27), Offset(17, 14.14), Offset(18.18, 21.02),
      Offset(12, 17.77), Offset(5.82, 21.02), Offset(7, 14.14), Offset(2, 9.27), Offset(8.91, 8.26),
    ];
    final path = Path()..moveTo(pts.first.dx * s, pts.first.dy * s);
    for (final p in pts.skip(1)) {
      path.lineTo(p.dx * s, p.dy * s);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_StarFill old) => old.color != color;
}

/// `.cx-chip` (`[aria-pressed=true]` peach).
class CxChip extends StatelessWidget {
  const CxChip({super.key, required this.label, required this.pressed, required this.onTap});
  final String label;
  final bool pressed;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: pressed,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 38),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: pressed ? a.peach1 : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: pressed ? a.peach2 : a.lineStrong, width: 1.5),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
            Text(label, style: px(13.5, weight: FontWeight.w700, color: pressed ? a.accentInk : a.ink)),
          ]),
        ),
      ),
    );
  }
}

/// `.cx-input` (min-height 48, radius 14, 2px `--a-line-strong`, focus `--a-peach-2`, 15px).
class CxInput extends StatefulWidget {
  const CxInput({super.key, this.controller, this.placeholder, this.minHeight = 48, this.maxLength, this.onChanged, this.multiline = true, this.fieldKey});
  final TextEditingController? controller;
  final String? placeholder;
  final double minHeight;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final bool multiline;
  final Key? fieldKey;
  @override
  State<CxInput> createState() => _CxInputState();
}

class _CxInputState extends State<CxInput> {
  final FocusNode _focus = FocusNode();
  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(15, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        constraints: BoxConstraints(minHeight: widget.minHeight),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong, width: 2),
        ),
        child: TextField(
          key: widget.fieldKey,
          controller: widget.controller,
          focusNode: _focus,
          onChanged: widget.onChanged,
          maxLines: widget.multiline ? null : 1,
          inputFormatters: widget.maxLength == null ? null : <TextInputFormatter>[LengthLimitingTextInputFormatter(widget.maxLength)],
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: widget.placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
        ),
      ),
    );
  }
}

/// `.cx-warn`.
class CxWarn extends StatelessWidget {
  const CxWarn(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(18)),
      child: Text(text, style: px(12.5, color: a.warnInk, height: 1.45)),
    );
  }
}
