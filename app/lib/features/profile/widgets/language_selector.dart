// Ported from: src/components/LanguageSelector.tsx
//
// Row + picker modal. `change`: ensureLanguageReady (error → retry text) → userStore.setLanguage → bounded (3 s)
// `user_preferences.language` upsert. The web reloads; here every widget watching the language rebuilds.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart' show dbProvider;
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../state/state.dart';
import '../../settings/ui/settings_ui.dart';

/// Persists the choice server-side (`user_preferences` upsert on `user_id`); throws on failure.
typedef LanguagePreferenceWriter = Future<void> Function(String userId, String language);

final languagePreferenceWriterProvider = Provider<LanguagePreferenceWriter>((ref) => (userId, language) async {
      await ref.read(dbProvider).from('user_preferences').upsert({'user_id': userId, 'language': language}, onConflict: 'user_id');
    });

/// Makes a language's copy ready before the switch (`ensureLanguageReady`); throws when it cannot be loaded.
final languageReadyProvider = Provider<Future<void> Function(String code)>((ref) => (code) => ref.read(i18nRuntimeProvider).ensureLanguageReady(code));

typedef _Lang = ({String code, String native});

class LanguageSelector extends ConsumerStatefulWidget {
  const LanguageSelector({super.key});
  @override
  ConsumerState<LanguageSelector> createState() => _LanguageSelectorState();
}

class _LanguageSelectorState extends ConsumerState<LanguageSelector> {
  List<_Lang> _langs(WidgetRef ref) {
    final remote = ref.watch(activeLanguagesProvider).value;
    if (remote != null && remote.isNotEmpty) return [for (final l in remote) (code: l.code, native: l.nativeName)];
    return [for (final l in kAppLanguages) (code: l.code, native: l.nativeName)];
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final langs = _langs(ref);
    final current = langs.where((l) => l.code == language).firstOrNull ?? langs.first;
    final s = context.tokens.shadcn;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _open(context),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: s.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: s.border)),
          child: Row(children: <Widget>[
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: AIcon(AIcons.globe, size: 18, color: s.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                Text(tr('untranslated_dil_language_7oaxzb', 'Dil / Language'), style: Tw.sm.copyWith(fontWeight: FontWeight.w600, color: s.foreground)),
                Text(current.native, style: Tw.xs.copyWith(color: s.mutedForeground)),
              ]),
            ),
            Text(current.code.toUpperCase(), style: Tw.xs.copyWith(fontWeight: FontWeight.w600, color: s.primary)),
          ]),
        ),
      ),
    );
  }

  Future<void> _open(BuildContext context) => showGeneralDialog<void>(
        context: context,
        barrierDismissible: false,
        barrierLabel: 'language',
        barrierColor: const Color(0x80000000),
        transitionDuration: Duration.zero,
        pageBuilder: (ctx, _, _) => const LanguagePickerModal(),
      );
}

/// The `createPortal` modal of LanguageSelector.
class LanguagePickerModal extends ConsumerStatefulWidget {
  const LanguagePickerModal({super.key});
  @override
  ConsumerState<LanguagePickerModal> createState() => _LanguagePickerModalState();
}

class _LanguagePickerModalState extends ConsumerState<LanguagePickerModal> {
  bool _switching = false;
  bool _loadError = false;

  Future<void> _change(String code, String language) async {
    if (_switching) return;
    final nav = Navigator.of(context);
    if (code == language) {
      nav.pop();
      return;
    }
    setState(() {
      _switching = true;
      _loadError = false;
    });
    try {
      await ref.read(languageReadyProvider)(code);
    } catch (_) {
      if (mounted) {
        setState(() {
          _switching = false;
          _loadError = true;
        });
      }
      return;
    }
    ref.read(userStoreProvider.notifier).setLanguage(code);
    final actor = ref.read(userStoreProvider).userId;
    final sessionUser = ref.read(authUserProvider)?.id;
    if (actor != null && sessionUser == actor) {
      try {
        await ref.read(languagePreferenceWriterProvider)(actor, code).timeout(const Duration(seconds: 3));
      } catch (_) {
        // Local selection is durable even while the backend is offline.
      }
    }
    if (!mounted) return;
    setState(() => _switching = false);
    nav.pop();
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final remote = ref.watch(activeLanguagesProvider).value;
    final langs = remote != null && remote.isNotEmpty
        ? [for (final l in remote) (code: l.code, native: l.nativeName)]
        : [for (final l in kAppLanguages) (code: l.code, native: l.nativeName)];
    final s = context.tokens.shadcn;
    final maxH = MediaQuery.sizeOf(context).height * 0.85;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (!_switching) Navigator.of(context).pop();
      },
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: GestureDetector(
              onTap: () {},
              child: Material(
                type: MaterialType.transparency,
                child: Container(
                  constraints: BoxConstraints(maxWidth: 384, maxHeight: maxH),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: s.card,
                    borderRadius: BorderRadius.circular(24),
                    // shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / .25)
                    boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x40000000), offset: Offset(0, 25), blurRadius: 50, spreadRadius: -12)],
                  ),
                  child: AScope(
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                        child: Text(tr('untranslated_dil_language_7oaxzb', 'Dil / Language'), style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: s.foreground)),
                      ),
                      if (_loadError)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Semantics(liveRegion: true, child: Text(tr('language_bundle_retry', 'Dil yüklənmədi. Yenidən cəhd edin.'), style: Tw.sm.copyWith(color: s.destructive))),
                        ),
                      Flexible(
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: langs.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final l = langs[i];
                            final on = l.code == language;
                            return Opacity(
                              opacity: _switching ? 0.5 : 1,
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: _switching ? null : () => _change(l.code, language),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: on ? s.primary.withValues(alpha: 0.1) : null,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: on ? s.primary : s.border),
                                  ),
                                  child: Row(children: <Widget>[
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                        Text(l.native, style: Tw.sm.copyWith(fontWeight: FontWeight.w600, color: s.foreground)),
                                        Text(l.code.toUpperCase(), style: px(11, color: s.mutedForeground, height: 16 / 11)),
                                      ]),
                                    ),
                                    if (on) AIcon(AIcons.check, size: 16, color: s.primary),
                                  ]),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
                        child: Text(
                          tr('languageselector_dili_deyisdikden_sonra_tetbiq__ad3607', 'Dili dəyişdikdən sonra tətbiq yenilənəcək. / The app will reload after changing language.'),
                          style: px(11, color: s.mutedForeground.withValues(alpha: 0.7), height: 1.625),
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
