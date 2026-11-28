// Ported from: src/components/ProfileScreen.tsx, src/components/profile/ProfileTabs.tsx (layout), anacan-design.css
//              (.a-cta, .a-rank-*, .a-teaser, .a-list-card, .a-cta-btn, .a-section)
//
// Mother profile tab. Layout from app_settings `profile_layout`: tabs (default) or the classic long page.
// Admin → web admin (shell.openAdminWeb); moderator console → web; moderation history stays in-app.
import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/dates/local_date.dart';
import '../../shell/nav/admin_web.dart';
import '../../shell/nav/shell_controller.dart';
import '../../shell/shell_inputs.dart';
import '../../state/state.dart';
import '../settings/copy/countries.g.dart';
import '../settings/copy/feature_copy.dart';
import '../settings/ui/settings_ui.dart';
import '../support/feedback_sheet.dart';
import 'data/children.dart';
import 'profile_interfaces.dart';
import 'widgets/language_selector.dart';
import 'widgets/profile_tabs.dart';

/// `sessionStorage['anacan_profile_tab']` (process memory, like sessionStorage in the WebView).
ProfileTab _sessionProfileTab = ProfileTab.me;

@visibleForTesting
void resetProfileSessionTab() => _sessionProfileTab = ProfileTab.me;

/// Remote avatar image (overridable so tests do not hit the network).
final profileAvatarBuilderProvider = Provider<Widget Function(String url)>(
  (ref) => (url) => CachedNetworkImage(imageUrl: url, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox.shrink()),
);

/// Opens the web moderator console (`/moderator` on the admitted public host).
final moderatorWebOpenerProvider = Provider<VoidCallback>((ref) => () {
      String? backend;
      try {
        backend = ref.read(shellUserProvider).backendUrl;
      } catch (_) {}
      final uri = adminWebUri(backendUrl: backend).replace(path: '/moderator', query: '');
      unawaited(launchUrl(Uri.parse(uri.toString().replaceFirst(RegExp(r'\?$'), '')), mode: LaunchMode.externalApplication));
    });

// Doğum həftəsi ↔ EDD (PrematurityBackfillCard ilə eyni düstur), in UTC.
const int kTermWeeks = 40;
const int _dayMs = 86400000;

int? gestWeeksFromDueDate(String birthDate, String? dueDate) {
  if (birthDate.isEmpty || dueDate == null || dueDate.isEmpty) return null;
  final b = DateTime.tryParse('${birthDate}T00:00:00Z');
  final d = DateTime.tryParse('${dueDate}T00:00:00Z');
  if (b == null || d == null) return null;
  final gestDays = 280 - ((d.millisecondsSinceEpoch - b.millisecondsSinceEpoch) / _dayMs).round();
  return gestDays >= 37 * 7 ? kTermWeeks : (gestDays / 7).floor().clamp(22, 1 << 30);
}

String dueDateFromGestWeeks(String birthDate, int weeks) {
  if (weeks == kTermWeeks) return birthDate;
  final b = DateTime.parse('${birthDate}T00:00:00Z');
  return DateTime.fromMillisecondsSinceEpoch(b.millisecondsSinceEpoch + (280 - weeks * 7) * _dayMs, isUtc: true).toIso8601String().split('T').first;
}

class _ChildForm {
  _ChildForm({this.name = '', this.birthDate = '', this.gender = 'boy', this.gestWeeks});
  String name;
  String birthDate;
  String gender;
  int? gestWeeks;
}

