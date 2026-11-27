// Ported from: src/pages/Index.tsx (`billing` screen)
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import 'billing_screen.dart';

void registerBillingFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.billing, (context, a) => BillingScreen(onBack: a.onBack));
}
