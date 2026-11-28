// Ported from: src/components/games/iki-dost/{useFriendsText.ts,art.ts,FriendsDialog.tsx} and the `.tf-*` palette,
//              button and modal rules of two-friends.css
library;

import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../common/data/game_messages.dart' show normalizeGameLanguage;
import '../../ui_common/casual_ui.dart' show GameDialogEscape;
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../data/messages.dart';

/// art.ts: Ritm, Tumurcuq.
const List<String> friendsArtAssets = ['assets/images/onboarding/cycle-mode.webp', 'assets/images/onboarding/pregnancy-mode.webp'];
const String friendsBrand = 'Anacan PLAY';

/// `useFriendsText()`.
class FriendsText {
  FriendsText(this.messages, String language) : language = normalizeGameLanguage(language);
  final FriendsMessages messages;
  final String language;
  TextDirection get dir => language == 'ar' ? TextDirection.rtl : TextDirection.ltr;

  String call(String key, [Map<String, Object?> values = const {}]) => messages.text(language, key, {
        for (final e in values.entries) e.key: e.value is num ? gameNumber(language, e.value as num) : e.value,
      });

  String number(num value) => gameNumber(language, value);
}

/// two-friends.css custom properties (one-off game palette).
abstract final class FriendsPalette {
  static const ink = Color(0xFF3D4A43);
  static const muted = Color(0xFF81897F);
  static const coral = Color(0xFFE7756D);
  static const purple = Color(0xFFA57ACA);
  static const green = Color(0xFF678974);
  static const surface = Color(0xF0FFFDF7);
  static const line = Color(0x3396A488);
}

TextStyle tfText(double size, {FontWeight weight = FontWeight.w400, Color? color, double height = 1.5, double? ls}) =>
    TextStyle(fontFamily: 'Nunito', fontSize: size, fontWeight: weight, color: color ?? FriendsPalette.ink, height: height, letterSpacing: ls);

/// `.tf-icon`.
class FriendsIconButton extends StatelessWidget {
  const FriendsIconButton({super.key, required this.icon, required this.label, this.onTap, this.enabled = true, this.plain = false, this.size = 44, this.mirror = false});
  final AIconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool enabled;
  final bool plain;
  final double size;
  final bool mirror;
  @override
  Widget build(BuildContext context) => GameButton(
        enabled: enabled,
        onTap: onTap,
        label: label,
        child: Opacity(
          opacity: enabled ? 1 : .3,
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: plain ? const Color(0xFFF1F3E9) : FriendsPalette.surface,
              borderRadius: BorderRadius.circular(16),
              border: plain ? null : Border.all(color: const Color(0xFFFFFFFF)),
              boxShadow: plain ? null : const [BoxShadow(color: Color(0x10617B47), offset: Offset(0, 3), blurRadius: 12)],
            ),
            child: AIcon(icon, size: 20, color: FriendsPalette.ink, mirrorInRtl: mirror),
          ),
        ),
      );
}

/// `.tf-primary` / `.tf-secondary` / `.tf-text`.
class FriendsButton extends StatelessWidget {
  const FriendsButton({super.key, required this.label, this.icon, this.onTap, this.enabled = true, this.kind = 'primary'});
  final String label;
  final AIconData? icon;
  final VoidCallback? onTap;
  final bool enabled;

  /// 'primary' | 'secondary' | 'text'.
  final String kind;
  @override
  Widget build(BuildContext context) {
    final primary = kind == 'primary', text = kind == 'text';
    final fg = primary ? const Color(0xFFFFFFFF) : text ? FriendsPalette.green : FriendsPalette.ink;
    return GameButton(
      enabled: enabled,
      onTap: onTap,
      child: Opacity(
        opacity: enabled ? 1 : .5,
        child: Container(
          constraints: BoxConstraints(minHeight: text ? 44 : 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: text
              ? null
              : BoxDecoration(
                  gradient: primary ? const LinearGradient(begin: Alignment(-0.8, -0.6), end: Alignment(0.8, 0.6), colors: [FriendsPalette.coral, Color(0xFFCB625F)]) : null,
                  color: primary ? null : FriendsPalette.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: primary ? null : Border.all(color: FriendsPalette.line),
                  boxShadow: primary ? const [BoxShadow(color: Color(0x66BE6150), offset: Offset(0, 8), blurRadius: 22, spreadRadius: -9)] : null,
                ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (icon != null) ...[AIcon(icon!, size: 17, color: fg), const SizedBox(width: 8)],
            Flexible(child: Text(label, textAlign: TextAlign.center, style: tfText(text ? 11 : 13, weight: text ? FontWeight.w400 : FontWeight.w800, color: fg))),
          ]),
        ),
      ),
    );
  }
}

/// `<FriendsDialog>` (`.tf-modal`).
class FriendsDialog extends StatelessWidget {
  const FriendsDialog({super.key, required this.title, required this.closeLabel, required this.onClose, required this.children});
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
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 4.5, sigmaY: 4.5),
              child: ColoredBox(
                color: const Color(0x4D526848),
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(20, math.max(20, pad.top), 20, math.max(20, pad.bottom)),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: math.max(0, MediaQuery.sizeOf(context).height - math.max(20, pad.top) - math.max(20, pad.bottom))),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 390),
                        child: Container(
                          key: const ValueKey('tf-dialog'),
                          decoration: BoxDecoration(
                            color: FriendsPalette.surface,
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(color: const Color(0xFFFFFFFF)),
                            boxShadow: const [BoxShadow(color: Color(0x22465839), offset: Offset(0, 18), blurRadius: 65)],
                          ),
                          child: Stack(children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(23, 32, 23, 23),
                              child: DefaultTextStyle.merge(
                              style: tfText(12, color: FriendsPalette.muted, height: 1.7),
                              textAlign: TextAlign.center,
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 16),
                                  child: Semantics(
                                    header: true,
                                    child: Text(title, textAlign: TextAlign.center, style: tfText(24, weight: FontWeight.w900, height: 1.25, ls: -.6)),
                                  ),
                                ),
                                ...children,
                              ]),
                              ),
                            ),
                            PositionedDirectional(
                              top: 9,
                              end: 9,
                              child: GameButton(
                                key: const ValueKey('tf-dialog-close'),
                                label: closeLabel,
                                onTap: onClose,
                                child: const SizedBox(width: 36, height: 36, child: Center(child: AIcon(AIcons.x, size: 19, color: FriendsPalette.ink))),
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

/// `.tf-modal-actions`.
class FriendsActions extends StatelessWidget {
  const FriendsActions({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 9), children[i]],
        ]),
      );
}
