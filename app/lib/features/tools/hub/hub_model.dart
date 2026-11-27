// Ported from: src/components/ToolsHub.tsx (tool list, access, visibility, availability, hero order, search, merged
//              sections), src/lib/freemium.ts (via domain/billing/freemium.dart)
//
// Pure logic of the Tools hub: everything that does not need a widget. The widget (tools_hub.dart) feeds it
// [HubContext] and the tool configs.
import 'package:flutter/foundation.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/icons.g.dart';
import '../../../domain/billing/freemium.dart';
import '../../../domain/kid_exercises/kid_exercises.dart' show isKidExTileVisible;
import '../../../domain/parenting/parenting.dart' show isParentingTileVisible;
import '../../../domain/play_together/play_together.dart' show isPlayTileVisible;
import '../../../domain/sleep/sleep_training.dart' show sleepTrainingEligible;
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../domain/weaning/weaning.dart' show isWeaningTileVisible;
import '../../../shell/nav/ids.dart' show canonicalToolId, isMergedAway;
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../data/tool_config.dart';
import 'fold_text.dart';
import 'hub_copy.dart';

/// Everything the hub reads from stores / auth / subscription / settings (one seam for tests).
@immutable
class HubContext {
  const HubContext({
    this.lifeStage,
    this.language = 'az',
    this.countryCode,
    this.profileCountryCode,
    this.hasPartner = false,
    this.isAdmin = false,
    this.isPremium = false,
    this.currentWeek = 0,
    this.disabledTools = const [],
    this.childBirthDate,
    this.childBirthDates = const [],
    this.weaningSetting,
    this.parentingSetting,
    this.now,
  });

  /// `useUserStore().lifeStage`.
  final String? lifeStage;

  /// `useUserStore().language`.
  final String language;

  /// `useUserStore().countryCode` (stored country).
  final String? countryCode;

  /// `profile?.country_code`.
  final String? profileCountryCode;

  /// `!!profile?.linked_partner_id`.
  final bool hasPartner;
  final bool isAdmin;

  /// `useSubscription().isPremium`.
  final bool isPremium;

  /// `getPregnancyData()?.currentWeek || 0`.
  final int currentWeek;

  /// `useDisabledTools().disabledTools`.
  final List<String> disabledTools;

  /// `(selectedChild ?? children[0])?.birth_date ?? null`.
  final String? childBirthDate;

  /// `children.map((c) => c.birth_date)`.
  final List<String?> childBirthDates;

  /// `useAppSetting('weaning_tool')` / `useAppSetting('parenting_tool')`.
  final Object? weaningSetting;
  final Object? parentingSetting;

  /// Clock for the age predicates (null = now).
  final DateTime? now;

  @override
  bool operator ==(Object other) =>
      other is HubContext &&
      other.lifeStage == lifeStage &&
      other.language == language &&
      other.countryCode == countryCode &&
      other.profileCountryCode == profileCountryCode &&
      other.hasPartner == hasPartner &&
      other.isAdmin == isAdmin &&
      other.isPremium == isPremium &&
      other.currentWeek == currentWeek &&
      listEquals(other.disabledTools, disabledTools) &&
      other.childBirthDate == childBirthDate &&
      listEquals(other.childBirthDates, childBirthDates) &&
      other.weaningSetting == weaningSetting &&
      other.parentingSetting == parentingSetting &&
      other.now == now;

  @override
  int get hashCode => Object.hash(lifeStage, language, countryCode, profileCountryCode, hasPartner, isAdmin, isPremium, currentWeek,
      Object.hashAll(disabledTools), childBirthDate, Object.hashAll(childBirthDates), weaningSetting, parentingSetting, now);
}

/// One tile (`Tool` interface of ToolsHub.tsx).
@immutable
class HubTool {
  const HubTool({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    this.color = '',
    this.bgColor = '',
    this.minWeek,
    this.stages,
    this.isPremium = false,
    this.premiumType = 'none',
    this.premiumLimit = 0,
    this.isLocked = false,
    this.limited = false,
    this.preview = false,
  });

  final String id;
  final String name;
  final String description;
  final AIconData icon;
  final String color;
  final String bgColor;
  final int? minWeek;
  final List<String>? stages;

  /// Premium section (also preview tools).
  final bool isPremium;
  final String premiumType;
  final int premiumLimit;

  /// Stage lock (`flow_locked` / `bump_locked` / `mommy_locked`).
  final bool isLocked;

