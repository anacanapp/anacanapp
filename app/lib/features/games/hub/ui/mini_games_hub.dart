// Ported from: src/components/games/MiniGamesHub.tsx
//
// The `mini-games` tool: Games / Leaderboard tabs, the game cards (Qabarcıq, Tumurcuğun uçuşu, Yolunu aç, İki dost,
// Söz bağı when the language has a library, then the three level games) and the hub's view switch: own-screen
// games open full screen, level games go hub → levels → game with local progress + score submission here.
// Games plug in through [gameRegistryProvider] (ui_common/game_registry.dart).
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../../settings/ui/settings_ui.dart' show AIconBtn, ATopbar, px;
import '../../birlesdir/engine/level_config.dart' show birlesdirTotalLevels;
import '../../color_sort/engine/difficulty.dart' show initialLevelCount, maxLevelCount;
import '../../color_sort/persistence/storage.dart' show readLevelCount;
import '../../iki_dost/engine/engine.dart' show twoFriendsLevels;
import '../../iki_dost/ui/friends_ui.dart' show friendsArtAssets;
import '../../leaf_flight/engine/engine.dart' show leafFlightLevels;
import '../../parking/engine/engine.dart' show parkingLevels;
import '../../saglam_sebet/engine/engine.dart' show saglamTotalLevels;
import '../../ui_common/casual_ui.dart' show CasualArt;
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_registry.dart';
import '../../ui_common/game_widgets.dart';
import '../../ui_common/local_game_progress.dart';
import '../../word_garden/engine/library.dart' show hasWordGardenLibrary, wordGardenLanguage;
import '../data/game_score_sync.dart' show GameScoreInput;
import '../data/game_scores.dart';
import 'leaderboard.dart';

/// One of the hub's three level games (`GAMES`).
class _LevelGameCard {
  const _LevelGameCard(this.id, this.titleKey, this.title, this.descKey, this.desc, this.icon, this.gradient, this.totalLevels);
  final String id;
  final String titleKey;
  final String title;
  final String descKey;
  final String desc;
  final AIconData icon;
  final List<Color> gradient;
  final int totalLevels;
}

const List<_LevelGameCard> _games = [
  _LevelGameCard(MiniGameIds.saglamSebet, 'saglamsebet_title', 'Sağlam Səbət', 'saglamsebet_card_desc', 'Sağlam qidaları tut, zərərlilərdən qaç',
      AIcons.shoppingBasket, [TwColors.emerald500, TwColors.teal600], saglamTotalLevels),
  _LevelGameCard(MiniGameIds.birlesdir, 'birlesdir_title', 'Birləşdir', 'birlesdir_card_desc', '3 və ya daha çoxunu birləşdir, bonusları aç',
      AIcons.puzzle, [TwColors.violet500, TwColors.fuchsia500], birlesdirTotalLevels),
  _LevelGameCard(MiniGameIds.colorSort, 'colorsort_title', 'Rəng çeşidləmə', 'colorsort_card_desc', 'Rəngli vitaminləri çeşidlə, hər qabda bir rəng topla',
      AIcons.flaskConical, [TwColors.cyan500, TwColors.teal600], initialLevelCount),
];

enum _Tab { games, leaderboard }

