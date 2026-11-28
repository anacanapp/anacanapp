// Ported from: the repeated bits of src/components/community/{ChatGroupsPanel,GroupChatScreen}.tsx (scope / people
//              chips, the bordered inputs, the public / private choice)
import 'package:flutter/widgets.dart';
import 'package:material_ui/material_ui.dart' show InputBorder, InputDecoration, Material, MaterialType, TextField;

import '../../../design/design.dart';
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../settings/ui/settings_ui.dart' show px;

/// `rounded-full px-4 py-2 text-xs font-semibold` (scope tabs) / `px-3 py-1.5 text-[11px]` (people tabs);
/// selected: `bg-primary text-primary-foreground`.
class GroupChip extends StatelessWidget {
  const GroupChip({super.key, required this.label, required this.selected, required this.onTap, this.tab = false, this.small = false});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool tab;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return Semantics(
      button: !tab,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: small ? const EdgeInsets.symmetric(horizontal: 12, vertical: 6) : const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? s.primary : (small ? s.muted : s.muted.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            maxLines: 1,
            style: px(small ? 11 : 12, weight: small ? FontWeight.w400 : FontWeight.w600, color: selected ? s.primaryForeground : (small ? s.foreground : s.mutedForeground), height: small ? 1.4 : 16 / 12),
          ),
        ),
      ),
    );
  }
}

/// `<input>` / `<textarea>` with `rounded-xl border` (and the label as placeholder when [placeholder]).
class GroupTextField extends StatelessWidget {
  const GroupTextField({super.key, required this.controller, required this.label, required this.maxLength, this.multiline = false, this.placeholder = false});
  final TextEditingController controller;
  final String label;
  final int maxLength;
  final bool multiline;
  final bool placeholder;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final base = px(14, color: s.foreground, height: 20 / 14);
    // The `<input>` loses text-sm to keyboard.css on phones (16px, 20px line box); the textarea keeps it.
    final style = multiline ? base : phoneInputStyle(context, base, lineHeightPx: 20);
    return Semantics(
      label: label,
      textField: true,
      child: Container(
        padding: placeholder ? const EdgeInsets.symmetric(horizontal: 12, vertical: 10) : const EdgeInsets.all(12),
        decoration: BoxDecoration(color: s.background, border: Border.all(color: s.border), borderRadius: BorderRadius.circular(12)),
        child: Material(
          type: MaterialType.transparency,
          child: TextField(
            key: ValueKey('group-field:$label'),
            controller: controller,
            maxLength: maxLength,
            minLines: multiline ? 2 : 1,
            maxLines: multiline ? 4 : 1,
            style: style,
            decoration: InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              counterText: '',
              hintText: placeholder ? label : null,
              hintStyle: style.copyWith(color: s.mutedForeground),
            ),
          ),
        ),
      ),
    );
  }
}

/// The public / private choice (`aria-pressed`, `border-primary bg-primary/10` when chosen), with its note.
class GroupVisibilityOption extends StatelessWidget {
  const GroupVisibilityOption({super.key, required this.selected, required this.public, required this.onTap, this.note = false});
  final bool selected;
  final bool public;
  final bool note;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final label = groupTr(public ? 'group_public' : 'group_private');
    final noteText = groupTr(public ? 'group_public_note' : 'group_private_note');
    return Semantics(
      button: true,
      toggled: selected,
      label: note ? '$label $noteText' : label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? s.primary.withValues(alpha: 0.1) : null,
            border: Border.all(color: selected ? s.primary : s.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(crossAxisAlignment: note ? CrossAxisAlignment.start : CrossAxisAlignment.center, children: [
            if (note)
              Row(children: [
                AIcon(public ? AIcons.globe : AIcons.lockKeyhole, size: 16, color: s.foreground),
                const SizedBox(width: 8),
                Flexible(child: Text(label, style: px(14, weight: FontWeight.w700, color: s.foreground, height: 20 / 14))),
              ])
            else
              Text(label, style: px(14, color: s.foreground, height: 20 / 14)),
            if (note) ...[
              const SizedBox(height: 4),
              Text(noteText, style: px(12, color: s.mutedForeground, height: 16 / 12)),
            ],
          ]),
        ),
      ),
    );
  }
}
