// Ported from: src/components/tools/play/PlayTogetherTool.tsx, src/components/tools/play/play-together.css
//
// Uşaqla oyun: screen-free games for a parent and child, with Anacan PDF book links (Azerbaijani only). Progress
// (games played, favourites, chosen age band) stays on the phone under the same localStorage key and JSON as the
// WebView (domain/play_together).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/language_controller.dart';
import '../../../design/design.dart';
import '../../../domain/play_together/play_together.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../shell/shell.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../settings/ui/settings_ui.dart' show px;
import '../health_common/health_ui.dart' show ATap, LucideFilled;
import '../kids_common/kids_ui.dart';
import '../kit/kit.dart';
import 'play_content.dart';

const Map<String, String> _catEmoji = {'craft': '✂️', 'move': '🤸', 'pretend': '🎭', 'kitchen': '🥣', 'calm': '🧩', 'outdoor': '🌳', 'words': '🎵'};

/// `.pt-cat-*`: (background, ink).
(Color, Color) playCatTint(ATokens a, String cat) => switch (cat) {
      'craft' => (a.pink1, a.pinkInk),
      'move' => (a.blue1, a.blueInk),
      'pretend' => (a.lav1, a.lavInk),
      'kitchen' => (a.yellow1, a.yellowInk),
      'calm' => (a.coralSoft, a.coralText),
      'outdoor' => (a.green1, a.greenInk),
      _ => (a.surfaceSoft, a.ink),
    };

/// `makeT(ui, language)`: the UI strings with the few formatted ones.
class PlayText {
  const PlayText(this.ui, this.language);
  final Map<String, Object?> ui;
  final String language;

  String u(String key) => '${ui[key] ?? ''}';
  String _in(String map, String key) => ui[map] is Map ? '${(ui[map] as Map)[key] ?? ''}' : '';
  String ageLabel(String band) => _in('ageLabel', band);
  String cat(String c) => _in('cats', c);
  String guide(String g) => _in('guide', g);

  String _num(num n) => kidsNum(language, n);
  String _fmtAge(num months) => months < 24 && months % 12 != 0
      ? kidsFill(u('ageMonths'), {'n': _num(months)})
      : kidsFill(u('ageYears'), {'n': _num((months / 12 * 2).round() / 2)});

  String minutes(num n) => kidsFill(u('minutes'), {'n': _num(n)});
  String ageFor(String name) => kidsFill(u('ageFor'), {'name': name});
  String pages(num n) => kidsFill(u('pages'), {'n': _num(n)});
  String ageRange(num a, num b) => '${_fmtAge(a)} - ${_fmtAge(b)}';
}

/// `openBookInStore(book)`: the book id the PDF book store opens once (sessionStorage `anacan_books_open_v1`;
/// process memory natively). The books screen reads it with [take].
class PendingBookOpen {
  String? _id;
  void set(String id) => _id = id;
  String? peek() => _id;
  String? take() {
    final id = _id;
    _id = null;
    return id;
  }
}

final pendingBookOpenProvider = Provider<PendingBookOpen>((ref) => PendingBookOpen(), name: 'pendingBookOpenProvider');

/// Opens the PDF book store on one book (`anacan:deeplink` → `screen: books`). Tests override it.
final playOpenBookStoreProvider = Provider<void Function(String bookId)>((ref) => (bookId) {
      ref.read(pendingBookOpenProvider).set(bookId);
      ref.read(shellProvider.notifier).openScreenId(ScreenId.books);
    }, name: 'playOpenBookStoreProvider');

