// Ported from: src/components/tools/doctors/ProviderReviews.tsx
//
// Reviews of a healthcare provider: write / edit / delete the user's own review (1-5 stars + comment) and the list.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../community/copy/community_copy.dart' show formatDistanceToNowSuffix;
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import 'doctors_data.dart';

class ProviderReviews extends ConsumerStatefulWidget {
  const ProviderReviews({super.key, required this.providerId, required this.providerName});
  final String providerId;
  final String providerName;

  @override
  ConsumerState<ProviderReviews> createState() => _ProviderReviewsState();
}

class _ProviderReviewsState extends ConsumerState<ProviderReviews> {
  int _rating = 0;
  final _comment = TextEditingController();
  bool _expanded = false;
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) return;
    final toasts = AToastHost.of(context);
    final rating = _rating, comment = _comment.text;
    setState(() {
      _submitting = true;
      _expanded = false;
    });
    try {
      await ref.read(providerReviewActionsProvider).submit(widget.providerId, rating: rating, comment: comment);
      toasts.success(tr('useproviderreviews_reyiniz_ugurla_gonderildi_066d09', 'Rəyiniz uğurla göndərildi!'));
    } catch (_) {
      toasts.error(tr('useproviderreviews_rey_gonderilmedi_yeniden_cehd__2c6482', 'Rəy göndərilmədi. Yenidən cəhd edin.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _delete() async {
    final toasts = AToastHost.of(context);
    setState(() {
      _rating = 0;
      _comment.clear();
    });
    try {
      await ref.read(providerReviewActionsProvider).delete(widget.providerId);
      toasts.success(tr('useproviderreviews_reyiniz_silindi_5c36ac', 'Rəyiniz silindi'));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final isAuthenticated = ref.watch(healthUserIdProvider) != null;
    final reviewsQ = ref.watch(providerReviewsQuery(widget.providerId));
    final reviews = reviewsQ.data ?? const <Map<String, dynamic>>[];
    final userReview = ref.watch(userReviewQuery(widget.providerId)).data;

    // Take over the user's stored review while the form is closed and nothing was picked.
    if (userReview != null && _rating == 0 && !_expanded) {
      _rating = (userReview['rating'] as num?)?.toInt() ?? 0;
      _comment.text = userReview['comment'] is String ? userReview['comment'] as String : '';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(children: [
              AIcon(AIcons.messageSquare, size: 16, color: a.peach2),
              const SizedBox(width: 8),
              Expanded(child: Text('${tr('providerreviews_reyler_8be233', 'Rəylər (')}${reviews.length})', style: AStyles.cardTitle(context))),
              if (isAuthenticated && !_expanded)
                APillButton(
                  kind: APillKind.soft,
                  label: userReview != null ? tr('providerreviews_reyi_redakte_et_12797e', 'Rəyi redaktə et') : tr('providerreviews_rey_yaz_7b3aab', 'Rəy yaz'),
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  fontSize: 11,
                  onTap: () => setState(() => _expanded = true),
                ),
            ]),
          ),
          if (_expanded && isAuthenticated)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text('${widget.providerName} ${tr('providerreviews_haqqinda_reyinizi_yazin_049e5e', 'haqqında rəyinizi yazın')}', style: AStyles.listSub(context)),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(children: [
                    for (var star = 1; star <= 5; star++)
                      Semantics(
                        button: true,
                        toggled: _rating == star,
                        label: formatTr('a11y_star_n', 'Qiymət: {n}/5', {'n': star}),
                        excludeSemantics: true,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => setState(() => _rating = star),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: star <= _rating ? LucideFilled(AIcons.star, size: 28, color: a.yellow2) : AIcon(AIcons.star, size: 28, color: a.lineStrong),
                          ),
                        ),
                      ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(_rating > 0 ? '$_rating/5' : tr('providerreviews_qiymetlendirin_df8e66', 'Qiymətləndirin'),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, color: a.inkSoft, height: 20 / 14)),
                    ),
                  ]),
                ),
                ATextArea(
                  controller: _comment,
                  height: 96,
                  placeholder: tr('providerreviews_tecrubenizi_bolusun_isteye_bagli_3f9da1', 'Təcrübənizi bölüşün (istəyə bağlı)...'),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Row(children: [
                    APillButton(
                      kind: APillKind.soft,
                      label: tr('providerreviews_legv_et_b5e49c', 'Ləğv et'),
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      fontSize: 11,
                      onTap: () => setState(() {
                        _expanded = false;
                        _rating = (userReview?['rating'] as num?)?.toInt() ?? 0;
                        _comment.text = userReview?['comment'] is String ? userReview!['comment'] as String : '';
                      }),
                    ),
                    if (userReview != null) ...[
                      const SizedBox(width: 8),
                      APillButton(
                        kind: APillKind.soft,
                        label: tr('untranslated_sil_zwa7lz', 'Sil'),
                        icon: const AIcon(AIcons.trash2, size: 13, strokeWidth: 2.2),
                        height: 34,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        fontSize: 11,
                        background: a.pink1,
                        foreground: a.pinkInk,
                        onTap: _delete,
                      ),
                    ],
                    const Spacer(),
                    APillButton(
                      label: userReview != null ? tr('providerreviews_yenile_570ce2', 'Yenilə') : tr('providerreviews_gonder_3f11bd', 'Göndər'),
                      icon: const AIcon(AIcons.send, size: 13, strokeWidth: 2.2),
                      height: 36,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      fontSize: 11.5,
                      onTap: _rating == 0 || _submitting ? null : _submit,
                    ),
                  ]),
                ),
              ]),
            ),
          if (!isAuthenticated)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
              child: Text(tr('providerreviews_rey_yazmaq_ucun_hesabiniza_dax_d75d40', 'Rəy yazmaq üçün hesabınıza daxil olun'), textAlign: TextAlign.center, style: AStyles.listSub(context)),
            ),
          if (reviewsQ.isLoading)
            vgap(12, [
              for (var i = 0; i < 2; i++)
                APulse(
                  child: Row(children: [
                    Container(width: 40, height: 40, decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle)),
                    const SizedBox(width: 12),
                    const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [ABar(height: 16, widthFactor: 0.3, radius: 4), SizedBox(height: 8), ABar(height: 12, radius: 4)])),
                  ]),
                ),
            ])
          else if (reviews.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(children: [
                Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.star, size: 32, color: a.inkFaint)),
                Text(tr('providerreviews_hele_hec_bir_rey_yoxdur_410969', 'Hələ heç bir rəy yoxdur'), style: AStyles.listSub(context)),
                Text(tr('providerreviews_ilk_reyi_siz_yazin_cc6119', 'İlk rəyi siz yazın!'), style: px(12, color: a.inkFaint, height: 16 / 12)),
              ]),
            )
          else
            vgap(16, [
              for (var i = 0; i < reviews.length; i++) FadeRise(dy: 10, delay: Duration(milliseconds: (i * 50).clamp(0, 300)), child: _review(context, reviews[i])),
            ]),
        ]),
      ),
    );
  }

  Widget _review(BuildContext context, Map<String, dynamic> r) {
    final a = context.a;
    final avatar = r['user_avatar'];
    final rating = (r['rating'] as num?) ?? 0;
    final created = DateTime.tryParse('${r['created_at']}');
    final comment = r['comment'];
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 40,
        height: 40,
        clipBehavior: Clip.antiAlias,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
        child: avatar is String && avatar.isNotEmpty
            ? Image.network(avatar, width: 40, height: 40, fit: BoxFit.cover, errorBuilder: (_, _, _) => AIcon(AIcons.user, size: 20, color: a.accentInk))
            : AIcon(AIcons.user, size: 20, color: a.accentInk),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('${r['user_name'] ?? ''}', style: AStyles.listTitle(context))),
            const SizedBox(width: 8),
            Text(created == null ? '' : formatDistanceToNowSuffix(created), style: AStyles.listTime(context)),
          ]),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              for (var s = 1; s <= 5; s++)
                Padding(
                  padding: const EdgeInsets.only(right: 2),
                  child: s <= rating ? LucideFilled(AIcons.star, size: 12, color: a.yellow2) : AIcon(AIcons.star, size: 12, color: a.lineStrong),
                ),
            ]),
          ),
          if (comment is String && comment.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(comment, style: px(14, color: a.bodyText, height: 20 / 14))),
        ]),
      ),
    ]);
  }
}
