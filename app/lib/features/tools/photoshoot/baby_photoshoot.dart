// Ported from: src/components/tools/BabyPhotoshoot.tsx
//
// AI baby photoshoot (`photoshoot`): photo + gender → image style + background → eye / hair colour, hair style,
// outfit, then `generate-baby-photo`. Premium-only since 2026-11-09 (free users browse the options; creating opens
// the paywall). The gallery of earlier photos (signed `baby-photos` URLs) is always shown; the step buttons stay
// fixed above the bottom navigation.
import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px;
import '../data/data.dart'
    show
        photoshootBackgroundsQuery,
        photoshootEyeColorsQuery,
        photoshootHairColorsQuery,
        photoshootHairStylesQuery,
        photoshootImageStylesQuery,
        photoshootOutfitsQuery;
import '../health_common/health_db.dart' show HQuery, eqF;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_ports.dart';
import 'photo_gallery_viewer.dart';

/// `gradientToHex`: the Tailwind gradient classes stored in the colour tables.
const Map<String, (Color, Color)> kPhotoshootGradients = {
  'from-gray-300 to-gray-400': (Color(0xFFD1D5DB), Color(0xFF9CA3AF)),
  'from-blue-400 to-blue-600': (Color(0xFF60A5FA), Color(0xFF2563EB)),
  'from-green-400 to-emerald-600': (Color(0xFF4ADE80), Color(0xFF059669)),
  'from-amber-600 to-amber-800': (Color(0xFFD97706), Color(0xFF92400E)),
  'from-amber-400 to-green-600': (Color(0xFFFBBF24), Color(0xFF16A34A)),
  'from-gray-400 to-slate-600': (Color(0xFF9CA3AF), Color(0xFF475569)),
  'from-amber-500 to-orange-600': (Color(0xFFF59E0B), Color(0xFFEA580C)),
  'from-violet-400 to-purple-600': (Color(0xFFA78BFA), Color(0xFF9333EA)),
  'from-yellow-300 to-amber-400': (Color(0xFFFDE047), Color(0xFFFBBF24)),
  'from-amber-700 to-amber-900': (Color(0xFFB45309), Color(0xFF78350F)),
  'from-gray-800 to-black': (Color(0xFF1F2937), Color(0xFF000000)),
  'from-orange-600 to-red-700': (Color(0xFFEA580C), Color(0xFFB91C1C)),
  'from-orange-300 to-pink-400': (Color(0xFFFDBA74), Color(0xFFF472B6)),
  'from-gray-100 to-gray-300': (Color(0xFFF3F4F6), Color(0xFFD1D5DB)),
  'from-red-800 to-amber-900': (Color(0xFF991B1B), Color(0xFF78350F)),
  'from-amber-800 to-red-900': (Color(0xFF92400E), Color(0xFF7F1D1D)),
};

/// `getGradientStyle(hexValue)`: `linear-gradient(to right, a, b)`, grey for unknown classes.
LinearGradient photoshootGradient(String hexValue) {
  final c = kPhotoshootGradients[hexValue] ?? kPhotoshootGradients['from-gray-300 to-gray-400']!;
  return LinearGradient(colors: [c.$1, c.$2]);
}

String? _str(Map<String, dynamic> r, String k) => r[k] is String && (r[k] as String).isNotEmpty ? r[k] as String : null;

/// `c[`field_${language}`] || c.field_az || c.field`.
String photoshootName(Map<String, dynamic> r, String field, String language) => _str(r, '${field}_$language') ?? _str(r, '${field}_az') ?? _str(r, field) ?? '';

typedef PhotoshootBackground = ({String id, String name, String category, bool premium, String emoji, String description});

/// `currentBackgrounds`: grouped by category in first-seen order.
List<PhotoshootBackground> photoshootBackgrounds(List<Map<String, dynamic>> rows, String language) {
  final grouped = <String, List<PhotoshootBackground>>{};
  for (final bg in rows) {
    final cat = photoshootName(bg, 'category_name', language);
    (grouped[cat] ??= []).add((
      id: '${bg['theme_id']}',
      name: photoshootName(bg, 'theme_name', language),
      category: cat,
      premium: false,
      emoji: _str(bg, 'theme_emoji') ?? '🎨',
      description: _str(bg, 'prompt_template') ?? '',
    ));
  }
  return [for (final list in grouped.values) ...list];
}