class PlayTogetherTool extends ConsumerWidget {
  const PlayTogetherTool({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appLanguage = ref.watch(appLanguageProvider);
    final content = ref.watch(playContentProvider(appLanguage)).value;
    final catalog = ref.watch(bookCatalogProvider).value;
    if (content == null || catalog == null) return const ToolLoading();
    return _PlayHome(
      onBack: onBack,
      t: PlayText(content.ui, content.language),
      games: content.games,
      catalog: catalog,
      // Book links point to the PDF store, which is Azerbaijani only.
      showBooks: content.language == 'az',
    );
  }
}

class _PlayHome extends ConsumerStatefulWidget {
  const _PlayHome({required this.onBack, required this.t, required this.games, required this.catalog, required this.showBooks});
  final VoidCallback onBack;
  final PlayText t;
  final List<PlayGame> games;
  final BookCatalog catalog;
  final bool showBooks;
  @override
  ConsumerState<_PlayHome> createState() => _PlayHomeState();
}

class _PlayHomeState extends ConsumerState<_PlayHome> {
  late PlayState _state;
  String? _userId;
  String _cat = 'all';
  PlayGame? _open;

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authUserProvider)?.id;
    _state = parsePlayState(ref.read(localStoreProvider).getItem(playStateKey(_userId)));
    final child = ref.read(childrenProvider).selectedChild;
    final childMonths = child == null ? null : getChildAge(child).months;
    final childBand = childMonths != null ? bandForMonths(childMonths) : null;
    ref.read(analyticsSinkProvider).logEvent('play_together_opened', {'band': _state.band ?? childBand ?? '2y', 'has_child': childMonths != null});
  }

  void _save(PlayState next) {
    setState(() => _state = next);
    try {
      ref.read(localStoreProvider).setItem(playStateKey(_userId), serializePlayState(next));
    } catch (_) {
      // storage full or blocked: progress is a convenience
    }
  }

  void _showBook(Book b, String from) {
    ref.read(analyticsSinkProvider).logEvent('play_book_clicked', {'book_id': b.id, 'from': from});
    showPlayBookSheet(context, t: widget.t, book: b, onOpenStore: () => ref.read(playOpenBookStoreProvider)(b.id));
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider)?.id;
    if (userId != _userId) {
      _userId = userId;
      _state = parsePlayState(ref.read(localStoreProvider).getItem(playStateKey(userId)));
    }
    final t = widget.t;
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final childMonths = selectedChild == null ? null : getChildAge(selectedChild).months;
    final childBand = childMonths != null ? bandForMonths(childMonths) : null;
    final band = _state.band ?? childBand ?? '2y';
    final num months = _state.band != null ? monthsForBand(_state.band!) : childMonths ?? monthsForBand(band);

    final now = DateTime.now();
    final today = dayKey(now);
    final games = gamesForAge(widget.games, months);
    final done = playedOn(_state, today);
    final picks = todaysPicks(games, '$today|${selectedChild?.id ?? 'x'}|$band', {});
    final list = _cat == 'all'
        ? games
        : _cat == 'favs'
            ? widget.games.where((g) => _state.favs.contains(g.id)).toList()
            : games.where((g) => g.cat == _cat).toList();
    final cats = playCategories.where((c) => games.any((g) => g.cat == c)).toList();
    final week = weekStrip(_state, now);
    final ageBooks = widget.showBooks ? widget.catalog.booksForAgeGroup(months).take(10).toList() : const <Book>[];
    final guide = screenGuideFor(months);

    void pickBand(String value) => _save(PlayState(log: _state.log, favs: _state.favs, band: value == childBand ? null : value));
    void openGame(PlayGame game) {
      ref.read(analyticsSinkProvider).logEvent('play_game_viewed', {'game': game.id, 'cat': game.cat});
      setState(() => _open = game);
    }

    void togglePlayed(PlayGame game) {
      if (done.contains(game.id)) {
        _save(unlogPlayed(_state, game.id, DateTime.now()));
        return;
      }
      ref.read(analyticsSinkProvider).logEvent('play_game_done', {'game': game.id, 'cat': game.cat, 'minutes': game.minutes});
      _save(logPlayed(_state, (id: game.id, minutes: game.minutes), DateTime.now()));
    }

    final open = _open;
    if (open != null) {
      return _PlayGameScreen(
        key: ValueKey('play-game-${open.id}'),
        t: t,
        game: open,
        played: done.contains(open.id),
        fav: _state.favs.contains(open.id),
        books: widget.showBooks ? widget.catalog.booksForGame(open) : const [],
        onBack: () => setState(() => _open = null),
        onPlayed: () => togglePlayed(open),
        onFav: () => _save(toggleFav(_state, open.id)),
        onBook: (b) => _showBook(b, 'game'),
      );
    }

    final a = context.a;
    final narrow = MediaQuery.sizeOf(context).width <= 360;
    return ToolPage(
      key: const ValueKey('play-home'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(title: t.u('title'), eyebrow: t.u('eyebrow'), onBack: widget.onBack),
        KidsWrap(children: [
          Semantics(
            label: selectedChild != null ? t.ageFor(selectedChild.name) : null,
            child: KidsChipRow(children: [
              for (final b in playAgeBands)
                KidsChip(
                  key: ValueKey('play-band-${b.id}'),
                  tab: true,
                  on: band == b.id,
                  onTap: () => pickBand(b.id),
                  label: '${b.id == childBand && selectedChild != null ? '${selectedChild.avatarEmoji.isNotEmpty ? selectedChild.avatarEmoji : '👶'} ' : ''}${t.ageLabel(b.id)}',
                ),
            ]),
          ),
          Semantics(
            label: t.u('today'),
            container: true,
            child: KidsCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      KidsEyebrow(t.u('today'), language: t.language),
                      Text(t.minutes(minutesOn(_state, today)), key: const ValueKey('play-minutes'), style: px(26, weight: FontWeight.w900, color: a.coralText, height: 1)),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  KidsWeekDots(
                    hint: t.u('weekHint'),
                    days: [for (final d in week) (day: d.day, on: d.minutes > 0, today: d.today, label: '${d.day}: ${d.minutes}')],
                  ),
                ]),
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusMd)),
                  child: Text('📵 ${t.guide(guide)}', style: px(13, color: a.ink, height: 1.45)),
                ),
                Padding(padding: const EdgeInsets.only(top: 6), child: Text(t.u('guideSource'), style: px(10.5, color: a.inkFaint))),
              ]),
            ),
          ),
          KidsH2(t.u('picksTitle')),
          KidsSub(t.u('picksSub')),
          if (narrow)
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < picks.length; i++) ...[if (i > 0) const SizedBox(height: 8), _Pick(t: t, game: picks[i], done: done.contains(picks[i].id), row: true, onTap: () => openGame(picks[i]))],
            ])
          else
            IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: i < picks.length ? _Pick(t: t, game: picks[i], done: done.contains(picks[i].id), onTap: () => openGame(picks[i])) : const SizedBox()),
                ],
              ]),
            ),
          KidsH2(t.u('allGames')),
          KidsChipRow(children: [
            KidsChip(key: const ValueKey('play-cat-all'), label: '${t.u('all')} · ${games.length}', on: _cat == 'all', onTap: () => setState(() => _cat = 'all')),
            for (final c in cats)
              KidsChip(key: ValueKey('play-cat-$c'), label: '${_catEmoji[c]} ${t.cat(c)}', on: _cat == c, onTap: () => setState(() => _cat = c)),
            KidsChip(
              key: const ValueKey('play-cat-favs'),
              label: t.u('favs'),
              leading: const AIcon(AIcons.heart, size: 12),
              on: _cat == 'favs',
              onTap: () => setState(() => _cat = 'favs'),
            ),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            if (list.isEmpty) KidsEmpty(_cat == 'favs' ? t.u('noFavs') : t.u('noGames')),
            for (var i = 0; i < list.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _GameRow(
                key: ValueKey('play-row-${list[i].id}'),
                t: t,
                game: list[i],
                done: done.contains(list[i].id),
                fav: _state.favs.contains(list[i].id),
                showBooks: widget.showBooks,
                onTap: () => openGame(list[i]),
              ),
            ],
          ]),
          if (ageBooks.isNotEmpty) ...[
            KidsH2(t.u('booksTitle')),
            KidsSub(t.u('booksSub')),
            _BookStrip(books: ageBooks, tagsOf: (b) => handsOnSkills(b).take(2).join(' · '), onTap: (b) => _showBook(b, 'age')),
          ],
        ]),
      ]),
    );
  }
}

