// Ported from: src/components/shop/AlbumOrderScreen.tsx
//
// Physical album order (pregnancy / baby): contact, delivery address, notes, payment method (+ card-transfer proof),
// coupon check, then an `album_orders` row with price 0 (the price is agreed by phone). The order screen of
// PregnancyAlbum and BabyMonthlyAlbum.
import 'dart:typed_data';
import 'dart:ui' show ImageFilter, PathMetric;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart' show AIconBtn, ALoader, ShadInput, px, toasts;
import 'album_order_backend.dart';
import 'coupon_input.dart';
import 'coupons.dart';

/// A picked payment proof (`File`): name + bytes.
typedef AlbumProofFile = ({String name, Uint8List bytes, String? mimeType});

/// `<input type="file" accept="image/*,application/pdf">`. Default: the photo library (image_picker has no PDF
/// picker; a document picker package would add PDFs).
final albumProofPickerProvider = Provider<Future<AlbumProofFile?> Function()>((ref) => () async {
      final x = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (x == null) return null;
      return (name: x.name, bytes: await x.readAsBytes(), mimeType: x.mimeType);
    }, name: 'albumProofPickerProvider');

/// `Date.now()` (tests override).
final albumOrderClockProvider = Provider<DateTime Function()>((ref) => DateTime.now, name: 'albumOrderClockProvider');

({String emoji, String title, String description, List<String> features}) _albumInfo(String albumType) => albumType == 'pregnancy'
    ? (
        emoji: '📸',
        title: tr('albumorderscreen_hamilelik_albomu_6f1559', 'Hamiləlik Albomu'),
        description: tr('albumorderscreen_hamilelik_dovrundeki_butun_xatireleriniz_43538c',
            'Hamiləlik dövründəki bütün xatirələriniz professional şəkildə çap edilərək fiziki albom halında sizə çatdırılacaq.'),
        features: [
          tr('albumorderscreen_yuksek_keyfiyyetli_cap_4b079f', 'Yüksək keyfiyyətli çap'),
          tr('albumorderscreen_premium_qalin_sehifeler_6932ed', 'Premium qalın səhifələr'),
          tr('albumorderscreen_davamli_uzluk_74e0a0', 'Davamlı üzlük'),
          tr('albumorderscreen_ferdi_dizayn_efc700', 'Fərdi dizayn'),
        ],
      )
    : (
        emoji: '👶',
        title: tr('albumorderscreen_korpe_albomu_42d4c6', 'Körpə Albomu'),
        description: tr('albumorderscreen_korpenizin_ilk_12_ayindaki_sekilleri_pro_f7f19c', 'Körpənizin ilk 12 ayındakı şəkilləri professional albom şəklində əbədiləşdirin.'),
        features: [
          tr('albumorderscreen_12_ayliq_xatireler_961b3a', '12 aylıq xatirələr'),
          tr('albumorderscreen_premium_cap_keyfiyyeti_be5e01', 'Premium çap keyfiyyəti'),
          tr('albumorderscreen_hessas_reng_tesviri_d6afd5', 'Həssas rəng təsviri'),
          tr('albumorderscreen_xususi_qablasdirma_5e15a5', 'Xüsusi qablaşdırma'),
        ],
      );

class AlbumOrderScreen extends ConsumerStatefulWidget {
  const AlbumOrderScreen({super.key, required this.albumType, required this.onBack});

  /// `'pregnancy' | 'baby'`.
  final String albumType;
  final VoidCallback onBack;

  @override
  ConsumerState<AlbumOrderScreen> createState() => _AlbumOrderScreenState();
}

