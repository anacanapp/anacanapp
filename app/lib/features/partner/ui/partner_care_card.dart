// Ported from: src/components/partner/v2/PartnerCareCard.tsx, src/components/partner/DailySummaryAutoSync.tsx
//
// Mother dashboard — "My partner" card: today's love / messages from him, "Thank you", today's summary and the
// SOS / birth sheet. Surprises are deliberately not shown (they should stay a surprise!). And the headless daily
// summary sync the dashboard mounts for a linked pregnancy.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../chat/data/chat_push.dart' show SendPushPayload, chatPushSenderProvider;
import '../../settings/ui/settings_ui.dart' show FadeRise, toasts;
import '../data/daily_summary.dart';
import '../data/partner_backend.dart';
import '../data/partner_data.dart';
import '../partner_copy.dart';
import '../partner_ports.dart';
import 'partner_ui.dart';
import 'sos.dart';

/// Today's love / text messages from the partner among [messages].
({int loves, int texts}) todayPartnerStats(List<Map<String, dynamic>> messages, String? userId, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  final startOfDay = DateTime(n.year, n.month, n.day);
  final today = messages.where((m) {
    if (m['receiver_id'] != userId) return false;
    final at = DateTime.tryParse('${m['created_at'] ?? ''}');
    return at != null && !at.isBefore(startOfDay);
  }).toList();
  return (
    loves: today.where((m) => m['message_type'] == 'love').length,
    texts: today.where((m) => const ['text', 'image', 'audio'].contains(m['message_type'])).length,
  );
}

class PartnerCareCard extends ConsumerStatefulWidget {
  const PartnerCareCard({super.key, this.lifeStage, this.onOpenSharing});
  final String? lifeStage;
  final VoidCallback? onOpenSharing;

  @override
  ConsumerState<PartnerCareCard> createState() => _PartnerCareCardState();
}

class _PartnerCareCardState extends ConsumerState<PartnerCareCard> {
  bool _sosOpen = false;
  bool _thanking = false;
  bool _sendingSummary = false;

  Future<void> _sendSummary(bool alreadySent) async {
    final userId = ref.read(authUserProvider)?.id;
    if (userId == null || _sendingSummary || alreadySent) return;
    final toast = toasts(context);
    setState(() => _sendingSummary = true);
    await quietly(ref.read(partnerHapticsProvider).light);
    final result = await ref.read(dailySummaryProvider.notifier).generateAndSendSummary();
    if (mounted) setState(() => _sendingSummary = false);
    if (result.error != null) {
      toast.show(title: tr('partnerv2_xulase_xetasi', 'Xülasə göndərilə bilmədi'), destructive: true);
    } else {
      toast.show(title: tr('partnerv2_xulase_gonderildi', 'Bugünkü xülasə göndərildi! 📊'));
    }
  }

