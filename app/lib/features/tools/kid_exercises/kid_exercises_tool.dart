// Ported from: src/components/tools/exercises/KidExercisesTool.tsx, src/components/tools/exercises/kid-exercises.css
//
// Uşaq məşqləri: illustrated movement exercises from birth to 5 years. Content per language (kid_ex_content.dart),
// progress on the phone (domain/kid_exercises: done today, favourites, chosen age group) under the same localStorage
// key and JSON as the WebView.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/language_controller.dart';
import '../../../design/design.dart';
import '../../../domain/kid_exercises/kid_exercises.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../settings/ui/settings_ui.dart' show cssUpper, px;
import '../health_common/health_ui.dart' show ATap, LucideFilled;
import '../kids_common/kids_ui.dart';
import '../kit/kit.dart';
import 'kid_ex_content.dart';

/// `cap(s, language)`: source sentences after a label start lowercase; under their own heading they start with a
/// capital (Turkish casing for az / tr: i → İ).
String kidExCap(String s, String language) {
  if (s.isEmpty) return s;
  final first = s[0];
  final upper = (language == 'az' || language == 'tr') && first == 'i' ? 'İ' : first.toUpperCase();
  return upper + s.substring(1);
}

/// `makeT(ui, language)`: the UI strings with the formatted ones.
class KidExText {
  const KidExText(this.content);
  final KidExContent content;
  String get language => content.language;
  String u(String key) => content.u(key);
  String countOf(int n) => kidsFill(u('count'), {'n': kidsNum(language, n)});
  String doneOf(int n) => kidsFill(u('doneCount'), {'n': kidsNum(language, n)});
  String ageFor(String name) => kidsFill(u('ageFor'), {'name': name});
  String cap(String s) => kidExCap(s, language);
}

