// Ported from: src/components/tools/FairyTaleGenerator.tsx
//
// Smart fairy tales (`fairy-tale`): the library (all / favourites, stats), a create dialog with a 5-step wizard or a
// free prompt (child name, 25 story languages, age range, theme, style, hero, moral), the daily free limit checked
// before the server consumes it, and the reader dialog (markdown, favourite, delete).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../legal/content/markdown_content.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_copy.dart';
import '../media_common/media_ports.dart';
import 'fairy_tales_data.dart';

typedef FairyTaleOption = ({String value, String label, String emoji});

List<FairyTaleOption> fairyTaleMoralLessons() => [
  (value: 'sharing', label: tr('fairytalegenerator_bolusmek_df3fa9', 'Bölüşmək'), emoji: '🤝'),
  (value: 'kindness', label: tr('fairytalegenerator_mehribanliq_7e25e6', 'Mehribanlıq'), emoji: '💕'),
  (value: 'bravery', label: tr('fairytalegenerator_cesaret_326b71', 'Cəsarət'), emoji: '🦁'),
  (value: 'honesty', label: tr('fairytalegenerator_durustluk_3d6ddb', 'Dürüstlük'), emoji: '✨'),
  (value: 'brushing_teeth', label: tr('fairytalegenerator_dis_fircalamaq_da9acc', 'Diş fırçalamaq'), emoji: '🦷'),
  (value: 'eating_vegetables', label: tr('fairytalegenerator_terevez_yemek_888a56', 'Tərəvəz yemək'), emoji: '🥦'),
  (value: 'sleeping', label: tr('fairytalegenerator_yatmaq_3c7a2d', 'Yatmaq'), emoji: '😴'),
  (value: 'friendship', label: tr('fairytalegenerator_dostluq_3c7a2d', 'Dostluq'), emoji: '👫'),
  (value: 'patience', label: tr('fairytalegenerator_sebir_831276', 'Səbir'), emoji: '🧘'),
  (value: 'gratitude', label: tr('fairytalegenerator_minnetdarliq_31b225', 'Minnətdarlıq'), emoji: '🙏'),
  (value: 'responsibility', label: tr('fairytalegenerator_mesuliyyet_6e6cbe', 'Məsuliyyət'), emoji: '🎯'),
  (value: 'respect', label: tr('fairytalegenerator_hormet_45e147', 'Hörmət'), emoji: '🙌'),
  (value: 'teamwork', label: tr('fairytalegenerator_birlikde_is_01f136', 'Birlikdə iş'), emoji: '🤜🤛'),
  (value: 'self_confidence', label: tr('fairytalegenerator_ozune_inam_9828d6', 'Özünə inam'), emoji: '💪'),
  (value: 'helping_others', label: tr('fairytalegenerator_basqalarina_komek_d0e8f6', 'Başqalarına kömək'), emoji: '🫶'),
  (value: 'nature_love', label: tr('fairytalegenerator_tebiet_sevgisi_801736', 'Təbiət sevgisi'), emoji: '🌿'),
];

List<({String emoji, String label})> fairyTaleHeroSuggestions() => [
  (emoji: '🧸', label: tr('fairytalegenerator_ayi_balasi_f0fdaa', 'Ayı Balası')),
  (emoji: '🦄', label: mediaFollowupText('fairytale_unicorn')),
  (emoji: '🐰', label: tr('fairytalegenerator_dovsan_a53a5c', 'Dovşan')),
  (emoji: '🦋', label: tr('fairytalegenerator_kepenek_d4da32', 'Kəpənək')),
  (emoji: '🐱', label: tr('fairytalegenerator_pisik_be8848', 'Pişik')),
  (emoji: '🦊', label: tr('fairytalegenerator_tulku_c6f151', 'Tülkü')),
  (emoji: '🐶', label: tr('fairytalegenerator_bala_it_3c7a2d', 'Bala it')),
  (emoji: '🌟', label: tr('fairytalegenerator_ulduz_3c7a2d', 'Ulduz')),
  (emoji: '🐢', label: tr('fairytalegenerator_tisbaga_c66f32', 'Tısbağa')),
  (emoji: '🦉', label: tr('fairytalegenerator_bayqus_d690dd', 'Bayquş')),
  (emoji: '🐝', label: tr('fairytalegenerator_ari_b3e5dd', 'Arı')),
  (emoji: '🦅', label: tr('fairytalegenerator_qartal_3c7a2d', 'Qartal')),
  (emoji: '🐿️', label: tr('fairytalegenerator_sincab_3c7a2d', 'Sincab')),
  (emoji: '🐬', label: tr('fairytalegenerator_delfin_3c7a2d', 'Delfin')),
  (emoji: '🦜', label: tr('fairytalegenerator_tutuqusu_d3f34f', 'Tutuquşu')),
  (emoji: '🐉', label: tr('fairytalegenerator_ejdaha_b4feca', 'Əjdaha')),
];

