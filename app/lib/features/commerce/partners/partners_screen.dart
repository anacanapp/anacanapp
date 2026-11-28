// Ported from: src/components/partners/PartnersScreen.tsx, src/components/partners/RedemptionQRSheet.tsx
//
// Partner discounts (spa, sport, beauty…). Premium members create a short-lived redemption QR that the cashier
// scans; the verify page (/p/v/:token) stays on the web.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../native/purchases/subscription.dart' show subscriptionProvider;
import '../../premium/premium_modal.dart' show showPremiumModal;
import '../../settings/ui/settings_ui.dart' show ARingSpinner, FadeRise, ShadButton, ShadButtonVariant;
import '../commerce_backend.dart';
import '../common/commerce_ui.dart';
import 'partner_venues.dart';
import 'qr_code.dart';

/// `useSubscription().isPremium` (overridable in tests).
final partnersIsPremiumProvider = Provider<bool>((ref) => ref.watch(subscriptionProvider.select((s) => s.isPremium)));

/// `window.open` / `tel:` links of the venue page.
final partnersLinkOpenerProvider = Provider<void Function(String url)>(
  (ref) =>
      (url) => unawaited(launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).then((_) {}, onError: (Object _) {})),
);

/// `<PremiumModal isOpen onClose />`.
final partnersPaywallProvider = Provider<Future<void> Function(BuildContext context)>(
  (ref) =>
      (context) => showPremiumModal(context),
);

class PartnersScreen extends ConsumerStatefulWidget {
  const PartnersScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnersScreen> createState() => _PartnersScreenState();
}

