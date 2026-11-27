// Ported from: src/components/premium/SponsorEntry.tsx, src/components/premium/SponsorSheet.tsx,
//              src/styles/care.css (.cx-stack, .cx-card, .cx-icon, .cx-link, .cx-sub, .cx-row, .cx-input, .cx-field,
//              .cx-alert)
//
// "Who pays for Premium?" — self (store), spouse (partner-mode invite) or a family member (plain payment request).
// For spouse/family it mints a shareable anacan.az/p/<token> link and a prefilled, editable message. The account
// and all data stay with the user; the payer only pays. Native-only, behind the `premium_sponsor` flag.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../profile/profile_interfaces.dart' show shareServiceProvider;
import '../../settings/ui/settings_ui.dart' show ALoader, AInput;
import '../commerce_backend.dart';
import 'premium_sponsor.dart';

/// "Someone else pays?" entry under the paywall CTA.
class SponsorEntry extends ConsumerWidget {
  const SponsorEntry({super.key, required this.onSelf});
  final VoidCallback onSelf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setting = ref.watch(appSettingProvider('premium_sponsor'));
    if (setting is! Map || setting['enabled'] != true) return const SizedBox.shrink();
    final t = sponsorText();
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Center(
        child: GestureDetector(
          key: const ValueKey('sponsor-entry'),
          behavior: HitTestBehavior.opaque,
          onTap: () => unawaited(showSponsorSheet(context, onSelf: onSelf)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AIcon(AIcons.users, size: 14, color: a.accentInk),
              const SizedBox(width: 6),
              Text(
                t['entry'] ?? '',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: a.accentInk),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Opens the sheet (`<SponsorSheet open onClose onSelf />`).
Future<void> showSponsorSheet(BuildContext context, {required VoidCallback onSelf}) =>
    Navigator.of(context, rootNavigator: true).push<void>(ASheetRoute<void>(builder: (ctx) => SponsorSheet(onSelf: onSelf)));

class SponsorSheet extends ConsumerStatefulWidget {
  const SponsorSheet({super.key, required this.onSelf});
  final VoidCallback onSelf;

  @override
  ConsumerState<SponsorSheet> createState() => _SponsorSheetState();
}

class _SponsorSheetState extends ConsumerState<SponsorSheet> {
  String _step = 'menu'; // 'menu' | 'family' | 'compose'
  bool _partnerOffer = true;
  String? _relation;
  String? _link;
  bool _loading = false;
  bool _err = false;
  final TextEditingController _message = TextEditingController();
  String? _copied; // 'link' | 'msg'
  Timer? _copiedTimer;
  int _generation = 0;

  @override
  void dispose() {
    _message.dispose();
    _copiedTimer?.cancel();
    super.dispose();
  }

  Map<String, String> get _t => sponsorText();

  String _template(String url, bool partner) => sponsorFill(partner ? _t['msg_partner']! : _t['msg_gift']!, {'link': url});

  Future<void> _generate(String kind, String? rel, bool partner) async {
    final gen = ++_generation;
    setState(() {
      _loading = true;
      _err = false;
    });
    try {
      final made = await createSponsorLink(ref.read(commerceBackendProvider), kind, rel, currentLanguage());
      if (!mounted || gen != _generation) return;
      setState(() {
        _link = made.url;
        _message.text = _template(made.url, partner);
      });
    } catch (_) {
      if (mounted && gen == _generation) setState(() => _err = true);
    }
    if (mounted && gen == _generation) setState(() => _loading = false);
  }

  void _pickSpouse() {
    unawaited(HapticFeedback.lightImpact());
    setState(() {
      _relation = 'spouse';
      _partnerOffer = true;
      _step = 'compose';
    });
    unawaited(_generate('partner', 'spouse', true));
  }

  void _pickFamily() {
    unawaited(HapticFeedback.lightImpact());
    setState(() => _step = 'family');
  }

  void _pickRelation(String rel) {
    unawaited(HapticFeedback.lightImpact());
    setState(() {
      _relation = rel;
      _partnerOffer = false;
      _step = 'compose';
    });
    unawaited(_generate('gift', rel, false));
  }

  void _togglePartner(bool next) {
    setState(() => _partnerOffer = next);
    unawaited(_generate(next ? 'partner' : 'gift', _relation, next));
  }

  Future<void> _copy(String what) async {
    final value = what == 'link' ? _link : _message.text;
    if (value == null || value.isEmpty) return;
    try {
      await Clipboard.setData(ClipboardData(text: value));
      if (!mounted) return;
      setState(() => _copied = what);
      unawaited(HapticFeedback.lightImpact());
      _copiedTimer?.cancel();
      _copiedTimer = Timer(const Duration(milliseconds: 1800), () {
        if (mounted) setState(() => _copied = null);
      });
    } catch (_) {}
  }

  Future<void> _share() async {
    if (_message.text.isEmpty) return;
    final ok = await ref.read(shareServiceProvider).share(text: _message.text);
    if (!ok) await _copy('msg');
  }

  Widget _privacy(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(11)),
            child: AIcon(AIcons.lock, size: 16, color: a.greenInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _t['privacy_title'] ?? '',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink),
                ),
                Text(_t['privacy_body'] ?? '', style: TextStyle(fontSize: 12, color: a.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _option(
    BuildContext context, {
    required Key key,
    required AIconData icon,
    required Color bg,
    required Color fg,
    required String title,
    required String sub,
    required VoidCallback onTap,
  }) {
    final a = context.a;
    return PressScale.css(
      key: key,
      scale: 0.98,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: a.line),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(13)),
              child: AIcon(icon, size: 20, color: fg),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: a.ink),
                  ),
                  Text(sub, style: TextStyle(fontSize: 12.5, color: a.inkSoft)),
                ],
              ),
            ),
            AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context) {
    final a = context.a;
    final t = _t;
    final sub = TextStyle(fontSize: 13, color: a.inkSoft);
    Widget gap(double h) => SizedBox(height: h);
    switch (_step) {
      case 'family':
        return [
          for (final rel in const ['mother', 'father', 'sibling', 'other']) ...[
            PressScale.css(
              key: ValueKey('sponsor-rel-$rel'),
              scale: 0.98,
              onTap: () => _pickRelation(rel),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: a.line),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        t['rel_$rel'] ?? rel,
                        style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: a.ink),
                      ),
                    ),
                    AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
                  ],
                ),
              ),
            ),
            gap(8),
          ],
          _privacy(context),
        ];
      case 'compose':
        return [
          Text(t['compose_sub'] ?? '', textAlign: TextAlign.center, style: sub),
          if (_relation == 'spouse')
            GestureDetector(
              key: const ValueKey('sponsor-partner-toggle'),
              behavior: HitTestBehavior.opaque,
              onTap: () => _togglePartner(!_partnerOffer),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t['partner_toggle'] ?? '',
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink),
                          ),
                          Text(t['partner_toggle_sub'] ?? '', style: TextStyle(fontSize: 11.5, color: a.inkSoft)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _partnerOffer ? a.peach2 : a.surface,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: _partnerOffer ? a.peach2 : a.lineStrong, width: 1.5),
                      ),
                      child: _partnerOffer ? const AIcon(AIcons.check, size: 14, color: Color(0xFFFFFFFF)) : null,
                    ),
                  ],
                ),
              ),
            ),
          if (_loading)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ALoader(size: 16, color: a.inkSoft),
                  const SizedBox(width: 8),
                  Text(t['generating'] ?? '', style: TextStyle(fontSize: 13, color: a.inkSoft)),
                ],
              ),
            )
          else if (_err)
            Container(
              key: const ValueKey('sponsor-error'),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(14)),
              child: Text(t['error'] ?? '', style: TextStyle(fontSize: 13, color: a.alertInk)),
            )
          else ...[
            AInput(fieldKey: const ValueKey('sponsor-message'), controller: _message, height: 120, keyboardType: TextInputType.multiline),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t['link_label'] ?? '',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: a.inkSoft),
                ),
                gap(6),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        alignment: AlignmentDirectional.centerStart,
                        decoration: BoxDecoration(
                          color: a.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: a.line),
                        ),
                        child: Text(
                          _link ?? '',
                          key: const ValueKey('sponsor-link'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, color: a.ink),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    AButton(
                      variant: AButtonVariant.ghost,
                      size: AButtonSize.sm,
                      onPressed: () => unawaited(_copy('link')),
                      child: AIcon(_copied == 'link' ? AIcons.check : AIcons.copy, size: 15),
                    ),
                  ],
                ),
              ],
            ),
            Row(
              children: [
                AIcon(AIcons.link2, size: 13, color: a.inkSoft),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(t['valid_7'] ?? '', style: TextStyle(fontSize: 11.5, color: a.inkSoft)),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: AButton(
                    variant: AButtonVariant.ghost,
                    onPressed: () => unawaited(_copy('msg')),
                    child: Text(_copied == 'msg' ? (t['copied'] ?? '') : (t['copy_msg'] ?? '')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: AButton(
                    variant: AButtonVariant.accent,
                    onPressed: () => unawaited(_share()),
                    leading: const AIcon(AIcons.share2, size: 15),
                    child: Text(t['share'] ?? ''),
                  ),
                ),
              ],
            ),
            _privacy(context),
          ],
        ];
      default:
        return [
          Text(t['reassure'] ?? '', textAlign: TextAlign.center, style: sub),
          _option(
            context,
            key: const ValueKey('sponsor-self'),
            icon: AIcons.apple,
            bg: a.surfaceSoft,
            fg: a.ink,
            title: t['self_title'] ?? '',
            sub: t['self_sub'] ?? '',
            onTap: () {
              Navigator.of(context).maybePop();
              widget.onSelf();
            },
          ),
          _option(
            context,
            key: const ValueKey('sponsor-spouse'),
            icon: AIcons.heartHandshake,
            bg: a.pink1,
            fg: a.berryInk,
            title: t['spouse_title'] ?? '',
            sub: t['spouse_sub'] ?? '',
            onTap: _pickSpouse,
          ),
          _option(
            context,
            key: const ValueKey('sponsor-family'),
            icon: AIcons.gift,
            bg: a.lav1,
            fg: a.lavInk,
            title: t['family_title'] ?? '',
            sub: t['family_sub'] ?? '',
            onTap: _pickFamily,
          ),
          _privacy(context),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _t;
    final title = _step == 'family'
        ? t['relation_title']
        : _step == 'compose'
        ? t['compose_title']
        : t['title'];
    final VoidCallback? onBack = _step == 'menu'
        ? null
        : () => setState(() => _step = _step == 'compose' && _relation != null && _relation != 'spouse' ? 'family' : 'menu');
    return ASheet(
      full: false,
      title: Text(title ?? ''),
      onBack: onBack,
      onClose: () => Navigator.of(context).maybePop(),
      closeLabel: tr('common_close', 'Bağla'),
      backLabel: tr('common_back', 'Geri'),
      children: _body(context),
    );
  }
}
