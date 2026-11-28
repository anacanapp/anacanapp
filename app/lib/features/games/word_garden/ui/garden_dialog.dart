// Ported from: src/components/games/word-garden/GardenDialog.tsx, GardenSettings.tsx, GardenHelp.tsx and the
//              `.wg-modal*`, `.wg-settings`, `.wg-help-list`, `.wg-primary/.wg-secondary/.wg-text-button` rules of
//              word-garden.css
library;

import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../ui_common/casual_ui.dart' show GameDialogEscape;
import '../../ui_common/game_widgets.dart';
import '../persistence/storage.dart' show GardenPreferences;
import 'garden_theme.dart';

TextStyle wgText(double size, {FontWeight weight = FontWeight.w400, Color? color, double height = 1.5, double? ls}) =>
    TextStyle(fontFamily: 'Nunito', fontSize: size, fontWeight: weight, color: color, height: height, letterSpacing: ls);

/// `.wg-icon` (44×44 panel square, radius 16).
class GardenIconButton extends StatelessWidget {
  const GardenIconButton({super.key, required this.palette, required this.icon, required this.label, this.onTap, this.enabled = true, this.size = 44, this.plain = false});
  final GardenPalette palette;
  final AIconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool enabled;
  final double size;
  final bool plain;
  @override
  Widget build(BuildContext context) => GameButton(
        enabled: enabled,
        onTap: onTap,
        label: label,
        child: Opacity(
          opacity: enabled ? 1 : 0.35,
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: plain ? null : palette.panel,
              borderRadius: BorderRadius.circular(plain ? 12 : 16),
              border: plain ? null : Border.all(color: palette.border),
              boxShadow: plain ? null : const [BoxShadow(color: Color(0x09294734), offset: Offset(0, 2), blurRadius: 12)],
            ),
            child: AIcon(icon, size: plain ? 18 : 19, color: palette.ink),
          ),
        ),
      );
}

/// `.wg-primary` / `.wg-secondary` / `.wg-text-button`.
enum GardenButtonKind { primary, secondary, text }

