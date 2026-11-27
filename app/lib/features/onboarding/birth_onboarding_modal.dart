// Ported from: src/components/BirthOnboardingModal.tsx
//
// Pregnancy → motherhood transition: birth date, baby name(s) + gender, delivery type, optional birth weight /
// height, then profiles (legacy single-baby fields from the first baby) and one user_children row per baby
// (idempotent by name + birth date; the original due date is copied for corrected age). Multiples
// (profiles.baby_count) collect every baby separately; single-baby families see the original layout.

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/data/data.dart' show dbProvider;
import '../../core/i18n/i18n.dart' hide rtlX;
import '../../design/design.dart';
import '../../state/user_store.dart';

/// Opens the modal (`isOpen` + `onClose` + `onComplete`).
Future<void> showBirthOnboardingModal(BuildContext context, {required VoidCallback onComplete}) => showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'birth-onboarding',
      // `bg-black/60 backdrop-blur-sm`
      barrierColor: const Color(0x99000000),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, _, _) => BirthOnboardingModal(onClose: () => Navigator.of(context).pop(), onComplete: () {
        Navigator.of(context).pop();
        onComplete();
      }),
      transitionBuilder: (context, animation, _, child) => FadeTransition(opacity: animation, child: child),
    );

class _Baby {
  _Baby({this.name = ''});
  String name;
  String gender = 'boy';
  String weight = '';
  String height = '';
}

class BirthOnboardingModal extends ConsumerStatefulWidget {
  const BirthOnboardingModal({super.key, required this.onClose, required this.onComplete});
  final VoidCallback onClose;
  final VoidCallback onComplete;
  @override
  ConsumerState<BirthOnboardingModal> createState() => _BirthOnboardingModalState();
}

class _BirthOnboardingModalState extends ConsumerState<BirthOnboardingModal> with SingleTickerProviderStateMixin {
  static const int totalSteps = 4;
  int _step = 1;
  bool _loading = false;
  DateTime? _birthDate = DateTime.now();
  late final List<_Baby> _babies;
  String _delivery = 'natural';
  late final AnimationController _enter = AnimationController.unbounded(vsync: this, value: 0);

