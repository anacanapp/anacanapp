// Ported from: src/components/tools/PregnancyAlbum.tsx
import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/count_format.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../baby_album/album_photo_replace.dart' show replaceRecordPhoto;
import '../baby_album/image_compress.dart' show UploadFile;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'pregnancy_album_data.dart';

/// Month tiles (label key, weeks, emoji).
List<({int month, String weeks, String label, String emoji})> pregnancyAlbumMonths() => [
      (month: 1, weeks: '1-4', label: tr('pregnancyalbum_label_1', '1-ci ay'), emoji: '🌱'),
      (month: 2, weeks: '5-8', label: tr('pregnancyalbum_label_2', '2-ci ay'), emoji: '🌿'),
      (month: 3, weeks: '9-13', label: tr('pregnancyalbum_3_cu_ay_cd62b6', '3-cü ay'), emoji: '🌳'),
      (month: 4, weeks: '14-17', label: tr('pregnancyalbum_4_cu_ay_e2b0d2', '4-cü ay'), emoji: '🍋'),
      (month: 5, weeks: '18-21', label: tr('pregnancyalbum_label_5', '5-ci ay'), emoji: '🥭'),
      (month: 6, weeks: '22-26', label: tr('pregnancyalbum_6_ci_ay_c17c71', '6-cı ay'), emoji: '🥥'),
      (month: 7, weeks: '27-30', label: tr('pregnancyalbum_label_7', '7-ci ay'), emoji: '🍉'),
      (month: 8, weeks: '31-35', label: tr('pregnancyalbum_label_8', '8-ci ay'), emoji: '🎃'),
      (month: 9, weeks: '36-40', label: tr('pregnancyalbum_label_9', '9-cu ay'), emoji: '👶'),
    ];

int monthFromWeek(int week) {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  if (week <= 13) return 3;
  if (week <= 17) return 4;
  if (week <= 21) return 5;
  if (week <= 26) return 6;
  if (week <= 30) return 7;
  if (week <= 35) return 8;
  return 9;
}

/// `<img src>` of an album photo (tests override it: no network).
final albumImageBuilderProvider = Provider<Widget Function(String url, BoxFit fit)>((ref) => (url, fit) => CachedNetworkImage(
      imageUrl: url,
      fit: fit,
      errorWidget: (_, _, _) => const SizedBox.shrink(),
    ));

String _photoDate(String value) {
  final d = parseJsDate(value);
  return d == null ? '' : formatDatePattern(d.toLocal(), 'd MMMM yyyy');
}

