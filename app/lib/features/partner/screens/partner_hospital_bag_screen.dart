// Ported from: src/components/partner/PartnerHospitalBagScreen.tsx
//
// The mother's hospital bag as the partner sees and edits it: four tabs (mom / baby / documents / partner items),
// counts over the visible items, own items can be deleted (after a confirmation), default items hidden and shown
// again from a collapsible group.
import 'dart:async';

import 'package:flutter/services.dart' show LengthLimitingTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, ShadDialogFrame, ShadInput, ShadSelect, shadTitle, showShadDialog, toasts;
import '../../tools/hospital_bag/hospital_bag_logic.dart' show BagCategory, cleanItemName, customNameMax;
import '../../tools/pregnancy_common/pregnancy_ui.dart' show confirmPromptProvider;
import '../data/partner_hospital_bag.dart';
import '../ui/partner_ui.dart';
import 'screens_ui.dart';

/// `CATEGORY_ORDER`.
const List<BagCategory> kPartnerBagCategoryOrder = ['mom', 'baby', 'documents', 'partner'];

AIconData _categoryIcon(BagCategory c) => switch (c) {
      'baby' => AIcons.baby,
      'documents' => AIcons.fileText,
      'partner' => AIcons.user,
      _ => AIcons.package,
    };

String _categoryLabel(BagCategory c) => switch (c) {
      'baby' => tr('partnerhospitalbagscreen_korpe_ucun_27c058', 'Körpə üçün'),
      'documents' => tr('partnerhospitalbagscreen_senedler_d60b5e', 'Sənədlər'),
      'partner' => tr('p3b_bag_tab_partner', 'Partnyor'),
      _ => tr('partnerhospitalbagscreen_ana_ucun_8f885e', 'Ana üçün'),
    };

String _title() => tr('partnerhospitalbagscreen_xestexana_cantasi_045078', 'Xəstəxana Çantası');

class PartnerHospitalBagScreen extends ConsumerStatefulWidget {
  const PartnerHospitalBagScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnerHospitalBagScreen> createState() => _PartnerHospitalBagScreenState();
}

class _PartnerHospitalBagScreenState extends ConsumerState<PartnerHospitalBagScreen> {
  BagCategory _active = 'mom';
  bool _showHidden = false;

  PartnerHospitalBag get _bag => ref.read(partnerHospitalBagProvider);

  Future<void> _openAdd() async {
    final added = await showShadDialog<BagCategory>(
      context,
      builder: (_) => _AddItemDialog(initialCategory: _active, add: (name, category) async => _bag.controller?.addItem(name, category)),
    );
    if (added != null && mounted) setState(() => _active = added);
  }

  Future<void> _remove(PartnerHospitalBagItem item) async {
    final toast = toasts(context);
    if (!await ref.read(confirmPromptProvider)(context, tr('p3b_bag_delete_confirm', 'Bu əşya siyahıdan silinsin?'))) return;
    final error = await _bag.controller?.deleteItem(item.item.itemId);
    if (error != null) toast.error(tr('p3b_bag_delete_error', 'Əşya silinmədi. Yenidən cəhd edin.'));
  }