class GardenButton extends StatelessWidget {
  const GardenButton({super.key, required this.palette, required this.label, this.icon, this.onTap, this.enabled = true, this.kind = GardenButtonKind.primary, this.filledIcon = false});
  final GardenPalette palette;
  final String label;
  final AIconData? icon;
  final VoidCallback? onTap;
  final bool enabled;
  final GardenButtonKind kind;
  final bool filledIcon;
  @override
  Widget build(BuildContext context) {
    final p = palette;
    final fg = kind == GardenButtonKind.primary ? const Color(0xFFFFFFFF) : kind == GardenButtonKind.text ? p.accentDeep : p.ink;
    final opacity = enabled ? 1.0 : kind == GardenButtonKind.primary ? 0.55 : 0.5;
    return GameButton(
      enabled: enabled,
      onTap: onTap,
      child: Opacity(
        opacity: opacity,
        child: Container(
          constraints: BoxConstraints(minHeight: kind == GardenButtonKind.text ? 40 : 48),
          padding: kind == GardenButtonKind.text ? const EdgeInsets.symmetric(horizontal: 5, vertical: 11) : const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: kind == GardenButtonKind.text
              ? null
              : BoxDecoration(
                  gradient: kind == GardenButtonKind.primary ? p.primary : null,
                  color: kind == GardenButtonKind.secondary ? p.panel : null,
                  borderRadius: BorderRadius.circular(17),
                  border: kind == GardenButtonKind.secondary ? Border.all(color: p.border) : null,
                  boxShadow: kind == GardenButtonKind.primary
                      ? [BoxShadow(color: p.accentDeep, offset: const Offset(0, 8), blurRadius: 24, spreadRadius: -10)]
                      : null,
                ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (icon != null) ...[
              filledIcon ? GameFilledIcon(icon!, size: 17, color: fg) : AIcon(icon!, size: 17, color: fg),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(label,
                  textAlign: TextAlign.center,
                  style: wgText(kind == GardenButtonKind.text ? 12 : 14, weight: FontWeight.w800, color: fg)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `<GardenDialog>` (`.wg-modal`): blurred scrim, centred panel with close + title, Escape / native back close it.
class GardenDialog extends StatelessWidget {
  const GardenDialog({super.key, required this.palette, required this.title, required this.closeLabel, required this.onClose, required this.children});
  final GardenPalette palette;
  final String title;
  final String closeLabel;
  final VoidCallback onClose;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.paddingOf(context);
    final p = palette;
    return Positioned.fill(
      child: GameBackHandler(
        onBack: () {
          onClose();
          return true;
        },
        child: GameDialogEscape(
          onClose: onClose,
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
              child: ColoredBox(
                color: const Color(0x3D3A463A),
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(24, math.max(22, pad.top), 24, math.max(22, pad.bottom)),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: math.max(0, MediaQuery.sizeOf(context).height - math.max(22, pad.top) - math.max(22, pad.bottom))),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 398),
                        child: Container(
                          key: const ValueKey('wg-dialog'),
                          decoration: BoxDecoration(
                            color: p.panel,
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(color: p.border),
                            boxShadow: const [BoxShadow(color: Color(0x26253F31), offset: Offset(0, 18), blurRadius: 80)],
                          ),
                          child: Stack(children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                              child: DefaultTextStyle.merge(
                              style: wgText(12, color: p.muted, height: 1.7),
                              textAlign: TextAlign.center,
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(14, 11, 14, 13),
                                  child: Semantics(
                                    header: true,
                                    child: Text(title, textAlign: TextAlign.center, style: wgText(23, weight: FontWeight.w900, color: p.ink, height: 1.3, ls: -0.4)),
                                  ),
                                ),
                                ...children,
                              ]),
                              ),
                            ),
                            Positioned(
                              right: 12,
                              top: 12,
                              child: GardenIconButton(
                                key: const ValueKey('wg-dialog-close'),
                                palette: p,
                                icon: AIcons.x,
                                label: closeLabel,
                                plain: true,
                                size: 32,
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
    );
  }
}

/// `.wg-modal-emblem`.
class GardenEmblem extends StatelessWidget {
  const GardenEmblem({super.key, required this.palette, required this.icon});
  final GardenPalette palette;
  final AIconData icon;
  @override
  Widget build(BuildContext context) => Center(
        child: Container(
          width: 65,
          height: 65,
          margin: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: palette.soft, borderRadius: BorderRadius.circular(22)),
          child: AIcon(icon, size: 30, color: palette.leaf),
        ),
      );
}

/// `.wg-modal-actions`.
class GardenActions extends StatelessWidget {
  const GardenActions({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 21),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 8), children[i]],
        ]),
      );
}

/// `.wg-muted`.
class GardenMuted extends StatelessWidget {
  const GardenMuted(this.text, {super.key, required this.palette});
  final String text;
  final GardenPalette palette;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 3),
        child: Text(text, textAlign: TextAlign.center, style: wgText(10, color: palette.muted, height: 1.7)),
      );
}

/// `<GardenSettings>`: four switches and the three sceneries.
class GardenSettings extends StatelessWidget {
  const GardenSettings({super.key, required this.palette, required this.preferences, required this.onChange, required this.t});
  final GardenPalette palette;
  final GardenPreferences preferences;
  final ValueChanged<GardenPreferences> onChange;
  final GardenText t;