List<({String value, String label, String emoji, String desc})> fairyTaleAgeRanges() => [
  (value: '0-2', label: tr('fairytalegenerator_0_2_yas_0fca24', '0-2 yaş'), emoji: '👶', desc: tr('fairytalegenerator_cox_sade_fbc365', 'Çox sadə')),
  (value: '3-5', label: tr('fairytalegenerator_3_5_yas_023631', '3-5 yaş'), emoji: '🧒', desc: tr('fairytalegenerator_sade_620f92', 'Sadə')),
  (value: '6-9', label: tr('fairytalegenerator_6_9_yas_345fa4', '6-9 yaş'), emoji: '👧', desc: tr('fairytalegenerator_orta_3c7a2d', 'Orta')),
  (value: '10-12', label: tr('fairytalegenerator_10_12_yas_c393ca', '10-12 yaş'), emoji: '🧑', desc: tr('fairytalegenerator_murekkeb_43a904', 'Mürəkkəb')),
];

List<FairyTaleOption> fairyTaleStoryStyles() => [
  (value: '', label: tr('fairytalegenerator_klassik_3c7a2d', 'Klassik'), emoji: '📖'),
  (value: 'funny', label: tr('fairytalegenerator_gulmeli_8f7f56', 'Gülməli'), emoji: '😂'),
  (value: 'adventure', label: tr('fairytalegenerator_macera_bc3bdc', 'Macəra'), emoji: '🗺️'),
  (value: 'educational', label: tr('fairytalegenerator_oyredici_b51c23', 'Öyrədici'), emoji: '🎓'),
  (value: 'lullaby', label: tr('fairytalegenerator_laylay_3c7a2d', 'Laylay'), emoji: '🌙'),
];

/// `https://flagcdn.com/w40/<flag>.png` (the bundled flag first).
Widget _flag(String flag, double w, double h) => ClipRRect(
  borderRadius: BorderRadius.circular(3),
  child: Image.asset(
    'assets/images/entry/flags/$flag.png',
    width: w,
    height: h,
    fit: BoxFit.cover,
    errorBuilder: (_, _, _) => Image.network(
      'https://flagcdn.com/w40/$flag.png',
      width: w,
      height: h,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => SizedBox(width: w, height: h),
    ),
  ),
);

