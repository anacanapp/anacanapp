// Ported from: src/components/PhotoGalleryViewer.tsx (the photoshoot's use of it)
//
// Full-screen black viewer: counter, close, zoom toggle, swipe paging with dots, share / download / delete (with a
// confirmation). Slot for the `overlay.photo-gallery` port: [photoGalleryViewerProvider] defaults to this viewer.
// Saving to the photo library needs a gallery plugin (not in pubspec): [photoSaverProvider] defaults to "failed",
// which shows the same error toast as React when saving fails.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../services/native/media_natives.dart' show saveImageToPhotoLibrary;
import '../../../services/native/mobile_host.dart' show isMobileHost;
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../media_common/media_ports.dart';

/// `{ id, url, theme?, createdAt? }`.
class GalleryPhoto {
  const GalleryPhoto({required this.id, required this.url, this.theme, this.createdAt});
  final String id;
  final String url;
  final String? theme;
  final String? createdAt;
}

/// `saveImageToGallery(url, fileName)` → saved.
final photoSaverProvider = Provider<Future<bool> Function(String url, String fileName)>(
  (ref) => isMobileHost ? saveImageToPhotoLibrary : (url, fileName) async => false,
);

typedef PhotoGalleryOpener = Future<void> Function(
  BuildContext context, {
  required List<GalleryPhoto> photos,
  required int initialIndex,
  Future<void> Function(String id)? onDelete,
});

final photoGalleryViewerProvider = Provider<PhotoGalleryOpener>(
  (ref) => (context, {required photos, required initialIndex, onDelete}) {
    return Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: const Color(0x00000000),
        pageBuilder: (_, _, _) => PhotoGalleryViewer(photos: photos, initialIndex: initialIndex, onDelete: onDelete),
        transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
      ),
    );
  },
);

class PhotoGalleryViewer extends ConsumerStatefulWidget {
  const PhotoGalleryViewer({super.key, required this.photos, required this.initialIndex, this.onDelete});
  final List<GalleryPhoto> photos;
  final int initialIndex;
  final Future<void> Function(String id)? onDelete;

  @override
  ConsumerState<PhotoGalleryViewer> createState() => _PhotoGalleryViewerState();
}

class _PhotoGalleryViewerState extends ConsumerState<PhotoGalleryViewer> {
  late List<GalleryPhoto> _photos = List.of(widget.photos);
  late int _index = widget.initialIndex.clamp(0, _photos.isEmpty ? 0 : _photos.length - 1);
  late final PageController _pages = PageController(initialPage: _index);
  bool _zoomed = false;
  bool _downloading = false;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop();

