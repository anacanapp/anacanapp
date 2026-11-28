// Ported from: src/components/games/word-garden/word-garden.css (the `--wg-*` custom properties of
//              `.wg-screen`, `.wg-theme-lake`, `.wg-theme-night`, `.dark .wg-theme-garden`, `.wg-high-contrast`),
//              src/components/games/word-garden/Scenery.tsx, src/components/games/word-garden/useGardenText.ts
//
// Word Garden has its own palette (one-off literals of word-garden.css, not app design tokens).
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../ui_common/game_env.dart';
import '../data/messages.dart';

class GardenPalette {
  const GardenPalette({
    required this.ink,
    required this.muted,
    required this.accent,
    required this.accentDeep,
    required this.panel,
    required this.border,
    required this.soft,
    required this.leaf,
    required this.skyTop,
    required this.skyBottom,
    required this.waterTop,
    required this.waterBottom,
    required this.sun,
    required this.mountainFar,
    required this.mountainNear,
    required this.snow,
    required this.ground,
    required this.flower,
    required this.night,
    required this.highContrast,
  });

  final Color ink, muted, accent, accentDeep, panel, border, soft, leaf;
  final Color skyTop, skyBottom, waterTop, waterBottom, sun, mountainFar, mountainNear, snow, ground, flower;

  /// `.wg-theme-night` or the app's dark mode (`.dark .wg-…` rules).
  final bool night;
  final bool highContrast;

  static GardenPalette of({required String theme, required bool highContrast, required bool dark}) {
    var ink = const Color(0xFF343939), muted = const Color(0xFF747B76), accent = const Color(0xFFEE766E), accentDeep = const Color(0xFFC85A54);
    var panel = const Color(0xD1FFFFFF), border = const Color(0xB8FFFFFF), soft = const Color(0xFFFFF3EA), leaf = const Color(0xFF668573);
    var skyTop = const Color(0xFFF5ECE3), skyBottom = const Color(0xFFF7DBBF), waterTop = const Color(0xFFE6EFE2), waterBottom = const Color(0xFFB8D4C4);
    var sun = const Color(0xFFFFF5D5), far = const Color(0xFFA5BFB2), near = const Color(0xFF7F9E8C), snow = const Color(0xFFFFF7E7);
    var ground = const Color(0xFF93B49C), flower = const Color(0xFFF9B2A1);
    if (theme == 'lake') {
      skyTop = const Color(0xFFE5EEF4);
      skyBottom = const Color(0xFFD2E8EC);
      waterTop = const Color(0xFFB3DBE0);
      waterBottom = const Color(0xFF709EAC);
      far = const Color(0xFF9DB5C6);
      near = const Color(0xFF749AA6);
      ground = const Color(0xFF7BA393);
      soft = const Color(0xFFEEF9FA);
      accent = const Color(0xFF548DA1);
      accentDeep = const Color(0xFF316879);
    } else if (theme == 'night') {
      ink = const Color(0xFFFFF5EF);
      muted = const Color(0xFFC1CBD4);
      panel = const Color(0xDE212F41);
      border = const Color(0x3BABBED1);
      soft = const Color(0xFF2E4358);
      accent = const Color(0xFFCBAAED);
      accentDeep = const Color(0xFFA47BCF);
      skyTop = const Color(0xFF192939);
      skyBottom = const Color(0xFF495574);
      far = const Color(0xFF5A6A81);
      near = const Color(0xFF354A61);
      waterTop = const Color(0xFF516580);
      waterBottom = const Color(0xFF273D58);
      ground = const Color(0xFF334D52);
      leaf = const Color(0xFF8BB1A0);
      sun = const Color(0xFFF6E3B1);
      snow = const Color(0xFFB7CCD8);
      flower = const Color(0xFFD4A4C1);
    } else if (dark) {
      ink = const Color(0xFFFFF3E9);
      muted = const Color(0xFFC9C8BC);
      panel = const Color(0xE32B3635);
      border = const Color(0x33C8D7CF);
      soft = const Color(0xFF394C47);
      skyTop = const Color(0xFF293E3C);
      skyBottom = const Color(0xFF576D64);
      waterTop = const Color(0xFF637F76);
      waterBottom = const Color(0xFF364E49);
      far = const Color(0xFF698278);
      near = const Color(0xFF405C50);
      ground = const Color(0xFF355147);
      leaf = const Color(0xFFAEC4A7);
    }
    if (highContrast) {
      if (theme == 'night') {
        ink = const Color(0xFFFFF8E9);
        muted = const Color(0xFFD3E0D3);
        panel = const Color(0xFF1F3538);
        border = const Color(0xFFB1C9AF);
      } else {
        ink = const Color(0xFF1C3028);
        muted = const Color(0xFF445747);
        panel = const Color(0xFFFFFDF5);
        border = const Color(0xFF859B83);
      }
    }
    return GardenPalette(
      ink: ink, muted: muted, accent: accent, accentDeep: accentDeep, panel: panel, border: border, soft: soft, leaf: leaf,
      skyTop: skyTop, skyBottom: skyBottom, waterTop: waterTop, waterBottom: waterBottom, sun: sun, mountainFar: far, mountainNear: near,
      snow: snow, ground: ground, flower: flower, night: theme == 'night' || dark, highContrast: highContrast,
    );
  }

