// Ported from: src/components/EmailVerificationScreen.tsx, src/data/email-verification/index.ts (ui copy,
//              own → en → az)
//
// New e-mail/password accounts confirm their e-mail with a 6-digit code before onboarding. The first code is sent
// automatically (once per app session), resend has a 60 s timer, the field accepts one-time-code autofill.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../data/email_verification_copy.g.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';

/// `useEmailVerificationText(language).ui`.
Map<String, String> emailVerificationText(String language) =>
    kEmailVerificationCopy[language] ?? kEmailVerificationCopy['en'] ?? kEmailVerificationCopy['az']!;

/// sessionStorage `anacan_email_code_sent_v1:<userId>` (per app process).
final Set<String> emailCodeSentThisSession = <String>{};

class EmailVerificationScreen extends ConsumerStatefulWidget {
  const EmailVerificationScreen({super.key, required this.email, required this.onVerified});
  final String email;
  final VoidCallback onVerified;

  @override
  ConsumerState<EmailVerificationScreen> createState() => _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends ConsumerState<EmailVerificationScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  String? _busy; // 'send' | 'confirm'
  String? _error;
  String? _notice;
  int _wait = 0;
  bool _done = false;
  Timer? _tick;
  Timer? _verified;

  String get _language {
    final l = ref.read(userStoreProvider).language;
    return l.isEmpty ? 'az' : l;
  }

