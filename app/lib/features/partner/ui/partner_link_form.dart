// Ported from: src/components/partner/v2/PartnerLinkForm.tsx
//
// In-app pairing for a partner account that is not linked (or was unlinked).
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show toasts;
import '../partner_copy.dart';
import 'partner_ui.dart';

/// `useAuth().linkPartner(code)`.
final partnerLinkActionProvider =
    Provider<Future<AuthResult<void>> Function(String code)>((ref) => (code) => ref.read(authControllerProvider.notifier).linkPartner(code));

class _UpperCase extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

class PartnerLinkForm extends ConsumerStatefulWidget {
  const PartnerLinkForm({super.key, this.onLinked});
  final VoidCallback? onLinked;

  @override
  ConsumerState<PartnerLinkForm> createState() => _PartnerLinkFormState();
}

class _PartnerLinkFormState extends ConsumerState<PartnerLinkForm> {
  final TextEditingController _code = TextEditingController();
  final FocusNode _focus = FocusNode();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || _code.text.trim().isEmpty) return;
    final toast = toasts(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await ref.read(partnerLinkActionProvider)(_code.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (result.error != null) {
      setState(() => _error = getPartnerLinkErrorMessage(result.error));
      return;
    }
    toast.show(title: feature37Text('partner_linked_ok'));
    widget.onLinked?.call();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final disabled = _busy || _code.text.trim().isEmpty;
    final inputStyle = pText(13, color: a.ink).copyWith(fontFamily: 'monospace', letterSpacing: 13 * 0.06);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 384),
      child: PartnerCard(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(feature37Text('partner_link_title'), style: pText(14, weight: FontWeight.w800, color: a.ink)),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(feature37Text('partner_link_hint'), style: pText(12, color: a.inkSoft)),
          ),
          Material(
            type: MaterialType.transparency,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong),
              ),
              child: TextField(
                key: const ValueKey('partner-link-code'),
                controller: _code,
                focusNode: _focus,
                maxLength: 32,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.characters,
                inputFormatters: [_UpperCase()],
                onChanged: (_) => setState(() => _error = null),
                onSubmitted: (_) => _submit(),
                style: inputStyle,
                cursorColor: a.peach2,
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  counterText: '',
                  hintText: 'ANACAN-XXXXXX',
                  hintStyle: inputStyle.copyWith(color: a.inkFaint),
                ),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Semantics(
                liveRegion: true,
                // var(--a-coral-strong, #d93a40)
                child: Text(_error!, style: pText(12.5, weight: FontWeight.w600, color: a.coralStrong)),
              ),
            ),
          const SizedBox(height: 12),
          PartnerTap(
            onTap: disabled ? null : _submit,
            scale: 1,
            child: Opacity(
              opacity: disabled ? 0.6 : 1,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  // .a-btn-solid: white text on --a-peach-2
                  const AIcon(AIcons.link2, size: 17, color: Color(0xFFFFFFFF)),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(feature37Text('partner_link_submit'),
                        style: pText(12, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                  ),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `profileSlotsProvider.partnerLinkForm`.
Widget partnerLinkFormSlot(BuildContext context) => const PartnerLinkForm();
