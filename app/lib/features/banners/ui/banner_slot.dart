// Ported from: src/components/banners/BannerSlot.tsx (BannerSlot, MeasuredBanner, NativeBanner, ImageBanner,
//              adjustColor, APP_DEEPLINK_EVENT handling via the shell)
//
// Banners of one placement: tier / platform / premium filters, one impression count per own banner and slot,
// brand creatives measured with account-bound receipts (≥ 50 % visible while the app is in the foreground and
// the creative image is loaded), click routing (external browser, in-app deeplink, tool, brand lead form).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart' hide Banner;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart' show dbProvider;
import '../../../design/design.dart';
import '../../../native/purchases/purchases_providers.dart' show currentStorePlatform;
import '../../../native/purchases/subscription.dart' show subscriptionProvider;
import '../../../shell/shell.dart';
import '../../settings/ui/settings_ui.dart' show Tw;
import '../../../state/user_store.dart';
import '../brand_ads.dart';
import '../brand_measurement.dart';
import '../data/banner.dart';
import '../data/banners_repository.dart';
import '../lead_form.dart';
import 'lead_form_sheet.dart';
import 'native_ad_card.dart';

/// `useSubscription().isPremium` for the slot.
final bannerPremiumProvider = Provider<bool>((ref) => ref.watch(subscriptionProvider.select((s) => s.isPremium)));

/// `Capacitor.getPlatform()`: 'ios' | 'android' | 'web'.
final bannerPlatformProvider = Provider<String>((ref) => currentStorePlatform());

/// `window.open(url, '_blank', 'noopener,noreferrer')`.
final bannerExternalLauncherProvider = Provider<Future<void> Function(String url)>((ref) => (url) async {
      try {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } catch (_) {}
    });

/// In-app deeplink (`APP_DEEPLINK_EVENT` → Index `handleDeeplink`): true when the path was understood.
final bannerDeeplinkHandlerProvider = Provider<bool Function(String url)>((ref) => (url) => ref.read(shellProvider.notifier).openUrl(url));

/// `measurement.rpc` (supabase-js `{ data, error }`).
final bannerMeasurementRpcProvider = Provider<BrandRpc>((ref) => (name, args) async {
      try {
        return (data: await ref.read(dbProvider).rpc<Object?>(name, params: args), error: null);
      } catch (error) {
        return (data: null, error: error);
      }
    });

/// Tailwind `shadow-lg`.
const List<BoxShadow> _shadowLg = [
  BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
  BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
];

/// The banners [placement] may show to this user (premium tier, platform, `is_premium_only`).
List<Banner> visibleBanners(List<Banner> banners, {required bool isPremium, required String platform}) {
  final tier = isPremium ? 'premium' : 'free';
  return banners.where((b) {
    final platforms = b.targetPlatforms;
    if (platforms != null && platforms.isNotEmpty && !platforms.contains(platform)) return false;
    final tiers = b.audienceTiers;
    if (b.branded) return tiers != null && tiers.isNotEmpty ? tiers.contains(tier) : !isPremium;
    return tiers != null && tiers.isNotEmpty ? tiers.contains(tier) && (!b.isPremiumOnly || isPremium) : (!b.isPremiumOnly || isPremium);
  }).toList();
}

/// `adjustColor(color, amount)` of the legacy native banner (invalid hex → black, like `parseInt` NaN).
String adjustBannerColor(String color, int amount) {
  final num = int.tryParse(color.replaceAll('#', ''), radix: 16) ?? 0;
  final r = ((num >> 16) + amount).clamp(0, 255), g = (((num >> 8) & 0xFF) + amount).clamp(0, 255), b = ((num & 0xFF) + amount).clamp(0, 255);
  return '#${(1 << 24 | r << 16 | g << 8 | b).toRadixString(16).substring(1)}';
}

Color _cssColor(String? value, Color fallback) {
  if (value == null) return fallback;
  final hex = value.replaceAll('#', '');
  if (RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(hex)) return Color(0xFF000000 | int.parse(hex, radix: 16));
  if (RegExp(r'^[0-9a-fA-F]{3}$').hasMatch(hex)) return Color(0xFF000000 | int.parse(hex.split('').map((c) => '$c$c').join(), radix: 16));
  return fallback;
}

