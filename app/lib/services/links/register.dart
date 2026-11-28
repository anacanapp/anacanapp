// Ported from: src/App.tsx (`<Route path="*" element={<AppPathLink />}>`: the NotFound branch)
//
// The services' registrations: the 404 outer page. Everything else of app/lib/services is wired through
// [notificationServicesWiringOverrides] (native/services_wiring.dart) and mounted with [NativeServicesHost].
import '../../shell/feature_registry.dart';
import 'not_found_page.dart';

export '../native/native_services_host.dart' show NativeServicesHost;
export '../native/services_wiring.dart' show notificationServicesWiringOverrides;

void registerLinksServiceFeature(FeatureRegistry r) {
  r.registerRoutePage(
    OuterRouteId.notFound,
    (context, a) => NotFoundPage(path: a.uri.queryParameters['from'] ?? a.uri.path),
  );
}