  /// Free users can open it; the tool enforces its own free limit.
  final bool limited;

  /// Premium section, but opens for everyone (play / generate is gated inside).
  final bool preview;
}

/// `iconMap` of ToolsHub (anything else → Wrench).
const Map<String, AIconData> kHubIconMap = {
  'Ruler': AIcons.ruler, 'Camera': AIcons.camera, 'Utensils': AIcons.utensils, 'ShoppingCart': AIcons.shoppingCart,
  'Shield': AIcons.shield, 'Footprints': AIcons.footprints, 'Timer': AIcons.timer, 'Scale': AIcons.scale, 'Baby': AIcons.baby,
  'Briefcase': AIcons.briefcase, 'Volume2': AIcons.volume2, 'Activity': AIcons.activity, 'Heart': AIcons.heart,
  'Wrench': AIcons.wrench, 'BookOpen': AIcons.bookOpen, 'ChefHat': AIcons.chefHat, 'Stethoscope': AIcons.stethoscope,
  'Droplet': AIcons.droplet, 'ImagePlus': AIcons.imagePlus, 'Package': AIcons.package, 'Mic': AIcons.mic, 'Scan': AIcons.scan,
  'CloudSun': AIcons.cloudSun, 'Gauge': AIcons.gauge, 'Store': AIcons.store, 'MapPin': AIcons.mapPin, 'Gamepad2': AIcons.gamepad2,
  'ShieldAlert': AIcons.shieldAlert, 'BookHeart': AIcons.bookHeart, 'Stars': AIcons.sparkles, 'Calculator': AIcons.calculator,
  'Pill': AIcons.pill, 'Syringe': AIcons.syringe, 'TrendingUp': AIcons.trendingUp, 'Dumbbell': AIcons.dumbbell,
  'Brain': AIcons.brain, 'Sprout': AIcons.sprout, 'HeartHandshake': AIcons.heartHandshake,
};

/// `CODE_SECTION_LABEL`: tab names of code tools that may not be in the tile list.
String? codeSectionLabel(String id) => switch (id) {
      'baby-tracker' => babycareText('babytracker_tool_name'),
      'sleep-training' => babycareText('sleeptraining_title'),
      _ => null,
    };

/// The tool row of [toolId], if loaded.
ToolConfig? configFor(List<ToolConfig> configs, String toolId) {
  for (final c in configs) {
    if (c.toolId == toolId) return c;
  }
  return null;
}

/// `accessFor(toolId)`: DB config (premium flag, admin premium_type, stage lock) when loaded.
ToolAccess hubAccessFor(String toolId, List<ToolConfig> configs, String? lifeStage) {
  final config = configFor(configs, toolId);
  return config != null
      ? toolAccess(toolId: toolId, isPremiumFlag: config.isPremium, premiumType: config.premiumType, stageLocked: config.lockedFor(lifeStage))
      : toolAccess(toolId: toolId);
}

/// Tile visibility of the code tools with their own eligibility.
@immutable
class HubVisibility {
  const HubVisibility({required this.weaning, required this.parenting, required this.kidExercises});
  final bool weaning;
  final bool parenting;
  final bool kidExercises;

  factory HubVisibility.of(HubContext c) => HubVisibility(
        weaning: !c.disabledTools.contains('weaning') &&
            isWeaningTileVisible(lifeStage: c.lifeStage, birthDate: c.childBirthDate, setting: c.weaningSetting, now: c.now),
        parenting: !c.disabledTools.contains('parenting') &&
            isParentingTileVisible(
                lifeStage: c.lifeStage,
                language: c.language,
                birthDate: c.childBirthDate,
                birthDates: c.childBirthDates,
                setting: c.parentingSetting,
                now: c.now),
        kidExercises: !c.disabledTools.contains('kid-exercises') &&
            isKidExTileVisible(lifeStage: c.lifeStage, hasContent: hasKidExContent(c.language), isAdmin: c.isAdmin),
      );
}

DateTime? _parseBirthDate(String? s) {
  if (s == null || s.isEmpty) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(s);
  // `new Date('YYYY-MM-DD')` is UTC midnight; ISO timestamps keep their instant.
  if (m != null) return DateTime.utc(int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!));
  return DateTime.tryParse(s);
}