class _PartnersScreenState extends ConsumerState<PartnersScreen> {
  String _category = 'all';
  final TextEditingController _query = TextEditingController();
  PartnerVenue? _selected;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _redeem(PartnerVenue v) {
    if (!ref.read(partnersIsPremiumProvider)) {
      unawaited(ref.read(partnersPaywallProvider)(context));
      return;
    }
    // React keeps the venue selected while the QR sheet is open and clears it on close.
    unawaited(
      showRedemptionQrSheet(context, venueId: v.id, venueName: v.name).whenComplete(() {
        if (mounted) setState(() => _selected = null);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final isPremium = ref.watch(partnersIsPremiumProvider);
    final selected = _selected;
    if (selected != null) {
      return _VenueDetail(venue: selected, isPremium: isPremium, onBack: () => setState(() => _selected = null), onRedeem: () => _redeem(selected));
    }
    final categories = ref.watch(partnerCategoriesQuery).data ?? const <PartnerCategory>[];
    final venuesQ = ref.watch(partnerVenuesQuery(_category));
    final q = _query.text.trim().toLowerCase();
    final filtered = [
      for (final v in venuesQ.data ?? const <PartnerVenue>[])
        if (q.isEmpty || v.name.toLowerCase().contains(q) || (v.address ?? '').toLowerCase().contains(q)) v,
    ];
    final language = currentLanguage();

    Widget pill(String label, bool active, VoidCallback onTap) => Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: active ? a.peach1 : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: active ? a.peach2 : a.line, width: 1.5),
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w700 : FontWeight.w600, color: active ? a.accentInk : a.inkSoft),
          ),
        ),
      ),
    );

    final header = Container(
      decoration: BoxDecoration(
        color: a.navBg,
        border: Border(bottom: BorderSide(color: a.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                AIconButton(
                  icon: const AIcon(AIcons.arrowLeft, size: 16, strokeWidth: 2, mirrorInRtl: true),
                  onPressed: widget.onBack,
                  semanticLabel: tr('common_geri', 'Geri'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          AIcon(AIcons.sparkles, size: 15, color: a.accentInk),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              tr('partnersscreen_partnyor_endirimleri_e44036', 'Partnyor Endirimləri'),
                              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, letterSpacing: -0.155, color: a.ink),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        tr('partnersscreen_spa_idman_gozellik_ve_daha_cox_24ad1f', 'Spa, idman, gözəllik və daha çox'),
                        style: TextStyle(fontSize: 11, color: a.inkSoft),
                      ),
                    ],
                  ),
                ),
                if (!isPremium)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(999)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AIcon(AIcons.crown, size: 12, color: a.yellowInk),
                        const SizedBox(width: 4),
                        Text(
                          'Premium',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: a.yellowInk),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: Container(
              height: 40,
              padding: const EdgeInsetsDirectional.only(start: 14, end: 16),
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: a.line),
              ),
              child: Row(
                children: [
                  AIcon(AIcons.search, size: 16, color: a.inkFaint),
                  const SizedBox(width: 10),
                  Expanded(
                    child: EditableTextField(
                      fieldKey: const ValueKey('partners-search'),
                      controller: _query,
                      placeholder: tr('partnersscreen_mekan_axtar_8b889d', 'Məkan axtar...'),
                      style: TextStyle(fontSize: 13, color: a.ink),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                pill(tr('partnersscreen_hamisi_c73c4d', 'Hamısı'), _category == 'all', () => setState(() => _category = 'all')),
                for (final c in categories) pill(localizeCategoryLabel(c, language), _category == c.key, () => setState(() => _category = c.key)),
              ],
            ),
          ),
        ],
      ),
    );

    return AScope(
      child: ColoredBox(
        color: a.bg,
        // The sticky header stays on top; the list scrolls under it.
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 448),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (venuesQ.isLoading)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 40),
                            child: Center(child: ARingSpinner(size: 32, color: a.peach2)),
                          ),
                        if (!venuesQ.isLoading && filtered.isEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 38),
                            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
                            child: Column(
                              children: [
                                AIcon(AIcons.mapPin, size: 40, color: a.inkFaint),
                                const SizedBox(height: 12),
                                Text(
                                  tr('partnersscreen_bu_kateqoriyada_hele_partnyor__9b10b6', 'Bu kateqoriyada hələ partnyor yoxdur.'),
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 13, color: a.inkSoft),
                                ),
                              ],
                            ),
                          ),
                        for (var i = 0; i < filtered.length; i++) ...[
                          if (i > 0) const SizedBox(height: 12),
                          FadeRise(
                            dy: 10,
                            delay: Duration(milliseconds: i * 30),
                            child: _VenueCard(venue: filtered[i], onTap: () => setState(() => _selected = filtered[i])),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VenueCard extends StatelessWidget {
  const _VenueCard({required this.venue, required this.onTap});
  final PartnerVenue venue;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final v = venue;
    return Semantics(
      button: true,
      child: GestureDetector(
        key: ValueKey('venue-${v.id}'),
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (v.coverUrl != null) Container(height: 128, color: a.surfaceSoft, child: CommerceImage(v.coverUrl!)),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (v.logoUrl != null)
                      Container(
                        width: 48,
                        height: 48,
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: a.line),
                        ),
                        child: CommerceImage(v.logoUrl!),
                      )
                    else
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
                        child: AIcon(AIcons.sparkles, size: 19, color: a.accentInk),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  v.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink),
                                ),
                              ),
                              if (v.isFeatured) ...[
                                const SizedBox(width: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(999)),
                                  child: Text(
                                    '★',
                                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: a.yellowInk),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (v.address != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(
                                children: [
                                  AIcon(AIcons.mapPin, size: 12, color: a.inkSoft),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      v.address!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 11, color: a.inkSoft),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                AIcon(AIcons.sparkles, size: 12, color: a.accentInk),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    v.discountLabel,
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.accentInk),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VenueDetail extends ConsumerWidget {
  const _VenueDetail({required this.venue, required this.isPremium, required this.onBack, required this.onRedeem});
  final PartnerVenue venue;
  final bool isPremium;
  final VoidCallback onBack;
  final VoidCallback onRedeem;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final v = venue;
    final open = ref.read(partnersLinkOpenerProvider);
    Widget action(AIconData icon, String label, String url) => Expanded(
      child: GestureDetector(
        onTap: () => open(url),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
          child: Column(
            children: [
              AIcon(icon, size: 16, color: a.accentInk),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: a.inkSoft),
              ),
            ],
          ),
        ),
      ),
    );
    final actions = <Widget>[
      if (v.phone != null) action(AIcons.phone, tr('partnersscreen_zeng_4cba42', 'Zəng'), 'tel:${v.phone}'),
      if (v.website != null) action(AIcons.globe, tr('untranslated_veb_sayt_16w317', 'Veb sayt'), v.website!),
      if (v.instagram != null) action(AIcons.instagram, trInline('PartnersScreen.tsx', 'Instagram'), 'https://instagram.com/${v.instagram!.replaceFirst('@', '')}'),
      if (v.latitude != null && v.latitude != 0 && v.longitude != null && v.longitude != 0)
        action(
          AIcons.mapPin,
          tr('partnersscreen_xerite_a1e08d', 'Xəritə'),
          'https://maps.google.com/?q=${_num(v.row['latitude'])},${_num(v.row['longitude'])}',
        ),
    ];
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 128),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Stack(
                    children: [
                      v.coverUrl != null
                          ? SizedBox(height: 224, child: CommerceImage(v.coverUrl!))
                          : Container(
                              height: 224,
                              decoration: BoxDecoration(gradient: a.gradPeach),
                              child: Center(
                                child: Opacity(opacity: 0.5, child: AIcon(AIcons.sparkles, size: 60, color: a.accentInk)),
                              ),
                            ),
                      PositionedDirectional(
                        top: 12,
                        start: 12,
                        child: AIconButton(
                          icon: const AIcon(AIcons.arrowLeft, size: 16, strokeWidth: 2, mirrorInRtl: true),
                          onPressed: onBack,
                          semanticLabel: tr('common_geri', 'Geri'),
                        ),
                      ),
                    ],
                  ),
                  Transform.translate(
                    offset: const Offset(0, -32),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 448),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (v.logoUrl != null) ...[
                                      Transform.translate(
                                        offset: const Offset(0, -32),
                                        child: Container(
                                          width: 56,
                                          height: 56,
                                          clipBehavior: Clip.antiAlias,
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(16),
                                            border: Border.all(color: a.surface, width: 3),
                                          ),
                                          child: CommerceImage(v.logoUrl!),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                    ],
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            v.name,
                                            style: TextStyle(fontSize: 17.5, fontWeight: FontWeight.w800, letterSpacing: -0.175, color: a.ink),
                                          ),
                                          if (v.address != null)
                                            Padding(
                                              padding: const EdgeInsets.only(top: 4),
                                              child: Row(
                                                children: [
                                                  AIcon(AIcons.mapPin, size: 12, color: a.inkSoft),
                                                  const SizedBox(width: 4),
                                                  Expanded(
                                                    child: Text(v.address!, style: TextStyle(fontSize: 11.5, color: a.inkSoft)),
                                                  ),
                                                ],
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: a.peach1,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: const Color.fromRGBO(255, 157, 99, 0.4)), // PartnersScreen literal
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        cssUpperText(tr('partnersscreen_senin_endirimin_535d41', 'Sənin endirimin')),
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: a.accentInk),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        v.discountLabel,
                                        style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, letterSpacing: -0.42, color: a.accentInk),
                                      ),
                                      if (v.discountTerms != null)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(v.discountTerms!, style: TextStyle(fontSize: 11, color: a.inkSoft)),
                                        ),
                                    ],
                                  ),
                                ),
                                if (v.description != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: Text(v.description!, style: TextStyle(fontSize: 13, height: 1.625, color: a.bodyText)),
                                  ),
                                if (actions.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 16),
                                    child: Row(
                                      children: [
                                        for (var i = 0; i < actions.length; i++) ...[if (i > 0) const SizedBox(width: 8), actions[i]],
                                      ],
                                    ),
                                  ),
                                if (v.galleryUrls != null && v.galleryUrls!.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 16),
                                    child: SingleChildScrollView(
                                      scrollDirection: Axis.horizontal,
                                      child: Row(
                                        children: [
                                          for (final g in v.galleryUrls!)
                                            Padding(
                                              padding: const EdgeInsetsDirectional.only(end: 8),
                                              child: ClipRRect(borderRadius: BorderRadius.circular(14), child: CommerceImage(g, width: 112, height: 112)),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: EdgeInsets.fromLTRB(16, 16, 16, bottom > 16 ? bottom : 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [a.bg, a.bg, a.bg.withValues(alpha: 0)],
                    stops: const [0, 0.55, 1],
                  ),
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 448),
                    child: PressScale.css(
                      key: const ValueKey('venue-redeem'),
                      onTap: onRedeem,
                      child: Container(
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: a.peach2,
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: const [BoxShadow(offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12, color: Color.fromRGBO(217, 108, 74, 0.55))],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AIcon(isPremium ? AIcons.sparkles : AIcons.lock, size: 20, color: const Color(0xFFFFFFFF)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                isPremium
                                    ? tr('untranslated_endirimi_al_qr_yarat_6yd90i', 'Endirimi al — QR yarat')
                                    : tr('partnersscreen_premium_ile_endirim_al_634879', 'Premium ilə endirim al'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// JS `${number}` of a coordinate column.
String _num(Object? v) => v is num ? (v == v.truncate() ? '${v.truncate()}' : '$v') : '$v';

/// `<RedemptionQRSheet open onClose venueId venueName />`.
Future<void> showRedemptionQrSheet(BuildContext context, {required String venueId, required String venueName}) => showGeneralDialog<void>(
  context: context,
  barrierDismissible: true,
  barrierLabel: venueName,
  barrierColor: const Color(0xCC000000),
  transitionDuration: Duration.zero,
  pageBuilder: (ctx, _, _) => Align(
    alignment: Alignment.bottomCenter,
    child: RedemptionQrSheet(venueId: venueId, venueName: venueName),
  ),
);

class RedemptionQrSheet extends ConsumerStatefulWidget {
  const RedemptionQrSheet({super.key, required this.venueId, required this.venueName, this.now});
  final String venueId;
  final String venueName;

  /// Clock (tests).
  final DateTime Function()? now;

  @override
  ConsumerState<RedemptionQrSheet> createState() => _RedemptionQrSheetState();
}

class _RedemptionQrSheetState extends ConsumerState<RedemptionQrSheet> {
  RedemptionResponse? _data;
  bool _loading = false;
  String? _error;
  Timer? _tick;

  DateTime _now() => widget.now?.call() ?? DateTime.now();

  Future<void> _generate() async {
    setState(() {
      _loading = true;
      _error = null;
      _data = null;
    });
    try {
      final r = await createRedemption(ref.read(commerceBackendProvider), widget.venueId);
      if (mounted) setState(() => _data = r);
    } catch (e) {
      final msg = e is RedemptionException && e.message.isNotEmpty ? e.message : tr('redemptionqrsheet_xeta_3cdbb6', 'Xəta');
      final map = {
        'premium_required': tr('redemptionqrsheet_bu_funksiya_yalniz_premium_uzv_ee315c', 'Bu funksiya yalnız Premium üzvlər üçündür.'),
        'cooldown': tr('redemptionqrsheet_bu_mekanda_hele_endirim_istifa_a25eb8', 'Bu məkanda hələ endirim istifadə etmisiniz. Bir az gözləyin.'),
        'lifetime_limit_reached': tr('redemptionqrsheet_bu_mekan_ucun_endirim_limiti_d_17dc4d', 'Bu məkan üçün endirim limiti dolub.'),
        'venue_inactive': tr('redemptionqrsheet_mekan_muveqqeti_olaraq_aktiv_d_e2b19d', 'Məkan müvəqqəti olaraq aktiv deyil.'),
        'venue_not_found': tr('redemptionqrsheet_mekan_tapilmadi_028fb4', 'Məkan tapılmadı.'),
      };
      if (mounted) setState(() => _error = map[msg] ?? msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    unawaited(_generate());
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final data = _data;
    final expiresMs = data == null ? 0 : (DateTime.tryParse(data.expiresAt)?.millisecondsSinceEpoch ?? 0);
    final remaining = data == null ? 0 : ((expiresMs - _now().millisecondsSinceEpoch) / 1000).floor().clamp(0, 1 << 30);
    final expired = data != null && remaining <= 0;
    final mq = MediaQuery.of(context);
    final (Color pillBg, Color pillFg) = expired
        ? (s.destructive.withValues(alpha: 0.15), s.destructive)
        : remaining < 60
        ? (const Color(0xFFFEF3C7), const Color(0xFFB45309)) // bg-amber-100 text-amber-700
        : (s.primary.withValues(alpha: 0.1), s.primary);
    return AScope(
      child: Container(
        key: const ValueKey('redemption-sheet'),
        width: double.infinity,
        constraints: BoxConstraints(maxHeight: mq.size.height * 0.92),
        decoration: BoxDecoration(
          color: s.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 32 + mq.padding.bottom),
          child: Stack(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 48,
                    height: 6,
                    decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(999)),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AIcon(AIcons.sparkles, size: 16, color: s.primary),
                      const SizedBox(width: 8),
                      Text(
                        cssUpperText(tr('untranslated_anacan_endirimi_eg7euj', 'Anacan Endirimi')),
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: s.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.venueName,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: s.foreground),
                  ),
                  if (data != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4, bottom: 16),
                      child: Text(data.discountLabel, style: TextStyle(fontSize: 14, color: s.mutedForeground)),
                    ),
                  if (_loading)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          ARingSpinner(size: 40, color: s.primary, width: 4),
                          const SizedBox(height: 12),
                          Text(tr('redemptionqrsheet_qr_yaradilir_a37052', 'QR yaradılır...'), style: TextStyle(fontSize: 14, color: s.mutedForeground)),
                        ],
                      ),
                    ),
                  if (_error != null && !_loading)
                    Container(
                      key: const ValueKey('redemption-error'),
                      margin: const EdgeInsets.symmetric(vertical: 16),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: s.destructive.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: s.destructive.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        children: [
                          AIcon(AIcons.circleAlert, size: 32, color: s.destructive),
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: s.destructive),
                          ),
                          const SizedBox(height: 12),
                          ShadButton(
                            variant: ShadButtonVariant.outline,
                            height: 36,
                            onPressed: () => unawaited(_generate()),
                            child: Text(tr('redemptionqrsheet_yeniden_cehd_et_d273ac', 'Yenidən cəhd et')),
                          ),
                        ],
                      ),
                    ),
                  if (data != null && _error == null) ...[
                    Container(
                      margin: const EdgeInsets.symmetric(vertical: 12),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: s.primary.withValues(alpha: 0.2), width: 4),
                        boxShadow: const [BoxShadow(offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3, color: Color(0x1A000000))],
                      ),
                      child: ref.watch(qrCodeBuilderProvider)(context, data.verifyUrl, 240),
                    ),
                    Container(
                      key: const ValueKey('redemption-timer'),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(color: pillBg, borderRadius: BorderRadius.circular(999)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AIcon(expired ? AIcons.circleAlert : AIcons.circleCheck, size: 16, color: pillFg),
                          const SizedBox(width: 8),
                          Text(
                            expired
                                ? tr('redemptionqrsheet_muddeti_bitdi_463a85', 'Müddəti bitdi')
                                : 'Qalan vaxt: ${remaining ~/ 60}:${(remaining % 60).toString().padLeft(2, '0')}',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: pillFg),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: Text(
                        tr(
                          'redemptionqrsheet_kassir_telefonun_kamerasi_ile__45af84',
                          'Kassir telefonun kamerası ilə bu QR-ı oxuyacaq və PIN kodunu daxil edərək təsdiqləyəcək.',
                        ),
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, height: 1.625, color: s.mutedForeground),
                      ),
                    ),
                    if (expired)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: ShadButton(
                          key: const ValueKey('redemption-new'),
                          expand: true,
                          height: 44,
                          onPressed: () => unawaited(_generate()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AIcon(AIcons.refreshCw, size: 16, color: s.primaryForeground),
                              const SizedBox(width: 8),
                              Text(tr('redemptionqrsheet_yeni_qr_yarat_f123bc', 'Yeni QR yarat')),
                            ],
                          ),
                        ),
                      ),
                  ],
                ],
              ),
              PositionedDirectional(
                top: -8,
                end: -8,
                child: GestureDetector(
                  key: const ValueKey('redemption-close'),
                  onTap: () => Navigator.of(context).maybePop(),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                    child: Center(child: AIcon(AIcons.x, size: 16, color: a.ink)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String cssUpperText(String s) => s.toUpperCase();