({String name, String emoji}) _stageInfo(String? lifeStage, String language) => switch (lifeStage) {
      'flow' => (name: lifeStageName('flow', language), emoji: '🌸'),
      'bump' => (name: lifeStageName('bump', language), emoji: '🤰'),
      'mommy' => (name: lifeStageName('mommy', language), emoji: '👶'),
      _ => (name: tr('profilescreen_secilmeyib_11e27e', 'Seçilməyib'), emoji: '✨'),
    };

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.onNavigate});

  /// Index `navigateScreen`; defaults to the shell controller.
  final ValueChanged<String>? onNavigate;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late ProfileTab _tab = _sessionProfileTab;
  String? _partnerCode;

  void _navigate(String id) {
    if (widget.onNavigate != null) {
      widget.onNavigate!(id);
      return;
    }
    final shell = ref.read(shellProvider.notifier);
    if (id == 'admin') {
      shell.openAdminWeb();
    } else if (id == 'moderator') {
      ref.read(moderatorWebOpenerProvider)();
    } else {
      shell.navigateScreen(id);
    }
  }

  void _pickRow(String id) {
    if (id == 'feedback') {
      unawaited(showFeedbackSheet(context));
    } else if (id == 'gift-code') {
      final open = ref.read(profileSlotsProvider).promoDialog;
      if (open != null) unawaited(open(context));
    } else {
      _navigate(id);
    }
  }

  void _chooseTab(ProfileTab tab) {
    setState(() => _tab = tab);
    _sessionProfileTab = tab;
  }

  void _premium() => unawaited(ref.read(premiumPromptProvider).show(context));

  Future<String?> _codeForSharing() async {
    var code = _partnerCode ?? ref.read(authProfileProvider)?.partnerCode ?? 'ANACAN-XXXX';
    if (ref.read(partnerPairingEnabledProvider)) {
      try {
        final actions = ref.read(accountActionsProvider);
        code = await actions.partnerCodeForSharing(code);
        if (mounted) setState(() => _partnerCode = code);
        await actions.refreshProfile();
      } catch (error) {
        if (mounted) toasts(context).show(title: partnerLinkErrorText(error), destructive: true);
        return null;
      }
    }
    return code;
  }

  Future<void> _copyPartnerCode() async {
    final code = await _codeForSharing();
    if (code == null) return;
    await ref.read(shareServiceProvider).share(
          title: tr('profile_partnyor_kodu', 'Partnyor Kodu'),
          text: '${tr('profile_partnyor_kodum', 'Partnyor kodum')}: $code',
        );
  }

  Future<void> _sharePartnerCode() async {
    final code = await _codeForSharing();
    if (code == null) return;
    final shareUrl = ref.read(partnerPairingEnabledProvider) ? ref.read(appOriginProvider) : 'https://anacanapp.lovable.app';
    final text =
        '${tr('profile_share_partner_text', 'Anacan tətbiqinə qoşul və hamiləlik səyahətimizdə mənə dəstək ol! Partnyor kodum:')} $code\n\n${tr('profile_download_app', 'Tətbiqi yüklə:')} $shareUrl';
    final ok = await ref.read(shareServiceProvider).share(title: tr('profile_partnyor_kodu', 'Partnyor Kodu'), text: text);
    if (ok && mounted) {
      toasts(context).show(
        title: tr('profilescreen_paylasildi_c7d9ef', 'Paylaşıldı!'),
        description: tr('profilescreen_partnyor_kodu_ugurla_paylasildi_d66277', 'Partnyor kodu uğurla paylaşıldı.'),
      );
    }
  }

  Future<void> _confirmLogout() async {
    final ok = await showShadDialog<bool>(context, builder: (ctx) => const _LogoutDialog());
    if (ok != true || !mounted) return;
    final toast = toasts(context);
    await ref.read(accountActionsProvider).signOut();
    toast.show(title: tr('profilescreen_cixis_edildi_fb4a43', 'Çıxış edildi'), description: tr('profilescreen_ugurla_cixis_etdiniz_9e8d3c', 'Uğurla çıxış etdiniz.'));
  }

  void _openPartnerInfo() => unawaited(showGeneralDialog<void>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'partner-info',
        barrierColor: const Color(0x80000000),
        transitionDuration: const Duration(milliseconds: 300),
        pageBuilder: (ctx, _, _) => const _PartnerInfoSheet(),
        transitionBuilder: (ctx, anim, _, child) => SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: ACurves.framerDefault)),
          child: child,
        ),
      ));

  Future<void> _openChildDialog({Child? editing}) async {
    await showShadDialog<void>(context, builder: (ctx) => _ChildDialog(editing: editing));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final language = store.language;
    final lifeStage = store.lifeStage;
    final profile = ref.watch(authProfileProvider);
    final isAdmin = ref.watch(isAdminProvider);
    final isModerator = ref.watch(isModeratorProvider);
    final isPremium = ref.watch(subscriptionIsPremiumProvider);
    final recap = ref.watch(recapProfileRowProvider);
    final qc = ref.watch(qaygiCashRowProvider);
    final slots = ref.watch(profileSlotsProvider);
    final tabsLayout = ref.watch(profileLayoutSettingProvider) != 'classic';
    final stage = _stageInfo(lifeStage, language);
    final promo = promoText(language);
    final feedback = feedbackText(language);
    final widgets = widgetText(language);
    final showWidgets = lifeStage == 'bump' || lifeStage == 'mommy';
    final displayName = (profile?.name.isNotEmpty ?? false) ? profile!.name : (store.name?.isNotEmpty ?? false) ? store.name! : tr('profilescreen_i_stifadeci_b6bdd6', 'İstifadəçi');
    final avatarBuilder = ref.watch(profileAvatarBuilderProvider);

    (Color, Color) t(Color bg, Color ink) => (bg, ink);
    final adminRows = <ProfileRow>[
      ProfileRow(id: 'moderation-history', icon: AIcons.shield, label: moderatorText('user_history', language)),
      if (isModerator || isAdmin) ProfileRow(id: 'moderator', icon: AIcons.shieldCheck, label: moderatorText('open_panel', language)),
      if (isAdmin) ...<ProfileRow>[
        ProfileRow(id: 'shop', icon: AIcons.shoppingCart, label: tr('profilescreen_magaza_test_72b060', 'Mağaza (Test)'), badge: 'Beta'),
        ProfileRow(id: 'admin', icon: AIcons.shieldCheck, label: tr('profilescreen_admin_panel', 'Admin Panel'), badge: 'Admin'),
      ],
    ];
    final meRows = <ProfileRow>[
      ProfileRow(
        id: 'billing',
        icon: AIcons.creditCard,
        label: tr('profilescreen_abuneliyim_f6c8ed', 'Abunəliyim'),
        sub: isPremium ? tr('profilescreen_premium_abuneliyiniz_aktivdir_9f6e62', 'Premium abunəliyiniz aktivdir') : tr('profilescreen_butun_xususiyyetleri_acin_a7583b', 'Bütün xüsusiyyətləri açın'),
        tint: t(a.yellow1, a.warnInk),
      ),
      if (recap != null) ProfileRow(id: recap.id, icon: AIcons.clapperboard, label: recap.label, sub: recap.sub, tint: t(a.pink1, a.pinkInk)),
      if (qc != null) ProfileRow(id: 'qaygicash', icon: AIcons.coins, label: qc.label, sub: qc.sub, tint: t(a.peach1, a.accentInk)),
      ProfileRow(id: 'referral', icon: AIcons.gift, label: tr('profilescreen_referral', 'Dostunu dəvət et'), badge: tr('profilescreen_referral_badge', '+7 gün'), tint: t(a.green1, a.greenInk)),
      ProfileRow(id: 'gift-code', icon: AIcons.ticket, label: promo('profile_title'), sub: promo('profile_sub'), tint: t(a.peach1, a.accentInk)),
      ProfileRow(id: 'partners', icon: AIcons.sparkles, label: tr('profilescreen_partnyor_endirimleri_e44036', 'Partnyor Endirimləri'), badge: tr('profilescreen_badge_yeni', 'Yeni'), tint: t(a.pink1, a.pinkInk)),
      ProfileRow(id: 'doctor-report', icon: AIcons.fileText, label: tr('profilescreen_hekim_hesabati', 'Həkim Hesabatı (PDF)'), tint: t(a.blue1, a.blueInk)),
    ];
    final settingsRows = <ProfileRow>[
      // `var(--a-lilac-1, var(--a-surface-soft))`: --a-lilac-* is not defined → the fallbacks.
      ProfileRow(id: 'appearance', icon: AIcons.palette, label: tr('profilescreen_gorunus_165fe3', 'Görünüş'), sub: tr('profiletabs_appearance_sub', 'Tema və şrift ölçüsü'), tint: t(a.surfaceSoft, a.inkSoft)),
      ProfileRow(id: 'calendar', icon: AIcons.calendar, label: tr('profilescreen_teqvim_ayarlari_012790', 'Təqvim Ayarları'), sub: tr('profiletabs_calendar_sub', 'Xatırlatmalar və tarixlər'), tint: t(a.yellow1, a.warnInk)),
      ProfileRow(id: 'health-sync', icon: AIcons.heartPulse, label: tr('settingsscreen_health_sync', 'Sağlamlıq inteqrasiyası'), tint: t(a.pink1, a.pinkInk)),
      if (showWidgets) ProfileRow(id: 'widgets', icon: AIcons.layoutGrid, label: widgets('settings_title'), tint: t(a.blue1, a.blueInk)),
      ProfileRow(id: 'privacy', icon: AIcons.shield, label: tr('profilescreen_gizlilik', 'Gizlilik'), sub: tr('profiletabs_privacy_sub', 'Razılıq, analitika, məlumatlar'), tint: t(a.green1, a.greenInk)),
      ProfileRow(id: 'feedback', icon: AIcons.messageCircle, label: feedback('menu')),
      ProfileRow(id: 'help', icon: AIcons.circleHelp, label: tr('profilescreen_yardim_da857a', 'Yardım')),
      ...adminRows,
    ];
    final legalRows = <ProfileRow>[
      ProfileRow(id: 'legal/privacy_policy', icon: AIcons.fileText, label: tr('profilescreen_gizlilik_siyaseti_dc3f28', 'Gizlilik Siyasəti')),
      ProfileRow(id: 'legal/terms_of_service', icon: AIcons.scale, label: tr('profilescreen_i_stifade_sertleri_fbbe3d', 'İstifadə Şərtləri')),
      ProfileRow(id: 'legal/disclaimer', icon: AIcons.circleAlert, label: tr('profilescreen_mesuliyyetden_i_mtina_beyanati_857abd', 'Məsuliyyətdən İmtina Bəyanatı')),
      ProfileRow(id: 'legal/refund_policy', icon: AIcons.rotateCcw, label: tr('profilescreen_geri_qaytarma_siyaseti_767324', 'Geri Qaytarma Siyasəti')),
      const ProfileRow(id: 'legal/gdpr_ccpa', icon: AIcons.shield, label: 'GDPR / CCPA'),
      ProfileRow(id: 'legal/data_usage', icon: AIcons.database, label: tr('profilescreen_melumat_i_stifadesi_af1211', 'Məlumat İstifadəsi')),
    ];
    final menuItems = <ProfileRow>[
      ProfileRow(id: 'billing', icon: AIcons.creditCard, label: tr('profilescreen_abuneliyim_f6c8ed', 'Abunəliyim')),
      if (recap != null) ProfileRow(id: recap.id, icon: AIcons.clapperboard, label: recap.label, badge: '✨'),
      if (qc != null) ProfileRow(id: 'qaygicash', icon: AIcons.coins, label: qc.label, badge: qc.badge),
      ProfileRow(id: 'referral', icon: AIcons.gift, label: tr('profilescreen_referral', 'Dostunu dəvət et'), badge: tr('profilescreen_referral_badge', '+7 gün')),
      ProfileRow(id: 'gift-code', icon: AIcons.ticket, label: promo('profile_title')),
      ProfileRow(id: 'partners', icon: AIcons.sparkles, label: tr('profilescreen_partnyor_endirimleri_e44036', 'Partnyor Endirimləri'), badge: tr('profilescreen_badge_yeni', 'Yeni')),
      ProfileRow(id: 'doctor-report', icon: AIcons.fileText, label: tr('profilescreen_hekim_hesabati', 'Həkim Hesabatı (PDF)')),
      ProfileRow(id: 'health-sync', icon: AIcons.heartPulse, label: tr('settingsscreen_health_sync', 'Sağlamlıq inteqrasiyası')),
      if (showWidgets) ProfileRow(id: 'widgets', icon: AIcons.layoutGrid, label: widgets('settings_title')),
      ProfileRow(id: 'appearance', icon: AIcons.palette, label: tr('profilescreen_gorunus_165fe3', 'Görünüş')),
      ProfileRow(id: 'calendar', icon: AIcons.calendar, label: tr('profilescreen_teqvim_ayarlari_012790', 'Təqvim Ayarları')),
      ProfileRow(id: 'privacy', icon: AIcons.shield, label: tr('profilescreen_gizlilik', 'Gizlilik')),
      ProfileRow(id: 'feedback', icon: AIcons.messageCircle, label: feedback('menu')),
      ProfileRow(id: 'help', icon: AIcons.circleHelp, label: tr('profilescreen_yardim_da857a', 'Yardım')),
      ...adminRows,
    ];

    final premiumBlock = _PremiumBanner(isPremium: isPremium, onTap: () => isPremium ? _navigate('billing') : _premium());
    final qcBlock = slots.qaygiCashCard?.call(context, () => _navigate('qaygicash'));
    final pregnancyBlock = slots.pregnancyCard?.call(context, _navigate);
    final partnerBlock = store.role == 'woman'
        ? _PartnerCodeCard(
            code: _partnerCode ?? profile?.partnerCode ?? 'ANACAN-XXXX',
            isPremium: isPremium,
            linked: profile?.linkedPartnerId != null,
            onCopy: _copyPartnerCode,
            onShare: _sharePartnerCode,
            onPremium: _premium,
            onInfo: _openPartnerInfo,
            onSharing: () => _navigate('partner-sharing'),
          )
        : null;
    final childrenBlock = lifeStage == 'mommy' ? _ChildrenCard(onAdd: () => _openChildDialog(), onEdit: (c) => _openChildDialog(editing: c)) : null;
    final languageBlock = const Padding(padding: EdgeInsets.only(top: 12), child: FadeRise(dy: 0, delay: Duration(milliseconds: 400), child: LanguageSelector()));
    final logoutBlock = _LogoutButton(onTap: _confirmLogout);

    final List<Widget> body;
    if (tabsLayout) {
      body = <Widget>[
        ProfileTabs(
          tab: _tab,
          onTab: _chooseTab,
          name: displayName,
          avatarUrl: profile?.avatarUrl,
          emoji: stage.emoji,
          badge: '${isPremium ? 'Premium · ' : ''}${stage.name}',
          onEdit: () => _navigate('edit-profile'),
          avatarBuilder: avatarBuilder,
          showFamily: lifeStage == 'mommy' || store.role == 'woman',
          me: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            premiumBlock,
            ?qcBlock,
            ?pregnancyBlock,
            ProfileRows(rows: meRows, onPick: _pickRow),
          ]),
          family: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[?childrenBlock, ?partnerBlock]),
          settings: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ProfileRows(rows: settingsRows, onPick: _pickRow),
            languageBlock,
            ProfileRows(rows: legalRows, onPick: _pickRow, compact: true, title: tr('profilescreen_huquqi_ceb5d3', 'Hüquqi')),
            logoutBlock,
          ]),
        ),
      ];
    } else {
      final country = kCountries.where((c) => c.$1 == profile?.countryCode).firstOrNull;
      body = <Widget>[
        _Hero(
          name: displayName,
          email: (profile?.email?.isNotEmpty ?? false) ? profile!.email! : (store.email?.isNotEmpty ?? false) ? store.email! : 'email@example.com',
          stage: stage,
          country: country,
          isAdmin: isAdmin,
          avatarUrl: profile?.avatarUrl,
          avatarBuilder: avatarBuilder,
          onEdit: () => _navigate('edit-profile'),
        ),
        premiumBlock,
        ?qcBlock,
        ?partnerBlock,
        ?pregnancyBlock,
        ?childrenBlock,
        _ClassicMenu(rows: menuItems, onPick: _pickRow),
        languageBlock,
        logoutBlock,
        _ClassicLegal(rows: legalRows, onPick: _navigate),
      ];
    }

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            FadeRise(
              dy: -20,
              child: ATopbar(
                eyebrow: stage.name,
                title: tr('untranslated_profil_v8b0sk', 'Profil'),
                titleSize: 18,
                actions: <Widget>[
                  AIconBtn(
                    key: const ValueKey<String>('profile-settings'),
                    size: 44,
                    onTap: () => _navigate('settings'),
                    icon: const AIcon(AIcons.settings, size: 16),
                  ),
                ],
              ),
            ),
            if (slots.bannerSlot != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: slots.bannerSlot!(context, 'profile_top', _navigate)),
            ...body,
          ]),
        ),
      ),
    );
  }
}