/// Name / description / icon of code tools come from code translations, not from the row.
({String name, String description, AIconData icon})? _codeMeta(String id, String language) => switch (id) {
      'cakes' => (name: tr('toolshub_cakes_name', 'Tortlar'), description: tr('toolshub_xususi_gunler_ucun_tortlar_8a2248', 'Xüsusi günlər üçün tortlar'), icon: AIcons.cake),
      'mini-games' => (name: tr('toolshub_minigames_title', 'Mini Oyunlar'), description: '', icon: AIcons.gamepad2),
      'baby-tracker' => (name: babycareText('babytracker_tool_name'), description: babycareText('babytracker_tool_desc'), icon: AIcons.baby),
      'sleep-training' => (name: babycareText('sleeptraining_title'), description: babycareText('sleeptraining_tool_desc'), icon: AIcons.moonStar),
      'solid-food-guide' => (name: hubFeature37Text('sfg_home_title', language), description: hubFeature37Text('sfg_tool_desc', language), icon: AIcons.salad),
      'parenting' => (name: parentingTileText('par_tool_name'), description: parentingTileText('par_tool_desc'), icon: AIcons.heartHandshake),
      'play-together' => () {
          final t = playTileText(language);
          return (name: t.name, description: t.description, icon: AIcons.puzzle);
        }(),
      'kid-exercises' => () {
          final t = kidExTileText(language);
          return (name: t.name, description: t.description, icon: AIcons.personStanding);
        }(),
      _ => null,
    };

/// The `tools` memo of ToolsHub: rows minus disabled / ineligible tools, mapped to tiles, plus the virtual weaning and
/// kid-exercises tiles when their rows are missing.
List<HubTool> buildHubTools(List<ToolConfig> configs, HubContext c) {
  if (configs.isEmpty) return const [];
  final v = HubVisibility.of(c);
  final now = c.now ?? DateTime.now();
  final cakesOk = (c.isAdmin || isCakesAvailable(c.profileCountryCode, c.language)) && (c.lifeStage == 'bump' || c.lifeStage == 'mommy' || c.isAdmin);
  final active = configs.where((config) {
    final id = config.toolId;
    if (c.disabledTools.contains(id)) return false;
    if (id == 'weaning' && !v.weaning) return false;
    if (id == 'parenting' && !v.parenting) return false;
    // Code tools keep their own eligibility; their rows only carry order and per-stage visibility.
    if (id == 'cakes' && !cakesOk) return false;
    if (id == 'solid-food-guide' && c.lifeStage != 'mommy') return false;
    if (id == 'play-together' && !isPlayTileVisible(lifeStage: c.lifeStage, hasContent: hasPlayContent(c.language), isAdmin: c.isAdmin)) return false;
    if (id == 'kid-exercises' && !v.kidExercises) return false;
    if (id == 'sleep-training' && !sleepTrainingEligible(lifeStage: c.lifeStage, birthDate: _parseBirthDate(c.childBirthDate), now: now)) return false;
    return true;
  });

  final fromDb = <HubTool>[
    for (final config in active)
      () {
        final id = config.toolId;
        final usePartner = c.hasPartner && config.requiresPartner;
        final name = usePartner && (config.partnerName?.isNotEmpty ?? false)
            ? config.partnerName!
            : ((config.displayName?.isNotEmpty ?? false) ? config.displayName! : config.name);
        final description = id == 'names' || id == 'baby-names'
            ? hubFollowupText('names_country', c.language, {
                'country': localizedCountryName(regionalCountry(c.language, [c.profileCountryCode, c.countryCode]), c.language),
              })
            : usePartner && (config.partnerDescription?.isNotEmpty ?? false)
                ? config.partnerDescription!
                : config.description ?? '';
        final meta = _codeMeta(id, c.language);
        // Stage lock is tracked separately (isLocked), so access is computed without it here.
        final access = toolAccess(toolId: id, isPremiumFlag: config.isPremium, premiumType: config.premiumType);
        final minWeek = config.minWeek;
        return HubTool(
          id: id,
          name: meta?.name ?? (id == 'weaning' ? weaningTileText('weaning_tool_name') : id == 'parenting' ? parentingTileText('par_tool_name') : name),
          description: meta?.description ??
              (id == 'weaning' ? weaningTileText('weaning_tool_desc') : id == 'parenting' ? parentingTileText('par_tool_desc') : description),
          icon: meta?.icon ?? kHubIconMap[config.icon] ?? AIcons.wrench,
          color: config.color,
          bgColor: config.bgColor,
          minWeek: minWeek == null || minWeek == 0 ? null : minWeek,
          stages: config.lifeStages,
          isPremium: access == 'premium' || access == 'preview',
          preview: access == 'preview',
          limited: access == 'limited',
          premiumType: (config.premiumType?.isNotEmpty ?? false) ? config.premiumType! : 'none',
          premiumLimit: config.premiumLimit,
          isLocked: config.lockedFor(c.lifeStage),
        );
      }(),
  ];

  HubTool virtual(String id, String name, String description, AIconData icon) => HubTool(
        id: id,
        name: name,
        description: description,
        icon: icon,
        color: 'pink',
        bgColor: 'pink',
        stages: const ['mommy'],
        isPremium: toolAccess(toolId: id) == 'premium',
        limited: toolAccess(toolId: id) == 'limited',
      );
  final extra = <HubTool>[
    if (v.weaning && !fromDb.any((t) => t.id == 'weaning'))
      virtual('weaning', weaningTileText('weaning_tool_name'), weaningTileText('weaning_tool_desc'), AIcons.sprout),
    if (v.kidExercises && !fromDb.any((t) => t.id == 'kid-exercises'))
      () {
        final t = kidExTileText(c.language);
        return virtual('kid-exercises', t.name, t.description, AIcons.personStanding);
      }(),
  ];
  return [...fromDb, ...extra];
}