  Future<void> _hide(String itemId, bool hidden) async {
    final toast = toasts(context);
    final error = await _bag.controller?.setHidden(itemId, hidden);
    if (error != null) toast.error(tr('p3b_bag_hide_error', 'Dəyişiklik saxlanmadı. Yenidən cəhd edin.'));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bag = ref.watch(partnerHospitalBagProvider);
    if (bag.loading) return const PartnerPageLoader();

    // Hidden default items: `hiddenItems`, plus any hidden row still in `items`.
    final visible = bag.items.where((i) => !i.item.hidden).toList();
    final hidden = [
      ...bag.hiddenItems,
      ...bag.items.where((i) => i.item.hidden && !bag.hiddenItems.any((h) => h.item.id == i.item.id)),
    ];

    if (visible.isEmpty && hidden.isEmpty) {
      return PartnerSubScreen(onBack: widget.onBack, title: _title(), children: [
        PartnerEmptyCard(
          icon: AIcons.package,
          title: tr('partnerhospitalbagscreen_partnyorunuz_hele_canta_hazirl_1f9cce', 'Partnyorunuz hələ çanta hazırlamayıb'),
          sub: tr('partnerhospitalbagscreen_partnyorunuz_xestexana_cantasi_f29448', 'Partnyorunuz xəstəxana çantası siyahısı yaratdıqda burada görəcəksiniz'),
        ),
      ]);
    }

    final activeItems = visible.where((i) => i.bagCategory == _active).toList();
    final progress = bag.progress;

    return PartnerSubScreen(
      onBack: widget.onBack,
      title: _title(),
      actions: [
        AIconBtn(
          key: const ValueKey('bag-add'),
          size: 38,
          tapScale: 0.95,
          semanticLabel: tr('partnerhospitalbagscreen_esya_elave_et_79e28e', 'Əşya əlavə et'),
          onTap: () => unawaited(_openAdd()),
          icon: const AIcon(AIcons.plus, size: 16),
        ),
      ],
      children: [
        PartnerCard(
          child: Column(children: [
            Row(children: [
              Expanded(child: Text(tr('partnerhospitalbagscreen_hazirliq_23905c', 'Hazırlıq'), style: pText(13, weight: FontWeight.w700, color: a.ink))),
              Text('${bag.checkedCount} / ${bag.totalCount}', style: pText(12.5, color: a.inkSoft)),
            ]),
            const SizedBox(height: 12),
            _ProgressBar(progress: progress, height: 12),
            const SizedBox(height: 8),
            Text('${progress.toStringAsFixed(0)}${tr('partnerhospitalbagscreen_tamamlandi_357fc9', '% tamamlandı')}',
                textAlign: TextAlign.center, style: pText(11.5, color: a.inkSoft)),
          ]),
        ),
        const SizedBox(height: 14),
        PartnerATabs<BagCategory>(
          keyPrefix: 'bag-tab',
          selected: _active,
          onChanged: (c) => setState(() => _active = c),
          items: [
            for (final c in kPartnerBagCategoryOrder)
              () {
                final inCat = visible.where((i) => i.bagCategory == c).toList();
                final checked = inCat.where((i) => i.item.isChecked).length;
                return (
                  c,
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(_categoryIcon(c), size: 13),
                    const SizedBox(width: 6),
                    Text(_categoryLabel(c)),
                    const SizedBox(width: 6),
                    Opacity(opacity: 0.7, child: Text('($checked/${inCat.length})')),
                  ]),
                );
              }(),
          ],
        ),
        const SizedBox(height: 14),
        for (final (i, item) in activeItems.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          _BagRow(
            key: ValueKey('bag-item-${item.item.id}'),
            item: item,
            onToggle: () => unawaited(_bag.controller?.toggleItem(item.item.itemId)),
            onAction: () => unawaited(item.item.custom ? _remove(item) : _hide(item.item.itemId, true)),
          ),
        ],
        if (activeItems.isEmpty)
          PartnerCard(
            padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 18),
            child: Text(tr('partnerhospitalbagscreen_bu_kateqoriyada_esya_yoxdur_f91aa7', 'Bu kateqoriyada əşya yoxdur'),
                textAlign: TextAlign.center, style: pText(13, color: a.inkSoft)),
          ),
        const SizedBox(height: 12),
        PartnerPillButton(
          key: const ValueKey('bag-add-own'),
          expand: true,
          icon: const AIcon(AIcons.plus, size: 14),
          label: tr('p3b_bag_add_own', 'Öz əşyanızı əlavə edin'),
          onTap: () => unawaited(_openAdd()),
        ),
        if (hidden.isNotEmpty) ...[
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Semantics(
              button: true,
              expanded: _showHidden,
              child: GestureDetector(
                key: const ValueKey('bag-hidden-toggle'),
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _showHidden = !_showHidden),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.eyeOff, size: 14, color: a.onBgSoft),
                    const SizedBox(width: 6),
                    Text(formatTr('p3b_bag_hidden_n', 'Gizlədilənlər ({n})', {'n': hidden.length}),
                        style: pText(12, weight: FontWeight.w700, color: a.onBgSoft, height: 16 / 12)),
                    const SizedBox(width: 6),
                    Transform.rotate(angle: _showHidden ? 3.14159265 : 0, child: AIcon(AIcons.chevronDown, size: 14, color: a.onBgSoft)),
                  ]),
                ),
              ),
            ),
          ),
          if (_showHidden) ...[
            const SizedBox(height: 8),
            for (final (i, item) in hidden.indexed) ...[
              if (i > 0) const SizedBox(height: 6),
              Container(
                key: ValueKey('bag-hidden-${item.item.id}'),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line)),
                child: Row(children: [
                  Expanded(
                    child: Text(item.item.itemName,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(14, weight: FontWeight.w600, color: a.inkSoft, height: 20 / 14)),
                  ),
                  const SizedBox(width: 12),
                  PartnerPillButton(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    icon: const AIcon(AIcons.eye, size: 14),
                    label: tr('p3b_bag_show', 'Göstər'),
                    semanticLabel: '${tr('p3b_bag_show', 'Göstər')}: ${item.item.itemName}',
                    onTap: () => unawaited(_hide(item.item.itemId, false)),
                  ),
                ]),
              ),
            ],
          ],
        ],
      ],
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.progress, required this.height});
  final double progress;
  final double height;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: height,
        color: a.surfaceSoft,
        alignment: AlignmentDirectional.centerStart,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: (progress / 100).clamp(0, 1)),
          duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 600),
          curve: Curves.easeOut,
          builder: (context, v, _) => FractionallySizedBox(
            widthFactor: v,
            heightFactor: 1,
            child: DecoratedBox(decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(999))),
          ),
        ),
      ),
    );
  }
}

