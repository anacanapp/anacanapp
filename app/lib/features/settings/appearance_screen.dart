// Ported from: src/components/AppearanceScreen.tsx
//
// Theme mode (light / dark / system) with previews, current-look samples and the active-mode note.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'theme_mode_setting.dart';
import 'ui/settings_ui.dart';

class AppearanceScreen extends ConsumerWidget {
  const AppearanceScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final theme = ref.watch(themeModeSettingProvider);
    final system = ref.watch(systemBrightnessProvider) == Brightness.dark ? 'dark' : 'light';
    final current = theme == 'system' ? system : theme;
    // AppearanceScreen.tsx literal preview gradients / ink.
    final options = [
      (
        id: 'light',
        label: tr('appearancescreen_aciq_rejim_800daa', 'Açıq rejim'),
        desc: tr('appearancescreen_klassik_aciq_rengler_7c8359', 'Klassik açıq rənglər'),
        icon: AIcons.sun,
        preview: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: <Color>[Color(0xFFFFE7E1), Color(0xFFFFE4C4)]) as Gradient,
        ink: a.accentInk,
      ),
      (
        id: 'dark',
        label: tr('appearancescreen_qaranliq_rejim_ef2f9f', 'Qaranlıq rejim'),
        desc: tr('appearancescreen_gozlere_rahat_qaranliq_tema_4d59d5', 'Gözlərə rahat qaranlıq tema'),
        icon: AIcons.moon,
        preview: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: <Color>[Color(0xFF201512), Color(0xFF34241D)]) as Gradient,
        ink: const Color(0xFFFFC79E),
      ),
      (
        id: 'system',
        label: tr('appearancescreen_sistem_label', 'Sistem'),
        desc: tr('appearancescreen_cihazinizin_ayarina_uygun_9b4fa7', 'Cihazınızın ayarına uyğun'),
        icon: AIcons.monitor,
        preview: const LinearGradient(
          colors: <Color>[Color(0xFFFFE7E1), Color(0xFFFFE4C4), Color(0xFF201512), Color(0xFF34241D)],
          stops: <double>[0, 0.5, 0.5, 1],
        ) as Gradient,
        ink: a.accentInk,
      ),
    ];
    final info = theme == 'system'
        ? tr('appearancescreen_system_theme_in_use', 'Hal-hazırda sistem teması ({theme}) istifadə olunur.')
            .replaceAll('{theme}', current == 'dark' ? tr('appearancescreen_qaranliq_affa8e', 'qaranlıq') : tr('appearancescreen_aciq_79bf9c', 'açıq'))
        : tr('appearancescreen_theme_activated', '{theme} rejim aktiv edilib.')
            .replaceAll('{theme}', theme == 'dark' ? tr('appearancescreen_qaranliq_34c5e3', 'Qaranlıq') : tr('appearancescreen_aciq_306cc4', 'Açıq'));
    Widget sample(String text, {Color? bg, Gradient? grad, Border? border, required Color ink, FontWeight w = FontWeight.w600}) => Expanded(
          child: Container(
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, gradient: grad, borderRadius: BorderRadius.circular(14), border: border),
            child: Text(text, style: px(11, weight: w, color: ink)),
          ),
        );

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ATopbar(onBack: onBack, eyebrow: tr('appearancescreen_tema_ve_reng_secimleri_f46e36', 'Tema və rəng seçimləri'), title: tr('appearancescreen_gorunus_165fe3', 'Görünüş')),
            VGap(gap: 14, children: <Widget>[
              FadeRise(
                child: ACard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Row(children: <Widget>[
                        AIcon(AIcons.palette, size: 16, color: a.accentInk),
                        const SizedBox(width: 8),
                        Text(tr('appearancescreen_tema_secimi_73a672', 'Tema Seçimi'), style: context.aText.aCardTitle),
                      ]),
                    ),
                    VGap(gap: 10, children: <Widget>[
                      for (final o in options)
                        PressScale(
                          key: ValueKey<String>('theme-${o.id}'),
                          scale: 0.98,
                          onTap: () => ref.read(themeModeSettingProvider.notifier).set(o.id),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: theme == o.id ? a.peach1 : a.surfaceSoft,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: theme == o.id ? a.peach2 : const Color(0x00000000), width: 2),
                            ),
                            child: Row(children: <Widget>[
                              Container(
                                width: 56,
                                height: 56,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(gradient: o.preview, borderRadius: BorderRadius.circular(14)),
                                foregroundDecoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  // inset 0 2px 6px rgba(0,0,0,0.08)
                                  gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment(0, -0.6), colors: <Color>[Color(0x14000000), Color(0x00000000)]),
                                ),
                                child: AIcon(o.icon, size: 22, color: o.ink),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                  Text(o.label, style: px(14, weight: FontWeight.w700, color: theme == o.id ? a.accentInk : a.ink)),
                                  Padding(padding: const EdgeInsets.only(top: 1), child: Text(o.desc, style: px(11.5, color: a.inkSoft))),
                                ]),
                              ),
                              if (theme == o.id)
                                TweenAnimationBuilder<double>(
                                  tween: Tween<double>(begin: 0, end: 1),
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutBack,
                                  builder: (context, v, child) => Transform.scale(scale: v, child: child),
                                  child: Container(
                                    width: 32,
                                    height: 32,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle),
                                    child: const AIcon(AIcons.check, size: 16, strokeWidth: 3, color: Color(0xFFFFFFFF)),
                                  ),
                                ),
                            ]),
                          ),
                        ),
                    ]),
                  ]),
                ),
              ),
              FadeRise(
                delay: const Duration(milliseconds: 100),
                child: ACard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(padding: const EdgeInsets.only(bottom: 14), child: Text(tr('appearancescreen_cari_gorunus_aeba05', 'Cari Görünüş'), style: context.aText.aCardTitle)),
                    VGap(gap: 12, children: <Widget>[
                      Row(children: <Widget>[
                        sample(tr('appearancescreen_fon', 'Fon'), bg: a.bg, border: Border.all(color: a.lineStrong), ink: a.onBgSoft),
                        const SizedBox(width: 8),
                        sample(tr('appearancescreen_seth', 'Səth'), bg: a.surfaceSoft, ink: a.inkSoft),
                        const SizedBox(width: 8),
                        sample(tr('appearancescreen_vurgu', 'Vurğu'), bg: a.peach2, ink: const Color(0xFFFFFFFF), w: FontWeight.w700),
                      ]),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                        child: Row(children: <Widget>[
                          Container(
                            width: 40,
                            height: 40,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
                            child: AIcon(AIcons.sun, size: 18, color: a.accentInk),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                              Text(tr('appearancescreen_numune_kart_1dac7f', 'Nümunə kart'), style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                              Text(tr('appearancescreen_bu_cari_temanizin_gorunusudur_2e30a3', 'Bu cari temanızın görünüşüdür'), style: px(11, color: a.inkSoft)),
                            ]),
                          ),
                        ]),
                      ),
                    ]),
                  ]),
                ),
              ),
              FadeRise(delay: const Duration(milliseconds: 200), child: ADisclaimerBox(child: Text(info, key: const ValueKey<String>('theme-info')))),
            ]),
          ]),
        ),
      ),
    );
  }
}
