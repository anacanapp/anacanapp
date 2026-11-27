// Ported from: src/components/consent/AiConsentGate.tsx
//
// Anacan.AI first-use consent (kind ai_assistant). The chat renders only after a granted consent; a decision
// already made on this device opens it at once (and is re-checked against the server in the background).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../../state/user_store.dart';
import '../entry/consent/consent_copy.dart';
import '../entry/consent/consent_gate.dart';
import '../entry/consent/consent_gate_controller.dart' show consentServiceProvider;
import '../entry/consent/consent_gate_screen.dart' show showConsentSaveFailure;
import '../settings/ui/settings_ui.dart' show ALoader;

enum _Phase { checking, ask, open }

class AiConsentGate extends ConsumerStatefulWidget {
  const AiConsentGate({super.key, required this.userId, required this.backend, this.kvkk = false, required this.onDecline, required this.child});

  final String? userId;
  final String backend;

  /// Türkiye user: the owner's KVKK Açık Rıza text for the AI assistant.
  final bool kvkk;

  /// Declined: the chat stays closed (back to Home); the rest of the app keeps working.
  final VoidCallback onDecline;
  final Widget child;

  @override
  ConsumerState<AiConsentGate> createState() => _AiConsentGateState();
}

class _AiConsentGateState extends ConsumerState<AiConsentGate> {
  late _Phase _phase;
  ConsentState? _state;
  bool _saving = false;
  int _run = 0;

  ConsentService get _service => ref.read(consentServiceProvider);

  @override
  void initState() {
    super.initState();
    _phase = _initialPhase();
    _check();
  }

  _Phase _initialPhase() {
    final uid = widget.userId;
    final local = uid == null ? null : _service.readLocalAiConsent(widget.backend, uid);
    return local == true ? _Phase.open : _Phase.checking;
  }

  @override
  void didUpdateWidget(AiConsentGate old) {
    super.didUpdateWidget(old);
    if (old.userId != widget.userId || old.backend != widget.backend) {
      _phase = _initialPhase();
      _check();
    }
  }

  void _check() {
    final uid = widget.userId;
    final run = ++_run;
    if (uid == null) return;
    final backend = widget.backend;
    final service = _service;
    unawaited(service.fetchConsentState().then((next) {
      if (!mounted || run != _run) return;
      service.syncLocalAiConsent(backend, uid, next);
      final decision = decideAiConsent(next, service.readLocalAiConsent(backend, uid));
      setState(() {
        _state = next;
        _phase = decision == AiConsentDecision.open ? _Phase.open : _Phase.ask;
      });
    }));
  }

  Future<void> _decide(bool granted) async {
    final uid = widget.userId;
    if (uid == null) return;
    setState(() => _saving = true);
    final toasts = AToastHost.of(context);
    final service = _service;
    try {
      final result = await service.setAiConsent(widget.backend, uid, granted, _state?.gate.version, kvkk: widget.kvkk);
      if (granted) {
        if (mounted) setState(() => _phase = _Phase.open);
      } else {
        toasts.show(title: ct('ai_consent_declined'));
        widget.onDecline();
      }
      if (granted && !result.synced) {
        showConsentSaveFailure(toasts, service, offline: result.offline, backend: widget.backend, userId: uid);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(userStoreProvider.select((s) => s.language));
    if (widget.userId == null) return const SizedBox.shrink();
    if (_phase == _Phase.open) return widget.child;
    final a = context.a;
    if (_phase == _Phase.checking) {
      return ColoredBox(
        key: const ValueKey('ai-consent-checking'),
        color: a.bg,
        child: Center(child: ALoader(size: 22, color: a.peach2)),
      );
    }
    final pad = MediaQuery.paddingOf(context);
    return ColoredBox(
      color: a.bg,
      child: Padding(
        // `paddingBottom: calc(env(safe-area-inset-bottom) + 96px)`, `px-4`, items-end.
        padding: EdgeInsets.fromLTRB(16, 0, 16, pad.bottom + 96),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Semantics(
              scopesRoute: true,
              explicitChildNodes: true,
              namesRoute: true,
              label: ct('ai_consent_title'),
              child: ACard(
                key: const ValueKey('ai-consent-sheet'),
                padding: const EdgeInsets.all(20),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(15)),
                      child: Center(child: AIcon(AIcons.sparkles, size: 20, color: a.lavInk)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(ct('ai_consent_title'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: a.ink, height: 1.5))),
                  ]),
                  const SizedBox(height: 12),
                  Text(widget.kvkk ? KvkkTexts.aiAssistant : ct('ai_consent_text'), style: TextStyle(fontSize: 13, height: 1.5, color: a.bodyText)),
                  const SizedBox(height: 18),
                  _button(
                    key: const ValueKey('ai-consent-accept'),
                    label: ct('ai_consent_accept'),
                    height: 48,
                    background: a.peach2,
                    color: const Color(0xFFFFFFFF),
                    weight: FontWeight.w700,
                    spinner: _saving,
                    onTap: _saving ? null : () => unawaited(_decide(true)),
                  ),
                  const SizedBox(height: 6),
                  _button(
                    key: const ValueKey('ai-consent-decline'),
                    label: ct('ai_consent_decline'),
                    height: 44,
                    background: null,
                    color: a.inkSoft,
                    weight: FontWeight.w600,
                    spinner: false,
                    onTap: _saving ? null : () => unawaited(_decide(false)),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _button({
    required Key key,
    required String label,
    required double height,
    required Color? background,
    required Color color,
    required FontWeight weight,
    required bool spinner,
    required VoidCallback? onTap,
  }) {
    final dim = onTap == null && background != null;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        key: key,
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Opacity(
          opacity: dim ? 0.6 : 1,
          child: Container(
            height: height,
            decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
            alignment: Alignment.center,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (spinner) ...[ALoader(size: 16, color: color), const SizedBox(width: 8)],
              Flexible(child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: weight, color: color))),
            ]),
          ),
        ),
      ),
    );
  }
}