  int get _babyCount => ((ref.read(authProfileProvider)?.babyCount ?? 1).clamp(1, 4));
  bool get _multiple => _babies.length > 1;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(authProfileProvider);
    _babies = [for (var i = 0; i < _babyCount; i++) _Baby(name: i == 0 ? (profile?.babyName ?? '') : '')];
    // `initial={{scale: .9, opacity: 0, y: 20}} animate={{scale: 1, opacity: 1, y: 0}}` (framer default spring).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (AnacanTokens.of(context).lite || animationsDisabled(context)) {
        _enter.value = 1;
      } else {
        _enter.animateWith(SpringSimulation(ASprings.transform, 0, 1, 0));
      }
    });
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  List<({String value, String label, String emoji, String description})> get _deliveryOptions => [
        (value: 'natural', label: tr('birthonboardingmodal_tebii_dogus_d7dea2', 'Təbii doğuş'), emoji: '🌸', description: tr('birthonboardingmodal_vaginal_dogus_e137c8', 'Vaginal doğuş')),
        (value: 'cesarean', label: tr('birthonboardingmodal_qeyseriyye_d8c1b4', 'Qeysəriyyə'), emoji: '🏥', description: tr('birthonboardingmodal_sezaryen_emeliyyati_120bc4', 'Sezaryen əməliyyatı')),
        (value: 'assisted', label: tr('birthonboardingmodal_komekli_dogus_9ccc60', 'Köməkli doğuş'), emoji: '🩺', description: 'Vakuum/forseps'),
      ];

  String _nth(int i) => tr('birthonboardingmodal_n_ci_korpe', '{n}-ci körpə').replaceFirst('{n}', '${i + 1}');

  String _ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _toast(String title, String? description, {bool destructive = false}) {
    try {
      AToastHost.of(context).show(title: title, description: description, destructive: destructive);
    } catch (_) {}
  }

  Future<void> _complete() async {
    final user = ref.read(authUserProvider);
    final profile = ref.read(authProfileProvider);
    if (user == null || _birthDate == null || _babies.any((b) => b.name.trim().isEmpty)) {
      _toast(tr('birthonboardingmodal_xeta_3cdbb6', 'Xəta'), tr('birthonboardingmodal_zeruri_saheleri_doldurun_ab6828', 'Zəruri sahələri doldurun'), destructive: true);
      return;
    }
    setState(() => _loading = true);
    final db = ref.read(dbProvider);
    try {
      final birth = _ymd(_birthDate!);
      final first = _babies.first;
      final deliveryLabel = _deliveryOptions.where((d) => d.value == _delivery).firstOrNull?.label ?? _delivery;
      // Legacy single-baby profile fields from the FIRST baby (partner screens still read them).
      await db.from('profiles').update({
        'life_stage': 'mommy',
        'baby_name': first.name.trim(),
        'baby_birth_date': birth,
        'baby_gender': first.gender,
        'birth_weight_kg': first.weight.isEmpty ? null : double.tryParse(first.weight),
        'birth_height_cm': first.height.isEmpty ? null : double.tryParse(first.height),
        'delivery_type': _delivery,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('user_id', user.id);
      // One user_children row per baby (read existing rows, insert only missing: the unique index is partial).
      final existing = await db.query(() => db.from('user_children').select('name, birth_date').eq('user_id', user.id).eq('is_active', true));
      final keys = {for (final c in existing.data ?? const <Map<String, dynamic>>[]) '${c['name']}::${c['birth_date']}'};
      // Premature support: copy the original EDD (or LMP + 280 days) to each baby.
      String? due = profile?.dueDate;
      if (due == null && profile?.lastPeriodDate != null) {
        final lmp = DateTime.tryParse(profile!.lastPeriodDate!);
        if (lmp != null) due = _ymd(DateTime(lmp.year, lmp.month, lmp.day + 280));
      }
      for (var i = 0; i < _babies.length; i++) {
        final baby = _babies[i];
        final name = baby.name.trim();
        if (keys.contains('$name::$birth')) continue;
        await db.query(() => db.from('user_children').insert({
              'user_id': user.id,
              'name': name,
              'birth_date': birth,
              'due_date': due,
              'gender': baby.gender,
              'avatar_emoji': baby.gender == 'girl' ? '👧' : '👦',
              'is_active': true,
              'sort_order': i,
              'notes': tr('birthonboardingmodal_notes_template', 'Doğum çəkisi: {weight} {weightUnit}, Boy: {height} {heightUnit}, Doğum tipi: {type}')
                  .replaceFirst('{weight}', baby.weight.isEmpty ? '-' : baby.weight)
                  .replaceFirst('{weightUnit}', tr('unit_kg', 'kq'))
                  .replaceFirst('{height}', baby.height.isEmpty ? '-' : baby.height)
                  .replaceFirst('{heightUnit}', tr('unit_cm', 'sm'))
                  .replaceFirst('{type}', deliveryLabel),
            }));
      }
      ref.read(userStoreProvider.notifier).setLifeStage('mommy');
      final names = _babies.map((b) => b.name.trim()).join(' & ');
      _toast(tr('birthonboardingmodal_tebrik_edirik_4dc427', 'Təbrik edirik! 🎉'), '$names ${tr('birth_welcome_world', 'dünyaya xoş gəldi! Analıq səyahətinizə başlayırıq.')}');
      widget.onComplete();
    } catch (error) {
      _toast(tr('birthonboardingmodal_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), '$error', destructive: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canProceed => switch (_step) {
        1 => _birthDate != null,
        2 => _babies.every((b) => b.name.trim().length >= 2),
        _ => true,
      };

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final dark = AnacanTokens.of(context).isDark;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final header = Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        // `bg-gradient-to-br from-[#FF8D89] via-[#FF5A5F] to-[#E2464B]` (BirthOnboardingModal.tsx)
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFF8D89), Color(0xFFFF5A5F), Color(0xFFE2464B)]),
      ),
      child: Stack(children: [
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(16)),
              alignment: Alignment.center,
              child: const AIcon(AIcons.baby, size: 28, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('birthonboardingmodal_tebrik_edirik_4dc427', 'Təbrik edirik! 🎉'), style: const TextStyle(fontSize: 20, height: 28 / 20, fontWeight: FontWeight.w700, color: Colors.white)),
                Text(
                  _multiple
                      ? tr('birthonboardingmodal_korpeleriniz_haqqinda_melumat', 'Körpələriniz haqqında məlumat verin')
                      : tr('birthonboardingmodal_korpeniz_haqqinda_melumat_verin_7560c6', 'Körpəniz haqqında məlumat verin'),
                  style: const TextStyle(fontSize: 14, height: 20 / 14, color: Color(0xCCFFFFFF)),
                ),
              ]),
            ),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            for (var i = 0; i < totalSteps; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  height: 6,
                  decoration: BoxDecoration(color: i < _step ? Colors.white : const Color(0x4DFFFFFF), borderRadius: BorderRadius.circular(999)),
                ),
              ),
            ],
          ]),
        ]),
        PositionedDirectional(
          top: -8,
          end: -8,
          child: GestureDetector(
            onTap: widget.onClose,
            child: Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(color: Color(0x33FFFFFF), shape: BoxShape.circle),
              alignment: Alignment.center,
              child: const AIcon(AIcons.x, size: 16, color: Colors.white),
            ),
          ),
        ),
      ]),
    );

    Widget stepHead(AIconData icon, String title, String sub) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(children: [
            Container(
              width: 64,
              height: 64,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: dark ? TwColors.pink950.withValues(alpha: 0.5) : TwColors.pink100, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: AIcon(icon, size: 32, color: TwColors.pink500),
            ),
            Text(title, style: TextStyle(fontSize: 18, height: 28 / 18, fontWeight: FontWeight.w700, color: s.foreground)),
            Text(sub, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: s.mutedForeground)),
          ]),
        );

    Widget input(String value, ValueChanged<String> onChanged, {required String placeholder, double height = 56, double fontSize = 18, bool center = true, AIconData? icon, bool numeric = false, bool autofocus = false}) =>
        SizedBox(
          height: height,
          child: TextFormField(
            initialValue: value,
            autofocus: autofocus,
            onChanged: onChanged,
            textAlign: center ? TextAlign.center : TextAlign.start,
            keyboardType: numeric ? const TextInputType.numberWithOptions(decimal: true) : null,
            style: TextStyle(fontSize: fontSize, fontWeight: center ? FontWeight.w500 : FontWeight.w400, color: s.foreground),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: TextStyle(color: s.mutedForeground),
              filled: true,
              fillColor: s.background,
              contentPadding: EdgeInsetsDirectional.only(start: icon != null ? 40 : 12, end: 12),
              prefixIcon: icon != null ? Padding(padding: const EdgeInsetsDirectional.only(start: 12, end: 8), child: AIcon(icon, size: 16, color: s.mutedForeground)) : null,
              prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(TwRadius.md), borderSide: BorderSide(color: s.input)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(TwRadius.md), borderSide: BorderSide(color: s.ring, width: 2)),
            ),
          ),
        );

    Widget genderButtons(_Baby baby) => Row(children: [
          for (final (i, (value, label, emoji, bg, border)) in [
            ('boy', tr('birthonboardingmodal_oglan_e9715e', 'Oğlan'), '👦', dark ? TwColors.blue950.withValues(alpha: 0.5) : TwColors.blue100, TwColors.blue300),
            ('girl', tr('birthonboardingmodal_qiz_79bf6b', 'Qız'), '👧', dark ? TwColors.pink950.withValues(alpha: 0.5) : TwColors.pink100, TwColors.pink300),
          ].indexed) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(
              child: PressScale(
                onTap: () => setState(() => baby.gender = value),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: baby.gender == value ? bg : s.muted.withValues(alpha: 0.5),
                    border: Border.all(color: baby.gender == value ? border : Colors.transparent, width: 2),
                    borderRadius: BorderRadius.circular(TwRadius.xl),
                  ),
                  child: Column(children: [
                    Padding(padding: EdgeInsets.only(bottom: _multiple ? 4 : 8), child: Text(emoji, style: TextStyle(fontSize: _multiple ? 24 : 30))),
                    Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  ]),
                ),
              ),
            ),
          ],
        ]);

    final locale = currentLanguage();
    late final Widget content;
    switch (_step) {
      case 1:
        content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          stepHead(
            AIcons.calendar,
            tr('birthonboardingmodal_dogum_tarixi_d96907', 'Doğum tarixi'),
            _multiple ? tr('birthonboardingmodal_korpeleriniz_ne_vaxt_doguldu', 'Körpələriniz nə vaxt doğuldu?') : tr('birthonboardingmodal_korpeniz_ne_vaxt_doguldu_165d80', 'Körpəniz nə vaxt doğuldu?'),
          ),
          GestureDetector(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(context: context, initialDate: _birthDate ?? now, firstDate: DateTime(2020, 1, 1), lastDate: now);
              if (picked != null) setState(() => _birthDate = picked);
            },
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(color: s.background, border: Border.all(color: s.input), borderRadius: BorderRadius.circular(TwRadius.md)),
              child: Row(children: [
                const AIcon(AIcons.calendar, size: 20, color: TwColors.pink500),
                const SizedBox(width: 12),
                Text(
                  _birthDate != null ? formatDatePattern(_birthDate!, 'd MMMM yyyy', language: locale) : tr('birthonboardingmodal_tarix_secin_3377b4', 'Tarix seçin'),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: _birthDate == null ? s.mutedForeground : s.foreground),
                ),
              ]),
            ),
          ),
        ]);
      case 2:
        content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          stepHead(
            AIcons.heart,
            _multiple ? tr('birthonboardingmodal_korpelerin_adlari', 'Körpələrin adları') : tr('birthonboardingmodal_korpenin_adi_8a4e9e', 'Körpənin adı'),
            _multiple ? tr('birthonboardingmodal_balaca_mocuzelerinizin_adlari_nedir', 'Balaca möcüzələrinizin adları nədir?') : tr('birthonboardingmodal_balaca_mocuzenizin_adi_nedir_d5c071', 'Balaca möcüzənizin adı nədir?'),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: _multiple ? 320 : double.infinity),
            child: SingleChildScrollView(
              child: Column(children: [
                for (final (i, baby) in _babies.indexed)
                  Container(
                    margin: EdgeInsets.only(top: i > 0 ? 12 : 0),
                    padding: _multiple ? const EdgeInsets.all(12) : EdgeInsets.zero,
                    decoration: _multiple ? BoxDecoration(border: Border.all(color: s.border.withValues(alpha: 0.6)), borderRadius: BorderRadius.circular(16)) : null,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (_multiple)
                        Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_nth(i), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: TwColors.pink500))),
                      input(baby.name, (v) => setState(() => baby.name = v),
                          placeholder: tr('birthonboardingmodal_korpenin_adini_daxil_edin_7deaac', 'Körpənin adını daxil edin'),
                          height: _multiple ? 48 : 56,
                          fontSize: _multiple ? 16 : 18,
                          autofocus: i == 0),
                      SizedBox(height: _multiple ? 12 : 16),
                      genderButtons(baby),
                    ]),
                  ),
              ]),
            ),
          ),
        ]);
      case 3:
        content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          stepHead(AIcons.stethoscope, tr('birthonboardingmodal_dogum_tipi_c2efb4', 'Doğum tipi'), tr('birthonboardingmodal_dogum_nece_bas_tutdu_f27265', 'Doğum necə baş tutdu?')),
          for (final (i, o) in _deliveryOptions.indexed)
            Padding(
              padding: EdgeInsets.only(top: i > 0 ? 8 : 0),
              child: PressScale(
                scale: 0.98,
                onTap: () => setState(() => _delivery = o.value),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _delivery == o.value ? (dark ? TwColors.pink950.withValues(alpha: 0.3) : TwColors.pink50) : s.muted.withValues(alpha: 0.5),
                    border: Border.all(color: _delivery == o.value ? TwColors.pink300 : Colors.transparent, width: 2),
                    borderRadius: BorderRadius.circular(TwRadius.xl),
                  ),
                  child: Row(children: [
                    Text(o.emoji, style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(o.label, style: TextStyle(fontWeight: FontWeight.w600, color: s.foreground)),
                        Text(o.description, style: TextStyle(fontSize: 12, color: s.mutedForeground)),
                      ]),
                    ),
                    if (_delivery == o.value) const AIcon(AIcons.check, size: 20, color: TwColors.pink500),
                  ]),
                ),
              ),
            ),
        ]);
      default:
        final cins = trInline('BirthOnboardingModal.tsx', 'Cins:');
        final kq = tr('birthonboardingmodal_ceki_kq_2f7555', 'Çəki (kq)');
        final sm = tr('birthonboardingmodal_boy_sm_3bc841', 'Boy (sm)');
        Widget kv(String k, String v) => Text.rich(TextSpan(children: [
              TextSpan(text: k, style: TextStyle(color: s.mutedForeground)),
              TextSpan(text: v, style: TextStyle(color: s.foreground, fontWeight: FontWeight.w500)),
            ]), style: const TextStyle(fontSize: 14));
        content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          stepHead(AIcons.sparkles, tr('birthonboardingmodal_dogum_olculeri_674a98', 'Doğum ölçüləri'), tr('birthonboardingmodal_isteye_bagli_sonra_da_elave_ede_bilersin_ade2f0', 'İstəyə bağlı - sonra da əlavə edə bilərsiniz')),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: _multiple ? 240 : double.infinity),
            child: SingleChildScrollView(
              child: Column(children: [
                for (final (i, baby) in _babies.indexed)
                  Container(
                    margin: EdgeInsets.only(top: i > 0 ? 12 : 0),
                    padding: _multiple ? const EdgeInsets.all(12) : EdgeInsets.zero,
                    decoration: _multiple ? BoxDecoration(border: Border.all(color: s.border.withValues(alpha: 0.6)), borderRadius: BorderRadius.circular(16)) : null,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (_multiple)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(baby.name.trim().isNotEmpty ? baby.name.trim() : _nth(i), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: TwColors.pink500)),
                        ),
                      Row(children: [
                        for (final (j, (label, value, icon, hint, set)) in [
                          (kq, baby.weight, AIcons.scale, '3.5', (String v) => baby.weight = v),
                          (sm, baby.height, AIcons.ruler, '50', (String v) => baby.height = v),
                        ].indexed) ...[
                          if (j > 0) const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(label, style: TextStyle(fontSize: 12, color: s.mutedForeground))),
                              input(value, (v) => setState(() => set(v)), placeholder: hint, height: 48, fontSize: 16, center: false, icon: icon, numeric: true),
                            ]),
                          ),
                        ],
                      ]),
                    ]),
                  ),
              ]),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(top: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: dark ? TwColors.pink950.withValues(alpha: 0.3) : TwColors.pink50, borderRadius: BorderRadius.circular(TwRadius.xl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  const AIcon(AIcons.baby, size: 16, color: TwColors.pink500),
                  const SizedBox(width: 8),
                  Text(tr('birthonboardingmodal_xulase_029c8a', 'Xülasə'), style: TextStyle(fontWeight: FontWeight.w600, color: s.foreground)),
                ]),
              ),
              for (final (i, baby) in _babies.indexed)
                Container(
                  margin: EdgeInsets.only(top: i > 0 ? 10 : 0),
                  padding: EdgeInsets.only(top: i > 0 ? 10 : 0),
                  decoration: i > 0 ? BoxDecoration(border: Border(top: BorderSide(color: (dark ? TwColors.pink800 : TwColors.pink200).withValues(alpha: dark ? 0.3 : 0.5)))) : null,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    if (_multiple)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(baby.name.trim().isNotEmpty ? baby.name.trim() : _nth(i),
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: dark ? TwColors.pink400 : TwColors.pink600)),
                      ),
                    Row(children: [
                      Expanded(child: kv(tr('untranslated_ad_w3td2c', 'Ad:'), baby.name)),
                      const SizedBox(width: 8),
                      Expanded(child: kv('$cins ', baby.gender == 'boy' ? tr('birthonboardingmodal_oglan_e9715e', 'Oğlan') : tr('birthonboardingmodal_qiz_79bf6b', 'Qız'))),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(child: kv('$kq: ', baby.weight.isEmpty ? '-' : baby.weight)),
                      const SizedBox(width: 8),
                      Expanded(child: kv('$sm: ', baby.height.isEmpty ? '-' : baby.height)),
                    ]),
                  ]),
                ),
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.only(top: 10),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: (dark ? TwColors.pink800 : TwColors.pink200).withValues(alpha: dark ? 0.3 : 0.5)))),
                child: Row(children: [
                  Expanded(
                    child: kv(tr('untranslated_tarix_15qhck', 'Tarix:'), _birthDate != null ? formatDatePattern(_birthDate!, 'd MMM yyyy', language: locale) : '-'),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: kv(tr('untranslated_tip_5d1vhb', 'Tip:'), _deliveryOptions.where((d) => d.value == _delivery).firstOrNull?.label ?? '')),
                ]),
              ),
            ]),
          ),
        ]);
    }

    Widget button(String label, VoidCallback? onTap, {bool outline = false, AIconData? leading, AIconData? trailing, bool spinner = false}) {
      final fg = outline ? s.foreground : Colors.white;
      Widget body = Container(
        height: 48,
        decoration: BoxDecoration(
          color: outline ? s.background : null,
          border: outline ? Border.all(color: s.input) : null,
          // `bg-gradient-to-r from-[#FF7A7E] to-[#FF5A5F]` (BirthOnboardingModal.tsx)
          gradient: outline ? null : const LinearGradient(colors: [Color(0xFFFF7A7E), Color(0xFFFF5A5F)]),
          borderRadius: BorderRadius.circular(TwRadius.md),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (spinner)
            const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          else ...[
            if (leading != null) ...[AIcon(leading, size: 16, color: fg, mirrorInRtl: leading == AIcons.chevronLeft), const SizedBox(width: 4)],
            Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: fg)),
            if (trailing != null) ...[const SizedBox(width: 4), AIcon(trailing, size: 16, color: fg, mirrorInRtl: true)],
          ],
        ]),
      );
      if (onTap == null) body = Opacity(opacity: 0.5, child: body);
      return Expanded(child: GestureDetector(onTap: onTap, child: body));
    }

    final footer = Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      child: Row(children: [
        if (_step > 1) ...[
          button(tr('common_geri', 'Geri'), () => setState(() => _step--), outline: true, leading: AIcons.chevronLeft),
          const SizedBox(width: 12),
        ],
        if (_step < totalSteps)
          button(tr('untranslated_davam_et_rchhd5', 'Davam et'), _canProceed ? () => setState(() => _step++) : null, trailing: AIcons.chevronRight)
        else
          button(tr('common_tamamla', 'Tamamla'), _loading ? null : _complete, leading: _loading ? null : AIcons.sparkles, spinner: _loading),
      ]),
    );

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: AnimatedBuilder(
          animation: _enter,
          builder: (context, child) => Opacity(
            opacity: _enter.value.clamp(0.0, 1.0),
            child: Transform.translate(offset: Offset(0, 20 * (1 - _enter.value)), child: Transform.scale(scale: 0.9 + 0.1 * _enter.value, child: child)),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: Material(
              color: s.card,
              borderRadius: BorderRadius.circular(TwRadius.r3xl),
              clipBehavior: Clip.antiAlias,
              elevation: 24,
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                header,
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(position: Tween<Offset>(begin: Offset(rtlX(0.05, rtl), 0), end: Offset.zero).animate(animation), child: child),
                    ),
                    child: KeyedSubtree(key: ValueKey('step$_step'), child: content),
                  ),
                ),
                footer,
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
