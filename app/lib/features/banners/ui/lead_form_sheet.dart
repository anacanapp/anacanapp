// Ported from: src/components/banners/LeadFormSheet.tsx (shadcn `<Sheet side="bottom">`)
//
// Brand-owned in-app lead form. Answers go only to submit_ad_lead_v1; nothing is cached or persisted on the
// device (the form query is never persisted, answers live in the sheet's state).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/data/data.dart' show Db, dbProvider;
import '../../../core/offline/offline_outbox.dart' show newClientId;
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, ShadInput;
import '../lead_form.dart';

/// get_ad_lead_form_v1 / submit_ad_lead_v1 (overridable in tests).
abstract interface class LeadFormSource {
  /// The raw public projection; throws on an RPC error.
  Future<Object?> fetchForm(String bannerId, String language);

  /// `{ id, duplicate }`; throws on an RPC error (message may contain `RATE_LIMITED`).
  Future<Map<String, dynamic>?> submit({required String bannerId, String? deliveryId, required Map<String, String> answers, required String language, required String request});
}

class SupabaseLeadFormSource implements LeadFormSource {
  SupabaseLeadFormSource(this.db);
  final Db Function() db;

  @override
  Future<Object?> fetchForm(String bannerId, String language) => db().rpc<Object?>('get_ad_lead_form_v1', params: {'p_banner': bannerId, 'p_language': language});

  @override
  Future<Map<String, dynamic>?> submit({required String bannerId, String? deliveryId, required Map<String, String> answers, required String language, required String request}) async {
    final data = await db().rpc<Object?>('submit_ad_lead_v1', params: {
      'p_banner': bannerId,
      'p_delivery': deliveryId,
      'p_answers': answers,
      'p_language': language,
      'p_consent': true,
      'p_request': request,
    });
    return data is Map ? Map<String, dynamic>.from(data) : null;
  }
}

final leadFormSourceProvider = Provider<LeadFormSource>((ref) => SupabaseLeadFormSource(() => ref.read(dbProvider)));

const Map<String, String> _errorText = {
  'required': 'error_required',
  'email': 'error_email',
  'phone': 'error_phone',
  'consent': 'error_consent',
  'empty': 'error_required',
};

/// Opens the sheet for [bannerId]; [delivery] receives the click's delivery id when it arrives.
Future<void> showLeadFormSheet(BuildContext context, {required String bannerId, ValueListenable<String?>? delivery}) =>
    Navigator.of(context, rootNavigator: true).push<void>(_LeadSheetRoute(builder: (_) => LeadFormSheet(bannerId: bannerId, delivery: delivery)));

class _LeadSheetRoute extends PopupRoute<void> {
  _LeadSheetRoute({required this.builder});
  final WidgetBuilder builder;

  @override
  Color? get barrierColor => const Color(0xCC000000); // shadcn sheet overlay bg-black/80
  @override
  bool get barrierDismissible => true;
  @override
  String? get barrierLabel => 'Dismiss';
  @override
  Duration get transitionDuration => const Duration(milliseconds: 500);
  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 300);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) => builder(context);

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final slide = Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: animation, curve: Curves.easeInOut));
    return Align(alignment: Alignment.bottomCenter, child: SlideTransition(position: slide, child: child));
  }
}

class LeadFormSheet extends ConsumerStatefulWidget {
  const LeadFormSheet({super.key, required this.bannerId, this.delivery});
  final String bannerId;
  final ValueListenable<String?>? delivery;

  @override
  ConsumerState<LeadFormSheet> createState() => _LeadFormSheetState();
}

class _LeadFormSheetState extends ConsumerState<LeadFormSheet> {
  final Map<String, TextEditingController> _controllers = <String, TextEditingController>{};
  bool _consent = false;
  Map<String, String> _errors = const {};
  String? _result;
  final String _request = newClientId();
  bool _loading = true;
  PublicLeadForm? _form;
  bool _pending = false;
  Object? _submitError;