List<Map<String, dynamic>> _fallbackEyeColors() => [
  {
    'color_id': 'keep',
    'color_name': tr('babyphotoshoot_oldugu_kimi_39efcb', 'Olduğu kimi'),
    'color_name_az': tr('babyphotoshoot_oldugu_kimi_39efcb', 'Olduğu kimi'),
    'hex_value': 'from-gray-300 to-gray-400',
  },
  {'color_id': 'blue', 'color_name': 'Blue', 'color_name_az': 'Mavi', 'hex_value': 'from-blue-400 to-blue-600'},
  {'color_id': 'green', 'color_name': 'Green', 'color_name_az': tr('babyphotoshoot_yasil_b257f4', 'Yaşıl'), 'hex_value': 'from-green-400 to-emerald-600'},
  {'color_id': 'brown', 'color_name': 'Brown', 'color_name_az': tr('babyphotoshoot_qehveyi_b14379', 'Qəhvəyi'), 'hex_value': 'from-amber-600 to-amber-800'},
];

List<Map<String, dynamic>> _fallbackHairColors() => [
  {'color_id': 'keep', 'color_name': 'Keep', 'color_name_az': tr('babyphotoshoot_oldugu_kimi_39efcb', 'Olduğu kimi'), 'hex_value': 'from-gray-300 to-gray-400'},
  {'color_id': 'blonde', 'color_name': 'Blonde', 'color_name_az': tr('babyphotoshoot_sarisin_4a1ef8', 'Sarışın'), 'hex_value': 'from-yellow-300 to-amber-400'},
  {'color_id': 'brown', 'color_name': 'Brown', 'color_name_az': tr('babyphotoshoot_sabalidi_b768cd', 'Şabalıdı'), 'hex_value': 'from-amber-700 to-amber-900'},
  {'color_id': 'black', 'color_name': 'Black', 'color_name_az': 'Qara', 'hex_value': 'from-gray-800 to-black'},
];

List<Map<String, dynamic>> _fallbackHairStyles() => [
  {'style_id': 'keep', 'style_name': 'Keep', 'style_name_az': tr('babyphotoshoot_oldugu_kimi_39efcb', 'Olduğu kimi'), 'emoji': '✨'},
  {'style_id': 'curly', 'style_name': 'Curly', 'style_name_az': 'Buruq', 'emoji': '🌀'},
  {'style_id': 'straight', 'style_name': 'Straight', 'style_name_az': tr('babyphotoshoot_duz_d6038a', 'Düz'), 'emoji': '📏'},
  {'style_id': 'wavy', 'style_name': 'Wavy', 'style_name_az': tr('babyphotoshoot_dalgali_bc8abd', 'Dalğalı'), 'emoji': '🌊'},
];

/// `CustomizationOptions`.
class PhotoshootCustomization {
  const PhotoshootCustomization({
    this.gender = 'boy',
    this.eyeColor = 'keep',
    this.hairColor = 'keep',
    this.hairStyle = 'keep',
    this.outfit = 'keep',
    this.background = '',
    this.imageStyle = 'realistic',
  });
  final String gender;
  final String eyeColor;
  final String hairColor;
  final String hairStyle;
  final String outfit;
  final String background;
  final String imageStyle;

  PhotoshootCustomization copyWith({
    String? gender,
    String? eyeColor,
    String? hairColor,
    String? hairStyle,
    String? outfit,
    String? background,
    String? imageStyle,
  }) => PhotoshootCustomization(
    gender: gender ?? this.gender,
    eyeColor: eyeColor ?? this.eyeColor,
    hairColor: hairColor ?? this.hairColor,
    hairStyle: hairStyle ?? this.hairStyle,
    outfit: outfit ?? this.outfit,
    background: background ?? this.background,
    imageStyle: imageStyle ?? this.imageStyle,
  );
}

/// `canProceed()` of a step.
bool photoshootCanProceed(int step, PhotoshootCustomization c, bool hasSource) => switch (step) {
  0 => hasSource && c.gender.isNotEmpty,
  1 => c.background.isNotEmpty,
  2 => c.background.isNotEmpty && hasSource,
  _ => false,
};

class BabyPhotoshoot extends ConsumerStatefulWidget {
  const BabyPhotoshoot({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BabyPhotoshoot> createState() => _BabyPhotoshootState();
}

class _BabyPhotoshootState extends ConsumerState<BabyPhotoshoot> {
  int _step = 0;
  PhotoshootCustomization _c = const PhotoshootCustomization();
  bool _isGenerating = false;
  List<GalleryPhoto> _photos = [];
  bool _loadingPhotos = true;
  String? _sourceImage;
  PickedImage? _preview;
  OverlayEntry? _bar;

  @override
  void initState() {
    super.initState();
    unawaited(_fetchPhotos());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _bar = OverlayEntry(builder: (_) => _bottomBar());
      Overlay.of(context).insert(_bar!);
    });
  }

  @override
  void dispose() {
    _bar?.remove();
    _bar = null;
    super.dispose();
  }

