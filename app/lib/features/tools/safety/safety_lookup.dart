// Ported from: src/components/tools/SafetyLookup.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' show getRealCalendarAge;
import '../../legal/medical_disclaimer.dart' show MedicalDisclaimer, MedicalDisclaimerVariant;
import '../../settings/ui/settings_ui.dart' show px;
import '../data/data.dart' show safetyCategoriesQuery, safetyItemsQuery;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ui.dart';

/// `supabase.functions.invoke('safety-ai-lookup', { body })` → `{ data, error }` (tests override it).
final safetyAiLookupProvider = Provider<Future<({Object? data, Object? error})> Function(Map<String, Object?> body)>((ref) {
  SupabaseClient client() => ref.read(supabaseClientProvider);
  return (body) async {
    try {
      final res = await client().functions.invoke('safety-ai-lookup', body: body);
      return (data: res.data, error: null);
    } catch (e) {
      return (data: null, error: e);
    }
  };
});

typedef _Status = ({Gradient grad, Color soft, Color ink, Color deepInk, AIconData icon, String label, String emoji});

class SafetyLookup extends ConsumerStatefulWidget {
  const SafetyLookup({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<SafetyLookup> createState() => _SafetyLookupState();
}

class _SafetyLookupState extends ConsumerState<SafetyLookup> {
  final TextEditingController _search = TextEditingController();
  String _category = 'all';
  bool _aiLoading = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  _Status _status(String? level) {
    final a = context.a;
    return switch (level) {
      'safe' => (grad: a.gradGreen, soft: a.green1, ink: a.greenInk, deepInk: a.greenInk, icon: AIcons.shieldCheck, label: tr('safetylookup_tehlukesiz_1f31cb', 'Təhlükəsiz'), emoji: '✅'),
      'warning' => (grad: a.gradYellow, soft: a.yellow1, ink: a.warnInk, deepInk: a.warnInk, icon: AIcons.shieldAlert, label: tr('safetylookup_ehtiyatli_ba7ebe', 'Ehtiyatlı'), emoji: '⚠️'),
      'danger' => (grad: a.gradPink, soft: a.pink1, ink: a.pinkInk, deepInk: a.alertInk, icon: AIcons.shieldX, label: tr('safetylookup_tehlukeli_056934', 'Təhlükəli'), emoji: '🚫'),
      _ => (
          grad: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.surfaceSoft, a.lineStrong]),
          soft: a.surfaceSoft,
          ink: a.inkSoft,
          deepInk: a.ink,
          icon: AIcons.shield,
          label: tr('safetylookup_namelum_134662', 'Naməlum'),
          emoji: '❓',
        ),
    };
  }