/// The partner screens' `var(--a-grad-peach)` progress bar (height 8 / 12).
class PartnerProgressBar extends StatelessWidget {
  const PartnerProgressBar({super.key, required this.progress, this.height = 8});
  final double progress;
  final double height;
  @override
  Widget build(BuildContext context) => _ProgressBar(progress: progress, height: height);
}

class _BagRow extends StatelessWidget {
  const _BagRow({super.key, required this.item, required this.onToggle, required this.onAction});
  final PartnerHospitalBagItem item;
  final VoidCallback onToggle;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final i = item.item;
    final checked = i.isChecked;
    final actionLabel = i.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət');
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 8, 6),
      decoration: BoxDecoration(color: checked ? a.green1 : a.surface, borderRadius: BorderRadius.circular(16), boxShadow: checked ? null : a.cardShadow),
      child: Row(children: [
        Expanded(
          child: Semantics(
            button: true,
            toggled: checked,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.all(9),
                child: Row(children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: checked ? a.green2 : const Color(0x00000000),
                      border: checked ? null : Border.all(color: a.inkFaint, width: 2),
                    ),
                    child: checked ? const AIcon(AIcons.check, size: 16, strokeWidth: 3, color: Color(0xFFFFFFFF)) : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(i.itemName,
                        style: pText(13.5, weight: FontWeight.w600, color: checked ? a.inkSoft : a.ink)
                            .copyWith(decoration: checked ? TextDecoration.lineThrough : null, decorationColor: a.inkSoft)),
                  ),
                  if (i.addedBy == 'partner') ...[
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.user, size: 12, color: a.blueInk),
                        const SizedBox(width: 4),
                        Text(tr('partnerhospitalbagscreen_sen_0580e7', 'Sən'), style: pText(10.5, weight: FontWeight.w700, color: a.blueInk)),
                      ]),
                    ),
                  ],
                ]),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          label: '$actionLabel: ${i.itemName}',
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onAction,
            child: SizedBox(
              width: 32,
              height: 32,
              child: Center(child: AIcon(i.custom ? AIcons.trash2 : AIcons.eyeOff, size: 16, color: a.inkFaint)),
            ),
          ),
        ),
      ]),
    );
  }
}