class KidExercisesTool extends ConsumerWidget {
  const KidExercisesTool({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appLanguage = ref.watch(appLanguageProvider);
    final content = ref.watch(kidExContentProvider(appLanguage)).value;
    if (content == null) return const ToolLoading();
    return _KidExHome(onBack: onBack, t: KidExText(content));
  }
}

class _KidExHome extends ConsumerStatefulWidget {
  const _KidExHome({required this.onBack, required this.t});
  final VoidCallback onBack;
  final KidExText t;
  @override
  ConsumerState<_KidExHome> createState() => _KidExHomeState();
}

class _KidExHomeState extends ConsumerState<_KidExHome> {
  late KidExState _state;
  String? _userId;
  String _filter = 'all';
  String _query = '';
  String? _openId;
  final TextEditingController _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authUserProvider)?.id;
    _state = parseKidExState(ref.read(localStoreProvider).getItem(kidExStorageKey(_userId)));
    final child = ref.read(childrenProvider).selectedChild;
    final months = child == null ? null : getChildAge(child).months;
    final childSet = months != null ? setForMonths(months) : null;
    ref.read(analyticsSinkProvider).logEvent('kid_exercises_opened', {
      'set': _state.set ?? childSet ?? '0-1',
      'has_child': months != null,
      'language': widget.t.language,
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _save(KidExState next) {
    setState(() => _state = next);
    try {
      ref.read(localStoreProvider).setItem(kidExStorageKey(_userId), serializeKidExState(next));
    } catch (_) {
      // storage full or blocked: progress is a convenience
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider)?.id;
    if (userId != _userId) {
      _userId = userId;
      _state = parseKidExState(ref.read(localStoreProvider).getItem(kidExStorageKey(userId)));
    }
    final t = widget.t;
    final content = t.content;
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final childMonths = selectedChild == null ? null : getChildAge(selectedChild).months;
    final childSet = childMonths != null ? setForMonths(childMonths) : null;
    final setId = _state.set ?? childSet ?? '0-1';
    final set = content.sets.firstWhere((s) => s.id == setId, orElse: () => content.sets.first);
    // Child's real age only when the shown group is the child's own; otherwise the start of the chosen group.
    final num? months = setId == childSet && childMonths != null ? childMonths : null;

    final now = DateTime.now();
    final today = dayKey(now);
    final done = doneOn(_state, today);
    final inSet = content.exercises.where((e) => e.set == set.id).toList();
    final picks = todaysPicks(inSet, '$today|${selectedChild?.id ?? 'x'}|${set.id}', months);
    final nowGroup = currentGroupKey(content.exercises, set.id, months);
    final base = _filter == 'favs' ? content.exercises.where((e) => _state.favs.contains(e.id)).toList() : inSet;
    final list = searchExercises(base, _query);
    final groups = groupsOf(list);
    final week = weekStrip(_state, now);
    final ordered = [for (final g in groups) ...g.items];

    void pickSet(String id) {
      _save(_state.copyWith(set: id == childSet ? null : id));
      setState(() => _openId = null);
    }

    void open(KidExercise e, String from) {
      ref.read(analyticsSinkProvider).logEvent('kid_exercise_viewed', {'exercise': e.id, 'from': from});
      setState(() => _openId = e.id);
    }

    void toggleDone(KidExercise e) {
      if (done.contains(e.id)) {
        _save(unlogDone(_state, e.id, DateTime.now()));
        return;
      }
      ref.read(analyticsSinkProvider).logEvent('kid_exercise_done', {'exercise': e.id, 'set': e.set});
      _save(logDone(_state, e.id, DateTime.now()));
    }

    final current = _openId == null ? null : content.exercises.where((e) => e.id == _openId).firstOrNull;
    if (current != null) {
      final nav = ordered.any((e) => e.id == current.id) ? ordered : picks;
      final i = nav.indexWhere((e) => e.id == current.id);
      return _ExerciseScreen(
        key: ValueKey('kidex-${current.id}'),
        t: t,
        exercise: current,
        done: done.contains(current.id),
        fav: _state.favs.contains(current.id),
        prev: i > 0 ? nav[i - 1] : null,
        next: i >= 0 && i < nav.length - 1 ? nav[i + 1] : null,
        onGo: (e) => setState(() => _openId = e.id),
        onBack: () => setState(() => _openId = null),
        onDone: () => toggleDone(current),
        onFav: () => _save(toggleFav(_state, current.id)),
      );
    }

    final a = context.a;
    final narrow = MediaQuery.sizeOf(context).width <= 340;
    return ToolPage(
      key: const ValueKey('kidex-home'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(title: t.u('title'), eyebrow: t.u('eyebrow'), onBack: widget.onBack),
        KidsWrap(children: [
          Semantics(
            label: selectedChild != null ? t.ageFor(selectedChild.name) : t.u('age'),
            child: KidsChipRow(children: [
              for (final s in content.sets)
                KidsChip(
                  key: ValueKey('kidex-set-${s.id}'),
                  tab: true,
                  on: set.id == s.id,
                  onTap: () => pickSet(s.id),
                  label: '${s.id == childSet && selectedChild != null ? '${selectedChild.avatarEmoji.isNotEmpty ? selectedChild.avatarEmoji : '👶'} ' : ''}${s.label}',
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
                      Text(t.doneOf(done.length), key: const ValueKey('kidex-done-count'), style: px(26, weight: FontWeight.w900, color: a.coralText, height: 1)),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  KidsWeekDots(
                    hint: t.u('weekHint'),
                    days: [for (final d in week) (day: d.day, on: d.count > 0, today: d.today, label: '${d.day}: ${d.count}')],
                  ),
                ]),
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusMd)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 13, color: a.inkSoft)),
                    const SizedBox(width: 6),
                    Expanded(child: Text(t.u('safetyNote'), style: px(12, color: a.inkSoft, height: 1.45))),
                  ]),
                ),
              ]),
            ),
          ),
          KidsH2(t.u('picksTitle')),
          KidsSub('${t.u('picksSub')} · ${set.months}'),
          _grid(narrow ? 2 : 3, [
            for (final e in picks)
              ATap(
                key: ValueKey('kidex-pick-${e.id}'),
                onTap: () => open(e, 'today'),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line)),
                  child: Stack(children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                        AspectRatio(aspectRatio: 1, child: _Plate(id: e.id)),
                        const SizedBox(height: 6),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(e.title, style: px(12.5, weight: FontWeight.w800, color: a.ink, height: 1.25)),
                        ),
                      ]),
                    ),
                    if (done.contains(e.id))
                      PositionedDirectional(
                        top: 6,
                        end: 6,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          // `.ke-pick-ok { background: #fff }` (kid-exercises.css literal: the plate is white)
                          decoration: const BoxDecoration(color: Color(0xFFFFFFFF), shape: BoxShape.circle),
                          child: AIcon(AIcons.check, size: 14, color: a.ok, semanticLabel: t.u('doneToday')),
                        ),
                      ),
                  ]),
                ),
              ),
          ]),
          KidsH2(t.u('allTitle')),
          _SearchBox(controller: _search, placeholder: t.u('search'), onChanged: (v) => setState(() => _query = v)),
          KidsChipRow(children: [
            KidsChip(key: const ValueKey('kidex-filter-all'), label: '${t.u('all')} · ${inSet.length}', on: _filter == 'all', onTap: () => setState(() => _filter = 'all')),
            KidsChip(
              key: const ValueKey('kidex-filter-favs'),
              label: '${t.u('favs')} · ${_state.favs.length}',
              on: _filter == 'favs',
              leading: const AIcon(AIcons.heart, size: 12),
              onTap: () => setState(() => _filter = 'favs'),
            ),
          ]),
          if (_filter == 'all' && _query.isEmpty) _Rules(title: '${t.u('rules')} · ${set.label}', rules: set.rules),
          if (groups.isEmpty) KidsEmpty(_filter == 'favs' && _query.isEmpty ? t.u('noFavs') : t.u('noResults')),
          for (final g in groups)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Flexible(child: Text(cssUpper(g.label, t.language), style: px(12, weight: FontWeight.w800, color: a.coralText, ls: 0.6))),
                  if (g.key == nowGroup && _filter == 'all') ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                      child: Text(cssUpper(t.u('nowBadge'), t.language), style: px(10.5, weight: FontWeight.w800, color: a.onCoral, ls: 0.21)),
                    ),
                  ],
                  const Spacer(),
                  const SizedBox(width: 8),
                  Text(t.countOf(g.items.length), style: px(12, weight: FontWeight.w700, color: a.inkFaint)),
                ]),
                const SizedBox(height: 8),
                for (var i = 0; i < g.items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  _Row(
                    key: ValueKey('kidex-row-${g.items[i].id}'),
                    t: t,
                    e: g.items[i],
                    done: done.contains(g.items[i].id),
                    fav: _state.favs.contains(g.items[i].id),
                    onTap: () => open(g.items[i], 'list'),
                  ),
                ],
              ]),
            ),
        ]),
      ]),
    );
  }

  Widget _grid(int columns, List<Widget> children) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        for (var r = 0; r < children.length; r += columns) ...[
          if (r > 0) const SizedBox(height: 8),
          IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (var c = 0; c < columns; c++) ...[
                if (c > 0) const SizedBox(width: 8),
                Expanded(child: r + c < children.length ? children[r + c] : const SizedBox()),
              ],
            ]),
          ),
        ],
      ]);
}

