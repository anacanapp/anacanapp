// Ported from: src/components/PrivacyScreen.tsx, src/components/PartnerPrivacyScreen.tsx
//
// Privacy & security (mother / partner). Toggles persist to `user_preferences` (usePrivacyPreferences). The legal
// consent block (ConsentSettings) and the analytics/ads/attribution controls (ConsentControls + privacyConsent) are
// owned by the consent feature and come in through [PrivacySlots].
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/data/data.dart' show dbProvider;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/dates/local_date.dart';
import '../profile/profile_interfaces.dart';
import 'copy/feature_copy.dart';
import 'data/data_export.dart';
import 'data/preferences.dart';
import 'ui/settings_ui.dart';

/// Consent widgets of the consent feature.
class PrivacySlots {
  const PrivacySlots({this.consentSettings, this.consentControls});

  /// `<ConsentSettings />`.
  final WidgetBuilder? consentSettings;

  /// `<ConsentControls value onChange onOpenAdSettings />`; the slot persists the consent itself
  /// (`setPrivacyConsent`) and then calls [onAnalyticsChanged] with the new analytics choice.
  final Widget Function(BuildContext context, {required Future<void> Function(bool analytics) onAnalyticsChanged, VoidCallback? onOpenAdSettings})? consentControls;
}

final privacySlotsProvider = Provider<PrivacySlots>((ref) => const PrivacySlots());

/// `supabase.rpc('unlink_partners')`; throws on error.
final unlinkPartnersProvider = Provider<Future<void> Function()>((ref) => () async {
      await ref.read(dbProvider).rpc<Object?>('unlink_partners');
    });

/// After unlinking the web reloads the page (800 ms); natively: refresh the profile.
final afterUnlinkProvider = Provider<Future<void> Function()>((ref) => () async {
      await Future<void>.delayed(const Duration(milliseconds: 800));
      await ref.read(accountActionsProvider).refreshProfile();
    });

/// Partner account deletion (client-side deletes of the partner's rows, then sign out) — as PartnerPrivacyScreen.
final partnerAccountDeleterProvider = Provider<Future<void> Function(String userId)>((ref) => (uid) async {
      final db = ref.read(dbProvider);
      await db.from('partner_messages').delete().or('sender_id.eq.$uid,receiver_id.eq.$uid');
      await db.from('partner_missions').delete().eq('user_id', uid);
      await db.from('notifications').delete().eq('user_id', uid);
      await db.from('profiles').delete().eq('user_id', uid);
    });

typedef _Option = ({AIconData icon, String title, String desc, String key, Color bg, Color ink});

class PrivacyScreen extends ConsumerStatefulWidget {
  const PrivacyScreen({super.key, required this.onBack, this.onOpenAdSettings, this.onOpenLegal, this.partner = false});
  final VoidCallback onBack;
  final VoidCallback? onOpenAdSettings;
  final ValueChanged<String>? onOpenLegal;

