// Ported from: src/components/CountryGate.tsx
//
// Mandatory country choice for a profile without `country_code` (Apple/Google sign-ups, old accounts). Shown once;
// cannot be skipped.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';
import 'country_select.dart';

class CountryGate extends ConsumerStatefulWidget {
  const CountryGate({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  ConsumerState<CountryGate> createState() => _CountryGateState();
}

class _CountryGateState extends ConsumerState<CountryGate> {
  String? _selected;
  bool _saving = false;

  Future<void> _save() async {
    final userId = ref.read(authUserProvider)?.id;
    final selected = _selected;
    if (selected == null || userId == null) return;
    setState(() => _saving = true);
    final toasts = AToastHost.of(context);
    try {
      await ref.read(profileCountryWriterProvider)(userId, selected);
      ref.read(userStoreProvider.notifier).setCountryCode(selected);
      await ref.read(entryAuthActionsProvider).refreshProfile();
      widget.onDone();
    } catch (e) {
      String message;
      try {
        message = '${(e as dynamic).message}';
      } catch (_) {
        message = '$e';
      }
      toasts.show(title: tr('countrygate_error', 'Xəta baş verdi'), description: message, destructive: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final pad = MediaQuery.paddingOf(context);
    final disabled = _selected == null || _saving;
    return Material(
      type: MaterialType.transparency,
      child: AScope(
        child: ColoredBox(
          color: a.bg,
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, pad.top, 24, pad.bottom),
            child: Center(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 384),
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Center(
                      child: Container(
                        width: 64,
                        height: 64,
                        margin: const EdgeInsets.only(bottom: 20),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(24)),
                        child: AIcon(AIcons.earth, size: 32, color: a.accentInk),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(tr('countrygate_title', 'Hansı ölkədə yaşayırsınız?'),
                          textAlign: TextAlign.center, style: css(20, FontWeight.w900, height: 28 / 20, color: a.ink)),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Text(
                        tr('countrygate_subtitle',
                            'Ölkənizə uyğun məzmun, peyvənd təqvimi və community üçün bu məlumat lazımdır. Yalnız bir dəfə soruşulur.'),
                        textAlign: TextAlign.center,
                        style: css(14, FontWeight.w400, height: 20 / 14, color: a.inkSoft),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: CountrySelect(value: _selected, onChanged: (c) => setState(() => _selected = c)),
                    ),
                    GestureDetector(
                      key: const ValueKey('country-gate-save'),
                      onTap: disabled ? null : _save,
                      child: Opacity(
                        opacity: disabled ? 0.5 : 1,
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                          child: _saving
                              ? const EntryLoader(size: 16, color: Color(0xFFFFFFFF))
                              : Text(tr('countrygate_save', 'Davam et'),
                                  style: css(14, FontWeight.w700, height: 20 / 14, color: const Color(0xFFFFFFFF))),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
