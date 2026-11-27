// Ported from: src/components/mommy/ChildSelector.tsx
//
// Child switcher (mommy home top bar uses `compact`): current child pill, dropdown with every child (age, edit
// button, check on the selected one) and "add child"; add / edit dialogs (name, birth date ≤ today, gender);
// delete from the edit dialog (window.confirm → a confirm dialog). Without children: an "add child" pill.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show showDatePicker, Material, MaterialType, TextField, InputDecoration;

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../hooks/use_children.dart';

List<(String, String, String)> _genderOptions() => [
      ('boy', tr('childselector_oglan_e9715e', 'Oğlan'), '👦'),
      ('girl', tr('childselector_qiz_79bf6b', 'Qız'), '👧'),
    ];

class ChildSelector extends ConsumerStatefulWidget {
  const ChildSelector({super.key, this.compact = false});
  final bool compact;

  @override
  ConsumerState<ChildSelector> createState() => _ChildSelectorState();
}

class _ChildSelectorState extends ConsumerState<ChildSelector> {
  final _overlay = OverlayPortalController();
  final _link = LayerLink();
  bool _open = false;

  void _toggle() {
    setState(() => _open = !_open);
    _open ? _overlay.show() : _overlay.hide();
  }

  void _close() {
    if (!_open) return;
    setState(() => _open = false);
    _overlay.hide();
  }

  Future<void> _openAdd() async {
    final actions = ref.read(childrenActionsProvider);
    final toast = AToastHost.of(context);
    await showChildFormDialog(
      context,
      title: tr('childselector_usaq_elave_et_d57c06', 'Uşaq Əlavə Et'),
      submitLabel: tr('childselector_elave_et_6e1b9b', 'Əlavə et'),
      namePlaceholder: tr('childselector_korpenin_adi_8a4e9e', 'Körpənin adı'),
      initial: const ChildFormData(),
      onSubmit: (data) async {
        if (data.name.isEmpty || data.birthDate.isEmpty) {
          toast.error(tr('childselector_ad_ve_dogum_tarixi_teleb_olunu_bdab04', 'Ad və doğum tarixi tələb olunur'));
          return false;
        }
        final child = await actions.addChild(name: data.name, birthDate: data.birthDate, gender: data.gender);
        if (child != null) {
          toast.success('${data.name} ${tr('childselector_added', 'əlavə edildi')}');
          actions.setSelectedChild(child);
          return true;
        }
        toast.error(tr('childselector_xeta_bas_verdi_f22fba', 'Xəta baş verdi'));
        return false;
      },
    );
  }

