// Ported from: src/components/partner/NameVotingScreen.tsx
//
// Baby name voting: both partners like names from the shared pool (the baby_names collection + her favourites that
// are not in it); a name liked by both is a "Match".
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../tools/data/data.dart' show babyNamesQuery;
import '../../tools/names/favorite_names.dart';
import '../ui/partner_ui.dart';
import 'data/partner_favorite_names.dart';
import 'screens_ui.dart';

/// `NAME_ROWS_PAGE_SIZE`.
const int kNameRowsPageSize = 50;

/// A row of the pool (`{name, gender, meaning, origin}`).
typedef PoolName = ({String name, String gender, String? meaning, String? origin});

/// The combined pool: every baby name once, then her favourites that are not in the list.
List<PoolName> nameVotingPool(List<Map<String, dynamic>> names, List<FavoriteName> partnerFavorites) {
  final seen = <String>{};
  final out = <PoolName>[];
  for (final n in names) {
    final name = '${n['name'] ?? ''}';
    if (!seen.add(name)) continue;
    out.add((name: name, gender: '${n['gender'] ?? ''}', meaning: n['meaning'] as String?, origin: n['origin'] as String?));
  }
  for (final f in partnerFavorites) {
    if (!seen.add(f.name)) continue;
    out.add((name: f.name, gender: f.gender, meaning: f.meaning, origin: f.origin));
  }
  return out;
}

/// Search (name or meaning, lower-cased) and gender filter (unisex names stay in both).
List<PoolName> filterNameVotingPool(List<PoolName> pool, String search, String genderFilter) {
  final q = search.toLowerCase();
  return pool.where((n) {
    final matchSearch = q.isEmpty || n.name.toLowerCase().contains(q) || (n.meaning ?? '').toLowerCase().contains(q);
    final matchGender = genderFilter == 'all' || n.gender == genderFilter || n.gender == 'unisex';
    return matchSearch && matchGender;
  }).toList();
}

String _genderLabel(String gender) => switch (gender) {
      'boy' => tr('namevotingscreen_oglan_e9715e', 'Oğlan'),
      'girl' => tr('namevotingscreen_qiz_79bf6b', 'Qız'),
      'unisex' => tr('namevotingscreen_uniseks_label', 'Uniseks'),
      _ => gender,
    };

class NameVotingScreen extends ConsumerStatefulWidget {
  const NameVotingScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<NameVotingScreen> createState() => _NameVotingScreenState();
}

class _NameVotingScreenState extends ConsumerState<NameVotingScreen> {
  final TextEditingController _search = TextEditingController();
  String _gender = 'all';
  String _tab = 'browse';
  int _visible = kNameRowsPageSize;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _resetPage() => _visible = kNameRowsPageSize;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final mine = ref.watch(favoriteNamesProvider);
    final partnerFavorites = ref.watch(partnerFavoriteNamesProvider).partnerFavorites;
    final names = ref.watch(babyNamesQuery(null)).data ?? const <Map<String, dynamic>>[];
    final partnerSet = {for (final f in partnerFavorites) f.name};
    final favorites = mine.favorites;
    final matches = favorites.where((f) => partnerSet.contains(f.name)).toList();
    final pool = nameVotingPool(names, partnerFavorites);
    final filtered = filterNameVotingPool(pool, _search.text, _gender);

    void toggle(PoolName n) =>
        ref.read(favoriteNamesProvider.notifier).toggleFavorite(n.name, n.gender, meaning: n.meaning, origin: n.origin);

    Widget row(PoolName n) => _NameRow(
          key: ValueKey('name-${n.name}'),
          n: n,
          fav: mine.isFavorite(n.name),
          partnerFav: partnerSet.contains(n.name),
          onToggle: () => toggle(n),
        );
    PoolName fromFav(FavoriteName f) => (name: f.name, gender: f.gender, meaning: f.meaning, origin: f.origin);

    final badge = Container(
      margin: const EdgeInsetsDirectional.only(start: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(999)),
      child: Text('${matches.length}', style: pText(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
    );

    Widget emptyCard(AIconData icon, List<Widget> text) => PartnerCard(
          padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 18),
          child: Column(children: [
            Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(icon, size: 40, color: a.inkFaint)),
            ...text,
          ]),
        );

