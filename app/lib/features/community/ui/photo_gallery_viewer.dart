// Ported from: src/components/PhotoGalleryViewer.tsx (the in-app lightbox used by PostCard, CommentReply and
//              ConversationScreen; the delete action of the baby album is not used here)
//
// Black full-screen viewer: close, "n / N" counter, zoom toggle (tap the photo, 1.5x), horizontal swipe between photos
// (mirrored in RTL), dots, Share / Download buttons. Saving to the gallery needs a native saver
// ([photoSaverProvider]; none is bundled, so it reports the error toast like a failed save).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../profile/profile_interfaces.dart' show shareServiceProvider;
import '../../settings/ui/settings_ui.dart' show toasts;
import 'community_widgets.dart';

/// `saveImageToGallery(url, fileName)` → saved.
typedef PhotoSaver = Future<bool> Function(String url, String fileName);

final photoSaverProvider = Provider<PhotoSaver>((ref) => (url, fileName) async => false);

class GalleryPhoto {
  const GalleryPhoto({required this.id, required this.url});
  final String id;
  final String url;
}

/// Opens the viewer above everything (`createPortal(…, document.body)`, z-310).
Future<void> showPhotoGallery(BuildContext context, {required List<GalleryPhoto> photos, int initialIndex = 0}) {
  if (photos.isEmpty) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(PageRouteBuilder<void>(
    opaque: false,
    barrierColor: null,
    transitionDuration: const Duration(milliseconds: 200),
    reverseTransitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => PhotoGalleryViewer(photos: photos, initialIndex: initialIndex, onClose: () => Navigator.of(ctx).pop()),
    transitionsBuilder: (ctx, animation, _, child) => FadeTransition(opacity: animation, child: child),
  ));
}

class PhotoGalleryViewer extends ConsumerStatefulWidget {
  const PhotoGalleryViewer({super.key, required this.photos, this.initialIndex = 0, required this.onClose});
  final List<GalleryPhoto> photos;
  final int initialIndex;
  final VoidCallback onClose;

  @override
  ConsumerState<PhotoGalleryViewer> createState() => _PhotoGalleryViewerState();
}

class _PhotoGalleryViewerState extends ConsumerState<PhotoGalleryViewer> {
  late int _index = widget.initialIndex.clamp(0, widget.photos.length - 1);
  bool _zoomed = false;
  bool _downloading = false;
  double _drag = 0;

  bool get _hasNext => _index < widget.photos.length - 1;
  bool get _hasPrev => _index > 0;

  void _haptic() => unawaited(HapticFeedback.lightImpact());

  void _go(int delta) {
    if (delta > 0 && !_hasNext || delta < 0 && !_hasPrev) return;
    _haptic();
    setState(() {
      _index += delta;
      _zoomed = false;
    });
  }

  void _dragEnd(bool rtl) {
    const threshold = 50.0;
    final toStart = rtl ? _drag < -threshold : _drag > threshold;
    final toEnd = rtl ? _drag > threshold : _drag < -threshold;
    _drag = 0;
    if (toStart && _hasPrev) {
      _go(-1);
    } else if (toEnd && _hasNext) {
      _go(1);
    }
  }

