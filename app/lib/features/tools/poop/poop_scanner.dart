// Ported from: src/components/tools/PoopScanner.tsx
//
// Diaper scanner (`poop-scanner`): photo from the camera or the gallery, daily free limit, `analyze-poop` (the server
// enforces the red-flag colours, supabase/functions/analyze-poop/safety.ts), result card with the doctor urgency and
// an emergency call, the last 10 analyses.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart' show fillEmergencyNumber;
import '../../legal/medical_disclaimer.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px;
import '../health_common/health_db.dart' show HQuery, eqF;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_ports.dart';

/// `PoopAnalysis`.
class PoopAnalysis {
  const PoopAnalysis({
    required this.colorDetected,
    required this.consistency,
    required this.isNormal,
    required this.concernLevel,
    required this.explanation,
    required this.recommendations,
    required this.shouldSeeDoctor,
    required this.doctorUrgency,
  });
  final String colorDetected;
  final String consistency;
  final bool isNormal;

  /// 'normal' | 'attention' | 'warning' | 'urgent'.
  final String concernLevel;
  final String explanation;
  final List<String> recommendations;
  final bool shouldSeeDoctor;

  /// 'none' | 'soon' | 'today' | 'immediate'.
  final String doctorUrgency;

  factory PoopAnalysis.fromJson(Map<String, dynamic> j) => PoopAnalysis(
    colorDetected: '${j['colorDetected'] ?? ''}',
    consistency: '${j['consistency'] ?? ''}',
    isNormal: j['isNormal'] == true,
    concernLevel: '${j['concernLevel'] ?? 'normal'}',
    explanation: '${j['explanation'] ?? ''}',
    recommendations: [for (final r in (j['recommendations'] is List ? j['recommendations'] as List : const [])) '$r'],
    shouldSeeDoctor: j['shouldSeeDoctor'] == true,
    doctorUrgency: '${j['doctorUrgency'] ?? 'none'}',
  );
}

({String label, String emoji}) poopColorLabel(String color) => switch (color) {
  'brown' => (label: tr('poopscanner_qehveyi_b14379', 'Qəhvəyi'), emoji: '🟤'),
  'yellow' => (label: tr('poopscanner_sari_30ba0d', 'Sarı'), emoji: '🟡'),
  'green' => (label: tr('poopscanner_yasil_b257f4', 'Yaşıl'), emoji: '🟢'),
  'black' => (label: tr('poopscanner_qara_3c7a2d', 'Qara'), emoji: '⚫'),
  'red' => (label: tr('poopscanner_qirmizi_ea111d', 'Qırmızı'), emoji: '🔴'),
  'white' => (label: tr('poopscanner_ag_solgun_984851', 'Ağ/Solğun'), emoji: '⚪'),
  _ => (label: tr('poopscanner_namelum_134662', 'Naməlum'), emoji: '❓'),
};

/// `concernStyles[level] || concernStyles.normal`.
({Gradient grad, Color soft, Color solid, Color ink, Color onSolid}) poopConcernStyle(ATokens a, String level) => switch (level) {
  'urgent' => (grad: a.gradPink, soft: a.pink1, solid: a.pink2, ink: a.alertInk, onSolid: const Color(0xFFFFFFFF)),
  'warning' => (grad: a.gradPeach, soft: a.peach1, solid: a.peach2, ink: a.accentInk, onSolid: const Color(0xFFFFFFFF)),
  // #5a3d00 (PoopScanner.tsx literal)
  'attention' => (grad: a.gradYellow, soft: a.yellow1, solid: a.yellow2, ink: a.warnInk, onSolid: const Color(0xFF5A3D00)),
  _ => (grad: a.gradGreen, soft: a.green1, solid: a.green2, ink: a.greenInk, onSolid: const Color(0xFFFFFFFF)),
};

