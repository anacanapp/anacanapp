// Ported from: app/tool/design/gen_tokens.mjs invariants (src/index.css, src/styles/anacan-design.css,
//              src/styles/onboarding.css)
import 'dart:io';

import 'package:anacan/design/design.dart';
import 'package:anacan/design/tokens/token_manifest.g.dart';
import 'package:flutter/animation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Independent count of `--name:` declarations (comments stripped), not using postcss.
int countCustomProperties(String css) {
  final noComments = css.replaceAll(RegExp(r'/\*[\s\S]*?\*/'), '');
  return RegExp(r'(?<![\w-])--[A-Za-z0-9_-]+\s*:').allMatches(noComments).length;
}

void main() {
  group('generator manifest', () {
    test('declarations found equals the custom properties in the CSS sources', () {
      var n = 0;
      for (final s in TokenManifest.sources) {
        n += countCustomProperties(File('../$s').readAsStringSync());
      }
      expect(TokenManifest.declarationsFound, n);
    });

    test('every declaration is mapped or reported', () {
      expect(TokenManifest.declarationsMapped + TokenManifest.declarationsUnmappedScope, TokenManifest.declarationsFound);
    });

    test('every distinct token is emitted or reported', () {
      expect(TokenManifest.emittedTokens + TokenManifest.unconvertedTokens, TokenManifest.uniqueTokens);
      final names = TokenManifest.namesByGroup.values.fold<int>(0, (a, l) => a + l.length);
      expect(names, TokenManifest.uniqueTokens);
    });

    test('generated files are up to date (node --check)', () async {
      final r = await Process.run('node', <String>['tool/design/gen_tokens.mjs', '--check'], workingDirectory: '.');
      expect(r.exitCode, 0, reason: '${r.stdout}\n${r.stderr}');
    }, skip: _nodeMissing());
  });

  group('light/dark parity', () {
    final pairs = <String, (Map<String, Object>, Map<String, Object>)>{
      'shadcn': (ShadcnTokens.light.byCssName, ShadcnTokens.dark.byCssName),
      'a': (ATokens.light.byCssName, ATokens.dark.byCssName),
      'navCapsule': (NavCapsuleTokens.light.byCssName, NavCapsuleTokens.dark.byCssName),
      'onboarding': (OnboardingTokens.light.byCssName, OnboardingTokens.dark.byCssName),
      'aRing': (ARingCssTokens.light.byCssName, ARingCssTokens.dark.byCssName),
    };
    for (final e in pairs.entries) {
      test('${e.key}: light and dark expose the same keys', () {
        expect(e.value.$1.keys.toSet(), e.value.$2.keys.toSet());
      });
      test('${e.key}: every manifest name is a key', () {
        expect(e.value.$1.keys.where((k) => !k.endsWith(':inset')).toSet(), TokenManifest.namesByGroup[e.key]!.toSet());
      });
    }
    test('noBlur / noBackdrop capsule variants only change --nav-glass', () {
      final base = NavCapsuleTokens.light.byCssName;
      final nb = NavCapsuleTokens.lightNoBlur.byCssName;
      final changed = base.keys.where((k) => base[k] != nb[k]).toList();
      expect(changed, <String>['--nav-glass']);
      expect(NavCapsuleTokens.darkNoBlur.glass, const Color(0xF51C1A1E));
      expect(NavCapsuleTokens.lightNoBackdrop.glass, const Color(0xF0FFFFFF));
    });
  });

  group('values', () {
    test('hex, rgba and hsl conversions', () {
      expect(ATokens.light.bg, const Color(0xFFFFE7E1));
      expect(ATokens.dark.bg, const Color(0xFF161922));
      expect(ATokens.light.line, const Color(0x14333333));
      // --primary: 358 100% 68%
      expect(ShadcnTokens.light.primary, const Color(0xFFFF5C61));
      expect(ShadcnTokens.light.radius, 16.0);
    });

    test('var() resolves per theme (dark overrides flow into light-only references)', () {
      // --nav-icon-on: var(--a-ink, #2e2a28) — light ink #333333
      expect(NavCapsuleTokens.light.iconOn, const Color(0xFF333333));
      // --a-grad-peach is overridden in dark by a flat colour.
      final g = ATokens.dark.gradPeach as CssLinearGradient;
      expect(g.isFlat, isTrue);
      expect(g.colors.first, const Color(0xFFFF5A5F));
    });

    test('gradient stops and angle', () {
      final g = ATokens.light.gradCta as CssLinearGradient;
      expect(g.angle, 130);
      expect(g.stops, <double>[0, 0.52, 1]);
      expect(g.colors, const <Color>[Color(0xFFFFE4E2), Color(0xFFFFB4B1), Color(0xFFFF8D89)]);
    });

    test('shadow blur converts to the same Gaussian sigma', () {
      final s = ATokens.light.cardShadow.single;
      expect(s.offset, const Offset(0, 14));
      expect(s.spreadRadius, -18);
      // CSS 30px blur → sigma 15.
      expect(s.blurSigma, closeTo(15, 0.01));
    });

    test('easings', () {
      expect(_abcd(ATokens.light.ease), <double>[0.22, 1, 0.36, 1]);
      expect(_abcd(ATokens.light.spring), <double>[0.32, 0.72, 0, 1]);
      expect(_abcd(ATokens.light.bounce), <double>[0.34, 1.56, 0.64, 1]);
    });

    test('tailwind radii and life stage palettes', () {
      expect(TwRadius.lg, 16);
      expect(TwRadius.md, 14);
      expect(TwRadius.sm, 12);
      expect(TwRadius.r2xl, 24);
      expect(TwRadius.r3xl, 32);
      expect(TwRadius.r4xl, 40);
      expect(ALifeStagePalettes.light.keys, <String>['flow', 'bump', 'mommy', 'partner']);
      expect(ALifeStagePalettes.dark['flow']!.base, ShadcnTokens.dark.flow);
    });

    test('a3-rise keyframes keep the implicit end frame', () {
      expect(CssKeyframes.a3Rise.first.translateY, 16);
      expect(CssKeyframes.a3Rise.last.implicit, isTrue);
      expect(TwAnimations.fadeIn.duration, const Duration(milliseconds: 400));
    });
  });

  group('CssLinearGradient geometry', () {
    test('135deg on a square runs corner to corner', () {
      const g = CssLinearGradient(angle: 135, colors: <Color>[Color(0xFF000000), Color(0xFFFFFFFF)]);
      final (a, b) = g.linePoints(const Rect.fromLTWH(0, 0, 100, 100));
      expect(a.dx, closeTo(0, 1e-9));
      expect(a.dy, closeTo(0, 1e-9));
      expect(b.dx, closeTo(100, 1e-9));
      expect(b.dy, closeTo(100, 1e-9));
    });

    test('180deg (to bottom) spans the height on a wide box', () {
      const g = CssLinearGradient(angle: 180, colors: <Color>[Color(0xFF000000), Color(0xFFFFFFFF)]);
      final (a, b) = g.linePoints(const Rect.fromLTWH(0, 0, 300, 50));
      expect(a.dx, closeTo(150, 1e-9));
      expect(a.dy, closeTo(0, 1e-9));
      expect(b.dy, closeTo(50, 1e-9));
    });

    test('45deg on a non-square box keeps the CSS gradient length', () {
      const g = CssLinearGradient(angle: 45, colors: <Color>[Color(0xFF000000), Color(0xFFFFFFFF)]);
      final (a, b) = g.linePoints(const Rect.fromLTWH(0, 0, 200, 100));
      // |w sin45| + |h cos45| = 300 * √2/2
      expect((b - a).distance, closeTo(300 * 0.70710678, 1e-6));
    });
  });
}

Object _nodeMissing() {
  try {
    return Process.runSync('node', <String>['--version']).exitCode == 0 ? false : 'node not installed';
  } on ProcessException {
    return 'node not installed';
  }
}

List<double> _abcd(Cubic c) => <double>[c.a, c.b, c.c, c.d];