  /// PartnerPrivacyScreen variant.
  final bool partner;
  @override
  ConsumerState<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends ConsumerState<PrivacyScreen> {
  bool get _partner => widget.partner;
  String get _p => _partner ? 'partnerprivacyscreen' : 'privacyscreen';

  Future<void> _toggle(String key, bool value) async {
    final toast = toasts(context);
    final ok = await ref.read(settingsActionsProvider).updatePrivacyPref(key, value);
    if (ok) {
      toast.show(title: tr('${_p}_ayar_yenilendi_f0f876', 'Ayar yeniləndi'));
    } else {
      toast.show(title: tr('${_p}_xeta_3cdbb6', 'Xəta'), description: tr('privacy_save_failed', 'Yadda saxlanılmadı — yenidən cəhd edin.'), destructive: true);
    }
  }

  Future<void> _export() async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    final toast = toasts(context);
    toast.show(title: tr('${_p}_melumatlar_hazirlanir_482381', 'Məlumatlar hazırlanır...'), description: tr('${_p}_bu_bir_nece_saniye_ceke_biler_49b373', 'Bu bir neçə saniyə çəkə bilər.'));
    try {
      final src = ref.read(exportSourceProvider);
      final Map<String, Object?> data = _partner
          ? {
              'profile': await src.profile(user.id),
              'messages': await src.partnerMessages(user.id),
              'missions': await src.rows('partner_missions', user.id),
              'notifications': await src.rows('notifications', user.id),
              'exportedAt': DateTime.now().toUtc().toIso8601String(),
            }
          : {
              'profile': await src.profile(user.id),
              'dailyLogs': await src.rows('daily_logs', user.id),
              'appointments': await src.rows('appointments', user.id),
              'notifications': await src.rows('notifications', user.id),
              'exportedAt': DateTime.now().toUtc().toIso8601String(),
            };
      await ref.read(dataExportSinkProvider).save(_partner ? 'anacan-partner-data-${todayKey()}.json' : 'anacan-data-export-${todayKey()}.json', data);
      toast.show(title: tr('${_p}_melumatlar_yuklendi_f04800', 'Məlumatlar yükləndi!'));
    } catch (error) {
      toast.show(title: tr('${_p}_xeta_3cdbb6', 'Xəta'), description: '$error', destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final q = ref.watch(privacyPreferencesQuery);
    final prefs = q.data ?? kDefaultPrivacy;
    final slots = ref.watch(privacySlotsProvider);
    final List<_Option> options = _partner
        ? [
            (icon: AIcons.shield, title: tr('partnerprivacyscreen_analitik_melumat_paylas_7971ff', 'Analitik məlumat paylaş'), desc: tr('partnerprivacyscreen_anonim_istifade_melumatlarini_paylasin_835e3a', 'Anonim istifadə məlumatlarını paylaşın'), key: 'privacy_share_analytics', bg: a.green1, ink: a.greenInk),
            (icon: AIcons.lock, title: tr('partnerprivacyscreen_mekan_paylasimi_bf6566', 'Məkan paylaşımı'), desc: tr('partnerprivacyscreen_heyat_yoldasiniz_mekaninizi_gore_biler_0fb295', 'Həyat yoldaşınız məkanınızı görə bilər'), key: 'privacy_location_sharing', bg: a.blue1, ink: a.blueInk),
            (icon: AIcons.shield, title: tr('partnerprivacyscreen_bildiris_sesleri_fc9269', 'Bildiriş səsləri'), desc: tr('partnerprivacyscreen_bildiris_geldikde_ses_cixsin_a3a866', 'Bildiriş gəldikdə səs çıxsın'), key: 'privacy_notification_sounds', bg: a.lav1, ink: a.lavInk),
          ]
        : [
            (icon: AIcons.eye, title: tr('privacyscreen_profil_gorunurluyu_deeea5', 'Profil görünürlüyü'), desc: tr('privacyscreen_diger_istifadeciler_profilinizi_gore_bil_f3544c', 'Digər istifadəçilər profilinizi görə bilər'), key: 'privacy_profile_visible', bg: a.blue1, ink: a.blueInk),
            (icon: AIcons.userX, title: tr('privacyscreen_cemiyyetde_goster_3e9674', 'Cəmiyyətdə göstər'), desc: tr('privacyscreen_post_ve_story_leriniz_digerlerine_gorunu_cf12e6', 'Post və story-ləriniz digərlərinə görünür'), key: 'privacy_show_in_community', bg: a.lav1, ink: a.lavInk),
            (icon: AIcons.lock, title: tr('privacyscreen_mesajlara_icaze_ver_99d96f', 'Mesajlara icazə ver'), desc: tr('privacyscreen_diger_istifadeciler_size_mesaj_gondere_b_c1b1fc', 'Digər istifadəçilər sizə mesaj göndərə bilər'), key: 'privacy_allow_messages', bg: a.pink1, ink: a.pinkInk),
          ];
    final accent = _partner ? a.blueInk : a.accentInk;
    Widget cardTitle(AIconData icon, String text, {double bottom = 12}) => Padding(
          padding: EdgeInsets.only(bottom: bottom),
          child: Row(children: <Widget>[AIcon(icon, size: 16, color: accent), const SizedBox(width: 8), Expanded(child: Text(text, style: context.aText.aCardTitle))]),
        );
    Widget action({required String key, required AIconData icon, required Color iconBg, required Color iconInk, required String title, required String sub, required VoidCallback onTap, bool danger = false}) => PressScale(
          key: ValueKey<String>(key),
          scale: 0.98,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: danger ? null : a.surfaceSoft, gradient: danger ? a.alertBg : null, borderRadius: BorderRadius.circular(16)),
            child: Row(children: <Widget>[
              Container(width: 40, height: 40, alignment: Alignment.center, decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(13)), child: AIcon(icon, size: 17, color: iconInk)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Text(title, style: px(13.5, weight: FontWeight.w700, color: danger ? a.alertInk : a.ink)),
                  Text(sub, style: px(11, color: danger ? a.alertSoft : a.inkSoft)),
                ]),
              ),
            ]),
          ),
        );

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ATopbar(
              onBack: widget.onBack,
              eyebrow: _partner ? tr('partnerprivacyscreen_partner_melumatlarinizi_idare_edin_7c5e99', 'Partner məlumatlarınızı idarə edin') : tr('privacyscreen_melumatlarinizi_idare_edin_efbcdb', 'Məlumatlarınızı idarə edin'),
              title: tr('${_p}_gizlilik_tehlukesizlik_67bec6', 'Gizlilik & Təhlükəsizlik'),
            ),
            VGap(gap: 14, children: <Widget>[
              FadeRise(
                child: ACard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    cardTitle(AIcons.lock, tr('${_p}_gizlilik_ayarlari_4055d3', 'Gizlilik Ayarları')),
                    VGap(gap: 4, children: <Widget>[
                      for (final o in options)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                          child: Row(children: <Widget>[
                            Container(width: 40, height: 40, alignment: Alignment.center, decoration: BoxDecoration(color: o.bg, borderRadius: BorderRadius.circular(13)), child: AIcon(o.icon, size: 17, color: o.ink)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                Text(o.title, style: px(13, weight: FontWeight.w600, color: a.ink)),
                                Padding(padding: const EdgeInsets.only(top: 1), child: Text(o.desc, style: px(11, color: a.inkSoft))),
                              ]),
                            ),
                            const SizedBox(width: 12),
                            ShadSwitch(
                              key: ValueKey<String>('privacy-${o.key}'),
                              checked: prefs[o.key] ?? false,
                              checkedColor: _partner ? a.blue2 : a.peach2,
                              disabled: q.isLoading,
                              onChanged: (v) => unawaited(_toggle(o.key, v)),
                            ),
                          ]),
                        ),
                    ]),
                  ]),
                ),
              ),
              if (!_partner) ...<Widget>[
                if (slots.consentSettings != null) slots.consentSettings!(context),
                FadeRise(
                  delay: const Duration(milliseconds: 50),
                  child: ACard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                      cardTitle(AIcons.shield, privacyText('section_title'), bottom: 4),
                      Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(privacyText('section_desc'), style: px(11, color: a.inkSoft))),
                      if (slots.consentControls != null)
                        slots.consentControls!(
                          context,
                          onOpenAdSettings: widget.onOpenAdSettings,
                          onAnalyticsChanged: (analytics) async {
                            final toast = toasts(context);
                            final current = ref.read(privacyPreferencesQuery).data ?? kDefaultPrivacy;
                            if (analytics != current['privacy_share_analytics']) {
                              unawaited(ref.read(settingsActionsProvider).updatePrivacyPref('privacy_share_analytics', analytics));
                            }
                            toast.show(title: privacyText('saved'));
                          },
                        ),
                    ]),
                  ),
                ),
              ],
              FadeRise(
                delay: const Duration(milliseconds: 100),
                child: ACard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    cardTitle(AIcons.shield, tr('${_p}_melumat_i_dareetmesi_19f40f', 'Məlumat İdarəetməsi')),
                    VGap(gap: 10, children: <Widget>[
                      action(
                        key: 'privacy-export',
                        icon: AIcons.download,
                        iconBg: a.green1,
                        iconInk: a.greenInk,
                        title: tr('${_p}_melumatlari_yukle_5cee89', 'Məlumatları Yüklə'),
                        sub: tr('${_p}_butun_melumatlarinizi_json_formatinda_yu_0c02e5', 'Bütün məlumatlarınızı JSON formatında yükləyin'),
                        onTap: () => unawaited(_export()),
                      ),
                      if (_partner)
                        action(
                          key: 'privacy-unlink',
                          icon: AIcons.unlink,
                          iconBg: a.blue1,
                          iconInk: a.blueInk,
                          title: tr('partnerv2_baglantini_kes', 'Bağlantını kəs'),
                          sub: tr('partnerv2_unlink_partner_side_sub', 'Həyat yoldaşınızın məlumatlarına girişi dayandırın'),
                          onTap: () => unawaited(showShadDialog<void>(context, builder: (_) => const _UnlinkDialog())),
                        ),
                      action(
                        key: 'privacy-delete',
                        icon: AIcons.trash2,
                        iconBg: a.chipOverlay,
                        iconInk: a.alertInk,
                        title: tr('${_p}_hesabi_sil_6abf24', 'Hesabı Sil'),
                        sub: tr('${_p}_butun_melumatlarinizi_birdefelik_silin_41a068', 'Bütün məlumatlarınızı birdəfəlik silin'),
                        danger: true,
                        onTap: () => unawaited(showShadDialog<void>(context, builder: (_) => _PrivacyDeleteDialog(partner: _partner))),
                      ),
                    ]),
                  ]),
                ),
              ),
              FadeRise(
                delay: const Duration(milliseconds: 200),
                child: ADisclaimerBox(
                  child: Text.rich(TextSpan(children: <InlineSpan>[
                    TextSpan(text: '${tr('${_p}_gizlilik_siyasetimiz_ve_istifa_8c585b', 'Gizlilik siyasətimiz və istifadə şərtlərimiz haqqında ətraflı məlumat üçün')} '),
                    WidgetSpan(
                      alignment: PlaceholderAlignment.baseline,
                      baseline: TextBaseline.alphabetic,
                      child: GestureDetector(
                        key: const ValueKey<String>('privacy-legal-link'),
                        onTap: _partner ? null : () => widget.onOpenLegal?.call('privacy_policy'),
                        child: Text(tr('${_p}_buraya_klikleyin_c20d44', 'buraya klikləyin'), style: px(12.5, weight: FontWeight.w700, color: a.disclaimerStrong)),
                      ),
                    ),
                    const TextSpan(text: '.'),
                  ])),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _UnlinkDialog extends ConsumerStatefulWidget {
  const _UnlinkDialog();
  @override
  ConsumerState<_UnlinkDialog> createState() => _UnlinkDialogState();
}

class _UnlinkDialogState extends ConsumerState<_UnlinkDialog> {
  bool _busy = false;
  Future<void> _unlink() async {
    final toast = toasts(context);
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(unlinkPartnersProvider)();
      toast.show(title: tr('partnerv2_baglanti_kesildi', 'Bağlantı kəsildi'));
      nav.maybePop();
      unawaited(ref.read(afterUnlinkProvider)());
    } catch (_) {
      toast.show(title: tr('partnerprivacyscreen_xeta_3cdbb6', 'Xəta'), destructive: true);
      if (mounted) setState(() => _busy = false);
      nav.maybePop();
    }
  }

  @override
  Widget build(BuildContext context) => ShadDialogFrame(radius: 22, inset: 16, children: <Widget>[
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
          Text('${tr('partnerv2_baglantini_kes', 'Bağlantını kəs')}?', style: shadTitle(context).copyWith(color: context.a.ink, height: 1)),
          const SizedBox(height: 6),
          Text(tr('partnerv2_unlink_partner_tesdiq', 'Partnyor paneli bağlanacaq və həyat yoldaşınızın məlumatlarına giriş dayandırılacaq. Yenidən bağlanmaq üçün kod lazım olacaq.'), style: shadDescription(context)),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(children: <Widget>[
            Expanded(child: ShadButton(pill: true, expand: true, variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(context).maybePop(), child: Text(tr('partnerprivacyscreen_legv_et_b5e49c', 'Ləğv et')))),
            const SizedBox(width: 12),
            Expanded(
              child: ShadButton(
                key: const ValueKey<String>('unlink-confirm'),
                pill: true,
                expand: true,
                variant: ShadButtonVariant.destructive,
                onPressed: _busy ? null : _unlink,
                child: _busy ? ALoader(size: 16, color: context.tokens.shadcn.destructiveForeground) : Text(tr('partnerv2_beli_kes', 'Bəli, kəs')),
              ),
            ),
          ]),
        ),
      ]);
}

