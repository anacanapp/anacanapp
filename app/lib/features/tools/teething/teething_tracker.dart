// Ported from: src/components/tools/TeethingTracker.tsx
//
// Progress card, the dental arch (upper / lower, tap a tooth to open its dialog), care tips / symptoms tabs and the
// tooth dialog (typical age, type, status, emerged date, notes, mark / unmark).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../baby/hooks/use_children.dart';
import '../../baby/widgets/child_selector.dart';
import '../../settings/ui/settings_ui.dart' show DateFieldBox, FadeRise, ShadInput, showShadDialog;
import '../baby_tracker/bt_ui.dart' show ACtaButton, ARankTag;
import '../kit/kit.dart';
import 'teething_data.dart';

const List<String> _upperOrder = [
  'upper_second_molar_right', 'upper_first_molar_right', 'upper_canine_right', 'upper_lateral_incisor_right', 'upper_central_incisor_right',
  'upper_central_incisor_left', 'upper_lateral_incisor_left', 'upper_canine_left', 'upper_first_molar_left', 'upper_second_molar_left',
];
const List<String> _lowerOrder = [
  'lower_second_molar_right', 'lower_first_molar_right', 'lower_canine_right', 'lower_lateral_incisor_right', 'lower_central_incisor_right',
  'lower_central_incisor_left', 'lower_lateral_incisor_left', 'lower_canine_left', 'lower_first_molar_left', 'lower_second_molar_left',
];

String _toothName(TRow t) => tr('tooth_name_${t['tooth_code']}', '${t['name'] ?? ''}');

class TeethingTracker extends ConsumerWidget {
  const TeethingTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  String _categoryLabel(String category) => switch (category) {
        'before' => tr('teethingtracker_evvel_b41251', 'Əvvəl'),
        'during' => tr('teethingtracker_zamani_de9ddc', 'Zamanı'),
        'after' => tr('common_sonra', 'Sonra'),
        'pain_relief' => tr('teethingtracker_agri_kesici_9c92cd', 'Ağrı Kəsici'),
        'general' => tr('teethingtracker_umumi_1b5521', 'Ümumi'),
        _ => category,
      };

