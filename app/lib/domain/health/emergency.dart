// Ported from: src/lib/emergency.ts
//
// Emergency medical number by COUNTRY (not language); 112 when the country is unknown (GSM standard).

import 'data/health_data.g.dart';

const String fallbackEmergencyNumber = '112';

String getEmergencyNumber(Object? countryCode) {
  if (countryCode is! String || !RegExp(r'^[a-z]{2}$', caseSensitive: false).hasMatch(countryCode.trim())) {
    return fallbackEmergencyNumber;
  }
  return emergencyNumbers[countryCode.trim().toUpperCase()] ?? fallbackEmergencyNumber;
}

/// i18n/content placeholder, e.g. "call {emergency}".
const String emergencyPlaceholder = '{emergency}';

/// Fills {emergency}; legacy copy with Azerbaijan's literal 103 has that standalone token swapped too.
String fillEmergencyNumber(String text, String emergencyNumber) {
  if (text.contains(emergencyPlaceholder)) return text.split(emergencyPlaceholder).join(emergencyNumber);
  return text.replaceAllMapped(RegExp(r'(^|[^\d+])103(?!\d)'), (m) => '${m[1]}$emergencyNumber');
}
