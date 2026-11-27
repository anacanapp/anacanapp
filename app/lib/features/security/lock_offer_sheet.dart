// Ported from: src/components/security/LockOfferSheet.tsx, src/lib/lock-offer.ts (via app_lock.dart)
//
// First-run offer (first Home visit after onboarding, native only): protect Anacan with Face ID / fingerprint + PIN.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/state.dart';
import '../settings/copy/feature_copy.dart';
import '../settings/ui/settings_ui.dart';

/// Opens the offer; resolves to true when the user chose "enable" (the caller then opens the setup sheet 350 ms
/// later with `preferBio: true`, as Index does).
Future<bool> showLockOfferSheet(BuildContext context) async {
  final result = await Navigator.of(context, rootNavigator: true).push<bool>(ASheetRoute<bool>(
    builder: (ctx) => const LockOfferSheetBody(),
  ));
  return result ?? false;
}

class LockOfferSheetBody extends ConsumerWidget {
  const LockOfferSheetBody({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final t = lockOfferText(ref.watch(userStoreProvider.select((s) => s.language)));
    final ios = defaultTargetPlatform == TargetPlatform.iOS;
    final rows = [
      (icon: ios ? AIcons.scanFace : AIcons.fingerprint, bg: a.lav1, fg: a.lavInk, title: ios ? t('bio_ios') : t('bio_android'), line: t('bio_line')),
      (icon: AIcons.keyRound, bg: a.blue1, fg: a.blueInk, title: t('pin_title'), line: t('pin_line')),
      (
        icon: AIcons.settings2,
        bg: a.surfaceSoft,
        fg: a.inkSoft,
        title: t('settings_title'),
        line: fill(t('settings_line'), {'where': '${tr('settingsscreen_tenzimlemeler_085659', 'Tənzimləmələr')} → ${tr('settingsscreen_sifre_ile_qoruma_152a0e', 'Şifrə ilə qoruma')}'}),
      ),
    ];
    return ASheet(
      full: false,
      title: Text(t('title')),
      onClose: () => Navigator.of(context).maybePop(false),
      footer: Row(children: <Widget>[
        AButton(key: const ValueKey<String>('lock-offer-later'), variant: AButtonVariant.ghost, onPressed: () => Navigator.of(context).maybePop(false), child: Text(t('later'))),
        const SizedBox(width: 8),
        Expanded(child: AButton(key: const ValueKey<String>('lock-offer-enable'), variant: AButtonVariant.accent, block: true, onPressed: () => Navigator.of(context).maybePop(true), child: Text(t('enable')))),
      ]),
      children: <Widget>[
        VGap(gap: 16, children: <Widget>[
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Center(
              child: FadeRise(
                dy: 0,
                scaleFrom: 0.8,
                child: Container(
                  width: 84,
                  height: 84,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: <Color>[a.peach1, a.lav1]),
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 16), blurRadius: 30, spreadRadius: -16)],
                  ),
                  child: AIcon(AIcons.shieldCheck, size: 40, strokeWidth: 1.8, color: a.peach2),
                ),
              ),
            ),
          ),
          Text(t('subtitle'), textAlign: TextAlign.center, style: px(13, color: a.inkSoft, height: 1.45)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
            child: Column(children: <Widget>[
              for (var i = 0; i < rows.length; i++)
                FadeRise(
                  dy: 6,
                  delay: Duration(milliseconds: 80 * (i + 1)),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                    child: Row(children: <Widget>[
                      Container(
                        width: 42,
                        height: 42,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: rows[i].bg, borderRadius: BorderRadius.circular(14)),
                        child: AIcon(rows[i].icon, size: 20, color: rows[i].fg),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Text(rows[i].title, style: px(14, weight: FontWeight.w700, color: a.ink)),
                          Text(rows[i].line, style: px(12.5, color: a.inkSoft, height: 1.45)),
                        ]),
                      ),
                    ]),
                  ),
                ),
            ]),
          ),
        ]),
      ],
    );
  }
}
