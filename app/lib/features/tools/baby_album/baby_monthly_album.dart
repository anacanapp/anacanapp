// Ported from: src/components/baby/BabyMonthlyAlbum.tsx
//
// One photo per month for the first year (3×4 grid), action sheet (view / replace / delete), full-screen viewer,
// upload overlay, and from 12 months the physical album order card. The order screen belongs to the shop feature
// (phase 7) and is plugged in through [babyAlbumOrderSlotProvider].
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/count_format.dart' show getOrdinal;
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/shell.dart' show ShellPlaceholder;
import '../../baby/hooks/use_children.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, FadeRise, shadTitle, showShadDialog;
import '../kit/kit.dart';
import 'album_photo_replace.dart';
import 'baby_album_data.dart';

/// `<AlbumOrderScreen albumType="baby" onBack />`. Default (null): a placeholder until the shop feature lands.
typedef BabyAlbumOrderBuilder = Widget Function(BuildContext context, {required String albumType, required VoidCallback onBack});

final babyAlbumOrderSlotProvider = Provider<BabyAlbumOrderBuilder?>((ref) => null, name: 'babyAlbumOrderSlotProvider');

const List<String> _emojis = ['🌱', '🌿', '🌳', '🌻', '🌺', '🌸', '🍀', '🌈', '⭐', '🎈', '🎉', '🎂'];

List<({int month, String label, String emoji})> _monthLabels(String language) => [
      for (var i = 0; i < 12; i++) (month: i + 1, label: '${getOrdinal(i + 1, language)} ${tr('babymonthlyalbum_month_suffix', 'ay')}', emoji: _emojis[i]),
    ];

