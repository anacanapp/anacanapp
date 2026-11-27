// Ported from: src/components/MedicalDisclaimer.tsx, src/hooks/useEmergencyNumber.ts
//
// Reusable medical disclaimer (Google Play Health Content policy). Variants: banner (default), compact, inline,
// anacan (`.a-disclaimer`). Tailwind amber literals for banner/compact.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/health/emergency.dart';
import '../../state/state.dart' show userStoreProvider;
import '../settings/ui/settings_ui.dart';

enum MedicalDisclaimerVariant { banner, compact, inline, anacan }

/// `useEmergencyNumber()`: profile country, else the stored country.
final emergencyNumberProvider = Provider<String>((ref) {
  final profileCountry = ref.watch(authProfileProvider)?.countryCode;
  final stored = ref.watch(userStoreProvider.select((s) => s.countryCode));
  return getEmergencyNumber((profileCountry?.isNotEmpty ?? false) ? profileCountry : stored);
});

class MedicalDisclaimer extends ConsumerWidget {
  const MedicalDisclaimer({super.key, this.variant = MedicalDisclaimerVariant.banner});
  final MedicalDisclaimerVariant variant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = fillEmergencyNumber(
      tr('medical_disclaimer_full', tr('medical_disclaimer_text', 'Bu məlumat yalnız maarifləndirmə məqsədi daşıyır və tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda {emergency} nömrəsinə zəng edin.')),
      ref.watch(emergencyNumberProvider),
    );
    final dark = context.tokens.isDark;
    final a = context.a;
    switch (variant) {
      case MedicalDisclaimerVariant.anacan:
        return Container(
          margin: const EdgeInsets.only(top: 24),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: a.disclaimerBg, borderRadius: BorderRadius.circular(18), border: Border.all(color: a.disclaimerBorder)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Padding(padding: const EdgeInsets.only(top: 1), child: AIcon(AIcons.stethoscope, size: 15, color: a.disclaimerInk)),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: px(10.5, color: a.disclaimerInk, height: 1.55))),
          ]),
        );
      case MedicalDisclaimerVariant.inline:
        return Text('⚕️ $text', style: px(11, color: context.tokens.shadcn.mutedForeground, height: 1.625));
      case MedicalDisclaimerVariant.compact:
      case MedicalDisclaimerVariant.banner:
        final compact = variant == MedicalDisclaimerVariant.compact;
        // amber-50/950@30, amber-200/900@50, amber-600/400, amber-800/200
        final bg = dark ? const Color(0x4D451A03) : const Color(0xFFFFFBEB);
        final border = dark ? const Color(0x8078350F) : const Color(0xFFFDE68A);
        final icon = dark ? const Color(0xFFFBBF24) : const Color(0xFFD97706);
        final ink = dark ? const Color(0xFFFDE68A) : const Color(0xFF92400E);
        return Container(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: compact ? 8 : 10),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(compact ? 8 : 12), border: Border.all(color: border)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.circleAlert, size: compact ? 14 : 16, color: icon)),
            SizedBox(width: compact ? 8 : 10),
            Expanded(child: Text(text, style: px(compact ? 11 : 12, color: ink, height: 1.625))),
          ]),
        );
    }
  }
}
