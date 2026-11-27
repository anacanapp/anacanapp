// Ported from: src/components/tools/HospitalBag.tsx
import 'dart:async';

import 'package:flutter/services.dart' show LengthLimitingTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'hospital_bag_logic.dart';
import 'hospital_bag_sync.dart';

const List<BagCategory> _categoryOrder = ['documents', 'mom', 'baby', 'partner'];

({String label, String emoji}) _categoryConfig(String key) => switch (key) {
      'documents' => (label: tr('hospitalbag_senedler_d60b5e', 'Sənədlər'), emoji: '📄'),
      'mom' => (label: tr('hospitalbag_ana_ucun_8f885e', 'Ana üçün'), emoji: '👩'),
      'baby' => (label: tr('hospitalbag_korpe_ucun_27c058', 'Körpə üçün'), emoji: '👶'),
      _ => (label: tr('p3b_bag_cat_partner', 'Partnyor üçün'), emoji: '🧔'),
    };

class HospitalBag extends ConsumerStatefulWidget {
  const HospitalBag({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<HospitalBag> createState() => _HospitalBagState();
}

class _HospitalBagState extends ConsumerState<HospitalBag> {
  String _activeCategory = 'all';
  String? _expandedItem;
  bool _adding = false;
  final TextEditingController _newName = TextEditingController();
  BagCategory _newCategory = 'mom';
  bool _saving = false;
  bool _showHidden = false;

  @override
  void dispose() {
    _newName.dispose();
    super.dispose();
  }

  HospitalBagController get _bag => ref.read(hospitalBagSyncProvider((owner: ref.read(authUserProvider)?.id, role: 'owner')).notifier);

  ({String label, Color bg, Color ink, String dot}) _priority(num p) {
    final a = context.a;
    return switch (p.toInt()) {
      1 => (label: tr('hospitalbag_cox_vacib_c4e66f', 'Çox Vacib'), bg: a.pink1, ink: a.pinkInk, dot: '🔴'),
      3 => (label: tr('hospitalbag_i_steye_bagli_43582b', 'İstəyə bağlı'), bg: a.green1, ink: a.greenInk, dot: '🟢'),
      _ => (label: tr('hospitalbag_priority_orta', 'Orta'), bg: a.yellow1, ink: a.warnInk, dot: '🟡'),
    };
  }

  void _openAdd() => setState(() {
        _newCategory = _activeCategory != 'all' && _categoryOrder.contains(_activeCategory) ? _activeCategory : 'mom';
        _adding = true;
      });

  Future<void> _submitAdd() async {
    final name = cleanItemName(_newName.text);
    if (name.isEmpty || _saving) return;
    final toast = AToastHost.of(context);
    setState(() => _saving = true);
    final res = await _bag.addItem(name, _newCategory);
    if (!mounted) return;
    setState(() => _saving = false);
    if (res.error != null) {
      toast.error(tr('p3b_bag_add_error', 'Əşya əlavə olunmadı. Yenidən cəhd edin.'));
      return;
    }
    setState(() {
      _newName.clear();
      _adding = false;
    });
  }

  Future<void> _removeItem(BagItem item) async {
    final toast = AToastHost.of(context);
    if (!await ref.read(confirmPromptProvider)(context, tr('p3b_bag_delete_confirm', 'Bu əşya siyahıdan silinsin?'))) return;
    final error = await _bag.deleteItem(item.itemId);
    if (error != null) toast.error(tr('p3b_bag_delete_error', 'Əşya silinmədi. Yenidən cəhd edin.'));
  }

  Future<void> _hideItem(String itemId, bool hidden) async {
    final toast = AToastHost.of(context);
    final error = await _bag.setHidden(itemId, hidden);
    if (error != null) toast.error(tr('p3b_bag_hide_error', 'Dəyişiklik saxlanmadı. Yenidən cəhd edin.'));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bag = ref.watch(hospitalBagProvider);
    if (bag.loading) return const ToolLoading();
    final items = visibleBagItems(bag.items);
    final hiddenItems = bag.items.where((i) => i.hidden).toList();
    final progress = bag.counts.progress;
    final checkedCount = bag.counts.checked;
    final totalCount = bag.counts.total;
    final profile = ref.watch(authProfileProvider);
    final isMultiple = profile?.multiplesType != null && profile!.multiplesType!.isNotEmpty && profile.multiplesType != 'single';
    final babyCount = (profile?.babyCount ?? 1).clamp(1, 4);

    final filtered = _activeCategory == 'all' ? items : items.where((i) => i.category == _activeCategory).toList();
    final indexed = [for (var i = 0; i < filtered.length; i++) (i, filtered[i])]
      ..sort((x, y) {
        final c = (x.$2.priority == 0 ? 2 : x.$2.priority).compareTo(y.$2.priority == 0 ? 2 : y.$2.priority);
        return c != 0 ? c : x.$1.compareTo(y.$1);
      });
    final sorted = [for (final e in indexed) e.$2];
    final grouped = <String, List<BagItem>>{};
    if (_activeCategory == 'all') {
      for (final item in sorted) {
        grouped.putIfAbsent(item.category, () => []).add(item);
      }
    }
    final slots = ref.watch(pregnancyToolSlotsProvider);

    final categories = [
      (id: 'all', label: tr('hospitalbag_hamisi_c73c4d', 'Hamısı'), emoji: '👜'),
      (id: 'documents', label: tr('hospitalbag_senedler_d60b5e', 'Sənədlər'), emoji: '📄'),
      (id: 'mom', label: tr('common_ana', 'Ana'), emoji: '👩'),
      (id: 'baby', label: tr('hospitalbag_korpe_fa2b51', 'Körpə'), emoji: '👶'),
      (id: 'partner', label: tr('p3b_bag_tab_partner', 'Partnyor'), emoji: '🧔'),
    ];
    final eyebrow = tr('hospitalbag_36_ci_hefteden_hazir_olmalidir_7990d9', '36-cı həftədən hazır olmalıdır');

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: eyebrow,
          title: tr('hospitalbag_xestexana_cantasi_045078', 'Xəstəxana Çantası'),
          actions: [PTag(background: a.peach1, color: a.accentInk, child: Text('$checkedCount/$totalCount', key: const ValueKey('bag-count')))],
        ),
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            PProgressBar(percent: progress.clamp(2, 100).toDouble()),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(child: Text(eyebrow, style: px(10, weight: FontWeight.w600, color: a.inkSoft))),
              Text('${progress.toStringAsFixed(0)}%', style: px(10, weight: FontWeight.w700, color: a.accentInk)),
            ]),
          ]),
        ),
        if (isMultiple)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('👶👶', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  tr('hospitalbag_ekiz_banner', "Əkiz/çoxdöllü gözləyirsiniz — 'Körpə üçün' bölməsindəki geyim, bez və s. əşyalarını {n} dəst götürməyi unutmayın.")
                      .replaceFirst('{n}', '$babyCount'),
                  style: px(12, weight: FontWeight.w600, color: a.blueInk, height: 1.625),
                ),
              ),
            ]),
          ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: [
            for (final cat in categories) ...[
              if (cat.id != 'all') const SizedBox(width: 6),
              _Pill(
                key: ValueKey('bag-cat-${cat.id}'),
                on: _activeCategory == cat.id,
                onTap: () => setState(() => _activeCategory = cat.id),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(cat.emoji),
                  const SizedBox(width: 6),
                  Text(cat.label),
                  const SizedBox(width: 6),
                  Opacity(
                    opacity: 0.7,
                    child: Text(cat.id == 'all'
                        ? '($checkedCount/${items.length})'
                        : '(${items.where((i) => i.category == cat.id && i.isChecked).length}/${items.where((i) => i.category == cat.id).length})'),
                  ),
                ]),
              ),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
          child: Wrap(spacing: 12, children: [
            for (final p in [1, 2, 3])
              Text('${_priority(p).dot} ${_priority(p).label}', style: px(10, weight: FontWeight.w600, color: a.onBgSoft)),
          ]),
        ),
        if (_activeCategory == 'all') ...[
          for (final key in _categoryOrder)
            if (grouped[key] != null && grouped[key]!.isNotEmpty) _section(context, key, grouped[key]!),
        ] else
          _itemList(sorted),
        Padding(padding: const EdgeInsets.only(top: 12), child: _adding ? _addForm(context) : _addButton()),
        if (hiddenItems.isNotEmpty) _hiddenSection(context, hiddenItems),
        if (progress == 100)
          Container(
            margin: const EdgeInsets.only(top: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(26), boxShadow: a.cardShadow),
            child: Column(children: [
              const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('🎉', style: TextStyle(fontSize: 36))),
              Text(tr('hospitalbag_tebrik_edirik_ba71c0', 'Təbrik edirik!'), style: context.aText.heading(px(18, weight: FontWeight.w700, color: a.greenInk))),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Opacity(
                  opacity: 0.85,
                  child: Text(tr('hospitalbag_cantaniz_hazirdir_xosbext_dogus_279a30', 'Çantanız hazırdır. Xoşbəxt doğuş!'),
                      textAlign: TextAlign.center, style: px(14, color: a.greenInk)),
                ),
              ),
            ]),
          ),
        if (slots.aptekBagCard != null) Padding(padding: const EdgeInsets.only(top: 4), child: slots.aptekBagCard!(context)),
        if (slots.hospitalBagArticles != null) Padding(padding: const EdgeInsets.only(top: 16), child: ACard(child: slots.hospitalBagArticles!(context))),
      ]),
    );
  }

  Widget _section(BuildContext context, String key, List<BagItem> list) {
    final x = context.aText;
    final cfg = _categoryConfig(key);
    final checked = list.where((i) => i.isChecked).length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(cfg.emoji, style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Flexible(child: Text(cfg.label, style: x.aSectionTitle.copyWith(fontSize: 14))),
              ]),
            ),
            Text('$checked/${list.length}', style: x.aSectionLink),
          ]),
        ),
        _itemList(list),
      ]),
    );
  }

  Widget _itemList(List<BagItem> list) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < list.length; i++) ...[if (i > 0) const SizedBox(height: 6), _item(list[i])],
      ]);

  Widget _item(BagItem item) {
    final a = context.a;
    final p = _priority(item.priority == 0 ? 2 : item.priority);
    final isExpanded = _expandedItem == item.itemId;
    final hasNotes = item.notes != null && item.notes!.trim().isNotEmpty;
    return Container(
      key: ValueKey('bag-item-${item.itemId}'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: item.isChecked ? a.green1 : a.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: item.isChecked ? const Color(0x00000000) : a.line),
        boxShadow: item.isChecked ? null : a.cardShadow,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            if (hasNotes) {
              setState(() => _expandedItem = isExpanded ? null : item.itemId);
            } else {
              unawaited(_bag.toggleItem(item.itemId));
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              PTap(
                scale: 0.85,
                semanticLabel: item.itemName,
                selected: item.isChecked,
                onTap: () => unawaited(_bag.toggleItem(item.itemId)),
                child: Container(
                  key: ValueKey('bag-check-${item.itemId}'),
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: item.isChecked ? a.green2 : null,
                    borderRadius: BorderRadius.circular(8),
                    border: item.isChecked ? null : Border.all(color: a.lineStrong, width: 2),
                  ),
                  child: item.isChecked ? const AIcon(AIcons.check, size: 14, color: Color(0xFFFFFFFF)) : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    item.itemName,
                    style: px(14, weight: FontWeight.w600, color: item.isChecked ? a.greenInk : a.ink, height: 1.43)
                        .copyWith(decoration: item.isChecked ? TextDecoration.lineThrough : null, decorationColor: a.greenInk),
                  ),
                  if (hasNotes && !isExpanded)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Opacity(
                        opacity: 0.8,
                        child: Text(item.notes!, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12, color: a.inkSoft, height: 1.33)),
                      ),
                    ),
                  if (item.custom && item.addedBy == 'partner')
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(tr('p3b_bag_added_by_partner', 'Partnyor əlavə edib'), style: px(10, weight: FontWeight.w600, color: a.inkFaint)),
                    ),
                ]),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: item.isChecked ? a.chipOverlay : p.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(p.dot, style: px(10, weight: FontWeight.w600, color: p.ink)),
              ),
              if (hasNotes) ...[
                const SizedBox(width: 6),
                AnimatedRotation(
                  turns: isExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: AIcon(AIcons.chevronDown, size: 14, color: a.inkFaint),
                ),
              ],
              const SizedBox(width: 6),
              Semantics(
                button: true,
                label: item.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət'),
                child: GestureDetector(
                  key: ValueKey('bag-remove-${item.itemId}'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => item.custom ? unawaited(_removeItem(item)) : unawaited(_hideItem(item.itemId, true)),
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: Center(child: AIcon(item.custom ? AIcons.trash2 : AIcons.eyeOff, size: 14, color: a.inkFaint)),
                  ),
                ),
              ),
            ]),
          ),
        ),
        if (isExpanded && hasNotes)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                // `rgba(255,255,255,0.5)` when checked (HospitalBag.tsx literal)
                color: item.isChecked ? const Color(0x80FFFFFF) : a.surfaceSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 14, color: a.peach2)),
                const SizedBox(width: 8),
                Expanded(child: Text(item.notes!, style: px(12, color: a.inkSoft, height: 1.625))),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _addButton() => AButton(
        key: const ValueKey('bag-add-open'),
        variant: AButtonVariant.pillSoft,
        block: true,
        onPressed: _openAdd,
        leading: const AIcon(AIcons.plus, size: 14),
        child: Text(tr('p3b_bag_add_own', 'Öz əşyanızı əlavə edin')),
      );

  Widget _addForm(BuildContext context) {
    final a = context.a;
    final canSave = cleanItemName(_newName.text).isNotEmpty && !_saving;
    final style = px(13, color: a.ink);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(tr('p3b_bag_new_item', 'Öz əşyanız'), style: px(12, weight: FontWeight.w700, color: a.inkSoft)),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
          child: Material(
            type: MaterialType.transparency,
            child: TextField(
              key: const ValueKey('bag-new-item'),
              controller: _newName,
              autofocus: true,
              inputFormatters: [LengthLimitingTextInputFormatter(customNameMax)],
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => unawaited(_submitAdd()),
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: tr('p3b_bag_new_item_ph', 'Məsələn: telefon şarj cihazı'),
                hintStyle: style.copyWith(color: a.inkFaint),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Semantics(
            label: tr('p3b_bag_category', 'Kateqoriya'),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final cat in _categoryOrder)
                _Pill(
                  key: ValueKey('bag-new-cat-$cat'),
                  on: _newCategory == cat,
                  onTap: () => setState(() => _newCategory = cat),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [Text(_categoryConfig(cat).emoji), const SizedBox(width: 4), Text(_categoryConfig(cat).label)]),
                ),
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(children: [
            Opacity(
              opacity: canSave ? 1 : 0.6,
              child: AButton(
                key: const ValueKey('bag-add-submit'),
                variant: AButtonVariant.pillSolid,
                onPressed: canSave ? () => unawaited(_submitAdd()) : null,
                leading: const AIcon(AIcons.plus, size: 14, color: Color(0xFFFFFFFF)),
                child: Text(tr('p3b_bag_add', 'Əlavə et')),
              ),
            ),
            const SizedBox(width: 8),
            AButton(
              variant: AButtonVariant.pillSoft,
              onPressed: () => setState(() {
                _adding = false;
                _newName.clear();
              }),
              child: Text(tr('p3b_bag_cancel', 'Ləğv et')),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _hiddenSection(BuildContext context, List<BagItem> hidden) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(
          button: true,
          expanded: _showHidden,
          child: GestureDetector(
            key: const ValueKey('bag-hidden-toggle'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _showHidden = !_showHidden),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(children: [
                AIcon(AIcons.eyeOff, size: 14, color: a.onBgSoft),
                const SizedBox(width: 6),
                Text(formatTr('p3b_bag_hidden_n', 'Gizlədilənlər ({n})', {'n': hidden.length}), style: px(12, weight: FontWeight.w700, color: a.onBgSoft)),
                const SizedBox(width: 6),
                Transform.rotate(angle: _showHidden ? 3.14159265 : 0, child: AIcon(AIcons.chevronDown, size: 14, color: a.onBgSoft)),
              ]),
            ),
          ),
        ),
        if (_showHidden)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (var i = 0; i < hidden.length; i++) ...[
                if (i > 0) const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line)),
                  child: Row(children: [
                    Expanded(child: Text(hidden[i].itemName, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w600, color: a.inkSoft))),
                    const SizedBox(width: 12),
                    GestureDetector(
                      key: ValueKey('bag-show-${hidden[i].itemId}'),
                      onTap: () => unawaited(_hideItem(hidden[i].itemId, false)),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          AIcon(AIcons.eye, size: 14, color: a.accentInk),
                          const SizedBox(width: 6),
                          Text(tr('p3b_bag_show', 'Göstər'), style: context.aText.aPillBtn.copyWith(color: a.accentInk)),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ],
            ]),
          ),
      ]),
    );
  }
}

/// Category pill (`rounded-full px-3 py-1.5 text-xs font-bold`, peach when on, surface + line when off).
class _Pill extends StatelessWidget {
  const _Pill({super.key, required this.on, required this.onTap, required this.child});
  final bool on;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: on ? a.peach1 : a.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: on ? const Color(0x00000000) : a.line),
        ),
        child: DefaultTextStyle.merge(style: px(12, weight: FontWeight.w700, color: on ? a.accentInk : a.inkSoft, height: 1.33), child: child),
      ),
    );
  }
}
