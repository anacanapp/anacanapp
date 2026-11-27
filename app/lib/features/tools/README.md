# Tools feature (hub, tool kit, dynamic data hooks)

Port of `src/components/ToolsHub.tsx`, `src/components/tools/anacan/{ToolKit,SafetyStrip}.tsx`,
`src/hooks/{useDynamicTools,useDynamicConfig,useDynamicContent}.ts`, `src/lib/{code-tools,followup-content,
name-collections}.ts` and the hub parts of `src/lib/parenting-search.ts` (foldText) and the tile modules.
Tests: `app/test/features/tools/` (`flutter test test/features/tools`).

```dart
import 'package:anacan/features/tools/tools.dart';      // everything below
import 'package:anacan/features/tools/kit/kit.dart';    // only the tool kit
import 'package:anacan/features/tools/data/data.dart';  // only the data hooks
```

## 1. Writing a tool

A tool is registered by its own feature and rendered by the hub (the hub provides the merged-tool sections, the
Premium boundary, Android back, analytics and scroll handling):

```dart
// app/lib/features/kick/register.dart
void registerKickCounter(FeatureRegistry r) {
  r.registerTool(ToolId.kick, (context, a) => KickCounter(onBack: a.onBack));
}

class KickCounter extends ConsumerWidget {
  const KickCounter({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sounds = ref.watch(whiteNoiseSoundsQuery);          // useWhiteNoiseSounds()
    if (sounds.isLoading) return const ToolLoading();           // <ToolLoading />
    return ToolPage(                                            // <ToolPage>
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(                                             // <ToolHeader title eyebrow onBack actions />
          title: tr('kick_title', 'Təpik sayğacı'),
          eyebrow: tr('kick_eyebrow', 'Hamiləlik'),
          onBack: onBack,
          actions: [ToolIconButton(icon: const AIcon(AIcons.history, size: 16), onTap: () {})],
        ),
        if ((sounds.data ?? const []).isEmpty)
          ToolEmpty(icon: const Text('👣'), title: tr('…', 'Hələ qeyd yoxdur'), text: tr('…', '…')),
        SafetyStrip(signs: tr('kick_safety', 'Zəng edin: hərəkətlər azalıbsa')),
        SafetyMore(summary: tr('…', 'Əvvəlcə həkimlə danışın'), text: tr('…', '…')),
      ]),
    );
  }
}
```

Layout rule: the Tools tab is a **box tab** in the shell's single scroll view. A tool body gets unbounded height — use
plain `Column`s (no `Expanded`, no unbounded `ListView`; use `ListView(shrinkWrap: true, physics: NeverScrollable…)` or
a `Column` for lists). `ToolPage` scrolls the shared container to the top when it mounts (`useScrollToTop()`).

## 2. Tool kit: React → Dart

| React | Dart | Notes |
|---|---|---|
| `<ToolPage className noShell>` | `ToolPage(noShell:, child:)` | `.a-scope` on `--a-bg`, `pb-24` (96), `.a-shell` 20px inline padding unless `noShell`; scroll to top on mount. `className` extras: wrap the child. |
| `<ToolHeader title eyebrow onBack actions>` | `ToolHeader(title:, eyebrow: / eyebrowChild:, onBack:, actions: [])` | `.a-topbar` with startup.css overrides (gap 12, min-height 64, padding-block 12), 44px back `.a-icon-btn` (whileTap 0.9, `common_back`), upper-cased `.a-eyebrow`, 16px `.a-wordmark`, actions gap 8; includes `ToolSectionsBar`. |
| `.a-icon-btn` button in `actions` | `ToolIconButton(icon:, onTap:, size: 38, tapScale: 0.9)` | `onTap: null` = `:disabled` (opacity .4). |
| `.a-btn-soft` / `.a-btn-solid` / `.a-cta-btn` | `AButton(variant: AButtonVariant.pillSoft / pillSolid / cta)` | design package. |
| `ToolSectionsContext.Provider value={…}` | `ToolSections(value: ToolSectionsValue(sections:, active:, onSelect:, intro:, link:), child:)` | The hub provides it; tools need nothing. |
| `useContext(ToolSectionsContext)` | `ToolSections.maybeOf(context)` | null outside the hub. |
| `<ToolSectionsBar />` | `const ToolSectionsBar()` | Only for tools that do not use `ToolHeader`. `.a-tool-tabs` tabs are `flex: 1 0 auto` (content width + equal share), lock icon on Premium sections; `.a-tool-intro` two-line intro + coral companion link. |
| `<ToolEmpty icon title text action>` | `ToolEmpty(icon:, title:, text:, action:)` | `icon`: `Text('🍼')` (28px) or an `AIcon`. |
| `<ToolLoading />` | `const ToolLoading()` | full screen height, 32px `--a-peach-2` ring spinner. |
| `<SafetyStrip signs>` | `SafetyStrip(signs:)` | emergency number = legal's `emergencyNumberProvider` (profile country → stored country → 112); the pill opens `tel:` through `safetyCallLauncherProvider` (override in tests). `#c4262e` is a CSS literal. |
| `<SafetyMore summary text>` | `SafetyMore(summary:, text:)` | `<details>`: tap toggles; the browser's disclosure triangle is drawn as ▸ / ▾. |

## 3. Data hooks: React → Dart

All are `queryProvider` / `queryProviderFamily` with the React query keys, filters, ordering, `mapRowsTranslation`
fields and staleTime. Data is `List<Map<String, dynamic>>` (snake_case rows), except `toolConfigsQuery` (`ToolConfig`).
`ref.watch(q)` → `QueryResult` (`data`, `isLoading`, `isError`…); refetch: `ref.read(q.notifier).refetch()`.