/// `.ke-plate` / `.ke-thumb` / `.ke-hero`: the illustration on a white plate (also in dark mode), `contain`.
class _Plate extends StatelessWidget {
  const _Plate({required this.id, this.semanticLabel});
  final String id;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) => ColoredBox(
        // `.ke-plate, .ke-thumb, .ke-hero { background: #fff }` (kid-exercises.css: illustrations are drawn on white)
        color: const Color(0xFFFFFFFF),
        child: Image.asset(
          exerciseImageAsset(id),
          fit: BoxFit.contain,
          semanticLabel: semanticLabel,
          excludeFromSemantics: semanticLabel == null,
          errorBuilder: (_, _, _) => const SizedBox.expand(),
        ),
      );
}

/// `.ke-search` (40 high pill, surface, 1px line, search icon 15, borderless 14px input).
class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.controller, required this.placeholder, required this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(14, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line)),
        child: Row(children: [
          AIcon(AIcons.search, size: 15, color: a.inkSoft),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              key: const ValueKey('kidex-search'),
              controller: controller,
              onChanged: onChanged,
              style: style,
              cursorColor: a.peach2,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkSoft)),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `<details className="ke-card ke-rules">`: tap the summary to show the rules list.
class _Rules extends StatefulWidget {
  const _Rules({required this.title, required this.rules});
  final String title;
  final List<String> rules;
  @override
  State<_Rules> createState() => _RulesState();
}