/// `.pt-pick` (tinted card, min-height 128, emoji 28, title, clock + minutes, done check); a row under 360px.
class _Pick extends StatelessWidget {
  const _Pick({required this.t, required this.game, required this.done, required this.onTap, this.row = false});
  final PlayText t;
  final PlayGame game;
  final bool done;
  final VoidCallback onTap;
  final bool row;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (bg, ink) = playCatTint(a, game.cat);
    final meta = Row(mainAxisSize: MainAxisSize.min, children: [
      AIcon(AIcons.clock, size: 12, color: ink),
      const SizedBox(width: 4),
      Flexible(child: Text(t.minutes(game.minutes), style: px(11.5, weight: FontWeight.w700, color: ink))),
      if (done) ...[const SizedBox(width: 4), AIcon(AIcons.check, size: 13, color: a.ok, semanticLabel: t.u('playedDone'))],
    ]);
    final emoji = Text(game.emoji, style: const TextStyle(fontSize: 28, height: 1));
    final title = Text(game.title, style: px(13, weight: FontWeight.w800, color: ink, height: 1.25));
    return ATap(
      key: ValueKey('play-pick-${game.id}'),
      onTap: onTap,
      scale: 1,
      child: Container(
        constraints: BoxConstraints(minHeight: row ? 0 : 128),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(a.radiusLg)),
        child: row
            ? Row(children: [emoji, const SizedBox(width: 6), Expanded(child: title), const SizedBox(width: 6), Opacity(opacity: 0.85, child: meta)])
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                emoji,
                const SizedBox(height: 6),
                Expanded(child: Align(alignment: AlignmentDirectional.topStart, child: title)),
                const SizedBox(height: 6),
                Opacity(opacity: 0.85, child: meta),
              ]),
      ),
    );
  }
}

