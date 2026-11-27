// Ported from: src/components/WidgetSettingsScreen.tsx, src/lib/home-widgets.ts (settings persistence),
//              src/styles/care.css (.cx-page, .cx-wrap, .cx-head, .cx-card, .cx-seg, .cx-section, .cx-list, .cx-li,
//              .cx-icon, .cx-pill, .cx-warn)
//
// Home-screen widget settings + static live preview. Settings persist under `anacan.widgets.settings.v1`; the
// native widget refresh (`anacan-widgets-changed` event) goes through [HomeWidgetsSync].
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../../state/state.dart';
import '../profile/profile_interfaces.dart';
import 'copy/feature_copy.dart';
import 'ui/settings_ui.dart';

const String kWidgetSettingsKey = 'anacan.widgets.settings.v1';

class WidgetSettings {
  const WidgetSettings({this.showFeed = true, this.showNap = true, this.showActions = true, this.privacy = false});
  final bool showFeed;
  final bool showNap;
  final bool showActions;
  final bool privacy;
  Map<String, bool> toJson() => {'showFeed': showFeed, 'showNap': showNap, 'showActions': showActions, 'privacy': privacy};
  WidgetSettings withValue(String key, bool v) => WidgetSettings.fromJson({...toJson(), key: v});
  factory WidgetSettings.fromJson(Map<dynamic, dynamic> m) => WidgetSettings(
        showFeed: m['showFeed'] is bool ? m['showFeed'] as bool : true,
        showNap: m['showNap'] is bool ? m['showNap'] as bool : true,
        showActions: m['showActions'] is bool ? m['showActions'] as bool : true,
        privacy: m['privacy'] is bool ? m['privacy'] as bool : false,
      );
  bool operator [](String key) => toJson()[key] ?? false;
}

/// `readWidgetSettings()`.
WidgetSettings readWidgetSettings(LocalStore store) {
  final raw = store.readJson(kWidgetSettingsKey);
  return raw is Map ? WidgetSettings.fromJson(raw) : const WidgetSettings();
}

/// `saveWidgetSettings(s)`.
void saveWidgetSettings(LocalStore store, WidgetSettings s) => store.setItem(kWidgetSettingsKey, jsonEncode(s.toJson()));

/// `window.dispatchEvent(new Event('anacan-widgets-changed'))` → native widget refresh (home-widgets feature).
abstract interface class HomeWidgetsSync {
  void changed();
}

class NoopHomeWidgetsSync implements HomeWidgetsSync {
  const NoopHomeWidgetsSync();
  @override
  void changed() {}
}

final homeWidgetsSyncProvider = Provider<HomeWidgetsSync>((ref) => const NoopHomeWidgetsSync());

/// `Capacitor.getPlatform()`.
final widgetPlatformProvider = Provider<String>((ref) => switch (defaultTargetPlatform) {
      TargetPlatform.iOS => 'ios',
      TargetPlatform.android => 'android',
      _ => 'web',
    });

class WidgetSettingsScreen extends ConsumerStatefulWidget {
  const WidgetSettingsScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<WidgetSettingsScreen> createState() => _WidgetSettingsScreenState();
}

class _WidgetSettingsScreenState extends ConsumerState<WidgetSettingsScreen> {
  late WidgetSettings _settings = readWidgetSettings(ref.read(localStoreProvider));
  String _size = 'medium';
  bool _how = false;