  Future<void> _openEdit(Child child) async {
    final actions = ref.read(childrenActionsProvider);
    final toast = AToastHost.of(context);
    await showChildFormDialog(
      context,
      title: tr('childselector_usaq_redakte_et_53eb46', 'Uşaq Redaktə Et'),
      submitLabel: tr('childselector_save', 'Yadda saxla'),
      initial: ChildFormData(name: child.name, birthDate: child.birthDate, gender: child.gender == 'unknown' ? 'boy' : child.gender),
      onSubmit: (data) async {
        if (data.name.isEmpty || data.birthDate.isEmpty) return false;
        String emoji = '👶';
        for (final g in _genderOptions()) {
          if (g.$1 == data.gender) emoji = g.$3;
        }
        final ok = await actions.updateChild(child.id, {
          'name': data.name,
          'birth_date': data.birthDate,
          'gender': data.gender,
          'avatar_emoji': emoji,
        });
        if (ok) toast.success(tr('childselector_yenilendi_d10a01', 'Yeniləndi'));
        return ok;
      },
      onDelete: (dialogContext) async {
        final confirmed = await showConfirmDialog(dialogContext, '${child.name} ${tr('childselector_delete_confirm', 'silinsin?')}');
        if (!confirmed) return;
        final ok = await actions.deleteChild(child.id);
        if (ok) toast.success(tr('childselector_deleted', 'Silindi'));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final view = ref.watch(childrenProvider);
    final t = context.a;
    final s = AnacanTokens.of(context).shadcn;

    if (!view.hasChildren) {
      return PressScale(
        onTap: _openAdd,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.plus, size: 16, color: s.primary),
            const SizedBox(width: 8),
            Text(tr('childselector_usaq_elave_et_48f1f0', 'Uşaq əlavə et'),
                style: TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: s.primary)),
          ]),
        ),
      );
    }

    final selected = view.selectedChild;
    final compact = widget.compact;
    final button = PressScale(
      scale: 0.98,
      onTap: _toggle,
      child: Container(
        key: const ValueKey('child-selector-button'),
        padding: compact ? const EdgeInsets.symmetric(horizontal: 12, vertical: 6) : const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: compact
            ? BoxDecoration(
                color: t.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.btnBorder),
                // `0 6px 14px -8px rgba(217, 108, 74, 0.35)` (ChildSelector.tsx:164)
                boxShadow: const [BoxShadow(offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8, color: Color(0x59D96C4A))],
              )
            : BoxDecoration(
                color: s.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: s.border),
                boxShadow: const [BoxShadow(offset: Offset(0, 1), blurRadius: 2, color: Color(0x0D000000))],
              ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(selected?.avatarEmoji.isNotEmpty == true ? selected!.avatarEmoji : '👶', style: const TextStyle(fontSize: 18, height: 1.55)),
          const SizedBox(width: 8),
          Text(
            selected?.name ?? tr('childselector_usaq_sec_bbe44f', 'Uşaq seç'),
            style: TextStyle(fontWeight: FontWeight.w500, fontSize: compact ? 14 : 16, height: compact ? 1.43 : 1.5, color: compact ? t.ink : s.foreground),
          ),
          if (view.children.length > 1) ...[
            const SizedBox(width: 8),
            AnimatedRotation(
              turns: _open ? 0.5 : 0,
              duration: const Duration(milliseconds: 150),
              child: AIcon(AIcons.chevronDown, size: 16, color: s.mutedForeground),
            ),
          ],
        ]),
      ),
    );

    return CompositedTransformTarget(
      link: _link,
      child: OverlayPortal(
        controller: _overlay,
        overlayChildBuilder: (overlayContext) => _Dropdown(
          link: _link,
          compact: compact,
          view: view,
          onDismiss: _close,
          onSelect: (c) {
            ref.read(childrenActionsProvider).setSelectedChild(c);
            _close();
          },
          onEdit: (c) {
            _close();
            _openEdit(c);
          },
          onAdd: () {
            _close();
            _openAdd();
          },
        ),
        child: button,
      ),
    );
  }
}