class _RulesState extends State<_Rules> {
  bool _open = false;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return KidsCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Semantics(
          button: true,
          expanded: _open,
          child: GestureDetector(
            key: const ValueKey('kidex-rules'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _open = !_open),
            child: Row(children: [
              AIcon(AIcons.shieldAlert, size: 14, color: a.ink),
              const SizedBox(width: 6),
              Expanded(child: Text(widget.title, style: px(13.5, weight: FontWeight.w800, color: a.ink))),
            ]),
          ),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsetsDirectional.only(top: 10, start: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < widget.rules.length; i++)
                Padding(
                  padding: EdgeInsets.only(top: i > 0 ? 6 : 0),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('• ', style: px(13, color: a.inkSoft, height: 1.45)),
                    Expanded(child: Text(widget.rules[i], style: px(13, color: a.inkSoft, height: 1.45))),
                  ]),
                ),
            ]),
          ),
      ]),
    );
  }
}

/// `.ke-row` (surface row, 58px thumb, title + age, done check / filled heart / chevron).
class _Row extends StatelessWidget {
  const _Row({super.key, required this.t, required this.e, required this.done, required this.fav, required this.onTap});
  final KidExText t;
  final KidExercise e;
  final bool done;
  final bool fav;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ATap(
      onTap: onTap,
      scale: 1,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(8, 8, 12, 8),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line)),
        child: Row(children: [
          Container(
            width: 58,
            height: 58,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: a.line)),
            child: _Plate(id: e.id),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(e.title, style: px(14, weight: FontWeight.w800, color: a.ink, height: 1.3)),
              const SizedBox(height: 2),
              Text(e.age, style: px(12, color: a.inkSoft)),
            ]),
          ),
          const SizedBox(width: 12),
          if (done)
            AIcon(AIcons.check, size: 16, color: a.ok, semanticLabel: t.u('doneToday'))
          else if (fav)
            Semantics(label: t.u('favs'), child: _filledHeart(14, a.coral))
          else
            AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: false),
        ]),
      ),
    );
  }
}

Widget _filledHeart(double size, Color color) => LucideFilled(AIcons.heart, size: size, color: color);

class _ExerciseScreen extends StatelessWidget {
  const _ExerciseScreen({
    super.key,
    required this.t,
    required this.exercise,
    required this.done,
    required this.fav,
    required this.prev,
    required this.next,
    required this.onGo,
    required this.onBack,
    required this.onDone,
    required this.onFav,
  });
  final KidExText t;
  final KidExercise exercise;
  final bool done;
  final bool fav;
  final KidExercise? prev;
  final KidExercise? next;
  final ValueChanged<KidExercise> onGo;
  final VoidCallback onBack;
  final VoidCallback onDone;
  final VoidCallback onFav;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final e = exercise;
    final size = MediaQuery.sizeOf(context);
    final duration = e.duration.isEmpty ? '' : t.cap(e.duration).replaceFirst(RegExp(r'[.。]\s*$'), '');
    Widget pill(AIconData icon, String text) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(icon, size: 12, color: a.coralText),
            const SizedBox(width: 5),
            Flexible(child: Text(text, style: px(12.5, weight: FontWeight.w700, color: a.coralText))),
          ]),
        );
    Widget section(String label, String body, {Color? background, Color? color, AIconData? icon}) => Semantics(
          container: true,
          child: KidsCard(
            background: background,
            borderless: background != null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              KidsEyebrow(label, language: t.language, color: color, icon: icon == null ? null : AIcon(icon, size: 12)),
              Text(body, style: px(14.5, color: color ?? a.bodyText, height: 1.55)),
            ]),
          ),
        );
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          title: t.u('title'),
          eyebrow: e.group,
          onBack: onBack,
          actions: [
            Semantics(
              selected: fav,
              child: ToolIconButton(
                key: const ValueKey('kidex-fav'),
                semanticLabel: fav ? t.u('unfav') : t.u('fav'),
                onTap: onFav,
                icon: fav ? LucideFilled(AIcons.heart, size: 16, color: a.coral) : const AIcon(AIcons.heart, size: 16),
              ),
            ),
          ],
        ),
        KidsWrap(children: [
          // `.ke-hero { aspect-ratio: 1; max-height: 52vh }`
          LayoutBuilder(
            builder: (context, c) => Container(
              height: c.maxWidth < size.height * 0.52 ? c.maxWidth : size.height * 0.52,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(a.radiusXl), border: Border.all(color: a.line)),
              child: _Plate(id: e.id, semanticLabel: e.title),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(e.title, style: context.aText.heading(px(22, weight: FontWeight.w900, color: a.ink, height: 1.2))),
          ),
          Wrap(spacing: 6, runSpacing: 6, children: [
            pill(AIcons.sparkles, e.age),
            if (duration.isNotEmpty) pill(AIcons.clock, duration),
          ]),
          section(t.u('how'), e.how),
          section(t.u('benefit'), t.cap(e.benefit)),
          if (e.caution != null && e.caution!.isNotEmpty)
            section(t.u('caution'), t.cap(e.caution!), background: a.yellow1, color: a.yellowInk, icon: AIcons.shieldAlert),
          _Stopwatch(key: ValueKey('kidex-timer-${e.id}'), t: t),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: KidsCta(
              buttonKey: const ValueKey('kidex-done'),
              label: done ? t.u('doneToday') : t.u('done'),
              icon: AIcons.check,
              done: done,
              onTap: onDone,
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _NavButton(key: const ValueKey('kidex-prev'), label: t.u('prev'), leading: AIcons.chevronLeft, onTap: prev == null ? null : () => onGo(prev!)),
            _NavButton(key: const ValueKey('kidex-next'), label: t.u('next'), trailing: AIcons.chevronRight, onTap: next == null ? null : () => onGo(next!)),
          ]),
        ]),
      ]),
    );
  }
}

