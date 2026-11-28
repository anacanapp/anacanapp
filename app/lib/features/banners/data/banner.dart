// Ported from: src/hooks/useBanners.ts (Banner, BannerPlacement, LinkType, BannerPlatform)
//
// A banner row (own banner or anacan-brand-ads-v3 creative) as returned by get_banner_inventory_v3 / v2 or the
// legacy `banners` table, after `mapRowsTranslation`. Kept as the raw row with typed getters (snake_case keys).
import 'package:flutter/foundation.dart';

/// 'home_top' | 'home_middle' | 'home_bottom' | 'tools_top' | 'tools_bottom' | 'profile_top' | 'community_top' |
/// 'ai_chat_top'.
typedef BannerPlacement = String;

const List<BannerPlacement> kBannerPlacements = [
  'home_top', 'home_middle', 'home_bottom', 'tools_top', 'tools_bottom', 'profile_top', 'community_top', 'ai_chat_top',
];

@immutable
class Banner {
  const Banner(this.row);
  factory Banner.fromRow(Map<String, dynamic> row) => Banner(Map<String, dynamic>.unmodifiable(row));

  final Map<String, dynamic> row;

  String? _str(String key) => row[key] is String ? row[key] as String : null;
  List<String>? _list(String key) => row[key] is List ? [for (final v in row[key] as List) '$v'] : null;
  num? _num(String key) => row[key] is num ? row[key] as num : null;

  String get id => '${row['id'] ?? ''}';
  String get title => _str('title') ?? '';
  String? get description => _str('description');
  String? get imageUrl => _str('image_url');
  String? get linkUrl => _str('link_url');

  /// 'external' | 'internal' | 'tool' | 'lead_form'.
  String get linkType => _str('link_type') ?? 'external';
  String? get placement => _str('placement');

  /// 'native' | 'image'.
  String get bannerType => _str('banner_type') ?? 'native';
  String? get backgroundColor => _str('background_color');
  String? get textColor => _str('text_color');
  String? get buttonText => _str('button_text');
  bool get isPremiumOnly => row['is_premium_only'] == true;
  List<String>? get targetPlatforms => _list('target_platforms');
  num? get maxImpressionsPerUser => _num('max_impressions_per_user');
  bool get branded => row['branded'] == true;
  num? get measurementVersion => _num('measurement_version');
  num? get creativeRevision => _num('creative_revision');
  String? get sponsorName => _str('sponsor_name');
  String? get sponsorLogo => _str('sponsor_logo');
  List<String>? get audienceTiers => _list('audience_tiers');
  String? get nativeTemplate => _str('native_template');
  Map<String, dynamic> get creativeOptions => row['creative_options'] is Map ? Map<String, dynamic>.from(row['creative_options'] as Map) : const {};
  bool get leadForm => row['lead_form'] == true;

  Map<String, dynamic> toRow() => row;
}
