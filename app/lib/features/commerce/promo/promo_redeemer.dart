// Ported from: src/components/promo/PromoRedeemer.tsx, src/components/promo/PromoCodeDialog.tsx
//
// PromoRedeemer grants a saved QR gift code once a session exists (after signup, login, Google/Apple sign-in or
// on the next start). Final refusals drop the code; network or server failures keep it for the next start.
// The code arrives through app/deep_links.dart (`/h/<CODE>` → savePendingPromo → promoPendingEvents).
// PromoCodeDialog: Profile → "Hədiyyə kodu", typing a QR campaign code by hand.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show showDialog;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/copy/feature_copy.dart' as copy show fill, promoText;
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadDialogFrame, ShadInput, shadDescription, shadTitle, toasts;
import '../commerce_backend.dart';
import 'promo.dart';

void _refreshPremium(QueryClient client) =>
    unawaited(client.invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && promoPremiumRoots.contains('${q.queryKey.first}')));

/// Headless redeemer mounted once inside the signed-in frame (App.tsx `<PromoRedeemer />`).
class PromoRedeemer extends ConsumerStatefulWidget {
  const PromoRedeemer({super.key});

  @override
  ConsumerState<PromoRedeemer> createState() => _PromoRedeemerState();
}

class _PromoRedeemerState extends ConsumerState<PromoRedeemer> {
  bool _busy = false;
  StreamSubscription<String>? _pending;

  Future<void> _run() async {
    final userId = ref.read(authUserProvider)?.id;
    if (userId == null || _busy) return;
    final store = ref.read(localStoreProvider);
    final code = readPendingPromo(store);
    if (code == null) return;
    _busy = true;
    final toast = toasts(context);
    final client = ref.read(queryClientProvider);
    try {
      final result = await redeemPromo(ref.read(commerceBackendProvider), code);
      final text = copy.promoText(currentLanguage());
      if (!result.ok) {
        if (promoFinalErrors.contains(result.code)) {
          clearPendingPromo(store);
          toast.error(promoErrorText(text, result.code!));
        }
      } else {
        clearPendingPromo(store);
        toast.success(copy.fill(text('success'), {'duration': promoDurationLabel(text, result.duration)}));
        _refreshPremium(client);
      }
    } finally {
      _busy = false;
    }
  }

  @override
  void initState() {
    super.initState();
    _pending = promoPendingEvents.stream.listen((_) => unawaited(_run()));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_run());
    });
    ref.listenManual(authUserProvider.select((u) => u?.id), (_, next) {
      if (next != null) unawaited(_run());
    });
  }

  @override
  void dispose() {
    unawaited(_pending?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// `<PromoCodeDialog open onClose />`: shows the dialog; completes when it closes.
Future<void> showPromoCodeDialog(BuildContext context) =>
    showDialog<void>(context: context, barrierColor: const Color(0xCC000000), builder: (_) => const PromoCodeDialog());

class PromoCodeDialog extends ConsumerStatefulWidget {
  const PromoCodeDialog({super.key});

  @override
  ConsumerState<PromoCodeDialog> createState() => _PromoCodeDialogState();
}

class _PromoCodeDialogState extends ConsumerState<PromoCodeDialog> {
  final TextEditingController _value = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final text = copy.promoText(currentLanguage());
    final code = normalizePromoCode(_value.text);
    if (code == null) {
      setState(() => _error = text('err_not_found'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final toast = toasts(context);
    final client = ref.read(queryClientProvider);
    final store = ref.read(localStoreProvider);
    final nav = Navigator.of(context);
    final result = await redeemPromo(ref.read(commerceBackendProvider), code);
    if (!mounted) return;
    setState(() => _busy = false);
    if (!result.ok) {
      setState(() => _error = promoErrorText(text, result.code!));
      return;
    }
    clearPendingPromo(store);
    toast.success(copy.fill(text('success'), {'duration': promoDurationLabel(text, result.duration)}));
    _refreshPremium(client);
    _value.clear();
    nav.pop();
  }

  @override
  Widget build(BuildContext context) {
    final text = copy.promoText(currentLanguage());
    final t = context.tokens.shadcn;
    return ShadDialogFrame(
      radius: 24,
      maxWidth: 384,
      children: [
        Text(text('profile_title'), style: shadTitle(context)),
        const SizedBox(height: 6),
        Text(text('profile_sub'), style: shadDescription(context)),
        const SizedBox(height: 16),
        Semantics(
          label: text('profile_title'),
          textField: true,
          child: ShadInput(
            fieldKey: const ValueKey('promo-code-input'),
            controller: _value,
            autofocus: true,
            height: 48,
            radius: 12,
            style: TextStyle(fontSize: 18, letterSpacing: 1.8, fontFamily: 'monospace', color: t.foreground),
            inputFormatters: [
              TextInputFormatter.withFunction((oldValue, newValue) {
                final next = newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9-]'), '');
                final cut = next.length > 32 ? next.substring(0, 32) : next;
                return TextEditingValue(
                  text: cut,
                  selection: TextSelection.collapsed(offset: cut.length),
                );
              }),
            ],
            onChanged: (_) => setState(() => _error = null),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                key: const ValueKey('promo-error'),
                style: TextStyle(fontSize: 14, color: t.destructive),
              ),
            ),
          ),
        const SizedBox(height: 16),
        ShadButton(
          key: const ValueKey('promo-apply'),
          pill: true,
          expand: true,
          height: 48,
          onPressed: _busy || _value.text.isEmpty ? null : () => unawaited(_apply()),
          child: Text(_busy ? text('loading') : text('apply'), style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }
}