String poopConcernLabel(String level) => switch (level) {
  'urgent' => tr('poopscanner_tecili_ab784b', 'Təcili'),
  'warning' => tr('poopscanner_diqqet_764567', 'Diqqət'),
  'attention' => tr('poopscanner_i_zleyin_54759b', 'İzləyin'),
  _ => tr('common_normal', 'Normal'),
};

class PoopScanner extends ConsumerStatefulWidget {
  const PoopScanner({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PoopScanner> createState() => _PoopScannerState();
}

class _PoopScannerState extends ConsumerState<PoopScanner> {
  PickedImage? _selected;
  bool _isAnalyzing = false;
  PoopAnalysis? _analysis;
  bool _showHistory = false;
  List<Map<String, dynamic>> _history = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_loadHistory());
  }

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _loadHistory() async {
    final userId = ref.read(mediaUserIdProvider);
    if (userId == null) return;
    try {
      final rows = await ref
          .read(mediaDbProvider)
          .select(HQuery('poop_analyses', filters: [eqF('user_id', userId)], order: const [(column: 'created_at', ascending: false)], limit: 10));
      if (mounted) setState(() => _history = rows);
    } catch (_) {}
  }

  /// The hidden `<input type="file">` (`handleImageSelect`): 10 MB limit, then the downscaled JPEG.
  Future<void> _pickFile() async {
    try {
      final file = await ref.read(mediaImagePickerProvider)(MediaImageSource.file);
      if (file == null) return;
      if (file.size > 10 * 1024 * 1024) {
        _toast(
          MediaToastData(
            title: tr('poopscanner_fayl_cox_boyukdur_f5cf61', 'Fayl çox böyükdür'),
            description: tr('poopscanner_maksimum_10mb_sekil_secin_caf529', 'Maksimum 10MB şəkil seçin'),
            destructive: true,
          ),
        );
        return;
      }
      if (mounted) {
        setState(() {
          _selected = file;
          _analysis = null;
        });
      }
    } catch (_) {
      // could not be read — silent, as before
    }
  }

  Future<void> _capture(MediaImageSource source) async {
    try {
      final image = await ref.read(mediaImagePickerProvider)(source);
      // null = cancelled by the user (the web-only file-input fallback is not needed natively).
      if (image != null && mounted) {
        setState(() {
          _selected = image;
          _analysis = null;
        });
      }
    } catch (error) {
      debugPrint('${source == MediaImageSource.camera ? 'Camera capture' : 'Gallery pick'} error: $error');
      final message = (error is MediaPickError ? error.message : '$error').toLowerCase();
      if (isCameraPermissionError(error) || message.contains('permission') || message.contains('denied')) {
        _toast(
          source == MediaImageSource.camera
              ? MediaToastData(
                  title: tr('poopscanner_kamera_icazesi_lazimdir_a300cc', 'Kamera icazəsi lazımdır'),
                  description: tr('poopscanner_tetbiq_parametrlerinden_kamera_icazesini_7a6f09', 'Tətbiq parametrlərindən kamera icazəsini aktivləşdirin'),
                  destructive: true,
                )
              : MediaToastData(
                  title: tr('poopscanner_sekil_icazesi_lazimdir_ce5b8c', 'Şəkil icazəsi lazımdır'),
                  description: tr(
                    'poopscanner_tetbiq_parametrlerinden_foto_kitabxanasi_f9ffae',
                    'Tətbiq parametrlərindən foto kitabxanası icazəsini aktivləşdirin',
                  ),
                  destructive: true,
                ),
        );
      } else if (!message.contains('cancel')) {
        await _pickFile();
      }
    }
  }