  Future<void> _openTooth(BuildContext context, WidgetRef ref, TRow tooth) async {
    final view = ref.read(teethingProvider);
    final log = view.getToothLog('${tooth['id']}');
    await showShadDialog<void>(
      context,
      builder: (ctx) => _ToothDialog(
        tooth: tooth,
        initialDate: log != null ? (log['emerged_date'] as String? ?? '') : todayKey(),
        initialNotes: log != null ? (log['notes'] as String? ?? '') : '',
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    final children = ref.watch(childrenProvider);
    final selectedChild = children.selectedChild;
    final view = ref.watch(teethingProvider);
    if (view.loading) return const ToolLoading();
    final age = selectedChild == null ? null : getChildAge(selectedChild);
    final a = context.a;
    final x = context.aText;

    final upper = view.teeth.where((t) => t['position'] == 'upper').toList();
    final lower = view.teeth.where((t) => t['position'] == 'lower').toList();

    Widget gum(String position) {
      final order = position == 'upper' ? _upperOrder : _lowerOrder;
      final list = [...(position == 'upper' ? upper : lower)]
        ..sort((p, q) => order.indexOf('${p['tooth_code']}') - order.indexOf('${q['tooth_code']}'));
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: position == 'lower' ? CrossAxisAlignment.start : CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < list.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            _Tooth(
              tooth: list[i],
              position: position,
              archOffset: (i - 4.5).abs(),
              emerged: view.isToothEmerged('${list[i]['id']}'),
              onTap: () => unawaited(_openTooth(context, ref, list[i])),
            ),
          ],
        ],
      );
    }

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: onBack,
          eyebrow: selectedChild != null
              ? '${selectedChild.name}${age != null ? ' · ${age.displayText}' : ''}'
              : tr('teethingtracker_korpenizin_383c3e', 'Körpənizin'),
          title: tr('teethingtracker_dis_cixarma_izleyicisi_109c3d', 'Diş Çıxarma İzləyicisi'),
          actions: [if (children.hasChildren) const ChildSelector(compact: true)],
        ),
        FadeRise(
          dy: 12,
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                AListIcon(
                  background: const Color(0x00000000),
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
                    child: AIcon(AIcons.sparkles, size: 17, strokeWidth: 2.2, color: a.alertInk),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('teethingtracker_cixan_disler_ab71e7', 'Çıxan Dişlər'), style: x.aListSub),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${view.emergedCount} '),
                        TextSpan(text: '/ ${view.totalTeeth}', style: TextStyle(fontSize: 13, color: a.inkSoft)),
                      ]),
                      key: const ValueKey('teeth-count'),
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: em(-0.02, 20), color: a.ink, height: 1.5),
                    ),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${view.progress.round()}%', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: em(-0.02, 20), color: a.berryInk, height: 1.5)),
                  Text(tr('teethingtracker_tamamlandi_d6728f', 'tamamlandı'), style: x.aListSub),
                ]),
              ]),
              const SizedBox(height: 12),
              Container(
                height: 8,
                decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
                alignment: AlignmentDirectional.centerStart,
                child: FractionallySizedBox(
                  widthFactor: view.progress.clamp(2, 100) / 100,
                  child: Container(decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(999))),
                ),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        FadeRise(
          dy: 12,
          delay: const Duration(milliseconds: 50),
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  AIcon(AIcons.heart, size: 14, color: a.pink2),
                  const SizedBox(width: 6),
                  Text(tr('teethingtracker_dis_diaqrami_a219c2', 'Diş Diaqramı'), style: x.heading(x.aCardTitle)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(tr('teethingtracker_dise_toxunaraq_qeyd_edin_65aadb', 'Dişə toxunaraq qeyd edin'), style: x.aListSub),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(cssUpperAz(tr('teethingtracker_yuxari_cene_589483', 'Yuxarı Çənə')), textAlign: TextAlign.center, style: _eyebrow(context)),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 20, 12, 12),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(80)),
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [a.pink1, a.pink1.withValues(alpha: 0)]),
                ),
                child: gum('upper'),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Stack(alignment: Alignment.center, children: [
                  Container(
                    height: 2,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      gradient: LinearGradient(colors: [a.pink2.withValues(alpha: 0), a.pink2, a.pink2.withValues(alpha: 0)]),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                    decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.pink1)),
                    child: Text(tr('teethingtracker_dis_eti_xetti_22266e', 'Diş əti xətti'),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.pinkInk, height: 1.5)),
                  ),
                ]),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 20),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(80)),
                  gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [a.pink1, a.pink1.withValues(alpha: 0)]),
                ),
                child: gum('lower'),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(cssUpperAz(tr('teethingtracker_asagi_cene_78719d', 'Aşağı Çənə')), textAlign: TextAlign.center, style: _eyebrow(context)),
              ),
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.only(top: 12),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _legend(context, true, tr('teethingtracker_cixib_f2099b', 'Çıxıb')),
                  const SizedBox(width: 24),
                  _legend(context, false, tr('teethingtracker_cixmayib_d90dc0', 'Çıxmayıb')),
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        _TipsTabs(view: view, categoryLabel: _categoryLabel),
        SafetyStrip(signs: tr('safety_teething_signs', 'Zəng edin: 38°C+ hərarət (6 aydan kiçik), maye içməmə, səpgi. Diş yüksək hərarət vermir')),
      ]),
    );
  }

  static TextStyle _eyebrow(BuildContext context) =>
      TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: context.a.onBgSoft, height: 1.5);

  Widget _legend(BuildContext context, bool emerged, String label) {
    final a = context.a;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 16,
        height: 20,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: emerged ? [a.pink1, a.pink2] : [a.surfaceSoft, a.lineStrong],
          ),
          border: Border.all(color: emerged ? a.pink1 : a.lineStrong, width: 2),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(6), bottom: Radius.elliptical(4.8, 6)),
        ),
      ),
      const SizedBox(width: 6),
      Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: a.ink, height: 1.5)),
    ]);
  }
}

/// `text-transform: uppercase` with the Azerbaijani/Turkish dotted İ.
String cssUpperAz(String s) => s.replaceAll('i', 'İ').toUpperCase();