class _Dropdown extends StatelessWidget {
  const _Dropdown({
    required this.link,
    required this.compact,
    required this.view,
    required this.onDismiss,
    required this.onSelect,
    required this.onEdit,
    required this.onAdd,
  });
  final LayerLink link;
  final bool compact;
  final ChildrenView view;
  final VoidCallback onDismiss;
  final void Function(Child) onSelect;
  final void Function(Child) onEdit;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // compact: `end-0` (aligned to the button's end); otherwise `start-0`.
    final alignEnd = compact != rtl;
    return Stack(children: [
      Positioned.fill(child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onDismiss)),
      CompositedTransformFollower(
        link: link,
        targetAnchor: alignEnd ? Alignment.bottomRight : Alignment.bottomLeft,
        followerAnchor: alignEnd ? Alignment.topRight : Alignment.topLeft,
        offset: const Offset(0, 8),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 300),
          curve: ACurves.framerDefault,
          builder: (context, v, child) => Opacity(
            opacity: v,
            child: Transform.translate(offset: Offset(0, -10 * (1 - v)), child: Transform.scale(scale: 0.95 + 0.05 * v, child: child)),
          ),
          child: Container(
            key: const ValueKey('child-selector-dropdown'),
            width: 256,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: s.card,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: s.border),
              boxShadow: const [
                BoxShadow(offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5, color: Color(0x1A000000)),
                BoxShadow(offset: Offset(0, 8), blurRadius: 10, spreadRadius: -6, color: Color(0x1A000000)),
              ],
            ),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (final c in view.children)
                    () {
                      final age = getChildAge(c);
                      final selected = view.selectedChild?.id == c.id;
                      return GestureDetector(
                        key: ValueKey('child-option-${c.id}'),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => onSelect(c),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: selected ? s.primary.withValues(alpha: 0.1) : null, borderRadius: BorderRadius.circular(12)),
                          child: Row(children: [
                            Text(c.avatarEmoji, style: const TextStyle(fontSize: 24, height: 1.33)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w500, color: s.foreground)),
                                Text(age.displayText, style: TextStyle(fontSize: 12, height: 1.33, color: s.mutedForeground)),
                              ]),
                            ),
                            if (selected) ...[const SizedBox(width: 12), AIcon(AIcons.check, size: 16, color: s.primary)],
                            const SizedBox(width: 12),
                            GestureDetector(
                              key: ValueKey('child-edit-${c.id}'),
                              onTap: () => onEdit(c),
                              child: Padding(padding: const EdgeInsets.all(6), child: AIcon(AIcons.squarePen, size: 14, color: s.mutedForeground)),
                            ),
                          ]),
                        ),
                      );
                    }(),
                ]),
              ),
              Container(
                decoration: BoxDecoration(border: Border(top: BorderSide(color: s.border))),
                padding: const EdgeInsets.all(8),
                child: GestureDetector(
                  key: const ValueKey('child-add'),
                  behavior: HitTestBehavior.opaque,
                  onTap: onAdd,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      AIcon(AIcons.plus, size: 16, color: s.primary),
                      const SizedBox(width: 8),
                      Text(tr('childselector_yeni_usaq_elave_et_bb2a07', 'Yeni uşaq əlavə et'),
                          style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14, height: 1.43, color: s.primary)),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class ChildFormData {
  const ChildFormData({this.name = '', this.birthDate = '', this.gender = 'boy'});
  final String name;
  final String birthDate;
  final String gender;
}

/// shadcn `<Dialog>` (`max-w-sm`, p-6, gap-4, border, bg-background, shadow-lg; overlay black/80; close X at
/// end-4/top-4; 200 ms fade + zoom 95%) with the child form.
Future<void> showChildFormDialog(
  BuildContext context, {
  required String title,
  required String submitLabel,
  String? namePlaceholder,
  required ChildFormData initial,
  required Future<bool> Function(ChildFormData data) onSubmit,
  Future<void> Function(BuildContext dialogContext)? onDelete,
}) =>
    Navigator.of(context).push(_DialogRoute(
      builder: (dialogContext) => _ChildFormDialog(
        title: title,
        submitLabel: submitLabel,
        namePlaceholder: namePlaceholder,
        initial: initial,
        onSubmit: onSubmit,
        onDelete: onDelete,
      ),
    ));

/// `window.confirm(message)`.
Future<bool> showConfirmDialog(BuildContext context, String message) async {
  final result = await Navigator.of(context).push<bool>(_DialogRoute<bool>(
    builder: (c) {
      final s = AnacanTokens.of(c).shadcn;
      return _DialogFrame(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(message, style: TextStyle(fontSize: 16, color: s.foreground)),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            _ShadButton(label: 'Cancel', outline: true, onTap: () => Navigator.of(c).pop(false)),
            const SizedBox(width: 8),
            _ShadButton(label: 'OK', onTap: () => Navigator.of(c).pop(true)),
          ]),
        ]),
      );
    },
  ));
  return result ?? false;
}

class _DialogRoute<T> extends PopupRoute<T> {
  _DialogRoute({required this.builder});
  final WidgetBuilder builder;
  @override
  Color? get barrierColor => const Color(0xCC000000);
  @override
  bool get barrierDismissible => true;
  @override
  String? get barrierLabel => 'close';
  @override
  Duration get transitionDuration => const Duration(milliseconds: 200);
  @override
  Widget buildPage(BuildContext context, Animation<double> a, Animation<double> b) => Center(child: Builder(builder: builder));
  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondary, Widget child) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(animation), child: child),
      );
}

class _DialogFrame extends StatelessWidget {
  const _DialogFrame({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final wide = MediaQuery.sizeOf(context).width >= 640;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 384),
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: s.background,
            border: Border.all(color: s.border),
            borderRadius: wide ? BorderRadius.circular(16) : null,
            boxShadow: const [
              BoxShadow(offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3, color: Color(0x1A000000)),
              BoxShadow(offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4, color: Color(0x1A000000)),
            ],
          ),
          child: DefaultTextStyle.merge(style: TextStyle(color: s.foreground), child: child),
        ),
      ),
    );
  }
}

class _ShadButton extends StatelessWidget {
  const _ShadButton({required this.label, required this.onTap, this.outline = false, this.destructive = false, this.icon});
  final String label;
  final VoidCallback onTap;
  final bool outline;
  final bool destructive;
  final AIconData? icon;
  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final bg = destructive ? s.destructive : (outline ? s.background : s.primary);
    final fg = destructive ? s.destructiveForeground : (outline ? s.foreground : s.primaryForeground);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        width: icon != null ? 40 : null,
        padding: icon != null ? null : const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: outline ? Border.all(color: s.input) : null),
        child: icon != null
            ? AIcon(icon!, size: 16, color: fg)
            : Text(label, style: TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: fg)),
      ),
    );
  }
}

