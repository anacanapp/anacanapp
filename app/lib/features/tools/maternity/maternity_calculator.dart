// Ported from: src/components/tools/MaternityCalculator.tsx
import 'package:flutter/services.dart' show FilteringTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/count_format.dart' show formatIntlNumber;
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/maternity/maternity_regional.dart';
import '../../../domain/maternity/maternity_rules.dart';
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../state/user_store.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../legal/content/markdown_content.dart' show MarkdownContent;
import '../../settings/ui/settings_ui.dart' show px, ShadSelect;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'maternity_benefits.dart';
import 'regional_maternity_calculator.dart';

/// `[...new Set([...maternityRules.map(r => r.code), ...REGIONAL_MATERNITY_COUNTRIES])]`.
final List<String> maternityCountryCodes = {for (final r in maternityRules) r.code, ...regionalMaternityCountries}.toList();

/// `parseFloat(salary)` (NaN → null).
double? jsParseFloat(String s) {
  final m = RegExp(r'^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?').firstMatch(s);
  return m == null ? null : double.tryParse(m[0]!.trim());
}

/// `toLocaleString(getLocaleTag(), { maximumFractionDigits: 2 })`.
String localeNumber(num value) => formatIntlNumber(currentLanguage(), value, maximumFractionDigits: 2);