  void _refreshBar() => WidgetsBinding.instance.addPostFrameCallback((_) => _bar?.markNeedsBuild());

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _fetchPhotos() async {
    final userId = ref.read(mediaAuthUserIdProvider);
    if (userId == null) return;
    try {
      final db = ref.read(mediaDbProvider);
      final rows = await db.select(HQuery('baby_photos', filters: [eqF('user_id', userId)], order: const [(column: 'created_at', ascending: false)]));
      final photos = await Future.wait(
        rows.map(
          (p) async => GalleryPhoto(
            id: '${p['id']}',
            url: await db.signedUrl('baby-photos', '${p['storage_path']}', 60 * 60 * 24) ?? '',
            theme: p['background_theme'] as String?,
            createdAt: p['created_at'] as String?,
          ),
        ),
      );
      if (mounted) setState(() => _photos = photos);
    } catch (_) {
      debugPrint('Error fetching photos');
    } finally {
      if (mounted) setState(() => _loadingPhotos = false);
    }
  }

  Future<void> _pickImage() async {
    try {
      final file = await ref.read(mediaImagePickerProvider)(MediaImageSource.file);
      if (file == null) return;
      if (file.size > 5 * 1024 * 1024) {
        _toast(
          MediaToastData(
            title: tr('babyphotoshoot_fayl_cox_boyukdur_f5cf61', 'Fayl çox böyükdür'),
            description: tr('babyphotoshoot_maksimum_5mb_sekil_yukleye_bilersiniz_6129b3', 'Maksimum 5MB şəkil yükləyə bilərsiniz'),
            destructive: true,
          ),
        );
        return;
      }
      if (!file.mimeType.startsWith('image/')) {
        _toast(
          MediaToastData(
            title: tr('babyphotoshoot_yanlis_fayl_tipi_96b7fc', 'Yanlış fayl tipi'),
            description: tr('babyphotoshoot_yalniz_sekil_fayllari_yukleye_bilersiniz_ed2541', 'Yalnız şəkil faylları yükləyə bilərsiniz'),
            destructive: true,
          ),
        );
        return;
      }
      if (mounted) {
        setState(() {
          _sourceImage = file.dataUrl;
          _preview = file;
        });
        _refreshBar();
      }
    } catch (_) {}
  }

  void _openPremium(String feature) => ref.read(mediaPremiumModalProvider)(context, feature);

  void _selectBackground(String id, bool premiumBg) {
    if (premiumBg && !ref.read(mediaUsageProvider).isPremium) {
      _openPremium(tr('babyphotoshoot_premium_fonlar', 'Premium fonlar'));
      return;
    }
    setState(() => _c = _c.copyWith(background: id));
    _refreshBar();
  }

  void _selectOutfit(String id, bool premiumOutfit) {
    if (premiumOutfit && !ref.read(mediaUsageProvider).isPremium) {
      _openPremium(tr('babyphotoshoot_premium_geyimler_3cf1de', 'Premium geyimlər'));
      return;
    }
    setState(() => _c = _c.copyWith(outfit: id));
  }