    List<Widget> rows(Iterable<PoolName> list) => [
          for (final (i, n) in list.indexed) ...[if (i > 0) const SizedBox(height: 8), row(n)],
        ];

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: tr('namevotingscreen_her_ikiniz_beyendikde_match_olur_28c3f5', 'Hər ikiniz bəyəndikdə match olur'),
      title: tr('namevotingscreen_ad_secimi_465d2a', 'Ad Seçimi'),
      actions: [
        if (matches.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const AIcon(AIcons.sparkles, size: 12, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 4),
              Text('${matches.length}', style: pText(12, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
            ]),
          ),
      ],
      children: [
        PartnerATabs<String>(
          keyPrefix: 'nv-tab',
          selected: _tab,
          onChanged: (t) => setState(() {
            _tab = t;
            _resetPage();
          }),
          items: [
            ('browse', Text(tr('namevotingscreen_adlari_beyen_67dae3', 'Adları Bəyən'))),
            ('mine', Text('${tr('namevotingscreen_sevimlilerim_c5c6a9', 'Sevimlilər (')}${favorites.length})')),
            ('matches', Row(mainAxisSize: MainAxisSize.min, children: [Text(trInline('NameVotingScreen.tsx', 'Match')), if (matches.isNotEmpty) badge])),
          ],
        ),
        const SizedBox(height: 14),
        if (_tab == 'browse') ...[
          _SearchField(
            controller: _search,
            onChanged: (_) => setState(_resetPage),
          ),
          const SizedBox(height: 12),
          PartnerATabs<String>(
            keyPrefix: 'nv-gender',
            selected: _gender,
            onChanged: (g) => setState(() {
              _gender = g;
              _resetPage();
            }),
            items: [
              ('all', Text(tr('namevotingscreen_hamisi_c73c4d', 'Hamısı'))),
              ('boy', Text(tr('namevotingscreen_oglan_e9715e', 'Oğlan'))),
              ('girl', Text(tr('namevotingscreen_qiz_79bf6b', 'Qız'))),
            ],
          ),
          const SizedBox(height: 12),
          ...rows(filtered.take(_visible)),
          if (filtered.length > _visible) ...[
            const SizedBox(height: 8),
            GestureDetector(
              key: const ValueKey('nv-more'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _visible += kNameRowsPageSize),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                alignment: Alignment.center,
                child: Text(tr('community_load_more', 'Daha çox göstər'), style: context.aText.aTab.copyWith(color: a.inkSoft)),
              ),
            ),
          ],
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: Text(tr('namevotingscreen_ad_tapilmadi_cf4c7a', 'Ad tapılmadı'), textAlign: TextAlign.center, style: pText(13, color: a.inkSoft)),
            ),
        ],
        if (_tab == 'mine')
          if (favorites.isEmpty)
            emptyCard(AIcons.heart, [
              Text(tr('namevotingscreen_hele_ad_secmemisiniz_7c1388', 'Hələ ad seçməmisiniz'), textAlign: TextAlign.center, style: pText(13, color: a.inkSoft)),
            ])
          else
            ...rows(favorites.map(fromFav)),
        if (_tab == 'matches')
          if (matches.isEmpty)
            emptyCard(AIcons.users, [
              Text(tr('namevotingscreen_hele_match_yoxdur_ad5fb8', 'Hələ match yoxdur'),
                  textAlign: TextAlign.center, style: pText(13.5, weight: FontWeight.w700, color: a.ink)),
              const SizedBox(height: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 320),
                child: Text(tr('namevotingscreen_her_ikiniz_eyni_adi_beyendikde_f8a0e8', 'Hər ikiniz eyni adı bəyəndikdə burada görünəcək'),
                    textAlign: TextAlign.center, style: pText(12, color: a.inkSoft)),
              ),
            ])
          else
            ...rows(matches.map(fromFav)),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(pText(13, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        height: 44,
        padding: const EdgeInsetsDirectional.only(start: 16, end: 16),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line), boxShadow: a.cardShadow),
        child: Row(children: [
          AIcon(AIcons.search, size: 16, color: a.inkFaint),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              key: const ValueKey('nv-search'),
              controller: controller,
              onChanged: onChanged,
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: tr('namevotingscreen_ad_ve_ya_mena_axtarin_30a88e', 'Ad və ya məna axtarın...'),
                hintStyle: style.copyWith(color: a.inkFaint),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _NameRow extends StatelessWidget {
  const _NameRow({super.key, required this.n, required this.fav, required this.partnerFav, required this.onToggle});
  final PoolName n;
  final bool fav;
  final bool partnerFav;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final isMatch = fav && partnerFav;
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: isMatch ? a.pink1 : a.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isMatch ? a.pink2 : const Color(0x00000000), width: 1.5),
        boxShadow: isMatch ? null : a.cardShadow,
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(13),
            color: n.gender == 'boy' ? a.blue1 : (n.gender == 'girl' ? (isMatch ? a.chipOverlay : a.pink1) : a.lav1),
          ),
          child: Text(n.gender == 'boy' ? '👦' : (n.gender == 'girl' ? '👧' : '✨'), style: const TextStyle(fontSize: 18, height: 28 / 18)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(n.name,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(13.5, weight: FontWeight.w700, color: isMatch ? a.alertInk : a.ink)),
              ),
              if (isMatch) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AIcon(AIcons.sparkles, size: 10, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 2),
                    Text(trInline('NameVotingScreen.tsx', 'Match'), style: pText(9.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                  ]),
                ),
              ],
            ]),
            if ((n.meaning ?? '').isNotEmpty)
              Text(n.meaning!, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11.5, color: isMatch ? a.berryInk : a.inkSoft)),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(children: [
                Text(_genderLabel(n.gender), style: pText(10, color: isMatch ? a.berryInk : a.inkFaint)),
                if (partnerFav) ...[
                  const SizedBox(width: 8),
                  PartnerLucide(AIcons.heart, size: 10, color: a.pinkInk, fill: a.pinkInk),
                  const SizedBox(width: 2),
                  Text(tr('namevotingscreen_partnyor_label', 'Partnyor'), style: pText(10, color: a.pinkInk)),
                ],
              ]),
            ),
          ]),
        ),
        const SizedBox(width: 12),
        PartnerTap(
          scale: 0.85,
          semanticLabel: n.name,
          onTap: onToggle,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              color: fav ? (isMatch ? a.chipOverlay : a.pink1) : a.surfaceSoft,
            ),
            child: fav ? PartnerLucide(AIcons.heart, size: 20, color: a.pinkInk, fill: a.pinkInk) : AIcon(AIcons.heart, size: 20, color: a.inkFaint),
          ),
        ),
      ]),
    );
  }
}