class BabyMonthlyAlbum extends ConsumerStatefulWidget {
  const BabyMonthlyAlbum({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<BabyMonthlyAlbum> createState() => _BabyMonthlyAlbumState();
}

class _BabyMonthlyAlbumState extends ConsumerState<BabyMonthlyAlbum> {
  bool _showOrder = false;

  void _toast({String? title, String? description, bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  /// File input + `handleUpload` for [month]; [replacing] uploads the new object before removing the old one.
  Future<void> _pickAndUpload(int month, {AlbumPhoto? replacing}) async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    final file = await ref.read(babyAlbumPickerProvider)();
    if (file == null || !mounted) return;
    final navigator = Navigator.of(context, rootNavigator: true);
    final overlay = _UploadingRoute();
    unawaited(navigator.push(overlay));
    final storage = ref.read(babyAlbumStorageProvider);
    try {
      final path = babyAlbumPath(user.id, month, ref.read(babyAlbumNowProvider)(), file.name);
      if (replacing != null) {
        await replaceStoragePhoto(storage, bucket: babyAlbumBucket, oldPath: '${user.id}/${replacing.name}', newPath: path, file: file);
      } else {
        final error = await storage.bucket(babyAlbumBucket).upload(path, file);
        if (error != null) throw error;
      }
      _toast(title: tr('babymonthlyalbum_sekil_yuklendi_0c2f85', 'Şəkil yükləndi!'));
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['baby-album-photos']));
    } catch (err) {
      debugPrint('Upload error: $err');
      _toast(
        title: tr('babymonthlyalbum_xeta_3cdbb6', 'Xəta'),
        description: replacing != null
            ? tr('firstaid_album_replace_failed', 'Şəkil dəyişdirilmədi. Əvvəlki şəkil saxlanıldı.')
            : tr('babymonthlyalbum_sekil_yuklene_bilmedi_3c275f', 'Şəkil yüklənə bilmədi'),
        destructive: true,
      );
    } finally {
      if (overlay.isActive) navigator.removeRoute(overlay);
    }
  }

  Future<void> _delete(AlbumPhoto photo) async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    try {
      final error = await ref.read(babyAlbumStorageProvider).bucket(babyAlbumBucket).remove(['${user.id}/${photo.name}']);
      if (error != null) throw error;
      _toast(title: tr('babymonthlyalbum_sekil_silindi_efe8e8', 'Şəkil silindi'));
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['baby-album-photos']));
    } catch (_) {
      _toast(
        title: tr('babymonthlyalbum_xeta_3cdbb6', 'Xəta'),
        description: tr('babymonthlyalbum_sekil_siline_bilmedi_e563ea', 'Şəkil silinə bilmədi'),
        destructive: true,
      );
    }
  }

  /// `confirm("Bu şəkli silmək istədiyinizə əminsiniz?")`.
  Future<bool> _confirmDelete() async {
    final ok = await showShadDialog<bool>(
      context,
      builder: (ctx) => ShadDialogFrame(
        radius: 8,
        maxWidth: 384,
        inset: 16,
        children: [
          Text(tr('babymonthlyalbum_bu_sekli_silmek_istediyinize_e_b4ecbc', 'Bu şəkli silmək istədiyinizə əminsiniz?'), style: shadTitle(ctx)),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            ShadButton(variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(ctx).pop(false), child: Text(tr('common_legv_et', 'Ləğv et'))),
            const SizedBox(width: 8),
            ShadButton(
              key: const ValueKey('album-confirm-delete'),
              variant: ShadButtonVariant.destructive,
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr('common_sil', 'Sil')),
            ),
          ]),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _openViewer(AlbumPhoto photo, String label) async {
    final action = await Navigator.of(context, rootNavigator: true).push<String>(PageRouteBuilder<String>(
      opaque: false,
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim, _) => FadeTransition(opacity: anim, child: _Viewer(photo: photo, label: label)),
    ));
    if (!mounted) return;
    if (action == 'replace') await _pickAndUpload(photo.month, replacing: photo);
    if (action == 'delete' && await _confirmDelete()) await _delete(photo);
  }

  Future<void> _openActions(AlbumPhoto photo, String label) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x99000000),
      isScrollControlled: true,
      builder: (ctx) => _ActionSheet(photo: photo, label: label),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'view':
        await _openViewer(photo, label);
      case 'replace':
        await _pickAndUpload(photo.month, replacing: photo);
      case 'delete':
        if (await _confirmDelete()) await _delete(photo);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final labels = _monthLabels(language);
    final selected = ref.watch(childrenProvider).selectedChild;
    final babyMonths = selected == null ? 0 : getChildAge(selected).months;
    final canOrderPhysical = babyMonths >= 12;
    final photos = ref.watch(babyAlbumPhotosQuery).data ?? const <AlbumPhoto>[];
    final a = context.a;
    final x = context.aText;

    if (_showOrder) {
      void back() => setState(() => _showOrder = false);
      final slot = ref.watch(babyAlbumOrderSlotProvider);
      return slot != null ? slot(context, albumType: 'baby', onBack: back) : ShellPlaceholder(kind: 'screen', id: 'album-order', onBack: back, fill: false);
    }

    final name = (selected?.name ?? '').isNotEmpty ? selected!.name : tr('babymonthlyalbum_korpeniz_da99de', 'Körpəniz');

    Widget tile(({int month, String label, String emoji}) m) {
      // Newest upload wins if an old object was left behind by a failed delete.
      AlbumPhoto? photo;
      for (final p in photos) {
        if (p.month == m.month) photo = p;
      }
      return PressScale(
        scale: 0.95,
        onTap: () {
          if (photo != null) {
            unawaited(_openActions(photo, m.label));
          } else {
            unawaited(_pickAndUpload(m.month));
          }
        },
        child: AspectRatio(
          key: ValueKey('album-month-${m.month}'),
          aspectRatio: 1,
          child: photo != null
              ? Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), boxShadow: a.cardShadow),
                  child: Stack(fit: StackFit.expand, children: [
                    Semantics(
                      label: m.label,
                      image: true,
                      child: Image.network(photo.url, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        color: const Color(0x80000000),
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(m.label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF), height: 1.5)),
                      ),
                    ),
                  ]),
                )
              : CustomPaint(
                  foregroundPainter: _DashedBorder(color: a.lineStrong, radius: 16),
                  child: Container(
                    decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16)),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(m.emoji, style: const TextStyle(fontSize: 24, height: 1.33)),
                      const SizedBox(height: 4),
                      Text(m.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
                      const SizedBox(height: 4),
                      AIcon(AIcons.camera, size: 14, color: a.inkFaint),
                    ]),
                  ),
                ),
        ),
      );
    }

    Widget fact(String label, String value) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              Text(label, style: TextStyle(fontSize: 10, color: a.inkSoft, height: 1.5)),
              Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink, height: 1.5)),
            ]),
          ),
        );

    final page = ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('babymonthlyalbum_her_ay_bir_xatire_4ca0e9', 'Hər ay bir xatirə'),
          title: tr('babymonthlyalbum_korpe_albomu_42d4c6', 'Körpə Albomu'),
        ),
        for (var r = 0; r < 4; r++) ...[
          if (r > 0) const SizedBox(height: 12),
          Row(children: [
            for (var c = 0; c < 3; c++) ...[
              if (c > 0) const SizedBox(width: 12),
              Expanded(child: tile(labels[r * 3 + c])),
            ],
          ]),
        ],
        Padding(
          padding: const EdgeInsets.only(top: 20, bottom: 16),
          child: FadeRise(
            dy: 16,
            child: canOrderPhysical
                ? ACard(
                    key: const ValueKey('album-order-card'),
                    variant: ACardVariant.cta,
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(gradient: a.gradCta, border: Border.all(color: a.btnBorder), borderRadius: BorderRadius.circular(13)),
                        child: AIcon(AIcons.sparkles, size: 17, strokeWidth: 2.2, color: a.accentInk),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text('$name ${tr('babymonthlyalbum_artiq_1_yasindadir_c1c0c4', 'artıq 1 yaşındadır! 🎉')}', style: x.heading(x.aCardTitle)),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              tr('babymonthlyalbum_i_lk_ilin_xatirelerini_fiziki__f12a94', 'İlk ilin xatirələrini fiziki albom kimi əlinizdə tutun. Hər ay üçün ayrıca səhifə, premium kağız, ömürlük xatirə.'),
                              style: x.aCtaText,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(children: [
                              fact(tr('babymonthlyalbum_sehife_fd1fa9', 'Səhifə'), '12+'),
                              const SizedBox(width: 8),
                              fact('Format', 'A4'),
                              const SizedBox(width: 8),
                              fact(tr('babymonthlyalbum_catdirilma_e955cf', 'Çatdırılma'), tr('babymonthlyalbum_3_5_gun_5d513c', '3-5 gün')),
                            ]),
                          ),
                          SizedBox(
                            height: 44,
                            child: AButton(
                              key: const ValueKey('album-order'),
                              variant: AButtonVariant.cta,
                              block: true,
                              leading: const AIcon(AIcons.shoppingBag, size: 15, strokeWidth: 2.2),
                              onPressed: () => setState(() => _showOrder = true),
                              child: Text(tr('babymonthlyalbum_fiziki_albom_sifaris_et_26f86e', 'Fiziki Albom Sifariş Et')),
                            ),
                          ),
                        ]),
                      ),
                    ]),
                  )
                : ACard(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      AListIcon(background: a.surfaceSoft, child: AIcon(AIcons.shoppingBag, size: 17, strokeWidth: 2.2, color: a.inkSoft)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(tr('babymonthlyalbum_fiziki_albom_title', 'Fiziki Albom'), style: x.aListTitle)),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text('$name ${tr('babymonthlyalbum_1_yasina_catdiqda_ilk_ilin_but_b845cd', '1 yaşına çatdıqda ilk ilin bütün xatirələrini fiziki albom kimi sifariş edə bilərsiniz.')}',
                                style: x.aListSub),
                          ),
                          Row(children: [
                            Expanded(
                              child: Container(
                                height: 6,
                                clipBehavior: Clip.antiAlias,
                                alignment: AlignmentDirectional.centerStart,
                                decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
                                child: FractionallySizedBox(
                                  widthFactor: (babyMonths / 12).clamp(0, 1).toDouble(),
                                  child: Container(decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(999))),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text('$babyMonths/12 ${tr('common_ay', 'ay')}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
                          ]),
                        ]),
                      ),
                    ]),
                  ),
          ),
        ),
      ]),
    );

    return page;
  }
}