  GardenPreferences _with(String key) => GardenPreferences(
        sound: key == 'sound' ? !preferences.sound : preferences.sound,
        haptics: key == 'haptics' ? !preferences.haptics : preferences.haptics,
        highContrast: key == 'highContrast' ? !preferences.highContrast : preferences.highContrast,
        reducedMotion: key == 'reducedMotion' ? !preferences.reducedMotion : preferences.reducedMotion,
        theme: preferences.theme,
      );

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final switches = [
      ('sound', AIcons.volume2, 'sound', 'soundDescription', preferences.sound),
      ('haptics', AIcons.vibrate, 'haptics', 'hapticsDescription', preferences.haptics),
      ('highContrast', AIcons.contrast, 'highContrast', 'contrastDescription', preferences.highContrast),
      ('reducedMotion', AIcons.sparkles, 'reducedMotion', 'motionDescription', preferences.reducedMotion),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 17),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final (key, icon, title, description, on) in switches)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x1C91A087)))),
            child: Row(children: [
              Container(
                width: 34,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: p.soft, borderRadius: BorderRadius.circular(12)),
                child: AIcon(icon, size: 19, color: p.leaf),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t(title), textAlign: TextAlign.start, style: wgText(12, weight: FontWeight.w800, color: p.ink)),
                  const SizedBox(height: 3),
                  Text(t(description), textAlign: TextAlign.start, style: wgText(10, color: p.muted)),
                ]),
              ),
              const SizedBox(width: 10),
              GameButton(
                key: ValueKey('wg-switch-$key'),
                toggled: on,
                label: t(title),
                onTap: () => onChange(_with(key)),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 42,
                  height: 26,
                  padding: const EdgeInsets.all(3),
                  alignment: on ? Alignment.centerRight : Alignment.centerLeft,
                  decoration: BoxDecoration(color: on ? p.leaf : const Color(0xFFB6BCB5), borderRadius: BorderRadius.circular(18)),
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFFFFF),
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: Color(0x22000000), offset: Offset(0, 2), blurRadius: 3)],
                    ),
                  ),
                ),
              ),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 20, bottom: 11),
          child: Text(t('scenery'), textAlign: TextAlign.start, style: wgText(12, weight: FontWeight.w800, color: p.ink)),
        ),
        Row(children: [
          for (final (i, (theme, icon, colors, fg)) in const [
            ('garden', AIcons.flower2, [Color(0xFFF4DECC), Color(0xFFC8D7BE)], Color(0xFF5C7563)),
            ('lake', AIcons.waves, [Color(0xFFE1E9F0), Color(0xFF9DC8D3)], Color(0xFF547D8D)),
            ('night', AIcons.moon, [Color(0xFF465477), Color(0xFF253743)], Color(0xFFF5DEAB)),
          ].indexed) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: GameButton(
                key: ValueKey('wg-theme-$theme'),
                selected: preferences.theme == theme,
                label: t(theme),
                onTap: () => onChange(GardenPreferences(
                  sound: preferences.sound,
                  haptics: preferences.haptics,
                  highContrast: preferences.highContrast,
                  reducedMotion: preferences.reducedMotion,
                  theme: theme,
                )),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 87),
                  padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 15),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: const Alignment(-0.5, -0.87), end: const Alignment(0.5, 0.87), colors: colors),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: preferences.theme == theme ? p.accent : const Color(0x00000000), width: 2),
                  ),
                  child: Stack(children: [
                    Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(icon, size: 24, color: fg),
                        const SizedBox(height: 12),
                        Text(t(theme), style: wgText(9, color: fg)),
                      ]),
                    ),
                    if (preferences.theme == theme) Positioned(top: -9, right: -3, child: AIcon(AIcons.check, size: 13, color: fg)),
                  ]),
                ),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}

/// `<GardenHelp>`.
class GardenHelp extends StatelessWidget {
  const GardenHelp({super.key, required this.palette, required this.t});
  final GardenPalette palette;
  final GardenText t;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final (i, (icon, key)) in const [
            (AIcons.hand, 'helpDraw'),
            (AIcons.mousePointer2, 'helpTap'),
            (AIcons.repeat2, 'helpRepeat'),
            (AIcons.grid2x2, 'helpBoard'),
            (AIcons.lightbulb, 'helpHints'),
            (AIcons.star, 'helpStars'),
          ].indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 34,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: palette.soft, borderRadius: BorderRadius.circular(12)),
                child: AIcon(icon, size: 20, color: palette.leaf),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(t(key), textAlign: TextAlign.start, style: wgText(11, color: palette.muted, height: 1.65))),
            ]),
          ],
        ]),
      );
}
