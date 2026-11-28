// Ported from: src/components/games/casual/{GameLobby.tsx,GameDialog.tsx,useCasualText.ts,art.ts,casual.css}
//
// Shared chrome of Tumurcuğun uçuşu and Yolunu aç: the `.cg-*` look (screen, header, buttons, lobby with
// 10-level pages, modal dialog), the casual copy (`casualText` + number formatting) and the art constants.
// Colours are the literals of casual.css (one-off game palette, not design tokens).
library;

import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../casual/data/messages.dart';
import '../common/data/game_messages.dart' show normalizeGameLanguage;
import '../casual/persistence/storage.dart' show CasualProfile;
import 'game_env.dart';
import 'game_widgets.dart';

/// art.ts.
abstract final class CasualArt {
  static const flight = 'assets/images/onboarding/pregnancy-mode.webp';
  static const parking = 'assets/images/onboarding/mother-mode.webp';
  static const qucaqName = 'Qucaq';
  static const brand = 'Anacan PLAY';
}

/// `useCasualText()`.
class CasualText {
  CasualText(this.messages, String language)
      : language = normalizeGameLanguage(language),
        dir = normalizeGameLanguage(language) == 'ar' ? TextDirection.rtl : TextDirection.ltr;
  final CasualMessages messages;
  final String language;
  final TextDirection dir;

  String call(String key, [Map<String, Object?> values = const {}]) => messages.text(language, key, {
        for (final entry in values.entries) entry.key: entry.value is num ? gameNumber(language, entry.value as num) : entry.value,
      });

  String number(num value) => gameNumber(language, value);
}

/// `.cg-screen` custom properties (`.flight-screen` / `.parking-screen` override some).
class CasualPalette {
  const CasualPalette({
    this.accent = const Color(0xFFA779C6),
    this.deep = const Color(0xFF885DAF),
    this.soft = const Color(0xFFF0EDF5),
    this.background = const LinearGradient(
      begin: Alignment(-0.17, -1),
      end: Alignment(0.17, 1),
      colors: [Color(0xFFF5EDDF), Color(0xFFE5EAD6)],
    ),
  });
  static const Color ink = Color(0xFF3B4944);
  static const Color muted = Color(0xFF818A80);
  static const Color surface = Color(0xF2FFFDF8);
  final Color accent;
  final Color deep;
  final Color soft;
  final Gradient background;
}

/// `.cg-screen` + `.cg-shell`: full-screen portal, safe-area padding (min 10 / 14), centred 560 column.
class CasualScreen extends StatelessWidget {
  const CasualScreen({super.key, required this.palette, required this.dir, required this.child, this.overlay, this.screenKey});
  final CasualPalette palette;
  final TextDirection dir;
  final Widget child;
  final Widget? overlay;
  final Key? screenKey;

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.paddingOf(context);
    return GamePortal(
      child: Directionality(
        key: screenKey,
        textDirection: dir,
        child: DefaultTextStyle(
          style: const TextStyle(fontFamily: 'Nunito', color: CasualPalette.ink, fontSize: 14, height: 1.5),
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: palette.background),
            child: Stack(children: [
              Padding(
                padding: EdgeInsets.fromLTRB(math.max(14, pad.left), math.max(10, pad.top), math.max(14, pad.right), math.max(10, pad.bottom)),
                child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 560), child: child)),
              ),
              ?overlay,
            ]),
          ),
        ),
      ),
    );
  }
}

/// `.cg-icon`.
class CasualIconButton extends StatelessWidget {
  const CasualIconButton({super.key, required this.icon, this.onTap, this.label, this.enabled = true, this.size = 44, this.plain = false, this.soft});
  final Widget icon;
  final VoidCallback? onTap;
  final String? label;
  final bool enabled;
  final double size;

  /// `.cg-page > button` / `.cg-modal-close`: no shadow and no border.
  final bool plain;
  final Color? soft;

  @override
  Widget build(BuildContext context) => GameButton(
        enabled: enabled,
        onTap: onTap,
        label: label,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: soft ?? (plain ? null : CasualPalette.surface),
              borderRadius: BorderRadius.circular(15),
              border: plain ? null : Border.all(color: const Color(0xFFFFFFFF)),
              boxShadow: plain ? null : const [BoxShadow(color: Color(0x0C777B5D), offset: Offset(0, 3), blurRadius: 13)],
            ),
            child: IconTheme.merge(data: const IconThemeData(color: CasualPalette.ink), child: icon),
          ),
        ),
      );
}