/// `{uploading && <div className="fixed inset-0 z-50 bg-black/50">…}` as a non-dismissible route over the app.
class _UploadingRoute extends RawDialogRoute<void> {
  _UploadingRoute()
      : super(
          barrierDismissible: false,
          barrierColor: const Color(0x80000000),
          transitionDuration: Duration.zero,
          pageBuilder: (context, _, _) => PopScope(
            canPop: false,
            child: AScope(
              child: Center(
                child: Container(
                  key: const ValueKey('album-uploading'),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: context.a.surface, borderRadius: BorderRadius.circular(26)),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: _Spinner(color: context.a.peach2)),
                    Text(tr('babymonthlyalbum_yuklenir_5557de', 'Yüklənir...'), style: context.aText.aListTitle),
                  ]),
                ),
              ),
            ),
          ),
        );
}

class _Spinner extends StatefulWidget {
  const _Spinner({required this.color});
  final Color color;
  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: AIcon(AIcons.loaderCircle, size: 32, color: widget.color));
}

/// `border: 2px dashed var(--a-line-strong)` on a 16px rounded box.
class _DashedBorder extends CustomPainter {
  _DashedBorder({required this.color, required this.radius});
  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final path = Path()..addRRect(RRect.fromRectAndRadius((Offset.zero & size).deflate(1), Radius.circular(radius - 1)));
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 6), paint);
        d += 12;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius;
}