class MiniGamesHub extends ConsumerStatefulWidget {
  const MiniGamesHub({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<MiniGamesHub> createState() => _MiniGamesHubState();
}

class _MiniGamesHubState extends ConsumerState<MiniGamesHub> {
  _Tab _tab = _Tab.games;

  /// 'hub' | 'levels' | 'game' | an own-screen game id.
  String _view = 'hub';
  String _selectedGameId = MiniGameIds.saglamSebet;
  int _selectedLevel = 1;
  String _leaderboardGameId = MiniGameIds.saglamSebet;

  @override
  void initState() {
    super.initState();
    ref.read(gameAnalyticsProvider).screen('MiniGamesHub', 'MiniGames');
  }

  void _setView(String view, {_Tab? tab}) {
    setState(() {
      _view = view;
      if (tab != null) _tab = tab;
    });
    // Hub ↔ levels ↔ game always start at the top.
    try {
      ref.read(scrollMemoryProvider).scrollToTop();
    } catch (_) {}
  }

  void _openGame(String gameId) {
    _selectedGameId = gameId;
    _setView('levels');
  }

  void _selectLevel(int level) {
    _selectedLevel = level;
    _setView('game');
    ref.read(gameAnalyticsProvider).event('minigame_level_started', {'game_id': _selectedGameId, 'level': level});
  }

  void _levelComplete(GameLevelResult result) {
    final gameId = _selectedGameId;
    ref.read(localGameProgressProvider(gameId).notifier).recordLevelResult(result.level, result.score, result.stars, result.passed);
    ref.read(gameScoreSubmitterProvider(gameId)).mutate(
          GameScoreInput(score: result.score, level: result.level),
          language: ref.read(gameLanguageProvider),
          onToast: _showToast,
        );
    ref.read(gameAnalyticsProvider).event(result.passed ? 'minigame_level_won' : 'minigame_level_lost', {
      'game_id': gameId,
      'level': result.level,
      'score': result.score,
    });
  }

  void _showToast(GameScoreToast toast) {
    if (!mounted || context.findAncestorStateOfType<State<AToastHost>>() == null) return;
    final toasts = AToastHost.of(context);
    switch (toast.kind) {
      case GameScoreToastKind.success:
        toasts.success(toast.message);
      case GameScoreToastKind.info:
        toasts.info(toast.message);
      case GameScoreToastKind.error:
        // The design system's sonner toast has no action slot: the retry stays available by submitting again.
        toasts.error(toast.message);
    }
  }

  int _levelCount(String id, GameRegistry registry) {
    final entry = registry[id];
    if (entry is LevelGameEntry) return entry.levelCount(ref);
    if (id == MiniGameIds.colorSort) return readLevelCount(ref.read(gameStoreProvider));
    return _games.firstWhere((g) => g.id == id).totalLevels;
  }

  void _nextLevel(LevelGameEntry entry) {
    final next = entry.nextLevel?.call(ref, _selectedLevel) ??
        math.min(_selectedLevel + 1, entry.id == MiniGameIds.colorSort ? maxLevelCount : entry.levelCount(ref));
    setState(() => _selectedLevel = next);
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const SizedBox(height: 200);
    final registry = ref.watch(gameRegistryProvider);
    final language = wordGardenLanguage(ref.watch(gameLanguageProvider));
    final wordGardenAvailable = hasWordGardenLibrary(language);
    void toHub() => _setView('hub');

    if (_view != 'hub' && _view != 'levels' && _view != 'game') {
      if (_view == MiniGameIds.wordGarden && !wordGardenAvailable) {
        // React: the Word Garden view only renders while a library exists; otherwise the hub shows.
      } else {
        final entry = registry[_view];
        if (entry is ScreenGameEntry) return entry.builder(context, GameScreenArgs(onBack: toHub));
        return GameNotAvailable(onBack: toHub);
      }
    }

    final entry = registry[_selectedGameId];
    if (_view == 'game') {
      if (entry is LevelGameEntry) {
        return KeyedSubtree(
          key: ValueKey('game:$_selectedGameId:$_selectedLevel'),
          child: entry.game(
            context,
            GamePlayArgs(level: _selectedLevel, onExit: () => _setView('levels'), onLevelComplete: _levelComplete, onNextLevel: () => _nextLevel(entry)),
          ),
        );
      }
      return GameNotAvailable(onBack: () => _setView('levels'));
    }
    if (_view == 'levels') {
      if (entry is LevelGameEntry) {
        final progress = ref.watch(localGameProgressProvider(_selectedGameId));
        return entry.levels(
          context,
          GameLevelsArgs(progress: progress, isLevelUnlocked: progress.isLevelUnlocked, onSelectLevel: _selectLevel, onBack: toHub),
        );
      }
      return GameNotAvailable(onBack: toHub);
    }
    return _hub(context, data, language, wordGardenAvailable, registry);
  }

  Widget _hub(BuildContext context, GameData data, String language, bool wordGardenAvailable, GameRegistry registry) {
    final a = context.a;
    String colorSortText(String key) =>
        data.colorSort.text(ref.read(gameLanguageProvider), key, cachedTranslation: (k, l) => I18nRuntime.instance.store.lookup(k, l));
    String gameTitle(_LevelGameCard g) => g.id == MiniGameIds.colorSort ? colorSortText('title') : tr(g.titleKey, g.title);
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.only(left: 20, right: 20, bottom: 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ATopbar(
              eyebrow: tr('minigames_hub_subtitle', 'Stresi at, oyna, rahatla'),
              title: tr('minigames_hub_title', 'Mini Oyunlar'),
              onBack: widget.onBack,
              backScale: 0.9,
              actions: const [AIconBtn(icon: AIcon(AIcons.gamepad2, size: 16), size: 44, tapScale: 1)],
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _Tabs(
                tab: _tab,
                onChanged: (tab) => _setView(_view, tab: tab),
              ),
            ),
            if (_tab == _Tab.games)
              FadeRiseInKeyed(key: const ValueKey('tab-games'), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _BubbleCard(data: data, language: language, onTap: () => _setView(MiniGameIds.qabarciq)),
                for (final flight in [true, false])
                  _CasualCard(data: data, language: language, flight: flight, onTap: () => _setView(flight ? MiniGameIds.leafFlight : MiniGameIds.clearTheWay)),
                _FriendsCard(data: data, language: language, onTap: () => _setView(MiniGameIds.twoFriends)),
                if (wordGardenAvailable) _GardenCard(data: data, language: language, onTap: () => _setView(MiniGameIds.wordGarden)),
                for (final game in _games)
                  _LevelCard(
                    game: game,
                    title: gameTitle(game),
                    description: game.id == MiniGameIds.colorSort ? colorSortText('card_desc') : tr(game.descKey, game.desc),
                    progress: ref.watch(localGameProgressProvider(game.id)),
                    totalLevels: _levelCount(game.id, registry),
                    onTap: () => _openGame(game.id),
                  ),
                _ComingSoon(),
              ]))
            else
              FadeRiseInKeyed(key: const ValueKey('tab-leaderboard'), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: IntrinsicHeight(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      for (final game in _games) ...[
                        Expanded(
                          child: _BoardChip(
                            label: gameTitle(game),
                            active: _leaderboardGameId == game.id,
                            gradient: game.gradient,
                            onTap: () => setState(() => _leaderboardGameId = game.id),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: _BoardChip(
                          label: data.bubble.text(language, 'title'),
                          active: _leaderboardGameId == MiniGameIds.qabarciq,
                          // MiniGamesHub.tsx literal: linear-gradient(90deg,#ff7a6b,#ff5a5f)
                          gradient: const [Color(0xFFFF7A6B), Color(0xFFFF5A5F)],
                          onTap: () => setState(() => _leaderboardGameId = MiniGameIds.qabarciq),
                        ),
                      ),
                    ]),
                  ),
                ),
                Leaderboard(key: ValueKey('board:$_leaderboardGameId'), gameId: _leaderboardGameId),
              ])),
          ]),
        ),
      ),
    );
  }
}