/// `.pt-row` (surface row, 44px tinted emoji tile, title + category · minutes · books, done / heart).
class _GameRow extends StatelessWidget {
  const _GameRow({super.key, required this.t, required this.game, required this.done, required this.fav, required this.showBooks, required this.onTap});
  final PlayText t;
  final PlayGame game;
  final bool done;
  final bool fav;
  final bool showBooks;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (bg, _) = playCatTint(a, game.cat);
    final sub = px(12, color: a.inkSoft);
    return ATap(
      onTap: onTap,
      scale: 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line)),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
            child: Text(game.emoji, style: const TextStyle(fontSize: 22, height: 1)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(game.title, style: px(14, weight: FontWeight.w800, color: a.ink)),
              const SizedBox(height: 2),
              Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 3, children: [
                Text('${_catEmoji[game.cat]} ${t.cat(game.cat)} · ${t.minutes(game.minutes)}', style: sub),
                if (showBooks && game.books.isNotEmpty) ...[
                  Text(' · ', style: sub),
                  AIcon(AIcons.bookOpen, size: 11, color: a.inkSoft),
                  Text(' ${game.books.length}', style: sub),
                ],
              ]),
            ]),
          ),
          if (done) ...[const SizedBox(width: 12), AIcon(AIcons.check, size: 16, color: a.ok, semanticLabel: t.u('playedDone'))]
          else if (fav) ...[const SizedBox(width: 12), Semantics(label: t.u('favs'), child: AIcon(AIcons.heart, size: 14, color: a.coral))],
        ]),
      ),
    );
  }
}

/// `.pt-books` (horizontal scroll, gap 10) of `.pt-book` covers (112 × 150, radius 12, card shadow).
class _BookStrip extends StatelessWidget {
  const _BookStrip({required this.books, required this.tagsOf, required this.onTap});
  final List<Book> books;
  final String Function(Book b) tagsOf;
  final ValueChanged<Book> onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(top: 2, bottom: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < books.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          ATap(
            key: ValueKey('play-book-${books[i].id}'),
            onTap: () => onTap(books[i]),
            scale: 1,
            child: SizedBox(
              width: 112,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                _Cover(id: books[i].id, width: 112, height: 150),
                const SizedBox(height: 5),
                Text(books[i].title, style: px(12.5, weight: FontWeight.w800, color: a.ink, height: 1.25)),
                if (tagsOf(books[i]).isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(tagsOf(books[i]), style: px(11, color: a.inkSoft, height: 1.3)),
                ],
              ]),
            ),
          ),
        ],
      ]),
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.id, required this.width, required this.height});
  final String id;
  final double width;
  final double height;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12), boxShadow: a.cardShadow),
      child: Image.asset(bookCoverAsset(id), fit: BoxFit.cover, excludeFromSemantics: true, errorBuilder: (_, _, _) => const SizedBox.expand()),
    );
  }
}

