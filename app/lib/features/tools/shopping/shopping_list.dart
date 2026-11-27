// Ported from: src/components/tools/ShoppingList.tsx
//
// Shopping list (`shopping`): personal or shared with the linked partner, priorities, platform recommendations and
// the bought items section.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/date_utils.dart' show formatRelativeDateAz;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, FadeRise, cssUpper, px;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'shopping_data.dart';

class ShoppingList extends ConsumerStatefulWidget {
  const ShoppingList({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<ShoppingList> createState() => _ShoppingListState();
}

class _ShoppingListState extends ConsumerState<ShoppingList> {
  final _name = TextEditingController();
  String _priority = 'medium';
  bool _showCompleted = false;
  bool _showRecommendations = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _name.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  (Color, Color) _priorityStyle(String p, ATokens a) => switch (p) {
        'low' => (a.green1, a.greenInk),
        'high' => (a.pink1, a.pinkInk),
        _ => (a.yellow1, a.warnInk),
      };

  String _priorityLabel(String p) => switch (p) {
        'low' => tr('shoppinglist_asagi_1c27f1', 'Aşağı'),
        'high' => tr('shoppinglist_yuksek_492584', 'Yüksək'),
        _ => tr('shoppinglist_priority_orta', 'Orta'),
      };

  Future<void> _add() async {
    if (_name.text.trim().isEmpty) return;
    final toasts = AToastHost.of(context);
    setState(() => _submitting = true);
    final result = await ref.read(shoppingItemsProvider.notifier).addItem(name: _name.text.trim(), priority: _priority);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (result.error != null) {
      toasts.show(title: tr('shoppinglist_xeta_3cdbb6', 'Xəta'), description: tr('shoppinglist_mehsul_elave_edile_bilmedi_47a41c', 'Məhsul əlavə edilə bilmədi'), destructive: true);
    } else {
      _name.clear();
      toasts.show(title: tr('shoppinglist_mehsul_elave_edildi_db41ff', 'Məhsul əlavə edildi!'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shoppingItemsProvider);
    if (state.loading) return const ToolLoading();
    final a = context.a;
    final controller = ref.read(shoppingItemsProvider.notifier);
    final isShared = (ref.watch(authProfileProvider)?.linkedPartnerId ?? '').isNotEmpty;
    final defaults = ref.watch(defaultShoppingItemsProvider).value ?? const <Map<String, dynamic>>[];
    final existing = {for (final i in state.items) '${i['name'] ?? ''}'.toLowerCase()};
    final recommendations = defaults.where((d) => !existing.contains('${d['name'] ?? ''}'.toLowerCase())).toList();
    final unchecked = state.items.where((i) => i['is_checked'] != true).toList();
    final checked = state.items.where((i) => i['is_checked'] == true).toList();
    final canAdd = !_submitting && _name.text.trim().isNotEmpty;

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrowChild: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(isShared ? AIcons.users : AIcons.user, size: 10),
            const SizedBox(width: 4),
            Flexible(child: Text(cssUpper(isShared ? tr('shoppinglist_partnyor_ile_ortaq_bbdb50', 'Partnyor ilə ortaq') : tr('shoppinglist_sexsi_siyahi_93858e', 'Şəxsi siyahı')))),
          ]),
          title: isShared ? tr('shoppinglist_ortaq_alisveris_828573', 'Ortaq Alışveriş') : tr('shoppinglist_alisveris_siyahisi_5fe638', 'Alışveriş Siyahısı'),
          actions: [const ExcludeSemantics(child: IgnorePointer(child: AIconBtn(icon: AIcon(AIcons.shoppingCart, size: 16))))],
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: hgap(8, [
            Expanded(child: _stat(context, a.peach1, a.accentInk, '${state.uncheckedCount}', tr('shoppinglist_alinacaq_c49c64', 'alınacaq'))),
            Expanded(child: _stat(context, a.green1, a.greenInk, '${state.checkedCount}', tr('shoppinglist_alindi_63cabc', 'alındı'))),
          ])),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ACard(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(
                    child: AField(
                      fieldKey: const ValueKey('shopping-name'),
                      controller: _name,
                      placeholder: tr('shoppinglist_mehsul_adi_a5d2df', 'Məhsul adı...'),
                      onSubmitted: (_) => _add(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Semantics(
                    button: true,
                    enabled: canAdd,
                    label: tr('a11y_add', 'Əlavə et'),
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: canAdd ? _add : null,
                      child: Opacity(
                        opacity: canAdd ? 1 : 0.5,
                        child: Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                          child: const AIcon(AIcons.plus, size: 16, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
              Row(children: hgap(6, [
                for (final p in const ['low', 'medium', 'high'])
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _priority = p),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: _priority == p ? _priorityStyle(p, a).$1 : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                        child: Text(_priorityLabel(p), style: px(10, weight: FontWeight.w700, color: _priority == p ? _priorityStyle(p, a).$2 : a.inkSoft)),
                      ),
                    ),
                  ),
              ])),
            ]),
          ),
        ),
        if (recommendations.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _showRecommendations = !_showRecommendations),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    AIcon(AIcons.sparkles, size: 16, color: a.peach2),
                    const SizedBox(width: 8),
                    Text('${tr('shoppinglist_platformanin_tovsiyeleri_2e687e', 'Platformanın tövsiyələri (')}${recommendations.length})', style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14)),
                    const Spacer(),
                    AIcon(_showRecommendations ? AIcons.chevronUp : AIcons.chevronDown, size: 16, color: a.accentInk),
                  ]),
                ),
              ),
              if (_showRecommendations)
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final item in recommendations.take(8))
                    ATagChip(
                      onTap: () async {
                        final toasts = AToastHost.of(context);
                        final r = await controller.addItem(name: '${item['name'] ?? ''}', priority: item['priority'] as String?);
                        if (r.error == null) toasts.show(title: '${item['name']} ${tr('shopping_item_added', 'əlavə edildi!')}');
                      },
                      children: [const AIcon(AIcons.plus, size: 12), Text('${item['name'] ?? ''}')],
                    ),
                ]),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: vgap(6, [
            for (final item in unchecked) _uncheckedRow(context, item, controller),
            if (unchecked.isEmpty)
              ACard(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 26),
                child: Column(children: [
                  const Padding(padding: EdgeInsets.only(bottom: 4), child: Text('🛒', style: TextStyle(fontSize: 30))),
                  Text(tr('shoppinglist_siyahi_bosdur_c420ab', 'Siyahı boşdur'), style: AStyles.listSub(context)),
                ]),
              ),
          ]),
        ),
        if (checked.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _showCompleted = !_showCompleted),
                child: Row(children: [
                  AIcon(_showCompleted ? AIcons.chevronUp : AIcons.chevronDown, size: 16, color: a.onBgSoft),
                  const SizedBox(width: 8),
                  Text('${tr('shoppinglist_alinmis_mehsullar_957a1f', 'Alınmış məhsullar (')}${state.checkedCount})', style: px(14, weight: FontWeight.w600, color: a.onBgSoft, height: 20 / 14)),
                ]),
              ),
              if (_showCompleted)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: vgap(8, [for (final item in checked) _checkedRow(context, item, controller)]),
                ),
            ]),
          ),
        if (isShared)
          ACard(
            color: a.blue1,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.circleAlert, size: 20, color: a.blueInk)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('shoppinglist_ortaq_siyahi_e10fff', 'Ortaq siyahı'), style: px(14, weight: FontWeight.w700, color: a.blueInk, height: 20 / 14)),
                  Text(tr('shoppinglist_bu_siyahiya_elave_etdiyiniz_me_0ba1c1', 'Bu siyahıya əlavə etdiyiniz məhsullar partnyorunuz tərəfindən də görünür və real vaxtda sinxronlaşır.'),
                      style: px(12, color: a.blueInk, height: 16 / 12)),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _stat(BuildContext context, Color bg, Color ink, String value, String label) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Text(value, style: AStyles.heading(context, 22, color: ink)),
          const SizedBox(width: 8),
          Flexible(child: Opacity(opacity: 0.8, child: Text(label, style: px(12, weight: FontWeight.w600, color: ink, height: 16 / 12)))),
        ]),
      );

  Widget _deleteButton(BuildContext context, String id, ShoppingItemsController controller, double size, double icon) {
    final a = context.a;
    return Semantics(
      button: true,
      label: tr('common_sil', 'Sil'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => controller.deleteItem(id),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
          child: AIcon(AIcons.trash2, size: icon, color: a.pinkInk),
        ),
      ),
    );
  }

  Widget _uncheckedRow(BuildContext context, Map<String, dynamic> item, ShoppingItemsController controller) {
    final a = context.a;
    final p = '${item['priority'] ?? 'medium'}';
    final (pbg, pink) = _priorityStyle(p, a);
    final name = '${item['name'] ?? ''}';
    return FadeRise(
      key: ValueKey('item-${item['id']}'),
      dy: -10,
      child: ACard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Semantics(
            button: true,
            toggled: false,
            label: name,
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => controller.toggleItem('${item['id']}'),
              child: Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: a.peach2, width: 2))),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listTitle(context)),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Wrap(spacing: 6, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  APill(_priorityLabel(p), background: pbg, color: pink, padding: const EdgeInsets.symmetric(horizontal: 6), fontSize: 9, weight: FontWeight.w700),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.clock, size: 10, color: a.inkFaint),
                    const SizedBox(width: 2),
                    Text(item['created_at'] is String ? formatRelativeDateAz(item['created_at'] as String) : '', style: px(9, color: a.inkFaint)),
                  ]),
                ]),
              ),
            ]),
          ),
          const SizedBox(width: 12),
          _deleteButton(context, '${item['id']}', controller, 28, 14),
        ]),
      ),
    );
  }

  Widget _checkedRow(BuildContext context, Map<String, dynamic> item, ShoppingItemsController controller) {
    final a = context.a;
    final name = '${item['name'] ?? ''}';
    return Opacity(
      opacity: 0.7,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Semantics(
            button: true,
            toggled: true,
            label: name,
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => controller.toggleItem('${item['id']}'),
              child: Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.green2, shape: BoxShape.circle),
                child: const AIcon(AIcons.check, size: 16, color: Color(0xFFFFFFFF)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(name,
                style: px(16, weight: FontWeight.w600, color: a.inkSoft, height: 24 / 16).copyWith(decoration: TextDecoration.lineThrough, decorationColor: a.inkSoft)),
          ),
          const SizedBox(width: 12),
          _deleteButton(context, '${item['id']}', controller, 32, 16),
        ]),
      ),
    );
  }
}