  void _update(WidgetSettings next) {
    setState(() => _settings = next);
    saveWidgetSettings(ref.read(localStoreProvider), next);
    ref.read(homeWidgetsSyncProvider).changed();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final t = widgetText(store.language);
    final isPremium = ref.watch(subscriptionIsPremiumProvider);
    final platform = ref.watch(widgetPlatformProvider);
    BoxDecoration cxCard({Gradient? grad}) => BoxDecoration(
          color: grad == null ? a.surface : null,
          gradient: grad,
          border: Border.all(color: a.line),
          borderRadius: BorderRadius.circular(a.radiusLg),
          boxShadow: a.cardShadow,
        );
    Widget row(String icon, Color bg, String title, String sub, String key, {bool premium = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: <Widget>[
            Container(width: 42, height: 42, alignment: Alignment.center, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)), child: Text(icon, style: const TextStyle(fontSize: 20))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: <Widget>[
                  Text(title, style: px(14, weight: FontWeight.w700, color: a.ink)),
                  if (premium && !isPremium)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(start: 6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                        child: Text('👑 ${t('premium_badge')}', style: px(12, weight: FontWeight.w800, color: a.accentInk)),
                      ),
                    ),
                ]),
                Padding(padding: const EdgeInsets.only(top: 1), child: Text(sub, style: px(12, color: a.inkSoft))),
              ]),
            ),
            const SizedBox(width: 12),
            ShadSwitch(
              key: ValueKey<String>('widget-$key'),
              semanticLabel: title,
              checked: _settings[key],
              checkedColor: a.peach2,
              onChanged: (v) => _update(_settings.withValue(key, v)),
            ),
          ]),
        );
    final sizes = ['small', 'medium', 'large', 'lock'];
    final rows = [
      row('🍼', a.peach1, t('show_feed'), t('show_feed_sub'), 'showFeed', premium: true),
      row('🌙', a.lav1, t('show_nap'), t('show_nap_sub'), 'showNap', premium: true),
      row('⚡', a.green1, t('show_actions'), t('show_actions_sub'), 'showActions', premium: true),
      row('🔒', a.blue1, t('privacy'), t('privacy_sub'), 'privacy'),
    ];
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: <Widget>[
          const Positioned(top: 0, left: 0, right: 0, child: ASky(clouds: 2)),
          SingleChildScrollView(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 110),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(0, 18, 0, 14),
                      child: Row(children: <Widget>[
                        AIconBtn(size: 44, semanticLabel: '‹', onTap: widget.onBack, icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text(t('settings_eyebrow').toUpperCase(), style: px(11, weight: FontWeight.w800, color: a.inkSoft, ls: 0.07)),
                            Text(t('settings_title'), style: px(21, weight: FontWeight.w800, color: a.ink, ls: -0.02, height: 1.2)),
                          ]),
                        ),
                      ]),
                    ),
                    if (platform == 'web') Padding(padding: const EdgeInsets.only(bottom: 12), child: _CxWarn(t('native_only'))),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: cxCard(grad: LinearGradient(begin: const Alignment(-0.34, -0.94), end: const Alignment(0.34, 0.94), colors: <Color>[a.surface, a.surfaceSoft])),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                        Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(t('preview').toUpperCase(), style: px(11, weight: FontWeight.w800, color: a.inkSoft, ls: 0.07))),
                        FadeRise(
                          key: ValueKey<String>(_size),
                          dy: 0,
                          scaleFrom: 0.96,
                          child: Center(child: WidgetPreview(t: t, size: _size, premium: isPremium, settings: _settings, bump: store.lifeStage == 'bump')),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                          child: Row(children: <Widget>[
                            for (var i = 0; i < sizes.length; i++) ...<Widget>[
                              if (i > 0) const SizedBox(width: 4),
                              Expanded(
                                child: GestureDetector(
                                  key: ValueKey<String>('widget-size-${sizes[i]}'),
                                  onTap: () => setState(() => _size = sizes[i]),
                                  child: Container(
                                    constraints: const BoxConstraints(minHeight: 38),
                                    alignment: Alignment.center,
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    decoration: BoxDecoration(
                                      color: _size == sizes[i] ? a.surface : null,
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: _size == sizes[i] ? const <BoxShadow>[BoxShadow(color: Color(0x14000000), offset: Offset(0, 2), blurRadius: 8)] : null,
                                    ),
                                    child: Text(t('sizes.${sizes[i]}'), maxLines: 1, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w700, color: _size == sizes[i] ? a.ink : a.inkSoft)),
                                  ),
                                ),
                              ),
                            ],
                          ]),
                        ),
                      ]),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
                      child: Text(t('show_title').toUpperCase(), style: px(12, weight: FontWeight.w800, color: a.inkSoft, ls: 0.05)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      decoration: cxCard(),
                      child: Column(children: <Widget>[
                        for (var i = 0; i < rows.length; i++)
                          DecoratedBox(decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))), child: rows[i]),
                      ]),
                    ),
                    if (!isPremium)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: GestureDetector(
                          key: const ValueKey<String>('widget-premium'),
                          onTap: () => unawaited(ref.read(premiumPromptProvider).show(context, feature: t('premium_title'))),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: <Color>[a.peach1, a.surface]),
                              borderRadius: BorderRadius.circular(a.radiusLg),
                              boxShadow: a.cardShadow,
                            ),
                            child: Row(children: <Widget>[
                              Container(width: 42, height: 42, alignment: Alignment.center, decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14)), child: AIcon(AIcons.crown, size: 18, color: a.accentInk)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                  Text(t('premium_title'), style: px(14, weight: FontWeight.w700, color: a.ink)),
                                  Text(t('premium_note'), style: px(13, color: a.inkSoft, height: 1.45)),
                                ]),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: cxCard(),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                          Row(children: <Widget>[
                            Container(width: 42, height: 42, alignment: Alignment.center, decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(14)), child: const Text('💡', style: TextStyle(fontSize: 20))),
                            const SizedBox(width: 12),
                            Expanded(child: Text(t('how_title'), style: px(14, weight: FontWeight.w700, color: a.ink))),
                            AButton(key: const ValueKey<String>('widget-how'), variant: AButtonVariant.ghost, size: AButtonSize.sm, onPressed: () => setState(() => _how = !_how), child: Text(t('show'))),
                          ]),
                          if (_how)
                            Padding(
                              padding: const EdgeInsetsDirectional.fromSTEB(20, 10, 0, 0),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                Text('1. ${platform == 'android' ? t('how_android') : t('how_ios')}', style: px(13.5, color: a.ink, height: 1.45)),
                                if (platform != 'android') Padding(padding: const EdgeInsets.only(top: 6), child: Text('2. ${t('how_lock')}', style: px(13.5, color: a.ink, height: 1.45))),
                              ]),
                            ),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _CxWarn extends StatelessWidget {
  const _CxWarn(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: context.a.yellow1, borderRadius: BorderRadius.circular(18)),
        child: Text(text, style: px(12.5, color: context.a.warnInk, height: 1.45)),
      );
}