/// `isToolAvailable(tool)`: admins everywhere; otherwise the stage list and the bump min week.
bool isHubToolAvailable(HubTool tool, HubContext c) {
  if (c.isAdmin) return true;
  if (tool.stages != null && !tool.stages!.contains(c.lifeStage ?? '')) return false;
  if (tool.minWeek != null && c.lifeStage == 'bump' && c.currentWeek < tool.minWeek!) return false;
  return true;
}

/// `unavailableHint(tool)`: "{week}. həftədən" for a week gate in the bump stage, else "Başqa mərhələ üçün".
String unavailableHint(HubTool tool, String? lifeStage) =>
    tool.minWeek != null && lifeStage == 'bump' && (tool.stages == null || tool.stages!.contains('bump'))
        ? formatTr('toolshub_tile_from_week', '{week}. həftədən', {'week': tool.minWeek})
        : tr('toolshub_tile_other_stage', 'Başqa mərhələ üçün');

/// `matchesSearch(tool.name, tool.description)`: accent-insensitive substring match.
bool matchesHubSearch(HubTool tool, String query) {
  final folded = foldText(query);
  return folded.isEmpty || foldText(tool.name).contains(folded) || foldText(tool.description).contains(folded);
}

/// The grouped list: search results, or the Free / Premium sections ordered by hero order.
@immutable
class HubLists {
  const HubLists({required this.displayed, required this.free, required this.premium});
  final List<HubTool> displayed;
  final List<HubTool> free;
  final List<HubTool> premium;
}

HubLists hubLists(List<HubTool> tools, List<ToolConfig> configs, String query) {
  // Hero tools (admin "is_hero") lead their section in hero_order instead of a separate strip.
  final heroOrder = {for (final t in configs.where((t) => t.isHero)) t.toolId: t.heroOrder};
  final filtered = tools.where((t) => matchesHubSearch(t, query));
  // Tiles of tools that now live inside another tool are hidden where that host is available.
  bool inList(String id) => tools.any((x) => canonicalToolId(x.id) == id);
  final displayed = filtered.where((t) => !isMergedAway(t.id, inList)).toList();
  List<HubTool> byHero(Iterable<HubTool> list) {
    final indexed = [for (final (i, t) in list.indexed) (i, t)];
    indexed.sort((a, b) {
      final ha = heroOrder.containsKey(a.$2.id) ? 0 : 1, hb = heroOrder.containsKey(b.$2.id) ? 0 : 1;
      if (ha != hb) return ha - hb;
      final c = (heroOrder[a.$2.id] ?? 0).compareTo(heroOrder[b.$2.id] ?? 0);
      return c != 0 ? c : a.$1 - b.$1;
    });
    return [for (final e in indexed) e.$2];
  }

  return HubLists(
    displayed: displayed,
    free: byHero(displayed.where((t) => !t.isPremium && !t.isLocked)),
    premium: byHero(displayed.where((t) => t.isPremium || t.isLocked)),
  );
}