class _AlbumOrderScreenState extends ConsumerState<AlbumOrderScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  late final _city = TextEditingController(text: tr('albumorderscreen_baki_998629', 'Bakı'));
  final _notes = TextEditingController();
  String _paymentMethod = '';
  AlbumProofFile? _proof;
  bool _submitting = false;
  bool _success = false;
  late final CouponValidator _coupon = CouponValidator(
    backend: ref.read(albumOrderBackendProvider),
    userId: ref.read(authUserProvider)?.id,
    orderType: 'album',
    toast: ({required title, description, destructive = false}) {
      if (mounted) toasts(context).show(title: title, description: description, destructive: destructive);
    },
  )..addListener(_changed);

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _coupon
      ..removeListener(_changed)
      ..dispose();
    for (final c in [_name, _phone, _address, _city, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final toast = toasts(context);
    final user = ref.read(authUserProvider);
    if (user == null) {
      toast.show(title: tr('albumorderscreen_hesabiniza_daxil_olun_2c437b', 'Hesabınıza daxil olun'), destructive: true);
      return;
    }
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty) {
      toast.show(title: tr('albumorderscreen_ad_ve_telefon_mutleq_doldurulmalidir_7fdd41', 'Ad və telefon mütləq doldurulmalıdır'), destructive: true);
      return;
    }
    if (_address.text.trim().isEmpty) {
      toast.show(title: tr('albumorderscreen_catdirilma_unvanini_daxil_edin_895f4d', 'Çatdırılma ünvanını daxil edin'), destructive: true);
      return;
    }
    setState(() => _submitting = true);
    final backend = ref.read(albumOrderBackendProvider);
    try {
      String? proofUrl;
      final proof = _proof;
      if (proof != null) {
        final ext = proof.name.split('.').last;
        final path = 'album-proofs/${user.id}/${ref.read(albumOrderClockProvider)().millisecondsSinceEpoch}.$ext';
        proofUrl = await backend.uploadProof(path, proof.bytes, contentType: proof.mimeType);
      }
      await backend.insertAlbumOrder({
        'user_id': user.id,
        'album_type': widget.albumType,
        'customer_name': _name.text,
        'contact_phone': _phone.text,
        'delivery_address': '${_city.text}, ${_address.text}',
        'notes': _notes.text,
        'payment_method': _paymentMethod,
        'payment_proof_url': proofUrl,
        'total_price': 0,
      });
      if (mounted) setState(() => _success = true);
    } catch (_) {
      toast.show(title: tr('albumorderscreen_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: tr('albumorderscreen_yeniden_cehd_edin_0040c9', 'Yenidən cəhd edin'), destructive: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  TextStyle _label(BuildContext context) => px(11.5, weight: FontWeight.w600, color: context.a.inkSoft);
  TextStyle _sectionTitle(BuildContext context) => px(13.5, weight: FontWeight.w700, color: context.a.ink);

  Widget _field(BuildContext context, String label, TextEditingController c, {String? placeholder, bool multiline = false, Key? key, TextInputType? keyboard}) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(label, style: _label(context)),
      const SizedBox(height: 4),
      ShadInput(
        fieldKey: key,
        controller: c,
        placeholder: placeholder,
        onChanged: (_) => setState(() {}),
        height: 44,
        radius: 12,
        maxLines: multiline ? null : 1,
        keyboardType: keyboard,
        background: a.surface,
        borderColor: a.lineStrong,
        textColor: a.ink,
        style: multiline ? const TextStyle(fontSize: 14, height: 20 / 14) : null,
      ),
    ]);
  }

  Widget _card(BuildContext context, {required AIconData icon, required String title, required List<Widget> children, double gap = 12}) {
    final a = context.a;
    return ACard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          AIcon(icon, size: 15, color: a.accentInk),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: _sectionTitle(context))),
        ]),
        for (final c in children) ...[SizedBox(height: gap), c],
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    if (_success) return _successView(context);
    final info = _albumInfo(widget.albumType);
    final methods = (ref.watch(paymentMethodsProvider).value ?? const <PaymentMethod>[]).where((m) => m.isActive).toList();
    final canSubmit = !_submitting && _name.text.trim().isNotEmpty && _phone.text.trim().isNotEmpty && _address.text.trim().isNotEmpty;
    final bottom = MediaQuery.paddingOf(context).bottom;

    final form = <Widget>[
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow, border: Border.all(color: a.peach1, width: 1.5)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(info.emoji, style: const TextStyle(fontSize: 30, height: 36 / 30)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(info.title, style: px(13.5, weight: FontWeight.w800, color: a.ink))),
              Text(info.description, style: px(11.5, color: a.inkSoft, height: 1.625)),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final f in info.features)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                      child: Text('✓ $f', style: px(10, weight: FontWeight.w600, color: a.accentInk)),
                    ),
                ]),
              ),
            ]),
          ),
        ]),
      ),
      Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: a.disclaimerBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: a.disclaimerBorder)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 15, color: a.disclaimerStrong)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr('albumorderscreen_qiymet_albom_novu_ve_sehife_sa_1b53a3',
                  'Qiymət albom növü və səhifə sayına görə dəyişir. Sifarişdən sonra sizinlə əlaqə saxlanılacaq və dəqiq qiymət bildiriləcək.'),
              style: px(11, color: a.disclaimerInk, height: 1.625),
            ),
          ),
        ]),
      ),
      _card(context, icon: AIcons.user, title: tr('albumorderscreen_elaqe_melumatlari_8a7aae', 'Əlaqə Məlumatları'), children: [
        _field(context, tr('untranslated_ad_soyad_lm5srh', 'Ad, Soyad *'), _name, key: const ValueKey('album-name'), placeholder: tr('albumorderscreen_adinizi_daxil_edin_bd2b57', 'Adınızı daxil edin')),
        _field(context, tr('albumorderscreen_telefon_nomresi_b26dbc', 'Telefon nömrəsi *'), _phone, key: const ValueKey('album-phone'), placeholder: '+994 50 123 45 67', keyboard: TextInputType.phone),
      ]),
      _card(context, icon: AIcons.mapPin, title: tr('albumorderscreen_catdirilma_unvani_10ea11', 'Çatdırılma Ünvanı'), children: [
        _field(context, tr('albumorderscreen_seher_5f373c', 'Şəhər'), _city, key: const ValueKey('album-city'), placeholder: tr('albumorderscreen_seher_5f373c', 'Şəhər')),
        _field(context, tr('albumorderscreen_unvan_kuce_bina_menzil_9cfd36', 'Ünvan (küçə, bina, mənzil) *'), _address,
            key: const ValueKey('album-address'), multiline: true, placeholder: tr('albumorderscreen_tam_unvaninizi_yazin_0106c0', 'Tam ünvanınızı yazın')),
      ]),
      _card(context, icon: AIcons.fileText, title: tr('albumorderscreen_elave_qeydler_49e1f1', 'Əlavə Qeydlər'), gap: 8, children: [
        ShadInput(
          fieldKey: const ValueKey('album-notes'),
          controller: _notes,
          maxLines: null,
          radius: 12,
          background: a.surface,
          borderColor: a.lineStrong,
          textColor: a.ink,
          style: const TextStyle(fontSize: 14, height: 20 / 14),
          placeholder: tr('albumorderscreen_xususi_istekler_mesaj_ve_s_isteye_bagli_ba89dd', 'Xüsusi istəklər, mesaj və s. (istəyə bağlı)'),
        ),
      ]),
      if (methods.isNotEmpty)
        _card(context, icon: AIcons.creditCard, title: tr('albumorderscreen_odenis_usulu_1ce843', 'Ödəniş Üsulu'), gap: 8, children: [
          for (var i = 0; i < methods.length; i++) Padding(padding: EdgeInsets.only(top: i == 0 ? 0 : 8), child: _method(context, methods[i])),
        ]),
      if (_paymentMethod == 'c2c_transfer') _proofPicker(context),
      _card(context, icon: AIcons.tag, title: trInline('AlbumOrderScreen.tsx', 'Kupon Kodu'), gap: 8, children: [
        CouponInput(
          couponCode: _coupon.couponCode,
          onCodeChange: _coupon.setCouponCode,
          onApply: () => _coupon.validateCoupon(_coupon.couponCode, 0),
          onRemove: _coupon.removeCoupon,
          appliedCoupon: _coupon.appliedCoupon,
          validating: _coupon.validating,
        ),
      ]),
      Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(12)),
            child: AIcon(AIcons.package, size: 19, color: a.blueInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('albumorderscreen_catdirilma_e955cf', 'Çatdırılma'), style: px(13, weight: FontWeight.w700, color: a.blueInk)),
              Text(tr('albumorderscreen_baki_daxili_pulsuz_catdirilma_regionlar__2851a6', 'Bakı daxili pulsuz çatdırılma. Regionlar üçün əlavə haqqı bildiriləcək.'), style: px(11, color: a.blueInk)),
            ]),
          ),
        ]),
      ),
    ];

    final formColumn = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 448),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < form.length; i++) ...[if (i > 0) const SizedBox(height: 16), form[i]],
        ]),
      ),
    );
    return ColoredBox(
      color: a.bg,
      child: LayoutBuilder(builder: (context, c) {
        if (!c.hasBoundedHeight) {
          // Inside the Tools tab (a box in the shell's scroll view): the page flows and the submit bar closes it.
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _header(context),
            Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 16), child: formColumn),
            _bottomBar(context, canSubmit, 0),
          ]);
        }
        return Stack(children: [
          Positioned.fill(
            child: Column(children: [
              _header(context),
              Expanded(
                child: SingleChildScrollView(
                  key: const ValueKey('album-order-scroll'),
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 112 + bottom),
                  child: formColumn,
                ),
              ),
            ]),
          ),
          Positioned(left: 0, right: 0, bottom: 0, child: _bottomBar(context, canSubmit, bottom)),
        ]);
      }),
    );
  }

  Widget _header(BuildContext context) {
    final a = context.a;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [
            AIconBtn(onTap: widget.onBack, tapScale: 0.95, semanticLabel: tr('common_geri', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
            const SizedBox(width: 12),
            AIcon(AIcons.shoppingBag, size: 18, color: a.accentInk),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(tr('albumorderscreen_fiziki_albom_sifarisi_c27c8a', 'Fiziki Albom Sifarişi'), style: px(16, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _method(BuildContext context, PaymentMethod m) {
    final a = context.a;
    final on = _paymentMethod == m.methodKey;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        key: ValueKey('album-method-${m.methodKey}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _paymentMethod = m.methodKey),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: on ? a.peach1 : a.surfaceSoft,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: on ? a.peach2 : const Color(0x00000000), width: 2),
          ),
          child: Row(children: [
            AIcon(AIcons.dynamic(m.icon, fallback: AIcons.creditCard), size: 19, color: a.accentInk),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(m.label, style: px(13, weight: FontWeight.w600, color: on ? a.accentInk : a.ink)),
                if (m.description != null) Text(m.description!, style: px(11, color: a.inkSoft)),
              ]),
            ),
            if (on)
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle),
                child: const AIcon(AIcons.check, size: 12, color: Color(0xFFFFFFFF), strokeWidth: 3),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _proofPicker(BuildContext context) {
    final a = context.a;
    final proof = _proof;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(tr('albumorderscreen_odenis_subutu_sekil_pdf_4e1fa5', 'Ödəniş sübutu (şəkil/PDF)'), style: _label(context)),
      const SizedBox(height: 8),
      GestureDetector(
        key: const ValueKey('album-proof'),
        behavior: HitTestBehavior.opaque,
        onTap: () async {
          final file = await ref.read(albumProofPickerProvider)();
          if (mounted) setState(() => _proof = file);
        },
        child: CustomPaint(
          painter: _DashedBorder(color: a.lineStrong, radius: 16, width: 2),
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(12)),
                child: AIcon(AIcons.upload, size: 16, color: a.accentInk),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(proof?.name ?? tr('albumorderscreen_fayl_secin_6b7641', 'Fayl seçin'), maxLines: 1, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w600, color: a.ink)),
                  Text(tr('albumorderscreen_jpg_png_ve_ya_pdf_db04d6', 'JPG, PNG və ya PDF'), style: px(10, color: a.inkSoft)),
                ]),
              ),
              if (proof != null)
                Container(
                  width: 20,
                  height: 20,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.green2, shape: BoxShape.circle),
                  child: const AIcon(AIcons.check, size: 12, color: Color(0xFFFFFFFF), strokeWidth: 3),
                ),
            ]),
          ),
        ),
      ),
    ]);
  }

  Widget _bottomBar(BuildContext context, bool canSubmit, double bottom) {
    final a = context.a;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
          decoration: BoxDecoration(color: a.navBg, border: Border(top: BorderSide(color: a.line))),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 448),
              child: Semantics(
                button: true,
                enabled: canSubmit,
                child: GestureDetector(
                  key: const ValueKey('album-submit'),
                  onTap: canSubmit ? _submit : null,
                  child: Opacity(
                    opacity: canSubmit ? 1 : 0.5,
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: a.peach2,
                        borderRadius: BorderRadius.circular(999),
                        // 0 14px 28px -12px rgba(217, 108, 74, 0.55) (AlbumOrderScreen.tsx submit button)
                        boxShadow: const [BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
                      ),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        if (_submitting) ...[const ALoader(size: 20, color: Color(0xFFFFFFFF)), const SizedBox(width: 8)],
                        Text(
                          _submitting ? tr('albumorderscreen_gonderilir_1d548c', 'Göndərilir...') : tr('albumorderscreen_sifarisi_gonder_41d5a1', 'Sifarişi Göndər'),
                          style: px(16, weight: FontWeight.w700, color: const Color(0xFFFFFFFF)),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _successView(BuildContext context) {
    final a = context.a;
    // `min-h-screen flex items-center justify-center`.
    return LayoutBuilder(
      builder: (context, c) => SizedBox(
        height: c.hasBoundedHeight ? null : MediaQuery.sizeOf(context).height,
        child: _successBody(context, a),
      ),
    );
  }

  Widget _successBody(BuildContext context, ATokens a) {
    return ColoredBox(
      color: a.bg,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 600),
              curve: Curves.elasticOut,
              builder: (context, v, child) => Transform.scale(scale: v, child: child),
              child: Container(
                width: 80,
                height: 80,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
                child: AIcon(AIcons.check, size: 38, color: a.greenInk, strokeWidth: 2.5),
              ),
            ),
            const SizedBox(height: 16),
            Text(tr('albumorderscreen_sifarisiniz_qebul_edildi_8a131d', 'Sifarişiniz qəbul edildi! 🎉'), textAlign: TextAlign.center, style: px(19, weight: FontWeight.w800, color: a.ink)),
            const SizedBox(height: 8),
            Text(tr('albumorderscreen_sifaris_nomreniz_tezlikle_gonderilecek_9398b5', 'Sifariş nömrəniz tezliklə göndəriləcək.'), textAlign: TextAlign.center, style: px(13, color: a.inkSoft)),
            const SizedBox(height: 4),
            Text(tr('albumorderscreen_elaqe_saxlanilacaq_ve_qiymet_barede_melu_0b90e4', 'Əlaqə saxlanılacaq və qiymət barədə məlumat veriləcək.'),
                textAlign: TextAlign.center, style: px(11.5, color: a.inkFaint)),
            const SizedBox(height: 24),
            GestureDetector(
              key: const ValueKey('album-success-back'),
              onTap: widget.onBack,
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 32),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                child: Text(tr('albumorderscreen_geri_qayit_ff66c2', 'Geri qayıt'), style: px(14, weight: FontWeight.w500, color: const Color(0xFFFFFFFF))),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `border: 2px dashed` around a rounded box.
class _DashedBorder extends CustomPainter {
  _DashedBorder({required this.color, required this.radius, required this.width});
  final Color color;
  final double radius;
  final double width;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect.deflate(width / 2), Radius.circular(radius)));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    for (final PathMetric metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 6), paint);
        d += 12;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius || old.width != width;
}