/// `<BannerSlot placement onNavigate onToolOpen className />`. [padding] is the slot's `className` margin and only
/// applies when something renders (React returns null for an empty slot).
class BannerSlot extends ConsumerStatefulWidget {
  const BannerSlot({super.key, required this.placement, this.onNavigate, this.onToolOpen, this.padding = EdgeInsets.zero});
  final BannerPlacement placement;
  final void Function(String screen)? onNavigate;
  final void Function(String toolId)? onToolOpen;
  final EdgeInsetsGeometry padding;

  @override
  ConsumerState<BannerSlot> createState() => _BannerSlotState();
}

class _BannerSlotState extends ConsumerState<BannerSlot> {
  final Set<String> _fired = <String>{};
  String _visibleIds = '';
  ({String banner, String? delivery})? _lead;

  void _impressions(List<Banner> visible) {
    final ids = visible.map((b) => b.id).join(',');
    if (ids == _visibleIds) return;
    _visibleIds = ids;
    final source = ref.read(bannersSourceProvider);
    for (final banner in visible) {
      if (!banner.branded && _fired.add(banner.id)) unawaited(source.incrementImpression(banner.id));
    }
  }

  void _click(Banner banner, Future<String?>? ticket) {
    if (banner.linkType == 'lead_form') {
      if (!banner.branded || !banner.leadForm) return;
      _openLead(banner.id, ticket);
      return;
    }
    final link = banner.linkUrl;
    if (link == null || link.isEmpty) return;
    if (banner.linkType == 'external' && safeAdUrl(link) == null) return;
    if (!banner.branded) unawaited(ref.read(bannersSourceProvider).incrementClick(banner.id));
    switch (banner.linkType) {
      case 'external':
        unawaited(ref.read(bannerExternalLauncherProvider)(safeAdUrl(link)!));
      case 'internal':
        // Internal links are app deeplink paths (/books, /cakes, /tool/names, /premium...).
        if (!ref.read(bannerDeeplinkHandlerProvider)(link)) widget.onNavigate?.call(link.replaceFirst('/', ''));
      case 'tool':
        widget.onToolOpen?.call(link);
    }
  }

  void _openLead(String bannerId, Future<String?>? ticket) {
    setState(() => _lead = (banner: bannerId, delivery: null));
    final delivery = ValueNotifier<String?>(null);
    unawaited(ticket?.then((value) {
      if (value != null && mounted && _lead?.banner == bannerId) {
        _lead = (banner: bannerId, delivery: value);
        delivery.value = value;
      }
    }));
    unawaited(showLeadFormSheet(context, bannerId: bannerId, delivery: delivery).whenComplete(() {
      if (mounted && _lead?.banner == bannerId) setState(() => _lead = null);
    }));
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(bannersQuery(widget.placement));
    final banners = query.data ?? const <Banner>[];
    final visible = visibleBanners(banners, isPremium: ref.watch(bannerPremiumProvider), platform: ref.watch(bannerPlatformProvider));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _impressions(visible);
    });
    if (query.isLoading || banners.isEmpty || visible.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: widget.padding,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final (i, banner) in visible.indexed) ...[
          if (i > 0) const SizedBox(height: 12),
          _EnterFade(key: ValueKey<String>('banner-${banner.id}'), child: MeasuredBanner(banner: banner, onClick: (ticket) => _click(banner, ticket))),
        ],
      ]),
    );
  }
}

/// framer `initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}` (default spring ≈ 300 ms ease-out).
class _EnterFade extends StatefulWidget {
  const _EnterFade({super.key, required this.child});
  final Widget child;
  @override
  State<_EnterFade> createState() => _EnterFadeState();
}

class _EnterFadeState extends State<_EnterFade> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) == true) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = Curves.easeOut.transform(_c.value);
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 10 * (1 - t)), child: child));
      },
      child: widget.child,
    );
  }
}