class _PremiumBanner extends StatelessWidget {
  const _PremiumBanner({required this.isPremium, required this.onTap});
  final bool isPremium;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: FadeRise(
        delay: const Duration(milliseconds: 200),
        child: PressScale(
          scale: 0.98,
          onTap: onTap,
          child: Semantics(
            button: true,
            child: ACard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Row(children: <Widget>[
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(13)),
                  child: AIcon(AIcons.crown, size: 18, color: a.warnInk),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    Text(trInline('ProfileScreen.tsx', isPremium ? 'Anacan Premium ✨' : 'Anacan Premium'), style: px(13, weight: FontWeight.w700, color: a.ink)),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        isPremium ? tr('profilescreen_premium_abuneliyiniz_aktivdir_9f6e62', 'Premium abunəliyiniz aktivdir') : tr('profilescreen_butun_xususiyyetleri_acin_a7583b', 'Bütün xüsusiyyətləri açın'),
                        style: px(11, weight: FontWeight.w500, color: a.inkSoft),
                      ),
                    ),
                  ]),
                ),
                AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// `.a-teaser` with the inline overrides (flex, gap 8, dashed top border).
class _Teaser extends StatelessWidget {
  const _Teaser({required this.icon, required this.iconColor, required this.label, required this.onTap, this.keyName});
  final AIconData icon;
  final Color iconColor;
  final String label;
  final VoidCallback onTap;
  final String? keyName;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return PressScale(
      key: keyName == null ? null : ValueKey<String>(keyName!),
      scale: 0.98,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(top: 14),
        child: CustomPaint(
          painter: DashedTopBorder(a.lineStrong),
          child: Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Row(children: <Widget>[
              AIcon(icon, size: 15, color: iconColor),
              const SizedBox(width: 8),
              Expanded(child: Text(label, style: px(12, color: a.inkSoft, height: 1.55))),
              const SizedBox(width: 8),
              AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
            ]),
          ),
        ),
      ),
    );
  }
}

