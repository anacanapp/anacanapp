// Ported from: src/pages/Index.tsx (`activeScreen === 'recap'` → `<RecapScreen onBack={() => setActiveScreen(null)} />`)
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import 'recap_screen.dart';

void registerRecapFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.recap, (context, a) => RecapScreen(onBack: a.onBack));
}
