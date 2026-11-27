// Ported from: src/hooks/useDynamicTools.ts (ToolConfig)
//
// A `tool_configs` row after `mapRowsTranslation` (name, description, partner_name, partner_description,
// hero_subtitle, hero_badge localized). The row is kept as-is (snake_case keys) and read through typed getters.
import 'package:flutter/foundation.dart';

import '../../../core/data/row.dart';

@immutable
class ToolConfig {
  const ToolConfig(this.row);

  factory ToolConfig.fromRow(Map<String, dynamic> row) => ToolConfig(Map<String, dynamic>.of(row));

  final Map<String, dynamic> row;

  Map<String, dynamic> toRow() => row;

  num? _n(String key) {
    final v = row[key];
    return v is num ? v : v is String ? num.tryParse(v) : null;
  }

  String? get id => row.str('id');
  String get toolId => row.str('tool_id') ?? '';
  String get name => row.str('name') ?? '';

  /// `display_name` (not localized by the hook; the hub and the tour use `display_name || name`).
  String? get displayName => row.str('display_name');
  String? get description => row.str('description');
  String get icon => row.str('icon') ?? '';
  String get color => row.str('color') ?? '';
  String get bgColor => row.str('bg_color') ?? '';
  int? get minWeek => row.integer('min_week');
  List<String>? get lifeStages => row['life_stages'] is List ? row.strings('life_stages') : null;
  bool get requiresPartner => row['requires_partner'] == true;
  String? get partnerName => row.str('partner_name');
  String? get partnerDescription => row.str('partner_description');
  num? get sortOrder => _n('sort_order');
  num? get flowOrder => _n('flow_order');
  num? get bumpOrder => _n('bump_order');
  num? get mommyOrder => _n('mommy_order');
  bool? get isActive => row.boolean('is_active');
  bool? get flowActive => row.boolean('flow_active');
  bool? get bumpActive => row.boolean('bump_active');
  bool? get mommyActive => row.boolean('mommy_active');
  bool get flowLocked => row['flow_locked'] == true;
  bool get bumpLocked => row['bump_locked'] == true;
  bool get mommyLocked => row['mommy_locked'] == true;
  bool? get isPremium => row.boolean('is_premium');
  String? get premiumType => row.str('premium_type');
  int get premiumLimit => row.integer('premium_limit') ?? 0;
  bool get isHero => row['is_hero'] == true;
  num get heroOrder => _n('hero_order') ?? 0;
  String? get heroGradient => row.str('hero_gradient');
  String? get heroSubtitle => row.str('hero_subtitle');
  String? get heroBadge => row.str('hero_badge');
  bool get isQuickAccess => row['is_quick_access'] == true;
  num? get quickAccessOrder => _n('quick_access_order');
  String? get quickAccessGradient => row.str('quick_access_gradient');

  /// The stage lock of [lifeStage] (`flow_locked` / `bump_locked` / `mommy_locked`, else false).
  bool lockedFor(String? lifeStage) => switch (lifeStage) {
        'flow' => flowLocked,
        'bump' => bumpLocked,
        'mommy' => mommyLocked,
        _ => false,
      };

  @override
  bool operator ==(Object other) => other is ToolConfig && mapEquals(other.row, row);

  @override
  int get hashCode => Object.hash(toolId, row.length);
}
