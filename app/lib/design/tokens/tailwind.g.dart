// GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names

import 'package:flutter/animation.dart';
import 'package:flutter/painting.dart';

import 'css_types.dart';

/// Tailwind `rounded-*` radii (defaultTheme merged with tailwind.config.ts extend; px).
abstract final class TwRadius {
  /// `rounded-none` = `0px`
  static const double none = 0.0;
  /// `rounded-sm` = `calc(var(--radius) - 4px)`
  static const double sm = 12.0;
  /// `rounded` = `0.25rem`
  static const double base = 4.0;
  /// `rounded-md` = `calc(var(--radius) - 2px)`
  static const double md = 14.0;
  /// `rounded-lg` = `var(--radius)`
  static const double lg = 16.0;
  /// `rounded-xl` = `0.75rem`
  static const double xl = 12.0;
  /// `rounded-2xl` = `1.5rem`
  static const double r2xl = 24.0;
  /// `rounded-3xl` = `2rem`
  static const double r3xl = 32.0;
  /// `rounded-full` = `9999px`
  static const double full = 9999.0;
  /// `rounded-4xl` = `2.5rem`
  static const double r4xl = 40.0;
}

/// Tailwind `text-*` sizes: font size and line height, both in logical px (1 CSS px = 1 dp).
abstract final class TwFontSize {
  /// `text-xs`: 0.75rem / line-height 1rem
  static const TwTextSize xs = TwTextSize(12.0, 16.0);
  /// `text-sm`: 0.875rem / line-height 1.25rem
  static const TwTextSize sm = TwTextSize(14.0, 20.0);
  /// `text-base`: 1rem / line-height 1.5rem
  static const TwTextSize base = TwTextSize(16.0, 24.0);
  /// `text-lg`: 1.125rem / line-height 1.75rem
  static const TwTextSize lg = TwTextSize(18.0, 28.0);
  /// `text-xl`: 1.25rem / line-height 1.75rem
  static const TwTextSize xl = TwTextSize(20.0, 28.0);
  /// `text-2xl`: 1.5rem / line-height 2rem
  static const TwTextSize t2xl = TwTextSize(24.0, 32.0);
  /// `text-3xl`: 1.875rem / line-height 2.25rem
  static const TwTextSize t3xl = TwTextSize(30.0, 36.0);
  /// `text-4xl`: 2.25rem / line-height 2.5rem
  static const TwTextSize t4xl = TwTextSize(36.0, 40.0);
  /// `text-5xl`: 3rem / line-height 1
  static const TwTextSize t5xl = TwTextSize(48.0, 48.0);
  /// `text-6xl`: 3.75rem / line-height 1
  static const TwTextSize t6xl = TwTextSize(60.0, 60.0);
  /// `text-7xl`: 4.5rem / line-height 1
  static const TwTextSize t7xl = TwTextSize(72.0, 72.0);
  /// `text-8xl`: 6rem / line-height 1
  static const TwTextSize t8xl = TwTextSize(96.0, 96.0);
  /// `text-9xl`: 8rem / line-height 1
  static const TwTextSize t9xl = TwTextSize(128.0, 128.0);
}

/// Tailwind `font-*` weights.
abstract final class TwFontWeight {
  static const FontWeight thin = FontWeight.w100;
  static const FontWeight extralight = FontWeight.w200;
  static const FontWeight light = FontWeight.w300;
  static const FontWeight normal = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;
  static const FontWeight extrabold = FontWeight.w800;
  static const FontWeight black = FontWeight.w900;
}

/// Font stacks: tailwind.config.ts fontFamily + the CSS scopes (bundled families first).
abstract final class TwFontFamily {
  /// `font-nunito`: Nunito, system-ui, sans-serif
  static const List<String> nunito = <String>['Nunito', 'system-ui', 'sans-serif'];
  /// `font-arabic`: Noto Sans Arabic, Inter, Nunito, ui-sans-serif, system-ui, sans-serif
  static const List<String> arabic = <String>['Noto Sans Arabic', 'Inter', 'Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'];
}