  @override
  void initState() {
    super.initState();
    final userId = ref.read(authUserProvider)?.id;
    if (userId != null) {
      if (!emailCodeSentThisSession.contains(userId)) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _send());
      } else {
        _wait = 0;
      }
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    _verified?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _startWait(int seconds) {
    _tick?.cancel();
    setState(() => _wait = seconds);
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _wait -= 1);
      if (_wait <= 0) t.cancel();
    });
  }

  Future<void> _send() async {
    if (_busy != null || !mounted) return;
    setState(() {
      _busy = 'send';
      _error = null;
      _notice = null;
    });
    final result = await ref.read(emailVerificationApiProvider).send(_language);
    if (!mounted) return;
    setState(() => _busy = null);
    if (result.ok) {
      _startWait((result.retryIn ?? 60).toInt());
      setState(() => _notice = 'sent');
      final userId = ref.read(authUserProvider)?.id;
      if (userId != null) emailCodeSentThisSession.add(userId);
    } else {
      setState(() => _error = result.error ?? 'send_failed');
      if (result.retryIn != null && result.retryIn! > 0) _startWait(result.retryIn!.toInt());
    }
    _focus.requestFocus();
  }

  Future<void> _confirm([String? value]) async {
    final v = value ?? _code.text;
    if (_busy != null || v.length != 6) return;
    setState(() {
      _busy = 'confirm';
      _error = null;
    });
    final result = await ref.read(emailVerificationApiProvider).confirm(v, _language);
    if (!mounted) return;
    setState(() => _busy = null);
    if (result.ok) {
      setState(() => _done = true);
      _verified = Timer(const Duration(milliseconds: 900), widget.onVerified);
    } else {
      setState(() => _error = result.error ?? 'send_failed');
      if (result.error == 'wrong_code') _code.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final t = emailVerificationText(language.isEmpty ? 'az' : language);
    final a = context.a;
    final pad = MediaQuery.paddingOf(context);
    final invalid = _error != null && _error != 'rate_limited';
    final parts = t['subtitle']!.split('{email}');
    final canConfirm = _busy == null && _code.text.length == 6;
    final canResend = _wait <= 0 && _busy == null;

    return Material(
      type: MaterialType.transparency,
      child: AScope(
        child: ColoredBox(
          color: a.bg,
          child: Padding(
            padding: EdgeInsets.only(top: pad.top),
            child: Center(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      MotionIn(
                        offset: const Offset(0, 14),
                        child: ACard(
                          padding: const EdgeInsets.all(24),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Center(
                              child: Container(
                                width: 56,
                                height: 56,
                                margin: const EdgeInsets.only(bottom: 14),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(18)),
                                child: AIcon(AIcons.mailCheck, size: 26, color: a.peach2),
                              ),
                            ),
                            Text(_done ? t['verified']! : t['title']!,
                                textAlign: TextAlign.center, style: css(21, FontWeight.w900, color: a.ink)),
                            if (!_done) ...[
                              Padding(
                                padding: const EdgeInsets.only(top: 8, bottom: 4),
                                child: Text.rich(
                                  TextSpan(children: [
                                    TextSpan(text: parts.first),
                                    TextSpan(
                                        text: '\u2066${widget.email}\u2069', // <b dir="ltr">
                                        style: TextStyle(fontWeight: FontWeight.w700, color: a.ink)),
                                    if (parts.length > 1) TextSpan(text: parts[1]),
                                  ]),
                                  textAlign: TextAlign.center,
                                  style: css(14, FontWeight.w400, color: a.bodyText),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 18),
                                child: Text(t['why']!,
                                    textAlign: TextAlign.center, style: css(12, FontWeight.w400, height: 1.45, color: a.inkSoft)),
                              ),
                              Directionality(
                                textDirection: TextDirection.ltr,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
                                  decoration: BoxDecoration(
                                    color: a.surfaceSoft,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(width: 2, color: invalid ? a.peach2 : const Color(0x00000000)),
                                  ),
                                  child: TextField(
                                    key: const ValueKey('email-code'),
                                    controller: _code,
                                    focusNode: _focus,
                                    autofocus: true,
                                    keyboardType: TextInputType.number,
                                    autofillHints: const [AutofillHints.oneTimeCode],
                                    textAlign: TextAlign.center,
                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                                    style: css(30, FontWeight.w800, lsPx: 12, color: a.ink, height: 1.2),
                                    cursorColor: a.ink,
                                    decoration: InputDecoration(
                                      isCollapsed: true,
                                      border: InputBorder.none,
                                      hintText: '••••••',
                                      hintStyle: css(30, FontWeight.w800, lsPx: 12, color: context.tokens.shadcn.mutedForeground, height: 1.2),
                                      semanticCounterText: t['code_label'],
                                    ),
                                    onChanged: (value) {
                                      setState(() => _error = null);
                                      if (value.length == 6) _confirm(value);
                                    },
                                  ),
                                ),
                              ),
                              Container(
                                constraints: const BoxConstraints(minHeight: 22),
                                margin: const EdgeInsets.only(top: 10, bottom: 6),
                                alignment: Alignment.center,
                                child: Semantics(
                                  liveRegion: true,
                                  child: Text(
                                    _error != null ? (t[_error!] ?? t['send_failed']!) : _notice == 'sent' ? '${t['sent']} ✓' : '',
                                    textAlign: TextAlign.center,
                                    style: css(13, FontWeight.w600, color: _error != null ? a.alertInk : a.greenInk),
                                  ),
                                ),
                              ),
                              GestureDetector(
                                key: const ValueKey('email-confirm'),
                                onTap: canConfirm ? () => _confirm() : null,
                                child: Opacity(
                                  opacity: canConfirm ? 1 : 0.6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 18),
                                    decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                      if (_busy == 'confirm') ...[
                                        const EntryLoader(size: 16, color: Color(0xFFFFFFFF)),
                                        const SizedBox(width: 6),
                                      ],
                                      Text(' ${t['confirm']}', style: context.aText.aCtaBtn),
                                    ]),
                                  ),
                                ),
                              ),
                              GestureDetector(
                                key: const ValueKey('email-resend'),
                                behavior: HitTestBehavior.opaque,
                                onTap: canResend ? _send : null,
                                child: Container(
                                  margin: const EdgeInsets.only(top: 10),
                                  padding: const EdgeInsets.all(12),
                                  alignment: Alignment.center,
                                  child: _busy == 'send'
                                      ? EntryLoader(size: 15, color: a.peach2)
                                      : Text(
                                          _wait > 0 ? t['resend_in']!.replaceFirst('{s}', '$_wait') : t['resend']!,
                                          textAlign: TextAlign.center,
                                          style: css(14, FontWeight.w700, color: _wait > 0 ? a.inkFaint : a.peach2),
                                        ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(t['spam_hint']!,
                                    textAlign: TextAlign.center, style: css(12, FontWeight.w400, height: 1.45, color: a.inkSoft)),
                              ),
                            ],
                          ]),
                        ),
                      ),
                      if (!_done)
                        GestureDetector(
                          key: const ValueKey('email-wrong'),
                          onTap: () => ref.read(entryAuthActionsProvider).signOut(),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 18),
                            child: Text(t['wrong_email']!,
                                textAlign: TextAlign.center,
                                style: css(13, FontWeight.w600, color: a.inkSoft)
                                    .copyWith(decoration: TextDecoration.underline, decorationColor: a.inkSoft)),
                          ),
                        ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