/// The fallback of a card whose game is not registered in this build.
class GameNotAvailable extends StatelessWidget {
  const GameNotAvailable({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => AScope(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tr('minigames_crash_title', 'Oyunda gözlənilməz xəta baş verdi'), style: context.aText.aListTitle, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            GameButton(
              key: const ValueKey('game-unavailable-back'),
              onTap: onBack,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(color: context.tokens.shadcn.primary, borderRadius: BorderRadius.circular(16)),
                child: Text(tr('minigames_crash_back_button', 'Səviyyələrə qayıt'),
                    style: px(14, weight: FontWeight.w600, color: context.tokens.shadcn.primaryForeground)),
              ),
            ),
          ]),
        ),
      );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.tab, required this.onChanged});
  final _Tab tab;
  final ValueChanged<_Tab> onChanged;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget item(_Tab value, String label, {AIconData? icon}) {
      final on = value == tab;
      final color = on ? a.accentInk : a.inkSoft;
      return Expanded(
        child: GameButton(
          key: ValueKey('hub-tab-${value.name}'),
          selected: on,
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
            decoration: BoxDecoration(color: on ? a.peach1 : const Color(0x00000000), borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              if (icon != null) ...[AIcon(icon, size: 14, color: color), const SizedBox(width: 6)],
              Flexible(child: Text(label, style: context.aText.aTab.copyWith(color: color), textAlign: TextAlign.center)),
            ]),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(children: [
        item(_Tab.games, tr('minigames_tab_games', 'Oyunlar')),
        item(_Tab.leaderboard, tr('minigames_tab_leaderboard', 'Reytinq'), icon: AIcons.trophy),
      ]),
    );
  }
}

