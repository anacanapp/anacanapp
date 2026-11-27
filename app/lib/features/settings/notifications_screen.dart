// Ported from: src/components/NotificationsScreen.tsx
//
// Inbox with filters (all / community / system). A row expands in place (and is marked read); community rows get
// a separate "open" action with the exact target from `action_data`; moderation rows open moderation history.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'copy/feature_copy.dart';
import 'data/notifications.dart';
import 'ui/settings_ui.dart';

/// `NotificationCommunityTarget`.
class NotificationCommunityTarget {
  const NotificationCommunityTarget({this.postId, this.commentId, this.storyId, this.userId, this.groupId});
  final String? postId;
  final String? commentId;
  final String? storyId;
  final String? userId;
  final String? groupId;

  @override
  bool operator ==(Object other) =>
      other is NotificationCommunityTarget && other.postId == postId && other.commentId == commentId && other.storyId == storyId && other.userId == userId && other.groupId == groupId;
  @override
  int get hashCode => Object.hash(postId, commentId, storyId, userId, groupId);
  @override
  String toString() => 'Target(post: $postId, comment: $commentId, story: $storyId, user: $userId, group: $groupId)';
}

const List<String> kCommunityTypes = <String>[
  'community_like', 'community_comment', 'community_reply', 'comment_like', 'story_like', 'story_reply',
  'community_follow', 'group_message', 'group_invite', 'group_join_request', 'community_moderation',
];

enum NotificationFilter { all, community, system }

/// The exact community target of a notification (`handleNotificationClick`).
NotificationCommunityTarget communityTargetOf(AppNotification n) {
  final d = n.actionData;
  String? s(String k) => d[k] is String ? d[k] as String : null;
  final type = n.actionType ?? n.type;
  if (const ['group_message', 'group_invite', 'group_join_request'].contains(type)) return NotificationCommunityTarget(groupId: s('groupId'));
  if (type == 'community_follow') return NotificationCommunityTarget(userId: s('userId'));
  if (type == 'story_like' || type == 'story_reply') return NotificationCommunityTarget(storyId: s('storyId'));
  return NotificationCommunityTarget(postId: s('postId'), commentId: s('commentId'));
}

