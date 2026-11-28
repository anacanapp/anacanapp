// Ported from: src/styles/keyboard.css (@media (max-width: 767px) text inputs: font-size max(16px, 1em))
//
// On phones React lifts every text field to at least 16 px (iOS zoom guard):
//   input:not([type=checkbox|radio|range|file]), textarea, [contenteditable="true"] { font-size: max(16px, 1em) }
// The input selector has specificity (0,4,1), so it beats class rules such as `.a-search input` or Tailwind
// `text-sm`; only inline `style={{ fontSize }}`, `!important` or more specific selectors keep their size. The
// bare `textarea` (0,0,1) / `[contenteditable]` (0,1,0) selectors lose to any class that sets a font size, so such
// fields keep their own size. Call these helpers only for fields the rule actually reaches.
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// `@media (max-width: 767px)`: CSS px widths, so a fractional 767.5 no longer matches.
bool isPhoneInputWidth(BuildContext context) => MediaQuery.sizeOf(context).width <= 767;

/// The font size of a text field the keyboard.css rule reaches: [size] from 768 px up, otherwise
/// `max(16px, 1em)` where [em] is the font size the field inherits from its parent (`1em` of a font-size
/// declaration is the parent's size; 16 when the parent does not set one larger).
double phoneInputFontSize(BuildContext context, double size, {double em = 16}) =>
    isPhoneInputWidth(context) ? math.max(16, em) : size;

/// [style] with [phoneInputFontSize] applied (use for the text and its placeholder alike). A line height given
/// as a multiplier is kept; pass [lineHeightPx] when React fixes the line box in pixels.
TextStyle phoneInputStyle(BuildContext context, TextStyle style, {double em = 16, double? lineHeightPx}) {
  final size = style.fontSize ?? 14;
  final next = phoneInputFontSize(context, size, em: em);
  if (next == size) return style;
  return style.copyWith(fontSize: next, height: lineHeightPx == null ? style.height : lineHeightPx / next);
}