class _Tooth extends StatelessWidget {
  const _Tooth({required this.tooth, required this.position, required this.archOffset, required this.emerged, required this.onTap});
  final TRow tooth;
  final String position;
  final double archOffset;
  final bool emerged;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final type = tooth['tooth_type'];
    final (double w, double h) = type == 'molar' ? (32, 40) : type == 'canine' ? (24, 36) : (24, 32);
    final upper = position == 'upper';
    // rounded-t-lg rounded-b-[40%] (upper) / rounded-b-lg rounded-t-[40%] (lower)
    final radius = upper
        ? BorderRadius.vertical(top: const Radius.circular(8), bottom: Radius.elliptical(w * 0.4, h * 0.4))
        : BorderRadius.vertical(bottom: const Radius.circular(8), top: Radius.elliptical(w * 0.4, h * 0.4));
    return Padding(
      padding: EdgeInsets.only(top: upper ? archOffset * 2 : 0, bottom: upper ? 0 : archOffset * 2),
      child: Semantics(
        button: true,
        toggled: emerged,
        label: _toothName(tooth),
        child: PressScale(
          scale: 0.95,
          onTap: onTap,
          child: SizedBox(
            key: ValueKey('tooth-${tooth['tooth_code']}'),
            width: w,
            height: h,
            child: Stack(clipBehavior: Clip.none, children: [
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: emerged ? [a.pink1, a.pink2] : [a.surfaceSoft, a.lineStrong],
                    ),
                    border: Border.all(color: emerged ? a.pink1 : a.lineStrong, width: 2),
                    borderRadius: radius,
                    // 0 4px 10px -4px rgba(255, 138, 164, 0.6) (TeethingTracker.tsx:139)
                    boxShadow: emerged ? const [BoxShadow(color: Color(0x99FF8AA4), offset: Offset(0, 4), blurRadius: 10, spreadRadius: -4)] : null,
                  ),
                ),
              ),
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: radius,
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FractionallySizedBox(widthFactor: 1 / 3, heightFactor: 1, child: Container(color: const Color(0x59FFFFFF))),
                  ),
                ),
              ),
              if (emerged)
                Positioned(
                  left: w / 2 - 4,
                  top: upper ? null : -4,
                  bottom: upper ? -4 : null,
                  child: Container(width: 8, height: 8, decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle)),
                ),
              if (emerged)
                PositionedDirectional(
                  end: -4,
                  top: upper ? -8 : null,
                  bottom: upper ? null : -8,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 300),
                    builder: (context, v, child) => Transform.scale(scale: v, child: child),
                    child: Container(
                      width: 16,
                      height: 16,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: a.green2,
                        shape: BoxShape.circle,
                        boxShadow: const [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
                      ),
                      child: const AIcon(AIcons.check, size: 10, color: Color(0xFFFFFFFF)),
                    ),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _TipsTabs extends StatefulWidget {
  const _TipsTabs({required this.view, required this.categoryLabel});
  final TeethingView view;
  final String Function(String category) categoryLabel;
  @override
  State<_TipsTabs> createState() => _TipsTabsState();
}

class _TipsTabsState extends State<_TipsTabs> {
  String _tab = 'tips';

  ({Color bg, Color fg}) _severity(ATokens a, Object? s) => switch (s) {
        'mild' => (bg: a.green1, fg: a.greenInk),
        'moderate' => (bg: a.yellow1, fg: a.warnInk),
        'severe' => (bg: a.pink1, fg: a.pinkInk),
        _ => (bg: a.surfaceSoft, fg: a.inkSoft),
      };

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget trigger(String id, String label) => Expanded(
          child: Semantics(
            selected: _tab == id,
            button: true,
            child: GestureDetector(
              key: ValueKey('teeth-tab-$id'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _tab = id),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: _tab == id ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, height: 1.5, color: _tab == id ? a.accentInk : a.inkSoft)),
              ),
            ),
          ),
        );
    Widget card({required Gradient iconBg, required String emoji, required String title, required Widget tag, required List<Widget> body}) => FadeRise(
          dy: 10,
          child: ACard(
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: iconBg, borderRadius: BorderRadius.circular(13)),
                child: Text(emoji, style: const TextStyle(fontSize: 18)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [Text(title, style: x.aListTitle), tag]),
                  ),
                  ...body,
                ]),
              ),
            ]),
          ),
        );
    final items = _tab == 'tips'
        ? [
            for (final tip in widget.view.tips)
              card(
                iconBg: a.gradPeach,
                emoji: (tip['emoji'] as String?)?.isNotEmpty == true ? tip['emoji'] as String : '💡',
                title: '${tip['title'] ?? ''}',
                tag: ARankTag(text: widget.categoryLabel('${tip['category']}'), background: a.peach1, color: a.accentInk),
                body: [Text('${tip['content'] ?? ''}', style: x.aCtaText)],
              ),
          ]
        : [
            for (final s in widget.view.symptoms)
              () {
                final sev = _severity(a, s['severity']);
                final tips = s['relief_tips'];
                return card(
                  iconBg: a.gradYellow,
                  emoji: (s['emoji'] as String?)?.isNotEmpty == true ? s['emoji'] as String : '⚠️',
                  title: '${s['name'] ?? ''}',
                  tag: ARankTag(
                    text: s['severity'] == 'mild'
                        ? tr('teethingtracker_yungul_2a8010', 'Yüngül')
                        : s['severity'] == 'moderate'
                            ? tr('teethingtracker_severity_orta', 'Orta')
                            : tr('teethingtracker_severity_ciddi', 'Ciddi'),
                    background: sev.bg,
                    color: sev.fg,
                  ),
                  body: [
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('${s['description'] ?? ''}', style: x.aCtaText)),
                    if (tips is List && tips.isNotEmpty)
                      Wrap(spacing: 4, runSpacing: 4, children: [
                        for (final t in tips) ARankTag(text: '$t', background: a.surfaceSoft, color: a.inkSoft),
                      ]),
                  ],
                );
              }(),
          ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
        child: Row(children: [
          trigger('tips', tr('teethingtracker_qulluq_meslehetleri_1be08c', 'Qulluq Məsləhətləri')),
          trigger('symptoms', tr('untranslated_simptomlar_xhm7bx', 'Simptomlar')),
        ]),
      ),
      const SizedBox(height: 16),
      for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(height: 12), items[i]],
    ]);
  }
}