class _PrivacyDeleteDialog extends ConsumerStatefulWidget {
  const _PrivacyDeleteDialog({required this.partner});
  final bool partner;
  @override
  ConsumerState<_PrivacyDeleteDialog> createState() => _PrivacyDeleteDialogState();
}

class _PrivacyDeleteDialogState extends ConsumerState<_PrivacyDeleteDialog> {
  bool _deleting = false;
  String get _p => widget.partner ? 'partnerprivacyscreen' : 'privacyscreen';

  Future<void> _delete() async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    final toast = toasts(context);
    final nav = Navigator.of(context);
    setState(() => _deleting = true);
    try {
      if (widget.partner) {
        await ref.read(partnerAccountDeleterProvider)(user.id);
        await ref.read(accountActionsProvider).signOut();
      } else {
        // Same server-side deletion as Settings (delete-user-account), then sign out.
        final res = await ref.read(accountActionsProvider).deleteAccount();
        if (!res.ok) throw res.error ?? StateError('delete failed');
      }
      toast.show(title: 'Hesab silindi', description: tr('${_p}_melumatlariniz_birdefelik_silindi_8f69e7', 'Məlumatlarınız birdəfəlik silindi.'));
    } catch (error) {
      toast.show(title: tr('${_p}_xeta_3cdbb6', 'Xəta'), description: '$error', destructive: true);
    } finally {
      if (mounted) setState(() => _deleting = false);
      nav.maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final items = widget.partner
        ? [tr('partnerprivacyscreen_profil_melumatlari_82c76c', 'Profil məlumatları'), tr('untranslated_mesajlar_ak8wzw', 'Mesajlar'), tr('partnerprivacyscreen_tapsiriqlar_f5dbad', 'Tapşırıqlar'), tr('partnerprivacyscreen_bildirisler_54eb88', 'Bildirişlər')]
        : [tr('privacyscreen_profil_melumatlari_82c76c', 'Profil məlumatları'), tr('privacyscreen_gundelik_qeydler_285ea0', 'Gündəlik qeydlər'), tr('privacyscreen_gorusler_a729f1', 'Görüşlər'), tr('privacyscreen_bildirisler_54eb88', 'Bildirişlər')];
    return ShadDialogFrame(radius: 22, inset: 16, children: <Widget>[
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Row(children: <Widget>[
          AIcon(AIcons.triangleAlert, size: 20, color: a.alertInk),
          const SizedBox(width: 8),
          Expanded(child: Text(tr('${_p}_hesabi_silmek_6d444c', 'Hesabı Silmək'), style: shadTitle(context).copyWith(color: a.alertInk, height: 1))),
        ]),
        const SizedBox(height: 6),
        DefaultTextStyle.merge(
          style: shadDescription(context),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(tr('${_p}_bu_emeliyyat_geri_qaytarila_bi_fdaca8', 'Bu əməliyyat geri qaytarıla bilməz. Bütün məlumatlarınız, o cümlədən:')),
            const SizedBox(height: 8),
            VGap(gap: 4, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[for (final i in items) Text('•  $i')]),
            Text(tr('${_p}_birdefelik_silinecek_d977cc', 'birdəfəlik silinəcək.')),
          ]),
        ),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Row(children: <Widget>[
          Expanded(child: ShadButton(pill: true, expand: true, variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(context).maybePop(), child: Text(tr('${_p}_legv_et_b5e49c', 'Ləğv et')))),
          const SizedBox(width: 12),
          Expanded(
            child: ShadButton(
              key: const ValueKey<String>('privacy-delete-confirm'),
              pill: true,
              expand: true,
              variant: ShadButtonVariant.destructive,
              onPressed: _deleting ? null : _delete,
              child: Text(_deleting ? trInline('PrivacyScreen.tsx', 'Silinir...') : tr('${_p}_beli_sil_fd44c5', 'Bəli, Sil')),
            ),
          ),
        ]),
      ),
    ]);
  }
}