/// `MeasuredBanner`: brand creatives (measurement v2 / v3) report a visible second and clicks.
class MeasuredBanner extends ConsumerStatefulWidget {
  const MeasuredBanner({super.key, required this.banner, required this.onClick});
  final Banner banner;
  final void Function(Future<String?>? ticket) onClick;

  @override
  ConsumerState<MeasuredBanner> createState() => _MeasuredBannerState();
}

class _MeasuredBannerState extends ConsumerState<MeasuredBanner> with WidgetsBindingObserver {
  final GlobalKey _node = GlobalKey();
  BrandExposure? _exposure;
  Timer? _probe;
  bool _imageLoaded = false;
  String _measurementKey = '';
  AppLifecycleState? _lifecycle = WidgetsBinding.instance.lifecycleState;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycle = state;
    _update();
  }

  void _sync() {
    final banner = widget.banner;
    final user = ref.read(authUserProvider);
    final language = ref.read(userStoreProvider).language;
    final version = banner.measurementVersion;
    final key = '${user?.id}|${banner.id}|${banner.branded}|$version|${banner.creativeRevision}|$language';
    if (key == _measurementKey) return;
    _measurementKey = key;
    _stop();
    if (user == null || !banner.branded || (version != 2 && version != 3) || (banner.bannerType == 'image' && safeAdUrl(banner.imageUrl) == null)) return;
    _exposure = BrandExposure(
      rpc: ref.read(bannerMeasurementRpcProvider),
      actor: user.id,
      banner: banner.id,
      language: language,
      platform: ref.read(bannerPlatformProvider),
      version: version!.toInt(),
    );
    _probe = Timer.periodic(const Duration(milliseconds: 250), (_) => _update());
    WidgetsBinding.instance.addPostFrameCallback((_) => _update());
  }

  void _stop() {
    _probe?.cancel();
    _probe = null;
    _exposure?.dispose();
    _exposure = null;
  }

  /// IntersectionObserver ratio ≥ .5, document visible, creative image loaded.
  void _update() {
    final exposure = _exposure;
    if (exposure == null || !mounted) return;
    final box = _node.currentContext?.findRenderObject();
    var ratio = 0.0;
    if (box is RenderBox && box.attached && box.hasSize && box.size.height > 0) {
      final size = MediaQuery.maybeSizeOf(context) ?? Size.zero;
      final top = box.localToGlobal(Offset.zero).dy, bottom = top + box.size.height;
      final visible = math.max(0.0, math.min(bottom, size.height) - math.max(top, 0.0));
      ratio = visible / box.size.height;
    }
    final foreground = _lifecycle == null || _lifecycle == AppLifecycleState.resumed || _lifecycle == AppLifecycleState.inactive;
    final loaded = widget.banner.bannerType != 'image' || _imageLoaded;
    exposure.visible(ratio >= 0.5 && foreground && loaded);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stop();
    super.dispose();
  }

  void _tap() {
    final banner = widget.banner;
    final link = banner.linkUrl;
    final actionable = banner.linkType == 'lead_form'
        ? banner.leadForm
        : link != null && link.isNotEmpty && (banner.linkType != 'external' || safeAdUrl(link) != null);
    widget.onClick(actionable ? _exposure?.click() : null);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authUserProvider.select((u) => u?.id));
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _sync();
    });
    final banner = widget.banner;
    final s = context.tokens.shadcn;
    final v3 = banner.measurementVersion == 3;
    final sponsor = banner.sponsorName;
    Widget child;
    if (banner.bannerType == 'native') {
      child = v3 || (banner.nativeTemplate != null && banner.nativeTemplate!.isNotEmpty)
          ? NativeAdCard(
              ad: NativeAdContent(
                title: banner.title,
                description: banner.description,
                buttonText: banner.buttonText,
                imageUrl: banner.imageUrl,
                backgroundColor: banner.backgroundColor,
                textColor: banner.textColor,
                nativeTemplate: banner.nativeTemplate,
                creativeOptions: banner.creativeOptions,
                linkType: banner.linkType,
                sponsorLogo: banner.sponsorLogo,
              ),
              sponsorLabel: banner.branded ? '${leadText('sponsored', language)} · ${sponsor ?? ''}' : null,
              codeLabel: leadText('offer_code', language),
              onTap: _tap,
            )
          : NativeBanner(banner: banner, onTap: _tap);
    } else {
      child = ImageBanner(
        banner: banner,
        onTap: _tap,
        onLoaded: () {
          if (!_imageLoaded) {
            _imageLoaded = true;
            _update();
          }
        },
      );
    }
    return Column(key: _node, crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      if (sponsor != null && sponsor.isNotEmpty && !(v3 && banner.bannerType == 'native'))
        Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(sponsor, style: TextStyle(fontSize: 10, color: s.mutedForeground))),
      child,
    ]);
  }
}

