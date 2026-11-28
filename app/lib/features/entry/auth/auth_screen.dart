// Ported from: src/components/AuthScreen.tsx (sign-in / sign-up / forgot-password modes, partner section, social
//              buttons, validation and toasts), src/lib/partner-link.ts (usage), src/lib/promo.ts (usage),
//              src/lib/apple-web-auth.ts (only the "configured" flag: the Azure Apple *web* flow never runs natively)
import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../country/country_select.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';
import 'promo.dart';

enum AuthMode { login, register, forgotPassword }

enum PartnerAuthMode { login, register }

/// `#63acdf`: the partner form's focus colour (AuthScreen.tsx fieldClsBlue) and `rgba(99,172,223,…)` shadows.
const Color _partnerBlue = Color(0xFF63ACDF);

String _messageOf(Object? error) {
  if (error == null) return '';
  if (error is String) return error;
  try {
    final dynamic e = error;
    final m = e.message;
    if (m is String) return m;
  } catch (_) {}
  return '$error';
}

/// Called after a partner was linked (React reloads the page so the profile is read again).
final partnerPairingCompleteProvider = Provider<Future<void> Function()>((ref) {
  return () => ref.read(entryAuthActionsProvider).refreshProfile();
});

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  bool _partnerView = false;
  AuthMode _mode = AuthMode.login;
  PartnerAuthMode _partnerMode = PartnerAuthMode.register;
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _partnerCode = TextEditingController();
  final _promo = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  ({String email, String userId})? _pendingPartnerRegistration;

  @override
  void initState() {
    super.initState();
    _promo.text = readPendingPromo(ref.read(localStoreProvider)) ?? '';
  }

  @override
  void dispose() {
    for (final c in [_email, _password, _name, _partnerCode, _promo]) {
      c.dispose();
    }
    super.dispose();
  }

  EntryAuthActions get _auth => ref.read(entryAuthActionsProvider);
  AToastController get _toast => AToastHost.of(context);

  void _resetForm() {
    _email.clear();
    _password.clear();
    _name.clear();
    _partnerCode.clear();
    _showPassword = false;
  }

  void _setLoading(bool v) {
    if (mounted) setState(() => _loading = v);
  }

  void _destructive(String title, [String? description]) =>
      _toast.show(title: title, description: description, destructive: true);

  // ── Partner ─────────────────────────────────────────────────────────────

  Future<void> _partnerSubmit() async {
    if (_loading) return;
    _setLoading(true);
    final email = _email.text, password = _password.text;
    try {
      if (email.isEmpty || password.isEmpty) {
        _destructive(tr('authscreen_melumat_teleb_olunur_a6d6a7', 'Məlumat tələb olunur'),
            tr('authscreen_e_mail_ve_sifre_daxil_edin_07e5e3', 'E-mail və şifrə daxil edin.'));
        _setLoading(false);
        return;
      }
      if (_partnerMode == PartnerAuthMode.login) {
        final r = await _auth.signIn(email, password);
        if (r.error != null) {
          _destructive(tr('authscreen_giris_alinmadi_e321fa', 'Giriş alınmadı'),
              tr('authscreen_e_mail_ve_ya_sifre_yanlisdir_1ef792', 'E-mail və ya şifrə yanlışdır.'));
        } else {
          _toast.show(
              title: tr('authscreen_xos_geldiniz_96d761', 'Xoş gəldiniz! 👋'),
              description: tr('authscreen_partnyor_paneline_daxil_oldunuz_0fc533', 'Partnyor panelinə daxil oldunuz.'));
        }
        _setLoading(false);
        return;
      }
      // Registration: country is mandatory.
      final countryCode = ref.read(userStoreProvider).countryCode;
      if (countryCode == null || countryCode.isEmpty) {
        _destructive(tr('authscreen_olke_secin_title', 'Ölkə seçin'),
            tr('authscreen_olke_secin_desc', 'Davam etmək üçün yaşadığınız ölkəni seçin.'));
        _setLoading(false);
        return;
      }
      final normalizedCode = _partnerCode.text.trim().toUpperCase();
      try {
        if (!_auth.partnerPairingEnabled) throw const PartnerLinkError('PAIRING_UNAVAILABLE');
        normalizeSecurePartnerCode(_partnerCode.text);
      } catch (error) {
        _destructive(getPartnerLinkErrorMessage(error));
        _setLoading(false);
        return;
      }
      // No anonymous profile lookups: the authenticated RPC validates the invitation.
      final registrationEmail = email.trim().toLowerCase();
      var registration = _pendingPartnerRegistration;
      if (registration?.email != registrationEmail) {
        final partnerName = _name.text.isNotEmpty ? _name.text : 'Partner';
        final r = await _auth.signUp(email, password, partnerName.trim(), countryCode);
        if (r.error != null || r.data == null || r.data!.isEmpty) {
          _destructive(getSignupErrorMessage(r.error));
          _setLoading(false);
          return;
        }
        registration = (email: registrationEmail, userId: r.data!);
        _pendingPartnerRegistration = registration;
      }
      final registeredUserId = registration!.userId;
      final auth = _auth;
      final toast = _toast;
      final complete = ref.read(partnerPairingCompleteProvider);

      Future<void> finishPairing(String code, {bool retry = false}) async {
        normalizeSecurePartnerCode(code);
        var sessionUser = await auth.sessionUserId();
        if (sessionUser == null && retry) {
          // E-mail confirmation can finish after signup. A retry signs in, never signs up again.
          final r = await auth.signIn(email, password);
          if (r.error != null) throw r.error!;
          sessionUser = await auth.sessionUserId();
        }
        if (sessionUser == null) throw const PartnerLinkError('NOT_AUTHENTICATED');
        if (sessionUser != registeredUserId) throw const PartnerLinkError('PAIRING_ACCOUNT_CHANGED');
        await auth.linkPartnerByCode(code);
        _pendingPartnerRegistration = null;
        toast.show(title: tr('partner_pairing_connected', 'Partner linked successfully.'));
        await complete();
      }

      try {
        await finishPairing(normalizedCode);
      } catch (error) {
        toast.show(
          title: tr('partner_pairing_account_created',
              'Account created, but partner linking is not complete. Do not register again.'),
          duration: const Duration(days: 3650), // duration: Infinity
          action: PartnerPairingRetry(
            initialCode: normalizedCode,
            initialError: error,
            onRetry: (code) => finishPairing(code, retry: true),
          ),
        );
      }
      _setLoading(false);
    } catch (_) {
      _destructive(tr('authscreen_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), tr('authscreen_yeniden_cehd_edin_18c03c', 'Yenidən cəhd edin.'));
      _setLoading(false);
    }
  }

  // ── Main form ───────────────────────────────────────────────────────────

  Future<void> _mainSubmit() async {
    if (_loading) return;
    _setLoading(true);
    final email = _email.text, password = _password.text;
    try {
      if (_mode == AuthMode.forgotPassword) {
        if (email.isEmpty) {
          _destructive(tr('authscreen_e_mail_teleb_olunur_29dbb5', 'E-mail tələb olunur'),
              tr('authscreen_zehmet_olmasa_e_mail_unvaninizi_daxil_ed_281019', 'Zəhmət olmasa e-mail ünvanınızı daxil edin.'));
          _setLoading(false);
          return;
        }
        final r = await _auth.resetPassword(email);
        if (r.error != null) {
          _destructive(tr('authscreen_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
              tr('authscreen_sifre_berpa_linki_gonderile_bilmedi_898ae3', 'Şifrə bərpa linki göndərilə bilmədi.'));
        } else {
          _toast.show(
            title: tr('authscreen_link_gonderildi_9e4f3d', 'Link göndərildi! 📧'),
            description: tr('authscreen_e_mail_unvaniniza_sifre_berpa_linki_gond_f42b2e', 'E-mail ünvanınıza şifrə bərpa linki göndərildi.'),
          );
          if (mounted) setState(() => _mode = AuthMode.login);
          _email.clear();
        }
      } else if (_mode == AuthMode.login) {
        if (email.isEmpty || password.isEmpty) {
          _destructive(tr('authscreen_melumat_teleb_olunur_a6d6a7', 'Məlumat tələb olunur'),
              tr('authscreen_e_mail_ve_sifre_daxil_edin_07e5e3', 'E-mail və şifrə daxil edin.'));
          _setLoading(false);
          return;
        }
        final r = await _auth.signIn(email, password);
        if (r.error != null) {
          _destructive(tr('authscreen_giris_alinmadi_e321fa', 'Giriş alınmadı'), getLoginErrorMessage(r.error));
        } else {
          _toast.show(
            title: tr('authscreen_xos_geldiniz_96d761', 'Xoş gəldiniz! 👋'),
            description: tr('authscreen_anacan_a_xos_geldiniz_f08b39', 'Anacan-a xoş gəldiniz!'),
          );
        }
      } else {
        if (email.isEmpty || password.isEmpty) {
          _destructive(tr('authscreen_melumat_teleb_olunur_a6d6a7', 'Məlumat tələb olunur'),
              tr('authscreen_e_mail_ve_sifre_daxil_edin_07e5e3', 'E-mail və şifrə daxil edin.'));
          _setLoading(false);
          return;
        }
        final countryCode = ref.read(userStoreProvider).countryCode;
        if (countryCode == null || countryCode.isEmpty) {
          _destructive(tr('authscreen_olke_secin_title', 'Ölkə seçin'),
              tr('authscreen_olke_secin_desc', 'Davam etmək üçün yaşadığınız ölkəni seçin.'));
          _setLoading(false);
          return;
        }
        final finalName = _name.text.isNotEmpty ? _name.text : email.split('@').first;
        final promo = _promo.text;
        if (promo.trim().isNotEmpty && normalizePromoCode(promo) == null) {
          _destructive(promoText(ref.read(userStoreProvider).language)['err_not_found'] ?? 'Kod tapılmadı.');
          _setLoading(false);
          return;
        }
        final r = await _auth.signUp(email, password, finalName.trim(), countryCode);
        // The gift code waits on the device; the promo redeemer grants it once the session exists.
        if (r.error == null && promo.trim().isNotEmpty) savePendingPromo(ref.read(localStoreProvider), promo);
        if (r.error != null) {
          _destructive(tr('authscreen_qeydiyyat_alinmadi_982f04', 'Qeydiyyat alınmadı'), getSignupErrorMessage(r.error));
        } else {
          _toast.show(
            title: tr('authscreen_qeydiyyat_ugurludur_47a91b', 'Qeydiyyat uğurludur! 🎉'),
            description: tr('authscreen_anacan_a_xos_geldiniz_f08b39', 'Anacan-a xoş gəldiniz!'),
          );
        }
      }
    } catch (_) {
      _destructive(tr('authscreen_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), tr('authscreen_yeniden_cehd_edin_18c03c', 'Yenidən cəhd edin.'));
    }
    _setLoading(false);
  }

  String _socialDescription(Object error) {
    if (isModeratorSignupError(error) && moderatorSignupMessage != null) return moderatorSignupMessage!(error);
    final m = _messageOf(error);
    return m.isNotEmpty ? m : tr('authscreen_yeniden_cehd_edin_18c03c', 'Yenidən cəhd edin.');
  }

  Future<void> _google() async {
    if (_loading || !ref.read(authScreenConfigProvider).googleLoginReady) return;
    _setLoading(true);
    try {
      final r = await _auth.signInWithGoogle();
      if (r.error != null) {
        _destructive(tr('authscreen_google_ile_giris_alinmadi_2d7d46', 'Google ilə giriş alınmadı'), _socialDescription(r.error!));
      }
    } catch (error) {
      _destructive(tr('authscreen_google_ile_giris_alinmadi_2d7d46', 'Google ilə giriş alınmadı'), _messageOf(error));
    }
    _setLoading(false);
  }

  Future<void> _apple() async {
    if (_loading || !ref.read(authScreenConfigProvider).appleConfigured) return;
    _setLoading(true);
    try {
      final r = await _auth.signInWithApple();
      if (r.error != null) {
        _destructive(tr('authscreen_apple_ile_giris_alinmadi_6f9b3a', 'Apple ilə giriş alınmadı'), _socialDescription(r.error!));
      }
    } catch (error) {
      _destructive(tr('authscreen_apple_ile_giris_alinmadi_6f9b3a', 'Apple ilə giriş alınmadı'), _messageOf(error));
    }
    _setLoading(false);
  }

  // ── Build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    ref.watch(userStoreProvider.select((s) => s.language));
    final a = context.a;
    final pad = MediaQuery.paddingOf(context);
    return Material(type: MaterialType.transparency, child: AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: EdgeInsets.only(top: pad.top, bottom: pad.bottom),
          child: Stack(children: [
            EntrySky(key: ValueKey(_partnerView), clouds: _partnerView ? 3 : 5),
            Positioned.fill(child: _partnerView ? _partner(context) : _main(context)),
          ]),
        ),
      ),
    ));
  }

  Widget _centered(Widget child, EdgeInsets padding) => SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: Padding(padding: padding, child: child),
          ),
        ),
      );

  // Main view ───────────────────────────────────────────────────────────────

  Widget _main(BuildContext context) {
    final a = context.a;
    final config = ref.watch(authScreenConfigProvider);
    final logoUrl = ref.watch(loginLogoUrlProvider).value;
    return _centered(
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        MotionIn(
          offset: const Offset(0, -12),
          duration: const Duration(milliseconds: 400),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(children: [
              Container(
                width: 64,
                height: 64,
                margin: const EdgeInsets.only(bottom: 12),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [cssShadow(14, 28, -12, const Color(0x40D96C4A))], // AuthScreen.tsx brand shadow
                ),
                child: logoUrl != null
                    ? CachedNetworkImage(
                        imageUrl: logoUrl,
                        fit: BoxFit.contain,
                        errorWidget: (_, _, _) => const BrandMark(size: 64),
                        placeholder: (_, _) => const SizedBox(),
                      )
                    : const BrandMark(size: 64),
              ),
              Text('Anacan', style: css(26, FontWeight.w900, lsEm: -0.03, color: a.ink)),
              const SizedBox(height: 2),
              Text(tr('authscreen_bedeninle_harmoniyada_ol_ac87bc', 'Bədəninlə harmoniyada ol'),
                  textAlign: TextAlign.center, style: css(12, FontWeight.w600, color: a.onBgSoft)),
            ]),
          ),
        ),
        MotionIn(
          offset: const Offset(0, 40),
          delay: const Duration(milliseconds: 200),
          duration: const Duration(milliseconds: 500),
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_mode != AuthMode.forgotPassword)
                Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: ASegmentedTabs<AuthMode>(
                      style: ASegmentedStyle.aTabs,
                      selected: _mode,
                      onChanged: (m) => setState(() => _mode = m),
                      items: [
                        ASegmentItem(AuthMode.login, tr('authscreen_giris_1ffbd7', 'Giriş')),
                        ASegmentItem(AuthMode.register, tr('authscreen_qeydiyyat', 'Qeydiyyat')),
                      ],
                    ),
                  ),
                ),
              PresenceSwitcher(
                childKey: _mode,
                exitOffset: const Offset(0, -20),
                child: _mainForm(context, key: ValueKey(_mode)),
              ),
              // Social login
              MotionIn(
                delay: const Duration(milliseconds: 500),
                child: Padding(
                  padding: const EdgeInsets.only(top: 28),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: Row(children: [
                        Expanded(child: Container(height: 1, color: a.lineStrong)),
                        const SizedBox(width: 16),
                        Text(tr('authscreen_ve_ya_c50561', 'və ya'), style: css(13, FontWeight.w500, color: a.inkSoft)),
                        const SizedBox(width: 16),
                        Expanded(child: Container(height: 1, color: a.lineStrong)),
                      ]),
                    ),
                    _SocialButton(
                      key: const ValueKey('auth-google'),
                      enabled: !_loading && config.googleLoginReady,
                      onTap: _google,
                      icon: SvgPicture.string(_googleSvg, width: 16, height: 16), // shadcn Button [&_svg]:size-4 beats w-6
                      label: tr('authscreen_google_ile_davam_et', 'Google ilə davam et'),
                    ),
                    const SizedBox(height: 12),
                    _SocialButton(
                      key: const ValueKey('auth-apple'),
                      enabled: !_loading && config.appleConfigured,
                      onTap: _apple,
                      icon: SvgPicture.string(_appleSvg, width: 16, height: 16, colorFilter: ColorFilter.mode(a.ink, BlendMode.srcIn)),
                      label: tr('authscreen_apple_ile_davam_et', 'Apple ilə davam et'),
                    ),
                    if (!config.googleLoginReady || !config.appleConfigured)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          tr('auth_social_provider_pending',
                              'Deaktiv giriş üsulları bu Azure önizləməsində hələ qoşulmayıb. E-mail və şifrədən istifadə edə bilərsiniz.'),
                          textAlign: TextAlign.center,
                          style: css(12, FontWeight.w400, height: 16 / 12, color: context.tokens.shadcn.mutedForeground),
                        ),
                      ),
                  ]),
                ),
              ),
              // Partner section button
              MotionIn(
                delay: const Duration(milliseconds: 600),
                child: Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: GestureDetector(
                    key: const ValueKey('auth-partner-section'),
                    onTap: () => setState(() {
                      _partnerView = true;
                      _resetForm();
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
                      decoration: BoxDecoration(
                        color: a.blue1,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _partnerBlue.withValues(alpha: 0.4), width: 1.5),
                      ),
                      child: Row(children: [
                        Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: a.blue2,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [cssShadow(8, 16, -8, _partnerBlue.withValues(alpha: 0.6))],
                          ),
                          child: const AIcon(AIcons.users, size: 18, color: Color(0xFFFFFFFF)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(tr('authscreen_partnyor_bolmesi_ed393a', 'Partnyor Bölməsi'),
                                style: css(13.5, FontWeight.w800, color: a.blueInk)),
                            Text(tr('authscreen_xaniminizla_baglanmaq_ucun_d7b234', 'Xanımınızla bağlanmaq üçün'),
                                style: css(11, FontWeight.w400, color: a.blueInk)),
                          ]),
                        ),
                        AIcon(AIcons.arrowRight, size: 18, color: a.blueInk, mirrorInRtl: true),
                      ]),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
        _terms(context, a.accentInk),
      ]),
      const EdgeInsets.fromLTRB(20, 40, 20, 32),
    );
  }

  Widget _terms(BuildContext context, Color linkColor) {
    final a = context.a;
    final base = css(11.5, FontWeight.w400, color: a.onBgSoft);
    final link = base.copyWith(color: linkColor, fontWeight: FontWeight.w600);
    return MotionIn(
      delay: const Duration(milliseconds: 600),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
        child: Text.rich(
          TextSpan(children: [
            TextSpan(text: '${tr('authscreen_davam_etmekle_7dba26', 'Davam etməklə')} '),
            // Not wired to a document in React either (plain <button> without onClick).
            TextSpan(text: tr('authscreen_sertler_d86d4e', 'Şərtlər'), style: link),
            TextSpan(text: ' ${tr('authscreen_ve_4e4a26', 'və')} '),
            TextSpan(text: tr('authscreen_gizlilik_siyaseti_dc3f28', 'Gizlilik Siyasəti'), style: link),
            TextSpan(text: ' ${tr('authscreen_ile_razilasirsiniz_547dd9', 'ilə razılaşırsınız')}'),
          ]),
          textAlign: TextAlign.center,
          style: base,
        ),
      ),
    );
  }

  /// framer variants: container staggerChildren 0.08 / delayChildren 0.1; item spring 300 / 24 from y 25.
  Widget _item(int index, Widget child) => MotionIn(
        offset: const Offset(0, 25),
        delay: Duration(milliseconds: 100 + 80 * index),
        spring: ASprings.spring(stiffness: 300, damping: 24),
        child: child,
      );

  List<Widget> _spaced(List<Widget> items) => [
        for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(height: 16), _item(i, items[i])],
      ];

  Widget _passwordField(Color focus) {
    final a = context.a;
    return EntryField(
      fieldKey: const ValueKey('auth-password'),
      icon: AIcons.lock,
      controller: _password,
      placeholder: tr('authscreen_sifre_6771ac', 'Şifrə'),
      obscure: !_showPassword,
      focusColor: focus,
      autofillHints: const [AutofillHints.password],
      onSubmitted: (_) => _partnerView ? _partnerSubmit() : _mainSubmit(),
      trailing: GestureDetector(
        key: const ValueKey('auth-toggle-password'),
        onTap: () => setState(() => _showPassword = !_showPassword),
        child: AIcon(_showPassword ? AIcons.eyeOff : AIcons.eye, size: 20, color: a.inkFaint),
      ),
    );
  }

  Widget _emailField(Color focus) => EntryField(
        fieldKey: const ValueKey('auth-email'),
        icon: AIcons.mail,
        controller: _email,
        placeholder: trInline('AuthScreen.tsx', 'E-mail'),
        focusColor: focus,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
        onSubmitted: (_) => _partnerView ? _partnerSubmit() : _mainSubmit(),
      );

  Widget _nameField(Color focus) => EntryField(
        fieldKey: const ValueKey('auth-name'),
        icon: AIcons.user,
        controller: _name,
        placeholder: tr('authscreen_adiniz_b3e84a', 'Adınız'),
        focusColor: focus,
        textCapitalization: TextCapitalization.words,
        autofillHints: const [AutofillHints.name],
        onSubmitted: (_) => _partnerView ? _partnerSubmit() : _mainSubmit(),
      );

  Widget _countryField() {
    final a = context.a;
    final country = ref.watch(userStoreProvider.select((s) => s.countryCode));
    return Stack(alignment: AlignmentDirectional.centerStart, children: [
      CountrySelect(
        value: country,
        onChanged: (c) => ref.read(userStoreProvider.notifier).setCountryCode(c),
        placeholder: tr('authscreen_olke_secin', 'Ölkə seçin'),
        triggerStyle: CountryTriggerStyle.authField,
      ),
      PositionedDirectional(start: 16, child: IgnorePointer(child: AIcon(AIcons.globe, size: 20, color: a.inkFaint))),
    ]);
  }

  Widget _submitButton({required String label, required Color color, required Color shadow}) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: GestureDetector(
          key: const ValueKey('auth-submit'),
          onTap: _loading ? null : (_partnerView ? _partnerSubmit : _mainSubmit),
          child: Semantics(
            button: true,
            enabled: !_loading,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 300),
              curve: ACurves.tailwind,
              opacity: _loading ? 0.7 : 1,
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [cssShadow(16, 32, -12, shadow)],
                ),
                child: _loading
                    ? const EntryRingSpinner()
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(label, style: css(16, FontWeight.w700, color: const Color(0xFFFFFFFF), height: 1.25)),
                        const SizedBox(width: 8),
                        // shadcn Button [&_svg]:size-4 overrides the arrow's w-5 h-5
                        const AIcon(AIcons.arrowRight, size: 16, color: Color(0xFFFFFFFF), mirrorInRtl: true),
                      ]),
              ),
            ),
          ),
        ),
      );

  Widget _mainForm(BuildContext context, {Key? key}) {
    final a = context.a;
    final focus = a.peach2;
    final promo = promoText(ref.watch(userStoreProvider.select((s) => s.language)));
    final submitLabel = switch (_mode) {
      AuthMode.login => tr('authscreen_daxil_ol', 'Daxil ol'),
      AuthMode.register => tr('authscreen_qeydiyyatdan_kec_433379', 'Qeydiyyatdan keç'),
      AuthMode.forgotPassword => tr('authscreen_link_gonder_d6b028', 'Link göndər'),
    };
    final items = <Widget>[
      if (_mode == AuthMode.forgotPassword) ...[
        Padding(
          padding: const EdgeInsets.only(bottom: 8), // mb-6 on top of the 16px gap
          child: Stack(children: [
            SizedBox(
              width: double.infinity,
              child: Column(children: [
                Container(
                  width: 64,
                  height: 64,
                  margin: const EdgeInsets.only(bottom: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
                  child: AIcon(AIcons.lock, size: 28, color: a.accentInk),
                ),
                Text(tr('authscreen_sifreni_berpa_et_1d1ae1', 'Şifrəni Bərpa Et'),
                    textAlign: TextAlign.center, style: css(19, FontWeight.w800, lsEm: -0.01, color: a.ink)),
                const SizedBox(height: 4),
                Text(tr('authscreen_e_mail_unvaniniza_berpa_linki__20b085', 'E-mail ünvanınıza bərpa linki göndəriləcək'),
                    textAlign: TextAlign.center, style: css(13, FontWeight.w400, color: a.inkSoft)),
              ]),
            ),
            PositionedDirectional(
              start: 0,
              top: 0,
              child: Semantics(
                button: true,
                label: tr('common_geri', 'Geri'),
                child: GestureDetector(
                  key: const ValueKey('auth-forgot-back'),
                  onTap: () => setState(() => _mode = AuthMode.login),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: AIcon(AIcons.arrowLeft, size: 20, color: a.inkSoft, mirrorInRtl: true),
                  ),
                ),
              ),
            ),
          ]),
        ),
        _emailField(focus),
      ] else ...[
        if (_mode == AuthMode.register) _nameField(focus),
        _emailField(focus),
        if (_mode == AuthMode.register) _countryField(),
        _passwordField(focus),
        if (_mode == AuthMode.register)
          EntryField(
            fieldKey: const ValueKey('auth-promo'),
            icon: AIcons.gift,
            controller: _promo,
            placeholder: promo['field_placeholder'],
            semanticLabel: promo['profile_title'],
            focusColor: focus,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [_PromoFormatter()],
            onSubmitted: (_) => _mainSubmit(),
          ),
        if (_mode == AuthMode.login)
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: GestureDetector(
              key: const ValueKey('auth-forgot'),
              onTap: () => setState(() => _mode = AuthMode.forgotPassword),
              child: Text(tr('authscreen_sifreni_unutdunuz_f70bc9', 'Şifrəni unutdunuz?'),
                  style: css(13, FontWeight.w600, color: a.accentInk)),
            ),
          ),
      ],
      _submitButton(label: submitLabel, color: a.peach2, shadow: const Color(0x99D96C4A)),
    ];
    return AutofillGroup(key: key, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _spaced(items)));
  }

  // Partner view ─────────────────────────────────────────────────────────────

  Widget _partner(BuildContext context) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
        child: Row(children: [
          EntryIconButton(
            semanticLabel: tr('common_geri', 'Geri'),
            onTap: () => setState(() {
              _partnerView = false;
              _resetForm();
            }),
            child: const AIcon(AIcons.arrowLeft, size: 16, strokeWidth: 2.5, mirrorInRtl: true),
          ),
          const SizedBox(width: 12),
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: a.gradBlue,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [cssShadow(10, 20, -10, _partnerBlue.withValues(alpha: 0.6))],
            ),
            child: AIcon(AIcons.users, size: 18, color: a.blueInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('authscreen_partnyor_bolmesi_ed393a', 'Partnyor Bölməsi'),
                  style: css(15.5, FontWeight.w800, height: 1.2, color: a.ink)),
              Text(tr('authscreen_xaniminizla_birlikde_bu_seyahete_qosulun_fa14d9', 'Xanımınızla birlikdə bu səyahətə qoşulun'),
                  style: css(11, FontWeight.w400, color: a.inkSoft)),
            ]),
          ),
        ]),
      ),
      Expanded(
        child: _centered(
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            MotionIn(
              offset: const Offset(0, 40),
              delay: const Duration(milliseconds: 200),
              duration: const Duration(milliseconds: 500),
              child: ACard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: ASegmentedTabs<PartnerAuthMode>(
                        style: ASegmentedStyle.aTabs,
                        selected: _partnerMode,
                        onChanged: (m) => setState(() => _partnerMode = m),
                        items: [
                          ASegmentItem(PartnerAuthMode.register, tr('authscreen_qeydiyyat', 'Qeydiyyat')),
                          ASegmentItem(PartnerAuthMode.login, tr('authscreen_giris_1ffbd7', 'Giriş')),
                        ],
                      ),
                    ),
                  ),
                  PresenceSwitcher(
                    childKey: _partnerMode,
                    exitOffset: const Offset(0, -20),
                    child: _partnerForm(context, key: ValueKey(_partnerMode)),
                  ),
                ]),
              ),
            ),
            _terms(context, a.blueInk),
          ]),
          const EdgeInsets.fromLTRB(20, 16, 20, 32),
        ),
      ),
    ]);
  }

  Widget _partnerForm(BuildContext context, {Key? key}) {
    final a = context.a;
    const focus = _partnerBlue;
    final register = _partnerMode == PartnerAuthMode.register;
    final items = <Widget>[
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(children: [
          Container(
            width: 56,
            height: 56,
            margin: const EdgeInsets.only(bottom: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.blue1, shape: BoxShape.circle),
            child: AIcon(AIcons.heart, size: 26, color: a.blueInk),
          ),
          Text(
            register
                ? tr('authscreen_xaniminizin_paylasdigi_kodu_da_6384d2', 'Xanımınızın paylaşdığı kodu daxil edərək qeydiyyatdan keçin')
                : tr('authscreen_movcud_hesabinizla_partnyor_ki_f43a87', 'Mövcud hesabınızla partnyor kimi daxil olun'),
            textAlign: TextAlign.center,
            style: css(13, FontWeight.w400, color: a.inkSoft),
          ),
        ]),
      ),
      if (register) _nameField(focus),
      _emailField(focus),
      if (register) _countryField(),
      _passwordField(focus),
      if (register)
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          EntryField(
            fieldKey: const ValueKey('auth-partner-code'),
            icon: AIcons.sparkles,
            controller: _partnerCode,
            placeholder: trInline('AuthScreen.tsx', 'ANACAN-XXXX'),
            focusColor: focus,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [_UpperCaseFormatter()],
            style: css(16, FontWeight.w400, color: a.ink, height: 1.25, lsEm: 0.1).copyWith(fontFamily: 'monospace', fontFamilyFallback: const ['Menlo', 'Courier New', 'Inter']),
            onSubmitted: (_) => _partnerSubmit(),
          ),
          const SizedBox(height: 8),
          Text(tr('authscreen_partnyor_kodu_xaniminizin_prof_101165', 'Partnyor kodu xanımınızın profilində tapıla bilər'),
              textAlign: TextAlign.center, style: css(11.5, FontWeight.w400, color: a.inkSoft)),
        ]),
      _submitButton(
        label: register ? tr('authscreen_qeydiyyatdan_kec_433379', 'Qeydiyyatdan keç') : tr('authscreen_daxil_ol', 'Daxil ol'),
        color: a.blue2,
        shadow: _partnerBlue.withValues(alpha: 0.65),
      ),
    ];
    return AutofillGroup(key: key, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _spaced(items)));
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({super.key, required this.enabled, required this.onTap, required this.icon, required this.label});
  final bool enabled;
  final VoidCallback onTap;
  final Widget icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Semantics(
        button: true,
        enabled: enabled,
        label: label,
        child: Opacity(
          opacity: enabled ? 1 : 0.5, // shadcn Button disabled:opacity-50
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: a.surface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: a.lineStrong),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              icon,
              const SizedBox(width: 12),
              Text(label, style: css(14, FontWeight.w500, color: a.ink, height: 20 / 14)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// `e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)`.
class _PromoFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var t = newValue.text.toUpperCase().replaceAll(RegExp('[^A-Z0-9-]'), '');
    if (t.length > 32) t = t.substring(0, 32);
    return TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  _UpperCaseFormatter({this.maxLength});
  final int? maxLength;
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var t = newValue.text.toUpperCase();
    if (maxLength != null && t.length > maxLength!) t = t.substring(0, maxLength);
    return newValue.copyWith(text: t, selection: TextSelection.collapsed(offset: t.length));
  }
}

