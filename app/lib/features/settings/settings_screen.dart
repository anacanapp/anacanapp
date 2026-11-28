// Ported from: src/components/SettingsScreen.tsx
//
// Settings: ad preferences entry, notification toggles, silent hours, reminders, push toggles, privacy & data (privacy,
// app lock sheet, health sync, JSON export, account deletion via the auth controller).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/dates/local_date.dart';
import '../profile/profile_interfaces.dart';
import '../security/app_lock.dart';
import '../security/app_lock_setup_sheet.dart';
import 'copy/feature_copy.dart';
import 'data/data_export.dart';
import 'data/preferences.dart';
import 'ui/settings_ui.dart';

/// Tables of the Settings JSON export, in order.
List<(String, String)> settingsExportTables() => [
      ('profiles', tr('untranslated_profil_v8b0sk', 'Profil')),
      ('daily_logs', tr('settingsscreen_gundelik_qeydler_285ea0', 'Gündəlik qeydlər')),
      ('appointments', tr('settingsscreen_randevular_a452fc', 'Randevular')),
      ('baby_growth', tr('settingsscreen_korpe_inkisafi_8816ce', 'Körpə inkişafı')),
      ('baby_logs', tr('settingsscreen_korpe_qeydleri_8d99a2', 'Körpə qeydləri')),
      ('weight_entries', tr('settingsscreen_ceki_qeydleri_43f237', 'Çəki qeydləri')),
      ('cycle_history', tr('settingsscreen_tsikl_tarixi_f723ad', 'Tsikl tarixi')),
      ('kick_sessions', tr('settingsscreen_tepik_sessiyalari_87edad', 'Təpik sessiyaları')),
      ('contractions', tr('settingsscreen_buzusmeler_1ec368', 'Büzüşmələr')),
      ('blood_sugar_logs', tr('settingsscreen_qan_sekeri_c922e6', 'Qan şəkəri')),
    ];

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key, required this.onBack, this.onNavigate});
  final VoidCallback onBack;
  final ValueChanged<String>? onNavigate;
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _exporting = false;
  late bool _lockActive = ref.read(appLockProvider).isLockEnabled();
  bool _initialized = false;

  SettingsActions get _actions => ref.read(settingsActionsProvider);

  Future<void> _initReminders() async {
    final denied = await _actions.initializeReminders(tr: tr);
    if (denied && mounted) toasts(context).error(tr('usenotificationsettings_bildiris_icazesi_verilmedi_a6583b', 'Bildiriş icazəsi verilmədi'));
  }

  Future<void> _updateNotification(String key, Object value) async {
    final toast = toasts(context);
    final result = await _actions.updateNotificationSetting(key, value, tr: tr);
    if (result == null) return;
    switch (result.kind) {
      case 'success':
        toast.success(result.text);
      default:
        toast.info(result.text);
    }
  }

  Future<void> _export() async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    final toast = toasts(context);
    setState(() => _exporting = true);
    try {
      final source = ref.read(exportSourceProvider);
      final data = <String, Object?>{'export_date': DateTime.now().toUtc().toIso8601String(), 'user_email': user.email};
      for (final (table, _) in settingsExportTables()) {
        try {
          final rows = await source.rows(table, user.id);
          if (rows.isNotEmpty) data[table] = rows;
        } catch (_) {
          // Skip tables that don't exist or have errors
        }
      }
      await ref.read(dataExportSinkProvider).save('anacan-data-${todayKey()}.json', data);
      toast.success(tr('settingsscreen_melumatlariniz_ugurla_yuklendi_80afed', 'Məlumatlarınız uğurla yükləndi!'));
    } catch (_) {
      toast.error(tr('settingsscreen_melumat_ixraci_zamani_xeta_bas_97bbb5', 'Məlumat ixracı zamanı xəta baş verdi'));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _pickTime(String current, void Function(String) onPicked) async {
    final p = current.split(':');
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.tryParse(p[0]) ?? 0, minute: int.tryParse(p.length > 1 ? p[1] : '0') ?? 0));
    if (picked != null) onPicked('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final q = ref.watch(notificationSettingsQuery);
    final silent = ref.watch(silentHoursQuery).data ?? const SilentHoursSettings();
    final push = ref.watch(pushSettingsQuery).data ?? const PushSettings();
    final isNative = ref.watch(settingsIsNativeProvider);
    final user = ref.watch(authUserProvider);
    if (!_initialized && q.data != null) {
      _initialized = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(_initReminders());
      });
    }
    if (user != null && q.isLoading) {
      return AScope(
        child: ColoredBox(color: a.bg, child: Center(child: ARingSpinner(size: 32, color: a.peach2))),
      );
    }
    final s = q.data ?? const NotificationSettings();
    final off = !s.notificationsEnabled;
    Widget sw(String key, bool value, {bool disabled = false, ValueChanged<bool>? onChanged}) => ShadSwitch(
          key: ValueKey<String>('settings-$key'),
          checked: value,
          checkedColor: a.peach2,
          disabled: disabled,
          onChanged: onChanged ?? (v) => unawaited(_updateNotification(key, v)),
        );
    Widget chevron({Color? color, double size = 18}) => AIcon(AIcons.chevronRight, size: size, color: color ?? a.inkFaint, mirrorInRtl: true);
    Widget timeBox(String key, String value, ValueChanged<String> onPicked) => GestureDetector(
          key: ValueKey<String>('settings-$key'),
          onTap: () => _pickTime(value, onPicked),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
            child: Text(value, style: px(13, weight: FontWeight.w600, color: a.ink)),
          ),
        );
    final pt = privacyText;
    final android = defaultTargetPlatform == TargetPlatform.android;

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ATopbar(onBack: widget.onBack, title: tr('settingsscreen_tenzimlemeler_085659', 'Tənzimləmələr')),
            VGap(gap: 12, children: <Widget>[
              if (widget.onNavigate != null)
                SettingsSectionCard(title: tr('ads_preferences_title', 'Reklam seçimləri'), children: <Widget>[
                  SettingRow(
                    rowKey: 'ad-preferences',
                    icon: AIcons.megaphone,
                    label: tr('ads_preferences_title', 'Reklam seçimləri'),
                    description: tr('ads_settings_description', 'Reklamsız fasilə və məxfilik seçimləri'),
                    onTap: () => widget.onNavigate!('ad-preferences'),
                    tintBg: a.lav1,
                    tintInk: a.lavInk,
                    trailing: AIcon(AIcons.chevronRight, size: 16, color: a.ink, mirrorInRtl: true),
                  ),
                ]),
              if (!isNative)
                FadeRise(
                  dy: -10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(a.radiusMd)),
                    child: Row(children: <Widget>[
                      AIcon(AIcons.smartphone, size: 18, color: a.warnInk),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Text(tr('settingsscreen_web_rejiminde_calisirsiniz_157028', 'Web rejimində çalışırsınız'), style: px(13, weight: FontWeight.w700, color: a.warnInk)),
                          Opacity(opacity: 0.8, child: Text(tr('settingsscreen_bildirisler_yalniz_mobil_tetbiqde_isleyi_64cd56', 'Bildirişlər yalnız mobil tətbiqdə işləyir'), style: px(11, color: a.warnInk))),
                        ]),
                      ),
                    ]),
                  ),
                ),
              SettingsSectionCard(title: tr('settingsscreen_bildirisler_54eb88', 'Bildirişlər'), children: <Widget>[
                SettingRow(icon: AIcons.bell, label: tr('settingsscreen_bildirisler_54eb88', 'Bildirişlər'), description: tr('settingsscreen_butun_bildirisleri_aktivlesdirin_beb91d', 'Bütün bildirişləri aktivləşdirin'), tintBg: a.peach1, tintInk: a.accentInk, trailing: sw('notifications_enabled', s.notificationsEnabled)),
                SettingRow(icon: AIcons.volume2, label: tr('settingsscreen_ses_9b06b5', 'Səs'), description: tr('settingsscreen_bildiris_sesleri_fc9269', 'Bildiriş səsləri'), tintBg: a.blue1, tintInk: a.blueInk, trailing: sw('sound_enabled', s.soundEnabled, disabled: off)),
                SettingRow(icon: AIcons.vibrate, label: tr('settingsscreen_titreme_6c5b87', 'Titrəmə'), description: tr('settingsscreen_titreme_bildirisleri_bdf642', 'Titrəmə bildirişləri'), tintBg: a.lav1, tintInk: a.lavInk, trailing: sw('vibration_enabled', s.vibrationEnabled, disabled: off)),
              ]),
              SettingsSectionCard(title: tr('untranslated_sakit_saatlar_myw4sq', 'Sakit saatlar'), children: <Widget>[
                SettingRow(
                  icon: AIcons.bellOff,
                  label: tr('settingsscreen_sakit_rejim_8a42bd', 'Sakit rejim'),
                  description: silent.enabled
                      ? '${silent.startTime} - ${silent.endTime} ${tr('settingsscreen_silent_hours_desc', 'arası bildiriş yoxdur')}'
                      : tr('settingsscreen_gece_saatlarinda_bildirisleri__45007d', 'Gecə saatlarında bildirişləri söndür'),
                  tintBg: a.lav1,
                  tintInk: a.lavInk,
                  trailing: sw('silent_hours', silent.enabled, disabled: off, onChanged: (v) {
                    unawaited(_actions.updateSilentHours(enabled: v));
                    toasts(context).success(v ? tr('settingsscreen_sakit_saatlar_aktivlesdirildi_2ab4f3', 'Sakit saatlar aktivləşdirildi') : tr('settingsscreen_sakit_saatlar_deaktiv_edildi_f723bc', 'Sakit saatlar deaktiv edildi'));
                  }),
                ),
                if (silent.enabled) ...<Widget>[
                  SettingRow(
                    icon: AIcons.moon,
                    label: tr('settingsscreen_baslama_vaxti_b3791d', 'Başlama vaxtı'),
                    description: tr('settingsscreen_bildirisler_susacaq_c5cd6d', 'Bildirişlər susacaq'),
                    tintBg: a.blue1,
                    tintInk: a.blueInk,
                    trailing: timeBox('silent-start', silent.startTime, (v) => unawaited(_actions.updateSilentHours(startTime: v))),
                  ),
                  SettingRow(
                    icon: AIcons.sun,
                    label: tr('settingsscreen_bitme_vaxti_624d01', 'Bitmə vaxtı'),
                    description: tr('settingsscreen_bildirisler_yeniden_baslayacaq_37c49d', 'Bildirişlər yenidən başlayacaq'),
                    tintBg: a.yellow1,
                    tintInk: a.yellowInk,
                    trailing: timeBox('silent-end', silent.endTime, (v) => unawaited(_actions.updateSilentHours(endTime: v))),
                  ),
                ],
              ]),
              SettingsSectionCard(title: tr('settingsscreen_xatirlatmalar_ddd8e7', 'Xatırlatmalar'), children: <Widget>[
                SettingRow(icon: AIcons.droplets, label: tr('settingsscreen_su_xatirlatmasi_ca127e', 'Su xatırlatması'), description: tr('settingsscreen_her_2_saatda_bir_08_00_20_00_bc7ea9', 'Hər 2 saatda bir (08:00-20:00)'), tintBg: a.blue1, tintInk: a.blueInk, trailing: sw('water_reminder', s.waterReminder, disabled: off)),
                SettingRow(icon: AIcons.pill, label: tr('settingsscreen_vitamin_xatirlatmasi_531a3d', 'Vitamin xatırlatması'), description: '${tr('settingsscreen_every_day_at', 'Hər gün saat')} ${s.vitaminTime}', tintBg: a.green1, tintInk: a.greenInk, trailing: sw('vitamin_reminder', s.vitaminReminder, disabled: off)),
                SettingRow(icon: AIcons.dumbbell, label: tr('settingsscreen_mesq_xatirlatmasi_399c4f', 'Məşq xatırlatması'), description: tr('settingsscreen_b_e_c_c_gunleri_saat_10_00_40d25b', 'B.e., Ç., C. günləri saat 10:00'), tintBg: a.peach1, tintInk: a.accentInk, trailing: sw('exercise_reminder', s.exerciseReminder, disabled: off)),
              ]),
              SettingsSectionCard(title: tr('settingsscreen_push_bildirisleri_c44832', 'Push Bildirişləri'), children: <Widget>[
                SettingRow(
                  icon: AIcons.bell,
                  label: tr('settingsscreen_push_bildirisler_e7cb34', 'Push bildirişlər'),
                  description: tr('settingsscreen_tetbiq_bagli_olsa_bele_bildiris_alin_01f6eb', 'Tətbiq bağlı olsa belə bildiriş alın'),
                  tintBg: a.peach1,
                  tintInk: a.accentInk,
                  trailing: sw('push_enabled', push.pushEnabled, onChanged: (v) {
                    unawaited(_actions.updatePushSetting('push_enabled', v));
                    toasts(context).success(v ? tr('settingsscreen_push_bildirisler_aktivlesdiril_9147d9', 'Push bildirişlər aktivləşdirildi') : tr('settingsscreen_push_bildirisler_deaktiv_edild_e3832a', 'Push bildirişlər deaktiv edildi'));
                  }),
                ),
                for (final (key, icon, label, desc, bg, ink, value) in <(String, AIconData, String, String, Color, Color, bool)>[
                  ('push_messages', AIcons.messageCircle, tr('settingsscreen_mesaj_bildirisleri_c8fd7b', 'Mesaj bildirişləri'), tr('settingsscreen_yeni_mesajlar_ucun_bildiris_e7e1c9', 'Yeni mesajlar üçün bildiriş'), a.blue1, a.blueInk, push.pushMessages),
                  ('push_likes', AIcons.heart, tr('settingsscreen_beyenme_bildirisleri_a6b18f', 'Bəyənmə bildirişləri'), tr('settingsscreen_paylasimlariniza_beyenme_734537', 'Paylaşımlarınıza bəyənmə'), a.pink1, a.pinkInk, push.pushLikes),
                  ('push_comments', AIcons.messageCircle, tr('settingsscreen_serh_bildirisleri_6588b5', 'Şərh bildirişləri'), tr('settingsscreen_paylasimlariniza_serhler_ad5c16', 'Paylaşımlarınıza şərhlər'), a.green1, a.greenInk, push.pushComments),
                  ('push_community', AIcons.users, tr('settingsscreen_cemiyyet_bildirisleri_fa4a16', 'Cəmiyyət bildirişləri'), tr('settingsscreen_qrup_fealiyyetleri_4d13e7', 'Qrup fəaliyyətləri'), a.lav1, a.lavInk, push.pushCommunity),
                ])
                  SettingRow(
                    icon: icon,
                    label: label,
                    description: desc,
                    tintBg: bg,
                    tintInk: ink,
                    trailing: sw(key, value, disabled: !push.pushEnabled, onChanged: (v) => unawaited(_actions.updatePushSetting(key, v))),
                  ),
              ]),
              SettingsSectionCard(title: tr('settingsscreen_mexfilik_ve_melumat_f15bb1', 'Məxfilik və Məlumat'), children: <Widget>[
                SettingRow(rowKey: 'privacy', icon: AIcons.shieldCheck, label: pt('settings_row'), description: pt('settings_row_desc'), onTap: () => widget.onNavigate?.call('privacy'), tintBg: a.green1, tintInk: a.greenInk, trailing: chevron()),
                SettingRow(
                  rowKey: 'app-lock',
                  icon: AIcons.lock,
                  label: tr('settingsscreen_sifre_ile_qoruma_152a0e', 'Şifrə ilə qoruma'),
                  description: _lockActive ? tr('applock_status_on', 'Aktiv — PIN ilə qorunur') : tr('applock_status_off', 'PIN və ya biometrika ilə qoruyun'),
                  onTap: () => unawaited(showAppLockSetupSheet(context, onChanged: () {
                    if (mounted) setState(() => _lockActive = ref.read(appLockProvider).isLockEnabled());
                  })),
                  tintBg: a.blue1,
                  tintInk: a.blueInk,
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                    if (_lockActive) ...<Widget>[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                        decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999)),
                        child: Text(tr('paywall_aktiv', 'Aktiv'), style: px(10, weight: FontWeight.w800, color: a.greenInk)),
                      ),
                      const SizedBox(width: 6),
                    ],
                    chevron(),
                  ]),
                ),
                SettingRow(
                  rowKey: 'health-sync',
                  icon: AIcons.heartPulse,
                  label: tr('settingsscreen_health_sync', 'Sağlamlıq inteqrasiyası'),
                  description: android
                      ? tr('health_android_cycle_only', 'Health Connect: yalnız period qeydlərinin yazılması')
                      : tr('settingsscreen_health_sync_desc', 'Apple Health / Health Connect — addım və aktivlik'),
                  onTap: () => widget.onNavigate?.call('health-sync'),
                  tintBg: a.pink1,
                  tintInk: a.pinkInk,
                  trailing: chevron(),
                ),
                SettingRow(
                  rowKey: 'export',
                  icon: AIcons.download,
                  label: tr('settingsscreen_melumat_ixraci_988684', 'Məlumat ixracı'),
                  description: tr('settingsscreen_butun_melumatlarinizi_json_formatinda_yu_0c02e5', 'Bütün məlumatlarınızı JSON formatında yükləyin'),
                  onTap: _exporting ? null : _export,
                  tintBg: a.green1,
                  tintInk: a.greenInk,
                  trailing: _exporting ? ALoader(size: 20, color: a.peach2) : chevron(),
                ),
                SettingRow(
                  rowKey: 'delete-account',
                  icon: AIcons.trash2,
                  label: tr('settingsscreen_hesabi_sil_95d759', 'Hesabı sil'),
                  description: tr('settingsscreen_butun_melumatlari_geri_donmez_sekilde_si_35b4d6', 'Bütün məlumatları geri dönməz şəkildə silin'),
                  onTap: () => unawaited(showShadDialog<void>(context, builder: (_) => const DeleteAccountDialog())),
                  danger: true,
                  trailing: chevron(color: a.alertInk),
                ),
              ]),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// `SectionCard` of SettingsScreen.