/// Tailwind v3 default palette (consumer code uses e.g. `text-gray-600`, `bg-rose-50`).
abstract final class TwColors {
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);
  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate950 = Color(0xFF020617);
  static const Color gray50 = Color(0xFFF9FAFB);
  static const Color gray100 = Color(0xFFF3F4F6);
  static const Color gray200 = Color(0xFFE5E7EB);
  static const Color gray300 = Color(0xFFD1D5DB);
  static const Color gray400 = Color(0xFF9CA3AF);
  static const Color gray500 = Color(0xFF6B7280);
  static const Color gray600 = Color(0xFF4B5563);
  static const Color gray700 = Color(0xFF374151);
  static const Color gray800 = Color(0xFF1F2937);
  static const Color gray900 = Color(0xFF111827);
  static const Color gray950 = Color(0xFF030712);
  static const Color zinc50 = Color(0xFFFAFAFA);
  static const Color zinc100 = Color(0xFFF4F4F5);
  static const Color zinc200 = Color(0xFFE4E4E7);
  static const Color zinc300 = Color(0xFFD4D4D8);
  static const Color zinc400 = Color(0xFFA1A1AA);
  static const Color zinc500 = Color(0xFF71717A);
  static const Color zinc600 = Color(0xFF52525B);
  static const Color zinc700 = Color(0xFF3F3F46);
  static const Color zinc800 = Color(0xFF27272A);
  static const Color zinc900 = Color(0xFF18181B);
  static const Color zinc950 = Color(0xFF09090B);
  static const Color neutral50 = Color(0xFFFAFAFA);
  static const Color neutral100 = Color(0xFFF5F5F5);
  static const Color neutral200 = Color(0xFFE5E5E5);
  static const Color neutral300 = Color(0xFFD4D4D4);
  static const Color neutral400 = Color(0xFFA3A3A3);
  static const Color neutral500 = Color(0xFF737373);
  static const Color neutral600 = Color(0xFF525252);
  static const Color neutral700 = Color(0xFF404040);
  static const Color neutral800 = Color(0xFF262626);
  static const Color neutral900 = Color(0xFF171717);
  static const Color neutral950 = Color(0xFF0A0A0A);
  static const Color stone50 = Color(0xFFFAFAF9);
  static const Color stone100 = Color(0xFFF5F5F4);
  static const Color stone200 = Color(0xFFE7E5E4);
  static const Color stone300 = Color(0xFFD6D3D1);
  static const Color stone400 = Color(0xFFA8A29E);
  static const Color stone500 = Color(0xFF78716C);
  static const Color stone600 = Color(0xFF57534E);
  static const Color stone700 = Color(0xFF44403C);
  static const Color stone800 = Color(0xFF292524);
  static const Color stone900 = Color(0xFF1C1917);
  static const Color stone950 = Color(0xFF0C0A09);
  static const Color red50 = Color(0xFFFEF2F2);
  static const Color red100 = Color(0xFFFEE2E2);
  static const Color red200 = Color(0xFFFECACA);
  static const Color red300 = Color(0xFFFCA5A5);
  static const Color red400 = Color(0xFFF87171);
  static const Color red500 = Color(0xFFEF4444);
  static const Color red600 = Color(0xFFDC2626);
  static const Color red700 = Color(0xFFB91C1C);
  static const Color red800 = Color(0xFF991B1B);
  static const Color red900 = Color(0xFF7F1D1D);
  static const Color red950 = Color(0xFF450A0A);
  static const Color orange50 = Color(0xFFFFF7ED);
  static const Color orange100 = Color(0xFFFFEDD5);
  static const Color orange200 = Color(0xFFFED7AA);
  static const Color orange300 = Color(0xFFFDBA74);
  static const Color orange400 = Color(0xFFFB923C);
  static const Color orange500 = Color(0xFFF97316);
  static const Color orange600 = Color(0xFFEA580C);
  static const Color orange700 = Color(0xFFC2410C);
  static const Color orange800 = Color(0xFF9A3412);
  static const Color orange900 = Color(0xFF7C2D12);
  static const Color orange950 = Color(0xFF431407);
  static const Color amber50 = Color(0xFFFFFBEB);
  static const Color amber100 = Color(0xFFFEF3C7);
  static const Color amber200 = Color(0xFFFDE68A);
  static const Color amber300 = Color(0xFFFCD34D);
  static const Color amber400 = Color(0xFFFBBF24);
  static const Color amber500 = Color(0xFFF59E0B);
  static const Color amber600 = Color(0xFFD97706);
  static const Color amber700 = Color(0xFFB45309);
  static const Color amber800 = Color(0xFF92400E);
  static const Color amber900 = Color(0xFF78350F);
  static const Color amber950 = Color(0xFF451A03);
  static const Color yellow50 = Color(0xFFFEFCE8);
  static const Color yellow100 = Color(0xFFFEF9C3);
  static const Color yellow200 = Color(0xFFFEF08A);
  static const Color yellow300 = Color(0xFFFDE047);
  static const Color yellow400 = Color(0xFFFACC15);
  static const Color yellow500 = Color(0xFFEAB308);
  static const Color yellow600 = Color(0xFFCA8A04);
  static const Color yellow700 = Color(0xFFA16207);
  static const Color yellow800 = Color(0xFF854D0E);
  static const Color yellow900 = Color(0xFF713F12);
  static const Color yellow950 = Color(0xFF422006);
  static const Color lime50 = Color(0xFFF7FEE7);
  static const Color lime100 = Color(0xFFECFCCB);
  static const Color lime200 = Color(0xFFD9F99D);
  static const Color lime300 = Color(0xFFBEF264);
  static const Color lime400 = Color(0xFFA3E635);
  static const Color lime500 = Color(0xFF84CC16);
  static const Color lime600 = Color(0xFF65A30D);
  static const Color lime700 = Color(0xFF4D7C0F);
  static const Color lime800 = Color(0xFF3F6212);
  static const Color lime900 = Color(0xFF365314);
  static const Color lime950 = Color(0xFF1A2E05);
  static const Color green50 = Color(0xFFF0FDF4);
  static const Color green100 = Color(0xFFDCFCE7);
  static const Color green200 = Color(0xFFBBF7D0);
  static const Color green300 = Color(0xFF86EFAC);
  static const Color green400 = Color(0xFF4ADE80);
  static const Color green500 = Color(0xFF22C55E);
  static const Color green600 = Color(0xFF16A34A);
  static const Color green700 = Color(0xFF15803D);
  static const Color green800 = Color(0xFF166534);
  static const Color green900 = Color(0xFF14532D);
  static const Color green950 = Color(0xFF052E16);
  static const Color emerald50 = Color(0xFFECFDF5);
  static const Color emerald100 = Color(0xFFD1FAE5);
  static const Color emerald200 = Color(0xFFA7F3D0);
  static const Color emerald300 = Color(0xFF6EE7B7);
  static const Color emerald400 = Color(0xFF34D399);
  static const Color emerald500 = Color(0xFF10B981);
  static const Color emerald600 = Color(0xFF059669);
  static const Color emerald700 = Color(0xFF047857);
  static const Color emerald800 = Color(0xFF065F46);
  static const Color emerald900 = Color(0xFF064E3B);
  static const Color emerald950 = Color(0xFF022C22);
  static const Color teal50 = Color(0xFFF0FDFA);
  static const Color teal100 = Color(0xFFCCFBF1);
  static const Color teal200 = Color(0xFF99F6E4);
  static const Color teal300 = Color(0xFF5EEAD4);
  static const Color teal400 = Color(0xFF2DD4BF);
  static const Color teal500 = Color(0xFF14B8A6);
  static const Color teal600 = Color(0xFF0D9488);
  static const Color teal700 = Color(0xFF0F766E);
  static const Color teal800 = Color(0xFF115E59);
  static const Color teal900 = Color(0xFF134E4A);
  static const Color teal950 = Color(0xFF042F2E);
  static const Color cyan50 = Color(0xFFECFEFF);
  static const Color cyan100 = Color(0xFFCFFAFE);
  static const Color cyan200 = Color(0xFFA5F3FC);
  static const Color cyan300 = Color(0xFF67E8F9);
  static const Color cyan400 = Color(0xFF22D3EE);
  static const Color cyan500 = Color(0xFF06B6D4);
  static const Color cyan600 = Color(0xFF0891B2);
  static const Color cyan700 = Color(0xFF0E7490);
  static const Color cyan800 = Color(0xFF155E75);
  static const Color cyan900 = Color(0xFF164E63);
  static const Color cyan950 = Color(0xFF083344);
  static const Color sky50 = Color(0xFFF0F9FF);
  static const Color sky100 = Color(0xFFE0F2FE);
  static const Color sky200 = Color(0xFFBAE6FD);
  static const Color sky300 = Color(0xFF7DD3FC);
  static const Color sky400 = Color(0xFF38BDF8);
  static const Color sky500 = Color(0xFF0EA5E9);
  static const Color sky600 = Color(0xFF0284C7);
  static const Color sky700 = Color(0xFF0369A1);
  static const Color sky800 = Color(0xFF075985);
  static const Color sky900 = Color(0xFF0C4A6E);
  static const Color sky950 = Color(0xFF082F49);
  static const Color blue50 = Color(0xFFEFF6FF);
  static const Color blue100 = Color(0xFFDBEAFE);
  static const Color blue200 = Color(0xFFBFDBFE);
  static const Color blue300 = Color(0xFF93C5FD);
  static const Color blue400 = Color(0xFF60A5FA);
  static const Color blue500 = Color(0xFF3B82F6);
  static const Color blue600 = Color(0xFF2563EB);
  static const Color blue700 = Color(0xFF1D4ED8);
  static const Color blue800 = Color(0xFF1E40AF);
  static const Color blue900 = Color(0xFF1E3A8A);
  static const Color blue950 = Color(0xFF172554);
  static const Color indigo50 = Color(0xFFEEF2FF);
  static const Color indigo100 = Color(0xFFE0E7FF);
  static const Color indigo200 = Color(0xFFC7D2FE);
  static const Color indigo300 = Color(0xFFA5B4FC);
  static const Color indigo400 = Color(0xFF818CF8);
  static const Color indigo500 = Color(0xFF6366F1);
  static const Color indigo600 = Color(0xFF4F46E5);
  static const Color indigo700 = Color(0xFF4338CA);
  static const Color indigo800 = Color(0xFF3730A3);
  static const Color indigo900 = Color(0xFF312E81);
  static const Color indigo950 = Color(0xFF1E1B4B);
  static const Color violet50 = Color(0xFFF5F3FF);
  static const Color violet100 = Color(0xFFEDE9FE);
  static const Color violet200 = Color(0xFFDDD6FE);
  static const Color violet300 = Color(0xFFC4B5FD);
  static const Color violet400 = Color(0xFFA78BFA);
  static const Color violet500 = Color(0xFF8B5CF6);
  static const Color violet600 = Color(0xFF7C3AED);
  static const Color violet700 = Color(0xFF6D28D9);
  static const Color violet800 = Color(0xFF5B21B6);
  static const Color violet900 = Color(0xFF4C1D95);
  static const Color violet950 = Color(0xFF2E1065);
  static const Color purple50 = Color(0xFFFAF5FF);
  static const Color purple100 = Color(0xFFF3E8FF);
  static const Color purple200 = Color(0xFFE9D5FF);
  static const Color purple300 = Color(0xFFD8B4FE);
  static const Color purple400 = Color(0xFFC084FC);
  static const Color purple500 = Color(0xFFA855F7);
  static const Color purple600 = Color(0xFF9333EA);
  static const Color purple700 = Color(0xFF7E22CE);
  static const Color purple800 = Color(0xFF6B21A8);
  static const Color purple900 = Color(0xFF581C87);
  static const Color purple950 = Color(0xFF3B0764);
  static const Color fuchsia50 = Color(0xFFFDF4FF);
  static const Color fuchsia100 = Color(0xFFFAE8FF);
  static const Color fuchsia200 = Color(0xFFF5D0FE);
  static const Color fuchsia300 = Color(0xFFF0ABFC);
  static const Color fuchsia400 = Color(0xFFE879F9);
  static const Color fuchsia500 = Color(0xFFD946EF);
  static const Color fuchsia600 = Color(0xFFC026D3);
  static const Color fuchsia700 = Color(0xFFA21CAF);
  static const Color fuchsia800 = Color(0xFF86198F);
  static const Color fuchsia900 = Color(0xFF701A75);
  static const Color fuchsia950 = Color(0xFF4A044E);
  static const Color pink50 = Color(0xFFFDF2F8);
  static const Color pink100 = Color(0xFFFCE7F3);
  static const Color pink200 = Color(0xFFFBCFE8);
  static const Color pink300 = Color(0xFFF9A8D4);
  static const Color pink400 = Color(0xFFF472B6);
  static const Color pink500 = Color(0xFFEC4899);
  static const Color pink600 = Color(0xFFDB2777);
  static const Color pink700 = Color(0xFFBE185D);
  static const Color pink800 = Color(0xFF9D174D);
  static const Color pink900 = Color(0xFF831843);
  static const Color pink950 = Color(0xFF500724);
  static const Color rose50 = Color(0xFFFFF1F2);
  static const Color rose100 = Color(0xFFFFE4E6);
  static const Color rose200 = Color(0xFFFECDD3);
  static const Color rose300 = Color(0xFFFDA4AF);
  static const Color rose400 = Color(0xFFFB7185);
  static const Color rose500 = Color(0xFFF43F5E);
  static const Color rose600 = Color(0xFFE11D48);
  static const Color rose700 = Color(0xFFBE123C);
  static const Color rose800 = Color(0xFF9F1239);
  static const Color rose900 = Color(0xFF881337);
  static const Color rose950 = Color(0xFF4C0519);
}

