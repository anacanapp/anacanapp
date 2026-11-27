// Ported from: src/components/tools/RegionalMaternityCalculator.tsx
import 'package:flutter/services.dart' show FilteringTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show NumberFormat;
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/maternity/maternity_regional.dart';
import '../../../state/user_store.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../settings/ui/settings_ui.dart' show px, ShadSelect;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'maternity_copy.dart';

/// `<a target="_blank">` for the policy sources; tests override it.
final maternitySourceLauncherProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    });

class RegionalMaternityCalculator extends ConsumerStatefulWidget {
  const RegionalMaternityCalculator({
    super.key,
    required this.country,
    required this.countries,
    required this.onCountryChange,
    this.initialDueDate,
    required this.onBack,
  });
  final String country;
  final List<String> countries;
  final ValueChanged<String> onCountryChange;
  final String? initialDueDate;
  final VoidCallback onBack;

  @override
  ConsumerState<RegionalMaternityCalculator> createState() => _RegionalMaternityCalculatorState();
}

class _RegionalMaternityCalculatorState extends ConsumerState<RegionalMaternityCalculator> {
  late String _dueDate = widget.initialDueDate ?? '';
  String _startDate = '';
  String _babies = '1';
  String _existing = '0';
  bool _sole = false;
  bool _complicated = false;
  bool _premature = false;
  String _extra = '0';
  String _plan = '120';
  String _ownDays = '';
  bool _flexible = false;
  bool _combined = false;
  bool _shortInsurance = false;
  final List<String> _earnings = ['', '', ''];
  String _paidSalary = '';
  String _incomeDays = '';
  String _minimumDays = '';
  RegionalMaternityResult? _result;
  bool _error = false;

  String get _country => widget.country;
  String _t(String key, [Map<String, Object?> values = const {}]) => maternityText(key, ref.read(userStoreProvider).language, values);

  void _reset() {
    _result = null;
    _error = false;
  }

  /// `Number(value)` of an `<input type="number">` value ('' → 0).
  num _num(String v) => v.isEmpty ? 0 : jsNumber(v);

