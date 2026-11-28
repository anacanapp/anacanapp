// Ported from: src/components/games/word-garden/WordGarden.tsx, src/components/games/word-garden/useGardenProfile.ts
//              and the lobby rules of word-garden.css
//
// Söz bağı: Azerbaijani-only (other app languages get the "library is being prepared" page, never another
// language's puzzles), one profile per language + library revision + mode (`anacan_word_garden_v1:<lang>:<rev>:
// <mode>`), the lobby (mode switch, play / resume, 20-level chapters, stats, help / library / settings) and the
// level screen. Profile transactions write synchronously so a completed round is awarded once.
library;

import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/library.dart';
import '../engine/model.dart';
import '../engine/state.dart';
import '../persistence/storage.dart';
import '../../common/persistence/game_store.dart';
import 'garden_dialog.dart';
import 'garden_game.dart';
import 'garden_theme.dart';

const List<String> _artLetters = ['S', 'Ö', 'Z'];
const String _companion = 'assets/images/onboarding/cycle-freemode.webp';

class WordGarden extends ConsumerStatefulWidget {
  const WordGarden({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<WordGarden> createState() => _WordGardenState();
}

class _WordGardenState extends ConsumerState<WordGarden> {
  WordGardenMode _mode = WordGardenMode.calm;

  @override
  Widget build(BuildContext context) {
    final language = wordGardenLanguage(ref.watch(gameLanguageProvider));
    if (!hasWordGardenLibrary(language)) {
      return AScope(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            GameButton(
              key: const ValueKey('wg-pending-back'),
              label: tr('common_back', 'Geri'),
              onTap: widget.onBack,
              child: const SizedBox(width: 38, height: 38, child: Center(child: AIcon(AIcons.arrowLeft, size: 19))),
            ),
            const SizedBox(height: 16),
            Text(tr('word_garden_language_pending', 'Bu dil üçün söz kitabxanası hazırlanır.')),
          ]),
        ),
      );
    }
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const SizedBox.shrink();
    final descriptor = wordGardenLibraries[language]!;
    return GardenJourney(
      key: ValueKey('$language:${descriptor.revision}:${_mode.name}'),
      language: language,
      locale: descriptor.locale,
      revision: descriptor.revision,
      mode: _mode,
      onMode: (mode) => setState(() => _mode = mode),
      onBack: widget.onBack,
      t: GardenText(data.garden, language),
    );
  }
}

class GardenJourney extends ConsumerStatefulWidget {
  const GardenJourney({
    super.key,
    required this.language,
    required this.locale,
    required this.revision,
    required this.mode,
    required this.onMode,
    required this.onBack,
    required this.t,
  });
  final String language;
  final String locale;
  final String revision;
  final WordGardenMode mode;
  final ValueChanged<WordGardenMode> onMode;
  final VoidCallback onBack;
  final GardenText t;

  @override
  ConsumerState<GardenJourney> createState() => GardenJourneyState();
}

class GardenJourneyState extends ConsumerState<GardenJourney> {
  late GardenProfile _profile;
  late final GameStore _store;
  bool _storageReady = true;
  late GardenPreferences _preferences;

  /// 'settings' | 'help' | 'library' | null.
  String? _modal;
  int? _selectedLevel;
  late int _page;

  GardenProfile get profile => _profile;

  @override
  void initState() {
    super.initState();
    final store = _store = ref.read(gameStoreProvider);
    _profile = readGardenProfile(store, widget.language, widget.revision, widget.mode);
    _preferences = readGardenPreferences(store);
    _page = (_profile.progress.unlockedLevel - 1) ~/ levelPageSize;
    ref.read(gameAnalyticsProvider).screen('WordGarden', 'MiniGames');
  }