class FairyTaleGenerator extends ConsumerStatefulWidget {
  const FairyTaleGenerator({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<FairyTaleGenerator> createState() => _FairyTaleGeneratorState();
}

class _FairyTaleGeneratorState extends ConsumerState<FairyTaleGenerator> {
  bool _favoritesTab = false;

  String? _themeEmoji(List<Map<String, dynamic>> themes, Object? theme) {
    final t = themes.where((t) => t['name'] == theme).firstOrNull;
    final e = t?['emoji'];
    return e is String && e.isNotEmpty ? e : null;
  }

  Future<void> _openCreate() async {
    final result = await showToolDialog<Map<String, dynamic>>(context, showClose: true, builder: (_) => const _CreateTaleDialog());
    if (result != null && mounted) await _openReader(result);
  }

  Future<void> _openReader(Map<String, dynamic> tale) =>
      _showReaderDialog(context, _TaleReader(tale: tale, themes: ref.read(fairyTaleThemesQuery).data ?? const [], onDelete: _deleteTale));

  void _deleteTale(String id) {
    unawaited(
      ref
          .read(fairyTaleActionsProvider)
          .delete(id)
          .then((_) {
            if (mounted) {
              ref.read(mediaToastProvider)(context, MediaToastData(title: tr('usefairytales_nagil_silindi_a2f24c', 'Nağıl silindi'), sonner: 'success'));
            }
          })
          .catchError((Object _) {}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final talesQuery = ref.watch(fairyTalesQuery);
    final tales = talesQuery.data ?? const <Map<String, dynamic>>[];
    final themes = ref.watch(fairyTaleThemesQuery).data ?? const <Map<String, dynamic>>[];
    final favorites = tales.where((t) => t['is_favorite'] == true).toList();
    final plays = tales.fold<num>(0, (s, t) => s + ((t['play_count'] as num?) ?? 0));

    Widget stat(Color bg, Color valueInk, Color labelInk, double labelOpacity, String value, String label) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          Text(value, style: AStyles.heading(context, 22, color: valueInk)),
          Opacity(
            opacity: labelOpacity,
            child: Text(
              label,
              style: px(12, weight: FontWeight.w600, color: labelInk),
            ),
          ),
        ],
      ),
    );

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('fairytalegenerator_usaginizin_adi_ile_sehrli_bir_hekaye_7896ac', 'Uşağınızın adı ilə sehrli bir hekayə'),
            title: tr('fairytalegenerator_agilli_nagillar_3f1901', 'Ağıllı Nağıllar'),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: ATap(
              onTap: _openCreate,
              child: Container(
                key: const ValueKey('tale-create-hero'),
                padding: const EdgeInsets.all(24),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(gradient: a.gradLav, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
                child: Stack(
                  children: [
                    for (var i = 0; i < 8; i++)
                      Positioned.fill(
                        child: Align(
                          alignment: Alignment(-1 + 2 * (10 + i * 12) / 100, -1 + 2 * (20 + i % 3 * 25) / 100),
                          child: const Opacity(opacity: 0.2, child: Text('✨')),
                        ),
                      ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: const Color(0x59FFFFFF), borderRadius: BorderRadius.circular(16)), // rgba(255,255,255,0.35)
                          child: AIcon(AIcons.sparkles, size: 40, color: a.lavInk),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  tr('fairytalegenerator_yeni_nagil_yarat_081219', 'Yeni Nağıl Yarat'),
                                  style: AStyles.heading(context, 24, color: a.lavInk),
                                ),
                              ),
                              Opacity(
                                opacity: 0.8,
                                child: Text(
                                  tr('fairytalegenerator_usaginizin_adi_ile_sehrli_bir_hekaye_7896ac', 'Uşağınızın adı ilə sehrli bir hekayə'),
                                  style: px(14, color: a.lavInk),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (tales.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: AGridCols(
                columns: 3,
                gap: 12,
                children: [
                  stat(a.lav1, a.lavInk, a.lavInk, 0.8, '${tales.length}', tr('fairytalegenerator_nagil_1f5665', 'Nağıl')),
                  stat(a.pink1, a.alertInk, a.berryInk, 0.9, '${favorites.length}', tr('fairytalegenerator_sevimli_3c7a2d', 'Sevimli')),
                  stat(a.yellow1, a.warnInk, a.warnInk, 0.8, '$plays', tr('untranslated_oxunub_u7g1tz', 'Oxunub')),
                ],
              ),
            ),
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
            child: Row(
              children: [
                Expanded(
                  child: _tab(
                    context,
                    !_favoritesTab,
                    () => setState(() => _favoritesTab = false),
                    Text('${tr('fairytalegenerator_hamisi_3ff72c', 'Hamısı (')}${tales.length})'),
                  ),
                ),
                Expanded(
                  child: _tab(
                    context,
                    _favoritesTab,
                    () => setState(() => _favoritesTab = true),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AIcon(AIcons.heart, size: 14, color: _favoritesTab ? a.lavInk : a.inkSoft),
                        const SizedBox(width: 4),
                        Text('(${favorites.length})'),
                      ],
                    ),
                    key: const ValueKey('tale-tab-favorites'),
                  ),
                ),
              ],
            ),
          ),
          if (!_favoritesTab) _allList(context, talesQuery.isLoading, tales, themes) else _favoriteList(context, favorites, themes),
        ],
      ),
    );
  }

  Widget _tab(BuildContext context, bool on, VoidCallback onTap, Widget child, {Key? key}) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        key: key,
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: on ? a.lav1 : null, borderRadius: BorderRadius.circular(999)),
          child: DefaultTextStyle.merge(
            style: px(11.5, weight: FontWeight.w700, color: on ? a.lavInk : a.inkSoft),
            child: child,
          ),
        ),
      ),
    );
  }

  Widget _allList(BuildContext context, bool loading, List<Map<String, dynamic>> tales, List<Map<String, dynamic>> themes) {
    final a = context.a;
    if (loading) {
      return ACard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ALoader(size: 32, color: a.lav2),
            ),
            Text(tr('fairytalegenerator_nagillar_yuklenir_44f0f1', 'Nağıllar yüklənir...'), style: AStyles.listSub(context)),
          ],
        ),
      );
    }
    if (tales.isEmpty) {
      return FadeRise(
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text('📚', style: TextStyle(fontSize: 60, height: 1)),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  tr('fairytalegenerator_hele_nagil_yoxdur_f0166c', 'Hələ nağıl yoxdur'),
                  textAlign: TextAlign.center,
                  style: AStyles.listTitle(context),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  tr('fairytalegenerator_ilk_sehrli_nagilinizi_yaradin_efa8d2', 'İlk sehrli nağılınızı yaradın!'),
                  textAlign: TextAlign.center,
                  style: AStyles.listSub(context),
                ),
              ),
              APillButton(
                buttonKey: const ValueKey('tale-create'),
                label: tr('fairytalegenerator_nagil_yarat_11707d', 'Nağıl Yarat'),
                icon: const AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                background: a.lav2,
                onTap: _openCreate,
              ),
            ],
          ),
        ),
      );
    }
    return AListCardBox(
      children: [
        for (var i = 0; i < tales.length; i++)
          AListRowBox(
            key: ValueKey('tale-${tales[i]['id']}'),
            first: i == 0,
            onTap: () => _openReader(tales[i]),
            children: [
              AListIconBox(
                gradient: a.gradLav,
                child: Text(_themeEmoji(themes, tales[i]['theme']) ?? '📖', style: const TextStyle(fontSize: 18)),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text('${tales[i]['title'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listTitle(context)),
                        ),
                        if (tales[i]['is_favorite'] == true) ...[const SizedBox(width: 8), LucideFilled(AIcons.heart, size: 14, color: a.pink2)],
                      ],
                    ),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${tales[i]['child_name'] ?? ''} ${tr('fairytalegenerator_ucun_yazildi_a6b83f', 'üçün yazıldı')} · '),
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: AIcon(AIcons.clock, size: 12, color: a.inkSoft),
                          ),
                          TextSpan(text: ' ${fairyTaleReadingTime('${tales[i]['content'] ?? ''}')} ${tr('fairytalegenerator_deq_780a5c', 'dəq')} · '),
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: AIcon(AIcons.bookOpenCheck, size: 12, color: a.inkSoft),
                          ),
                          TextSpan(text: ' ${(tales[i]['play_count'] as num?) ?? 0}×'),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AStyles.listSub(context),
                    ),
                  ],
                ),
              ),
              Text(_shortDate(tales[i]['created_at']), style: AStyles.listTime(context)),
            ],
          ),
      ],
    );
  }

  String _shortDate(Object? createdAt) {
    final d = DateTime.tryParse('$createdAt')?.toLocal();
    return d == null ? '' : formatDatePattern(d, 'd MMM');
  }

  Widget _favoriteList(BuildContext context, List<Map<String, dynamic>> favorites, List<Map<String, dynamic>> themes) {
    final a = context.a;
    if (favorites.isEmpty) {
      return ACard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AIcon(AIcons.heart, size: 48, color: a.inkFaint),
            ),
            Text(tr('fairytalegenerator_sevimli_nagil_yoxdur_756411', 'Sevimli nağıl yoxdur'), textAlign: TextAlign.center, style: AStyles.listTitle(context)),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                tr('fairytalegenerator_nagillari_oxuyarken_vurun_2acb44', 'Nağılları oxuyarkən ❤️ vurun'),
                textAlign: TextAlign.center,
                style: AStyles.listSub(context),
              ),
            ),
          ],
        ),
      );
    }
    return AListCardBox(
      children: [
        for (var i = 0; i < favorites.length; i++)
          AListRowBox(
            first: i == 0,
            onTap: () => _openReader(favorites[i]),
            children: [
              AListIconBox(
                gradient: a.gradPink,
                child: Text(_themeEmoji(themes, favorites[i]['theme']) ?? '📖', style: const TextStyle(fontSize: 18)),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${favorites[i]['title'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listTitle(context)),
                    Text('${favorites[i]['child_name'] ?? ''} ${tr('fairytalegenerator_ucun_0b2db5', 'üçün')}', style: AStyles.listSub(context)),
                  ],
                ),
              ),
              LucideFilled(AIcons.heart, size: 20, color: a.pink2),
            ],
          ),
      ],
    );
  }
}