class _PlayGameScreen extends StatefulWidget {
  const _PlayGameScreen({
    super.key,
    required this.t,
    required this.game,
    required this.played,
    required this.fav,
    required this.books,
    required this.onBack,
    required this.onPlayed,
    required this.onFav,
    required this.onBook,
  });
  final PlayText t;
  final PlayGame game;
  final bool played;
  final bool fav;
  final List<Book> books;
  final VoidCallback onBack;
  final VoidCallback onPlayed;
  final VoidCallback onFav;
  final ValueChanged<Book> onBook;
  @override
  State<_PlayGameScreen> createState() => _PlayGameScreenState();
}

class _PlayGameScreenState extends State<_PlayGameScreen> {
  final Set<int> _have = {};

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final g = widget.game;
    final (bg, ink) = playCatTint(a, g.cat);
    Widget card(Widget eyebrow, Widget body, {Color? background}) => KidsCard(
          background: background,
          borderless: background != null,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [eyebrow, body]),
        );
    final p = px(14, color: a.bodyText);
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          title: t.u('title'),
          eyebrow: t.cat(g.cat),
          onBack: widget.onBack,
          actions: [
            Semantics(
              selected: widget.fav,
              child: ToolIconButton(
                key: const ValueKey('play-fav'),
                semanticLabel: widget.fav ? t.u('unfav') : t.u('fav'),
                onTap: widget.onFav,
                icon: widget.fav ? LucideFilled(AIcons.heart, size: 16, color: a.coral) : const AIcon(AIcons.heart, size: 16),
              ),
            ),
          ],
        ),
        KidsWrap(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(a.radiusXl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(g.emoji, style: const TextStyle(fontSize: 44, height: 1)),
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 6),
                child: Text(g.title, style: context.aText.heading(px(22, weight: FontWeight.w900, color: ink, height: 1.2))),
              ),
              Opacity(
                opacity: 0.9,
                child: Row(children: [
                  AIcon(AIcons.clock, size: 13, color: ink),
                  const SizedBox(width: 5),
                  Flexible(child: Text('${t.minutes(g.minutes)} · ${t.ageRange(g.minM, g.maxM)}', style: px(13, weight: FontWeight.w700, color: ink))),
                ]),
              ),
            ]),
          ),
          card(KidsEyebrow(t.u('why'), language: t.language, icon: const AIcon(AIcons.sparkles, size: 12)), Text(g.why, style: p)),
          card(
            KidsEyebrow(t.u('materials'), language: t.language),
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < g.materials.length; i++)
                Padding(
                  padding: EdgeInsets.only(top: i > 0 ? 6 : 0),
                  child: Semantics(
                    button: true,
                    toggled: _have.contains(i),
                    child: GestureDetector(
                      key: ValueKey('play-have-$i'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _have.contains(i) ? _have.remove(i) : _have.add(i)),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          Container(
                            width: 20,
                            height: 20,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _have.contains(i) ? a.ok : null,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: _have.contains(i) ? a.ok : a.lineStrong, width: 2),
                            ),
                            child: _have.contains(i) ? AIcon(AIcons.check, size: 12, color: a.onCoral) : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              g.materials[i],
                              style: px(14, color: _have.contains(i) ? a.inkSoft : a.ink)
                                  .copyWith(decoration: _have.contains(i) ? TextDecoration.lineThrough : null),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
            ]),
          ),
          card(
            KidsEyebrow(t.u('steps'), language: t.language),
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < g.steps.length; i++)
                Padding(
                  padding: EdgeInsets.only(top: i > 0 ? 10 : 0),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.coralSoft, shape: BoxShape.circle),
                      child: Text('${i + 1}', style: px(12, weight: FontWeight.w900, color: a.coralText, height: 1)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(g.steps[i], style: px(14, color: a.ink, height: 1.45))),
                  ]),
                ),
            ]),
          ),
          if (g.tip != null && g.tip!.isNotEmpty)
            card(KidsEyebrow('💡 ${t.u('tip')}', language: t.language, color: a.yellowInk), Text(g.tip!, style: p.copyWith(color: a.yellowInk)), background: a.yellow1),
          if (g.safety != null && g.safety!.isNotEmpty)
            Semantics(
              container: true,
              child: card(
                KidsEyebrow(t.u('safety'), language: t.language, color: a.coralText, icon: const AIcon(AIcons.shieldAlert, size: 12)),
                Text(g.safety!, style: p.copyWith(color: a.coralText)),
                background: a.coralSoft,
              ),
            ),
          if (widget.books.isNotEmpty)
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              KidsH2(t.u('continueInBook')),
              KidsSub(t.u('continueInBookSub')),
              _BookStrip(books: widget.books, tagsOf: (b) => t.ageLabel(b.age), onTap: widget.onBook),
            ]),
          KidsStickyBottom(
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: KidsCta(
                buttonKey: const ValueKey('play-played'),
                label: widget.played ? t.u('playedDone') : t.u('played'),
                icon: AIcons.check,
                done: widget.played,
                onTap: widget.onPlayed,
              ),
            ),
          ),
        ]),
      ]),
    );
  }
}