  String get _language => ref.read(userStoreProvider).language;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    PublicLeadForm? form;
    try {
      form = parsePublicLeadForm(await ref.read(leadFormSourceProvider).fetchForm(widget.bannerId, _language));
    } catch (_) {
      form = null;
    }
    if (!mounted) return;
    setState(() {
      _form = form;
      _loading = false;
    });
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controller(String key) => _controllers[key] ??= TextEditingController();

  String _t(String key) => leadText(key, _language, {'brand': _form?.sponsorName ?? '', 'days': _form?.retentionDays ?? 90});

  Future<void> _send() async {
    final form = _form;
    if (form == null || _pending) return;
    final answers = {for (final e in _controllers.entries) e.key: e.value.text};
    final checked = validateLead(form, answers, _consent);
    setState(() => _errors = checked.errors);
    if (!checked.valid) return;
    setState(() {
      _pending = true;
      _submitError = null;
    });
    try {
      final data = await ref.read(leadFormSourceProvider).submit(
            bannerId: widget.bannerId,
            deliveryId: widget.delivery?.value,
            answers: checked.clean,
            language: _language,
            request: _request,
          );
      if (!mounted) return;
      setState(() {
        _result = data?['duplicate'] == true ? 'duplicate' : 'sent';
        for (final c in _controllers.values) {
          c.clear();
        }
      });
    } catch (error) {
      if (mounted) setState(() => _submitError = error);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Widget _pill(String label, VoidCallback onTap, {double horizontal = 24}) {
    final s = context.tokens.shadcn;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: 10),
        decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: s.primaryForeground)),
      ),
    );
  }

  Widget _formBody(PublicLeadForm form) {
    final s = context.tokens.shadcn;
    final brand = form.sponsorName;
    final intro = form.copy['intro'];
    final failure = _submitError == null ? null : (RegExp('RATE_LIMITED').hasMatch('$_submitError') ? 'error_rate' : 'error_generic');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 8),
      Padding(
        padding: const EdgeInsetsDirectional.only(end: 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${_t('sponsored')} · $brand', style: TextStyle(fontSize: 11, color: s.mutedForeground)),
          const SizedBox(height: 4),
          Text(form.copy['title'] ?? '', style: TextStyle(fontSize: 18, height: 1.375, fontWeight: FontWeight.w600, color: s.foreground)),
          if (intro != null && intro.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(intro, style: TextStyle(fontSize: 14, color: s.mutedForeground)),
          ],
        ]),
      ),
      for (final field in form.fields) ...[
        const SizedBox(height: 16),
        _field(form, field),
      ],
      const SizedBox(height: 16),
      GestureDetector(
        key: const ValueKey<String>('lead-consent'),
        onTap: () => setState(() => _consent = !_consent),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 20,
              height: 20,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: _consent ? s.primary : s.background,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: _errors.containsKey('consent') ? s.destructive : (_consent ? s.primary : s.border)),
              ),
              child: _consent ? AIcon(AIcons.check, size: 14, color: s.primaryForeground) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_t('consent_check'), style: TextStyle(fontSize: 12, height: 1.625, fontWeight: FontWeight.w500, color: s.foreground)),
                const SizedBox(height: 4),
                Text(form.copy['consent'] ?? '', style: TextStyle(fontSize: 12, height: 1.625, color: s.mutedForeground)),
                if (form.privacyUrl != null)
                  GestureDetector(
                    onTap: () => unawaited(launchUrl(Uri.parse(form.privacyUrl!), mode: LaunchMode.externalApplication).catchError((Object _) => false)),
                    child: Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(_t('privacy_policy'),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: s.primary, decoration: TextDecoration.underline, decorationColor: s.primary)),
                    ),
                  ),
              ]),
            ),
          ]),
        ),
      ),
      if (_errors.containsKey('consent')) ...[
        const SizedBox(height: 8),
        Text(_t('error_consent'), style: TextStyle(fontSize: 12, color: s.destructive)),
      ],
      const SizedBox(height: 16),
      Text(_t('privacy_note'), style: TextStyle(fontSize: 11, height: 1.625, color: s.mutedForeground)),
      if (failure != null) ...[
        const SizedBox(height: 16),
        Semantics(
          liveRegion: true,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: s.destructive.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
            child: Text(_t(failure), style: TextStyle(fontSize: 12, color: s.destructive)),
          ),
        ),
      ],
      const SizedBox(height: 16),
      Opacity(
        opacity: _pending ? 0.6 : 1,
        child: GestureDetector(
          key: const ValueKey<String>('lead-submit'),
          onTap: _pending ? null : () => unawaited(_send()),
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(999)),
            child: Text(_pending ? _t('sending') : _t('submit'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: s.primaryForeground)),
          ),
        ),
      ),
      const SizedBox(height: 24),
    ]);
  }

  Widget _field(PublicLeadForm form, LeadField field) {
    final s = context.tokens.shadcn;
    final error = _errors[field.key];
    final ltr = field.key == 'phone' || field.key == 'email';
    final input = ShadInput(
      fieldKey: ValueKey<String>('lead-${field.key}'),
      controller: _controller(field.key),
      height: 48,
      radius: 12,
      borderColor: error != null ? s.destructive : s.border,
      keyboardType: field.key == 'phone' ? TextInputType.phone : field.key == 'email' ? TextInputType.emailAddress : TextInputType.text,
      inputFormatters: [LengthLimitingTextInputFormatter(field.key.startsWith('question_') ? 500 : 254)],
      style: TextStyle(fontSize: 16, color: s.foreground),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text.rich(TextSpan(children: [
        TextSpan(text: leadFieldLabel(form, field.key, _language), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: s.foreground)),
        if (!field.required) TextSpan(text: ' (${_t('optional')})', style: TextStyle(fontSize: 12, color: s.mutedForeground)),
      ])),
      const SizedBox(height: 6),
      ltr ? Directionality(textDirection: TextDirection.ltr, child: input) : input,
      if (error != null) ...[
        const SizedBox(height: 6),
        Text(_t(_errorText[error] ?? 'error_generic'), style: TextStyle(fontSize: 12, color: s.destructive)),
      ],
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final media = MediaQuery.of(context);
    final form = _form;
    Widget body;
    if (_loading) {
      body = ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 160),
        child: Center(
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            ALoader(size: 16, color: s.mutedForeground),
            const SizedBox(width: 8),
            Text(_t('loading'), style: TextStyle(fontSize: 14, color: s.mutedForeground)),
          ]),
        ),
      );
    } else if (form == null) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(children: [
          Text(_t('unavailable'), textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: s.foreground)),
          const SizedBox(height: 24),
          _pill(_t('close'), () => Navigator.of(context).maybePop()),
        ]),
      );
    } else if (_result != null) {
      body = Semantics(
        liveRegion: true,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Column(children: [
            AIcon(AIcons.circleCheckBig, size: 48, color: s.primary),
            const SizedBox(height: 12),
            Text(_result == 'sent' ? (form.copy['success'] ?? _t('success')) : _t('duplicate'),
                textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: s.foreground)),
            const SizedBox(height: 12),
            Text(form.sponsorName, style: TextStyle(fontSize: 14, color: s.mutedForeground)),
            const SizedBox(height: 28),
            _pill(_t('done'), () => Navigator.of(context).maybePop(), horizontal: 32),
          ]),
        ),
      );
    } else {
      body = _formBody(form);
    }
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.92),
        child: Container(
          key: const ValueKey<String>('brand-lead-sheet'),
          width: double.infinity,
          decoration: BoxDecoration(
            color: s.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: s.border)),
          ),
          child: Stack(children: [
            SingleChildScrollView(padding: EdgeInsets.fromLTRB(20, 24, 20, 24 + media.padding.bottom), child: body),
            PositionedDirectional(
              top: 16,
              end: 16,
              child: Semantics(
                button: true,
                label: _t('close'),
                child: GestureDetector(
                  onTap: () => Navigator.of(context).maybePop(),
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