/// `border-top: 1px dashed` (Chromium dash ≈ 3px on / 3px off for 1px width).
class DashedTopBorder extends CustomPainter {
  DashedTopBorder(this.color, {this.width = 1, this.all = false, this.radius = 0});
  final Color color;
  final double width;
  final bool all;
  final double radius;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke;
    final path = all
        ? (Path()..addRRect(RRect.fromRectAndRadius((Offset.zero & size).deflate(width / 2), Radius.circular(radius))))
        : (Path()
          ..moveTo(0, width / 2)
          ..lineTo(size.width, width / 2));
    final dash = 3 * width;
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += dash * 2) {
        canvas.drawPath(m.extractPath(d, (d + dash).clamp(0, m.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(DashedTopBorder old) => old.color != color;
}

class _PartnerCodeCard extends StatelessWidget {
  const _PartnerCodeCard({
    required this.code,
    required this.isPremium,
    required this.linked,
    required this.onCopy,
    required this.onShare,
    required this.onPremium,
    required this.onInfo,
    required this.onSharing,
  });
  final String code;
  final bool isPremium;
  final bool linked;
  final VoidCallback onCopy;
  final VoidCallback onShare;
  final VoidCallback onPremium;
  final VoidCallback onInfo;
  final VoidCallback onSharing;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget codeText = Text(
      code,
      textAlign: TextAlign.center,
      style: TextStyle(fontFamily: 'monospace', fontFamilyFallback: const <String>['Courier'], fontWeight: FontWeight.w700, fontSize: 18, height: 28 / 18, letterSpacing: 0.05 * 18, color: a.ink),
    );
    if (!isPremium) codeText = ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 2, sigmaY: 2), child: codeText);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: FadeRise(
        delay: const Duration(milliseconds: 250),
        child: ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: <Widget>[
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
                  child: AIcon(AIcons.heart, size: 17, color: a.berryInk),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    Row(children: <Widget>[
                      Text(tr('profile_partnyor_kodu', 'Partnyor Kodu'), style: x.aListTitle),
                      if (!isPremium) ...<Widget>[const SizedBox(width: 6), AIcon(AIcons.crown, size: 13, color: a.yellow2)],
                    ]),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        isPremium ? tr('profilescreen_heyat_yoldasinizla_paylasin_49ec6d', 'Həyat yoldaşınızla paylaşın') : tr('profilescreen_premium_ile_partnyorunuzu_deve_d6917f', 'Premium ilə partnyorunuzu dəvət edin'),
                        style: x.aListSub,
                      ),
                    ),
                  ]),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
              child: Stack(clipBehavior: Clip.none, children: <Widget>[
                Row(children: <Widget>[
                  Expanded(child: codeText),
                  if (isPremium) ...<Widget>[
                    const SizedBox(width: 8),
                    AIconBtn(key: const ValueKey<String>('partner-code-copy'), onTap: onCopy, icon: const AIcon(AIcons.copy, size: 16)),
                    const SizedBox(width: 8),
                    AIconBtn(
                      key: const ValueKey<String>('partner-code-share'),
                      onTap: onShare,
                      background: a.peach2,
                      foreground: const Color(0xFFFFFFFF),
                      border: false,
                      icon: const AIcon(AIcons.share2, size: 16),
                    ),
                  ],
                ]),
                if (!isPremium)
                  Positioned(
                    left: -12,
                    right: -12,
                    top: -12,
                    bottom: -12,
                    child: PressScale(
                      key: const ValueKey<String>('partner-code-unlock'),
                      scale: 0.97,
                      onTap: onPremium,
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(16)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                          AIcon(AIcons.crown, size: 15, strokeWidth: 2.2, color: a.warnInk),
                          const SizedBox(width: 8),
                          Text(tr('profilescreen_premium_ile_ac_7aa6ba', 'Premium ilə aç'), style: px(13, weight: FontWeight.w800, color: a.warnInk)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
            _Teaser(icon: AIcons.info, iconColor: a.pink2, label: tr('profilescreen_partnyor_neler_gore_ve_ede_biler_3fa7fa', 'Partnyor nələr görə və edə bilər?'), onTap: onInfo, keyName: 'partner-info'),
            _Teaser(
              icon: AIcons.shield,
              iconColor: a.blue2,
              label: linked ? tr('partnerv2_partnyor_nleri_gorur', 'Partnyor nələri görür?') : feature37Text('ph_what_sees'),
              onTap: onSharing,
              keyName: 'partner-sharing',
            ),
          ]),
        ),
      ),
    );
  }
}

