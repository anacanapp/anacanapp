<!-- GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs -->
# Token conversion report

- CSS custom-property declarations found: **277** (src/index.css, src/styles/anacan-design.css, src/styles/onboarding.css)
- Mapped to groups: 277; distinct tokens: 151; emitted Dart fields: 151
- Groups: ShadcnTokens (57 fields × light/dark); ATokens (78 fields × light/dark); ARingCssTokens (1 fields × light/dark); NavCapsuleTokens (9 fields × light/dark/lightNoBlur/darkNoBlur/lightNoBackdrop/darkNoBackdrop); OnboardingTokens (8 fields × light/dark)

## Not converted

| token / construct | where | value | reason |
|---|---|---|---|
| `@keyframes accordion-down height` | tailwind.config.ts | `0` | non-transform/opacity property kept as raw string |
| `@keyframes accordion-down height` | tailwind.config.ts | `var(--radix-accordion-content-height)` | non-transform/opacity property kept as raw string |
| `@keyframes accordion-up height` | tailwind.config.ts | `var(--radix-accordion-content-height)` | non-transform/opacity property kept as raw string |
| `@keyframes accordion-up height` | tailwind.config.ts | `0` | non-transform/opacity property kept as raw string |
| `@keyframes glow box-shadow` | tailwind.config.ts | `0 0 20px -5px hsl(var(--primary) / 0.3)` | non-transform/opacity property kept as raw string |
| `@keyframes glow box-shadow` | tailwind.config.ts | `0 0 40px -5px hsl(var(--primary) / 0.5)` | non-transform/opacity property kept as raw string |
| `@keyframes shimmer background-position` | tailwind.config.ts | `200% 0` | non-transform/opacity property kept as raw string |
| `@keyframes shimmer background-position` | tailwind.config.ts | `-200% 0` | non-transform/opacity property kept as raw string |
| `@keyframes shimmer background-position` | src/index.css:416 | `200% 0` | non-transform/opacity property kept as raw string |
| `@keyframes shimmer background-position` | src/index.css:416 | `-200% 0` | non-transform/opacity property kept as raw string |
| `@keyframes a3-draw stroke-dashoffset` | src/styles/anacan-design.css:2702 | `var(--c)` | non-transform/opacity property kept as raw string |
| `@keyframes a-par-shimmer background-position` | src/styles/anacan-design.css:3586 | `200% 0` | non-transform/opacity property kept as raw string |
| `@keyframes a-par-shimmer background-position` | src/styles/anacan-design.css:3586 | `-200% 0` | non-transform/opacity property kept as raw string |

## Conversion notes (converted with a caveat)

- --a-grad-peach (a, dark) is a flat colour `#FF5A5F` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-pink (a, dark) is a flat colour `#4a3038` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-lav (a, dark) is a flat colour `#3d3450` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-blue (a, dark) is a flat colour `#2e3d4d` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-green (a, dark) is a flat colour `#30443a` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-yellow (a, dark) is a flat colour `#4a4028` → emitted as a 2-stop CssLinearGradient of that colour
- --a-grad-cta (a, dark) is a flat colour `#FF5A5F` → emitted as a 2-stop CssLinearGradient of that colour
- --a-illus-grad (a, dark) is a flat colour `#4b4c53` → emitted as a 2-stop CssLinearGradient of that colour
- --a-alert-bg (a, dark) is a flat colour `#46333a` → emitted as a 2-stop CssLinearGradient of that colour
- --a-shadow (a) is a bare RGB triplet `217, 108, 74` (for rgba(var(), a)); emitted as an opaque Color
- --a-shadow (a) is a bare RGB triplet `0, 0, 0` (for rgba(var(), a)); emitted as an opaque Color
- --nav-glass-shadow (navCapsule) has inset shadow layers → emitted separately as `glassShadowInset` (Flutter BoxShadow has no inset; paint with AInsetShadow)
- --nav-bubble-shadow (navCapsule) has inset shadow layers → emitted separately as `bubbleShadowInset` (Flutter BoxShadow has no inset; paint with AInsetShadow)
- Shadows: CSS blur radius B is converted to Flutter `blurRadius` so both give Gaussian sigma B/2 ((B/2 − 0.5) / 0.57735).
- Gradients: `CssLinearGradient` reproduces the CSS gradient line (angle + box-dependent length); colour interpolation is Flutter's (non-premultiplied), CSS interpolates premultiplied — differs only for stops with alpha.