class SettingsSectionCard extends StatelessWidget {
  const SettingsSectionCard({super.key, required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(cssUpper(title), style: px(10.5, weight: FontWeight.w800, color: a.inkSoft, ls: 0.08)),
        ),
        ...children,
      ]),
    );
  }
}

/// `SettingRow` of SettingsScreen.
class SettingRow extends StatelessWidget {
  const SettingRow({super.key, required this.icon, required this.label, this.description, this.trailing, this.onTap, this.danger = false, this.tintBg, this.tintInk, this.rowKey});
  final AIconData icon;
  final String label;
  final String? description;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool danger;
  final Color? tintBg;
  final Color? tintInk;
  final String? rowKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget row = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: <Widget>[
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: danger ? null : (tintBg ?? a.surfaceSoft),
            gradient: danger ? a.alertBg : null,
            borderRadius: BorderRadius.circular(12),
          ),
          child: AIcon(icon, size: 16, color: danger ? a.alertInk : (tintInk ?? a.inkSoft)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(label, style: px(13, weight: FontWeight.w600, color: danger ? a.alertInk : a.ink)),
            if (description != null) Padding(padding: const EdgeInsets.only(top: 1), child: Text(description!, style: px(11, color: a.inkSoft))),
          ]),
        ),
        if (trailing != null) ...<Widget>[const SizedBox(width: 12), trailing!],
      ]),
    );
    if (onTap != null) {
      row = PressScale(key: rowKey == null ? null : ValueKey<String>('setting-row-$rowKey'), scale: 0.99, onTap: onTap, child: Semantics(button: true, child: row));
    }
    return row;
  }
}