  Future<void> _sendThankYou(PartnerWomanData partner) async {
    final userId = ref.read(authUserProvider)?.id;
    if (userId == null || _thanking) return;
    final toast = toasts(context);
    setState(() => _thanking = true);
    await quietly(ref.read(partnerHapticsProvider).medium);
    final payload = {
      'type': 'thank_you',
      'title': tr('partnerv2_thank_title', '🙏 Təşəkkür aldınız!'),
      'body': tr('partnerv2_thank_body', 'Xanımınız sizə minnətdardır. Əla iş görürsən!'),
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
    final backend = ref.read(partnerBackendProvider);
    try {
      Map<String, dynamic>? message;
      try {
        message = await backend.insertReturning(
            'partner_messages', {'sender_id': userId, 'receiver_id': partner.userId, 'message_type': 'thank_you', 'content': jsonEncode(payload)},
            columns: 'id');
      } on PostgrestException catch (error) {
        // Retry only a known schema constraint failure (no thank_you type yet), never an uncertain write.
        if (error.code != '23514') rethrow;
        message = await backend.insertReturning(
            'partner_messages',
            {
              'sender_id': userId,
              'receiver_id': partner.userId,
              'message_type': 'text',
              'content': tr('partnerv2_thank_fallback_text', '🙏 Təşəkkür edirəm! Sən əla partnyorsan!'),
            },
            columns: 'id');
      }
      final id = message['id'];
      if (id == null) throw StateError('message_not_saved');
      try {
        await ref.read(chatPushSenderProvider).send(SendPushPayload(
              userId: partner.userId,
              title: '${payload['title']}',
              body: '${payload['body']}',
              data: {'type': 'thank_you', 'context': 'partner', 'interactionId': id, 'messageId': id},
            ));
      } catch (_) {
        // push optional
      }
      toast.show(title: tr('partnerv2_thank_sent', 'Təşəkkür göndərildi! 💙'));
    } catch (error) {
      debugPrint('$error');
    } finally {
      if (mounted) setState(() => _thanking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
    final partner = ref.watch(partnerDataProvider.select((d) => d.partnerProfile));
    final userId = ref.watch(authUserProvider)?.id;
    final stats = todayPartnerStats(ref.watch(partnerMessagesFeedProvider).messages, userId);
    final todaySummary = ref.watch(dailySummaryProvider.select((s) => s.todaySummary));
    final alreadySent = todaySummary?.isSent ?? false;
    if (linked == null || linked.isEmpty || partner == null) return const SizedBox.shrink();
    final partnerName = partner.name.isNotEmpty ? partner.name : tr('common_partnyor', 'Partnyor');
    final todayLine = stats.loves > 0 || stats.texts > 0
        ? '${tr('partnerv2_bu_gun_short', 'Bu gün')}: ${stats.loves > 0 ? '${stats.loves} ❤️' : ''}${stats.loves > 0 && stats.texts > 0 ? ' · ' : ''}'
            '${stats.texts > 0 ? '${stats.texts} ${tr('partnerv2_mesaj', 'mesaj')}' : ''}'
        : tr('partnerv2_yaninizdadir', 'Yanınızdadır 💙');

    Widget pill({required Key key, required VoidCallback? onTap, required Widget child, required Color background, Gradient? gradient, required Color color,
            EdgeInsets padding = EdgeInsets.zero, bool expand = false, double opacity = 1, double scale = 0.96, String? label, FontWeight weight = FontWeight.w700}) =>
        PartnerTap(
          key: key,
          scale: scale,
          semanticLabel: label,
          onTap: onTap,
          child: Opacity(
            opacity: opacity,
            child: Container(
              height: 42,
              padding: padding,
              decoration: BoxDecoration(color: gradient == null ? background : null, gradient: gradient, borderRadius: BorderRadius.circular(999)),
              child: DefaultTextStyle.merge(
                style: pText(12.5, weight: weight, color: color),
                child: Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [Flexible(child: child)]),
              ),
            ),
          ),
        );

    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      FadeRise(
        dy: 14,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: PartnerCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.blue1, shape: BoxShape.circle),
                  child: const Text('💙', style: TextStyle(fontSize: 20)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(partnerName, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(14.5, weight: FontWeight.w800, color: a.ink)),
                    Text(todayLine, style: pText(11, color: a.inkSoft)),
                  ]),
                ),
                if (widget.onOpenSharing != null) ...[
                  const SizedBox(width: 12),
                  PartnerTap(
                    key: const ValueKey('care-card-sharing'),
                    semanticLabel: tr('partnerv2_partnyor_nleri_gorur', 'Partnyor nələri görür?'),
                    onTap: widget.onOpenSharing,
                    scale: 1,
                    child: Container(
                      width: 34,
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.btnBorder)),
                      child: AIcon(AIcons.settings2, size: 14, color: a.ink),
                    ),
                  ),
                ],
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: pill(
                    key: const ValueKey('care-card-thanks'),
                    onTap: _thanking ? null : () => unawaited(_sendThankYou(partner)),
                    opacity: _thanking ? 0.6 : 1,
                    background: a.blue1,
                    color: a.blueInk,
                    expand: true,
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AIcon(AIcons.handHeart, size: 15, color: a.blueInk),
                      const SizedBox(width: 6),
                      Flexible(child: Text(tr('partnerv2_tesekkur_et', 'Təşəkkür et'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    ]),
                  ),
                ),
                const SizedBox(width: 8),
                pill(
                  key: const ValueKey('care-card-summary'),
                  onTap: _sendingSummary || alreadySent ? null : () => unawaited(_sendSummary(alreadySent)),
                  opacity: _sendingSummary || alreadySent ? 0.8 : 1,
                  scale: alreadySent ? 1 : 0.96,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  background: alreadySent ? a.green1 : a.lav1,
                  color: alreadySent ? a.greenInk : a.lavInk,
                  label: alreadySent
                      ? tr('partnerv2_xulase_gonderildi_badge', 'Bugünkü xülasə göndərildi')
                      : tr('partnerv2_xulaseni_gonder', 'Bugünkü xülasəni partnyoruma göndər'),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(alreadySent ? AIcons.check : AIcons.send, size: 15, color: alreadySent ? a.greenInk : a.lavInk),
                    const SizedBox(width: 6),
                    Text(feature37Text('ph_summary')),
                  ]),
                ),
                const SizedBox(width: 8),
                pill(
                  key: const ValueKey('care-card-sos'),
                  onTap: () => setState(() => _sosOpen = true),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  background: a.surface,
                  gradient: a.alertBg,
                  color: a.alertInk,
                  weight: FontWeight.w800,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.siren, size: 15, color: a.alertInk),
                    const SizedBox(width: 6),
                    const Text('SOS'),
                  ]),
                ),
              ]),
            ]),
          ),
        ),
      ),
      MotherSosSheet(open: _sosOpen, onClose: () => setState(() => _sosOpen = false), lifeStage: widget.lifeStage),
    ]);
  }
}

/// Headless: keeps the daily summary synced with the partner through useDailySummary's realtime handlers.
class DailySummaryAutoSync extends ConsumerWidget {
  const DailySummaryAutoSync({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(dailySummaryProvider.select((s) => s.loading));
    return const SizedBox.shrink();
  }
}