/// The bottom action sheet: view / replace / delete / cancel. Pops the action.
class _ActionSheet extends StatelessWidget {
  const _ActionSheet({required this.photo, required this.label});
  final AlbumPhoto photo;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget action(String id, AIconData icon, String text, Color bg, Color ink) => Expanded(
          child: GestureDetector(
            key: ValueKey('album-action-$id'),
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).pop(id),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                AIcon(icon, size: 20, color: ink),
                const SizedBox(height: 6),
                Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: ink, height: 1.33)),
              ]),
            ),
          ),
        );
    return AScope(
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 448, maxHeight: MediaQuery.sizeOf(context).height * 0.9),
          child: Container(
            decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
                  child: Row(children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(photo.url, width: 64, height: 64, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(width: 64, height: 64)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(label, style: x.aListTitle)),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    action('view', AIcons.camera, tr('babymonthlyalbum_bax', 'Bax'), a.peach1, a.accentInk),
                    const SizedBox(width: 8),
                    action('replace', AIcons.refreshCw, tr('babymonthlyalbum_deyisdir_aca175', 'Dəyişdir'), a.blue1, a.blueInk),
                    const SizedBox(width: 8),
                    action('delete', AIcons.trash2, tr('babymonthlyalbum_sil', 'Sil'), a.pink1, a.pinkInk),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SizedBox(
                    height: 44,
                    child: AButton(
                      variant: AButtonVariant.pillSoft,
                      block: true,
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(tr('babymonthlyalbum_legv_et', 'Ləğv et')),
                    ),
                  ),
                ),
                SizedBox(height: MediaQuery.paddingOf(context).bottom),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-screen black photo viewer: close, month label, replace / delete. Pops the action.
class _Viewer extends StatelessWidget {
  const _Viewer({required this.photo, required this.label});
  final AlbumPhoto photo;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget round(Widget icon, VoidCallback onTap, {Key? key}) => GestureDetector(
          key: key,
          onTap: onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: Color(0x26FFFFFF), shape: BoxShape.circle),
            child: icon,
          ),
        );
    return ColoredBox(
      color: const Color(0xFF000000),
      child: SafeArea(
        bottom: false,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              round(const AIcon(AIcons.x, size: 24, color: Color(0xFFFFFFFF)), () => Navigator.of(context).pop()),
              Expanded(child: Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFFFFFFFF)))),
              round(const AIcon(AIcons.refreshCw, size: 20, color: Color(0xFFFFFFFF)), () => Navigator.of(context).pop('replace')),
              const SizedBox(width: 8),
              round(AIcon(AIcons.trash2, size: 20, color: a.pink2), () => Navigator.of(context).pop('delete'), key: const ValueKey('album-viewer-delete')),
            ]),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(photo.url, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