/// `.cg-header`: back, brand / level titles, an action.
class CasualHeader extends StatelessWidget {
  const CasualHeader({super.key, required this.eyebrow, required this.title, required this.onBack, required this.backLabel, required this.action});
  final String eyebrow;
  final String title;
  final VoidCallback onBack;
  final String backLabel;
  final Widget action;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            CasualIconButton(
              key: const ValueKey('cg-back'),
              icon: const AIcon(AIcons.arrowLeft, size: 20, mirrorInRtl: true),
              label: backLabel,
              onTap: onBack,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(eyebrow, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: CasualPalette.muted)),
                Text(title,
                    style: const TextStyle(fontSize: 19, height: 1.3, fontWeight: FontWeight.w900, letterSpacing: -0.4, color: CasualPalette.ink)),
              ]),
            ),
            const SizedBox(width: 10),
            action,
          ]),
        ),
      );
}

/// `.cg-primary` / `.cg-secondary`.
class CasualButton extends StatelessWidget {
  const CasualButton({super.key, required this.palette, required this.children, this.onTap, this.primary = true, this.enabled = true, this.minHeight = 48, this.spaceBetween = false, this.label});
  final CasualPalette palette;
  final List<Widget> children;
  final VoidCallback? onTap;
  final bool primary;
  final bool enabled;
  final double minHeight;
  final bool spaceBetween;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final fg = primary ? const Color(0xFFFFFFFF) : CasualPalette.ink;
    return GameButton(
      enabled: enabled,
      onTap: onTap,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : 0.4,
        child: Container(
          constraints: BoxConstraints(minHeight: minHeight),
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
          decoration: BoxDecoration(
            gradient: primary
                ? LinearGradient(begin: const Alignment(-0.6, -1), end: const Alignment(0.6, 1), colors: [palette.accent, palette.deep])
                : null,
            color: primary ? null : palette.soft,
            borderRadius: BorderRadius.circular(17),
            border: primary ? null : Border.all(color: const Color(0x22A6A890)),
            boxShadow: primary ? [BoxShadow(color: palette.deep, offset: const Offset(0, 8), blurRadius: 23, spreadRadius: -10)] : null,
          ),
          child: IconTheme.merge(
            data: IconThemeData(color: fg),
            child: DefaultTextStyle.merge(
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: fg),
              textAlign: TextAlign.center,
              child: Row(
                mainAxisAlignment: spaceBetween ? MainAxisAlignment.spaceBetween : MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 8), children[i]],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// `<GameLobby>`: hero (art, title, description, play / resume) and 10-level pages.
class GameLobby extends StatefulWidget {
  const GameLobby({
    super.key,
    required this.palette,
    required this.title,
    required this.description,
    required this.image,
    required this.count,
    required this.profile,
    required this.savedLevel,
    required this.t,
    required this.onPlay,
  });
  final CasualPalette palette;
  final String title;
  final String description;
  final String image;
  final int count;
  final CasualProfile profile;
  final int? savedLevel;
  final CasualText t;
  final ValueChanged<int> onPlay;

  @override
  State<GameLobby> createState() => _GameLobbyState();
}

class _GameLobbyState extends State<GameLobby> {
  late int _page = (widget.profile.unlocked - 1) ~/ 10;

  @override
  Widget build(BuildContext context) {
    final t = widget.t, p = widget.palette, profile = widget.profile;
    final current = widget.savedLevel ?? profile.unlocked;
    final first = _page * 10 + 1;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          height: 170,
          margin: const EdgeInsets.fromLTRB(0, 9, 0, 3),
          alignment: Alignment.center,
          child: Stack(alignment: Alignment.center, children: [
            Container(
              width: 145,
              height: 145,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(colors: [Color(0xA6FFF4DC), Color(0x3DFFF9F9)]),
                border: Border.all(color: const Color(0x99FFFFFF)),
              ),
            ),
            Image.asset(widget.image, width: 165, height: 170, fit: BoxFit.contain, excludeFromSemantics: true),
          ]),
        ),
        Text(widget.title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 35, height: 1.2, fontWeight: FontWeight.w900, letterSpacing: -1.5, color: CasualPalette.ink)),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 310),
              child: Text(widget.description,
                  textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, height: 1.6, color: CasualPalette.muted)),
            ),
          ),
        ),
        const SizedBox(height: 5),
        CasualButton(
          key: const ValueKey('cg-play'),
          palette: p,
          minHeight: 58,
          spaceBetween: true,
          onTap: () => widget.onPlay(current),
          children: [
            const GameFilledIcon(AIcons.play, size: 17, color: Color(0xFFFFFFFF)),
            Expanded(child: Text(t(widget.savedLevel != null ? 'resume' : 'play'), textAlign: TextAlign.start, style: const TextStyle(fontSize: 16))),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Text(t('level', {'level': current}), style: const TextStyle(fontSize: 10)),
              const SizedBox(width: 8),
              const AIcon(AIcons.arrowRight, size: 16),
            ]),
          ],
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: CasualPalette.surface,
            borderRadius: BorderRadius.circular(25),
            border: Border.all(color: const Color(0xFFFFFFFF)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              CasualIconButton(
                icon: const AIcon(AIcons.chevronLeft, size: 18, mirrorInRtl: true),
                label: t('back'),
                plain: true,
                soft: p.soft,
                enabled: _page != 0,
                onTap: () => setState(() => _page--),
              ),
              Expanded(
                child: Text('${t.number(first)} – ${t.number(math.min(widget.count, _page * 10 + 10))}',
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: CasualPalette.muted)),
              ),
              CasualIconButton(
                icon: const AIcon(AIcons.chevronRight, size: 18, mirrorInRtl: true),
                label: t('next'),
                plain: true,
                soft: p.soft,
                enabled: (_page + 1) * 10 < widget.count,
                onTap: () => setState(() => _page++),
              ),
            ]),
            const SizedBox(height: 12),
            LayoutBuilder(builder: (context, constraints) {
              final size = (constraints.maxWidth - 4 * 9) / 5;
              return Wrap(spacing: 9, runSpacing: 9, children: [
                for (var level = first; level <= math.min(widget.count, first + 9); level++) SizedBox(width: size, height: size, child: _level(level)),
              ]);
            }),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(5, 11, 5, 0),
          child: Text(t('saved'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, height: 1.5, color: CasualPalette.muted)),
        ),
      ]),
    );
  }

  Widget _level(int level) {
    final t = widget.t, p = widget.palette, profile = widget.profile;
    final result = profile.levels['$level'];
    final stars = result is Map ? ((result['stars'] as num?) ?? 0).toInt() : 0;
    final unlocked = level <= profile.unlocked;
    final current = result == null && level == profile.unlocked;
    final color = result != null ? const Color(0xFF658264) : current ? const Color(0xFFFFFFFF) : const Color(0xFFA1A69B);
    return GameButton(
      key: ValueKey('casual-level-$level'),
      enabled: unlocked,
      label: t('level', {'level': level}),
      onTap: () => widget.onPlay(level),
      child: Opacity(
        opacity: unlocked ? 1 : 0.4,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            color: result != null ? const Color(0xFFE3EED9) : current ? null : p.soft,
            gradient: current ? LinearGradient(begin: const Alignment(-0.6, -1), end: const Alignment(0.6, 1), colors: [p.accent, p.deep]) : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (unlocked)
              Text(t.number(level), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color, height: 1.3))
            else
              AIcon(AIcons.lockKeyhole, size: 18, color: color),
            const SizedBox(height: 4),
            SizedBox(
              height: 12,
              child: result == null
                  ? null
                  : Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var star = 1; star <= 3; star++)
                        Padding(padding: const EdgeInsets.symmetric(horizontal: 0.5), child: GameStar(size: 9, filled: star <= stars, color: color)),
                    ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `<GameDialog>`: `.cg-modal` over the screen (blurred scrim, centred panel, close button, title) with Escape /
/// native back closing it. Rendered inside the screen's Stack so the game below is inert.
class GameDialog extends StatelessWidget {
  const GameDialog({super.key, required this.title, required this.closeLabel, required this.onClose, required this.children});
  final String title;
  final String closeLabel;
  final VoidCallback onClose;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.paddingOf(context);
    return Positioned.fill(
      child: GameBackHandler(
        onBack: () {
          onClose();
          return true;
        },
        child: GameDialogEscape(
          onClose: onClose,
          child: Semantics(
            scopesRoute: true,
            explicitChildNodes: true,
            label: title,
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 9, sigmaY: 9), // casual.css `blur(9px)`
                child: ColoredBox(
                  color: const Color(0x445A6654),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(20, math.max(20, pad.top), 20, math.max(20, pad.bottom)),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height - math.max(20, pad.top) - math.max(20, pad.bottom)),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 390),
                          child: Container(
                            key: const ValueKey('cg-dialog'),
                            decoration: BoxDecoration(
                              color: CasualPalette.surface,
                              borderRadius: BorderRadius.circular(28),
                              border: Border.all(color: const Color(0xFFFFFFFF)),
                              boxShadow: const [BoxShadow(color: Color(0x274B5647), offset: Offset(0, 15), blurRadius: 55)],
                            ),
                            child: Stack(children: [
                              Padding(
                                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(9, 12, 9, 17),
                                    child: Text(title,
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(
                                            fontSize: 25, height: 1.25, letterSpacing: -0.6, fontWeight: FontWeight.w900, color: CasualPalette.ink)),
                                  ),
                                  ...children,
                                ]),
                              ),
                              PositionedDirectional(
                                top: 8,
                                end: 8,
                                child: CasualIconButton(
                                  key: const ValueKey('cg-dialog-close'),
                                  icon: const AIcon(AIcons.x, size: 19),
                                  label: closeLabel,
                                  plain: true,
                                  size: 36,
                                  onTap: onClose,
                                ),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Escape closes the dialog first (`keydown` capture + `stopImmediatePropagation`).
class GameDialogEscape extends StatelessWidget {
  const GameDialogEscape({super.key, required this.onClose, required this.child});
  final VoidCallback onClose;
  final Widget child;
  @override
  Widget build(BuildContext context) => GameKeyboardListener(
        onKey: (event) {
          if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
            onClose();
            return true;
          }
          return false;
        },
        child: child,
      );
}

/// `.cg-modal p`.
class CasualDialogText extends StatelessWidget {
  const CasualDialogText(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, height: 1.7, color: CasualPalette.muted)),
      );
}

/// `.cg-modal-actions`.
class CasualDialogActions extends StatelessWidget {
  const CasualDialogActions({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 8), children[i]],
        ]),
      );
}