  Future<void> _analyzeImage() async {
    final image = _selected;
    if (image == null) return;
    final decision = await ref.read(mediaUsageProvider).checkAndConsume('poop_scanner');
    if (!decision.allowed) {
      if (mounted) unawaited(ref.read(mediaPremiumModalProvider)(context, 'poop_scanner'));
      return;
    }
    if (!mounted) return;
    setState(() => _isAnalyzing = true);
    try {
      final base64Image = image.dataUrl.split(',')[1];
      final res = await ref
          .read(mediaDbProvider)
          .invoke(
            'analyze-poop',
            body: {
              'imageBase64': base64Image,
              'userContext': babyAnalysisContext(ref.read(authProfileProvider)),
              'language': ref.read(mediaLanguageProvider)(),
            },
          );
      if (res.error != null) throw res.error!;
      final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : const <String, dynamic>{};
      if (data['success'] == true) {
        if (data['isValidImage'] == false) {
          final validation = data['validation'];
          final message = validation is Map && validation['message'] is String && (validation['message'] as String).isNotEmpty
              ? validation['message'] as String
              : null;
          _toast(
            MediaToastData(
              title: tr('poopscanner_sekil_uygun_deyil_ec1a66', 'Şəkil uyğun deyil'),
              description: message ?? tr('poopscanner_bu_sekil_korpe_bezi_deyil_duzg_674a4f', 'Bu şəkil körpə bezi deyil. Düzgün şəkil seçin.'),
              destructive: true,
            ),
          );
          if (mounted) setState(() => _selected = null);
          return;
        }
        if (data['analysis'] is Map) {
          final analysis = PoopAnalysis.fromJson(Map<String, dynamic>.from(data['analysis'] as Map));
          if (mounted) setState(() => _analysis = analysis);
          unawaited(_loadHistory());
        }
      } else {
        throw StateError('${data['error'] ?? 'Analysis failed'}');
      }
    } catch (_) {
      _toast(
        MediaToastData(
          title: tr('poopscanner_analiz_xetasi_daba4a', 'Analiz xətası'),
          description: tr('poopscanner_yeniden_cehd_edin_0040c9', 'Yenidən cəhd edin'),
          destructive: true,
        ),
      );
    } finally {
      if (mounted) setState(() => _isAnalyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final emergency = ref.watch(emergencyNumberProvider);
    final analysis = _analysis;
    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('poopscanner_ai_ile_korpe_necisini_analiz_edin_06fb84', 'AI ilə körpə nəcisini analiz edin'),
            title: tr('poopscanner_necis_skaneri_dadd90', 'Nəcis Skaneri'),
            actions: [
              Semantics(
                selected: _showHistory,
                child: ToolIconButton(
                  key: const ValueKey('poop-history'),
                  semanticLabel: tr('a11y_history', 'Tarixçə'),
                  icon: const AIcon(AIcons.history, size: 16),
                  onTap: () => setState(() => _showHistory = !_showHistory),
                ),
              ),
            ],
          ),
          vgap(12, [
            const MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan),
            ACard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: AIcon(AIcons.info, size: 16, color: a.peach2),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tr(
                        'poopscanner_korpenizin_bezinin_seklini_cek_498c04',
                        'Körpənizin bezinin şəklini çəkin və ya yükləyin. AI rəng və konsistensiyaya əsasən analiz edəcək.',
                      ),
                      style: AStyles.ctaText(context),
                    ),
                  ),
                ],
              ),
            ),
            ACard(child: _selected == null ? _pickers(context) : _preview(context, _selected!)),
            if (analysis != null) FadeRise(child: _result(context, analysis, emergency)),
            if (_showHistory && _history.isNotEmpty) _historyCard(context),
          ]),
        ],
      ),
    );
  }

  Widget _pickers(BuildContext context) {
    final a = context.a;
    Widget tile(String key, Gradient grad, AIconData icon, Color ink, String label, MediaImageSource source) => ATap(
      scale: 0.96,
      onTap: () => _capture(source),
      child: Container(
        key: ValueKey(key),
        height: 112,
        decoration: BoxDecoration(
          color: a.surfaceSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: a.lineStrong),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AListIconBox(
              gradient: grad,
              child: AIcon(icon, size: 18, strokeWidth: 2.2, color: ink),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: px(14, weight: FontWeight.w700, color: a.ink),
            ),
          ],
        ),
      ),
    );
    return AGridCols(
      columns: 2,
      gap: 12,
      children: [
        tile('poop-camera', a.gradPeach, AIcons.camera, a.accentInk, tr('untranslated_kamera_qucuxi', 'Kamera'), MediaImageSource.camera),
        tile('poop-gallery', a.gradBlue, AIcons.upload, a.blueInk, tr('untranslated_qalereyadan_w37f0m', 'Qalereyadan'), MediaImageSource.gallery),
      ],
    );
  }

  Widget _preview(BuildContext context, PickedImage image) {
    final a = context.a;
    return vgap(16, [
      AspectRatio(
        aspectRatio: 1,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(
                color: a.surfaceSoft,
                child: Image.memory(image.bytes, fit: BoxFit.cover, gaplessPlayback: true, errorBuilder: (_, _, _) => const SizedBox()),
              ),
              if (_isAnalyzing)
                ColoredBox(
                  color: const Color(0x80000000),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const ALoader(size: 40, color: Color(0xFFFFFFFF)),
                        const SizedBox(height: 8),
                        Text(
                          tr('untranslated_analiz_edilir_hf0m1t', 'Analiz edilir...'),
                          style: px(14, weight: FontWeight.w600, color: const Color(0xFFFFFFFF)),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      Row(
        children: [
          Expanded(
            child: APillButton(
              kind: APillKind.soft,
              label: tr('poopscanner_yeniden_sec_c56bbc', 'Yenidən seç'),
              height: 44,
              expand: true,
              onTap: () => setState(() {
                _selected = null;
                _analysis = null;
              }),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: APillButton(
              buttonKey: const ValueKey('poop-analyze'),
              label: _isAnalyzing ? tr('common_analiz_loading', 'Analiz...') : tr('poopscanner_analiz_et', 'Analiz et'),
              icon: _isAnalyzing ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : null,
              height: 44,
              expand: true,
              opacity: _isAnalyzing ? 0.7 : 1,
              onTap: _isAnalyzing ? null : () => unawaited(_analyzeImage()),
            ),
          ),
        ],
      ),
    ]);
  }

  Widget _result(BuildContext context, PoopAnalysis analysis, String emergency) {
    final a = context.a;
    final style = poopConcernStyle(a, analysis.concernLevel);
    final color = poopColorLabel(analysis.colorDetected);
    final immediate = analysis.doctorUrgency == 'immediate';
    return ACard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 8, decoration: BoxDecoration(gradient: style.grad)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: vgap(16, [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: style.soft, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    Text(color.emoji, style: const TextStyle(fontSize: 36, height: 40 / 36)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(color.label, style: AStyles.heading(context, 19, color: style.ink)),
                              ARankTagBox(
                                analysis.isNormal ? tr('common_normal', 'Normal') : tr('poopscanner_diqqet_764567', 'Diqqət'),
                                background: analysis.isNormal ? a.green1 : a.pink1,
                                color: analysis.isNormal ? a.greenInk : a.pinkInk,
                              ),
                            ],
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Opacity(
                              opacity: 0.8,
                              child: Text('${trInline('PoopScanner.tsx', 'Konsistensiya:')} ${analysis.consistency}', style: px(14, color: style.ink)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(color: style.solid, borderRadius: BorderRadius.circular(999)),
                      child: Text(
                        poopConcernLabel(analysis.concernLevel),
                        style: px(14, weight: FontWeight.w700, color: style.onSolid),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                child: Text(analysis.explanation, style: AStyles.ctaText(context)),
              ),
              vgap(8, [
                Row(
                  children: [
                    AIcon(AIcons.circleCheck, size: 16, color: a.green2),
                    const SizedBox(width: 8),
                    Text(
                      tr('poopscanner_tovsiyeler_17a8f7', 'Tövsiyələr'),
                      style: px(14, weight: FontWeight.w700, color: a.ink),
                    ),
                  ],
                ),
                for (var i = 0; i < analysis.recommendations.length; i++)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
                          child: Text(
                            '${i + 1}',
                            style: px(12, weight: FontWeight.w700, color: a.accentInk, height: 1),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(analysis.recommendations[i], style: AStyles.ctaText(context))),
                      ],
                    ),
                  ),
              ]),
              if (analysis.shouldSeeDoctor)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: immediate ? a.alertBg : null,
                    color: immediate ? null : a.peach1,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AIcon(AIcons.triangleAlert, size: 24, color: immediate ? a.alertInk : a.accentInk),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  immediate
                                      ? tr('poopscanner_teci_li_heki_me_muraci_et_edi__dc0cac', 'TƏCİLİ HƏKİMƏ MÜRACİƏT EDİN!')
                                      : tr('poopscanner_hekime_muraciet_edin_9504e2', 'Həkimə müraciət edin'),
                                  style: px(16, weight: FontWeight.w700, color: immediate ? a.alertInk : a.accentInk),
                                ),
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Opacity(
                                    opacity: 0.85,
                                    child: Text(
                                      immediate
                                          ? tr('poopscanner_bu_simptomlar_ciddi_ola_biler__4229fb', 'Bu simptomlar ciddi ola bilər. Dərhal tibbi yardım alın.')
                                          : analysis.doctorUrgency == 'today'
                                          ? tr('poopscanner_bu_gun_hekimle_meslehetlesin_284d77', 'Bu gün həkimlə məsləhətləşin.')
                                          : tr('poopscanner_yaxin_vaxtda_hekime_muraciet_e_cb6380', 'Yaxın vaxtda həkimə müraciət edin.'),
                                      style: px(14, color: immediate ? a.alertSoft : a.accentInk),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (immediate)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: APillButton(
                            buttonKey: const ValueKey('poop-emergency'),
                            label: fillEmergencyNumber(tr('poopscanner_tecili_yardim_103_176a98', 'Təcili yardım - {emergency}'), emergency),
                            icon: const AIcon(AIcons.phone, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                            height: 44,
                            expand: true,
                            background: a.pink2,
                            onTap: () => ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
                          ),
                        ),
                    ],
                  ),
                ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: AIcon(AIcons.circleAlert, size: 16, color: a.inkSoft),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        // The React literal's line break + indentation collapse to one space in HTML.
                        tr(
                          'poopscanner_bu_analiz_yalniz_melumat_meqse_ea8e7e',
                          'Bu analiz yalnız məlumat məqsədi daşıyır və tibbi diaqnoz deyil. \n                      Narahatlıq yaranarsa həkimə müraciət edin.',
                        ).replaceAll(RegExp(r'\s+'), ' '),
                        style: px(12, color: a.inkSoft),
                      ),
                    ),
                  ],
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _historyCard(BuildContext context) {
    final a = context.a;
    return ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                AIcon(AIcons.history, size: 16, color: a.peach2),
                const SizedBox(width: 8),
                Text(tr('poopscanner_son_analizler_76b144', 'Son analizlər'), style: AStyles.cardTitle(context)),
              ],
            ),
          ),
          vgap(8, [
            for (final item in _history)
              () {
                final info = poopColorLabel('${item['color_detected']}');
                final created = DateTime.tryParse('${item['created_at']}')?.toLocal();
                final normal = item['is_normal'] == true;
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      Text(info.emoji, style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(info.label, style: AStyles.listTitle(context)),
                            if (created != null) Text(localeDateString(created), style: AStyles.listSub(context)),
                          ],
                        ),
                      ),
                      ARankTagBox(
                        normal ? tr('common_normal', 'Normal') : tr('poopscanner_diqqet_764567', 'Diqqət'),
                        background: normal ? a.green1 : a.pink1,
                        color: normal ? a.greenInk : a.pinkInk,
                      ),
                    ],
                  ),
                );
              }(),
          ]),
        ],
      ),
    );
  }
}