  void _refresh() {
    if (!mounted) return;
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    } else {
      setState(() {});
    }
  }

  /// `transact(update)`: synchronous write from the current value (a completed round cannot be awarded twice).
  GardenProfile _transact(GardenProfile Function(GardenProfile value) update) {
    final next = update(_profile);
    if (identical(next, _profile)) return next;
    _profile = next;
    _storageReady = writeGardenProfile(_store, next);
    _refresh();
    return next;
  }

  void _changePreferences(GardenPreferences next) {
    setState(() => _preferences = next);
    writeGardenPreferences(_store, next);
  }

  void _play(int level) {
    if (level < 1 || level > _profile.progress.unlockedLevel) return;
    setState(() => _selectedLevel = level);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final dark = AnacanTokens.of(context).isDark;
    final p = GardenPalette.of(theme: _preferences.theme, highContrast: _preferences.highContrast, dark: dark);
    final mq = MediaQuery.of(context);
    return GamePortal(
      child: GameBackHandler(
        onBack: () {
          if (_selectedLevel != null || _modal != null) return false;
          widget.onBack();
          return true;
        },
        child: MediaQuery(
          data: _preferences.reducedMotion ? mq.copyWith(disableAnimations: true) : mq,
          child: Directionality(
            key: const ValueKey('wordgarden-screen'),
            textDirection: TextDirection.ltr,
            child: DefaultTextStyle(
              style: wgText(14, color: p.ink),
              child: Stack(children: [
                Positioned.fill(child: GardenScenery(palette: p)),
                Positioned.fill(
                  child: _selectedLevel == null
                      ? _lobby(context, p, t)
                      : GardenGame(
                          key: ValueKey('level:$_selectedLevel'),
                          palette: p,
                          language: widget.language,
                          locale: widget.locale,
                          mode: widget.mode,
                          level: _selectedLevel!,
                          profile: _profile,
                          current: () => _profile,
                          transact: _transact,
                          preferences: _preferences,
                          onPreferences: _changePreferences,
                          t: t,
                          storageReady: _storageReady,
                          onExit: () => setState(() {
                            _page = (_profile.progress.unlockedLevel - 1) ~/ levelPageSize;
                            _selectedLevel = null;
                          }),
                          onNext: _play,
                        ),
                ),
                if (_selectedLevel == null && _modal != null)
                  GardenDialog(
                    key: ValueKey('wg-lobby-dialog:$_modal'),
                    palette: p,
                    title: t(_modal == 'settings'
                        ? 'settings'
                        : _modal == 'help'
                            ? 'helpTitle'
                            : 'library'),
                    closeLabel: t('close'),
                    onClose: () => setState(() => _modal = null),
                    children: _modalBody(p, t),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _modalBody(GardenPalette p, GardenText t) {
    if (_modal == 'settings') return [GardenSettings(palette: p, preferences: _preferences, onChange: _changePreferences, t: t)];
    if (_modal == 'help') return [GardenHelp(palette: p, t: t)];
    final library = wordGardenLibraries[widget.language];
    Widget link(String label, String url, GardenButtonKind kind) => Padding(
          padding: EdgeInsets.only(top: kind == GardenButtonKind.secondary ? 8 : 0),
          child: GardenButton(
            palette: p,
            kind: kind,
            label: label,
            onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
          ),
        );
    return [
      GardenEmblem(palette: p, icon: AIcons.bookOpen),
      Text(t('libraryDescription', {'count': library?.words ?? 0})),
      Center(
        child: Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(color: p.soft, borderRadius: BorderRadius.circular(20)),
          child: Text(t('libraryTargets', {'count': library?.targets ?? 0}), style: wgText(10, color: p.ink)),
        ),
      ),
      GardenMuted(t('sourceNote'), palette: p),
      link('Wiktionary / Kaikki.org', 'https://kaikki.org/dictionary/Azerbaijani/', GardenButtonKind.secondary),
      link('Leipzig · aosp-dict-az', 'https://github.com/subhangadirli/aosp-dict-az/tree/c68c85cb297510d19cee04787e445e2a558b1f70', GardenButtonKind.secondary),
      link('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', GardenButtonKind.text),
    ];
  }

  Widget _lobby(BuildContext context, GardenPalette p, GardenText t) {
    final progress = _profile.progress;
    final round = _profile.round;
    final savedLevel = round != null && !round.awarded ? num.tryParse(round.levelId.split(':').elementAtOrNull(3) ?? '') : null;
    final resumeSaved = savedLevel != null && savedLevel == savedLevel.truncate() && savedLevel >= 1 && savedLevel <= progress.unlockedLevel;
    final startingLevel = resumeSaved ? savedLevel.toInt() : progress.unlockedLevel;
    final first = _page * levelPageSize + 1;
    final pad = MediaQuery.paddingOf(context);
    final currentPage = (progress.unlockedLevel - 1) ~/ levelPageSize;
    return Padding(
      padding: EdgeInsets.fromLTRB(math.max(14, pad.left), math.max(10, pad.top), math.max(14, pad.right), math.max(10, pad.bottom)),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  GardenIconButton(key: const ValueKey('wg-back'), palette: p, icon: AIcons.arrowLeft, label: t('back'), onTap: widget.onBack),
                  const SizedBox(width: 10),
                  Text.rich(
                    TextSpan(children: [
                      const TextSpan(text: 'Anacan'),
                      const WidgetSpan(child: SizedBox(width: 8)),
                      TextSpan(text: 'PLAY', style: wgText(8, weight: FontWeight.w800, color: p.accentDeep, ls: 2)),
                    ]),
                    style: wgText(19, weight: FontWeight.w900, color: p.ink, ls: -.7),
                  ),
                  const Spacer(),
                  GardenIconButton(key: const ValueKey('wg-settings'), palette: p, icon: AIcons.settings2, label: t('settings'), onTap: () => setState(() => _modal = 'settings')),
                ]),
              ),
            ),
            Expanded(
              child: ScrollConfiguration(
                behavior: const ScrollBehavior().copyWith(scrollbars: false),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(3, 0, 3, 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _hero(p, t, startingLevel, resumeSaved),
                    _journey(p, t, first, currentPage),
                    _stats(p, t),
                    _footer(p, t),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(t(_storageReady ? 'saved' : 'storageError'),
                            textAlign: TextAlign.center, style: wgText(_storageReady ? 9 : 10, color: _storageReady ? p.muted : p.accentDeep)),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _hero(GardenPalette p, GardenText t, int startingLevel, bool resumeSaved) {
    final mode = widget.mode;
    final width = MediaQuery.sizeOf(context).width;
    Widget modeButton(WordGardenMode value, AIconData icon, String label) {
      final on = mode == value;
      return Expanded(
        child: GameButton(
          key: ValueKey('wg-mode-${value.name}'),
          selected: on,
          onTap: () => widget.onMode(value),
          child: Container(
            constraints: const BoxConstraints(minHeight: 34),
            decoration: BoxDecoration(
              color: on ? p.soft : null,
              borderRadius: BorderRadius.circular(11),
              boxShadow: on ? const [BoxShadow(color: Color(0x143D3834), offset: Offset(0, 2), blurRadius: 4)] : null,
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              AIcon(icon, size: 14, color: on ? p.ink : p.muted),
              const SizedBox(width: 6),
              Text(label, style: wgText(12, weight: FontWeight.w800, color: on ? p.ink : p.muted)),
            ]),
          ),
        ),
      );
    }

    Widget tile(String letter, double left, double top, double angle, {bool green = false}) => Positioned(
          left: left,
          top: top,
          child: Transform.rotate(
            angle: angle * math.pi / 180,
            child: Container(
              width: 45,
              height: 47,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: const Color(0xFFFFFFFF), width: 2),
                gradient: LinearGradient(
                  begin: const Alignment(-0.6, -0.8),
                  end: const Alignment(0.6, 0.8),
                  colors: green ? const [Color(0xFF94AFA2), Color(0xFF6B9484)] : const [Color(0xFFE98E80), Color(0xFFD66E66)],
                ),
                boxShadow: [
                  BoxShadow(color: green ? const Color(0xFF507666) : const Color(0xFFB35751), offset: const Offset(0, 5)),
                  BoxShadow(color: green ? const Color(0x2649654E) : const Color(0x21916151), offset: const Offset(0, 9), blurRadius: 15),
                ],
              ),
              child: Text(letter, style: wgText(27, weight: FontWeight.w900, color: const Color(0xFFFFFFFF), height: 1)),
            ),
          ),
        );

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(30), border: Border.all(color: p.border)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.bookOpen, size: 12, color: p.muted),
            const SizedBox(width: 6),
            Text(t('language'), style: TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: p.muted)),
            const SizedBox(width: 8),
            Container(width: 5, height: 5, decoration: const BoxDecoration(color: Color(0xFF81A88B), shape: BoxShape.circle)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(36, 12, 36, 3),
          child: Stack(clipBehavior: Clip.none, children: [
            Semantics(
              header: true,
              child: Text(t('title'), textAlign: TextAlign.center, style: wgText((width * .11).clamp(36, 49), weight: FontWeight.w900, color: p.ink, height: 1.25, ls: -2)),
            ),
            Positioned(
              right: -36,
              top: 3,
              child: Transform.rotate(angle: 12 * math.pi / 180, child: AIcon(AIcons.flower2, size: 30, color: p.accent)),
            ),
          ]),
        ),
        Text(t('tagline'), textAlign: TextAlign.center, style: wgText(13, color: p.muted)),
        Container(
          width: 265,
          height: 156,
          margin: const EdgeInsets.only(top: 3),
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned(
              left: 51,
              top: 1,
              child: Container(
                width: 146,
                height: 146,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(colors: [Color(0xB8FFF9ED), Color(0x33FFF6E6), Color(0x00FFF6E6)], stops: [0, 0.65, 1]),
                  border: Border.all(color: const Color(0x7AFFF5ED)),
                ),
              ),
            ),
            tile(_artLetters[0], 30, 25, -12),
            tile(_artLetters[1], 9, 83, -8, green: true),
            tile(_artLetters[2], 65, 99, 9),
            Positioned(right: 21, top: 2, child: Image.asset(_companion, width: 152, height: 152, fit: BoxFit.contain, excludeFromSemantics: true)),
            Positioned(left: 41, top: 2, child: Transform.rotate(angle: -30 * math.pi / 180, child: const AIcon(AIcons.leaf, size: 21, color: Color(0xFF718C68)))),
            const Positioned(right: 19, top: 91, child: AIcon(AIcons.sparkles, size: 23, color: Color(0xFFD8A365))),
          ]),
        ),
        Container(
          width: 218,
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(15), border: Border.all(color: p.border)),
          child: Row(children: [
            modeButton(WordGardenMode.calm, AIcons.leaf, t('calm')),
            const SizedBox(width: 3),
            modeButton(WordGardenMode.timed, AIcons.sparkles, t('timed')),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 16),
            child: Text(t(mode == WordGardenMode.calm ? 'calmDescription' : 'timedDescription'), textAlign: TextAlign.center, style: wgText(11, color: p.muted)),
          ),
        ),
        const SizedBox(height: 15),
        GameButton(
          key: const ValueKey('wg-play'),
          onTap: () => _play(startingLevel),
          child: Container(
            constraints: const BoxConstraints(minHeight: 58),
            padding: const EdgeInsets.symmetric(horizontal: 19, vertical: 14),
            decoration: BoxDecoration(
              gradient: p.primary,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: p.accentDeep, offset: const Offset(0, 8), blurRadius: 24, spreadRadius: -10)],
            ),
            child: Row(children: [
              const GameFilledIcon(AIcons.play, size: 17, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 9),
              Expanded(child: Text(t(resumeSaved ? 'resume' : 'play'), style: wgText(16, weight: FontWeight.w800, color: const Color(0xFFFFFFFF)))),
              Opacity(
                opacity: .94,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(t('level', {'level': startingLevel}), style: wgText(12, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                  const SizedBox(width: 9),
                  const AIcon(AIcons.arrowRight, size: 15, color: Color(0xFFFFFFFF)),
                ]),
              ),
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 11),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            AIcon(AIcons.infinity, size: 13, color: p.muted),
            const SizedBox(width: 4),
            Flexible(child: Text(t('infinite'), style: wgText(9, color: p.muted))),
            const SizedBox(width: 10),
            Opacity(opacity: .4, child: Container(width: 3, height: 3, decoration: BoxDecoration(color: p.muted, shape: BoxShape.circle))),
            const SizedBox(width: 10),
            AIcon(AIcons.wifiOff, size: 12, color: p.muted),
            const SizedBox(width: 4),
            Flexible(child: Text(t('offline'), style: wgText(9, color: p.muted))),
          ]),
        ),
      ]),
    );
  }

  Widget _journey(GardenPalette p, GardenText t, int first, int currentPage) {
    final progress = _profile.progress;
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.fromLTRB(16, 17, 16, 10),
      decoration: BoxDecoration(
        color: p.panel,
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: p.border),
        boxShadow: const [BoxShadow(color: Color(0x09405642), offset: Offset(0, 10), blurRadius: 35)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('journeyTitle'), style: wgText(9, weight: FontWeight.w700, color: p.muted)),
                const SizedBox(height: 4),
                Text.rich(TextSpan(children: [
                  TextSpan(text: t('chapter', {'chapter': _page + 1}), style: wgText(17, weight: FontWeight.w900, color: p.ink)),
                  const WidgetSpan(child: SizedBox(width: 9)),
                  TextSpan(
                    text: t('chapterRange', {'from': first, 'to': first + levelPageSize - 1}),
                    style: wgText(10, weight: FontWeight.w600, color: p.muted),
                  ),
                ])),
              ]),
            ),
            Container(
              width: 37,
              height: 37,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: p.soft, borderRadius: BorderRadius.circular(13)),
              child: AIcon(AIcons.flower2, size: 24, color: p.accent),
            ),
          ]),
        ),
        LayoutBuilder(builder: (context, constraints) {
          final size = (constraints.maxWidth - 4 * 9) / 5;
          return Wrap(spacing: 9, runSpacing: 9, children: [
            for (var level = first; level < first + levelPageSize; level++) SizedBox(width: size, height: size, child: _levelButton(p, t, level)),
          ]);
        }),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(children: [
            GardenIconButton(
              key: const ValueKey('wg-previous-page'),
              palette: p,
              icon: AIcons.chevronLeft,
              label: t('previousPage'),
              plain: true,
              size: 36,
              enabled: _page != 0,
              onTap: () => setState(() => _page--),
            ),
            Expanded(child: Text(t('difficulty${getGardenLevelProfile(first).difficulty}'), textAlign: TextAlign.center, style: wgText(10, color: p.muted))),
            GardenIconButton(
              key: const ValueKey('wg-next-page'),
              palette: p,
              icon: AIcons.chevronRight,
              label: t('nextPage'),
              plain: true,
              size: 36,
              enabled: first + levelPageSize <= 9007199254740991 - levelPageSize,
              onTap: () => setState(() => _page++),
            ),
          ]),
        ),
        if (currentPage != _page)
          GardenButton(
            palette: p,
            kind: GardenButtonKind.text,
            label: t('currentLevel'),
            onTap: () => setState(() => _page = (progress.unlockedLevel - 1) ~/ levelPageSize),
          ),
      ]),
    );
  }

  Widget _levelButton(GardenPalette p, GardenText t, int level) {
    final progress = _profile.progress;
    final unlocked = level <= progress.unlockedLevel;
    final recent = progress.levels['$level'];
    final stars = recent is Map ? ((recent['stars'] as num?) ?? 0).toInt() : 0;
    final completed = level < progress.unlockedLevel;
    final isCurrent = level == progress.unlockedLevel;
    final fg = isCurrent
        ? const Color(0xFFFFFFFF)
        : completed
            ? (p.night ? const Color(0xFFE2EDDF) : const Color(0xFF587761))
            : p.muted;
    Widget badge;
    if (completed) {
      badge = recent != null
          ? Row(mainAxisSize: MainAxisSize.min, children: [
              for (var star = 1; star <= 3; star++)
                Padding(padding: const EdgeInsets.symmetric(horizontal: .5), child: GameStar(size: 9, filled: star <= stars, color: fg)),
            ])
          : AIcon(AIcons.check, size: 13, color: fg);
    } else if (isCurrent) {
      badge = AIcon(AIcons.leaf, size: 11, color: fg);
    } else {
      badge = Text(t.number(level), style: wgText(9, color: fg));
    }
    return GameButton(
      key: ValueKey('wg-level-$level'),
      enabled: unlocked,
      label: unlocked ? t('level', {'level': level}) : t('lockedLevel', {'level': level}),
      onTap: () => _play(level),
      child: Opacity(
        opacity: unlocked ? 1 : .55,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            color: isCurrent ? null : completed ? (p.night ? const Color(0xFF455E52) : const Color(0xFFE7F0E4)) : p.soft,
            gradient: isCurrent ? p.primary : null,
            boxShadow: isCurrent ? const [BoxShadow(color: Color(0x30B96C56), offset: Offset(0, 4), blurRadius: 12)] : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (unlocked)
              Text(t.number(level), style: wgText(17, weight: FontWeight.w800, color: fg, height: 1.2))
            else
              AIcon(AIcons.lockKeyhole, size: 16, color: fg),
            const SizedBox(height: 5),
            badge,
          ]),
        ),
      ),
    );
  }

  Widget _stats(GardenPalette p, GardenText t) {
    final progress = _profile.progress;
    Widget stat(AIconData icon, num value, String label) => Expanded(
          child: Column(children: [
            AIcon(icon, size: 18, color: p.leaf),
            const SizedBox(height: 4),
            Text(t.number(value), style: wgText(16, weight: FontWeight.w900, color: p.ink, height: 1.2)),
            const SizedBox(height: 4),
            Text(label, textAlign: TextAlign.center, style: wgText(9, color: p.muted)),
          ]),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 17, 0, 10),
      child: Row(children: [
        stat(AIcons.flower2, progress.coins, t('coins')),
        const SizedBox(width: 10),
        stat(AIcons.bookOpen, progress.totalWords, t('foundWords')),
        const SizedBox(width: 10),
        stat(AIcons.trophy, progress.bestScore, t('bestScore')),
      ]),
    );
  }

  Widget _footer(GardenPalette p, GardenText t) {
    Widget button(Key key, AIconData icon, String label, VoidCallback onTap) => Expanded(
          child: GameButton(
            key: key,
            onTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 43),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
              decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(13), border: Border.all(color: p.border)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                AIcon(icon, size: 15, color: p.ink),
                const SizedBox(width: 6),
                Flexible(child: Text(label, style: wgText(10, weight: FontWeight.w700, color: p.ink))),
              ]),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(top: 9),
      child: Row(children: [
        button(const ValueKey('wg-help'), AIcons.circleHelp, t('help'), () => setState(() => _modal = 'help')),
        const SizedBox(width: 8),
        button(const ValueKey('wg-library'), AIcons.bookOpen, t('library'), () => setState(() => _modal = 'library')),
      ]),
    );
  }
}