  Future<void> _download() async {
    if (_downloading) return;
    setState(() => _downloading = true);
    _haptic();
    try {
      final ok = await ref.read(photoSaverProvider)(widget.photos[_index].url, 'anacan-baby-photo-${DateTime.now().millisecondsSinceEpoch}.jpg');
      if (!ok) throw StateError('Download failed');
      if (mounted) toasts(context).show(title: tr('photogalleryviewer_sekil_endirildi_0b4a05', 'Şəkil endirildi! 📸'));
    } catch (_) {
      if (mounted) {
        toasts(context).show(
          title: tr('photogalleryviewer_xeta_3cdbb6', 'Xəta'),
          description: tr('photogalleryviewer_sekil_yuklenerken_xeta_bas_verdi_16a2d0', 'Şəkil yüklənərkən xəta baş verdi'),
          destructive: true,
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _share() async {
    _haptic();
    final shared = await ref.read(shareServiceProvider).share(
          title: tr('photogalleryviewer_korpe_fotosu_770c1a', 'Körpə Fotosu'),
          text: tr('photogalleryviewer_anacan_ile_yaradilmis_korpe_fotosu_cfa1e7', 'Anacan ilə yaradılmış körpə fotosu'),
          url: widget.photos[_index].url,
        );
    if (shared && mounted) toasts(context).show(title: tr('photogalleryviewer_paylasildi_40c74e', 'Paylaşıldı! 🎉'));
  }

  Widget _roundButton({required Widget child, required VoidCallback onTap, required String label}) => CommunityButton(
        label: label,
        onTap: onTap,
        child: Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle), // bg-black/50
          alignment: Alignment.center,
          child: child,
        ),
      );

  @override
  Widget build(BuildContext context) {
    const white = Color(0xFFFFFFFF);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final padding = MediaQuery.paddingOf(context);
    final photo = widget.photos[_index];
    return ColoredBox(
      color: const Color(0xFF000000),
      child: Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            onHorizontalDragUpdate: _zoomed ? null : (d) => _drag += d.delta.dx,
            onHorizontalDragEnd: _zoomed ? null : (_) => _dragEnd(rtl),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GestureDetector(
                  onTap: () {
                    _haptic();
                    setState(() => _zoomed = !_zoomed);
                  },
                  child: AnimatedScale(
                    key: ValueKey(photo.id),
                    scale: _zoomed ? 1.5 : 1,
                    duration: const Duration(milliseconds: 300),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(photo.url, fit: BoxFit.contain, semanticLabel: 'Photo', errorBuilder: (_, _, _) => const SizedBox()),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          top: padding.top + 16,
          left: 16,
          right: 16,
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _roundButton(label: tr('common_bagla', 'Bağla'), onTap: widget.onClose, child: const AIcon(AIcons.x, size: 20, color: white)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(999)),
              child: Text('${_index + 1} / ${widget.photos.length}', style: px(14, weight: FontWeight.w500, color: white, height: 1.4)),
            ),
            _roundButton(
              label: 'Zoom',
              onTap: () {
                _haptic();
                setState(() => _zoomed = !_zoomed);
              },
              child: AIcon(_zoomed ? AIcons.zoomOut : AIcons.zoomIn, size: 20, color: white),
            ),
          ]),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: padding.bottom + 56 + 16 + 56 + 32,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.photos.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 24 : 4,
                height: 4,
                decoration: BoxDecoration(color: i == _index ? white : const Color(0x66FFFFFF), borderRadius: BorderRadius.circular(999)),
              ),
          ]),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(16, 16, 16, (padding.bottom == 0 ? 20 : padding.bottom) + 56),
            decoration: const BoxDecoration(
              gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xCC000000), Color(0x00000000)]),
            ),
            child: Row(children: [
              Expanded(child: _footerButton(icon: AIcons.share2, label: tr('photogalleryviewer_paylas_b4be3b', 'Paylaş'), onTap: _share)),
              const SizedBox(width: 12),
              Expanded(
                child: _footerButton(
                  icon: AIcons.download,
                  busy: _downloading,
                  label: _downloading ? tr('photogalleryviewer_yuklenir_5557de', 'Yüklənir...') : tr('photogalleryviewer_yukle_2b8e67', 'Yüklə'),
                  onTap: _downloading ? null : _download,
                ),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _footerButton({required AIconData icon, required String label, VoidCallback? onTap, bool busy = false}) {
    const white = Color(0xFFFFFFFF);
    return CommunityButton(
      label: label,
      onTap: onTap,
      enabled: onTap != null,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: const Color(0x80000000),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0x33FFFFFF)),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            busy ? const ALoader(size: 20, color: white) : AIcon(icon, size: 20, color: white),
            const SizedBox(width: 8),
            Text(label, style: px(14, weight: FontWeight.w500, color: white, height: 1.2)),
          ]),
        ),
      ),
    );
  }
}

/// [chatPhotoViewerProvider] override: the chat's single photo in this viewer.
Widget communityChatPhotoViewer(BuildContext context, String url, VoidCallback onClose) =>
    PhotoGalleryViewer(photos: [GalleryPhoto(id: url, url: url)], onClose: onClose);