/// AnimatePresence tab content: `initial={{ opacity: 0, y: 6 }}`.
class FadeRiseInKeyed extends StatelessWidget {
  const FadeRiseInKeyed({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => FadeRiseIn(child: child);
}

/// A hub card button (`motion.button whileTap={{ scale: 0.98 }}` + `data-game-id`).
class _CardShell extends StatelessWidget {
  const _CardShell({required this.gameId, required this.onTap, required this.decoration, required this.child, this.padding = 16, this.label});
  final String gameId;
  final VoidCallback onTap;
  final BoxDecoration decoration;
  final Widget child;
  final double padding;
  final String? label;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Semantics(
          button: true,
          label: label,
          child: PressScale(
            key: ValueKey('game-card-$gameId'),
            scale: 0.98,
            onTap: onTap,
            child: Container(
              decoration: decoration,
              clipBehavior: Clip.antiAlias,
              padding: EdgeInsets.all(padding),
              child: child,
            ),
          ),
        ),
      );
}

TextStyle _cardTitle(Color color) => px(18, weight: FontWeight.w800, color: color, height: 28 / 18);

class _BubbleCard extends StatelessWidget {
  const _BubbleCard({required this.data, required this.language, required this.onTap});
  final GameData data;
  final String language;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    // MiniGamesHub.tsx literals.
    const ink = Color(0xFF7A3F3A);
    String t(String key) => data.bubble.text(language, key);
    return _CardShell(
      gameId: MiniGameIds.qabarciq,
      onTap: onTap,
      label: t('title'),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment(-0.82, -0.57),
          end: Alignment(0.82, 0.57),
          colors: [Color(0xFFFFE3D8), Color(0xFFFFF3E6), Color(0xFFEFE6FB)],
          stops: [0, 0.55, 1],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF6D6C9)),
        boxShadow: const [BoxShadow(color: Color(0x55FF5A5F), offset: Offset(0, 10), blurRadius: 25, spreadRadius: -15)],
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: ink),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const SizedBox(width: 64, height: 64, child: CustomPaint(painter: _BubblesPainter())),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFFF5A5F), borderRadius: BorderRadius.circular(999)),
                  child: Text(tr('minigames_badge_new', 'Yeni'), style: px(9, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 13.5 / 9)),
                ),
                const SizedBox(height: 4),
                Text(t('title'), style: _cardTitle(ink)),
                const SizedBox(height: 2),
                Text(t('card'), style: px(12, color: const Color(0xFF9A6A62), height: 1.625)),
              ]),
            ),
            const AIcon(AIcons.chevronRight, size: 18, color: ink, mirrorInRtl: true),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: Text(t('tagline'), style: px(10, weight: FontWeight.w600, color: ink))),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xA8FFFFFF), borderRadius: BorderRadius.circular(999)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const AIcon(AIcons.trophy, size: 11, color: ink),
                const SizedBox(width: 4),
                Text(t('weeklyTitle'), style: px(10, weight: FontWeight.w600, color: ink)),
              ]),
            ),
          ]),
        ]),
      ),
    );
  }
}