class _PartnerInfoSheet extends StatelessWidget {
  const _PartnerInfoSheet();
  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final maxH = MediaQuery.sizeOf(context).height * 0.85;
    Widget item(AIconData icon, String text, Color color) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
          child: Row(children: <Widget>[
            AIcon(icon, size: 20, color: color),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: Tw.sm.copyWith(color: s.foreground))),
          ]),
        );
    Widget heading(String text) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(text, style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: s.foreground)),
        );
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: GestureDetector(
          onTap: () {},
          child: Material(
            type: MaterialType.transparency,
            child: AScope(
              child: Container(
                constraints: BoxConstraints(maxWidth: 512, maxHeight: maxH),
                decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
                clipBehavior: Clip.antiAlias,
                child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: s.card, border: Border(bottom: BorderSide(color: s.border))),
                    child: Row(children: <Widget>[
                      Expanded(child: Text(tr('profilescreen_partnyor_rejimi_haqqinda_7eeca8', 'Partnyor Rejimi Haqqında'), style: Tw.lg.copyWith(fontWeight: FontWeight.w700, color: s.foreground))),
                      PressScale(
                        scale: 0.9,
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                          child: AIcon(AIcons.x, size: 16, color: s.foreground),
                        ),
                      ),
                    ]),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
                      child: VGap(gap: 24, children: <Widget>[
                        Column(children: <Widget>[
                          Container(
                            width: 64,
                            height: 64,
                            margin: const EdgeInsets.only(bottom: 12),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: s.partner.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
                            child: AIcon(AIcons.heart, size: 32, color: s.partner),
                          ),
                          Text(
                            tr('profilescreen_partnyor_kodu_ile_heyat_yoldas_2bcf5d', 'Partnyor kodu ilə həyat yoldaşınız tətbiqə qoşularaq hamiləlik səyahətinizə dəstək ola bilər.'),
                            textAlign: TextAlign.center,
                            style: Tw.base.copyWith(color: s.mutedForeground),
                          ),
                        ]),
                        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                          heading(tr('profilescreen_partnyor_neleri_gore_biler_c11f93', '👁️ Partnyor nələri görə bilər?')),
                          VGap(gap: 8, children: <Widget>[
                            item(AIcons.baby, tr('profilescreen_korpenin_heftelik_inkisafi_ve_olculeri_0474b5', 'Körpənin həftəlik inkişafı və ölçüləri'), s.primary),
                            item(AIcons.trendingUp, tr('profilescreen_sizin_gundelik_ehvaliniz_ve_simptomlarin_8fde56', 'Sizin gündəlik əhvalınız və simptomlarınız'), s.primary),
                            item(AIcons.calendar, tr('profilescreen_hekim_gorusleri_ve_vacib_tarixler_a345c4', 'Həkim görüşləri və vacib tarixlər'), s.primary),
                            item(AIcons.heart, tr('profilescreen_tepik_saygaci_ve_buzusme_izleyicisi_melu_7f7ba1', 'Təpik sayğacı və büzüşmə izləyicisi məlumatları'), s.primary),
                          ]),
                        ]),
                        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                          heading(tr('profilescreen_partnyor_neler_ede_biler_44c3d7', '✨ Partnyor nələr edə bilər?')),
                          VGap(gap: 8, children: <Widget>[
                            item(AIcons.messageCircle, tr('profilescreen_size_sevgi_mesajlari_ve_destek_gondere_b_7c91fb', 'Sizə sevgi mesajları və dəstək göndərə bilər'), s.partner),
                            item(AIcons.shoppingCart, tr('profilescreen_ortaq_alis_veris_siyahisina_elave_ede_bi_8dd341', 'Ortaq alış-veriş siyahısına əlavə edə bilər'), s.partner),
                            item(AIcons.gift, tr('profilescreen_surprizler_planlasdirib_xallar_toplaya_b_9fe114', 'Sürprizlər planlaşdırıb xallar toplaya bilər'), s.partner),
                            item(AIcons.trendingUp, tr('profilescreen_missiyalari_yerine_yetirib_seviyye_qazan_719718', 'Missiyaları yerinə yetirib səviyyə qazana bilər'), s.partner),
                          ]),
                        ]),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: s.primary.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: s.primary.withValues(alpha: 0.2)),
                          ),
                          child: Text.rich(
                            TextSpan(children: <InlineSpan>[
                              const TextSpan(text: '🔒 '),
                              TextSpan(text: '${tr('profilescreen_gizlilik', 'Gizlilik')}:', style: TextStyle(fontWeight: FontWeight.w700, color: s.foreground)),
                              TextSpan(text: ' ${tr('profilescreen_partnyor_sizin_sexsi_qeydlerin_3abbaa', 'Partnyor sizin şəxsi qeydlərinizi, gündəlik mesajlarınızı və ya AI söhbətlərinizi görə bilməz.')}'),
                            ]),
                            style: Tw.sm.copyWith(color: s.mutedForeground),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChildrenCard extends ConsumerWidget {
  const _ChildrenCard({required this.onAdd, required this.onEdit});
  final VoidCallback onAdd;
  final ValueChanged<Child> onEdit;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final children = ref.watch(childrenQuery).data ?? const <Child>[];
    final count = children.isEmpty
        ? tr('profilescreen_usaq_elave_et_48f1f0', 'Uşaq əlavə et')
        : children.length == 1
            ? tr('profilescreen_one_child_count', '1 uşaq')
            : '${children.length} ${tr('profilescreen_child_plural_suffix', 'uşaq')}';
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: FadeRise(
        delay: const Duration(milliseconds: 280),
        child: ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            Padding(
              padding: EdgeInsets.only(bottom: children.isNotEmpty ? 4 : 12),
              child: Row(children: <Widget>[
                AListIcon(small: true, background: a.pink1, foreground: a.berryInk, child: const AIcon(AIcons.users, size: 15)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                    Text(tr('profilescreen_usaqlarim_d988f7', 'Uşaqlarım'), style: x.heading(x.aCardTitle)),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(count, style: x.aListSub)),
                  ]),
                ),
                AIconBtn(key: const ValueKey<String>('children-add'), size: 32, onTap: onAdd, icon: const AIcon(AIcons.plus, size: 15, strokeWidth: 2.4)),
              ]),
            ),
            for (var i = 0; i < children.length; i++)
              Container(
                padding: EdgeInsets.only(top: i == 0 ? 2 : 13, bottom: 13),
                decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                child: Row(children: <Widget>[
                  Container(
                    width: 42,
                    height: 42,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
                    child: Text(children[i].avatarEmoji, style: const TextStyle(fontSize: 20)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                      Text(children[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w700, color: a.ink)),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text(childAgeText(children[i]), style: px(11, weight: FontWeight.w500, color: a.inkSoft))),
                    ]),
                  ),
                  AIconBtn(key: ValueKey<String>('child-edit-${children[i].id}'), size: 30, onTap: () => onEdit(children[i]), icon: const AIcon(AIcons.squarePen, size: 13)),
                ]),
              ),
            if (children.isEmpty)
              GestureDetector(
                key: const ValueKey<String>('children-empty-add'),
                behavior: HitTestBehavior.opaque,
                onTap: onAdd,
                child: CustomPaint(
                  painter: DashedTopBorder(a.lineStrong, width: 2, all: true, radius: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(children: <Widget>[
                      AIcon(AIcons.baby, size: 28, color: a.inkSoft),
                      const SizedBox(height: 8),
                      Text(tr('profilescreen_ilk_usagi_elave_et_251a77', 'İlk uşağı əlavə et'), style: px(13, weight: FontWeight.w600, color: a.inkSoft)),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

class _ChildDialog extends ConsumerStatefulWidget {
  const _ChildDialog({this.editing});
  final Child? editing;
  @override
  ConsumerState<_ChildDialog> createState() => _ChildDialogState();
}

class _ChildDialogState extends ConsumerState<_ChildDialog> {
  late final _ChildForm _form = widget.editing == null
      ? _ChildForm()
      : _ChildForm(
          name: widget.editing!.name,
          birthDate: widget.editing!.birthDate,
          gender: widget.editing!.gender == 'unknown' ? 'boy' : widget.editing!.gender,
          gestWeeks: gestWeeksFromDueDate(widget.editing!.birthDate, widget.editing!.dueDate),
        );
  late final TextEditingController _name = TextEditingController(text: _form.name);

  Map<String, dynamic> get _due => _form.gestWeeks == null ? const <String, dynamic>{} : {'due_date': dueDateFromGestWeeks(_form.birthDate, _form.gestWeeks!)};

  static const _genders = <(String, String)>[('boy', '👦'), ('girl', '👧')];
  String _genderLabel(String g) => g == 'boy' ? tr('profilescreen_oglan_e9715e', 'Oğlan') : tr('profilescreen_qiz_79bf6b', 'Qız');
  String _emoji(String g) => _genders.firstWhere((e) => e.$1 == g, orElse: () => ('', '👶')).$2;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final toast = toasts(context);
    final nav = Navigator.of(context);
    final c = ref.read(childrenControllerProvider);
    if (widget.editing == null) {
      if (_form.name.isEmpty || _form.birthDate.isEmpty) {
        toast.show(title: tr('profilescreen_ad_ve_dogum_tarixi_teleb_olunur_bdab04', 'Ad və doğum tarixi tələb olunur'), destructive: true);
        return;
      }
      final child = await c.addChild(name: _form.name, birthDate: _form.birthDate, gender: _form.gender, avatarEmoji: _emoji(_form.gender), dueDate: _due['due_date'] as String?);
      if (child != null) {
        toast.show(title: '${_form.name} ${tr('profile_child_added', 'əlavə edildi')}');
        nav.pop();
      }
    } else {
      if (_form.name.isEmpty || _form.birthDate.isEmpty) return;
      final ok = await c.updateChild(widget.editing!.id, {
        'name': _form.name,
        'birth_date': _form.birthDate,
        'gender': _form.gender,
        'avatar_emoji': _emoji(_form.gender),
        ..._due,
      });
      if (ok) {
        toast.show(title: tr('profilescreen_yenilendi_d10a01', 'Yeniləndi'));
        nav.pop();
      }
    }
  }

  Future<void> _delete() async {
    final child = widget.editing!;
    final nav = Navigator.of(context);
    final toast = toasts(context);
    final yes = await showShadDialog<bool>(context, builder: (ctx) => _ConfirmBox(text: '${child.name} ${tr('profilescreen_silinsin_question', 'silinsin?')}'));
    if (yes == true) {
      await ref.read(childrenControllerProvider).deleteChild(child.id);
      toast.show(title: tr('common_silindi', 'Silindi'));
    }
    nav.pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final editing = widget.editing != null;
    final label = Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.foreground);
    Widget choice({required bool active, required VoidCallback onTap, required Widget child, Key? key}) => Expanded(
          child: GestureDetector(
            key: key,
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: active ? s.primary.withValues(alpha: 0.1) : null,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: active ? s.primary : s.muted, width: 2),
              ),
              child: child,
            ),
          ),
        );
    final preterm = _form.gestWeeks != null && _form.gestWeeks != kTermWeeks;
    return ShadDialogFrame(
      maxWidth: 384,
      scope: false,
      children: <Widget>[
        Row(children: <Widget>[
          Expanded(
            child: Text(
              editing ? tr('profilescreen_usaq_redakte_et_53eb46', 'Uşaq Redaktə Et') : tr('profilescreen_usaq_elave_et_d57c06', 'Uşaq Əlavə Et'),
              style: shadTitle(context).copyWith(height: 1, letterSpacing: -0.025 * 18),
            ),
          ),
          GestureDetector(onTap: () => Navigator.of(context).pop(), child: Opacity(opacity: 0.7, child: AIcon(AIcons.x, size: 16, color: s.foreground))),
        ]),
        VGap(gap: 16, children: <Widget>[
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(tr('untranslated_ad_i34vkg', 'Ad'), style: label),
            ShadInput(
              fieldKey: const ValueKey<String>('child-name'),
              controller: _name,
              placeholder: tr('profilescreen_korpenin_adi_8a4e9e', 'Körpənin adı'),
              onChanged: (v) => setState(() => _form.name = v),
            ),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(tr('profilescreen_dogum_tarixi_d96907', 'Doğum tarixi'), style: label),
            DateFieldBox(
              fieldKey: const ValueKey<String>('child-birth'),
              value: _form.birthDate,
              height: 40,
              radius: 6,
              max: DateTime.tryParse(todayKey()),
              onChanged: (v) => setState(() => _form.birthDate = v),
            ),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(tr('untranslated_cins_f3ymi9', 'Cins'), style: label),
            const SizedBox(height: 8),
            Row(children: <Widget>[
              for (var i = 0; i < _genders.length; i++) ...<Widget>[
                if (i > 0) const SizedBox(width: 8),
                choice(
                  key: ValueKey<String>('child-gender-${_genders[i].$1}'),
                  active: _form.gender == _genders[i].$1,
                  onTap: () => setState(() => _form.gender = _genders[i].$1),
                  child: Column(children: <Widget>[
                    Text(_genders[i].$2, style: const TextStyle(fontSize: 24, height: 32 / 24)),
                    const SizedBox(height: 4),
                    Text(_genderLabel(_genders[i].$1), style: Tw.xs.copyWith(color: s.foreground)),
                  ]),
                ),
              ],
            ]),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(
              tr('preemie_backfill_q', '{name} vaxtında doğulub?').replaceAll('{name}', _form.name.isNotEmpty ? _form.name : tr('profilescreen_korpenin_adi_8a4e9e', 'Körpənin adı')),
              style: label,
            ),
            const SizedBox(height: 8),
            Row(children: <Widget>[
              for (final term in <bool>[true, false]) ...<Widget>[
                if (!term) const SizedBox(width: 8),
                choice(
                  key: ValueKey<String>('child-term-$term'),
                  active: _form.gestWeeks != null && (_form.gestWeeks == kTermWeeks) == term,
                  onTap: () => setState(() => _form.gestWeeks = term ? kTermWeeks : (_form.gestWeeks != null && _form.gestWeeks != kTermWeeks ? _form.gestWeeks : 34)),
                  child: Text(
                    term ? tr('preemie_backfill_term', 'Bəli, vaxtında (37+ həftə)') : tr('preemie_backfill_preterm', 'Vaxtından əvvəl'),
                    textAlign: TextAlign.center,
                    style: Tw.xs.copyWith(fontWeight: FontWeight.w500, color: s.foreground),
                  ),
                ),
              ],
            ]),
            if (preterm)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: <Widget>[
                  ShadButton(icon: true, variant: ShadButtonVariant.outline, onPressed: () => setState(() => _form.gestWeeks = (_form.gestWeeks! - 1).clamp(22, 36)), child: const Text('-')),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(12)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                        Text('${_form.gestWeeks}', style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: s.foreground)),
                        const SizedBox(width: 6),
                        Text(tr('preemie_backfill_weeks', 'həftəlik doğulub'), style: Tw.xs.copyWith(color: s.mutedForeground)),
                      ]),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ShadButton(icon: true, variant: ShadButtonVariant.outline, onPressed: () => setState(() => _form.gestWeeks = (_form.gestWeeks! + 1).clamp(22, 36)), child: const Text('+')),
                ]),
              ),
          ]),
          Row(children: <Widget>[
            Expanded(
              child: ShadButton(
                key: const ValueKey<String>('child-submit'),
                expand: true,
                onPressed: _submit,
                child: Text(editing ? tr('childselector_save', 'Yadda saxla') : tr('profilescreen_elave_et_6e1b9b', 'Əlavə et')),
              ),
            ),
            if (editing) ...<Widget>[
              const SizedBox(width: 8),
              ShadButton(icon: true, variant: ShadButtonVariant.destructive, onPressed: _delete, child: const AIcon(AIcons.trash2, size: 16)),
            ],
          ]),
        ]),
      ],
    );
  }
}