/// Tailwind `animate-*` (tailwind.config.ts extend.keyframes + extend.animation).
abstract final class TwAnimations {
  /// `animate-accordion-down`: `accordion-down 0.2s ease-out`
  static const CssAnimationSpec accordionDown = CssAnimationSpec(name: 'accordion-down', duration: Duration(milliseconds: 200), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'height': '0'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'height': 'var(--radix-accordion-content-height)'}),
  ]);
  /// `animate-accordion-up`: `accordion-up 0.2s ease-out`
  static const CssAnimationSpec accordionUp = CssAnimationSpec(name: 'accordion-up', duration: Duration(milliseconds: 200), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'height': 'var(--radix-accordion-content-height)'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'height': '0'}),
  ]);
  /// `animate-fade-in`: `fade-in 0.4s ease-out`
  static const CssAnimationSpec fadeIn = CssAnimationSpec(name: 'fade-in', duration: Duration(milliseconds: 400), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.0, translateY: 10.0),
    CssKeyframe(offset: 1.0, opacity: 1.0, translateY: 0.0),
  ]);
  /// `animate-fade-in-up`: `fade-in-up 0.6s ease-out`
  static const CssAnimationSpec fadeInUp = CssAnimationSpec(name: 'fade-in-up', duration: Duration(milliseconds: 600), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.0, translateY: 30.0),
    CssKeyframe(offset: 1.0, opacity: 1.0, translateY: 0.0),
  ]);
  /// `animate-fade-in-down`: `fade-in-down 0.5s ease-out`
  static const CssAnimationSpec fadeInDown = CssAnimationSpec(name: 'fade-in-down', duration: Duration(milliseconds: 500), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.0, translateY: -20.0),
    CssKeyframe(offset: 1.0, opacity: 1.0, translateY: 0.0),
  ]);
  /// `animate-scale-in`: `scale-in 0.3s ease-out`
  static const CssAnimationSpec scaleIn = CssAnimationSpec(name: 'scale-in', duration: Duration(milliseconds: 300), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.0, scale: 0.9),
    CssKeyframe(offset: 1.0, opacity: 1.0, scale: 1.0),
  ]);
  /// `animate-scale-bounce`: `scale-bounce 0.5s ease-out`
  static const CssAnimationSpec scaleBounce = CssAnimationSpec(name: 'scale-bounce', duration: Duration(milliseconds: 500), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, scale: 0.0),
    CssKeyframe(offset: 0.5, scale: 1.1),
    CssKeyframe(offset: 1.0, scale: 1.0),
  ]);
  /// `animate-slide-in-bottom`: `slide-in-bottom 0.4s ease-out`
  static const CssAnimationSpec slideInBottom = CssAnimationSpec(name: 'slide-in-bottom', duration: Duration(milliseconds: 400), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 100.0, translateIsPercent: true),
    CssKeyframe(offset: 1.0, translateY: 0.0),
  ]);
  /// `animate-slide-in-right`: `slide-in-right 0.4s ease-out`
  static const CssAnimationSpec slideInRight = CssAnimationSpec(name: 'slide-in-right', duration: Duration(milliseconds: 400), curve: Cubic(0.0, 0.0, 0.58, 1.0), infinite: false, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateX: 100.0, translateIsPercent: true),
    CssKeyframe(offset: 1.0, translateX: 0.0),
  ]);
  /// `animate-pulse-soft`: `pulse-soft 2s ease-in-out infinite`
  static const CssAnimationSpec pulseSoft = CssAnimationSpec(name: 'pulse-soft', duration: Duration(milliseconds: 2000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 1.0),
    CssKeyframe(offset: 0.5, opacity: 0.6),
    CssKeyframe(offset: 1.0, opacity: 1.0),
  ]);
  /// `animate-pulse-scale`: `pulse-scale 2s ease-in-out infinite`
  static const CssAnimationSpec pulseScale = CssAnimationSpec(name: 'pulse-scale', duration: Duration(milliseconds: 2000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, scale: 1.0),
    CssKeyframe(offset: 0.5, scale: 1.05),
    CssKeyframe(offset: 1.0, scale: 1.0),
  ]);
  /// `animate-float`: `float 4s ease-in-out infinite`
  static const CssAnimationSpec float = CssAnimationSpec(name: 'float', duration: Duration(milliseconds: 4000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 0.0),
    CssKeyframe(offset: 0.5, translateY: -15.0),
    CssKeyframe(offset: 1.0, translateY: 0.0),
  ]);
  /// `animate-float-delayed`: `float-delayed 5s ease-in-out infinite`
  static const CssAnimationSpec floatDelayed = CssAnimationSpec(name: 'float-delayed', duration: Duration(milliseconds: 5000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 0.0, rotateDeg: 0.0),
    CssKeyframe(offset: 0.25, translateY: -10.0, rotateDeg: 2.0),
    CssKeyframe(offset: 0.75, translateY: -5.0, rotateDeg: -2.0),
    CssKeyframe(offset: 1.0, translateY: 0.0, rotateDeg: 0.0),
  ]);
  /// `animate-spin-slow`: `spin-slow 12s linear infinite`
  static const CssAnimationSpec spinSlow = CssAnimationSpec(name: 'spin-slow', duration: Duration(milliseconds: 12000), curve: Cubic(0.0, 0.0, 1.0, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, rotateDeg: 0.0),
    CssKeyframe(offset: 1.0, rotateDeg: 360.0),
  ]);
  /// `animate-wiggle`: `wiggle 1s ease-in-out infinite`
  static const CssAnimationSpec wiggle = CssAnimationSpec(name: 'wiggle', duration: Duration(milliseconds: 1000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, rotateDeg: -3.0),
    CssKeyframe(offset: 0.5, rotateDeg: 3.0),
    CssKeyframe(offset: 1.0, rotateDeg: -3.0),
  ]);
  /// `animate-bounce-soft`: `bounce-soft 2s ease-in-out infinite`
  static const CssAnimationSpec bounceSoft = CssAnimationSpec(name: 'bounce-soft', duration: Duration(milliseconds: 2000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 0.0),
    CssKeyframe(offset: 0.5, translateY: -8.0),
    CssKeyframe(offset: 1.0, translateY: 0.0),
  ]);
  /// `animate-glow`: `glow 2s ease-in-out infinite`
  static const CssAnimationSpec glow = CssAnimationSpec(name: 'glow', duration: Duration(milliseconds: 2000), curve: Cubic(0.42, 0.0, 0.58, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'box-shadow': '0 0 20px -5px hsl(var(--primary) / 0.3)'}),
    CssKeyframe(offset: 0.5, raw: <String, String>{'box-shadow': '0 0 40px -5px hsl(var(--primary) / 0.5)'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'box-shadow': '0 0 20px -5px hsl(var(--primary) / 0.3)'}),
  ]);
  /// `animate-shimmer`: `shimmer 2s linear infinite`
  static const CssAnimationSpec shimmer = CssAnimationSpec(name: 'shimmer', duration: Duration(milliseconds: 2000), curve: Cubic(0.0, 0.0, 1.0, 1.0), infinite: true, frames: <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'background-position': '200% 0'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'background-position': '-200% 0'}),
  ]);
  static const Map<String, CssAnimationSpec> byName = <String, CssAnimationSpec>{'accordion-down': accordionDown, 'accordion-up': accordionUp, 'fade-in': fadeIn, 'fade-in-up': fadeInUp, 'fade-in-down': fadeInDown, 'scale-in': scaleIn, 'scale-bounce': scaleBounce, 'slide-in-bottom': slideInBottom, 'slide-in-right': slideInRight, 'pulse-soft': pulseSoft, 'pulse-scale': pulseScale, 'float': float, 'float-delayed': floatDelayed, 'spin-slow': spinSlow, 'wiggle': wiggle, 'bounce-soft': bounceSoft, 'glow': glow, 'shimmer': shimmer};
}