/// `.a-btn-soft` in `.ke-nav` (`:disabled` opacity .4).
class _NavButton extends StatelessWidget {
  const _NavButton({super.key, required this.label, this.leading, this.trailing, this.onTap});
  final String label;
  final AIconData? leading;
  final AIconData? trailing;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final body = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (leading != null) ...[AIcon(leading!, size: 15, color: a.accentInk), const SizedBox(width: 4)],
        Text(label, style: px(12, weight: FontWeight.w700, color: a.accentInk)),
        if (trailing != null) ...[const SizedBox(width: 4), AIcon(trailing!, size: 15, color: a.accentInk)],
      ]),
    );
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: Opacity(opacity: onTap == null ? 0.4 : 1, child: body)),
    );
  }
}

/// Simple stopwatch for holds and rounds; stops when the screen closes.
class _Stopwatch extends StatefulWidget {
  const _Stopwatch({super.key, required this.t});
  final KidExText t;
  @override
  State<_Stopwatch> createState() => _StopwatchState();
}

class _StopwatchState extends State<_Stopwatch> {
  final KidsTicker _ticker = KidsTicker();
  int _elapsed = 0;
  bool _running = false;
  int _startedAt = 0;
  int _base = 0;

  int _now() => DateTime.now().millisecondsSinceEpoch;

  void _toggle() {
    setState(() {
      if (_running) {
        _ticker.stop();
        _base += _now() - _startedAt;
        _running = false;
      } else {
        _startedAt = _now();
        _running = true;
        _ticker.start(const Duration(milliseconds: 250), () {
          if (mounted) setState(() => _elapsed = _base + _now() - _startedAt);
        });
      }
    });
  }

  void _reset() {
    _ticker.stop();
    setState(() {
      _startedAt = _now();
      _base = 0;
      _elapsed = 0;
      _running = false;
    });
  }

  @override
  void dispose() {
    _ticker.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final s = _elapsed ~/ 1000;
    final label = '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
    return Semantics(
      label: t.u('timer'),
      container: true,
      child: KidsCard(
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              KidsEyebrow(t.u('timer'), language: t.language, icon: const AIcon(AIcons.clock, size: 12)),
              Text(label,
                  key: const ValueKey('kidex-time'),
                  style: px(30, weight: FontWeight.w900, color: a.ink, height: 1).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ]),
          ),
          const SizedBox(width: 12),
          ToolIconButton(
            key: const ValueKey('kidex-reset'),
            semanticLabel: t.u('reset'),
            onTap: _elapsed == 0 && !_running ? null : _reset,
            icon: const AIcon(AIcons.rotateCcw, size: 16),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: _running ? t.u('pause') : t.u('start'),
            excludeSemantics: true,
            child: GestureDetector(
              key: const ValueKey('kidex-play'),
              behavior: HitTestBehavior.opaque,
              onTap: _toggle,
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(_running ? AIcons.pause : AIcons.play, size: 18, color: a.onCoral),
                  const SizedBox(width: 6),
                  Text(_running ? t.u('pause') : t.u('start'), style: px(14, weight: FontWeight.w800, color: a.onCoral)),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