/// `window.confirm(text)` (the WebView shows the system dialog; here a minimal Radix-style one).
class _ConfirmBox extends StatelessWidget {
  const _ConfirmBox({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => ShadDialogFrame(maxWidth: 320, inset: 24, radius: 12, children: <Widget>[
        Text(text, style: Tw.sm.copyWith(color: context.tokens.shadcn.foreground)),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: <Widget>[
          ShadButton(variant: ShadButtonVariant.ghost, onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          const SizedBox(width: 8),
          ShadButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('OK')),
        ]),
      ]);
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: FadeRise(
        dy: 0,
        delay: const Duration(milliseconds: 500),
        child: PressScale(
          key: const ValueKey<String>('profile-logout'),
          scale: 0.98,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
            decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
              AIcon(AIcons.logOut, size: 16, strokeWidth: 2.2, color: a.pinkInk),
              const SizedBox(width: 6),
              Text(tr('profilescreen_cixis_c2de5c', 'Çıxış'), style: px(12.5, weight: FontWeight.w700, color: a.pinkInk)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _LogoutDialog extends StatelessWidget {
  const _LogoutDialog();
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    return ShadDialogFrame(maxWidth: 384, inset: 16, radius: 22, children: <Widget>[
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: <Widget>[
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
              child: AIcon(AIcons.logOut, size: 24, color: a.pinkInk),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(tr('profilescreen_logout_confirm_title', 'Çıxış edilsin?'), style: shadTitle(context).copyWith(color: a.ink))),
          ]),
        ),
        const SizedBox(height: 8),
        Text(tr('profilescreen_logout_confirm_body', 'Hesabınızdan çıxış etmək istədiyinizə əminsiniz?'), style: shadDescription(context)),
      ]),
      // flex-col-reverse below 640px: the action sits above the cancel button.
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        ShadButton(
          key: const ValueKey<String>('logout-confirm'),
          pill: true,
          onPressed: () => Navigator.of(context).pop(true),
          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
            AIcon(AIcons.logOut, size: 16, color: s.primaryForeground),
            const SizedBox(width: 8),
            Text(tr('profilescreen_cixis_c2de5c', 'Çıxış')),
          ]),
        ),
        const SizedBox(height: 8 + 8),
        ShadButton(
          pill: true,
          variant: ShadButtonVariant.outline,
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(tr('profilescreen_logout_cancel', 'Ləğv et')),
        ),
      ]),
    ]);
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.name,
    required this.email,
    required this.stage,
    required this.country,
    required this.isAdmin,
    required this.avatarUrl,
    required this.avatarBuilder,
    required this.onEdit,
  });
  final String name;
  final String email;
  final ({String name, String emoji}) stage;
  final (String, String)? country;
  final bool isAdmin;
  final String? avatarUrl;
  final Widget Function(String url) avatarBuilder;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget badge(List<Widget> children) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: children),
        );
    final badgeStyle = px(10, weight: FontWeight.w800, color: a.ctaInk, ls: 0.03);
    return FadeRise(
      dy: 0,
      scaleFrom: 0.95,
      delay: const Duration(milliseconds: 100),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
        child: Row(children: <Widget>[
          Container(
            width: 56,
            height: 56,
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: a.chipOverlay,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x668A4514), offset: Offset(0, 8), blurRadius: 16, spreadRadius: -8)],
            ),
            child: avatarUrl != null && avatarUrl!.isNotEmpty ? SizedBox.expand(child: avatarBuilder(avatarUrl!)) : Text(stage.emoji, style: const TextStyle(fontSize: 30)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Text(name, style: px(17, weight: FontWeight.w700, color: a.ctaInk, ls: -0.02)),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Opacity(opacity: 0.75, child: Text(email, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(11.5, weight: FontWeight.w600, color: a.ctaInk))),
              ),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: <Widget>[
                badge(<Widget>[Text('${stage.emoji} ${stage.name}', style: badgeStyle)]),
                if (country != null)
                  badge(<Widget>[
                    ClipRRect(borderRadius: BorderRadius.circular(2), child: Image.asset('assets/images/profile/flags/${country!.$1}.png', width: 14, height: 10, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(width: 14, height: 10))),
                    const SizedBox(width: 6),
                    Text(country!.$2, style: badgeStyle),
                  ]),
                if (isAdmin) badge(<Widget>[Text(trInline('ProfileScreen.tsx', '👑 Admin'), style: badgeStyle)]),
              ]),
            ]),
          ),
          AIconBtn(onTap: onEdit, icon: const AIcon(AIcons.squarePen, size: 15)),
        ]),
      ),
    );
  }
}

