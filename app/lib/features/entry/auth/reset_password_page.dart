// Ported from: src/pages/ResetPassword.tsx (the `/reset-password` route body)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';

class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key, this.onHome});

  /// `navigate('/')`; defaults to the go_router root.
  final VoidCallback? onHome;

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _show = false;
  bool _showConfirm = false;
  bool _loading = false;
  bool _success = false;
  Timer? _redirect;

  @override
  void initState() {
    super.initState();
    // A valid recovery session must exist.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final user = await ref.read(entryAuthActionsProvider).sessionUserId();
      if (user == null && mounted) {
        AToastHost.of(context).show(
          title: tr('resetpassword_sessiya_tapilmadi_2d6594', 'Sessiya tapılmadı'),
          description: tr('resetpassword_sifre_berpa_linki_artiq_etibarsizdir_2b5a53', 'Şifrə bərpa linki artıq etibarsızdır.'),
          destructive: true,
        );
      }
    });
  }

  @override
  void dispose() {
    _redirect?.cancel();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _home() {
    if (widget.onHome != null) return widget.onHome!();
    GoRouter.maybeOf(context)?.go('/');
  }

  Future<void> _submit() async {
    final toasts = AToastHost.of(context);
    final p = _password.text, c = _confirm.text;
    if (p.isEmpty || c.isEmpty) {
      toasts.show(
        title: tr('resetpassword_sifre_teleb_olunur_079295', 'Şifrə tələb olunur'),
        description: tr('resetpassword_zehmet_olmasa_yeni_sifrenizi_daxil_edin_6e8886', 'Zəhmət olmasa yeni şifrənizi daxil edin.'),
        destructive: true,
      );
      return;
    }
    if (p.length < 6) {
      toasts.show(
        title: tr('resetpassword_sifre_cox_qisadir_3b9bb2', 'Şifrə çox qısadır'),
        description: tr('resetpassword_sifre_minimum_6_simvol_olmalidir_5fbb99', 'Şifrə minimum 6 simvol olmalıdır.'),
        destructive: true,
      );
      return;
    }
    if (p != c) {
      toasts.show(
        title: tr('resetpassword_sifreler_uygun_gelmir_af4b84', 'Şifrələr uyğun gəlmir'),
        description: tr('resetpassword_her_iki_sifre_eyni_olmalidir_e34cfb', 'Hər iki şifrə eyni olmalıdır.'),
        destructive: true,
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final r = await ref.read(entryAuthActionsProvider).updatePassword(p);
      if (r.error != null) {
        toasts.show(
          title: tr('resetpassword_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
          description: tr('resetpassword_sifre_yenilene_bilmedi_yeniden_cehd_edin_8eb28e', 'Şifrə yenilənə bilmədi. Yenidən cəhd edin.'),
          destructive: true,
        );
      } else {
        if (mounted) setState(() => _success = true);
        toasts.show(
          title: tr('resetpassword_sifre_yenilendi_6ce208', 'Şifrə yeniləndi! 🎉'),
          description: tr('resetpassword_yeni_sifrenizle_daxil_ola_bilersiniz_87d13a', 'Yeni şifrənizlə daxil ola bilərsiniz.'),
        );
        _redirect = Timer(const Duration(seconds: 2), () {
          if (mounted) _home();
        });
      }
    } catch (_) {
      toasts.show(
        title: tr('resetpassword_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
        description: tr('resetpassword_yeniden_cehd_edin_18c03c', 'Yenidən cəhd edin.'),
        destructive: true,
      );
    }
    if (mounted) setState(() => _loading = false);
  }

  Widget _field(String key, TextEditingController c, String placeholder, bool show, VoidCallback toggle) {
    final a = context.a;
    return EntryField(
      fieldKey: ValueKey(key),
      icon: AIcons.lock,
      controller: c,
      placeholder: placeholder,
      obscure: !show,
      height: 56,
      radius: 16,
      paddingStart: 48,
      onSubmitted: (_) => _submit(),
      trailing: GestureDetector(
        key: ValueKey('$key-toggle'),
        onTap: toggle,
        child: AIcon(show ? AIcons.eyeOff : AIcons.eye, size: 20, color: a.inkFaint),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: css(13, FontWeight.w600, color: context.a.ink)),
      );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final pad = MediaQuery.paddingOf(context);
    return Material(
      type: MaterialType.transparency,
      child: AScope(
        child: ColoredBox(
          color: a.bg,
          child: Padding(
            padding: EdgeInsets.only(top: pad.top, bottom: pad.bottom),
            child: Stack(children: [
              const EntrySky(clouds: 4),
              Positioned.fill(
                child: SingleChildScrollView(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 56, 24, 32),
                      child: MotionIn(
                        offset: const Offset(0, -30),
                        duration: const Duration(milliseconds: 600),
                        child: Column(children: [
                          Container(
                            width: 80,
                            height: 80,
                            margin: const EdgeInsets.only(bottom: 20),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(24),
                              gradient: a.gradPeach,
                              boxShadow: [cssShadow(20, 40, -16, const Color(0x8CD96C4A))], // ResetPassword.tsx icon shadow
                            ),
                            child: AIcon(AIcons.lock, size: 36, color: a.accentInk),
                          ),
                          Text(tr('resetpassword_sifreni_yenile_b1ff44', 'Şifrəni Yenilə'),
                              textAlign: TextAlign.center, style: css(27, FontWeight.w900, lsEm: -0.02, color: a.ink)),
                          const SizedBox(height: 6),
                          Text(tr('resetpassword_yeni_sifrenizi_teyin_edin_96ef69', 'Yeni şifrənizi təyin edin'),
                              textAlign: TextAlign.center, style: css(14, FontWeight.w500, color: a.onBgSoft)),
                        ]),
                      ),
                    ),
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 448),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: MotionIn(
                            offset: const Offset(0, 40),
                            delay: const Duration(milliseconds: 200),
                            duration: const Duration(milliseconds: 500),
                            child: ACard(padding: const EdgeInsets.all(24), child: _success ? _done(context) : _form(context)),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _done(BuildContext context) {
    final a = context.a;
    return MotionIn(
      key: const ValueKey('reset-success'),
      scale: 0.9,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Column(children: [
          Container(
            width: 80,
            height: 80,
            margin: const EdgeInsets.only(bottom: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
            child: AIcon(AIcons.check, size: 38, strokeWidth: 2.5, color: a.greenInk),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(tr('resetpassword_sifre_yenilendi_f3ee31', 'Şifrə Yeniləndi!'),
                textAlign: TextAlign.center, style: css(19, FontWeight.w800, color: a.ink)),
          ),
          Text(tr('resetpassword_ana_sehifeye_yonlendirilirsiniz_8dbdb0', 'Ana səhifəyə yönləndirilirsiniz...'),
              textAlign: TextAlign.center, style: css(13.5, FontWeight.w400, color: a.inkSoft)),
        ]),
      ),
    );
  }

  Widget _form(BuildContext context) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      MotionIn(
        offset: const Offset(0, 20),
        delay: const Duration(milliseconds: 300),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label(tr('resetpassword_yeni_sifre_56fd00', 'Yeni Şifrə')),
          _field('reset-password', _password, tr('untranslated_minimum_6_simvol_nifi5y', 'Minimum 6 simvol'), _show,
              () => setState(() => _show = !_show)),
        ]),
      ),
      const SizedBox(height: 20),
      MotionIn(
        offset: const Offset(0, 20),
        delay: const Duration(milliseconds: 400),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label(tr('resetpassword_sifreni_tesdiqle_030254', 'Şifrəni Təsdiqlə')),
          _field('reset-confirm', _confirm, tr('resetpassword_sifreni_yeniden_daxil_edin_7e89fb', 'Şifrəni yenidən daxil edin'),
              _showConfirm, () => setState(() => _showConfirm = !_showConfirm)),
        ]),
      ),
      const SizedBox(height: 20),
      MotionIn(
        offset: const Offset(0, 20),
        delay: const Duration(milliseconds: 500),
        child: GestureDetector(
          key: const ValueKey('reset-submit'),
          onTap: _loading ? null : _submit,
          child: Opacity(
            opacity: _loading ? 0.5 : 1, // shadcn Button disabled:opacity-50
            child: Container(
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: a.peach2,
                borderRadius: BorderRadius.circular(999),
                boxShadow: [cssShadow(16, 32, -12, const Color(0x99D96C4A))],
              ),
              child: _loading
                  ? const EntryRingSpinner(topGap: true, period: Duration(seconds: 1))
                  : Text(tr('resetpassword_sifreni_yenile_b1ff44', 'Şifrəni Yenilə'),
                      style: css(16, FontWeight.w700, height: 1.5, color: const Color(0xFFFFFFFF))),
            ),
          ),
        ),
      ),
      const SizedBox(height: 20),
      MotionIn(
        delay: const Duration(milliseconds: 600),
        child: Center(
          child: GestureDetector(
            key: const ValueKey('reset-home'),
            onTap: _home,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              AIcon(AIcons.arrowLeft, size: 16, color: a.inkSoft, mirrorInRtl: true),
              const SizedBox(width: 8),
              Text(tr('resetpassword_ana_sehifeye_qayit_723295', 'Ana səhifəyə qayıt'), style: css(13, FontWeight.w400, color: a.inkSoft)),
            ]),
          ),
        ),
      ),
    ]);
  }
}