class PregnancyAlbum extends ConsumerStatefulWidget {
  const PregnancyAlbum({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PregnancyAlbum> createState() => _PregnancyAlbumState();
}

class _PregnancyAlbumState extends ConsumerState<PregnancyAlbum> {
  bool _uploading = false;
  bool _showOrder = false;

  Future<void> _invalidate() => ref.read(queryClientProvider).invalidateQueries(queryKey: const ['pregnancy-album-photos']);

  /// Picks a photo and uploads it for [month]; [replace] keeps the old photo until the new one is stored.
  Future<void> _pickAndUpload(int month, {PregnancyAlbumPhoto? replace}) async {
    final toast = AToastHost.of(context);
    final file = await ref.read(pregnancyAlbumPickerProvider)();
    if (file == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      await _upload(file, month, replace);
      await _invalidate();
      toast.show(
        title: tr('pregnancyalbum_sekil_elave_edildi_a2085a', 'Şəkil əlavə edildi'),
        description: tr('pregnancyalbum_hamilelik_albomuna_sekil_elave_edildi_bf00fa', 'Hamiləlik albomuna şəkil əlavə edildi'),
      );
    } catch (e) {
      debugPrint('Upload error: $e');
      toast.show(
        title: tr('pregnancyalbum_xeta_3cdbb6', 'Xəta'),
        description: replace != null
            ? tr('firstaid_album_replace_failed', 'Şəkil dəyişdirilmədi. Əvvəlki şəkil saxlanıldı.')
            : tr('pregnancyalbum_sekil_yuklene_bilmedi_3c275f', 'Şəkil yüklənə bilmədi'),
        destructive: true,
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _upload(UploadFile file, int month, PregnancyAlbumPhoto? replace) async {
    final uid = ref.read(authUserProvider)?.id;
    if (uid == null) throw StateError(tr('pregnancyalbum_i_stifadeci_tapilmadi_4e2156', 'İstifadəçi tapılmadı'));
    final repo = ref.read(pregnancyAlbumRepositoryProvider);
    final ext = file.name.split('.').last;
    final fileName = '$uid/$month-${ref.read(pregnancyAlbumNowProvider)()}.$ext';
    final publicUrl = repo.publicUrl(fileName);
    // Replace safely: upload new → point the row at it → delete the old object.
    if (replace != null) {
      await replaceRecordPhoto(
        repo,
        bucket: pregnancyAlbumBucket,
        table: pregnancyAlbumTable,
        recordId: replace.id,
        oldPath: replace.storagePath.isEmpty ? null : replace.storagePath,
        newPath: fileName,
        newUrl: publicUrl,
        file: file,
      );
      return;
    }
    final uploadError = await repo.bucket(pregnancyAlbumBucket).upload(fileName, file);
    if (uploadError != null) throw uploadError;
    final weeks = pregnancyAlbumMonths().where((m) => m.month == month).firstOrNull?.weeks ?? '1';
    await repo.insertRow({
      'user_id': uid,
      'week_number': int.tryParse(weeks.split('-').first) ?? 1,
      'month_number': month,
      'photo_url': publicUrl,
      'caption': null,
    });
  }

  Future<void> _delete(PregnancyAlbumPhoto photo) async {
    final toast = AToastHost.of(context);
    if (!await ref.read(confirmPromptProvider)(context, tr('pregnancyalbum_bu_sekli_silmek_istediyinize_e_b4ecbc', 'Bu şəkli silmək istədiyinizə əminsiniz?'))) {
      return;
    }
    final repo = ref.read(pregnancyAlbumRepositoryProvider);
    try {
      if (photo.storagePath.isNotEmpty) await repo.bucket(pregnancyAlbumBucket).remove([photo.storagePath]);
      await repo.deleteRow(photo.id);
      await _invalidate();
      toast.show(title: 'Silindi', description: tr('pregnancyalbum_sekil_albomdan_silindi_0f180a', 'Şəkil albomdan silindi'));
    } catch (e) {
      debugPrint('Delete error: $e');
    }
  }

  Future<void> _openActions(PregnancyAlbumPhoto photo) async {
    final months = pregnancyAlbumMonths();
    final action = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'sheet',
      barrierColor: const Color(0x99000000),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (ctx, _, _) => Align(
        alignment: Alignment.bottomCenter,
        child: AScope(
          child: Builder(
            builder: (ctx) => _ActionSheet(photo: photo, label: _monthLabel(months, photo.monthNumber), image: ref.read(albumImageBuilderProvider)),
          ),
        ),
      ),
      transitionBuilder: (ctx, anim, _, child) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
        child: child,
      ),
    );
    if (!mounted) return;
    switch (action) {
      case 'view':
        await _openViewer(photo);
      case 'replace':
        await _pickAndUpload(photo.monthNumber, replace: photo);
      case 'delete':
        await _delete(photo);
    }
  }

  String? _monthLabel(List<({int month, String weeks, String label, String emoji})> months, int month) =>
      month >= 1 && month <= months.length ? months[month - 1].label : null;

  Future<void> _openViewer(PregnancyAlbumPhoto photo) async {
    final months = pregnancyAlbumMonths();
    final action = await Navigator.of(context).push<String>(PageRouteBuilder<String>(
      opaque: false,
      pageBuilder: (ctx, _, _) => _PhotoViewer(
        photo: photo,
        image: ref.read(albumImageBuilderProvider),
        label: _monthLabel(months, photo.monthNumber),
        onSaveCaption: (caption) async {
          await ref.read(pregnancyAlbumRepositoryProvider).updateCaption(photo.id, caption.isEmpty ? null : caption);
          await _invalidate();
          if (ctx.mounted) AToastHost.of(ctx).show(title: tr('pregnancyalbum_yenilendi_d10a01', 'Yeniləndi'));
        },
      ),
      transitionsBuilder: (ctx, anim, _, child) => FadeTransition(opacity: anim, child: child),
    ));
    if (!mounted) return;
    if (action == 'replace') await _pickAndUpload(photo.monthNumber, replace: photo);
    if (action == 'delete') await _delete(photo);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final slots = ref.watch(pregnancyToolSlotsProvider);
    if (_showOrder && slots.albumOrderScreen != null) return slots.albumOrderScreen!(context, () => setState(() => _showOrder = false));
    final store = ref.watch(userStoreProvider);
    final photos = ref.watch(pregnancyAlbumPhotosQuery).data ?? const <PregnancyAlbumPhoto>[];
    // Week only for a known pregnancy (never "|| 1"); after birth every month is in the past.
    final preg = store.lifeStage == 'bump' ? store.getPregnancyData() : null;
    final currentWeek = preg != null && preg.currentWeek > 0 ? preg.currentWeek : null;
    final currentMonth = currentWeek != null ? monthFromWeek(currentWeek) : (store.lifeStage == 'mommy' ? 9 : 1);
    final months = pregnancyAlbumMonths();

    return Stack(children: [
      ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('pregnancyalbum_her_ay_xatire_c5bdee', 'Hər ay xatirə'),
            title: tr('pregnancyalbum_hamilelik_albomu_6f1559', 'Hamiləlik Albomu'),
          ),
          if (currentWeek != null) _progressCard(context, months, currentMonth, currentWeek),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('pregnancyalbum_xatireleriniz_3e880f', 'Xatirələriniz'), style: x.aSectionTitle.copyWith(fontSize: 15)),
          ),
          GridView.count(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            children: [for (final m in months) _tile(context, m, photos.where((p) => p.monthNumber == m.month).firstOrNull, currentMonth)],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: ACard(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                PListIcon(gradient: a.gradPink, child: AIcon(AIcons.heart, size: 17, strokeWidth: 2.2, color: a.alertInk)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('pregnancyalbum_meslehet_9a0892', 'Məsləhət'), style: x.aListTitle)),
                    Text(
                      tr('pregnancyalbum_her_ay_eyni_bucaqdan_ve_eyni_p_4d07a0',
                              'Hər ay eyni bucaqdan və eyni paltarla şəkil çəkmək daha gözəl albom yaradır. \n                Beləcə hamiləlik boyunca dəyişiklikləri açıq şəkildə görə bilərsiniz.')
                          .replaceAll(RegExp(r'\s+'), ' '),
                      style: x.aListSub,
                    ),
                  ]),
                ),
              ]),
            ),
          ),
          Padding(padding: const EdgeInsets.symmetric(vertical: 16), child: currentMonth >= 6 ? _orderCta(context) : _orderLocked(context, currentMonth)),
        ]),
      ),
      if (_uploading)
        Positioned.fill(
          child: ColoredBox(
            color: const Color(0x80000000),
            child: Center(
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(26)),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 4, color: a.peach2)),
                  const SizedBox(height: 12),
                  Text(tr('pregnancyalbum_sekil_yuklenir_babf92', 'Şəkil yüklənir...'), style: x.aListTitle),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }

  Widget _progressCard(BuildContext context, List<({int month, String weeks, String label, String emoji})> months, int currentMonth, int currentWeek) {
    final a = context.a;
    final m = months[currentMonth - 1];
    final small = px(12, weight: FontWeight.w600, color: a.alertInk.withValues(alpha: 0.75));
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('pregnancyalbum_hal_hazirda_b78349', 'Hal-hazırda'), style: small),
              Text(m.label, style: context.aText.heading(px(20, color: a.alertInk))),
              Text(weekOrdinal(currentWeek), style: small),
            ]),
          ),
          Text(m.emoji, style: const TextStyle(fontSize: 36)),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 8,
                // `rgba(255,255,255,0.45)` / `#fff` (PregnancyAlbum.tsx literals)
                color: const Color(0x73FFFFFF),
                alignment: AlignmentDirectional.centerStart,
                child: FractionallySizedBox(widthFactor: currentMonth / 9, heightFactor: 1, child: const ColoredBox(color: Color(0xFFFFFFFF))),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text('${jsRoundInt(currentMonth / 9 * 100)}%', style: px(12, weight: FontWeight.w700, color: a.alertInk)),
        ]),
      ]),
    );
  }

  Widget _tile(BuildContext context, ({int month, String weeks, String label, String emoji}) m, PregnancyAlbumPhoto? photo, int currentMonth) {
    final a = context.a;
    final isPast = m.month < currentMonth;
    final isCurrent = m.month == currentMonth;
    final isFuture = m.month > currentMonth;
    final disabled = isFuture && photo == null;
    Widget body;
    if (photo != null) {
      body = Stack(fit: StackFit.expand, children: [
        ref.watch(albumImageBuilderProvider)(photo.photoUrl, BoxFit.cover),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0x99000000), Color(0x00000000), Color(0x00000000)]),
          ),
        ),
        PositionedDirectional(
          bottom: 8,
          start: 8,
          end: 8,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: const Color(0x40FFFFFF), borderRadius: BorderRadius.circular(999)),
              child: Text(m.label, style: px(10, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
            ),
          ),
        ),
      ]);
    } else {
      body = DashedBorderBox(
        color: isCurrent ? a.peach2 : a.lineStrong,
        fill: isCurrent ? a.peach1 : a.surface,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(m.emoji, style: const TextStyle(fontSize: 24))),
          if (isCurrent) ...[
            Padding(padding: const EdgeInsets.only(bottom: 4), child: AIcon(AIcons.imagePlus, size: 20, color: a.accentInk)),
            Text(tr('pregnancyalbum_elave_et_6e1b9b', 'Əlavə et'), style: px(10, weight: FontWeight.w700, color: a.accentInk)),
          ] else if (isPast) ...[
            Padding(padding: const EdgeInsets.only(bottom: 4), child: AIcon(AIcons.imagePlus, size: 16, color: a.inkSoft)),
            Text(m.label, style: px(10, weight: FontWeight.w600, color: a.inkSoft)),
          ] else
            Text(m.label, style: px(10, weight: FontWeight.w600, color: a.inkSoft)),
        ]),
      );
    }
    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: GestureDetector(
        key: ValueKey('album-month-${m.month}'),
        onTap: disabled
            ? null
            : () {
                if (photo != null) {
                  unawaited(_openActions(photo));
                } else if (!isFuture) {
                  unawaited(_pickAndUpload(m.month));
                }
              },
        child: ClipRRect(borderRadius: BorderRadius.circular(16), child: body),
      ),
    );
  }

  Widget _orderCta(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget cell(String label, String value) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              Text(label, style: px(10, color: a.inkSoft)),
              Text(value, style: px(13, weight: FontWeight.w700, color: a.ink)),
            ]),
          ),
        );
    return PCta(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PListIcon(gradient: a.gradCta, border: Border.all(color: a.btnBorder), child: AIcon(AIcons.heart, size: 17, strokeWidth: 2.2, color: a.accentInk)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(tr('pregnancyalbum_hamilelik_xatirelerini_elinizd_76d584', 'Hamiləlik xatirələrini əlinizdə tutun'), style: x.heading(x.aCardTitle)),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tr('pregnancyalbum_9_ayin_her_anini_fiziki_albom__729db3',
                    '9 ayın hər anını fiziki albom kimi sifariş edin. Premium kağız, hər ay üçün ayrıca səhifə, ömürlük xatirə.'),
                style: x.aCtaText,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                cell(tr('pregnancyalbum_sehife_fd1fa9', 'Səhifə'), '9+'),
                const SizedBox(width: 8),
                cell(trInline('PregnancyAlbum.tsx', 'Format'), trInline('PregnancyAlbum.tsx', 'A4')),
                const SizedBox(width: 8),
                cell(tr('pregnancyalbum_catdirilma_e955cf', 'Çatdırılma'), tr('pregnancyalbum_3_5_gun_5d513c', '3-5 gün')),
              ]),
            ),
            PCtaButton(
              key: const ValueKey('album-order'),
              height: 44,
              leading: AIcons.shoppingBag,
              onTap: () => setState(() => _showOrder = true),
              child: Text(tr('pregnancyalbum_fiziki_albom_sifaris_et_26f86e', 'Fiziki Albom Sifariş Et')),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _orderLocked(BuildContext context, int currentMonth) {
    final a = context.a;
    final x = context.aText;
    return ACard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PListIcon(background: a.surfaceSoft, child: AIcon(AIcons.shoppingBag, size: 17, strokeWidth: 2.2, color: a.inkSoft)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(tr('untranslated_fiziki_albom_3i3l4j', 'Fiziki Albom'), style: x.aListTitle)),
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                tr('pregnancyalbum_6_ci_ayi_tamamladiqdan_sonra_h_8a778c', '6-cı ayı tamamladıqdan sonra hamiləlik albomunuzu fiziki kitab kimi sifariş edə bilərsiniz.'),
                style: x.aListSub,
              ),
            ),
            Row(children: [
              Expanded(child: PProgressBar(percent: (currentMonth / 6 * 100).clamp(0, 100).toDouble(), height: 6, fill: a.gradPeach)),
              const SizedBox(width: 8),
              Text('$currentMonth/6 ${tr('pregnancyalbum_ay_suffix_3c7a2d', 'ay')}', style: px(11, weight: FontWeight.w700, color: a.inkSoft)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/// `2px dashed` border box with radius 16 (Chromium dash pattern 6 on / 6 off for a 2px border).
class DashedBorderBox extends StatelessWidget {
  const DashedBorderBox({super.key, required this.child, required this.color, required this.fill});
  final Widget child;
  final Color color;
  final Color fill;

  @override
  Widget build(BuildContext context) => CustomPaint(
        painter: _DashedRRect(color, fill),
        child: SizedBox.expand(child: child),
      );
}

class _DashedRRect extends CustomPainter {
  _DashedRRect(this.color, this.fill);
  final Color color;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(16)).deflate(1);
    canvas.drawRRect(rrect, Paint()..color = fill);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final path = Path()..addRRect(rrect);
    for (final metric in path.computeMetrics()) {
      for (double d = 0; d < metric.length; d += 12) {
        canvas.drawPath(metric.extractPath(d, (d + 6).clamp(0, metric.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRect old) => old.color != color || old.fill != fill;
}

class _ActionSheet extends StatelessWidget {
  const _ActionSheet({required this.photo, required this.label, required this.image});
  final PregnancyAlbumPhoto photo;
  final String? label;
  final Widget Function(String url, BoxFit fit) image;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget action(String key, AIconData icon, String text, Color bg, Color ink) => Expanded(
          child: GestureDetector(
            key: ValueKey('album-action-$key'),
            onTap: () => Navigator.of(context).pop(key),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                AIcon(icon, size: 20, color: ink),
                const SizedBox(height: 6),
                Text(text, style: px(12, weight: FontWeight.w700, color: ink)),
              ]),
            ),
          ),
        );
    return Material(
      type: MaterialType.transparency,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 448),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: ColoredBox(color: a.surfaceSoft, child: image(photo.photoUrl, BoxFit.cover)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(label ?? '', style: x.aListTitle),
                  Text(_photoDate(photo.photoDate), style: x.aListSub),
                  if (photo.caption != null && photo.caption!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(photo.caption!, style: x.aListSub)),
                ]),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              action('view', AIcons.camera, tr('untranslated_bax_1yplss', 'Bax'), a.peach1, a.accentInk),
              const SizedBox(width: 8),
              action('replace', AIcons.refreshCw, tr('pregnancyalbum_deyisdir_aca175', 'Dəyişdir'), a.blue1, a.blueInk),
              const SizedBox(width: 8),
              action('delete', AIcons.trash2, tr('untranslated_sil_zwa7lz', 'Sil'), a.pink1, a.pinkInk),
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
                child: Text(tr('pregnancyalbum_legv_et_b5e49c', 'Ləğv et')),
              ),
            ),
          ),
          SizedBox(height: MediaQuery.paddingOf(context).bottom),
        ]),
      ),
    );
  }
}