class _ToothDialog extends ConsumerStatefulWidget {
  const _ToothDialog({required this.tooth, required this.initialDate, required this.initialNotes});
  final TRow tooth;
  final String initialDate;
  final String initialNotes;
  @override
  ConsumerState<_ToothDialog> createState() => _ToothDialogState();
}

class _ToothDialogState extends ConsumerState<_ToothDialog> {
  late String _date = widget.initialDate;
  late final TextEditingController _notes = TextEditingController(text: widget.initialNotes);

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    final id = '${widget.tooth['id']}';
    final emerged = ref.read(teethingProvider).isToothEmerged(id);
    final actions = ref.read(teethingActionsProvider);
    await actions.toggleTooth(id, !emerged, _date);
    if (!emerged && _notes.text.isNotEmpty) await actions.updateToothNote(id, _notes.text);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final tooth = widget.tooth;
    final emerged = ref.watch(teethingProvider).isToothEmerged('${tooth['id']}');
    final type = tooth['tooth_type'];
    Widget info(String label, String value) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(label, textAlign: TextAlign.center, style: x.aListSub)),
              Text(value, textAlign: TextAlign.center, style: x.aListTitle),
            ]),
          ),
        );
    Widget label(AIconData icon, String text) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            AIcon(icon, size: 16, color: a.inkSoft),
            const SizedBox(width: 8),
            Flexible(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink, height: 1.43))),
          ]),
        );
    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 384),
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: a.surface,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: a.line),
            boxShadow: const [
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
            ],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(11)),
                child: AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: a.alertInk),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(_toothName(tooth), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: em(-0.02, 18), color: a.ink))),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              info(tr('teethingtracker_tipik_cixma_yasi_1c2740', 'Tipik çıxma yaşı'),
                  '${tooth['typical_emergence_months_min']}-${tooth['typical_emergence_months_max']} ${tr('time_months', 'ay')}'),
              const SizedBox(width: 12),
              info(
                tr('teethingtracker_dis_novu_07a451', 'Diş növü'),
                type == 'incisor'
                    ? tr('teethingtracker_kesici_569ec2', 'Kəsici')
                    : type == 'canine'
                        ? tr('teethingtracker_kopek_disi_a7a461', 'Köpək dişi')
                        : tr('teethingtracker_azi_disi_fcdef9', 'Azı dişi'),
              ),
            ]),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: emerged ? a.green1 : a.yellow1, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                AIcon(emerged ? AIcons.check : AIcons.circleAlert, size: 16, color: emerged ? a.greenInk : a.warnInk),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    emerged ? tr('teethingtracker_bu_dis_cixib_543f0e', 'Bu diş çıxıb') : tr('teethingtracker_bu_dis_hele_cixmayib_df0465', 'Bu diş hələ çıxmayıb'),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: emerged ? a.greenInk : a.warnInk, height: 1.43),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            label(AIcons.calendar, tr('teethingtracker_cixma_tarixi_3c7ae9', 'Çıxma tarixi')),
            DateFieldBox(
              fieldKey: const ValueKey('tooth-date'),
              value: _date,
              max: DateTime.now(),
              height: 48,
              radius: 12,
              background: a.surface,
              borderColor: a.lineStrong,
              textColor: a.ink,
              onChanged: (v) => setState(() => _date = v),
            ),
            const SizedBox(height: 16),
            label(AIcons.info, tr('teethingtracker_qeydler_isteye_bagli_958966', 'Qeydlər (istəyə bağlı)')),
            ShadInput(
              fieldKey: const ValueKey('tooth-notes'),
              controller: _notes,
              maxLines: 2,
              radius: 12,
              background: a.surface,
              borderColor: a.lineStrong,
              textColor: a.ink,
              style: const TextStyle(fontSize: 13),
              placeholder: tr('teethingtracker_her_hansi_qeyd_elave_edin_9c35e2', 'Hər hansı qeyd əlavə edin...'),
            ),
            const SizedBox(height: 16),
            ACtaButton(
              key: const ValueKey('tooth-toggle'),
              height: 46,
              background: emerged ? a.pink2 : a.green2,
              icon: emerged ? AIcons.x : AIcons.check,
              onPressed: () => unawaited(_toggle()),
              label: emerged
                  ? tr('teethingtracker_cixib_isaresini_sil_abec15', 'Çıxıb işarəsini sil')
                  : tr('teethingtracker_cixib_olaraq_isarele_678f2e', 'Çıxıb olaraq işarələ'),
            ),
          ]),
        ),
      ),
    );
  }
}