  LinearGradient get primary => LinearGradient(begin: const Alignment(-0.8, -0.6), end: const Alignment(0.8, 0.6), colors: [accent, accentDeep]);
}

/// `useGardenText(language, locale)`: `t(key, values)` (numbers formatted) and `number(value)`.
class GardenText {
  GardenText(this.messages, this.language);
  final GardenMessages messages;
  final String language;

  String call(String key, [Map<String, Object?> values = const {}]) => messages.text(language, key, {
        for (final e in values.entries) e.key: e.value is num ? gameNumber(language, e.value as num) : e.value,
      });

  String number(num value) => gameNumber(language, value);
}

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// `<GardenScenery />`: the original SVG artwork drawn with the theme's palette (`xMidYMax slice`) + the wash.
class GardenScenery extends StatelessWidget {
  const GardenScenery({super.key, required this.palette});
  final GardenPalette palette;

  String _svg() {
    final p = palette;
    return '''
<svg viewBox="0 0 1000 1200" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${_hex(p.skyTop)}"/><stop offset="1" stop-color="${_hex(p.skyBottom)}"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${_hex(p.waterTop)}"/><stop offset="1" stop-color="${_hex(p.waterBottom)}"/></linearGradient>
<radialGradient id="sun"><stop stop-color="${_hex(p.sun)}" stop-opacity=".9"/><stop offset="1" stop-color="${_hex(p.sun)}" stop-opacity="0"/></radialGradient>
</defs>
<path fill="url(#sky)" d="M0 0h1000v1200H0z"/>
<circle cx="740" cy="420" r="240" fill="url(#sun)"/>
<circle cx="740" cy="420" r="49" fill="${_hex(p.sun)}" opacity=".7"/>
<g fill="white" opacity=".25"><path d="M35 297c55-44 111-19 134 4 22-41 81-39 105-4 43-8 73 8 77 24H35z"/><path d="M695 180c47-26 79-9 95 12 19-39 67-32 84-5 46-1 72 16 79 27H695z"/></g>
<path d="M0 688 130 487 228 589 383 426 581 648 710 495 865 649 1000 578v380H0z" fill="${_hex(p.mountainFar)}" opacity=".55"/>
<path d="m304 517 79-91 83 96-72-32-34 16-14-24zM84 558l46-71 55 74-42-29-13 6-8-17zM668 559l42-64 62 75-51-39-17 21-10-25z" fill="${_hex(p.snow)}" opacity=".55"/>
<path d="M0 713q122-96 246-20t227 53q105-105 227-23t300-29v263H0z" fill="${_hex(p.mountainNear)}" opacity=".57"/>
<path d="M0 854q180-35 334 3t322-8 344-6v357H0z" fill="url(#water)"/>
<g fill="none" stroke="${_hex(p.snow)}" stroke-width="2" opacity=".25"><path d="M360 914h164m74 29h193m-570 43h180m133 42h118m-42-127h67m-14 189h232"/></g>
<path d="M0 940q60-85 130-90t132 88l-74 262H0z" fill="${_hex(p.ground)}"/>
<path d="M1000 993q-134-128-286-22t-233 229h519z" fill="${_hex(p.ground)}" opacity=".83"/>
<g fill="${_hex(p.leaf)}" opacity=".85"><path d="M40 1070q-27-59-34-63 49 7 43 57 19-78 66-90-13 58-52 101z"/><path d="M950 1120q-2-82 40-118 10 57-27 109 21-28 50-28-8 38-56 46z"/></g>
<g fill="${_hex(p.flower)}"><circle cx="77" cy="1064" r="9"/><circle cx="89" cy="1064" r="9"/><circle cx="83" cy="1054" r="9"/><circle cx="83" cy="1073" r="9"/><circle cx="907" cy="1150" r="12"/><circle cx="923" cy="1150" r="12"/><circle cx="915" cy="1138" r="12"/><circle cx="915" cy="1162" r="12"/></g>
<g fill="${_hex(p.sun)}"><circle cx="83" cy="1064" r="6"/><circle cx="915" cy="1150" r="8"/></g>
<g fill="#fff5d9" opacity="${p.night ? 1 : 0}"><path d="m130 290 3 9 9 3-9 3-3 9-3-9-9-3 9-3zM876 350l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM576 204l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/><circle cx="330" cy="220" r="2.5"/><circle cx="708" cy="268" r="2.5"/><circle cx="427" cy="349" r="2"/><circle cx="70" cy="458" r="2"/></g>
</svg>''';
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: Stack(fit: StackFit.expand, children: [
          ColoredBox(color: palette.skyTop),
          SvgPicture.string(_svg(), fit: BoxFit.cover, alignment: Alignment.bottomCenter, excludeFromSemantics: true),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: palette.night && !palette.highContrast
                    ? const [Color(0x1A071022), Color(0x00071022)]
                    : const [Color(0x33FFFFFF), Color(0x00FFFFFF)],
                stops: palette.night ? const [0, 1] : const [0, 0.7],
              ),
            ),
          ),
        ]),
      );
}