/// The retry form a failed pairing leaves in its (never-expiring) toast; it outlives the AuthScreen.
class PartnerPairingRetry extends StatefulWidget {
  const PartnerPairingRetry({super.key, required this.initialCode, required this.initialError, required this.onRetry});
  final String initialCode;
  final Object? initialError;
  final Future<void> Function(String code) onRetry;

  @override
  State<PartnerPairingRetry> createState() => _PartnerPairingRetryState();
}

class _PartnerPairingRetryState extends State<PartnerPairingRetry> {
  late final _code = TextEditingController(text: widget.initialCode);
  late Object? _error = widget.initialError;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onRetry(_code.text);
    } catch (next) {
      if (mounted) setState(() => _error = next);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final sm = css(14, FontWeight.w400, height: 20 / 14, color: s.foreground);
    return SizedBox(
      width: 220,
      child: Material(type: MaterialType.transparency, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 8),
        Semantics(liveRegion: true, child: Text(getPartnerLinkErrorMessage(_error), style: sm)),
        const SizedBox(height: 12),
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: s.background,
            borderRadius: BorderRadius.circular(TwRadius.md),
            border: Border.all(color: s.input),
          ),
          alignment: Alignment.centerLeft,
          child: TextField(
            key: const ValueKey('partner-retry-code'),
            controller: _code,
            enabled: !_busy,
            autocorrect: false,
            inputFormatters: [_UpperCaseFormatter(maxLength: 64)],
            // shadcn Input: text-base (16/24) below 768px (keyboard.css agrees), md:text-sm from there.
            style: phoneInputStyle(context, sm, lineHeightPx: 24),
            decoration: InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              semanticCounterText: tr('partner_pairing_invite_label', 'Partner invitation code'),
            ),
            onSubmitted: (_) => _submit(),
          ),
        ),
        const SizedBox(height: 12),
        GestureDetector(
          key: const ValueKey('partner-retry'),
          onTap: _busy ? null : _submit,
          child: Opacity(
            opacity: _busy ? 0.5 : 1,
            child: Container(
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(TwRadius.md)),
              child: Text(
                _busy ? tr('partner_pairing_connecting', 'Connecting...') : tr('partner_pairing_retry', 'Retry pairing'),
                style: sm.copyWith(color: s.primaryForeground, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ),
      ])),
    );
  }
}

const String _googleSvg = '''<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
</svg>''';

const String _appleSvg = '''<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000000">
<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
</svg>''';