  Future<void> _generate() async {
    final usage = ref.read(mediaUsageProvider);
    if (!usage.isPremium) {
      _openPremium(tr('babyphotoshoot_daha_cox_foto_yaratmaq_a5deeb', 'Daha çox foto yaratmaq'));
      return;
    }
    if (_c.background.isEmpty) {
      _toast(
        MediaToastData(
          title: tr('babyphotoshoot_fon_secin_4449cc', 'Fon seçin'),
          description: tr('babyphotoshoot_zehmet_olmasa_bir_fon_secin_270d75', 'Zəhmət olmasa bir fon seçin'),
          destructive: true,
        ),
      );
      return;
    }
    final source = _sourceImage;
    if (source == null) {
      _toast(
        MediaToastData(
          title: tr('babyphotoshoot_sekil_yukleyin_1e520a', 'Şəkil yükləyin'),
          description: tr('babyphotoshoot_zehmet_olmasa_korpenin_seklini_yukleyin_cfd8d4', 'Zəhmət olmasa körpənin şəklini yükləyin'),
          destructive: true,
        ),
      );
      return;
    }
    final allowed = await usage.canUseBabyPhotoshoot();
    if (!mounted) return;
    if (!allowed.allowed) {
      _openPremium(tr('babyphotoshoot_daha_cox_foto_yaratmaq_a5deeb', 'Daha çox foto yaratmaq'));
      return;
    }
    setState(() => _isGenerating = true);
    _refreshBar();
    final haptics = ref.read(mediaHapticsProvider);
    try {
      await haptics.medium();
    } catch (_) {}
    try {
      final res = await ref
          .read(mediaDbProvider)
          .invoke(
            'generate-baby-photo',
            body: {
              'backgroundTheme': _c.background,
              'sourceImageBase64': source,
              'customization': {
                'gender': _c.gender,
                'eyeColor': _c.eyeColor,
                'hairColor': _c.hairColor,
                'hairStyle': _c.hairStyle,
                'outfit': _c.outfit,
                'imageStyle': _c.imageStyle,
              },
            },
          );
      if (res.error != null) throw res.error!;
      final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : null;
      if (data?['error'] != null) throw _GenerationError('${data!['error']}');
      final photo = data?['photo'];
      if (photo is Map) {
        final p = Map<String, dynamic>.from(photo);
        final created = GalleryPhoto(id: '${p['id']}', url: '${p['url'] ?? ''}', theme: p['theme'] as String?, createdAt: p['createdAt'] as String?);
        if (mounted) setState(() => _photos = [created, ..._photos]);
        if (mounted) unawaited(_openGallery(0));
        try {
          await haptics.heavy();
        } catch (_) {}
        _toast(
          MediaToastData(
            title: tr('babyphotoshoot_foto_hazirdir_5183c4', 'Foto hazırdır! 📸'),
            description: tr('babyphotoshoot_yeni_foto_ugurla_yaradildi_849a22', 'Yeni foto uğurla yaradıldı'),
          ),
        );
      }
    } catch (error) {
      debugPrint('Generation error: $error');
      final message = error is _GenerationError ? error.message : '';
      _toast(
        MediaToastData(
          title: tr('babyphotoshoot_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
          description: message.isNotEmpty ? message : tr('babyphotoshoot_foto_yaradila_bilmedi_9792b9', 'Foto yaradıla bilmədi'),
          destructive: true,
        ),
      );
    } finally {
      if (mounted) setState(() => _isGenerating = false);
      _refreshBar();
    }
  }

  Future<void> _deletePhoto(String id) async {
    try {
      await ref.read(mediaDbProvider).delete('baby_photos', [eqF('id', id)]);
      if (mounted) setState(() => _photos = _photos.where((p) => p.id != id).toList());
      _toast(
        MediaToastData(
          title: tr('babyphotoshoot_foto_silindi', 'Foto silindi'),
          description: tr('babyphotoshoot_foto_ugurla_silindi_a3226a', 'Foto uğurla silindi'),
        ),
      );
    } catch (_) {
      _toast(
        MediaToastData(
          title: tr('babyphotoshoot_xeta_3cdbb6', 'Xəta'),
          description: tr('babyphotoshoot_foto_siline_bilmedi_55a923', 'Foto silinə bilmədi'),
          destructive: true,
        ),
      );
    }
  }

  Future<void> _openGallery(int index) => ref.read(photoGalleryViewerProvider)(context, photos: List.of(_photos), initialIndex: index, onDelete: _deletePhoto);

  void _goStep(int step) {
    setState(() => _step = step);
    ref.read(scrollMemoryProvider).scrollToTop();
    _refreshBar();
  }

  // ── fixed bottom bar ──

  Widget _bottomBar() {
    if (!mounted) return const SizedBox.shrink();
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return const SizedBox.shrink();
    return Builder(
      builder: (context) {
        final a = context.a;
        final bottom = MediaQuery.paddingOf(context).bottom;
        final canProceed = photoshootCanProceed(_step, _c, _sourceImage != null);
        final generateDisabled = _isGenerating || _c.background.isEmpty || _sourceImage == null;
        return PositionedDirectional(
          start: 0,
          end: 0,
          bottom: 94 + bottom,
          child: AScope(
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                child: Container(
                  key: const ValueKey('photo-bar'),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    color: a.navBg,
                    border: Border(top: BorderSide(color: a.line)),
                  ),
                  child: Row(
                    children: [
                      if (_step > 0) ...[
                        Expanded(
                          child: APillButton(
                            kind: APillKind.soft,
                            label: tr('common_geri', 'Geri'),
                            height: 52,
                            expand: true,
                            onTap: () => _goStep(_step - 1 < 0 ? 0 : _step - 1),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: _step < 2
                            ? APillButton(
                                buttonKey: const ValueKey('photo-next'),
                                label: tr('untranslated_davam_et_rchhd5', 'Davam et'),
                                height: 52,
                                expand: true,
                                onTap: canProceed ? () => _goStep(_step + 1 > 2 ? 2 : _step + 1) : null,
                              )
                            : APillButton(
                                buttonKey: const ValueKey('photo-generate'),
                                label: _isGenerating
                                    ? tr('babyphotoshoot_yaradilir_9bb5ed', 'Yaradılır...')
                                    : tr('babyphotoshoot_sekil_yarat_6d7c0c', 'Şəkil Yarat'),
                                icon: _isGenerating
                                    ? const ALoader(size: 20, color: Color(0xFFFFFFFF))
                                    : const AIcon(AIcons.sparkles, size: 20, color: Color(0xFFFFFFFF)),
                                height: 52,
                                fontSize: 14,
                                expand: true,
                                disabledOpacity: 0.6,
                                onTap: generateDisabled ? null : () => unawaited(_generate()),
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ── build ──

  @override
  Widget build(BuildContext context) {
    ModalRoute.of(context); // rebuild (and refresh the bar) when the route stops / starts being current
    _refreshBar();
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final isPremium = ref.watch(mediaUsageProvider).isPremium;
    final titles = [tr('babyphotoshoot_sekil_43e2e3', 'Şəkil'), tr('babyphotoshoot_fon_e484a2', 'Fon'), tr('babyphotoshoot_detallar_8614ad', 'Detallar')];

    final Widget content = switch (_step) {
      0 => _stepPhoto(context, isPremium),
      1 => _stepBackground(context, language, isPremium),
      _ => _stepDetails(context, language, isPremium),
    };

    return ToolPage(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 64), // pb-40 instead of pb-24
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ToolHeader(
              onBack: widget.onBack,
              eyebrow: tr('babyphotoshoot_ai_ile_sehrli_fotolar_0fce8f', 'AI ilə sehrli fotolar'),
              title: tr('babyphotoshoot_korpe_fotosessiyasi_546576', 'Körpə Fotosessiyası'),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < titles.length; i++) ...[
                    if (i > 0) const SizedBox(width: 16),
                    GestureDetector(
                      key: ValueKey('photo-step-$i'),
                      onTap: () => _goStep(i),
                      child: Opacity(
                        opacity: _step == i ? 1 : 0.6,
                        child: Column(
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _step == i ? a.peach2 : (_step > i ? a.peach1 : a.surface),
                                border: _step < i ? Border.all(color: a.line) : null,
                              ),
                              child: Text(
                                '${i + 1}',
                                style: px(12, weight: FontWeight.w700, color: _step == i ? const Color(0xFFFFFFFF) : (_step > i ? a.accentInk : a.inkSoft)),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              titles[i],
                              style: px(9, weight: FontWeight.w600, color: a.onBg),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            KeyedSubtree(
              key: ValueKey('photo-content-$_step'),
              child: FadeRise(dx: 20, dy: 0, child: content),
            ),
            _gallery(context),
          ],
        ),
      ),
    );
  }

  Widget _sectionHead(BuildContext context, Widget icon, String title, [String? sub]) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        AListIconBox(size: 34, radius: 11, background: context.a.surfaceSoft, child: icon),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AStyles.listTitle(context)),
              if (sub != null) Text(sub, style: AStyles.listSub(context)),
            ],
          ),
        ),
      ],
    ),
  );

  BoxDecoration _off(BuildContext context) => BoxDecoration(color: context.a.surfaceSoft, borderRadius: BorderRadius.circular(12));
  BoxDecoration _on(BuildContext context) => BoxDecoration(
    color: context.a.peach2,
    borderRadius: BorderRadius.circular(12),
    // 0 8px 18px -8px rgba(255, 157, 99, 0.8) (BabyPhotoshoot.tsx literal)
    boxShadow: [BoxShadow(color: const Color(0xCCFF9D63), offset: const Offset(0, 8), blurRadius: cssBlur(18), spreadRadius: -8)],
  );

  Widget _stepPhoto(BuildContext context, bool isPremium) {
    final a = context.a;
    final preview = _preview;
    return vgap(12, [
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _sectionHead(
              context,
              AIcon(AIcons.upload, size: 15, strokeWidth: 2.2, color: a.peach2),
              tr('babyphotoshoot_korpenin_seklini_yukleyin_b1c595', 'Körpənin Şəklini Yükləyin'),
              tr('babyphotoshoot_uzu_aydin_gorunen_foto_secin_9b42f9', 'Üzü aydın görünən foto seçin'),
            ),
            if (preview != null)
              SizedBox(
                height: 176,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Semantics(
                        image: true,
                        label: tr('babyphotoshoot_yuklenmis_sekil_641af4', 'Yüklənmiş şəkil'),
                        child: Image.memory(
                          preview.bytes,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(color: a.surfaceSoft),
                        ),
                      ),
                    ),
                    PositionedDirectional(
                      top: 12,
                      end: 12,
                      child: ATap(
                        scale: 0.9,
                        semanticLabel: tr('a11y_remove_photo', 'Şəkli sil'),
                        onTap: () {
                          setState(() {
                            _sourceImage = null;
                            _preview = null;
                          });
                          _refreshBar();
                        },
                        child: Container(
                          key: const ValueKey('photo-remove'),
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: a.pink2,
                            shape: BoxShape.circle,
                            boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                          ),
                          child: const AIcon(AIcons.x, size: 20, color: Color(0xFFFFFFFF)),
                        ),
                      ),
                    ),
                  ],
                ),
              )
            else
              ATap(
                onTap: _pickImage,
                child: Container(
                  key: const ValueKey('photo-pick'),
                  height: 176,
                  decoration: BoxDecoration(
                    color: a.surfaceSoft,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: a.peach2, width: 2),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(gradient: a.gradPeach, shape: BoxShape.circle),
                        child: AIcon(AIcons.camera, size: 24, color: a.accentInk),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        tr('babyphotoshoot_sekil_secin_e3e1f3', 'Şəkil seçin'),
                        style: px(16, weight: FontWeight.w700, color: a.ink),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(tr('untranslated_maksimum_5mb_86tog9', 'Maksimum 5MB'), style: px(14, color: a.inkSoft)),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(tr('babyphotoshoot_cinsiyyet_secin_186992', 'Cinsiyyət Seçin'), style: AStyles.listTitle(context)),
            ),
            AGridCols(
              columns: 2,
              gap: 12,
              children: [
                for (final o in [
                  (id: 'boy', name: tr('babyphotoshoot_oglan_e9715e', 'Oğlan'), emoji: '👦', grad: a.gradBlue, ink: a.blueInk),
                  (id: 'girl', name: tr('babyphotoshoot_qiz_79bf6b', 'Qız'), emoji: '👧', grad: a.gradPink, ink: a.alertInk),
                ])
                  ATap(
                    scale: 0.95,
                    onTap: () {
                      setState(() => _c = _c.copyWith(gender: o.id, background: '', outfit: 'keep'));
                      _refreshBar();
                    },
                    child: Transform.scale(
                      scale: _c.gender == o.id ? 1.03 : 1,
                      child: Container(
                        key: ValueKey('photo-gender-${o.id}'),
                        padding: const EdgeInsets.all(12),
                        decoration: _c.gender == o.id
                            ? BoxDecoration(gradient: o.grad, borderRadius: BorderRadius.circular(12), boxShadow: a.cardShadow)
                            : _off(context),
                        child: Column(
                          children: [
                            Text(o.emoji, style: const TextStyle(fontSize: 30)),
                            const SizedBox(height: 6),
                            Text(
                              o.name,
                              style: px(14, weight: FontWeight.w700, color: _c.gender == o.id ? o.ink : a.ink),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
      if (!isPremium)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(16)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: AIcon(AIcons.crown, size: 20, color: a.warnInk),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('premiumgate_default_title', 'Bu bölmə Premium-dadır'),
                      style: px(14, weight: FontWeight.w700, color: a.warnInk),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Opacity(
                        opacity: 0.85,
                        child: Text(tr('pgate_default_desc_v2', 'Premium ilə açılır'), style: px(12, color: a.warnInk)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
    ]);
  }

  Widget _stepBackground(BuildContext context, String language, bool isPremium) {
    final a = context.a;
    final styleRows = ref.watch(photoshootImageStylesQuery).data ?? const <Map<String, dynamic>>[];
    final styles = styleRows.isNotEmpty
        ? [for (final s in styleRows) (id: '${s['style_id']}', name: photoshootName(s, 'style_name', language), emoji: _str(s, 'emoji') ?? '🎨')]
        : [(id: 'realistic', name: 'Realistik', emoji: '📷'), (id: '3d_disney', name: '3D Disney', emoji: '🏰')];
    final backgrounds = photoshootBackgrounds(ref.watch(photoshootBackgroundsQuery(_c.gender)).data ?? const [], language);
    final grouped = <String, List<PhotoshootBackground>>{};
    for (final bg in backgrounds) {
      (grouped[bg.category] ??= []).add(bg);
    }
    String categoryEmoji(String category) {
      if (category == 'Realist') return '📷';
      if (category == 'Estetik') return '✨';
      if (category == 'Fantaziya') return '🎭';
      if (category == tr('babyphotoshoot_movsumi_a19c3b', 'Mövsümi')) return '🌈';
      if (category == 'Bayram') return '🎉';
      if (category == tr('babyphotoshoot_minimalist_ve_tebii_b2ab8e', 'Minimalist və Təbii')) return '🌿';
      if (category == tr('babyphotoshoot_nagilvari_868d22', 'Nağılvari')) return '📖';
      if (category == tr('babyphotoshoot_yaradici_28b2b1', 'Yaradıcı')) return '🎨';
      if (category == tr('babyphotoshoot_klassik_ve_vintage_994561', 'Klassik və Vintage')) return '🕰️';
      return '';
    }

    return vgap(12, [
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _sectionHead(
              context,
              AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: a.lav2),
              tr('babyphotoshoot_sekil_novu_c47221', 'Şəkil Növü'),
              tr('babyphotoshoot_foto_stilini_secin_e2d6a1', 'Foto stilini seçin'),
            ),
            AGridCols(
              columns: 4,
              gap: 8,
              children: [
                for (final s in styles)
                  ATap(
                    scale: 0.95,
                    onTap: () => setState(() => _c = _c.copyWith(imageStyle: s.id)),
                    child: Transform.scale(
                      scale: _c.imageStyle == s.id ? 1.03 : 1,
                      child: Container(
                        key: ValueKey('photo-style-${s.id}'),
                        padding: const EdgeInsets.all(12),
                        decoration: _c.imageStyle == s.id
                            ? BoxDecoration(gradient: a.gradLav, borderRadius: BorderRadius.circular(12), boxShadow: a.cardShadow)
                            : _off(context),
                        child: Column(
                          children: [
                            Text(s.emoji, style: const TextStyle(fontSize: 20)),
                            const SizedBox(height: 6),
                            Text(
                              s.name,
                              textAlign: TextAlign.center,
                              style: px(9, weight: FontWeight.w600, color: _c.imageStyle == s.id ? a.lavInk : a.ink, height: 1.25),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
      for (final entry in grouped.entries)
        ACard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('${categoryEmoji(entry.key)}${entry.key}', style: AStyles.listTitle(context)),
              ),
              AGridCols(
                columns: 4,
                gap: 6,
                children: [
                  for (final bg in entry.value)
                    ATap(
                      scale: 0.95,
                      onTap: () => _selectBackground(bg.id, bg.premium),
                      child: Transform.scale(
                        scale: _c.background == bg.id ? 1.03 : 1,
                        child: Container(
                          key: ValueKey('photo-bg-${bg.id}'),
                          padding: const EdgeInsets.all(8),
                          decoration: _c.background == bg.id
                              ? BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(12), boxShadow: a.cardShadow)
                              : _off(context),
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Column(
                                children: [
                                  Text(bg.emoji, style: const TextStyle(fontSize: 18)),
                                  const SizedBox(height: 2),
                                  Text(
                                    bg.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    textAlign: TextAlign.center,
                                    style: px(8, weight: FontWeight.w600, color: _c.background == bg.id ? a.accentInk : a.ink, height: 1.25),
                                  ),
                                ],
                              ),
                              if (bg.premium && !isPremium)
                                PositionedDirectional(
                                  top: -10,
                                  end: -10,
                                  child: Container(
                                    width: 16,
                                    height: 16,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(color: a.yellow2, shape: BoxShape.circle),
                                    child: const AIcon(AIcons.lock, size: 10, color: Color(0xFF5A3D00)), // #5a3d00 literal
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
    ]);
  }

  Widget _stepDetails(BuildContext context, String language, bool isPremium) {
    final a = context.a;
    final eyeRows = ref.watch(photoshootEyeColorsQuery).data ?? const <Map<String, dynamic>>[];
    final hairRows = ref.watch(photoshootHairColorsQuery).data ?? const <Map<String, dynamic>>[];
    final styleRows = ref.watch(photoshootHairStylesQuery).data ?? const <Map<String, dynamic>>[];
    final outfitRows = ref.watch(photoshootOutfitsQuery(_c.gender)).data ?? const <Map<String, dynamic>>[];
    List<({String id, String name, String hex})> colors(List<Map<String, dynamic>> rows, List<Map<String, dynamic>> fallback) => [
      for (final c in rows.isNotEmpty ? rows : fallback)
        (id: '${c['color_id']}', name: photoshootName(c, 'color_name', language), hex: _str(c, 'hex_value') ?? 'from-gray-300 to-gray-400'),
    ];
    final eyes = colors(eyeRows, _fallbackEyeColors());
    final hairs = colors(hairRows, _fallbackHairColors());
    final hairStyles = [
      for (final s in styleRows.isNotEmpty ? styleRows : _fallbackHairStyles())
        (id: '${s['style_id']}', name: photoshootName(s, 'style_name', language), emoji: _str(s, 'emoji') ?? '✨'),
    ];
    final outfits = [
      for (final o in outfitRows) (id: '${o['outfit_id']}', name: photoshootName(o, 'outfit_name', language), emoji: _str(o, 'emoji') ?? '👕', premium: false),
    ];

    Widget head(AIconData icon, Color color, String title) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          AIcon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Text(title, style: AStyles.listTitle(context)),
        ],
      ),
    );

    Widget swatches(List<({String id, String name, String hex})> list, String selected, ValueChanged<String> onSelect, String prefix) => SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          for (var i = 0; i < list.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            ATap(
              scale: 0.95,
              onTap: () => setState(() => onSelect(list[i].id)),
              child: Padding(
                key: ValueKey('$prefix-${list[i].id}'),
                padding: const EdgeInsets.all(8),
                child: Column(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: photoshootGradient(list[i].hex),
                        boxShadow: selected == list[i].id ? [BoxShadow(color: a.surface, spreadRadius: 2), BoxShadow(color: a.peach2, spreadRadius: 4)] : null,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      list[i].name,
                      style: px(9, weight: FontWeight.w600, color: a.ink),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );

    return vgap(12, [
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            head(AIcons.eye, a.blue2, tr('babyphotoshoot_goz_rengi_8fe8d7', 'Göz Rəngi')),
            swatches(eyes, _c.eyeColor, (id) => _c = _c.copyWith(eyeColor: id), 'photo-eye'),
          ],
        ),
      ),
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            head(AIcons.palette, a.yellow2, tr('babyphotoshoot_sac_rengi_68dd12', 'Saç Rəngi')),
            swatches(hairs, _c.hairColor, (id) => _c = _c.copyWith(hairColor: id), 'photo-hair'),
          ],
        ),
      ),
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            head(AIcons.scissors, a.lav2, tr('babyphotoshoot_sac_formasi_5d3388', 'Saç Forması')),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  for (var i = 0; i < hairStyles.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    ATap(
                      scale: 0.95,
                      onTap: () => setState(() => _c = _c.copyWith(hairStyle: hairStyles[i].id)),
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 52),
                        padding: const EdgeInsets.all(8),
                        decoration: _c.hairStyle == hairStyles[i].id ? _on(context) : _off(context),
                        child: Column(
                          children: [
                            Text(hairStyles[i].emoji, style: const TextStyle(fontSize: 18)),
                            Text(
                              hairStyles[i].name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: px(8, weight: FontWeight.w600, color: _c.hairStyle == hairStyles[i].id ? const Color(0xFFFFFFFF) : a.ink),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            head(AIcons.shirt, a.pink2, tr('untranslated_geyim_hftttf', 'Geyim')),
            AGridCols(
              columns: 5,
              gap: 6,
              children: [
                for (final o in outfits)
                  ATap(
                    scale: 0.95,
                    onTap: () => _selectOutfit(o.id, o.premium),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: _c.outfit == o.id ? _on(context) : _off(context),
                      child: Column(
                        children: [
                          Text(o.emoji, style: const TextStyle(fontSize: 18)),
                          Text(
                            o.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: px(7, weight: FontWeight.w600, color: _c.outfit == o.id ? const Color(0xFFFFFFFF) : a.ink, height: 1.25),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    ]);
  }

  Widget _gallery(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: FadeRise(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ASectionHeadRow(
              title: tr('babyphotoshoot_foto_qalereyasi_0ec00d', 'Foto Qalereyası'),
              trailing: _photos.isNotEmpty
                  ? Text('${_photos.length} ${tr('babyphotoshoot_foto_suffix_3c7a2d', 'foto')}', style: context.aText.aSectionLink)
                  : AIcon(AIcons.image, size: 15, color: a.onBgSoft),
            ),
            if (_loadingPhotos)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(child: ALoader(size: 32, color: a.peach2)),
              )
            else if (_photos.isEmpty)
              ACard(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 26),
                child: Column(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      margin: const EdgeInsets.only(bottom: 12),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(gradient: a.gradPeach, shape: BoxShape.circle),
                      child: AIcon(AIcons.camera, size: 28, color: a.accentInk),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        tr('babyphotoshoot_hele_foto_yoxdur_3ce618', 'Hələ foto yoxdur'),
                        textAlign: TextAlign.center,
                        style: AStyles.listTitle(context),
                      ),
                    ),
                    Text(
                      tr('babyphotoshoot_sekil_yukleyin_ve_foto_yaradin_7b1eb6', 'Şəkil yükləyin və foto yaradın!'),
                      textAlign: TextAlign.center,
                      style: AStyles.listSub(context),
                    ),
                  ],
                ),
              )
            else
              AGridCols(
                columns: 3,
                gap: 12,
                children: [
                  for (var i = 0; i < _photos.length; i++)
                    GestureDetector(
                      key: ValueKey('photo-thumb-${_photos[i].id}'),
                      onTap: () => _openGallery(i),
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: Container(
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: a.cardShadow, color: a.surfaceSoft),
                          child: _photos[i].url.isEmpty ? null : Image.network(_photos[i].url, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
                        ),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _GenerationError implements Exception {
  const _GenerationError(this.message);
  final String message;
}
