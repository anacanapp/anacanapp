// Ported from: src/components/consent/ConsentGateScreen.tsx, src/components/consent/consentSaveFeedback.tsx
//
// Full-screen consent gate. Nothing is pre-ticked; Continue needs the three required items. The legal documents
// open in-app on top of the gate through the LegalScreen registered by the settings feature (ScreenId.legal).
import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design/design.dart';
import '../../../shell/feature_registry.dart';
import '../../../shell/nav/ids.dart';
import '../../../state/user_store.dart';
import '../widgets/entry_widgets.dart';
import 'consent_copy.dart';
import 'consent_gate.dart';
import 'consent_gate_controller.dart';

/// `window.open(KVKK_TEXTS.notice_url, '_blank')`.
final kvkkNoticeOpenerProvider = Provider<Future<void> Function(Uri)>((ref) {
  return (uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // no browser
    }
  };
});

/// `showConsentSaveFailure(toast, {offline, backend, userId})`: "saved on this device" only for a real
/// connectivity failure; otherwise an error toast with a retry of the stored decision.
void showConsentSaveFailure(
  AToastController toasts,
  ConsentService service, {
  required bool offline,
  required String backend,
  required String userId,
}) {
  if (offline) {
    toasts.show(title: ct('consent_saved_offline'));
    return;
  }
  Future<void> retry() async {
    bool ok;
    try {
      ok = await service.flushPendingConsents(backend, userId);
    } catch (_) {
      ok = false;
    }
    if (ok) {
      toasts.show(title: ct('consent_updated'));
    } else {
      showConsentSaveFailure(toasts, service, offline: service.deviceOffline?.call() ?? false, backend: backend, userId: userId);
    }
  }

  toasts.show(
    title: ct('consent_save_failed'),
    destructive: true,
    action: _ToastAction(key: const ValueKey('consent-retry'), label: ct('consent_retry'), onTap: () => retry()),
  );
}

class _ToastAction extends StatelessWidget {
  const _ToastAction({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Semantics(button: true, label: label, child: Text(label)),
      );
}

class ConsentGateScreen extends ConsumerStatefulWidget {
  const ConsentGateScreen({
    super.key,
    required this.userId,
    required this.backend,
    required this.version,
    this.kvkk = false,
    required this.onAccepted,
    required this.onSignOut,
  });

  final String userId;
  final String backend;
  final String version;

  /// Türkiye user (country TR or language tr): KVKK Açık Rıza wording, child data and İYS channels.
  final bool kvkk;
  final VoidCallback onAccepted;
  final VoidCallback onSignOut;

  @override
  ConsumerState<ConsentGateScreen> createState() => _ConsentGateScreenState();
}

class _ConsentGateScreenState extends ConsumerState<ConsentGateScreen> {
  final Map<String, bool> _choices = {for (final k in kGateChoiceKinds) k: false};
  bool _saving = false;
  String? _doc;

  bool get _ready => canContinue(_choices);

