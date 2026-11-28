// Ported from: src/components/partner/v2/PartnerShoppingScreen.tsx
//
// The shared shopping list, full screen (taken out of the old dashboard tab): add an item, tick items off.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, toasts;
import '../../tools/shopping/shopping_data.dart';
import '../partner_ports.dart';
import '../ui/partner_ui.dart';
import 'screens_ui.dart';

/// `getPriorityColor(priority)` (React literals; the default is `--a-ink-faint`).
Color? shoppingPriorityColor(String? priority) => switch (priority) {
      'high' => const Color(0xFFFF8AA4), // PartnerShoppingScreen.tsx:20
      'medium' => const Color(0xFFFFC94D), // PartnerShoppingScreen.tsx:21
      'low' => const Color(0xFF63BD8B), // PartnerShoppingScreen.tsx:22
      _ => null,
    };

class PartnerShoppingScreen extends ConsumerStatefulWidget {
  const PartnerShoppingScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnerShoppingScreen> createState() => _PartnerShoppingScreenState();
}

class _PartnerShoppingScreenState extends ConsumerState<PartnerShoppingScreen> {
  final TextEditingController _newItem = TextEditingController();

  @override
  void dispose() {
    _newItem.dispose();
    super.dispose();
  }

  Future<void> _toggle(String id) async {
    await ref.read(partnerHapticsProvider).light();
    await ref.read(shoppingItemsProvider.notifier).toggleItem(id);
  }

  Future<void> _add() async {
    final text = _newItem.text;
    if (text.trim().isEmpty) return;
    final toast = toasts(context);
    await ref.read(shoppingItemsProvider.notifier).addItem(name: text, quantity: 1, priority: 'medium');
    if (!mounted) return;
    setState(_newItem.clear);
    toast.show(title: tr('partnerdashboard_mehsul_elave_edildi_4c8d9f', 'Məhsul əlavə edildi! 🛒'));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final items = ref.watch(shoppingItemsProvider).items;
    final canAdd = _newItem.text.trim().isNotEmpty;
    final placeholder = tr('partnerdashboard_yeni_mehsul_elave_et_3d6c73', 'Yeni məhsul əlavə et...');
    final inputStyle = DefaultTextStyle.of(context).style.merge(pText(13, color: a.ink));

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: tr('partnerdashboard_sinxronlasdirilmis_siyahi_08835b', 'Sinxronlaşdırılmış siyahı'),
      title: tr('partnerdashboard_alis_veris_siyahisi_a2d4a8', 'Alış-veriş Siyahısı'),
      children: [
        Row(children: [
          Expanded(
            child: Material(
              type: MaterialType.transparency,
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                alignment: AlignmentDirectional.centerStart,
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), boxShadow: a.cardShadow),
                child: TextField(
                  key: const ValueKey('shopping-input'),
                  controller: _newItem,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => unawaited(_add()),
                  style: inputStyle,
                  cursorColor: a.peach2,
                  decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: inputStyle.copyWith(color: a.inkFaint)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          PartnerTap(
            key: const ValueKey('shopping-add'),
            semanticLabel: placeholder,
            enabled: canAdd,
            onTap: () => unawaited(_add()),
            child: Opacity(
              opacity: canAdd ? 1 : 0.5,
              child: Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.green2, shape: BoxShape.circle),
                child: const AIcon(AIcons.plus, size: 20, color: Color(0xFFFFFFFF)),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 16),
        for (final (i, item) in items.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          FadeRise(
            key: ValueKey('shopping-${item['id']}'),
            dy: 0,
            dx: -20,
            delay: Duration(milliseconds: i * 30),
            child: _ShoppingRow(item: item, onToggle: () => unawaited(_toggle('${item['id']}'))),
          ),
        ],
        if (items.isEmpty)
          PartnerCard(
            padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 18),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.shoppingCart, size: 40, color: a.inkFaint)),
              Text(tr('partnerdashboard_siyahi_bosdur_c420ab', 'Siyahı boşdur'), textAlign: TextAlign.center, style: pText(13.5, weight: FontWeight.w600, color: a.inkSoft)),
              const SizedBox(height: 2),
              Text(tr('partnerdashboard_yuxaridaki_formadan_mehsul_elave_edin_32989e', 'Yuxarıdakı formadan məhsul əlavə edin'),
                  textAlign: TextAlign.center, style: pText(12, color: a.inkFaint)),
            ]),
          ),
      ],
    );
  }
}

class _ShoppingRow extends StatelessWidget {
  const _ShoppingRow({required this.item, required this.onToggle});
  final Map<String, dynamic> item;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final checked = item['is_checked'] == true;
    final addedBy = (item['added_by'] as String?) ?? 'woman';
    final quantity = item['quantity'] is num ? (item['quantity'] as num) : 0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: checked ? a.green1 : a.surface, borderRadius: BorderRadius.circular(16), boxShadow: checked ? null : a.cardShadow),
      child: Row(children: [
        PartnerTap(
          scale: 0.9,
          onTap: onToggle,
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: checked ? a.green2 : a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
            child: checked ? const Text('✓', style: TextStyle(fontSize: 14, height: 20 / 14, color: Color(0xFFFFFFFF))) : null,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${item['name'] ?? ''}',
                style: pText(13, weight: FontWeight.w600, color: checked ? a.inkSoft : a.ink)
                    .copyWith(decoration: checked ? TextDecoration.lineThrough : null, decorationColor: a.inkSoft)),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: shoppingPriorityColor(item['priority'] as String?) ?? a.inkFaint, shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text(
                  addedBy == 'partner' ? tr('partnerdashboard_sen_elave_etdin_0008cb', 'Sən əlavə etdin') : tr('partnerdashboard_o_elave_etdi_9aa051', 'O əlavə etdi'),
                  style: pText(10, color: a.inkSoft),
                ),
              ]),
            ),
          ]),
        ),
        if (quantity > 1) ...[
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
            child: Text('x$quantity', style: pText(11, weight: FontWeight.w700, color: a.ink)),
          ),
        ],
      ]),
    );
  }
}