  Future<void> _aiSearch() async {
    final toast = AToastHost.of(context);
    final q = _search.text.trim();
    if (q.length < 2) {
      toast.show(title: tr('safetylookup_en_azi_2_simvol_yazin_f08b6d', 'Ən azı 2 simvol yazın'), destructive: true);
      return;
    }
    final profile = ref.read(authProfileProvider);
    final userContext = <String, Object?>{'lifeStage': profile?.lifeStage};
    if (profile?.lifeStage == 'bump' && (profile?.lastPeriodDate ?? '').isNotEmpty) {
      final lmp = jsParseDate(profile!.lastPeriodDate!);
      if (lmp != null) {
        final diffDays = ((DomainClock.nowMs() - lmp.millisecondsSinceEpoch) / 86400000).floor();
        userContext['pregnancyWeek'] = (diffDays / 7).floor();
      }
    } else if (profile?.lifeStage == 'mommy' && (profile?.babyBirthDate ?? '').isNotEmpty) {
      userContext['babyAgeMonths'] = getRealCalendarAge(profile!.babyBirthDate).months;
      userContext['babyName'] = profile.babyName;
    }
    setState(() => _aiLoading = true);
    try {
      final res = await ref.read(safetyAiLookupProvider)({
        'query': q,
        'category': ?(_category != 'all' ? _category : null),
        'userContext': userContext,
        'language': currentLanguage(),
      });
      if (res.error != null) throw res.error!;
      final data = res.data;
      if (data is Map && data['success'] == true && data['item'] is Map) {
        await ref.read(queryClientProvider).invalidateQueries(queryKey: const ['safety_items']);
        final item = Map<String, dynamic>.from(data['item'] as Map);
        toast.show(
          title: tr('safetylookup_ai_ile_tapildi_5c2d49', 'AI ilə tapıldı! ✨'),
          description: '${item['name']} ${tr('safety_added_to_database', 'bazaya əlavə edildi')}',
        );
        if (mounted) unawaited(_openDetail(item));
      } else {
        toast.show(title: tr('safetylookup_hec_ne_tapilmadi_6a4eca', 'Heç nə tapılmadı'), destructive: true);
      }
    } catch (e) {
      toast.show(title: tr('safetylookup_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: '$e', destructive: true);
    } finally {
      if (mounted) setState(() => _aiLoading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> item) => showGeneralDialog<void>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'dialog',
        barrierColor: const Color(0x80000000),
        transitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (ctx, _, _) => Center(child: AScope(child: _SafetyDetail(item: item, status: _status(item['safety_level'] as String?)))),
        transitionBuilder: (ctx, anim, _, child) => FadeTransition(
          opacity: anim,
          child: ScaleTransition(scale: Tween<double>(begin: 0.9, end: 1).animate(anim), child: child),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final itemsQ = ref.watch(safetyItemsQuery);
    final categoriesQ = ref.watch(safetyCategoriesQuery);
    if (itemsQ.isLoading || categoriesQ.isLoading) return const ToolLoading();
    final items = itemsQ.data ?? const <Map<String, dynamic>>[];
    final hamisi = tr('safetylookup_hamisi_6dc013', 'hamısı');
    final categories = [
      (id: 'all', name: tr('safetylookup_hamisi_c73c4d', 'Hamısı'), emoji: '✨'),
      for (final c in categoriesQ.data ?? const <Map<String, dynamic>>[])
        if (c['category_id'] != 'all' && '${c['name'] ?? ''}'.toLowerCase() != hamisi)
          (id: '${c['category_id']}', name: '${c['name'] ?? ''}', emoji: (c['emoji'] as String?)?.isNotEmpty == true ? c['emoji'] as String : '📦'),
    ];
    final q = _search.text.toLowerCase();
    final filtered = [
      for (final i in items)
        if ('${i['name'] ?? ''}'.toLowerCase().contains(q) && (_category == 'all' || i['category'] == _category)) i,
    ];
    int count(String level) => filtered.where((i) => i['safety_level'] == level).length;

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('safetylookup_ne_yoxlamaq_isteyirsiniz_33ce31', 'Nə yoxlamaq istəyirsiniz?'),
          title: tr('safetylookup_tehlukesizlik_sorgusu_bd80c3', 'Təhlükəsizlik Sorğusu'),
        ),
        PSearchBox(
          fieldKey: const ValueKey('safety-search'),
          controller: _search,
          iconSize: 16,
          placeholder: tr('safetylookup_ne_yoxlamaq_isteyirsiniz_33ce31', 'Nə yoxlamaq istəyirsiniz?'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        const MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            for (final s in [
              (emoji: '✅', count: count('safe'), bg: a.green1, ink: a.greenInk),
              (emoji: '⚠️', count: count('warning'), bg: a.yellow1, ink: a.warnInk),
              (emoji: '🚫', count: count('danger'), bg: a.pink1, ink: a.pinkInk),
            ]) ...[
              if (s.emoji != '✅') const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(s.emoji, style: const TextStyle(fontSize: 12)),
                  const SizedBox(width: 4),
                  Text('${s.count}', style: px(12, weight: FontWeight.w700, color: s.ink)),
                ]),
              ),
            ],
          ]),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: [
            for (var i = 0; i < categories.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              GestureDetector(
                key: ValueKey('safety-cat-${categories[i].id}'),
                onTap: () => setState(() => _category = categories[i].id),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _category == categories[i].id ? a.peach1 : a.surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: _category == categories[i].id ? const Color(0x00000000) : a.line),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(categories[i].emoji, style: const TextStyle(fontSize: 12)),
                    const SizedBox(width: 4),
                    Text(categories[i].name, style: px(12, weight: FontWeight.w700, color: _category == categories[i].id ? a.accentInk : a.inkSoft)),
                  ]),
                ),
              ),
            ],
          ]),
        ),
        for (var i = 0; i < filtered.length; i++) ...[if (i > 0) const SizedBox(height: 6), _itemRow(context, filtered[i])],
        if (filtered.isEmpty && _search.text.trim().length >= 2)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 30),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.search, size: 32, color: a.inkFaint)),
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('safetylookup_bazada_tapilmadi_1e2889', 'Bazada tapılmadı'), style: x.aListTitle)),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text('"${_search.text}${tr('safetylookup_ai_ile_axtaris_edin_780816', '" — AI ilə axtarış edin')}', textAlign: TextAlign.center, style: x.aListSub),
              ),
              Opacity(
                opacity: _aiLoading ? 0.6 : 1,
                child: PCtaButton(
                  key: const ValueKey('safety-ai'),
                  block: false,
                  height: 44,
                  leading: _aiLoading ? null : AIcons.zap,
                  onTap: _aiLoading ? null : () => unawaited(_aiSearch()),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (_aiLoading) ...[
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF))),
                      const SizedBox(width: 6),
                    ],
                    Text(_aiLoading ? tr('safetylookup_axtarilir_f0f94f', 'Axtarılır...') : tr('safetylookup_ai_ile_axtar_01b8df', 'AI ilə axtar')),
                  ]),
                ),
              ),
            ]),
          ),
        if (filtered.isEmpty && _search.text.trim().length < 2)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 30),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.shield, size: 32, color: a.inkFaint)),
              Text(tr('safetylookup_axtaris_etmeye_baslayin_5447ec', 'Axtarış etməyə başlayın'), style: x.aListSub),
            ]),
          ),
      ]),
    );
  }

  Widget _itemRow(BuildContext context, Map<String, dynamic> item) {
    final a = context.a;
    final x = context.aText;
    final cfg = _status(item['safety_level'] as String?);
    return GestureDetector(
      key: ValueKey('safety-item-${item['id']}'),
      onTap: () => unawaited(_openDetail(item)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line), boxShadow: a.cardShadow),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: cfg.grad, borderRadius: BorderRadius.circular(12)),
            child: AIcon(cfg.icon, size: 16, color: cfg.deepInk),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${item['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
              Text('${item['description'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListSub),
            ]),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: cfg.soft, borderRadius: BorderRadius.circular(999)),
            child: Text(cfg.label, style: px(10, weight: FontWeight.w700, color: cfg.ink)),
          ),
        ]),
      ),
    );
  }
}