class _ClassicMenu extends StatelessWidget {
  const _ClassicMenu({required this.rows, required this.onPick});
  final List<ProfileRow> rows;
  final ValueChanged<String> onPick;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ACard(
        variant: ACardVariant.list,
        child: Column(children: <Widget>[
          for (var i = 0; i < rows.length; i++)
            FadeRise(
              dy: 0,
              dx: -20,
              delay: Duration(milliseconds: 50 * i),
              child: GestureDetector(
                key: ValueKey<String>('profile-row-${rows[i].id}'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onPick(rows[i].id),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                  child: Row(children: <Widget>[
                    AListIcon(background: a.surfaceSoft, foreground: a.inkSoft, child: AIcon(rows[i].icon, size: 17)),
                    const SizedBox(width: 13),
                    Expanded(child: Text(rows[i].label, style: x.aListTitle)),
                    if (rows[i].badge != null) ...<Widget>[const SizedBox(width: 13), ATagOn(rows[i].badge!)],
                    const SizedBox(width: 13),
                    AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class _ClassicLegal extends StatelessWidget {
  const _ClassicLegal({required this.rows, required this.onPick});
  final List<ProfileRow> rows;
  final ValueChanged<String> onPick;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr('profilescreen_huquqi_ceb5d3', 'Hüquqi'), style: x.aSectionTitle.copyWith(fontSize: 15, letterSpacing: -0.3))),
        FadeRise(
          dy: 0,
          delay: const Duration(milliseconds: 550),
          child: ACard(
            variant: ACardVariant.list,
            child: Column(children: <Widget>[
              for (var i = 0; i < rows.length; i++)
                PressScale(
                  scale: 0.99,
                  onTap: () => onPick(rows[i].id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                    decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                    child: Row(children: <Widget>[
                      Container(
                        width: 30,
                        height: 30,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                        child: AIcon(rows[i].icon, size: 13, color: a.inkSoft),
                      ),
                      const SizedBox(width: 13),
                      Expanded(child: Text(rows[i].label, style: x.aListSub.copyWith(fontWeight: FontWeight.w600))),
                      const SizedBox(width: 13),
                      AIcon(AIcons.chevronRight, size: 14, color: a.inkFaint, mirrorInRtl: true),
                    ]),
                  ),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}
