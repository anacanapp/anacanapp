// Ported from: src/lib/geoLanguage.ts
import 'dart:async';

/// Country (ISO 3166-1 alpha-2) → app language. Anything not listed falls back to English.
final Map<String, String> _countryLanguage = () {
  final map = <String, String>{};
  void add(String language, String countries) {
    for (final country in countries.split(' ')) {
      map[country] = language;
    }
  }

  add('az', 'AZ');
  add('tr', 'TR');
  add('ru', 'RU BY TJ');
  add('kk', 'KZ');
  add('ky', 'KG');
  add('uz', 'UZ');
  add('ka', 'GE');
  add('et', 'EE');
  add('tk', 'TM');
  add('uk', 'UA');
  add('de', 'DE AT CH LI LU');
  add('fr', 'FR MC BE SN CI CM ML BF NE TG BJ GA CG CD MG GN TD CF DJ KM HT RE GP MQ GF NC PF');
  add('nl', 'NL SR');
  add('es', 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ');
  add('pt', 'PT BR AO MZ CV GW ST TL');
  add('pl', 'PL');
  add('sv', 'SE');
  add('ja', 'JP');
  add('ko', 'KR');
  add('zh', 'CN TW HK MO');
  add('vi', 'VN');
  add('id', 'ID');
  add('hi', 'IN');
  add('ar', 'SA AE QA KW BH OM YE IQ SY JO LB PS EG LY SD DZ MA TN MR');
  return map;
}();

/// Language for a country, limited to the languages the app offers right now; otherwise English
/// (or the first available language when English is not offered).
String languageForCountry(String? country, List<String> available) {
  final fallback = available.contains('en') ? 'en' : (available.isNotEmpty ? available.first : 'en');
  if (country == null || country.isEmpty) return fallback;
  final language = _countryLanguage[country.toUpperCase()];
  return language != null && available.contains(language) ? language : fallback;
}

/// Calls the anon RPC `request_geo_country()` (returns the load balancer's
/// `X-Anacan-Geo-Country`). Implemented with the Supabase client by the caller.
typedef GeoCountryRpc = Future<Object?> Function();

/// `fetchGeoCountry`: IP country (ISO-2) or null (offline, timeout, unknown). Never throws.
Future<String?> fetchGeoCountry(GeoCountryRpc rpc, {Duration timeout = const Duration(milliseconds: 2500)}) async {
  try {
    final data = await rpc().timeout(timeout);
    if (data is! String || !RegExp(r'^[A-Z]{2}$').hasMatch(data)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/// Device-locale based first guess (no network): the device locale's language when the app offers
/// it, else the country rule on its region, else English. The web uses only the IP country; this is
/// the offline complement for the first-launch screen.
String languageForDeviceLocale(String? languageCode, String? countryCode, List<String> available) {
  final language = languageCode?.toLowerCase();
  if (language != null && available.contains(language)) return language;
  return languageForCountry(countryCode, available);
}