class _AddItemDialog extends StatefulWidget {
  const _AddItemDialog({required this.initialCategory, required this.add});
  final BagCategory initialCategory;
  final Future<({Object? data, Object? error})?> Function(String name, BagCategory category) add;

  @override
  State<_AddItemDialog> createState() => _AddItemDialogState();
}

class _AddItemDialogState extends State<_AddItemDialog> {
  final TextEditingController _name = TextEditingController();
  late BagCategory _category = widget.initialCategory;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = cleanItemName(_name.text);
    if (name.isEmpty || _saving) return;
    final toast = toasts(context);
    final nav = Navigator.of(context);
    setState(() => _saving = true);
    final res = await widget.add(name, _category);
    if (!mounted) return;
    setState(() => _saving = false);
    if (res == null || res.error != null) {
      toast.error(tr('p3b_bag_add_error', 'Əşya əlavə olunmadı. Yenidən cəhd edin.'));
      return;
    }
    nav.pop(_category);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final canSubmit = cleanItemName(_name.text).isNotEmpty && !_saving;
    return ShadDialogFrame(radius: 22, inset: 16, children: [
      Text(tr('partnerhospitalbagscreen_esya_elave_et_79e28e', 'Əşya əlavə et'), style: shadTitle(context).copyWith(color: a.ink)),
      Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Semantics(
            label: tr('p3b_bag_new_item', 'Öz əşyanız'),
            textField: true,
            child: ShadInput(
              fieldKey: const ValueKey('bag-new-name'),
              controller: _name,
              height: 44,
              radius: 12,
              background: a.surface,
              borderColor: a.lineStrong,
              textColor: a.ink,
              placeholder: tr('p3b_bag_new_item_ph', 'Məsələn: telefon şarj cihazı'),
              inputFormatters: [LengthLimitingTextInputFormatter(customNameMax)],
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 16),
          Semantics(
            label: tr('p3b_bag_category', 'Kateqoriya'),
            child: ShadSelect<BagCategory>(
              fieldKey: const ValueKey('bag-new-category'),
              value: _category,
              background: a.surface,
              borderColor: a.lineStrong,
              textColor: a.ink,
              onChanged: (v) => setState(() => _category = v),
              options: [
                ('mom', Text(tr('partnerhospitalbagscreen_ana_ucun_8f885e', 'Ana üçün'))),
                ('baby', Text(tr('partnerhospitalbagscreen_korpe_ucun_27c058', 'Körpə üçün'))),
                ('documents', Text(tr('partnerhospitalbagscreen_senedler_d60b5e', 'Sənədlər'))),
                ('partner', Text(tr('p3b_bag_cat_partner', 'Partnyor üçün'))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Semantics(
            button: true,
            enabled: canSubmit,
            child: GestureDetector(
              key: const ValueKey('bag-new-submit'),
              behavior: HitTestBehavior.opaque,
              onTap: canSubmit ? () => unawaited(_submit()) : null,
              child: Opacity(
                opacity: canSubmit ? 1 : 0.5,
                child: Container(
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AIcon(AIcons.plus, size: 16, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 8),
                    Text(tr('partnerhospitalbagscreen_elave_et_6e1b9b', 'Əlavə et'), style: pText(14, weight: FontWeight.w500, color: const Color(0xFFFFFFFF), height: 20 / 14)),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    ]);
  }
}