| React hook | Dart provider | Key |
|---|---|---|
| `useSafetyCategories()` | `safetyCategoriesQuery` | `['safety-categories', lang]` |
| `useSafetyItems(categoryId)` (useDynamicTools) | `safetyItemsByCategoryQuery(categoryId)` | `['safety-items', categoryId, lang]` |
| `useSafetyItems()` (useDynamicContent) | `safetyItemsQuery` | `['safety_items', lang]` |
| `useShopCategories()` (Tools / Config) | `shopCategoriesQuery` / `shopCategoriesConfigQuery` (10 min) | `['shop-categories', lang]` |
| `useNutritionTargets()` | `nutritionTargetsQuery` | `['nutrition-targets', lang]` |
| `useMealTypes(lifeStage)` | `mealTypesQuery(lifeStage)` | `['meal-types', lifeStage, lang]` |
| `useRecipeCategories()` | `recipeCategoriesQuery` | `['recipe-categories', lang]` |
| `usePhotoshootBackgrounds(gender)` / `…Outfits(gender)` | `photoshootBackgroundsQuery(gender)` / `photoshootOutfitsQuery(gender)` | `['photoshoot-backgrounds' / 'photoshoot-outfits', gender, lang]` |
| `usePhotoshootEyeColors` / `HairColors` / `HairStyles` / `ImageStyles` | `photoshootEyeColorsQuery` / `photoshootHairColorsQuery` / `photoshootHairStylesQuery` / `photoshootImageStylesQuery` | `['photoshoot-…', lang]` |
| `usePhotoshootThemes(category)` | `photoshootThemesQuery(category)` | `['photoshoot-themes', category, lang]` |
| `useWeightRecommendations(trimester)` | `weightRecommendationsQuery(trimester)` | `['weight-recommendations', trimester, lang]` |
| `useAISuggestedQuestions(stage, userType)` | `aiSuggestedQuestionsQuery((lifeStage:, userType:))` | `['ai-suggested-questions', stage, userType, lang]` |
| `useToolConfigs(lifeStage)` | `toolConfigsQuery(lifeStage)` → `List<ToolConfig>` | `['tool-configs', lifeStage, lang]` |
| `useHospitalBagTemplates()` (useDynamicTools) | `hospitalBagTemplatesQuery` | `['hospital-bag-templates', lang]` |
| `useHospitalBagTemplates()` (useDynamicContent) | `hospitalBagTemplatesContentQuery` | `['hospital_bag_templates', lang]` |
| `useExercises()` | `exercisesQuery` (mapFollowupContent + parsed `steps`) | `['exercises', lang]` |
| `useWhiteNoiseSounds()` | `whiteNoiseSoundsQuery` | `['white-noise-sounds', lang]` |
| `useSurpriseIdeas()` | `surpriseIdeasQuery` | `['surprise-ideas', lang]` |
| `useSymptoms(lifeStage)` | `symptomsQuery(lifeStage)` | `['symptoms', lifeStage, lang]` |
| `useMoodOptions()` | `moodOptionsQuery` | `['mood-options', lang]` |
| `useCommonFoods()` | `commonFoodsQuery` | `['common-foods', lang]` |
| `useRecipes()` | `recipesQuery` (`category` stays the source id, `categoryLabel` localized) | `['recipes', lang]` |
| `useBabyNames(countryCode)` | `babyNamesQuery(countryCode)` | `['baby_names', lang, countryCode]` |
| `useNutritionTips()` | `nutritionTipsQuery` | `['nutrition_tips', lang]` |
| `useBabyMilestonesDB()` | **features/baby** `babyMilestonesDbQuery` | `['baby-milestones-db', lang]` |
| `useWeeklyTips(week, stage)` | **features/home** `pregnancy_content.dart` | `['weekly_tips', …]` |
| `useFaqs()` / `useSupportCategories()` | **features/support** `faqsQuery` / `supportCategoriesQuery` | `['faqs', lang]` / `['support-categories', lang]` |
| `use*Admin()` | not ported (admin stays web) | |

Helpers: `isToolRowLive`, `kCodeToolIds`, `mapFollowupContent(rows, lang, fields, values:)` (bundle:
`assets/i18n/followup36-content.json`, `followupContentValuesProvider`), `nameCollectionLanguage`, `foldText` /
`foldWords`. All reads go through `toolsDataSourceProvider` (`ToolsDataSource.select(TableQuery)`), so tests override
one provider.

## 4. Hub

| Piece | Where |
|---|---|
| Widget | `tools_hub.dart` `ToolsHub(initialTool:, onBack:)`; registered by `register.dart` `registerToolsFeature` |
| Pure rules (tiles, access, stage / week gates, hints, hero order, merged-away tiles, search) | `hub/hub_model.dart` |
| Inputs | `hub/hub_inputs.dart`: `toolsHubContextProvider` (stores), `toolsHubConfigsProvider(stage)`, `toolsHubPaywallProvider`, `toolsHubSlotsProvider` |
| Tile copy | `hub/hub_copy.dart` + generated `hub_copy.g.dart` (`node app/test/features/tools/tool/gen_hub_copy.mjs` from the repo root) |
| Onboarding tour rows | `tour_configs.dart` `toolsTourConfigsProvider(stage)` |

Analytics (through `analyticsSinkProvider.logEvent`): `tool_opened {tool_id}`, `tool_used {tool_id, action: session,
duration_s}` (visits ≥ 5 s, capped 3600), `tool_used {tool_id: host, action: section, item_id}`.

Slots left empty by default (`toolsHubSlotsProvider`): `bannerSlot` (`tools_top` / `tools_bottom`), `adSurface` /
`adInlineAnchor` (`tools_banner`), `aptekSearchResults`, `prefetchFirstAid`.
