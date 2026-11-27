// Ported from: src/lib/premium-sponsor.ts, src/data/sponsor/index.ts (createFeatureText: own → en → az)
//
// "Someone else pays for Premium": the woman creates a shareable link; a spouse or family member pays for her
// Premium on anacan.az/p/<token>. On payment her account gets Premium (the webhook grants it to the link's
// requester), and a linked partner shares it via household entitlement. The payer never gets app access or sees
// any personal/health data.
import '../../../core/i18n/i18n.dart';
import '../commerce_backend.dart';
import 'sponsor_copy.g.dart';

/// 'partner' | 'gift'
typedef SponsorKind = String;

/// 'spouse' | 'mother' | 'father' | 'sibling' | 'other'
typedef SponsorRelation = String;

// The pay page opens in the requester's own language: anacan.az/<lang>/p/?t=<token>.
const List<String> _sponsorLangs = [
  'az', 'en', 'tr', 'ru', 'kk', 'uz', 'ka', 'de', 'ar', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk', //
];

String sponsorLang(String language) => _sponsorLangs.contains(language) ? language : 'az';
String sponsorUrl(String token, [String language = 'az']) => 'https://anacan.az/${sponsorLang(language)}/p/?t=$token';

class SponsorLink {
  const SponsorLink({required this.token, required this.url, this.expiresAt, this.kind});
  final String token;
  final String url;
  final String? expiresAt;
  final String? kind;
}

/// Create (or reuse) a sponsor link for the current user.
Future<SponsorLink> createSponsorLink(CommerceBackend backend, SponsorKind kind, SponsorRelation? relation, String language) async {
  final res = await backend.rpc('create_premium_sponsor_link_v1', {'p_kind': kind, 'p_relation': relation, 'p_language': language});
  final data = res.data;
  final row = data is List ? (data.isEmpty ? null : data.first) : data;
  final token = row is Map ? row['token'] : null;
  if (res.error != null || token is! String || token.isEmpty) {
    throw StateError(res.error != null ? errorText(res.error) : 'sponsor_link_failed');
  }
  return SponsorLink(
    token: token,
    url: sponsorUrl(token, language),
    expiresAt: (row as Map)['expires_at'] is String ? row['expires_at'] as String : null,
    kind: row['kind'] is String ? row['kind'] as String : null,
  );
}

/// `useSponsorText(language)`: the language's pack, else English, else Azerbaijani.
Map<String, String> sponsorText([String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  return kSponsorCopy[lang] ?? kSponsorCopy['en'] ?? kSponsorCopy['az']!;
}

/// `fill(template, {name})`.
String sponsorFill(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);