/// `NativeBanner` (legacy gradient card).
class NativeBanner extends StatefulWidget {
  const NativeBanner({super.key, required this.banner, required this.onTap});
  final Banner banner;
  final VoidCallback onTap;
  @override
  State<NativeBanner> createState() => _NativeBannerState();
}

class _NativeBannerState extends State<NativeBanner> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final banner = widget.banner;
    final bgHex = banner.backgroundColor == null || banner.backgroundColor!.isEmpty ? '#F48155' : banner.backgroundColor!;
    final textColor = _cssColor(banner.textColor == null || banner.textColor!.isEmpty ? '#FFFFFF' : banner.textColor, const Color(0xFFFFFFFF));
    final wide = MediaQuery.sizeOf(context).width >= 640;
    final description = banner.description;
    return GestureDetector(
      key: ValueKey<String>('native-banner-${banner.id}'),
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_cssColor(bgHex, const Color(0xFFF48155)), _cssColor(adjustBannerColor(bgHex, -20), const Color(0xFF000000))],
            ),
            boxShadow: _shadowLg,
          ),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: AIcon(AIcons.sparkles, size: 24, color: textColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(banner.title, style: Tw.base.copyWith(fontWeight: FontWeight.w600, color: textColor)),
                if (description != null && description.isNotEmpty)
                  Opacity(opacity: 0.9, child: Text(description, maxLines: 1, overflow: TextOverflow.ellipsis, style: Tw.sm.copyWith(color: textColor))),
              ]),
            ),
            const SizedBox(width: 16),
            if (wide && banner.buttonText != null && banner.buttonText!.isNotEmpty) ...[
              Text(banner.buttonText!, style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: textColor)),
              const SizedBox(width: 4),
            ],
            banner.linkType == 'external'
                ? AIcon(AIcons.externalLink, size: 20, color: textColor)
                : AIcon(AIcons.chevronRight, size: 20, color: textColor, mirrorInRtl: true),
          ]),
        ),
      ),
    );
  }
}

/// `ImageBanner`: only a safe http(s) image renders.
class ImageBanner extends StatelessWidget {
  const ImageBanner({super.key, required this.banner, required this.onTap, this.onLoaded});
  final Banner banner;
  final VoidCallback onTap;
  final VoidCallback? onLoaded;

  @override
  Widget build(BuildContext context) {
    final url = safeAdUrl(banner.imageUrl);
    if (url == null) return const SizedBox.shrink();
    return GestureDetector(
      key: ValueKey<String>('image-banner-${banner.id}'),
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: _shadowLg),
        child: Stack(children: [
          Semantics(
            image: true,
            label: banner.title,
            child: Image.network(
              url,
              key: const ValueKey<String>('creative-image'),
              width: double.infinity,
              fit: BoxFit.cover,
              frameBuilder: (context, child, frame, _) {
                if (frame != null) WidgetsBinding.instance.addPostFrameCallback((_) => onLoaded?.call());
                return child;
              },
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
            ),
          ),
          if (banner.linkType == 'external')
            PositionedDirectional(
              top: 8,
              end: 8,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle),
                child: const AIcon(AIcons.externalLink, size: 16, color: Color(0xFFFFFFFF)),
              ),
            ),
        ]),
      ),
    );
  }
}