/// Static preview of the native widgets (sample values, real labels). Colours are the TSX literals.
class WidgetPreview extends StatelessWidget {
  const WidgetPreview({super.key, required this.t, required this.size, required this.premium, required this.settings, required this.bump});
  final FeatureText t;
  final String size;
  final bool premium;
  final WidgetSettings settings;
  final bool bump;

  static const Color _ink = Color(0xFF333333);
  static const Color _berry = Color(0xFFB22255);
  static const Color _muted = Color(0xFF8C8177);
  static const Color _coral = Color(0xFFFF5A5F);
  static const Color _white = Color(0xFFFFFFFF);

  @override
  Widget build(BuildContext context) {
    TextStyle st(double size, {FontWeight w = FontWeight.w400, Color color = _ink, double h = 1.5}) => TextStyle(fontSize: size, fontWeight: w, color: color, height: h);
    final card = BoxDecoration(
      borderRadius: BorderRadius.circular(24),
      boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 12), blurRadius: 28, spreadRadius: -14)],
      gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: <Color>[Color(0xFFFFFFFF), Color(0xFFFFE9E3)]),
    );
    final title = bump ? t('pregnancy_week').replaceAll('{w}', '24').replaceAll('{d}', '3') : t('baby_months').replaceAll('{m}', '3').replaceAll('{d}', '12');
    if (size == 'lock') {
      return Container(
        width: 300,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 22),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          gradient: const LinearGradient(begin: Alignment(-0.17, -1), end: Alignment(0.17, 1), colors: <Color>[Color(0xFFF7A99B), Color(0xFFD58FBD), Color(0xFF7D74C9)], stops: <double>[0, 0.55, 1]),
        ),
        child: Column(children: <Widget>[
          Text('14:10', style: st(54, w: FontWeight.w700, color: _white, h: 1)),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
            Container(width: 62, height: 62, alignment: Alignment.center, decoration: const BoxDecoration(color: Color(0x40FFFFFF), shape: BoxShape.circle), child: Text(bump ? '🌽' : '🌙', style: const TextStyle(fontSize: 24))),
            const SizedBox(width: 10),
            Container(
              width: 150,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: const Color(0x40FFFFFF), borderRadius: BorderRadius.circular(16)),
              child: DefaultTextStyle.merge(
                style: st(12, color: _white, h: 1.3),
                child: settings.privacy
                    ? Text('Anacan', style: st(12, w: FontWeight.w700, color: _white, h: 1.3))
                    : premium && !bump
                        ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text('🍼 1:40', style: st(12, w: FontWeight.w700, color: _white, h: 1.3)),
                            Text(t('sides.left')),
                            Text('${t('next_nap')} 14:35'),
                          ])
                        : Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text(title, style: st(12, w: FontWeight.w700, color: _white, h: 1.3)),
                            Text(bump ? t('baby_size').replaceAll('{fruit}', '🌽') : ''),
                          ]),
              ),
            ),
          ]),
        ]),
      );
    }
    if (size == 'small') {
      return Container(
        width: 160,
        height: 160,
        padding: const EdgeInsets.all(14),
        decoration: card,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
          Text(bump ? '🌽' : '👶', style: const TextStyle(fontSize: 34)),
          const Spacer(),
          Text(bump ? t('trimester').replaceAll('{n}', '2').toUpperCase() : 'MURAD', style: st(10, w: FontWeight.w800, color: _berry)),
          Text(title, style: st(18, w: FontWeight.w800, h: 1.15)),
        ]),
      );
    }
    Widget stat(String label, Color bg, Color fg, String value, String sub) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Text(label, style: st(9.5, w: FontWeight.w800, color: fg)),
              Text(value, style: st(17, w: FontWeight.w700)),
              Text(sub, style: st(11, color: _muted)),
            ]),
          ),
        );
    Widget action(String text, Color bg, Color fg) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 9),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
            child: Text(text, style: st(12, w: FontWeight.w800, color: fg)),
          ),
        );
    return Container(
      width: size == 'large' ? 300 : 320,
      padding: const EdgeInsets.all(12),
      decoration: card,
      child: VGap(gap: 8, children: <Widget>[
        Row(children: <Widget>[
          Container(width: 36, height: 36, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFFFFDCDD), borderRadius: BorderRadius.circular(12)), child: const Text('👶', style: TextStyle(fontSize: 20))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Text(settings.privacy ? 'ANACAN' : 'NURAY', style: st(10, w: FontWeight.w800, color: _berry)),
              Text(settings.privacy ? '' : t('baby_months').replaceAll('{m}', '3').replaceAll('{d}', '12'), style: st(16, w: FontWeight.w700)),
            ]),
          ),
          if (!premium)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: _coral, borderRadius: BorderRadius.circular(999)),
              child: Text('🔒 ${t('premium_badge').toUpperCase()}', style: st(9, w: FontWeight.w800, color: _white)),
            ),
        ]),
        Row(children: <Widget>[
          stat('🍼 ${t('last_feed').toUpperCase()}', const Color(0xFFDDF3E3), const Color(0xFF1C7A4D), settings.showFeed ? t('hours_minutes').replaceAll('{h}', '1').replaceAll('{m}', '40') : '—', settings.showFeed ? t('sides.left') : ''),
          const SizedBox(width: 8),
          stat('🌙 ${t('next_nap').toUpperCase()}', const Color(0xFFE9DDFC), const Color(0xFF5B3AA5), settings.showNap ? '14:35' : '—', settings.showNap ? '14:35–14:55' : ''),
        ]),
        if (size == 'large')
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(14)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: <Widget>[
              Text(t('today').toUpperCase(), style: st(12, w: FontWeight.w700, color: _muted)),
              Text('🍼 6 · 😴 9:20 · 🧷 5', style: st(12, w: FontWeight.w700)),
            ]),
          ),
        if (!premium)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: _coral, borderRadius: BorderRadius.circular(14)),
            child: Text('🔒 ${t('premium_locked_title')}', style: st(13, w: FontWeight.w800, color: _white)),
          )
        else if (settings.showActions)
          Row(children: <Widget>[
            action('🍼 ${t('btn_feed')}', _coral, _white),
            const SizedBox(width: 6),
            action('😴 ${t('btn_sleep')}', const Color(0xFF7C5CD6), _white),
            const SizedBox(width: 6),
            action('🧷 ${t('btn_diaper')}', const Color(0xFFFFE7E1), const Color(0xFF7C2726)),
          ]),
      ]),
    );
  }
}