/// `@keyframes` declared in the CSS sources (frames only; duration/easing live on the rule using them).
abstract final class CssKeyframes {
  /// `@keyframes shimmer` — src/index.css:416
  static const List<CssKeyframe> shimmer = <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'background-position': '200% 0'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'background-position': '-200% 0'}),
  ];
  /// `@keyframes skeleton-pulse` — src/index.css:422
  static const List<CssKeyframe> skeletonPulse = <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 1.0),
    CssKeyframe(offset: 0.5, opacity: 0.5),
    CssKeyframe(offset: 1.0, opacity: 1.0),
  ];
  /// `@keyframes pulse-ring` — src/index.css:536
  static const List<CssKeyframe> pulseRing = <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.5, scale: 0.95),
    CssKeyframe(offset: 1.0, opacity: 0.0, scale: 1.1),
  ];
  /// `@keyframes a-cloud-drift` — src/styles/anacan-design.css:248
  static const List<CssKeyframe> aCloudDrift = <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateX: 0.0, translateY: 0.0),
    CssKeyframe(offset: 0.5, translateX: 16.0, translateY: -7.0),
    CssKeyframe(offset: 1.0, translateX: 0.0, translateY: 0.0),
  ];
  /// `@keyframes a-fade-in` — src/styles/anacan-design.css:2484
  static const List<CssKeyframe> aFadeIn = <CssKeyframe>[
    CssKeyframe(offset: 0.0, opacity: 0.0, translateY: 10.0),
    CssKeyframe(offset: 1.0, opacity: 1.0, translateY: 0.0),
  ];
  /// `@keyframes a-float` — src/styles/anacan-design.css:2528
  static const List<CssKeyframe> aFloat = <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 0.0),
    CssKeyframe(offset: 0.5, translateY: -4.0),
    CssKeyframe(offset: 1.0, translateY: 0.0),
  ];
  /// `@keyframes a3-drift` — src/styles/anacan-design.css:2668
  static const List<CssKeyframe> a3Drift = <CssKeyframe>[
    CssKeyframe(offset: 0.0, implicit: true),
    CssKeyframe(offset: 1.0, translateX: 6.0, translateY: 4.0, translateIsPercent: true, rotateDeg: 8.0),
  ];
  /// `@keyframes a3-bob` — src/styles/anacan-design.css:2678
  static const List<CssKeyframe> a3Bob = <CssKeyframe>[
    CssKeyframe(offset: 0.0, implicit: true),
    CssKeyframe(offset: 0.5, translateY: -6.0, rotateDeg: -1.5),
    CssKeyframe(offset: 1.0, implicit: true),
  ];
  /// `@keyframes a3-draw` — src/styles/anacan-design.css:2702
  static const List<CssKeyframe> a3Draw = <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'stroke-dashoffset': 'var(--c)'}),
    CssKeyframe(offset: 1.0, implicit: true),
  ];
  /// `@keyframes a3-pop` — src/styles/anacan-design.css:2715
  static const List<CssKeyframe> a3Pop = <CssKeyframe>[
    CssKeyframe(offset: 0.0, implicit: true),
    CssKeyframe(offset: 0.4, scale: 1.18),
    CssKeyframe(offset: 1.0, implicit: true),
  ];
  /// `@keyframes a3-float-up` — src/styles/anacan-design.css:2719
  static const List<CssKeyframe> a3FloatUp = <CssKeyframe>[
    CssKeyframe(offset: 0.0, implicit: true),
    CssKeyframe(offset: 1.0, opacity: 0.0, translateY: -34.0),
  ];
  /// `@keyframes a3-rise` — src/styles/anacan-design.css:2786
  static const List<CssKeyframe> a3Rise = <CssKeyframe>[
    CssKeyframe(offset: 0.0, translateY: 16.0),
    CssKeyframe(offset: 1.0, implicit: true),
  ];
  /// `@keyframes a-par-shimmer` — src/styles/anacan-design.css:3586
  static const List<CssKeyframe> aParShimmer = <CssKeyframe>[
    CssKeyframe(offset: 0.0, raw: <String, String>{'background-position': '200% 0'}),
    CssKeyframe(offset: 1.0, raw: <String, String>{'background-position': '-200% 0'}),
  ];
  /// `@keyframes onb-spin` — src/styles/onboarding.css:134
  static const List<CssKeyframe> onbSpin = <CssKeyframe>[
    CssKeyframe(offset: 0.0, implicit: true),
    CssKeyframe(offset: 1.0, rotateDeg: 360.0),
  ];
}