/// React bug: az/de/ar/ka/kk/uz hold a bare `\` for `settingsscreen_sil_27792d` (the `\"SİL\"` source literal was cut
/// at the escape); React renders it. Show the keyword the user has to type, quoted, instead.
String _deleteKeywordLabel() {
  final value = tr('settingsscreen_sil_27792d', '"SİL"');
  return value == r'\' ? '"${tr('settingsscreen_delete_confirm_keyword', 'SİL')}"' : value;
}

/// Settings "Hesabı sil" AlertDialog: type the keyword ("SİL") to enable the destructive action.
class DeleteAccountDialog extends ConsumerStatefulWidget {
  const DeleteAccountDialog({super.key});
  @override
  ConsumerState<DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<DeleteAccountDialog> {
  final TextEditingController _confirm = TextEditingController();
  bool _deleting = false;

  @override
  void dispose() {
    _confirm.dispose();
    super.dispose();
  }

  String get _keyword => tr('settingsscreen_delete_confirm_keyword', 'SİL');

  Future<void> _delete() async {
    if (_confirm.text != _keyword) return;
    final toast = toasts(context);
    final nav = Navigator.of(context);
    setState(() => _deleting = true);
    final AuthResult<void> res = await ref.read(accountActionsProvider).deleteAccount();
    if (res.ok) {
      toast.success(tr('settingsscreen_hesabiniz_ugurla_silindi_a6ad6e', 'Hesabınız uğurla silindi'));
    } else if (res.error is StateError) {
      toast.error(tr('settingsscreen_sessiya_tapilmadi_2d6594', 'Sessiya tapılmadı'));
    } else {
      toast.error(tr('settingsscreen_hesab_silinerken_xeta_bas_verd_426be6', 'Hesab silinərkən xəta baş verdi'));
    }
    if (mounted) setState(() => _deleting = false);
    nav.maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final ready = _confirm.text == _keyword && !_deleting;
    return ShadDialogFrame(maxWidth: 384, inset: 16, radius: 22, children: <Widget>[
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: <Widget>[
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
              child: AIcon(AIcons.triangleAlert, size: 24, color: a.alertInk),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(tr('settingsscreen_hesabi_sil_95d759', 'Hesabı sil'), style: shadTitle(context).copyWith(color: a.ink))),
          ]),
        ),
        const SizedBox(height: 8),
        DefaultTextStyle.merge(
          style: shadDescription(context),
          child: VGap(gap: 12, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text.rich(TextSpan(children: <InlineSpan>[
              TextSpan(text: '${tr('settingsscreen_bu_emeliyyat_61940b', 'Bu əməliyyat')} '),
              TextSpan(text: tr('settingsscreen_geri_qaytarila_bilmez_700864', 'geri qaytarıla bilməz'), style: TextStyle(fontWeight: FontWeight.w700, color: a.alertInk)),
              // The literal keeps its newline + indentation; HTML collapses the whitespace.
              TextSpan(text: tr('settingsscreen_hesabiniz_ve_butun_melumatlari_99630e', '. \n                Hesabınız və bütün məlumatlarınız həmişəlik silinəcək:').replaceAll(RegExp(r'\s+'), ' ')),
            ])),
            VGap(gap: 4, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              for (final item in <String>[
                tr('settingsscreen_profil_melumatlari_82c76c', 'Profil məlumatları'),
                tr('settingsscreen_butun_qeydler_ve_izleme_tarixcesi_5544e4', 'Bütün qeydlər və izləmə tarixçəsi'),
                tr('settingsscreen_cemiyyet_paylasimlari_ve_serhler_655338', 'Cəmiyyət paylaşımları və şərhlər'),
                tr('settingsscreen_ai_sohbet_tarixcesi_9acf70', 'AI söhbət tarixçəsi'),
                tr('settingsscreen_premium_abunelik_eger_varsa_ce1645', 'Premium abunəlik (əgər varsa)'),
              ])
                Text('•  $item', style: Tw.xs.copyWith(color: a.inkSoft)),
            ]),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text.rich(
                    TextSpan(children: <InlineSpan>[
                      TextSpan(text: '${tr('settingsscreen_tesdiqlemek_ucun_fd471c', 'Təsdiqləmək üçün')} '),
                      TextSpan(text: _deleteKeywordLabel(), style: const TextStyle(fontWeight: FontWeight.w700)),
                      TextSpan(text: ' ${tr('settingsscreen_yazin_e343c0', 'yazın:')}'),
                    ]),
                    style: Tw.xs.copyWith(fontWeight: FontWeight.w500, color: a.ink),
                  ),
                ),
                AInput(
                  fieldKey: const ValueKey<String>('delete-confirm'),
                  controller: _confirm,
                  placeholder: tr('settingsscreen_si_l_903c4d', 'SİL'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontFamily: 'monospace', letterSpacing: 0.1 * 13),
                  onChanged: (_) => setState(() {}),
                ),
              ]),
            ),
          ]),
        ),
      ]),
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        ShadButton(
          key: const ValueKey<String>('delete-account-confirm'),
          pill: true,
          variant: ShadButtonVariant.destructive,
          onPressed: ready ? _delete : null,
          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
            _deleting ? ALoader(size: 16, color: s.destructiveForeground) : AIcon(AIcons.trash2, size: 16, color: s.destructiveForeground),
            const SizedBox(width: 8),
            Text(tr('settingsscreen_hesabi_sil_95d759', 'Hesabı sil')),
          ]),
        ),
        const SizedBox(height: 16),
        ShadButton(pill: true, variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(context).maybePop(), child: Text(tr('settingsscreen_legv_et_b5e49c', 'Ləğv et'))),
      ]),
    ]);
  }
}