/// The five glossy bubbles of the Qabarcıq card (64×64 SVG).
class _BubblesPainter extends CustomPainter {
  const _BubblesPainter();
  static const _bubbles = [
    (22.0, 24.0, 14.0, Color(0xFFF47C7C)),
    (42.0, 20.0, 10.0, Color(0xFFB49BEA)),
    (44.0, 40.0, 13.0, Color(0xFF78B5F0)),
    (22.0, 46.0, 11.0, Color(0xFFF5D061)),
    (33.0, 33.0, 9.0, Color(0xFF6FCD9E)),
  ];
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 64);
    for (final (x, y, r, c) in _bubbles) {
      canvas.drawCircle(Offset(x, y), r, Paint()..color = c);
      canvas.drawCircle(Offset(x - r * 0.35, y - r * 0.4), r * 0.22, Paint()..color = const Color(0xD9FFFFFF));
    }
  }

  @override
  bool shouldRepaint(_BubblesPainter oldDelegate) => false;
}

class _CasualCard extends StatelessWidget {
  const _CasualCard({required this.data, required this.language, required this.flight, required this.onTap});
  final GameData data;
  final String language;
  final bool flight;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final ink = flight ? const Color(0xFF78618B) : const Color(0xFF537B69);
    String t(String key, [Map<String, Object?> v = const {}]) => data.casual.text(language, key, v);
    return _CardShell(
      gameId: flight ? MiniGameIds.leafFlight : MiniGameIds.clearTheWay,
      onTap: onTap,
      label: t(flight ? 'flightTitle' : 'parkingTitle'),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: const Alignment(-0.82, -0.57),
          end: const Alignment(0.82, 0.57),
          colors: flight ? const [Color(0xFFEEE5F8), Color(0xFFF8EDDA)] : const [Color(0xFFE3EEE1), Color(0xFFF8ECD5)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE6DECE)),
        boxShadow: const [BoxShadow(color: Color(0x4481966E), offset: Offset(0, 10), blurRadius: 25, spreadRadius: -15)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          SizedBox(
            width: 65,
            height: 74,
            child: Stack(clipBehavior: Clip.none, children: [
              Image.asset(flight ? CasualArt.flight : CasualArt.parking, width: 65, height: 74, fit: BoxFit.contain, excludeFromSemantics: true),
              PositionedDirectional(end: -4, bottom: 0, child: AIcon(flight ? AIcons.leaf : AIcons.carFront, size: 19, color: ink)),
            ]),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t(flight ? 'flightTitle' : 'parkingTitle'), style: _cardTitle(ink)),
              const SizedBox(height: 4),
              Opacity(opacity: 0.75, child: Text(t(flight ? 'flightCard' : 'parkingCard'), style: px(12, color: ink, height: 1.625))),
            ]),
          ),
          AIcon(AIcons.chevronRight, size: 18, color: ink, mirrorInRtl: true),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Text(t(flight ? 'wind' : 'par', {'count': flight ? 30 : 15}), style: px(10, weight: FontWeight.w600, color: ink))),
          const SizedBox(width: 12),
          _Pill(text: '${flight ? leafFlightLevels : parkingLevels}', color: ink, background: const Color(0x96FFFFFF)),
        ]),
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color, required this.background});
  final String text;
  final Color color;
  final Color background;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: px(10, weight: FontWeight.w600, color: color)),
      );
}