  Future<void> _submit() async {
    if (!_ready || _saving) return;
    setState(() => _saving = true);
    final toasts = AToastHost.of(context);
    final service = ref.read(consentServiceProvider);
    try {
      final r = await service.acceptConsentGate(widget.backend, widget.userId, Map.of(_choices), widget.version, kvkk: widget.kvkk);
      if (!r.synced) {
        showConsentSaveFailure(toasts, service, offline: r.offline, backend: widget.backend, userId: widget.userId);
      }
      widget.onAccepted();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _set(String kind, bool value) => setState(() => _choices[kind] = value);

  @override
  Widget build(BuildContext context) {
    ref.watch(userStoreProvider.select((s) => s.language)); // re-render on language change
    final a = context.a;
    if (_doc != null) {
      final registry = ref.watch(featureRegistryProvider);
      final builder = registry.screen(ScreenId.legal);
      final args = ShellScreenArgs(
        screen: ShellScreen(ScreenId.legal, 'legal/$_doc', _doc),
        onBack: () => setState(() => _doc = null),
      );
      return ColoredBox(
        key: const ValueKey('consent-legal'),
        color: a.bg,
        child: builder != null
            ? builder(context, args)
            : ShellPlaceholder(kind: 'screen', id: 'legal/$_doc', onBack: args.onBack),
      );
    }

    final pad = MediaQuery.paddingOf(context);
    final kvkk = widget.kvkk;
    return Material(type: MaterialType.transparency, child: AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: EdgeInsets.only(top: pad.top + 20, bottom: pad.bottom + 20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: MotionIn(
                offset: const Offset(0, 12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _header(context),
                    if (kvkk) _kvkkNotice(context),
                    ACard(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _row('terms', ct('consent_terms_label'), true,
                            extra: Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text.rich(
                                TextSpan(children: [
                                  _link(ct('consent_terms_link'), 'terms_of_service'),
                                  const TextSpan(text: ' · '),
                                  _link(ct('consent_privacy_link'), 'privacy_policy'),
                                ]),
                                style: css(12, FontWeight.w400, color: a.inkSoft),
                              ),
                            )),
                        _divider(a),
                        kvkk
                            ? _row('health_data', KvkkTexts.healthData, true, small: true)
                            : _row('health_data', ct('consent_health_label'), true,
                                extra: Container(
                                  margin: const EdgeInsets.only(top: 6),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(14)),
                                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Padding(
                                      padding: const EdgeInsets.only(top: 1),
                                      child: AIcon(AIcons.heartPulse, size: 15, color: a.pinkInk),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(ct('consent_health_desc'),
                                          style: css(11.5, FontWeight.w400, height: 1.45, color: a.inkSoft)),
                                    ),
                                  ]),
                                )),
                        _divider(a),
                        _row('age_16', ct('consent_age_label'), true),
                        if (kvkk) ...[_divider(a), _row('child_data', KvkkTexts.childData, false, small: true)],
                        _divider(a),
                        kvkk
                            ? Padding(
                                key: const ValueKey('consent-marketing-kvkk'),
                                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 2),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(KvkkTexts.marketing, style: css(12.5, FontWeight.w500, height: 1.45, color: a.ink)),
                                  _badge(false, a),
                                  Padding(
                                    padding: const EdgeInsets.only(top: 10),
                                    child: Wrap(spacing: 16, runSpacing: 8, children: [
                                      for (final kind in kMarketingChannels)
                                        GestureDetector(
                                          behavior: HitTestBehavior.opaque,
                                          onTap: () => _set(kind, !_choices[kind]!),
                                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                                            _ConsentBox(
                                              key: ValueKey('consent-$kind'),
                                              checked: _choices[kind]!,
                                              size: 18,
                                              radius: 6,
                                              onChanged: (v) => _set(kind, v),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(KvkkTexts.channel(kind), style: css(12.5, FontWeight.w600, color: a.ink)),
                                          ]),
                                        ),
                                    ]),
                                  ),
                                ]),
                              )
                            : _row('marketing', ct('consent_marketing_label'), false,
                                extra: Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(ct('consent_marketing_desc'), style: css(11.5, FontWeight.w400, color: a.inkSoft)),
                                )),
                      ]),
                    ),
                    // Medical note
                    Container(
                      margin: const EdgeInsets.only(top: 14),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: a.disclaimerBg,
                        borderRadius: BorderRadius.circular(a.radiusMd),
                        border: Border.all(color: a.disclaimerBorder),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: AIcon(AIcons.stethoscope, size: 16, color: a.disclaimerInk),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text.rich(
                            TextSpan(children: [
                              TextSpan(text: '${ct('consent_medical_note')} '),
                              _link(ct('consent_disclaimer_link'), 'disclaimer'),
                            ]),
                            style: css(12, FontWeight.w400, height: 1.45, color: a.disclaimerInk),
                          ),
                        ),
                      ]),
                    ),
                    const SizedBox(height: 18),
                    GestureDetector(
                      key: const ValueKey('consent-continue'),
                      onTap: !_ready || _saving ? null : _submit,
                      child: Semantics(
                        button: true,
                        enabled: _ready && !_saving,
                        child: AnimatedOpacity(
                          opacity: !_ready || _saving ? 0.5 : 1,
                          duration: const Duration(milliseconds: 200),
                          curve: ACurves.cssEase,
                          child: Container(
                            height: 48,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              if (_saving) ...[const EntryLoader(size: 16, color: Color(0xFFFFFFFF)), const SizedBox(width: 8)],
                              Text(_saving ? ct('consent_saving') : ct('consent_continue'),
                                  style: css(14, FontWeight.w700, color: const Color(0xFFFFFFFF), height: 20 / 14)),
                            ]),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      key: const ValueKey('consent-sign-out'),
                      onTap: _saving ? null : widget.onSignOut,
                      child: Container(
                        height: 44,
                        alignment: Alignment.center,
                        color: const Color(0x00000000),
                        child: Text(ct('consent_sign_out'), style: css(14, FontWeight.w600, color: a.inkSoft, height: 20 / 14)),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    ));
  }

  Widget _header(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 18),
      child: Column(children: [
        Container(
          width: 60,
          height: 60,
          margin: const EdgeInsets.only(bottom: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(22)),
          child: AIcon(AIcons.shieldCheck, size: 28, color: a.accentInk),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Text(cssUppercase(ct('consent_eyebrow'), ref.read(userStoreProvider).language),
              textAlign: TextAlign.center, style: css(11, FontWeight.w700, lsEm: 0.1, color: a.onBgSoft)),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 8),
          child: Text(ct('consent_title'), textAlign: TextAlign.center, style: css(22, FontWeight.w800, color: a.ink)),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Text(ct('consent_intro'), textAlign: TextAlign.center, style: css(13, FontWeight.w400, color: a.inkSoft)),
        ),
      ]),
    );
  }

  Widget _kvkkNotice(BuildContext context) {
    final a = context.a;
    return GestureDetector(
      key: const ValueKey('consent-kvkk-notice'),
      onTap: () => ref.read(kvkkNoticeOpenerProvider)(Uri.parse(KvkkTexts.noticeUrl)),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(a.radiusMd)),
        child: Row(children: [
          Expanded(
            child: Text(KvkkTexts.noticeLink,
                style: css(13, FontWeight.w700, color: a.blueInk).copyWith(
                    decoration: TextDecoration.underline, decorationColor: a.blueInk)),
          ),
          const SizedBox(width: 8),
          AIcon(AIcons.externalLink, size: 15, color: a.blueInk),
        ]),
      ),
    );
  }

  /// `<button style={{color: accent-ink, fontWeight: 700, …, font: 'inherit'}}>`: the trailing `font` shorthand resets
  /// the weight, so the link keeps the surrounding size and weight (underlined, accent colour).
  InlineSpan _link(String label, String type) {
    final a = context.a;
    return TextSpan(
      text: label,
      style: TextStyle(color: a.accentInk, decoration: TextDecoration.underline, decorationColor: a.accentInk),
      recognizer: (TapGestureRecognizer()..onTap = () => setState(() => _doc = type)),
    );
  }

  Widget _divider(ATokens a) => Container(height: 1, color: a.line);

  /// Inline span in a block whose strut is the inherited 16px / 1.5 → a 24px line.
  Widget _badge(bool required, ATokens a) => Text(
        cssUppercase(required ? ct('consent_required') : ct('consent_optional'), ref.read(userStoreProvider).language),
        style: css(10.5, FontWeight.w700, lsPx: 0.3, height: 24 / 10.5, color: required ? a.accentInk : a.inkFaint),
      );

  Widget _row(String kind, String label, bool required, {Widget? extra, bool small = false}) {
    final a = context.a;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => _set(kind, !_choices[kind]!),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 2),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: _ConsentBox(
              key: ValueKey('consent-$kind'),
              checked: _choices[kind]!,
              size: 22,
              radius: 7,
              onChanged: (v) => _set(kind, v),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label,
                  style: css(small ? 12.5 : 13.5, small ? FontWeight.w500 : FontWeight.w600, height: 1.45, color: a.ink)),
              _badge(required, a),
              ?extra,
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Radix checkbox with the gate classes (`border-2 border-[var(--a-peach-2)]`, checked bg peach-2 + white Check).
class _ConsentBox extends StatelessWidget {
  const _ConsentBox({super.key, required this.checked, required this.size, required this.radius, required this.onChanged});
  final bool checked;
  final double size;
  final double radius;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      checked: checked,
      child: GestureDetector(
        onTap: () => onChanged(!checked),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: checked ? a.peach2 : null,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: a.peach2, width: 2),
          ),
          child: checked ? const AIcon(AIcons.check, size: 16, color: Color(0xFFFFFFFF)) : null,
        ),
      ),
    );
  }
}

/// Gate wiring: `<ConsentGateScreen userId backend version kvkk onAccepted={markAccepted} onSignOut={signOut} />`.
class ConsentGate extends ConsumerWidget {
  const ConsentGate({super.key, required this.onSignOut, this.profileCountryCode, required this.language});
  final Future<void> Function() onSignOut;
  final String? profileCountryCode;
  final String language;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scope = ref.watch(consentGateScopeProvider);
    final view = ref.watch(consentGateProvider);
    final version = view.consent?.gate.version;
    if (scope.userId == null || version == null) return ColoredBox(color: context.a.bg);
    return ConsentGateScreen(
      userId: scope.userId!,
      backend: scope.backend,
      version: version,
      kvkk: isKvkkUser(profileCountryCode, language),
      onAccepted: () => ref.read(consentGateProvider.notifier).markAccepted(),
      onSignOut: () => onSignOut(),
    );
  }
}