class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.photo, required this.label, required this.onSaveCaption, required this.image});
  final PregnancyAlbumPhoto photo;
  final Widget Function(String url, BoxFit fit) image;
  final String? label;
  final Future<void> Function(String caption) onSaveCaption;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  bool _editing = false;
  late final TextEditingController _caption = TextEditingController(text: widget.photo.caption ?? '');
  String? _savedCaption;

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  Widget _roundButton(String label, AIconData icon, Color color, VoidCallback onTap, {Key? key}) => Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          key: key,
          onTap: onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            // `rgba(255,255,255,0.15)` (PregnancyAlbum.tsx literal)
            decoration: const BoxDecoration(color: Color(0x26FFFFFF), shape: BoxShape.circle),
            child: AIcon(icon, size: 20, color: color),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    const white = Color(0xFFFFFFFF);
    final caption = _savedCaption ?? widget.photo.caption;
    return AScope(
      child: Material(
        color: const Color(0xFF000000),
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                _roundButton(tr('common_close', 'Bağla'), AIcons.x, white, () => Navigator.of(context).pop()),
                Expanded(
                  child: Column(children: [
                    Text(widget.label ?? '', style: px(14, weight: FontWeight.w600, color: white)),
                    Opacity(opacity: 0.7, child: Text(_photoDate(widget.photo.photoDate), style: px(12, color: white))),
                  ]),
                ),
                _roundButton(tr('a11y_replace_photo', 'Şəkli dəyiş'), AIcons.refreshCw, white, () => Navigator.of(context).pop('replace')),
                const SizedBox(width: 8),
                _roundButton(tr('common_sil', 'Sil'), AIcons.trash2, a.pink2, () => Navigator.of(context).pop('delete'), key: const ValueKey('album-viewer-delete')),
              ]),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: widget.image(widget.photo.photoUrl, BoxFit.contain),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: _editing
                  ? Row(children: [
                      Expanded(
                        child: Container(
                          height: 40,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          alignment: AlignmentDirectional.centerStart,
                          decoration: BoxDecoration(color: const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(8)),
                          child: TextField(
                            key: const ValueKey('album-caption'),
                            controller: _caption,
                            autofocus: true,
                            style: px(14, color: white),
                            cursorColor: white,
                            decoration: InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: tr('pregnancyalbum_basliq_elave_edin_082901', 'Başlıq əlavə edin...'),
                              hintStyle: px(14, color: const Color(0x80FFFFFF)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Semantics(
                        button: true,
                        label: tr('common_saxla', 'Saxla'),
                        child: GestureDetector(
                          key: const ValueKey('album-caption-save'),
                          onTap: () async {
                            final text = _caption.text;
                            await widget.onSaveCaption(text);
                            if (mounted) {
                              setState(() {
                                _editing = false;
                                _savedCaption = text.isEmpty ? null : text;
                              });
                            }
                          },
                          child: Container(
                            width: 42,
                            height: 42,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                            child: const AIcon(AIcons.save, size: 16, color: white),
                          ),
                        ),
                      ),
                    ])
                  : GestureDetector(
                      key: const ValueKey('album-caption-edit'),
                      onTap: () => setState(() {
                        _caption.text = caption ?? '';
                        _editing = true;
                      }),
                      child: Opacity(
                        opacity: 0.7,
                        child: caption != null && caption.isNotEmpty
                            ? Text(caption, style: px(14, color: white))
                            : Row(children: [
                                const AIcon(AIcons.squarePen, size: 16, color: white),
                                const SizedBox(width: 8),
                                Text(tr('pregnancyalbum_basliq_elave_et_ac912f', 'Başlıq əlavə et'), style: px(14, color: white)),
                              ]),
                      ),
                    ),
            ),
          ]),
        ),
      ),
    );
  }
}