class _FriendsCard extends StatelessWidget {
  const _FriendsCard({required this.data, required this.language, required this.onTap});
  final GameData data;
  final String language;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF5E5463);
    String t(String key) => data.friends.text(language, key);
    return _CardShell(
      gameId: MiniGameIds.twoFriends,
      onTap: onTap,
      label: t('title'),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment(-0.82, -0.57), end: Alignment(0.82, 0.57), colors: [Color(0xFFFFF0DE), Color(0xFFF0E7FA)]),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFECDACA)),
        boxShadow: const [BoxShadow(color: Color(0x44927C9C), offset: Offset(0, 10), blurRadius: 25, spreadRadius: -15)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              width: 58 * 2 - 16,
              height: 68,
              child: Stack(children: [
                Image.asset(friendsArtAssets[0], width: 58, height: 68, fit: BoxFit.contain, excludeFromSemantics: true),
                Positioned(left: 42, child: Image.asset(friendsArtAssets[1], width: 58, height: 68, fit: BoxFit.contain, excludeFromSemantics: true)),
              ]),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('title'), style: _cardTitle(ink)),
              const SizedBox(height: 4),
              Text(t('card'), style: px(12, color: const Color(0xFF827587), height: 1.625)),
            ]),
          ),
          const AIcon(AIcons.chevronRight, size: 18, color: ink, mirrorInRtl: true),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Text(t('tagline'), style: px(10, weight: FontWeight.w600, color: ink))),
          const SizedBox(width: 12),
          const _Pill(text: '$twoFriendsLevels', color: ink, background: Color(0x96FFFFFF)),
        ]),
      ]),
    );
  }
}

class _GardenCard extends StatelessWidget {
  const _GardenCard({required this.data, required this.language, required this.onTap});
  final GameData data;
  final String language;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF445B49);
    String t(String key) => data.garden.text(language, key);
    return _CardShell(
      gameId: MiniGameIds.wordGarden,
      onTap: onTap,
      padding: 20,
      label: t('title'),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment(-0.77, -0.64), end: Alignment(0.77, 0.64), colors: [Color(0xFFFCF0DE), Color(0xFFE3EDDA)]),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2D9C6)),
        boxShadow: const [BoxShadow(color: Color(0x44708264), offset: Offset(0, 10), blurRadius: 25, spreadRadius: -15)],
      ),
      child: Stack(clipBehavior: Clip.none, children: [
        const PositionedDirectional(end: -32, bottom: -36, child: Opacity(opacity: 0.15, child: AIcon(AIcons.flower2, size: 130, color: ink))),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xB8FFFFFF), borderRadius: BorderRadius.circular(16)),
              child: const AIcon(AIcons.flower2, size: 31, color: Color(0xFFDB8471)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('newGame'), style: px(9, weight: FontWeight.w700, color: const Color(0xFF7E907A), ls: 0.05)),
                Text(t('title'), style: _cardTitle(ink)),
                Text(t('cardDescription'), style: px(12, color: const Color(0xFF7A8874), height: 16 / 12)),
              ]),
            ),
            const AIcon(AIcons.chevronRight, size: 19, color: ink, mirrorInRtl: true),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            const AIcon(AIcons.infinity, size: 12, color: ink),
            const SizedBox(width: 4),
            Flexible(child: Text(t('infinite'), style: px(10, weight: FontWeight.w600, color: ink))),
            const SizedBox(width: 12),
            Flexible(child: _Pill(text: t('language'), color: ink, background: const Color(0x7AFFFFFF))),
          ]),
        ]),
      ]),
    );
  }
}