class MaternityCalculator extends ConsumerStatefulWidget {
  const MaternityCalculator({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<MaternityCalculator> createState() => _MaternityCalculatorState();
}

class _MaternityCalculatorState extends ConsumerState<MaternityCalculator> {
  String _tab = 'calculator';
  final TextEditingController _salary = TextEditingController();
  String _pregnancyType = 'normal';
  String? _country;
  bool _countryChosen = false;
  String _edd = '';
  String _role = 'mother';
  MaternityLeaveResult? _result;
  String? _resultRole;
  String? _expanded;
  String? _profileId;

  @override
  void dispose() {
    _salary.dispose();
    super.dispose();
  }

  void _chooseCountry(String code) => setState(() {
        _countryChosen = true;
        _country = code;
        _result = null;
        _salary.clear();
      });

  void _syncProfile(String language) {
    final profile = ref.read(authProfileProvider);
    final store = ref.read(userStoreProvider);
    // Default country follows the user's REAL country; unsupported countries fall back to AZ.
    if (!_countryChosen) {
      final country = regionalCountry(language, [profile?.countryCode, store.countryCode]);
      if (maternityCountryCodes.contains(country)) {
        _country = country;
      } else {
        _country ??= 'AZ';
      }
    }
    final id = profile?.id;
    if (id != _profileId) {
      _profileId = id;
      // Prefill the known due date (stored YYYY-MM-DD kept as written) and multiples.
      if (_edd.isEmpty) {
        final known = storedDateKey(profile?.dueDate);
        if (known != null) _edd = known;
      }
      final mt = profile?.multiplesType;
      if (mt != null && mt.isNotEmpty && mt != 'single') _pregnancyType = 'multiple';
    }
  }

  void _calculate(MaternityRule rule, bool isAz, MaternityConfig? config) {
    if (_edd.isEmpty) return;
    final r = calculateMaternityLeave(
      rule: rule,
      role: _role,
      pregnancyType: _pregnancyType,
      eddDate: _edd,
      salary: _salary.text,
      isAz: isAz,
      azConfig: config,
    );
    if (r == null) return;
    setState(() {
      _result = r;
      _resultRole = _role;
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    ref.watch(authProfileProvider);
    _syncProfile(language);
    final isAz = language == 'az';
    final country = _country ?? 'AZ';
    final profile = ref.read(authProfileProvider);

    if (isRegionalMaternityCountry(country)) {
      final due = _edd.isNotEmpty ? _edd : (profile?.dueDate != null && profile!.dueDate!.length >= 10 ? profile.dueDate!.substring(0, 10) : null);
      return RegionalMaternityCalculator(
        key: ValueKey('regional-$country'),
        country: country,
        countries: maternityCountryCodes,
        initialDueDate: due,
        onCountryChange: _chooseCountry,
        onBack: widget.onBack,
      );
    }

    final benefitsQ = ref.watch(maternityBenefitsQuery);
    if (benefitsQ.isLoading) return const ToolLoading();
    final benefits = benefitsQ.data ?? const MaternityBenefits();
    final rule = maternityRuleFor(country);
    final comp = rule.compensation;
    final salaryNum = jsParseFloat(_salary.text);
    final needsSalary = _role == 'mother' && comp?['type'] != 'UNPAID';
    final canCalculate = _edd.isNotEmpty && !(needsSalary && (_salary.text.isEmpty || salaryNum == null || salaryNum <= 0));
    final days = isAz ? 'gün' : 'days';

    final guidelineLang = language == 'az'
        ? 'az'
        : (const ['ru', 'kk', 'uz', 'ka'].contains(language) ? 'ru' : (language == 'tr' ? 'tr' : 'en'));
    final guidelines = country == 'AZ' && benefits.guidelines.isNotEmpty
        ? [
            for (final g in benefits.guidelines)
              (id: '${g['id']}', title: '${g['title'] ?? ''}', content: '${g['content'] ?? ''}', icon: (g['icon'] as String?)?.isNotEmpty == true ? g['icon'] as String : '⚖️'),
          ]
        : [
            for (final (i, g) in rule.guidelines(guidelineLang).indexed)
              (id: 'guide-$i', title: '${g['title'] ?? ''}', content: '${g['content'] ?? ''}', icon: '${g['icon'] ?? ''}'),
          ];

    final pregnancyTypes = [
      (value: 'normal', label: tr('maternitycalculator_normal_hamilelik_fa223b', 'Normal hamiləlik'), description: '${rule.normalDaysBefore + rule.normalDaysAfter} $days', icon: '👶'),
      (value: 'complicated', label: tr('maternitycalculator_agir_dogus_3e1a6b', 'Ağır doğuş/Mürəkkəb'), description: '${rule.normalDaysBefore + rule.complicatedDaysAfter} $days', icon: '🏥'),
      (value: 'multiple', label: tr('maternitycalculator_coxdollu_hamilelik_e3c1aa', 'Çoxdöllü hamiləlik'), description: '${rule.multipleDaysBefore + rule.multipleDaysAfter} $days', icon: '👶👶'),
    ];

    Widget card(Widget title, Widget child) => ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: DefaultTextStyle.merge(style: x.heading(x.aCardTitle), child: title)),
            child,
          ]),
        );

    final calculator = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      card(
        Text('🌍 ${tr('country', 'Ölkə')}'),
        ShadSelect<String>(
          fieldKey: const ValueKey('maternity-country'),
          value: country,
          height: 48,
          background: a.surfaceSoft,
          borderColor: const Color(0x00000000),
          textColor: a.ink,
          placeholder: tr('select_country', 'Ölkə seçin'),
          options: [for (final code in maternityCountryCodes) (code, Text(localizedCountryName(code, language)))],
          onChanged: _chooseCountry,
        ),
      ),
      const SizedBox(height: 12),
      card(
        Text(tr('maternitycalculator_rolunuz', 'Rolunuz')),
        Row(children: [
          Expanded(child: _choice(context, 'mother', '🤰', tr('maternitycalculator_ana', 'Ana'))),
          const SizedBox(width: 8),
          Expanded(child: _choice(context, 'father', '👨‍🍼', tr('maternitycalculator_ata', 'Ata'))),
        ]),
      ),
      const SizedBox(height: 12),
      card(
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('📅'),
          const SizedBox(width: 8),
          Flexible(child: Text(tr('maternitycalculator_edd_date', 'Təxmini Doğuş Tarixi (EDD)'))),
        ]),
        PDateInput(
          fieldKey: const ValueKey('maternity-edd'),
          value: _edd,
          max: DateTime(DateTime.now().year + 2, 12, 31),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          fontSize: 14,
          onChanged: (v) => setState(() => _edd = v),
        ),
      ),
      if (_role == 'mother' && comp != null && comp['type'] != 'UNPAID') ...[
        const SizedBox(height: 12),
        card(
          Text('💵 ${tr('maternitycalculator_ayliq_emek_haqqiniz', 'Aylıq əmək haqqınız')} (${comp['currency']})'),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _salaryField(context, '${comp['currency']}'),
            if (country == 'AZ' && benefits.config != null && salaryNum != null && salaryNum > 0 && salaryNum < benefits.config!.minSalary)
              PInfoTip(
                marginTop: 10,
                leading: const AIcon(AIcons.circleAlert, size: 13),
                child: Text(
                  '${tr('maternitycalculator_minimum_emek_haqqi_f94050', 'Minimum əmək haqqı (')}${jsNumberToString(benefits.config!.minSalary)} AZN) ${tr('maternitycalculator_azn_esas_goturulecek_5cb1de', 'əsas götürüləcək')}',
                ),
              ),
          ]),
        ),
      ],
      if (_role == 'mother') ...[
        const SizedBox(height: 12),
        card(
          Text(tr('maternitycalculator_hamilelik_novu_ace2e8', 'Hamiləlik növü')),
          Column(children: [
            for (var i = 0; i < pregnancyTypes.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _typeOption(context, pregnancyTypes[i].value, pregnancyTypes[i].icon, pregnancyTypes[i].label, pregnancyTypes[i].description),
            ],
          ]),
        ),
      ],
      const SizedBox(height: 12),
      Opacity(
        opacity: canCalculate ? 1 : 0.45,
        child: GestureDetector(
          key: const ValueKey('maternity-calculate'),
          onTap: canCalculate ? () => _calculate(rule, isAz, benefits.config) : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const AIcon(AIcons.calculator, size: 17, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 6),
              Text(tr('maternitycalculator_calculate_3c7a2d', 'Hesabla'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
            ]),
          ),
        ),
      ),
      if (_result != null) Padding(padding: const EdgeInsets.only(top: 12, bottom: 32), child: _results(context, _result!, isAz)),
    ]);

    final guide = Padding(
      padding: const EdgeInsets.only(bottom: 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < guidelines.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          ACard(
            padding: EdgeInsets.zero,
            variant: ACardVariant.list,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              PListRow(
                first: true,
                onTap: () => setState(() => _expanded = _expanded == guidelines[i].id ? null : guidelines[i].id),
                leading: PListIcon(background: a.surfaceSoft, child: Text(guidelines[i].icon, style: const TextStyle(fontSize: 18))),
                body: Text(guidelines[i].title, style: x.aListTitle),
                trailing: Transform.rotate(
                  angle: _expanded == guidelines[i].id ? 1.5708 : 0,
                  child: AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: _expanded != guidelines[i].id),
                ),
              ),
              if (_expanded == guidelines[i].id)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                    child: MarkdownContent(content: guidelines[i].content),
                  ),
                ),
            ]),
          ),
        ],
        if (country == 'AZ')
          PInfoTip(
            marginTop: 12,
            leading: const AIcon(AIcons.circleHelp, size: 15),
            child: Text.rich(TextSpan(children: [
              TextSpan(text: tr('maternitycalculator_elave_melumat_ucun_9e3dfc', 'Əlavə məlumat üçün'), style: const TextStyle(fontWeight: FontWeight.w800)),
              TextSpan(text: ' — ${tr('maternitycalculator_dsmf_qaynar_xetti_d8e628', 'DSMF qaynar xətti:')} '),
              const TextSpan(text: '142', style: TextStyle(fontWeight: FontWeight.w800)),
            ])),
          ),
      ]),
    );

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: '${localizedCountryName(country, language)} ${rule.flag}',
          title: tr('maternitycalculator_title_3c7a2d', 'Dekret Kalkulyatoru'),
        ),
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: Row(children: [
            Expanded(child: _tabButton(context, 'calculator', AIcons.calculator, tr('maternitycalculator_calculate_3c7a2d', 'Hesabla'))),
            Expanded(child: _tabButton(context, 'guide', AIcons.fileText, tr('maternitycalculator_beledci_013a52', 'Bələdçi'))),
          ]),
        ),
        const SizedBox(height: 16),
        if (_tab == 'calculator') calculator else guide,
      ]),
    );
  }

  Widget _tabButton(BuildContext context, String id, AIconData icon, String label) {
    final a = context.a;
    final on = _tab == id;
    final color = on ? a.accentInk : a.inkSoft;
    return GestureDetector(
      key: ValueKey('maternity-tab-$id'),
      onTap: () => setState(() => _tab = id),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(color: on ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AIcon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(label, style: px(11.5, weight: FontWeight.w700, color: color)),
        ]),
      ),
    );
  }

  Widget _choice(BuildContext context, String role, String emoji, String label) {
    final a = context.a;
    final on = _role == role;
    return GestureDetector(
      key: ValueKey('maternity-role-$role'),
      onTap: () => setState(() => _role = role),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: on ? a.tagOnBg : a.surfaceSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: on ? a.peach2 : a.line, width: 1.5),
        ),
        child: Column(children: [
          Text(emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(label, style: px(12, weight: on ? FontWeight.w700 : FontWeight.w600, color: on ? a.accentInk : a.ink)),
        ]),
      ),
    );
  }

  Widget _typeOption(BuildContext context, String value, String icon, String label, String description) {
    final a = context.a;
    final x = context.aText;
    final on = _pregnancyType == value;
    return GestureDetector(
      key: ValueKey('maternity-type-$value'),
      onTap: () => setState(() => _pregnancyType = value),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: on ? a.tagOnBg : a.surfaceSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: on ? a.peach2 : a.line, width: 1.5),
        ),
        child: Row(children: [
          Container(
            width: 16,
            height: 16,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: context.tokens.shadcn.primary)),
            child: on ? Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: context.tokens.shadcn.primary)) : null,
          ),
          const SizedBox(width: 12),
          Text(icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: x.aListTitle),
              Text(description, style: x.aListSub),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _salaryField(BuildContext context, String currency) {
    final a = context.a;
    final x = context.aText;
    final example = const {'AZN': '800', 'TRY': '20000', 'RUB': '50000', 'USD': '2000', 'EUR': '2000', 'GBP': '1800', 'AED': '8000'}[currency] ?? '1000';
    final style = px(15, weight: FontWeight.w700, color: a.ink);
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 13, 14, 13),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
      child: Row(children: [
        Expanded(
          child: Material(
            type: MaterialType.transparency,
            child: TextField(
              key: const ValueKey('maternity-salary'),
              controller: _salary,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.eE+-]'))],
              onChanged: (_) => setState(() {}),
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: '${tr('mc_example_prefix', 'Məsələn')}: $example',
                hintStyle: style.copyWith(color: a.inkFaint, fontWeight: FontWeight.w400),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(currency, style: x.aListValue.copyWith(color: a.inkSoft)),
      ]),
    );
  }

  Widget _results(BuildContext context, MaternityLeaveResult r, bool isAz) {
    final a = context.a;
    final x = context.aText;
    String date(DateTime d) => formatDatePattern(d, 'dd MMMM yyyy');
    final role = _resultRole ?? 'mother';
    final benefit = r.benefit;
    final rule = r.rule;
    Widget dot(Color bg, Color border) =>
        Container(width: 16, height: 16, decoration: BoxDecoration(color: bg, shape: BoxShape.circle, border: Border.all(color: border, width: 2.5)));
    Widget step(Color bg, Color border, String title, String sub) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 4), child: dot(bg, border)),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: x.aListTitle), Text(sub, style: x.aListSub)])),
        ]);
    Widget infoCard(Gradient grad, Color ink, AIconData icon, Widget title, String text) => ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [PListIcon(gradient: grad, child: AIcon(icon, size: 17, strokeWidth: 2, color: ink)), const SizedBox(width: 13), Expanded(child: title)]),
            Padding(padding: const EdgeInsets.only(top: 10), child: Text(text, style: px(12.5, color: a.inkSoft, height: 1.65))),
          ]),
        );
    final paternity = rule.paternity;
    final parental = rule.parental;
    final showMoney = benefit != null && benefit['isPaternity'] != true;
    final eddDate = jsParseDate(_edd);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      PCta(
        gradient: a.gradGreen,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          PCtaBadge(
            background: a.chipOverlay,
            color: a.greenInk,
            child: Text(upperCss('${rule.flag} ${isAz ? rule.nameAz : rule.nameEn} · ${tr('maternitycalculator_cemi_mezuniyyet_93196a', 'Cəmi məzuniyyət')}')),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 4),
            child: Text('${r.totalDays} ${tr('maternitycalculator_gun_54e78d', 'gün')}', key: const ValueKey('maternity-total'), style: x.heading(px(30, color: a.greenInk))),
          ),
          Text(
            '${r.daysBefore} ${tr('days_before', 'gün əvvəl')} + ${r.daysAfter} ${tr('days_after', 'gün sonra')}',
            style: x.aCtaText.copyWith(color: a.greenInk.withValues(alpha: 0.75)),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 14), child: Text('📅 ${tr('maternitycalculator_zaman_xetti_visual', 'Zaman Xətti')}', style: x.heading(x.aCardTitle))),
          Container(
            margin: const EdgeInsetsDirectional.only(start: 8),
            padding: const EdgeInsetsDirectional.only(start: 0),
            decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: a.lineStrong, width: 2))),
            child: Transform.translate(
              offset: Offset(Directionality.of(context) == TextDirection.rtl ? 9 : -9, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                step(a.peach1, a.peach2, date(r.leaveStartDate),
                    role == 'father' ? tr('maternitycalculator_paternity_start', 'Atalıq məzuniyyətinin başlanğıcı') : tr('maternitycalculator_leave_start_date', 'Məzuniyyətin Başlanğıcı')),
                if (role == 'mother' && eddDate != null) ...[
                  const SizedBox(height: 20),
                  step(a.yellow1, a.yellow2, date(eddDate), tr('maternitycalculator_edd_date', 'Təxmini Doğuş Tarixi (EDD)')),
                ],
                const SizedBox(height: 20),
                step(a.pink1, a.pink2, date(r.leaveEndDate), tr('maternitycalculator_leave_end_date', 'Məzuniyyətin Sonu')),
                const SizedBox(height: 20),
                step(a.green1, a.green2, date(r.returnToWorkDate), tr('maternitycalculator_return_to_work', 'İşə Qayıdış Tarixi')),
              ]),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      if (showMoney)
        _money(context, benefit)
      else
        infoCard(
          a.gradYellow,
          a.warnInk,
          AIcons.banknote,
          Text(tr('payment_rules', 'Ödəniş Qaydaları'), style: x.aListTitle),
          '${role == 'father' && paternity != null ? (isAz ? paternity['payDescription_az'] : paternity['payDescription_en']) : (isAz ? rule.raw['payDescription_az'] : rule.raw['payDescription_en'])}',
        ),
      if (rule.tenureRequirementMonths != null && rule.tenureRequirementMonths! > 0) ...[
        const SizedBox(height: 12),
        infoCard(
          a.gradBlue,
          a.blueInk,
          AIcons.circleCheck,
          Text(tr('maternity_is_staji_telebi', 'İş Stajı Tələbi'), style: x.aListTitle),
          tr('maternity_staj_metni', 'Məzuniyyət ödənişi almaq üçün son iş yerində minimum {n} ay iş stajınız olmalıdır.')
              .replaceFirst('{n}', jsNumberToString(rule.tenureRequirementMonths!)),
        ),
      ],
      if (parental != null && (parental['months'] as num? ?? 0) > 0) ...[
        const SizedBox(height: 12),
        infoCard(
          a.gradLav,
          a.lavInk,
          AIcons.baby,
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('maternity_usaga_qulluq_mezuniyyeti', 'Uşağa Qulluq Məzuniyyəti'), style: x.aListTitle),
            Text('${tr('maternity_muddet', 'Müddət')}: ${jsNumberToString(parental['months']! as num)} ${tr('common_ay_unit', 'ay')}', style: x.aListSub),
          ]),
          '${isAz ? parental['payDescription_az'] : parental['payDescription_en']}',
        ),
      ],
    ]);
  }

  Widget _money(BuildContext context, Map<String, Object?> b) {
    final a = context.a;
    final x = context.aText;
    final currency = '${b['currency'] ?? ''}';
    Widget line(String label, Widget value, {Color? background, EdgeInsets? padding}) => Container(
          padding: padding ?? const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(color: background, border: Border(top: BorderSide(color: a.line))),
          child: Row(children: [Expanded(child: Text(label, style: x.aListSub)), value]),
        );
    final formula = b['formula'];
    return ACard(
      variant: ACardVariant.list,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.fromLTRB(18, 16, 18, 12), child: Text('💰 ${tr('financial_details', 'Maliyyə Hesablaması')}', style: x.heading(x.aCardTitle))),
        line(tr('maternitycalculator_orta_gunluk_emek_haqqi_39d8be', 'Orta günlük əmək haqqı'),
            Text('${((b['dailySalary'] as num?) ?? 0).toStringAsFixed(2)} $currency', style: x.aListTitle)),
        line(tr('maternitycalculator_dekret_odenisi_af1939', 'Dekret ödənişi'),
            Text('${localeNumber((b['maternityBenefit'] as num?) ?? 0)} $currency', style: x.aListTitle.copyWith(color: a.greenInk))),
        if (b['isNativeAz'] == true && b['birthBenefit'] != null && b['birthBenefit'] != 0)
          line(tr('maternitycalculator_dogum_muavineti_22766f', 'Doğum müavinəti'),
              Text('+${jsNumberToString(b['birthBenefit']! as num)} $currency', style: x.aListTitle.copyWith(color: a.greenInk))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(color: a.green1, border: Border(top: BorderSide(color: a.line))),
          child: Row(children: [
            Expanded(child: Text(tr('total_payment', 'Yekun Ödəniş'), style: x.aListTitle.copyWith(color: a.greenInk))),
            Text('${localeNumber((b['totalBenefit'] as num?) ?? 0)} $currency',
                key: const ValueKey('maternity-total-payment'), style: x.heading(px(19, weight: FontWeight.w800, color: a.greenInk))),
          ]),
        ),
        Container(
          color: a.surfaceSoft,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (formula is String && formula.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text.rich(TextSpan(style: x.aListSub, children: [
                  TextSpan(text: trInline('MaternityCalculator.tsx', 'Formula:'), style: TextStyle(color: a.ink, fontWeight: FontWeight.w700)),
                  TextSpan(text: ' $formula'),
                ])),
              ),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.circleAlert, size: 12, color: a.yellowInk)),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  tr('maternitycalculator_approximate_note',
                      'Qeyd: Hesablama qanunvericiliyin ümumi şərtlərinə əsaslanır və təxminidir. Real məbləğ stajdan və vergilərdən asılı olaraq dəyişə bilər.'),
                  style: x.aListSub.copyWith(color: a.yellowInk),
                ),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}