/// `formatTime(created_at)`.
String formatNotificationTime(String iso, {DateTime? now}) {
  final date = DateTime.tryParse(iso);
  if (date == null) return '';
  final diff = (now ?? DateTime.now()).difference(date);
  final mins = diff.inMinutes;
  final hours = diff.inHours;
  final days = diff.inDays;
  if (mins < 1) return tr('notificationsscreen_i_ndice_3c9745', 'İndicə');
  if (mins < 60) return '$mins ${tr('notificationsscreen_mins', 'dəq')}';
  if (hours < 24) return '$hours ${tr('notificationsscreen_hours', 'saat')}';
  if (days == 1) return tr('notificationsscreen_dunen_52b701', 'Dünən');
  try {
    return DateFormat.MMMd(appLanguage(currentLanguage()).intlLocale).format(date.toLocal());
  } catch (_) {
    return DateFormat.MMMd('en_US').format(date.toLocal());
  }
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key, required this.onBack, this.onNavigateToCommunity, this.onNavigateToModeration});
  final VoidCallback onBack;
  final void Function(NotificationCommunityTarget? target)? onNavigateToCommunity;
  final VoidCallback? onNavigateToModeration;
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  NotificationFilter _filter = NotificationFilter.all;
  final Set<String> _expanded = <String>{};

  NotificationsActions get _actions => ref.read(notificationsActionsProvider);

  void _expand(AppNotification n) {
    if (!n.isRead) unawaited(_actions.markAsRead(n.id));
    setState(() => _expanded.contains(n.id) ? _expanded.remove(n.id) : _expanded.add(n.id));
  }

  void _openCommunity(AppNotification n) {
    if (!n.isRead) unawaited(_actions.markAsRead(n.id));
    if (!kCommunityTypes.contains(n.type) || widget.onNavigateToCommunity == null) return;
    widget.onNavigateToCommunity!(communityTargetOf(n));
  }

  (AIconData, Color, Color) _icon(String type) {
    final a = context.a;
    return switch (type) {
      'community_like' || 'comment_like' => (AIcons.heart, a.pink1, a.pinkInk),
      'community_comment' => (AIcons.messageCircle, a.blue1, a.blueInk),
      'community_reply' => (AIcons.reply, a.lav1, a.lavInk),
      'story_like' => (AIcons.heart, a.pink1, a.pinkInk),
      'story_reply' => (AIcons.reply, a.lav1, a.lavInk),
      'community_follow' => (AIcons.userPlus, a.green1, a.greenInk),
      'reminder' => (AIcons.bell, a.blue1, a.blueInk),
      'appointment' => (AIcons.calendar, a.lav1, a.lavInk),
      'tip' => (AIcons.pill, a.green1, a.greenInk),
      'partner' => (AIcons.heart, a.pink1, a.pinkInk),
      'achievement' => (AIcons.gift, a.yellow1, a.yellowInk),
      'push' || 'scheduled' => (AIcons.megaphone, a.peach1, a.accentInk),
      _ => (AIcons.bell, a.surfaceSoft, a.inkSoft),
    };
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final q = ref.watch(notificationsQuery);
    final all = q.data ?? const <AppNotification>[];
    final unread = all.where((n) => !n.isRead).length;
    final list = all.where((n) => switch (_filter) {
          NotificationFilter.community => kCommunityTypes.contains(n.type),
          NotificationFilter.system => !kCommunityTypes.contains(n.type),
          NotificationFilter.all => true,
        }).toList();
    final filters = [
      (NotificationFilter.all, tr('notificationsscreen_hamisi_c73c4d', 'Hamısı')),
      (NotificationFilter.community, tr('notificationsscreen_cemiyyet_2dc44d', 'Cəmiyyət')),
      (NotificationFilter.system, tr('notificationsscreen_filter_system', 'Sistem')),
    ];
    Widget pill(String text, {required Color bg, Gradient? grad, required Color fg, AIconData? icon, VoidCallback? onTap, Key? key}) => GestureDetector(
          key: key,
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(color: grad == null ? bg : null, gradient: grad, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
              if (icon != null) ...<Widget>[AIcon(icon, size: 13, color: fg), const SizedBox(width: 4)],
              Text(text, style: px(12, weight: FontWeight.w700, color: fg)),
            ]),
          ),
        );

    Widget body;
    if (q.isLoading) {
      body = Padding(padding: const EdgeInsets.symmetric(vertical: 64), child: Center(child: ARingSpinner(size: 28, color: a.peach2)));
    } else if (list.isEmpty) {
      body = FadeRise(
        dy: 0,
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
          child: Column(children: <Widget>[
            Container(
              width: 64,
              height: 64,
              margin: const EdgeInsets.only(bottom: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
              child: AIcon(AIcons.bell, size: 26, color: a.inkFaint),
            ),
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('notificationsscreen_bildiris_yoxdur_6ccf4d', 'Bildiriş yoxdur'), style: context.aText.aListTitle)),
            Text(tr('notificationsscreen_yeni_bildirisler_burada_gorunecek_a0484a', 'Yeni bildirişlər burada görünəcək'), textAlign: TextAlign.center, style: context.aText.aListSub),
          ]),
        ),
      );
    } else {
      body = VGap(gap: 10, children: <Widget>[
        for (var i = 0; i < list.length; i++)
          () {
            final n = list[i];
            final (icon, bg, ink) = _icon(n.type);
            final community = kCommunityTypes.contains(n.type);
            final expanded = _expanded.contains(n.id);
            Widget row = AnimatedContainer(
              key: ValueKey<String>('notification-${n.id}'),
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(a.radiusMd),
                boxShadow: a.cardShadow,
                border: Border.all(color: n.isRead ? const Color(0x00000000) : a.peach2, width: 1.5),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                Semantics(
                  button: true,
                  label: n.title,
                  expanded: expanded,
                  excludeSemantics: false,
                  child: GestureDetector(
                    key: ValueKey<String>('notification-toggle-${n.id}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _expand(n),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
                        child: AIcon(icon, size: 17, color: ink),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Wrap(alignment: WrapAlignment.spaceBetween, spacing: 6, runSpacing: 6, children: <Widget>[
                            Text(n.title, style: px(15, weight: FontWeight.w700, color: n.isRead ? a.ink : a.accentInk, height: 1.4)),
                            Text(formatNotificationTime(n.createdAt), style: px(11, weight: FontWeight.w500, color: a.inkFaint)),
                          ]),
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              n.message,
                              key: ValueKey<String>('notification-message-${n.id}'),
                              maxLines: expanded ? null : 2,
                              overflow: expanded ? null : TextOverflow.ellipsis,
                              style: px(14, color: a.inkSoft, height: 1.625),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                              Text(expanded ? tr('notifications_collapse', 'Yığ') : tr('notifications_read_full', 'Tam mətni oxu'), style: px(12, weight: FontWeight.w700, color: a.accentInk)),
                              const SizedBox(width: 4),
                              Transform.rotate(angle: expanded ? 3.14159265 : 0, child: AIcon(AIcons.chevronDown, size: 14, color: a.accentInk)),
                            ]),
                          ),
                        ]),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 12),
                Row(children: <Widget>[
                  if (n.type == 'moderation_action' && widget.onNavigateToModeration != null)
                    AButton(
                      key: ValueKey<String>('notification-moderation-${n.id}'),
                      variant: AButtonVariant.pillSoft,
                      onPressed: () {
                        unawaited(_actions.markAsRead(n.id));
                        widget.onNavigateToModeration!();
                      },
                      child: Text(moderatorText('details')),
                    ),
                  if (community && widget.onNavigateToCommunity != null)
                    AButton(
                      key: ValueKey<String>('notification-open-${n.id}'),
                      variant: AButtonVariant.pillSoft,
                      onPressed: () => _openCommunity(n),
                      child: Text(n.type == 'community_follow' ? tr('community_view_profile', 'Profilə bax') : tr('notifications_open_content', 'Paylaşıma keç')),
                    ),
                  const Spacer(),
                  if (!n.isRead) ...<Widget>[
                    pill(tr('notificationsscreen_read', 'Oxundu'), key: ValueKey<String>('notification-read-${n.id}'), bg: a.peach1, fg: a.accentInk, onTap: () => unawaited(_actions.markAsRead(n.id))),
                    const SizedBox(width: 8),
                  ],
                  pill(tr('notificationsscreen_delete', 'Sil'), key: ValueKey<String>('notification-delete-${n.id}'), bg: a.peach1, grad: a.alertBg, fg: a.alertInk, icon: AIcons.trash2, onTap: () => unawaited(_actions.deleteNotification(n.id))),
                ]),
              ]),
            );
            if (i < 12) row = FadeRise(dy: 8, delay: Duration(milliseconds: (i * 30).clamp(0, 200)), child: row);
            return row;
          }(),
      ]);
    }

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ATopbar(
              onBack: widget.onBack,
              backScale: 0.9,
              eyebrow: unread > 0 ? '$unread ${tr('notificationsscreen_oxunmamis_8bfc41', 'oxunmamış')}' : null,
              title: tr('notificationsscreen_bildirisler_54eb88', 'Bildirişlər'),
              actions: <Widget>[
                if (unread > 0)
                  PressScale(
                    key: const ValueKey<String>('notifications-read-all'),
                    scale: 0.95,
                    onTap: () => unawaited(_actions.markAllAsRead()),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                        AIcon(AIcons.check, size: 12, strokeWidth: 2.5, color: a.accentInk),
                        const SizedBox(width: 4),
                        Text(tr('notificationsscreen_hamisini_oxu_29ceea', 'Hamısını oxu'), style: px(11, weight: FontWeight.w700, color: a.accentInk)),
                      ]),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                      for (var i = 0; i < filters.length; i++) ...<Widget>[
                        if (i > 0) const SizedBox(width: 2),
                        GestureDetector(
                          key: ValueKey<String>('notifications-filter-${filters[i].$1.name}'),
                          onTap: () => setState(() => _filter = filters[i].$1),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                            decoration: BoxDecoration(color: _filter == filters[i].$1 ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                            child: Text(filters[i].$2, style: px(11.5, weight: FontWeight.w700, color: _filter == filters[i].$1 ? a.accentInk : a.inkSoft)),
                          ),
                        ),
                      ],
                    ]),
                  ),
                ),
              ),
            ),
            body,
          ]),
        ),
      ),
    );
  }
}
