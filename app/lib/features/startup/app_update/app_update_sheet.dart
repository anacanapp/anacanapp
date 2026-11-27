// Ported from: src/components/appUpdate/AppUpdateSheet.tsx, src/components/appUpdate/AppUpdateBanner.tsx,
//              src/styles/anacan-design.css (.app-update-*), src/pages/Index.tsx (sheet / banner wiring)
import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../design/a_icon.dart';
import '../../../design/icons.g.dart' show AIcons;
import '../../../design/motion.dart' show animationsDisabled;
import '../../../design/theme.dart';
import '../app_update_copy.dart';
import 'app_update.dart';

String _or(String? a, String b) => (a != null && a.isNotEmpty) ? a : b;

TextStyle _s(double size, FontWeight w, Color color, {double height = 1.5, double? ls}) => TextStyle(
      fontSize: size,
      fontWeight: w,
      height: height,
      leadingDistribution: TextLeadingDistribution.even,
      letterSpacing: ls == null ? null : em(ls, size),
      color: color,
    );

/// `.app-update-icon` / ForceUpdateScreen gradient: linear-gradient(135deg, var(--a-peach-1), #ffb9ae).
LinearGradient _peachGradient(ATokens t) => LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [t.peach1, const Color(0xFFFFB9AE)],
    );

/// Soft update: a bottom sheet with the rule's title, what's new and Update / Later.
class AppUpdateSheet extends StatefulWidget {
  const AppUpdateSheet({
    super.key,
    required this.decision,
    required this.currentVersion,
    required this.onUpdate,
    required this.onLater,
    this.language,
    this.isIos,
  });

  final AppUpdateDecision decision;
  final String? currentVersion;
  final VoidCallback onUpdate;
  final VoidCallback onLater;
  final String? language;
  final bool? isIos;

  @override
  State<AppUpdateSheet> createState() => _AppUpdateSheetState();
}

