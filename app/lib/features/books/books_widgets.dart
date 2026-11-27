// Ported from: src/components/books/books.css (.bk-* rules: covers, .bk-primary, .bk-print, .bk-close, .bk-overlay /
//              .bk-sheet), src/components/books/BookStoreScreen.tsx (PrintGuide, Sheet)
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../settings/ui/settings_ui.dart' show ALoader, px;
import 'books_catalog.dart';

/// `<img src={bookCover(id)}>` (bundled webp; 910×1287 covers).
class BookCover extends StatelessWidget {
  const BookCover(this.id, {super.key, this.width, this.radius = 0, this.shadow, this.border});
  final String id;
  final double? width;
  final double radius;
  final List<BoxShadow>? shadow;
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) {
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: AspectRatio(
        aspectRatio: 910 / 1287,
        child: Image.asset(bookCoverAsset(id), fit: BoxFit.cover, errorBuilder: (_, _, _) => ColoredBox(color: context.a.surfaceSoft)),
      ),
    );
    return Container(
      width: width,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius + (border == null ? 0 : 2)), boxShadow: shadow, border: border),
      child: image,
    );
  }
}

/// `.bk-primary` (h50, radius 16, coral, white 14.5/800, gap 8, margin-top 12; `.ghost` = coral-soft / coral-text;
/// disabled opacity .5).
class BooksPrimaryButton extends StatelessWidget {
  const BooksPrimaryButton({super.key, required this.children, this.onTap, this.ghost = false, this.buttonKey, this.top = 12});
  final List<Widget> children;
  final VoidCallback? onTap;
  final bool ghost;
  final Key? buttonKey;
  final double top;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = ghost ? a.coralText : const Color(0xFFFFFFFF);
    Widget body = Container(
      height: 50,
      margin: EdgeInsets.only(top: top),
      decoration: BoxDecoration(color: ghost ? a.coralSoft : a.coral, borderRadius: BorderRadius.circular(16)),
      child: IconTheme.merge(
        data: IconThemeData(color: fg, size: 16),
        child: DefaultTextStyle.merge(
          style: px(14.5, weight: FontWeight.w800, color: fg),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 8), children[i]],
          ]),
        ),
      ),
    );
    if (onTap == null) body = Opacity(opacity: 0.5, child: body);
    return Semantics(button: true, enabled: onTap != null, child: GestureDetector(key: buttonKey, behavior: HitTestBehavior.opaque, onTap: onTap, child: body));
  }
}

/// Spinning `Loader2` (`animate-spin`).
Widget booksSpinner(double size, Color color) => ALoader(size: size, color: color);

/// `PrintGuide` (`.bk-print`).
class BooksPrintGuide extends StatelessWidget {
  const BooksPrintGuide({super.key, required this.t});
  final String Function(String key) t;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final dark = context.tokens.isDark;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(18),
        // `inset 0 0 0 1px var(--a-line)` (dark: rgba(255,255,255,.08))
        border: Border.all(color: dark ? const Color(0x14FFFFFF) : a.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            AIcon(AIcons.printer, size: 15, color: a.ink),
            const SizedBox(width: 6),
            Expanded(child: Text(t('print_title'), style: px(13, weight: FontWeight.w800, color: a.ink))),
          ]),
        ),
        for (var i = 1; i <= 6; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 18, child: Text('$i.', style: px(12, color: a.inkSoft))),
              Expanded(child: Text(t('print_$i'), style: px(12, color: a.inkSoft))),
            ]),
          ),
      ]),
    );
  }
}

/// `Sheet`: `.bk-overlay` (fixed, dimmed, bottom-aligned; tap outside closes) with `.bk-sheet` (max 480 wide, 92 %
/// tall, `--a-bg`, 28 top radius, padding 18 18 20 + safe bottom) and the `.bk-close` button.
class BooksSheet extends StatelessWidget {
  const BooksSheet({super.key, required this.onClose, required this.label, required this.child, this.footer});
  final VoidCallback onClose;
  final String label;
  final Widget child;

  /// Sticky bottom part (`.bk-detail-cta`).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final dark = context.tokens.isDark;
    final media = MediaQuery.of(context);
    return Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      namesRoute: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onClose,
        child: ColoredBox(
          // rgba(29, 21, 18, .45) / dark rgba(0, 0, 0, .6) (books.css .bk-overlay)
          color: dark ? const Color(0x99000000) : const Color(0x731D1512),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: GestureDetector(
              onTap: () {},
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 480, maxHeight: media.size.height * 0.92),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(color: a.bg, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
                  child: Stack(children: [
                    Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Flexible(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.fromLTRB(18, 18, 18, footer == null ? 20 + media.padding.bottom : 0),
                          child: child,
                        ),
                      ),
                      if (footer != null)
                        Container(
                          padding: EdgeInsets.fromLTRB(18, 14, 18, 4 + media.padding.bottom),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [a.bg.withValues(alpha: 0), a.bg], stops: const [0, 0.3]),
                          ),
                          child: footer,
                        ),
                    ]),
                    Positioned(
                      right: 14,
                      top: 14,
                      child: Semantics(
                        button: true,
                        label: 'Close',
                        child: GestureDetector(
                          key: const ValueKey('books-sheet-close'),
                          onTap: onClose,
                          child: Container(
                            width: 34,
                            height: 34,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                            child: AIcon(AIcons.x, size: 16, color: a.ink),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