  void _haptic() => unawaited(ref.read(mediaHapticsProvider).light().catchError((Object _) {}));

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _download() async {
    if (_downloading || _photos.isEmpty) return;
    setState(() => _downloading = true);
    _haptic();
    try {
      final ok = await ref.read(photoSaverProvider)(_photos[_index].url, 'anacan-baby-photo-${DateTime.now().millisecondsSinceEpoch}.jpg');
      if (!ok) throw StateError('Download failed');
      _toast(MediaToastData(title: tr('photogalleryviewer_sekil_endirildi_0b4a05', 'Şəkil endirildi! 📸')));
    } catch (_) {
      _toast(
        MediaToastData(
          title: tr('photogalleryviewer_xeta_3cdbb6', 'Xəta'),
          description: tr('photogalleryviewer_sekil_yuklenerken_xeta_bas_verdi_16a2d0', 'Şəkil yüklənərkən xəta baş verdi'),
          destructive: true,
        ),
      );
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _share() async {
    if (_photos.isEmpty) return;
    _haptic();
    final shared = await ref.read(mediaShareProvider)(
      title: tr('photogalleryviewer_korpe_fotosu_770c1a', 'Körpə Fotosu'),
      text: tr('photogalleryviewer_anacan_ile_yaradilmis_korpe_fotosu_cfa1e7', 'Anacan ilə yaradılmış körpə fotosu'),
      url: _photos[_index].url,
    );
    if (shared) _toast(MediaToastData(title: tr('photogalleryviewer_paylasildi_40c74e', 'Paylaşıldı! 🎉')));
  }

  Future<void> _confirmDelete() async {
    final onDelete = widget.onDelete;
    if (onDelete == null || _photos.isEmpty) return;
    final confirmed = await showGeneralDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'confirm',
      barrierColor: const Color(0xCC000000),
      pageBuilder: (ctx, _, _) => Center(
        child: AScope(
          child: Material(
            type: MaterialType.transparency,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 384),
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: ctx.tokens.shadcn.background, borderRadius: BorderRadius.circular(24)),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tr('photogalleryviewer_sekli_silmek_isteyirsiniz_87c14d', 'Şəkli silmək istəyirsiniz?'),
                    style: px(18, weight: FontWeight.w600, color: ctx.tokens.shadcn.foreground),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    tr('photogalleryviewer_bu_emeliyyat_geri_alina_bilmez_cdab6e', 'Bu əməliyyat geri alına bilməz. Şəkil həmişəlik silinəcək.'),
                    style: px(14, color: ctx.tokens.shadcn.mutedForeground),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => Navigator.of(ctx).pop(false),
                          child: Container(
                            height: 48,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: ctx.tokens.shadcn.input),
                            ),
                            child: Text(
                              tr('photogalleryviewer_legv_et_b5e49c', 'Ləğv et'),
                              style: px(14, weight: FontWeight.w500, color: ctx.tokens.shadcn.foreground),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: GestureDetector(
                          key: const ValueKey('gallery-confirm-delete'),
                          onTap: () => Navigator.of(ctx).pop(true),
                          child: Container(
                            height: 48,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(16)), // bg-red-500
                            child: Text(
                              tr('common_sil', 'Sil'),
                              style: px(14, weight: FontWeight.w500, color: const Color(0xFFFFFFFF)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    final photo = _photos[_index];
    try {
      await onDelete(photo.id);
      if (!mounted) return;
      final toast = MediaToastData(
        title: '${tr('untranslated_silindi_u8c6ca', 'Silindi!')} 🗑️',
        description: tr('photogalleryviewer_foto_ugurla_silindi_a3226a', 'Foto uğurla silindi'),
      );
      if (_photos.length == 1) {
        _toast(toast);
        _close();
        return;
      }
      setState(() {
        _photos = _photos.where((p) => p.id != photo.id).toList();
        if (_index >= _photos.length) _index = _photos.length - 1;
      });
      _toast(toast);
    } catch (_) {
      _toast(
        MediaToastData(
          title: tr('photogalleryviewer_xeta_3cdbb6', 'Xəta'),
          description: tr('photogalleryviewer_foto_silinerken_xeta_bas_verdi_6359b2', 'Foto silinərkən xəta baş verdi'),
          destructive: true,
        ),
      );
    }
  }

  Widget _round(AIconData icon, VoidCallback onTap, String label) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle),
        child: AIcon(icon, size: 20, color: const Color(0xFFFFFFFF)),
      ),
    ),
  );

  Widget _action({
    required Widget icon,
    required String label,
    VoidCallback? onTap,
    Color border = const Color(0x33FFFFFF),
    Color color = const Color(0xFFFFFFFF),
    bool square = false,
    Key? key,
  }) => GestureDetector(
    key: key,
    onTap: onTap,
    child: Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: Container(
        height: 56,
        width: square ? 56 : null,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0x80000000),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            icon,
            if (!square) ...[
              const SizedBox(width: 8),
              Text(
                label,
                style: px(14, weight: FontWeight.w500, color: color),
              ),
            ],
          ],
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    if (_photos.isEmpty) return const SizedBox.shrink();
    final pad = MediaQuery.paddingOf(context);
    return AScope(
      child: ColoredBox(
        color: const Color(0xFF000000),
        child: Stack(
          children: [
            Positioned.fill(
              child: PageView.builder(
                controller: _pages,
                physics: _zoomed ? const NeverScrollableScrollPhysics() : null,
                itemCount: _photos.length,
                onPageChanged: (i) => setState(() {
                  _haptic();
                  _index = i;
                  _zoomed = false;
                }),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => setState(() => _zoomed = !_zoomed),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Center(
                      child: AnimatedScale(
                        scale: i == _index && _zoomed ? 1.5 : 1,
                        duration: const Duration(milliseconds: 300),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.network(_photos[i].url, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox()),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: pad.top + 16,
              left: 16,
              right: 16,
              child: Row(
                children: [
                  _round(AIcons.x, _close, tr('common_bagla', 'Bağla')),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      '${_index + 1} / ${_photos.length}',
                      style: px(14, weight: FontWeight.w500, color: const Color(0xFFFFFFFF)),
                    ),
                  ),
                  const Spacer(),
                  _round(_zoomed ? AIcons.zoomOut : AIcons.zoomIn, () => setState(() => _zoomed = !_zoomed), 'zoom'),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: pad.bottom + 56 + 96,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _photos.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      width: i == _index ? 24 : 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: i == _index ? const Color(0xFFFFFFFF) : const Color(0x66FFFFFF),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: (pad.bottom > 0 ? pad.bottom : 20) + 56,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Row(
                    children: [
                      Expanded(
                        child: _action(
                          icon: const AIcon(AIcons.share2, size: 20, color: Color(0xFFFFFFFF)),
                          label: tr('photogalleryviewer_paylas_b4be3b', 'Paylaş'),
                          onTap: () => unawaited(_share()),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _action(
                          icon: _downloading
                              ? const ALoader(size: 20, color: Color(0xFFFFFFFF))
                              : const AIcon(AIcons.download, size: 20, color: Color(0xFFFFFFFF)),
                          label: _downloading ? tr('photogalleryviewer_yuklenir_5557de', 'Yüklənir...') : tr('photogalleryviewer_yukle_2b8e67', 'Yüklə'),
                          onTap: _downloading ? null : () => unawaited(_download()),
                        ),
                      ),
                      if (widget.onDelete != null) ...[
                        const SizedBox(width: 12),
                        _action(
                          key: const ValueKey('gallery-delete'),
                          icon: const AIcon(AIcons.trash2, size: 20, color: Color(0xFFF87171)), // text-red-400
                          label: '',
                          square: true,
                          border: const Color(0x4DEF4444), // border-red-500/30
                          onTap: () => unawaited(_confirmDelete()),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
