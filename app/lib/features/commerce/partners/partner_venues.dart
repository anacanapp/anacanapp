// Ported from: src/hooks/usePartnerVenues.ts
import '../../../core/cache/cache.dart';
import '../../../state/user_store.dart';
import '../commerce_backend.dart';

class PartnerVenue {
  PartnerVenue(this.row);
  final Map<String, dynamic> row;

  String? _s(String k) => row[k] is String ? row[k] as String : null;
  double? _n(String k) => row[k] is num ? (row[k] as num).toDouble() : (row[k] is String ? double.tryParse(row[k] as String) : null);

  String get id => '${row['id']}';
  String get name => _s('name') ?? '';
  String? get slug => _s('slug');
  String get categoryKey => _s('category_key') ?? '';
  String? get description => _s('description');
  String? get logoUrl => _s('logo_url');
  String? get coverUrl => _s('cover_url');
  List<String>? get galleryUrls => row['gallery_urls'] is List
      ? [
          for (final g in row['gallery_urls'] as List)
            if (g is String) g,
        ]
      : null;
  String? get address => _s('address');
  double? get latitude => _n('latitude');
  double? get longitude => _n('longitude');
  String? get phone => _s('phone');
  String? get website => _s('website');
  String? get instagram => _s('instagram');
  String get discountLabel => _s('discount_label') ?? '';
  String? get discountTerms => _s('discount_terms');
  bool get isFeatured => row['is_featured'] == true;
  List<String> get countries => row['countries'] is List
      ? [
          for (final c in row['countries'] as List)
            if (c is String) c,
        ]
      : const [];
}

class PartnerCategory {
  PartnerCategory(this.row);
  final Map<String, dynamic> row;
  String get key => '${row['key']}';
  String get labelAz => row['label_az'] is String ? row['label_az'] as String : '';
  String? get labelEn => row['label_en'] is String ? row['label_en'] as String : null;
}

/// Category name in the user's language.
String localizeCategoryLabel(PartnerCategory c, String language) {
  if (language == 'az') return c.labelAz;
  final loc = c.row['label_$language'];
  if (loc is String && loc.isNotEmpty) return loc;
  final en = c.labelEn;
  return en != null && en.isNotEmpty ? en : c.labelAz;
}

final partnerCategoriesQuery = queryProvider<List<PartnerCategory>>(
  (ref) => QueryOptions<List<PartnerCategory>>(
    queryKey: const ['partner-categories'],
    staleTime: const Duration(minutes: 10),
    queryFn: (_) async => [for (final r in await ref.read(commerceBackendProvider).partnerCategories()) PartnerCategory(r)],
  ),
);

final partnerVenuesQuery = queryProviderFamily<List<PartnerVenue>, String>(
  (ref, categoryKey) => QueryOptions<List<PartnerVenue>>(
    queryKey: ['partner-venues', categoryKey.isEmpty ? 'all' : categoryKey],
    staleTime: const Duration(minutes: 5),
    queryFn: (_) async {
      final rows = await ref.read(commerceBackendProvider).partnerVenues(categoryKey);
      // Country targeting: empty/null countries = global; otherwise only those countries.
      final stored = ref.read(userStoreProvider).countryCode;
      final userCountry = stored == null || stored.isEmpty ? 'AZ' : stored;
      return [
        for (final r in rows)
          if (PartnerVenue(r).countries.isEmpty || PartnerVenue(r).countries.contains(userCountry)) PartnerVenue(r),
      ];
    },
  ),
);

class RedemptionResponse {
  const RedemptionResponse({
    required this.token,
    required this.verifyUrl,
    required this.expiresAt,
    required this.ttlSeconds,
    required this.venueName,
    required this.discountLabel,
  });
  final String token;
  final String verifyUrl;
  final String expiresAt;
  final int ttlSeconds;
  final String venueName;
  final String discountLabel;
}

class RedemptionException implements Exception {
  const RedemptionException(this.message);
  final String message;
  @override
  String toString() => message;
}

Future<RedemptionResponse> createRedemption(CommerceBackend backend, String venueId) async {
  final res = await backend.invoke('partner-create-redemption', {'venue_id': venueId});
  if (res.error != null) {
    final body = functionErrorBody(res.error);
    if (body is Map && body['error'] is String) throw RedemptionException(body['error'] as String);
    throw RedemptionException(errorText(res.error));
  }
  final data = res.data;
  if (data is Map && data['error'] != null) throw RedemptionException('${data['error']}');
  if (data is! Map) throw const RedemptionException('');
  String s(String k) => data[k] is String ? data[k] as String : '';
  return RedemptionResponse(
    token: s('token'),
    verifyUrl: s('verify_url'),
    expiresAt: s('expires_at'),
    ttlSeconds: data['ttl_seconds'] is num ? (data['ttl_seconds'] as num).toInt() : 0,
    venueName: s('venue_name'),
    discountLabel: s('discount_label'),
  );
}