class _AppUpdateSheetState extends State<AppUpdateSheet> with SingleTickerProviderStateMixin {
  // initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context) || AnacanTokens.of(context).lite) {
      _y.value = 0;
    } else {
      _y.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 320, damping: 30), 1, 0, 0));
    }
  }

  @override
  void dispose() {
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final d = widget.decision;
    final lang = widget.language;
    final store = (widget.isIos ?? defaultTargetPlatform == TargetPlatform.iOS) ? 'App Store' : 'Google Play';
    final items = d.whatsNew.whereType<String>().where((x) => x.trim().isNotEmpty).take(6).toList();
    final version = widget.currentVersion;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final title = _or(d.title, updateText(AppUpdateText.newVersion, lang));

    final sheet = Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 560),
      padding: EdgeInsets.fromLTRB(22, 10, 22, 18 + bottom),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Opacity(
              opacity: 0.6,
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(color: t.inkFaint, borderRadius: BorderRadius.circular(4)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), gradient: _peachGradient(t)),
                child: AIcon(AIcons.arrowUp, size: 22, strokeWidth: 2.6, color: t.accentInk),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(title, style: _s(19, FontWeight.w900, t.ink, ls: -0.01))),
                    const SizedBox(height: 2),
                    Text(
                      '${version != null && version.isNotEmpty ? '$version → ' : ''}${d.targetVersion} · $store',
                      style: _s(12.5, FontWeight.w400, t.inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (d.body != null && d.body!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 10),
              child: Text(d.body!, style: _s(14.5, FontWeight.w400, t.bodyText)),
            ),
          if (items.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 8),
              child: Text(updateText(AppUpdateText.whatsNew, lang), style: _s(13, FontWeight.w800, t.inkSoft)),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < items.length; i++) ...[
                    if (i > 0) const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 19,
                          height: 19,
                          margin: const EdgeInsets.only(top: 1),
                          alignment: Alignment.center,
                          // .app-update-list li > span literals (#e2f5ec / #1f8a5b).
                          decoration: const BoxDecoration(color: Color(0xFFE2F5EC), shape: BoxShape.circle),
                          child: const AIcon(AIcons.check, size: 11, strokeWidth: 3.2, color: Color(0xFF1F8A5B)),
                        ),
                        const SizedBox(width: 9),
                        Expanded(child: Text(items[i], style: _s(14.5, FontWeight.w400, t.ink, height: 1.4))),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
          _PressButton(
            onTap: widget.onUpdate,
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.peach2,
                borderRadius: BorderRadius.circular(999),
                // 0 14px 28px -14px rgba(255, 90, 95, .8)
                boxShadow: const [BoxShadow(color: Color(0xCCFF5A5F), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -14)],
              ),
              child: Text(_or(d.button, updateText(AppUpdateText.update, lang)),
                  style: _s(16, FontWeight.w800, const Color(0xFFFFFFFF))),
            ),
          ),
          const SizedBox(height: 4),
          _PressButton(
            onTap: widget.onLater,
            child: Container(
              height: 44,
              alignment: Alignment.center,
              child: Text(_or(d.later, updateText(AppUpdateText.later, lang)), style: _s(14.5, FontWeight.w700, t.inkSoft)),
            ),
          ),
        ],
      ),
    );

    return AScope(
      child: Stack(
        children: [
          // .app-update-backdrop: rgba(0, 0, 0, .42); a tap outside the sheet = Later.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onLater,
              child: const ColoredBox(color: Color(0x6B000000)),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: AnimatedBuilder(
              animation: _y,
              builder: (context, child) => FractionalTranslation(translation: Offset(0, _y.value), child: child),
              child: Semantics(
                scopesRoute: true,
                namesRoute: true,
                label: title,
                explicitChildNodes: true,
                child: GestureDetector(onTap: () {}, child: sheet),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PressButton extends StatelessWidget {
  const _PressButton({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget child;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: child),
      );
}

/// Home-screen strip for banner rules and soft rules after "Later". Closing hides it while it stays mounted.
class AppUpdateBanner extends StatefulWidget {
  const AppUpdateBanner({super.key, required this.decision, required this.onUpdate, this.language});
  final AppUpdateDecision decision;
  final VoidCallback onUpdate;
  final String? language;

  @override
  State<AppUpdateBanner> createState() => _AppUpdateBannerState();
}

class _AppUpdateBannerState extends State<AppUpdateBanner> {
  bool _closed = false;

  @override
  Widget build(BuildContext context) {
    if (_closed) return const SizedBox.shrink();
    final t = AnacanTokens.of(context).a;
    final lang = widget.language;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsetsDirectional.fromSTEB(11, 9, 8, 9),
        decoration: BoxDecoration(color: t.ink, borderRadius: BorderRadius.circular(18)),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: t.peach2, borderRadius: BorderRadius.circular(10)),
              child: const AIcon(AIcons.arrowUp, size: 16, strokeWidth: 2.8, color: Color(0xFFFFFFFF)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _or(widget.decision.title, updateText(AppUpdateText.banner, lang)),
                style: _s(13.5, FontWeight.w600, t.bg, height: 1.3),
              ),
            ),
            const SizedBox(width: 10),
            _PressButton(
              onTap: widget.onUpdate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
                decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(_or(widget.decision.button, updateText(AppUpdateText.update, lang)),
                    style: _s(13, FontWeight.w800, t.ink)),
              ),
            ),
            const SizedBox(width: 10),
            Semantics(
              label: updateText(AppUpdateText.later, lang),
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _closed = true),
                child: SizedBox(width: 30, height: 30, child: Center(child: AIcon(AIcons.x, size: 16, color: t.inkFaint))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Index's home-tab slot: `{appUpdate.showBanner && appUpdate.decision && <div className="px-4 pt-2"><AppUpdateBanner …/></div>}`.
/// For the Home feature to place above the Dashboard.
class AppUpdateBannerSlot extends ConsumerWidget {
  const AppUpdateBannerSlot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(appUpdateProvider);
    final d = s.decision;
    if (!s.showBanner || d == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 8),
      child: AppUpdateBanner(
        decision: d,
        language: ref.watch(appLanguageProvider),
        onUpdate: () => ref.read(appUpdateProvider.notifier).openStore(),
      ),
    );
  }
}

/// Index: `{appUpdate.showSheet && appUpdate.decision && <AppUpdateSheet onUpdate={later + openStore} onLater={later} />}`.
/// Registered as a frame overlay; the sheet is drawn in the navigator's [Overlay], above the bottom nav (React
/// portals it to `body` at z-400).
class AppUpdateSheetHost extends StatefulWidget {
  const AppUpdateSheetHost({super.key});

  @override
  State<AppUpdateSheetHost> createState() => _AppUpdateSheetHostState();
}

class _AppUpdateSheetHostState extends State<AppUpdateSheetHost> {
  final OverlayPortalController _portal = OverlayPortalController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _portal.show();
    });
  }

  @override
  Widget build(BuildContext context) {
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => Consumer(builder: (context, ref, _) {
        final s = ref.watch(appUpdateProvider);
        final d = s.decision;
        if (!s.showSheet || d == null) return const SizedBox.shrink();
        final controller = ref.read(appUpdateProvider.notifier);
        return Positioned.fill(
          child: AppUpdateSheet(
            decision: d,
            currentVersion: s.currentVersion,
            language: ref.watch(appLanguageProvider),
            onUpdate: () {
              controller.later();
              controller.openStore();
            },
            onLater: controller.later,
          ),
        );
      }),
      child: const SizedBox.shrink(),
    );
  }
}
