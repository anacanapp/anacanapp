// Ported from: src/components/ui/textarea.tsx (shadcn Textarea: min-h-[80px] rounded-md border border-input
//              bg-background px-3 py-2 text-base) with the inline overrides of the community screens,
//              src/hooks/useAutoGrowTextarea.ts (grow to the content up to a max height)
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import 'community_widgets.dart';

class CommunityTextArea extends StatelessWidget {
  const CommunityTextArea({
    super.key,
    required this.controller,
    this.focusNode,
    this.placeholder,
    this.onChanged,
    this.minLines = 3,
    this.maxLines,
    this.maxLength,
    this.minHeight = 80,
    this.radius = 6,
    this.background,
    this.borderColor,
    this.fontSize = 16,
    this.enabled = true,
    this.autofocus = false,
    this.semanticLabel,
    this.bordered = true,
    this.padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    this.onKey,
  });
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final int minLines;
  final int? maxLines;
  final int? maxLength;
  final double minHeight;
  final double radius;
  final Color? background;
  final Color? borderColor;
  final double fontSize;
  final bool enabled;
  final bool autofocus;
  final String? semanticLabel;
  final bool bordered;
  final EdgeInsetsGeometry padding;

  /// Raw key handling (Ctrl/Cmd+Enter); return true when handled.
  final bool Function(KeyEvent event)? onKey;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final style = px(fontSize, color: context.a.ink, height: 1.5);
    Widget field = TextField(
      controller: controller,
      focusNode: focusNode,
      enabled: enabled,
      autofocus: autofocus,
      minLines: minLines,
      maxLines: maxLines,
      onChanged: onChanged,
      keyboardType: TextInputType.multiline,
      inputFormatters: maxLength == null ? null : [LengthLimitingTextInputFormatter(maxLength)],
      style: style,
      cursorColor: s.primary,
      decoration: InputDecoration(
        isCollapsed: true,
        border: InputBorder.none,
        hintText: placeholder,
        hintStyle: style.copyWith(color: context.a.inkSoft),
      ),
    );
    if (onKey != null) {
      field = Focus(
        onKeyEvent: (node, event) => onKey!(event) ? KeyEventResult.handled : KeyEventResult.ignored,
        canRequestFocus: false,
        skipTraversal: true,
        child: field,
      );
    }
    return Semantics(
      label: semanticLabel,
      textField: true,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight),
        padding: padding,
        decoration: bordered
            ? BoxDecoration(
                color: background ?? s.background,
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(color: borderColor ?? s.input),
              )
            : null,
        child: Material(type: MaterialType.transparency, child: field),
      ),
    );
  }
}
