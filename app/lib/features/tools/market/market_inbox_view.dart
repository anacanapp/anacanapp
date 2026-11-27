// Ported from: src/components/tools/market/MarketInbox.tsx
//
// Market conversations as buyer and as seller: listing, counterpart, last message, time, unread count.
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show isSameLocalDay, jsParseDate;
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../health_common/health_ui.dart' show APillButton, APillKind;
import '../more_common/more_ui.dart';
import 'market_inbox.dart';

/// `inboxTimeLabel(iso, now)`: `HH:mm` today, else `d MMM` in the app language.
String inboxTimeLabel(String iso, [DateTime? now]) {
  final d = jsParseDate(iso)?.toLocal();
  if (d == null) return '';
  try {
    return isSameLocalDay(d, now ?? DateTime.now()) ? formatDatePattern(d, 'HH:mm') : formatDatePattern(d, 'd MMM');
  } catch (_) {
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }
}

/// A listing image (`<img loading="lazy">`), or [fallback] when it fails.
Widget marketImage(String url, {BoxFit fit = BoxFit.cover, Widget? fallback, String? semanticLabel}) => Image.network(
      url,
      fit: fit,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      errorBuilder: (_, _, _) => fallback ?? const SizedBox.expand(),
    );

List<String> marketImages(Object? images) => images is List ? [for (final i in images) if (i is String && i.isNotEmpty) i] : const [];

class MarketInbox extends StatelessWidget {
  const MarketInbox({
    super.key,
    required this.conversations,
    required this.listings,
    required this.names,
    required this.myId,
    required this.loading,
    required this.failed,
    required this.onOpen,
    required this.onRetry,
    this.now,
  });
  final List<MarketConversation> conversations;
  final Map<String, Map<String, dynamic>> listings;
  final Map<String, String> names;
  final String? myId;
  final bool loading;
  final bool failed;
  final ValueChanged<MarketConversation> onOpen;
  final VoidCallback onRetry;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    if (loading && conversations.isEmpty) {
      return Semantics(
        label: tr('marketinbox_loading', 'Mesajlar yüklənir'),
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Center(child: ALoader(size: 24, color: a.inkSoft))),
      );
    }
    if (failed && conversations.isEmpty) {
      return ACard(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('marketinbox_load_failed', 'Mesajlar yüklənmədi.'), textAlign: TextAlign.center, style: x.aListSub),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: APillButton(buttonKey: const ValueKey('market-inbox-retry'), kind: APillKind.soft, label: tr('chat_retry', 'Yenidən cəhd et'), onTap: onRetry),
          ),
        ]),
      );
    }
    if (conversations.isEmpty) {
      return DashedEmptyCard(
        gradient: a.gradGreen,
        icon: AIcon(AIcons.messageCircle, size: 32, color: a.greenInk),
        title: tr('secondhandmarket_hele_mesaj_yoxdur_cf0b5e', 'Hələ mesaj yoxdur'),
        text: tr('marketinbox_empty_hint', 'Elanlarınız və yazdığınız satıcılarla yazışmalar burada görünəcək.'),
      );
    }
    return Semantics(
      label: tr('bottomnav_mesajlar', 'Mesajlar'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < conversations.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          _row(context, conversations[i]),
        ],
      ]),
    );
  }

  Widget _row(BuildContext context, MarketConversation c) {
    final a = context.a;
    final x = context.aText;
    final listing = listings[c.listingId];
    final title = '${listing?['title'] ?? ''}'.isNotEmpty ? '${listing!['title']}' : tr('untranslated_elan_voiz8p', 'Elan');
    final who = (names[c.counterpartId] ?? '').isNotEmpty ? names[c.counterpartId]! : tr('market_user_fallback', 'İstifadəçi');
    final roleLabel = c.role == 'seller' ? tr('marketinbox_role_buyer', 'Alıcı') : tr('marketinbox_role_seller', 'Satıcı');
    final mine = c.last.senderId == myId;
    final preview = previewText(c.last.content);
    final unreadLabel = c.unread > 0 ? formatTr('marketinbox_unread_count', '{n} oxunmamış', {'n': c.unread}) : '';
    final images = marketImages(listing?['images']);
    final thumbFallback = Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(12)),
      child: AIcon(AIcons.messageCircle, size: 20, color: a.greenInk),
    );
    return Semantics(
      button: true,
      label: '$title, $roleLabel: $who. $preview${unreadLabel.isNotEmpty ? '. $unreadLabel' : ''}',
      excludeSemantics: true,
      child: GestureDetector(
        key: ValueKey('market-conv-${c.key}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => onOpen(c),
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: a.line), boxShadow: a.cardShadow),
          child: Row(children: [
            if (images.isNotEmpty)
              ClipRRect(borderRadius: BorderRadius.circular(12), child: SizedBox(width: 48, height: 48, child: marketImage(images.first, fallback: thumbFallback)))
            else
              thumbFallback,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle)),
                  const SizedBox(width: 8),
                  Text(
                    inboxTimeLabel(c.last.createdAt, now),
                    style: px(12, weight: c.unread > 0 ? FontWeight.w700 : FontWeight.w400, color: c.unread > 0 ? a.greenInk : a.inkFaint, height: 16 / 12),
                  ),
                ]),
                Text.rich(
                  TextSpan(children: [
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: Padding(
                        padding: const EdgeInsetsDirectional.only(end: 6),
                        child: _RoleTag(roleLabel),
                      ),
                    ),
                    TextSpan(text: who),
                  ]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: px(12, color: a.inkSoft, height: 16 / 12),
                ),
                const SizedBox(height: 2),
                Row(children: [
                  Expanded(
                    child: Text(
                      '${mine ? '${tr('chat_you', 'Siz')}: ' : ''}$preview',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: px(14, weight: c.unread > 0 ? FontWeight.w700 : FontWeight.w400, color: c.unread > 0 ? a.ink : a.inkSoft, height: 20 / 14),
                    ),
                  ),
                  if (c.unread > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      key: const ValueKey('market-unread-badge'),
                      constraints: const BoxConstraints(minWidth: 20),
                      height: 20,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.green2, borderRadius: BorderRadius.circular(999)),
                      child: Text(c.unread > 99 ? '99+' : '${c.unread}', style: px(12, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 1)),
                    ),
                  ],
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `.a-rank-tag` with `padding: 0 6px` on `--a-surface-soft`.
class _RoleTag extends StatelessWidget {
  const _RoleTag(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ARankTagBoxPadded(text, background: a.surfaceSoft, color: a.inkSoft);
  }
}

/// `.a-rank-tag` with the inline `padding: '0 6px'`.
class ARankTagBoxPadded extends StatelessWidget {
  const ARankTagBoxPadded(this.text, {super.key, required this.background, required this.color});
  final String text;
  final Color background;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Text(text, maxLines: 1, softWrap: false, style: px(10.5, weight: FontWeight.w800, color: color)),
      );
}