/// The create dialog (wizard / free prompt). Pops with the stored tale after a successful generation.
class _CreateTaleDialog extends ConsumerStatefulWidget {
  const _CreateTaleDialog();
  @override
  ConsumerState<_CreateTaleDialog> createState() => _CreateTaleDialogState();
}

class _CreateTaleDialogState extends ConsumerState<_CreateTaleDialog> {
  bool _direct = false;
  int _step = 1;
  final TextEditingController _prompt = TextEditingController();
  final TextEditingController _directName = TextEditingController();
  final TextEditingController _childName = TextEditingController();
  final TextEditingController _hero = TextEditingController();
  late String _directLanguage = normalizeAppLanguage(ref.read(userStoreProvider).language);
  String _directAge = '3-5';
  String _theme = '';
  String _moral = '';
  late String _language = normalizeAppLanguage(ref.read(userStoreProvider).language);
  String _ageRange = '3-5';
  String _style = '';
  bool _pending = false;

  @override
  void dispose() {
    _prompt.dispose();
    _directName.dispose();
    _childName.dispose();
    _hero.dispose();
    super.dispose();
  }

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _generate() async {
    // The server owns consumption; an invalid form must not spend an allowance.
    if (_direct ? _prompt.text.trim().isEmpty : _childName.text.trim().isEmpty || _theme.isEmpty) return;
    final peek = await ref.read(mediaUsageProvider).peekRemainingDaily('fairy_tale');
    if (!mounted) return;
    if (peek.remaining <= 0) {
      unawaited(ref.read(mediaPremiumModalProvider)(context, 'fairy_tale'));
      return;
    }
    final params = _direct
        ? FairyTaleParams(
            childName: _directName.text.isNotEmpty ? _directName.text : exampleChildName(_directLanguage),
            language: _directLanguage,
            ageRange: _directAge,
            customPrompt: _prompt.text,
          )
        : FairyTaleParams(
            childName: _childName.text,
            theme: _theme,
            hero: _hero.text,
            moralLesson: _moral,
            language: _language,
            ageRange: _ageRange,
            storyStyle: _style,
          );
    setState(() => _pending = true);
    try {
      final tale = await ref.read(fairyTaleActionsProvider).generate(params);
      _toast(MediaToastData(title: tr('usefairytales_nagil_yaradildi_45e374', 'Nağıl yaradıldı! ✨'), sonner: 'success'));
      if (mounted) Navigator.of(context).pop(tale);
    } catch (error) {
      // Error handled in the hook's onError.
      _toast(
        MediaToastData(
          title: '${tr('usefairytales_nagil_yaradila_bilmedi', 'Nağıl yaradıla bilmədi:')} ${error is FairyTaleError ? error.message : error}',
          sonner: 'error',
        ),
      );
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  BoxDecoration _pill(BuildContext context, bool on) =>
      BoxDecoration(color: on ? context.a.lav2 : context.a.surfaceSoft, borderRadius: BorderRadius.circular(12));
  Color _pillInk(BuildContext context, bool on) => on ? context.a.lavInk : context.a.inkSoft;

  Widget _fieldLabel(BuildContext context, String text, {AIconData? icon}) => Row(
    children: [
      if (icon != null) ...[AIcon(icon, size: 16, color: context.a.ink), const SizedBox(width: 8)],
      Flexible(
        child: Text(text, style: AStyles.heading(context, 14, color: context.a.ink)),
      ),
    ],
  );

  Widget _sub(BuildContext context, String text, {double bottom = 8}) => Padding(
    padding: EdgeInsets.only(top: 2, bottom: bottom),
    child: Text(text, style: AStyles.listSub(context)),
  );

  Widget _languageGrid(BuildContext context, String selected, ValueChanged<String> onSelect, double height, double fw, double fh) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: AGridCols(
      columns: 4,
      gap: 8,
      children: [
        for (final lang in kAppLanguages)
          Semantics(
            button: true,
            selected: selected == lang.code,
            label: lang.nativeName,
            child: GestureDetector(
              key: ValueKey('tale-lang-${lang.code}'),
              onTap: () => setState(() => onSelect(lang.code)),
              child: Container(
                height: height,
                decoration: _pill(context, selected == lang.code),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _flag(lang.flag, fw, fh),
                    const SizedBox(height: 4),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        lang.nativeName,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        style: px(10.5, weight: FontWeight.w600, color: _pillInk(context, selected == lang.code), height: 1.25),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );

  Widget _cta(BuildContext context, String label, VoidCallback? onTap, {bool loading = false, double height = 44, double disabledOpacity = 0.5, Key? key}) =>
      APillButton(
        buttonKey: key,
        label: label,
        icon: loading ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : null,
        height: height,
        expand: true,
        background: context.a.lav2,
        disabledOpacity: disabledOpacity,
        onTap: onTap,
      );

  Widget _generateButton(BuildContext context, bool enabled, double height, {required double disabledOpacity}) => APillButton(
    buttonKey: const ValueKey('tale-generate'),
    label: _pending ? tr('fairytalegenerator_sehr_hazirlanir_04519a', 'Nağıl hazırlanır...') : tr('fairytalegenerator_nagil_yarat_11707d', 'Nağıl Yarat'),
    icon: _pending ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
    height: height,
    expand: true,
    background: context.a.lav2,
    disabledOpacity: disabledOpacity,
    onTap: enabled && !_pending ? () => unawaited(_generate()) : null,
  );

  Widget _back(BuildContext context, int to) => APillButton(
    kind: APillKind.soft,
    label: tr('common_geri', 'Geri'),
    height: 44,
    padding: const EdgeInsets.symmetric(horizontal: 18),
    onTap: () => setState(() => _step = to),
  );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ToolDialogTitle(tr('fairytalegenerator_yeni_nagil_yarat_081219', 'Yeni Nağıl Yarat'), icon: AIcon(AIcons.wandSparkles, size: 20, color: a.lav2)),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AFlexTabs<bool>(
            tabs: [
              AFlexTab(false, tr('fairytalegenerator_secimle_9ee0cf', 'Seçimlə'), icon: AIcons.listChecks),
              AFlexTab(true, tr('fairytalegenerator_serbest_yaz_4498e0', 'Sərbəst yaz'), icon: AIcons.penLine),
            ],
            selected: _direct,
            onChanged: (v) => setState(() => _direct = v),
          ),
        ),
        if (_direct) _directMode(context) else _wizard(context),
      ],
    );
  }

  Widget _directMode(BuildContext context) {
    final language = ref.read(userStoreProvider).language;
    final ages = fairyTaleAgeRanges();
    return vgap(16, [
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _fieldLabel(context, tr('fairytalegenerator_usagin_adi_80632b', 'Uşağın adı')),
          _sub(context, tr('fairytalegenerator_isteye_bagli_nagilda_istifade_olunacaq_2d77bd', 'İstəyə bağlı - nağılda istifadə olunacaq')),
          AField(
            fieldKey: const ValueKey('tale-direct-name'),
            controller: _directName,
            placeholder: mediaFollowupText('fairytale_name_placeholder', language, {'name': exampleChildName(_directLanguage)}),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _fieldLabel(context, tr('fairytalegenerator_nagil_tesviri_4aad0a', 'Nağıl təsviri *')),
          _sub(context, tr('fairytalegenerator_nagilin_nece_olmasini_istediyinizi_yazin_1a89d4', 'Nağılın necə olmasını istədiyinizi yazın')),
          ATextArea(
            fieldKey: const ValueKey('tale-prompt'),
            controller: _prompt,
            height: 96,
            placeholder: tr(
              'fairytalegenerator_meselen_1_yasina_hazirlasan_balaca_aslan_e692b9',
              'Məsələn: 1 yaşına hazırlaşan balaca aslan haqqında nağıl yaz, meşədə dostları ilə ad günü keçirsin...',
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [_fieldLabel(context, tr('untranslated_dil_g90qr5', 'Dil')), _languageGrid(context, _directLanguage, (c) => _directLanguage = c, 56, 24, 17)],
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _fieldLabel(context, tr('fairytalegenerator_yas_95595b', 'Yaş')),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: AGridCols(
              columns: 4,
              gap: 8,
              children: [
                for (final age in ages)
                  GestureDetector(
                    onTap: () => setState(() => _directAge = age.value),
                    child: Container(
                      height: 56,
                      decoration: _pill(context, _directAge == age.value),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(age.emoji, style: const TextStyle(fontSize: 16, height: 1)),
                          const SizedBox(height: 2),
                          Text(
                            age.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: px(10.5, weight: FontWeight.w600, color: _pillInk(context, _directAge == age.value)),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      _generateButton(context, _prompt.text.trim().isNotEmpty, 46, disabledOpacity: 0.6),
    ]);
  }

  Widget _wizard(BuildContext context) {
    final a = context.a;
    final ages = fairyTaleAgeRanges();
    final morals = fairyTaleMoralLessons();
    final styles = fairyTaleStoryStyles();
    final themes = ref.watch(fairyTaleThemesQuery).data ?? const <Map<String, dynamic>>[];
    final language = ref.read(userStoreProvider).language;
    final continueLabel = tr('untranslated_davam_et_rchhd5', 'Davam et');

    Widget step;
    switch (_step) {
      case 1:
        step = vgap(16, [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_usagin_adi_163b8d', 'Uşağın adı *')),
              _sub(context, tr('fairytalegenerator_nagilda_esas_qehreman_kimi_olacaq_25a4c8', 'Nağılda əsas qəhrəman kimi olacaq')),
              AField(
                fieldKey: const ValueKey('tale-child-name'),
                controller: _childName,
                fontSize: 18,
                placeholder: mediaFollowupText('fairytale_name_placeholder', language, {'name': exampleChildName(_language)}),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_yas_qrupu_54b8f9', 'Yaş qrupu'), icon: AIcons.baby),
              _sub(context, tr('fairytalegenerator_nagilin_cetinlik_seviyyesi_49f08d', 'Nağılın çətinlik səviyyəsi')),
              AGridCols(
                columns: 4,
                gap: 8,
                children: [
                  for (final age in ages)
                    GestureDetector(
                      onTap: () => setState(() => _ageRange = age.value),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: _pill(context, _ageRange == age.value),
                        child: Column(
                          children: [
                            Text(age.emoji, style: const TextStyle(fontSize: 18)),
                            Text(
                              age.label,
                              textAlign: TextAlign.center,
                              style: px(12, weight: FontWeight.w600, color: _pillInk(context, _ageRange == age.value)),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_nagilin_dili_04ad3e', 'Nağılın dili'), icon: AIcons.globe),
              _languageGrid(context, _language, (c) => _language = c, 58, 26, 18),
            ],
          ),
          _cta(context, continueLabel, _childName.text.trim().isEmpty ? null : () => setState(() => _step = 2), key: const ValueKey('tale-next-1')),
        ]);
      case 2:
        step = vgap(16, [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_nagilin_movzusu_f10323', 'Nağılın mövzusu *')),
              _sub(context, tr('fairytalegenerator_hansi_dunyada_macera_olsun_e7e752', 'Hansı dünyada macəra olsun?'), bottom: 12),
              AGridCols(
                columns: 3,
                gap: 12,
                children: [
                  for (final theme in themes)
                    ATap(
                      scale: 0.95,
                      onTap: () => setState(() => _theme = '${theme['name']}'),
                      child: Container(
                        key: ValueKey('tale-theme-${theme['id']}'),
                        padding: const EdgeInsets.all(16),
                        decoration: _theme == theme['name']
                            ? BoxDecoration(gradient: a.gradLav, borderRadius: BorderRadius.circular(12), boxShadow: a.cardShadow)
                            : _pill(context, false),
                        child: Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text('${theme['emoji'] ?? ''}', style: const TextStyle(fontSize: 30)),
                            ),
                            Text(
                              '${theme['name'] ?? ''}',
                              textAlign: TextAlign.center,
                              style: px(12, weight: FontWeight.w600, color: _theme == theme['name'] ? a.lavInk : a.inkSoft),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_nagilin_uslubu_9f0076', 'Nağılın üslubu')),
              _sub(context, tr('fairytalegenerator_hansi_terzde_yazilsin_43fa45', 'Hansı tərzdə yazılsın?')),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [for (final s in styles) _chip(context, '${s.emoji} ${s.label}', _style == s.value, () => setState(() => _style = s.value))],
              ),
            ],
          ),
          Row(
            children: [
              _back(context, 1),
              const SizedBox(width: 8),
              Expanded(child: _cta(context, continueLabel, _theme.isEmpty ? null : () => setState(() => _step = 3), key: const ValueKey('tale-next-2'))),
            ],
          ),
        ]);
      case 3:
        step = vgap(16, [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_komekci_qehreman_077b6f', 'Köməkçi qəhrəman')),
              _sub(context, tr('fairytalegenerator_isteye_bagli_usagin_dostu_f51381', 'İstəyə bağlı - uşağın dostu')),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final h in fairyTaleHeroSuggestions())
                      _chip(context, '${h.emoji} ${h.label}', _hero.text == h.label, () => setState(() => _hero.text = h.label)),
                  ],
                ),
              ),
              AField(controller: _hero, placeholder: mediaFollowupText('fairytale_hero_placeholder', language), onChanged: (_) => setState(() {})),
            ],
          ),
          Row(
            children: [
              _back(context, 2),
              const SizedBox(width: 8),
              Expanded(child: _cta(context, continueLabel, () => setState(() => _step = 4), key: const ValueKey('tale-next-3'))),
            ],
          ),
        ]);
      case 4:
        step = vgap(16, [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _fieldLabel(context, tr('fairytalegenerator_terbiyevi_mesaj_6bdeb6', 'Tərbiyəvi mesaj')),
              _sub(context, tr('fairytalegenerator_nagilin_sonunda_hansi_ders_olsun_4d833e', 'Nağılın sonunda hansı dərs olsun?')),
              AGridCols(
                columns: 2,
                gap: 8,
                children: [
                  for (final m in morals)
                    GestureDetector(
                      onTap: () => setState(() => _moral = m.value),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: _moral == m.value ? a.lav2 : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                        child: Text(
                          '${m.emoji} ${m.label}',
                          style: px(14, weight: FontWeight.w600, color: _pillInk(context, _moral == m.value)),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              _back(context, 3),
              const SizedBox(width: 8),
              Expanded(child: _cta(context, continueLabel, () => setState(() => _step = 5), key: const ValueKey('tale-next-4'))),
            ],
          ),
        ]);
      default:
        final langInfo = kAppLanguages.where((l) => l.code == _language).firstOrNull;
        Widget item(String label, Widget value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: px(14, color: a.inkSoft)),
            DefaultTextStyle.merge(
              style: px(14, weight: FontWeight.w600, color: a.ink),
              child: value,
            ),
          ],
        );
        final themeName = themes.where((t) => t['name'] == _theme).firstOrNull?['name'];
        step = vgap(16, [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(tr('fairytalegenerator_nagil_xulasesi_07d402', '📋 Nağıl xülasəsi'), style: AStyles.heading(context, 14, color: a.ink)),
                ),
                AGridCols(
                  columns: 2,
                  gap: 8,
                  children: [
                    item(tr('fairytalegenerator_usaq_b70dbc', 'Uşaq:'), Text(_childName.text)),
                    item(tr('fairytalegenerator_yas_8ef26c', 'Yaş:'), Text(ages.where((x) => x.value == _ageRange).firstOrNull?.label ?? '')),
                    item(tr('fairytalegenerator_movzu_5a3526', 'Mövzu:'), Text(themeName is String && themeName.isNotEmpty ? themeName : _theme)),
                    item(
                      tr('untranslated_dil_rfnolb', 'Dil:'),
                      Row(
                        children: [
                          if (langInfo != null) ...[_flag(langInfo.flag, 20, 14), const SizedBox(width: 8)],
                          Flexible(child: Text(langInfo?.nativeName ?? '')),
                        ],
                      ),
                    ),
                    if (_hero.text.isNotEmpty) item(tr('fairytalegenerator_qehreman_aea468', 'Qəhrəman:'), Text(_hero.text)),
                    if (_moral.isNotEmpty)
                      item(tr('untranslated_mesaj_x98xat', 'Mesaj:'), Text(morals.where((m) => m.value == _moral).firstOrNull?.label ?? '')),
                    if (_style.isNotEmpty)
                      item(tr('fairytalegenerator_uslub_b96040', 'Üslub:'), Text(styles.where((s) => s.value == _style).firstOrNull?.label ?? '')),
                  ],
                ),
              ],
            ),
          ),
          Row(
            children: [
              _back(context, 4),
              const SizedBox(width: 8),
              Expanded(child: _generateButton(context, true, 44, disabledOpacity: 0.6)),
            ],
          ),
        ]);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          height: 8,
          margin: const EdgeInsets.only(bottom: 4),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: FractionallySizedBox(
              widthFactor: _step / 5,
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: a.gradLav, borderRadius: BorderRadius.circular(999)),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text('${tr('fairytalegenerator_addim_9346cd', 'Addım')} $_step / 5', textAlign: TextAlign.center, style: AStyles.listSub(context)),
        ),
        KeyedSubtree(
          key: ValueKey('tale-step-$_step'),
          child: FadeRise(dx: 20, dy: 0, child: step),
        ),
      ],
    );
  }

  Widget _chip(BuildContext context, String text, bool on, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: on ? context.a.lav2 : context.a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Text(
        text,
        style: px(14, weight: FontWeight.w600, color: _pillInk(context, on)),
      ),
    ),
  );
}

/// The reader dialog: gradient header, markdown story, favourite / delete / close.
class _TaleReader extends ConsumerStatefulWidget {
  const _TaleReader({required this.tale, required this.themes, required this.onDelete});
  final Map<String, dynamic> tale;
  final List<Map<String, dynamic>> themes;
  final ValueChanged<String> onDelete;

  @override
  ConsumerState<_TaleReader> createState() => _TaleReaderState();
}

class _TaleReaderState extends ConsumerState<_TaleReader> {
  late Map<String, dynamic> _tale = widget.tale;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final emoji = widget.themes.where((t) => t['name'] == _tale['theme']).firstOrNull?['emoji'];
    final favorite = _tale['is_favorite'] == true;
    final created = DateTime.tryParse('${_tale['created_at']}')?.toLocal();
    final content = '${_tale['content'] ?? ''}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(gradient: a.gradLav),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.only(bottom: 16, end: 32),
                    child: Row(
                      children: [
                        Text(emoji is String && emoji.isNotEmpty ? emoji : '📖', style: const TextStyle(fontSize: 36, height: 40 / 36)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${_tale['title'] ?? ''}', style: AStyles.heading(context, 18, color: a.lavInk)),
                              Opacity(
                                opacity: 0.8,
                                child: Text('${_tale['child_name'] ?? ''} ${tr('fairytalegenerator_ucun_0b2db5', 'üçün')}', style: px(14, color: a.lavInk)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Opacity(
                    opacity: 0.8,
                    child: Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        AIcon(AIcons.clock, size: 16, color: a.lavInk),
                        const SizedBox(width: 8),
                        Text(
                          '${fairyTaleReadingTime(content)} ${tr('fairytalegenerator_deqiqelik_oxu_1896a5', 'dəqiqəlik oxu')}',
                          style: px(14, color: a.lavInk),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text('•', style: px(14, color: a.lavInk)),
                        ),
                        if (created != null) Text(formatDatePattern(created, 'd MMMM yyyy'), style: px(14, color: a.lavInk)),
                      ],
                    ),
                  ),
                ],
              ),
              PositionedDirectional(
                top: -12,
                end: -12,
                child: Semantics(
                  button: true,
                  label: tr('common_close', 'Bağla'),
                  child: GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(color: Color(0x59FFFFFF), shape: BoxShape.circle),
                      child: AIcon(AIcons.x, size: 20, color: a.lavInk),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DefaultTextStyle.merge(
                style: px(14, color: a.bodyText, height: 1.625),
                child: MarkdownContent(content: content, textColor: a.bodyText),
              ),
              Container(
                margin: const EdgeInsets.only(top: 16),
                padding: const EdgeInsets.only(top: 16, bottom: 8),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: a.line)),
                ),
                child: Row(
                  children: [
                    Semantics(
                      selected: favorite,
                      child: ToolIconButton(
                        key: const ValueKey('tale-favorite'),
                        size: 40,
                        semanticLabel: tr('a11y_favorite', 'Sevimlilərə əlavə et'),
                        icon: favorite ? LucideFilled(AIcons.heart, size: 16, color: a.pink2) : const AIcon(AIcons.heart, size: 16),
                        onTap: () {
                          unawaited(ref.read(fairyTaleActionsProvider).toggleFavorite('${_tale['id']}', !favorite).catchError((Object _) {}));
                          setState(() => _tale = {..._tale, 'is_favorite': !favorite});
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    ToolIconButton(
                      key: const ValueKey('tale-delete'),
                      size: 40,
                      semanticLabel: tr('common_sil', 'Sil'),
                      icon: AIcon(AIcons.trash2, size: 16, color: a.pinkInk),
                      onTap: () {
                        widget.onDelete('${_tale['id']}');
                        Navigator.of(context).pop();
                      },
                    ),
                    const Spacer(),
                    APillButton(
                      kind: APillKind.soft,
                      label: tr('fairytalegenerator_bagla_84bdc9', 'Bağla'),
                      icon: AIcon(AIcons.x, size: 13, strokeWidth: 2.2, color: a.accentInk),
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// `<Dialog><DialogContent className="… p-0 rounded-[26px] max-h-[90vh] overflow-y-auto">` (no padding, no ✕).
Future<void> _showReaderDialog(BuildContext context, Widget child) => showGeneralDialog<void>(
  context: context,
  barrierDismissible: true,
  barrierLabel: 'dialog',
  barrierColor: const Color(0xCC000000),
  transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 200),
  pageBuilder: (ctx, _, _) => SafeArea(
    child: Center(
      child: AScope(
        child: Builder(
          builder: (context) {
            final a = context.a;
            return Material(
              type: MaterialType.transparency,
              child: Container(
                constraints: BoxConstraints(maxWidth: 448, maxHeight: MediaQuery.sizeOf(context).height * 0.9),
                margin: const EdgeInsets.symmetric(horizontal: 16),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: a.line),
                ),
                child: SingleChildScrollView(child: child),
              ),
            );
          },
        ),
      ),
    ),
  ),
  transitionBuilder: (ctx, anim, _, child) => FadeTransition(
    opacity: anim,
    child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(anim), child: child),
  ),
);