class _ChildFormDialog extends StatefulWidget {
  const _ChildFormDialog({
    required this.title,
    required this.submitLabel,
    this.namePlaceholder,
    required this.initial,
    required this.onSubmit,
    this.onDelete,
  });
  final String title;
  final String submitLabel;
  final String? namePlaceholder;
  final ChildFormData initial;
  final Future<bool> Function(ChildFormData data) onSubmit;
  final Future<void> Function(BuildContext dialogContext)? onDelete;

  @override
  State<_ChildFormDialog> createState() => _ChildFormDialogState();
}

class _ChildFormDialogState extends State<_ChildFormDialog> {
  late final _name = TextEditingController(text: widget.initial.name);
  late String _birth = widget.initial.birthDate;
  late String _gender = widget.initial.gender;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final today = DateTime.now();
    final current = DateTime.tryParse(_birth);
    try {
      final picked = await showDatePicker(
        context: context,
        initialDate: current ?? today,
        firstDate: DateTime(today.year - 20),
        lastDate: today, // `max={todayKey()}`
      );
      if (picked != null) setState(() => _birth = localDateKey(picked));
    } catch (_) {
      // No Material localizations in this tree: keep the typed value.
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final label = TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: s.foreground);
    Widget field(Widget child) => Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: AlignmentDirectional.centerStart,
          decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(14), border: Border.all(color: s.input)),
          child: child,
        );
    return _DialogFrame(
      child: Stack(children: [
        Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.title, style: TextStyle(fontSize: 18, height: 1, fontWeight: FontWeight.w600, letterSpacing: -0.45, color: s.foreground)),
          const SizedBox(height: 16),
          Text(tr('childselector_label_name', 'Ad'), style: label),
          const SizedBox(height: 0),
          field(TextField(
            key: const ValueKey('child-form-name'),
            controller: _name,
            style: TextStyle(fontSize: 16, color: s.foreground),
            cursorColor: s.primary,
            decoration: InputDecoration.collapsed(
              hintText: widget.namePlaceholder,
              hintStyle: TextStyle(fontSize: 16, color: s.mutedForeground),
            ),
          )),
          const SizedBox(height: 16),
          Text(tr('childselector_dogum_tarixi_d96907', 'Doğum tarixi'), style: label),
          GestureDetector(
            key: const ValueKey('child-form-birth'),
            onTap: _pickDate,
            child: field(Text(_birth.isEmpty ? 'yyyy-mm-dd' : _birth,
                style: TextStyle(fontSize: 16, color: _birth.isEmpty ? s.mutedForeground : s.foreground))),
          ),
          const SizedBox(height: 16),
          Text(tr('childselector_label_gender', 'Cins'), style: label),
          const SizedBox(height: 8),
          Row(children: [
            for (final (i, g) in _genderOptions().indexed) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _gender = g.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _gender == g.$1 ? s.primary.withValues(alpha: 0.1) : null,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _gender == g.$1 ? s.primary : s.muted, width: 2),
                    ),
                    child: Column(children: [
                      Text(g.$3, style: const TextStyle(fontSize: 24, height: 1.33)),
                      const SizedBox(height: 4),
                      Text(g.$2, style: TextStyle(fontSize: 12, height: 1.33, color: s.foreground)),
                    ]),
                  ),
                ),
              ),
            ],
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: _ShadButton(
                label: widget.submitLabel,
                onTap: () async {
                  final ok = await widget.onSubmit(ChildFormData(name: _name.text, birthDate: _birth, gender: _gender));
                  if (ok && context.mounted) Navigator.of(context).pop();
                },
              ),
            ),
            if (widget.onDelete != null) ...[
              const SizedBox(width: 8),
              _ShadButton(
                label: '',
                icon: AIcons.trash2,
                destructive: true,
                onTap: () async {
                  final nav = Navigator.of(context);
                  await widget.onDelete!(context);
                  if (nav.mounted) nav.pop();
                },
              ),
            ],
          ]),
        ]),
        PositionedDirectional(
          top: -8,
          end: -8,
          child: GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Opacity(opacity: 0.7, child: AIcon(AIcons.x, size: 16, color: s.foreground)),
          ),
        ),
      ]),
    );
  }
}
