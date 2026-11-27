// Ported from: src/components/MedicalDisclaimer.tsx (variant 'anacan' and 'inline'), src/hooks/useEmergencyNumber.ts
//              (country → number), src/styles/anacan-design.css (.a-disclaimer)
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart';
import '../../../state/user_store.dart';
import '../home_inputs.dart';

/// `useEmergencyNumber()`: the profile / store country's emergency number.
final homeEmergencyNumberProvider = Provider<String>((ref) {
  final profileCountry = ref.watch(homeProfileRowProvider)?['country_code'];
  final storeCountry = ref.watch(userStoreProvider.select((s) => s.countryCode));
  return getEmergencyNumber(profileCountry is String && profileCountry.isNotEmpty ? profileCountry : storeCountry);
});

enum MedicalDisclaimerVariant { anacan, inline }

class MedicalDisclaimer extends ConsumerWidget {
  const MedicalDisclaimer({super.key, this.variant = MedicalDisclaimerVariant.anacan});
  final MedicalDisclaimerVariant variant;

  static String text(String emergency) => fillEmergencyNumber(
    tr(
      'medical_disclaimer_full',
      tr(
        'medical_disclaimer_text',
        'Bu məlumat yalnız maarifləndirmə məqsədi daşıyır və tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda {emergency} nömrəsinə zəng edin.',
      ),
    ),
    emergency,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final body = text(ref.watch(homeEmergencyNumberProvider));
    final t = context.a;
    if (variant == MedicalDisclaimerVariant.inline) {
      return Text('⚕️ $body', style: TextStyle(fontSize: 11, height: 1.625, color: AnacanTokens.of(context).shadcn.mutedForeground));
    }
    // Anacan redesign frosted disclaimer card.
    return Container(
      key: const ValueKey('medical-disclaimer'),
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: t.disclaimerBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: t.disclaimerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: AIcon(AIcons.stethoscope, size: 15, color: t.disclaimerInk),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              body,
              style: TextStyle(fontSize: 10.5, height: 1.55, color: t.disclaimerInk, leadingDistribution: TextLeadingDistribution.even),
            ),
          ),
        ],
      ),
    );
  }
}