/// `<BookSheet book onClose />`: bottom sheet (rgba(0,0,0,.45) backdrop, `--a-bg`, radius 24 24 0 0, max 520 wide,
/// max 86vh) with the cover, age · pages, title, subtitle, about, the hands-on skills first and the store button.
Future<void> showPlayBookSheet(BuildContext context, {required PlayText t, required Book book, required VoidCallback onOpenStore}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: t.u('close'),
    barrierColor: const Color(0x73000000), // .pt-sheet-back rgba(0, 0, 0, .45)
    transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => _BookSheet(t: t, book: book, onOpenStore: onOpenStore),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(opacity: anim, child: child),
  );
}

class _BookSheet extends StatelessWidget {
  const _BookSheet({required this.t, required this.book, required this.onOpenStore});
  final PlayText t;
  final Book book;
  final VoidCallback onOpenStore;
  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final tags = handsOnSkills(book);
    return Align(
      alignment: Alignment.bottomCenter,
      child: AScope(
        child: Builder(builder: (context) {
          final a = context.a;
          Widget tag(String s, {bool soft = false}) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: soft ? a.surfaceSoft : a.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: a.line),
                ),
                child: Text(s, style: px(12, weight: FontWeight.w700, color: soft ? a.inkSoft : a.coralText)),
              );
          return Material(
            type: MaterialType.transparency,
            child: Semantics(
              scopesRoute: true,
              namesRoute: true,
              explicitChildNodes: true,
              label: book.title,
              child: Container(
                key: const ValueKey('play-book-sheet'),
                constraints: BoxConstraints(maxWidth: 520, maxHeight: mq.size.height * 0.86),
                width: double.infinity,
                decoration: BoxDecoration(color: a.bg, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
                child: Stack(children: [
                  SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(16, 18, 16, 18 + mq.padding.bottom),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 40),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          _Cover(id: book.id, width: 96, height: 128),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                              KidsEyebrow('${t.ageLabel(book.age)} · ${t.pages(book.pages)}', language: t.language),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(book.title, style: px(18, weight: FontWeight.w900, color: a.ink, height: 1.2)),
                              ),
                              Text(book.subtitle, style: px(12.5, color: a.inkSoft, height: 1.4)),
                            ]),
                          ),
                        ]),
                      ),
                      const SizedBox(height: 12),
                      Text(book.about, style: px(14, color: a.bodyText)),
                      const SizedBox(height: 12),
                      KidsEyebrow(t.u('insideBook'), language: t.language),
                      Transform.translate(
                        offset: const Offset(0, -6),
                        child: Wrap(spacing: 6, runSpacing: 6, children: [
                          for (final s in tags.isNotEmpty ? tags : book.skills) tag(s),
                          if (tags.isNotEmpty)
                            for (final s in book.skills.where((s) => !tags.contains(s))) tag(s, soft: true),
                        ]),
                      ),
                      const SizedBox(height: 12),
                      KidsCta(
                        buttonKey: const ValueKey('play-open-store'),
                        label: t.u('openStore'),
                        icon: AIcons.bookOpen,
                        onTap: () {
                          Navigator.of(context).pop();
                          onOpenStore();
                        },
                      ),
                    ]),
                  ),
                  PositionedDirectional(
                    top: 12,
                    end: 12,
                    child: ToolIconButton(
                      key: const ValueKey('play-book-close'),
                      semanticLabel: t.u('close'),
                      onTap: () => Navigator.of(context).pop(),
                      icon: const AIcon(AIcons.x, size: 16),
                    ),
                  ),
                ]),
              ),
            ),
          );
        }),
      ),
    );
  }
}