  void _calculate() {
    final input = kMaternityCountryInput[_country];
    // `<input type="date" required>`: the browser blocks the submit.
    if (_dueDate.isEmpty) return;
    try {
      final r = calculateRegionalMaternity(RegionalMaternityInput(
        country: _country,
        dueDate: _dueDate,
        startDate: _startDate.isEmpty ? null : _startDate,
        birthCount: _num(_babies),
        existingChildren: _num(_existing),
        soleParent: _sole,
        complicated: _complicated,
        premature: _premature,
        certifiedExtraMonths: _num(_extra),
        portuguesePlan: _plan,
        ownDays: _ownDays.isEmpty ? null : _num(_ownDays),
        includeFlexible: _flexible,
        combinedPoland: _combined,
        shortInsuranceJapan: _shortInsurance,
        earnings: input == 'three-months' ? [for (final e in _earnings) _num(e)] : (_earnings[0].isNotEmpty ? [_num(_earnings[0])] : const []),
        paidSalaryDaily: _paidSalary.isEmpty ? 0 : _num(_paidSalary),
        swedenIncomeDays: _incomeDays.isEmpty ? null : _num(_incomeDays),
        swedenMinimumDays: _minimumDays.isEmpty ? null : _num(_minimumDays),
      ));
      setState(() {
        _result = r;
        _error = false;
      });
    } catch (_) {
      setState(() {
        _result = null;
        _error = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final locale = appLanguageLocale(language);
    final options = [...widget.countries]..sort((p, q) {
        if (p == _country) return -1;
        if (q == _country) return 1;
        return localizedCountryName(p, language).compareTo(localizedCountryName(q, language));
      });
    final input = kMaternityCountryInput[_country] ?? 'agency';
    final c = _country;
    final label = px(14, weight: FontWeight.w600, color: a.ink);
    final small = px(14, color: a.ink);
    String date(DateTime d) => formatDatePattern(d, 'dd MMMM yyyy');

    Widget numberField(String text, String value, ValueChanged<String> change, {Key? key}) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(text, style: label)),
            _NumberInput(
              key: key,
              value: value,
              onChanged: (v) => setState(() {
                change(v);
                _reset();
              }),
            ),
          ]),
        );
    Widget toggle(String text, bool value, ValueChanged<bool> change, {Key? key}) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: GestureDetector(
            key: key,
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() {
              change(!value);
              _reset();
            }),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Container(
                  width: 16,
                  height: 16,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: value ? context.tokens.shadcn.primary : null,
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(color: value ? context.tokens.shadcn.primary : a.inkSoft),
                  ),
                  child: value ? const AIcon(AIcons.check, size: 12, color: Color(0xFFFFFFFF)) : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(text, style: small)),
            ]),
          ),
        );
    Widget dateField(String text, String value, ValueChanged<String> change, {Key? key}) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(text, style: label)),
            PDateInput(fieldKey: key, value: value, max: DateTime(2100), onChanged: (v) => setState(() => change(v))),
          ]),
        );

    final r = _result;
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(onBack: widget.onBack, eyebrow: localizedCountryName(c, language), title: _t('title')),
        ShadSelect<String>(
          fieldKey: const ValueKey('regional-country'),
          value: c,
          options: [for (final code in options) (code, Text(localizedCountryName(code, language)))],
          onChanged: widget.onCountryChange,
        ),
        const SizedBox(height: 16),
        Text(_t('normal_scope'), style: x.aListSub),
        const SizedBox(height: 16),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            dateField(_t('due_date'), _dueDate, (v) {
              _dueDate = v;
              _startDate = '';
              _reset();
            }, key: const ValueKey('regional-due')),
            if (const ['ID', 'VN', 'PT', 'PL', 'NL', 'SE'].contains(c))
              dateField(_t('start_date'), _startDate, (v) {
                _startDate = v;
                _reset();
              }),
            numberField(_t('babies'), _babies, (v) {
              _babies = v;
              _incomeDays = '';
              _minimumDays = '';
            }, key: const ValueKey('regional-babies')),
            if (const ['FR', 'IN'].contains(c)) numberField(_t('existing_children'), _existing, (v) => _existing = v),
            if (const ['ES', 'SE'].contains(c))
              toggle(_t('sole_parent'), _sole, (v) {
                _sole = v;
                _incomeDays = '';
                _minimumDays = '';
              }),
            if (c == 'CN') toggle(_t('complicated_cn'), _complicated, (v) => _complicated = v),
            if (c == 'KR') toggle(_t('premature_kr'), _premature, (v) => _premature = v),
            if (c == 'ID') numberField(_t('certified_months'), _extra, (v) => _extra = v),
            if (c == 'PT') ...[
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_t('plan'), style: label)),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ShadSelect<String>(
                  value: _plan,
                  options: [for (final v in const ['120', '150', 'shared150', 'shared180', 'shared180-90']) (v, Text(_t('pt_${v.replaceFirst('-', '_')}')))],
                  onChanged: (v) => setState(() {
                    _plan = v;
                    _ownDays = '';
                    _reset();
                  }),
                ),
              ),
              numberField(_t('own_days'), _ownDays, (v) => _ownDays = v),
            ],
            if (c == 'ES') toggle(_t('include_flexible'), _flexible, (v) => _flexible = v),
            if (c == 'PL') toggle(_t('combined_pl'), _combined, (v) => _combined = v),
            if (c == 'JP') toggle(_t('short_insurance_jp'), _shortInsurance, (v) => _shortInsurance = v),
            if (c == 'SE') ...[
              numberField(_t('income_days'), _incomeDays, (v) => _incomeDays = v),
              numberField(_t('minimum_days'), _minimumDays, (v) => _minimumDays = v),
            ],
            if (input != 'agency') ...[
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text('${_t('$c.inputLabel')} · ${regionalMaternityCurrency[c]}', style: label)),
              for (final i in input == 'three-months' ? const [0, 1, 2] : const [0])
                numberField(
                  input == 'three-months' ? _t('month_n', {'number': i + 1}) : _t('$c.inputLabel'),
                  _earnings[i],
                  (v) => _earnings[i] = v,
                  key: ValueKey('regional-earning-$i'),
                ),
              if (c == 'JP') numberField(_t('paid_salary_jp'), _paidSalary, (v) => _paidSalary = v),
            ],
            if (_error)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Semantics(liveRegion: true, child: Text(_t('input_error'), style: px(14, color: context.tokens.shadcn.destructive))),
              ),
            AButton(
              key: const ValueKey('regional-calculate'),
              variant: AButtonVariant.pillSolid,
              block: true,
              onPressed: _calculate,
              child: Text(_t('calculate')),
            ),
          ]),
        ),
        if (r != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: ACard(
              key: const ValueKey('regional-result'),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(_t('your_period'), style: x.heading(px(18, color: a.ink))),
                const SizedBox(height: 12),
                Text(
                  r.months != null ? _t('calendar_months', {'count': r.months}) : _t('calendar_days', {'count': jsNumberToString(r.days)}),
                  key: const ValueKey('regional-days'),
                  style: px(20, weight: FontWeight.w700, color: a.ink),
                ),
                if (r.entitlementDays != r.days) ...[
                  const SizedBox(height: 12),
                  Text('${_t('programme_total')}: ${_t('calendar_days', {'count': jsNumberToString(r.entitlementDays)})}', style: small),
                ],
                const SizedBox(height: 12),
                Text('${date(r.start)} – ${date(r.end)}', style: small),
                const SizedBox(height: 12),
                Text(_t('date_example'), style: x.aListSub),
                if (r.money != null) ...[
                  const SizedBox(height: 12),
                  Text(_t('estimate'), style: px(14, weight: FontWeight.w600, color: a.ink)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      NumberFormat.simpleCurrency(locale: _intl(locale), name: r.currency).format(r.money),
                      key: const ValueKey('regional-money'),
                      style: px(20, weight: FontWeight.w700, color: a.ink),
                    ),
                  ),
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(_t('estimate_scope'), style: x.aListSub)),
                ],
                if (r.yearUnsupported) ...[const SizedBox(height: 12), Text(_t('year_unavailable'), style: small)],
                if (r.agency) ...[
                  const SizedBox(height: 12),
                  Text(
                    c == 'PT' && _num(_babies) > 1 ? _t('special_scope') : pregnancyFollowupText('maternity_personal_calculation', language),
                    style: small,
                  ),
                ],
              ]),
            ),
          ),
        for (final key in const ['duration', 'eligibility', 'payment', 'exceptions'])
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(pregnancyFollowupText('maternity_$key', language), style: x.heading(px(16, color: a.ink))),
                const SizedBox(height: 8),
                Text(_t('$c.$key'), key: ValueKey('regional-rule-$key'), style: px(14, color: a.ink, height: 1.625)),
              ]),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(pregnancyFollowupText('maternity_reviewed', language, {'date': kMaternityReviewedAt}), style: x.aListSub),
              for (final s in kMaternityCountrySources[c] ?? const <({String url, String? originalUrl, String? archivedAt})>[])
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: GestureDetector(
                    onTap: () => ref.read(maternitySourceLauncherProvider)(Uri.parse(s.url)),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.externalLink, size: 15, color: a.ink)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(
                            '${pregnancyFollowupText('maternity_source', language)} · ${Uri.parse(s.originalUrl ?? s.url).host}',
                            style: small.copyWith(decoration: TextDecoration.underline),
                          ),
                          if (s.archivedAt != null) Text('web.archive.org · ${s.archivedAt}', style: px(12, color: a.ink)),
                        ]),
                      ),
                    ]),
                  ),
                ),
            ]),
          ),
        ),
      ]),
    );
  }

  /// BCP-47 tag → intl locale name (`az-AZ` → `az_AZ`).
  static String _intl(String tag) => tag.replaceAll('-', '_');
}

/// `<input class="a-input" type="number" inputmode="decimal" min="0" step="any">`.
class _NumberInput extends StatefulWidget {
  const _NumberInput({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<_NumberInput> createState() => _NumberInputState();
}

class _NumberInputState extends State<_NumberInput> {
  late final TextEditingController _c = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(_NumberInput old) {
    super.didUpdateWidget(old);
    if (widget.value != _c.text) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(13, color: a.ink);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
      child: Material(
        type: MaterialType.transparency,
        child: TextField(
          controller: _c,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.eE+-]'))],
          onChanged: widget.onChanged,
          style: style,
          cursorColor: a.peach2,
          decoration: const InputDecoration(isCollapsed: true, border: InputBorder.none),
        ),
      ),
    );
  }
}