class _LevelCard extends StatelessWidget {
  const _LevelCard({required this.game, required this.title, required this.description, required this.progress, required this.totalLevels, required this.onTap});
  final _LevelGameCard game;
  final String title;
  final String description;
  final GameProgress progress;
  final int totalLevels;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const white = Color(0xFFFFFFFF);
    Widget chip(Widget child) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: const Color(0x26FFFFFF), borderRadius: BorderRadius.circular(999)),
          child: DefaultTextStyle.merge(style: px(11, weight: FontWeight.w500, color: const Color(0xE6FFFFFF), height: 16.5 / 11), child: child),
        );
    final best = progress.bestScoreOverall;
    return _CardShell(
      gameId: game.id,
      onTap: onTap,
      label: title,
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: game.gradient),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5),
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 8), blurRadius: 10, spreadRadius: -6),
        ],
      ),
      padding: 0,
      child: Stack(children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(center: Alignment(0.6, -0.6), radius: 0.9, colors: [Color(0x2EFFFFFF), Color(0x00FFFFFF)], stops: [0, 0.6]),
            ),
          ),
        ),
        PositionedDirectional(end: -12, bottom: -12, child: Opacity(opacity: 0.15, child: AIcon(game.icon, size: 112, color: white))),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(16)),
                child: AIcon(game.icon, size: 28, color: white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AIcon(AIcons.sparkles, size: 10, color: white),
                      const SizedBox(width: 4),
                      Text(tr('minigames_badge_new', 'Yeni'), style: px(10, weight: FontWeight.w600, color: white, height: 15 / 10)),
                    ]),
                  ),
                  Text(title, style: px(16, weight: FontWeight.w700, color: white, height: 24 / 16)),
                  Text(description, style: px(12, color: const Color(0xCCFFFFFF), height: 16 / 12)),
                ]),
              ),
              const AIcon(AIcons.chevronRight, size: 20, color: Color(0xB3FFFFFF), mirrorInRtl: true),
            ]),
            const SizedBox(height: 12),
            Wrap(spacing: 12, runSpacing: 6, children: [
              chip(Text('$totalLevels ${tr('minigames_levels_short', 'səviyyə')}')),
              chip(Text('${math.min(progress.unlockedLevel, totalLevels).toInt()}/$totalLevels ${tr('minigames_unlocked_short', 'açıq')}')),
              if (best > 0)
                chip(Row(mainAxisSize: MainAxisSize.min, children: [
                  const AIcon(AIcons.trophy, size: 12, color: Color(0xE6FFFFFF)),
                  const SizedBox(width: 4),
                  Text('${best == best.truncate() ? best.toInt() : best}'),
                ])),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _ComingSoon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return CustomPaint(
      foregroundPainter: _DashedBorder(color: a.lineStrong),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(26)),
        child: Column(children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: AIcon(AIcons.gamepad2, size: 24, color: a.inkFaint),
          ),
          Text(tr('minigames_more_soon_title', 'Yeni oyunlar tezliklə'), style: context.aText.aListTitle, textAlign: TextAlign.center),
          const SizedBox(height: 2),
          Text(tr('minigames_more_soon_desc', 'Mini Oyunlar bölməsinə tezliklə yeni oyunlar əlavə olunacaq'),
              style: context.aText.aListSub, textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}

/// `border: 2px dashed var(--a-line-strong)` with radius 26.
class _DashedBorder extends CustomPainter {
  const _DashedBorder({required this.color});
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(26)).deflate(1));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (final metric in path.computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 12) {
        canvas.drawPath(metric.extractPath(d, math.min(d + 6, metric.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder oldDelegate) => oldDelegate.color != color;
}

class _BoardChip extends StatelessWidget {
  const _BoardChip({required this.label, required this.active, required this.gradient, required this.onTap});
  final String label;
  final bool active;
  final List<Color> gradient;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return GameButton(
      selected: active,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: active ? LinearGradient(colors: gradient) : null,
          color: active ? null : a.surface,
          borderRadius: BorderRadius.circular(16),
          border: active ? null : Border.all(color: a.line),
          boxShadow: active ? context.tokens.shadcn.shadowButton : null,
        ),
        child: Text(label, textAlign: TextAlign.center, style: px(12, weight: FontWeight.w700, color: active ? const Color(0xFFFFFFFF) : a.inkSoft, height: 16 / 12)),
      ),
    );
  }
}