/// `.cg-stars` (the middle star raised by 5 px).
class CasualStars extends StatelessWidget {
  const CasualStars({super.key, required this.stars, required this.label});
  final int stars;
  final String label;
  @override
  Widget build(BuildContext context) => Semantics(
        label: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var star = 1; star <= 3; star++) ...[
              if (star > 1) const SizedBox(width: 8),
              Transform.translate(
                offset: Offset(0, star == 2 ? -5 : 0),
                child: GameStar(size: 32, filled: star <= stars, color: const Color(0xFFD4A44F)),
              ),
            ],
          ]),
        ),
      );
}

/// `.cg-score`.
class CasualScore extends StatelessWidget {
  const CasualScore({super.key, required this.value, required this.label, required this.soft});
  final String value;
  final String label;
  final Color soft;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(18)),
        child: Column(children: [
          Text(value, style: const TextStyle(fontSize: 29, fontWeight: FontWeight.w900, color: CasualPalette.ink, height: 1.2)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: CasualPalette.muted)),
        ]),
      );
}

/// `.cg-tools` button.
class CasualToolButton extends StatelessWidget {
  const CasualToolButton({super.key, required this.palette, required this.icon, required this.label, this.badge, this.onTap, this.enabled = true});
  final CasualPalette palette;
  final AIconData icon;
  final String label;
  final String? badge;
  final VoidCallback? onTap;
  final bool enabled;
  @override
  Widget build(BuildContext context) => GameButton(
        enabled: enabled,
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            decoration: BoxDecoration(color: palette.soft, borderRadius: BorderRadius.circular(14)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              AIcon(icon, size: 17, color: palette.deep),
              const SizedBox(width: 5),
              Flexible(child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.deep))),
              if (badge != null) ...[
                const SizedBox(width: 5),
                Opacity(opacity: 0.65, child: Text(badge!, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: palette.deep))),
              ],
            ]),
          ),
        ),
      );
}
