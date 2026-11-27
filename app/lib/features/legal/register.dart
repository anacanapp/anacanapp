// Ported from: src/pages/Index.tsx (`legal[/<doc>]` screen), src/App.tsx + src/pages/LegalPage.tsx (`/legal/:docType`)
import 'package:go_router/go_router.dart';

import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import 'legal_screen.dart';

void registerLegalFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.legal, (context, a) => LegalScreen(onBack: a.onBack, initialDocument: a.screen.param));
  r.registerRoutePage(OuterRouteId.legal, (context, a) => LegalScreen(onBack: () => context.go('/'), initialDocument: a.params['docType']));
}