class _SafetyDetail extends StatelessWidget {
  const _SafetyDetail({required this.item, required this.status});
  final Map<String, dynamic> item;
  final _Status status;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final level = item['safety_level'];
    Widget tip(AIconData icon, Color color, String text) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(icon, size: 12, color: color)),
            const SizedBox(width: 6),
            Expanded(child: Text(text, style: px(12, color: a.inkSoft))),
          ]),
        );
    return Material(
      type: MaterialType.transparency,
      child: Container(
        key: const ValueKey('safety-detail'),
        constraints: BoxConstraints(maxWidth: 384, maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        margin: const EdgeInsets.all(16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(26), boxShadow: a.cardShadow),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(gradient: status.grad, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  // `rgba(255,255,255,0.35)` (SafetyLookup.tsx literal)
                  decoration: BoxDecoration(color: const Color(0x59FFFFFF), borderRadius: BorderRadius.circular(12)),
                  child: AIcon(status.icon, size: 20, color: status.deepInk),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${item['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.aText.heading(px(16, weight: FontWeight.w700, color: status.deepInk))),
                    Opacity(opacity: 0.8, child: Text('${status.emoji} ${status.label}', style: px(12, weight: FontWeight.w600, color: status.deepInk))),
                  ]),
                ),
              ]),
            ),
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: status.soft, borderRadius: BorderRadius.circular(16)),
              child: Text('${item['description'] ?? ''}', style: px(14, color: status.ink, height: 1.625)),
            ),
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  AIcon(AIcons.sparkles, size: 14, color: a.peach2),
                  const SizedBox(width: 6),
                  Text(tr('safetylookup_tovsiyeler_17a8f7', 'Tövsiyələr'), style: px(12, weight: FontWeight.w700, color: a.ink)),
                ]),
                const SizedBox(height: 2),
                if (level == 'safe') ...[
                  tip(AIcons.check, a.green2, tr('safetylookup_hamilelik_dovrunde_istifade_ed_b320b9', 'Hamiləlik dövründə istifadə edə bilərsiniz')),
                  tip(AIcons.check, a.green2, tr('safetylookup_miqdari_normal_saxlayin_f90941', 'Miqdarı normal saxlayın')),
                ],
                if (level == 'warning') ...[
                  tip(AIcons.triangleAlert, a.yellow2, tr('safetylookup_hekiminizle_meslehetlesin_1366f8', 'Həkiminizlə məsləhətləşin')),
                  tip(AIcons.triangleAlert, a.yellow2, tr('safetylookup_miqdari_mehdudlasdirin_9faa97', 'Miqdarı məhdudlaşdırın')),
                ],
                if (level == 'danger') ...[
                  tip(AIcons.x, a.pink2, tr('safetylookup_hamilelik_dovrunde_istifade_et_7bc436', 'Hamiləlik dövründə istifadə etməyin')),
                  tip(AIcons.x, a.pink2, tr('safetylookup_alternativ_axtarin_7735a0', 'Alternativ axtarın')),
                ],
              ]),
            ),
            const Padding(padding: EdgeInsets.only(bottom: 12), child: MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan)),
            PCtaButton(
              key: const ValueKey('safety-detail-close'),
              height: 44,
              onTap: () => Navigator.of(context).pop(),
              child: Text(tr('safetylookup_bagla_84bdc9', 'Bağla')),
            ),
          ]),
        ),
      ),
    );
  }
}
