// Ported from: src/hooks/{useAuth,useChildren,useSubscription,useDisabledTools,useAppSettings}.ts (the values the
//              programme tools read), src/store/userStore.ts (lifeStage, language), src/lib/native.ts (nativeShare,
//              hapticFeedback), src/lib/local-notification-scheduler.ts (setLocalNotifications as the programme tools
//              call it), src/lib/nap-alerts.ts (requestNapAlertPermission), src/lib/analytics.ts (logToolUsed),
//              src/lib/i18n.ts (getLocaleTag date formatting through toLocaleDateString / toLocaleTimeString)
//
// Seams shared by the three programme tools (sleep training, weaning, Tərbiyə): one input record built from the app
// stores ([programmeInputsProvider]), the local-notification scheduler (phase 9: [programmeNotificationsProvider],
// no-op default), the share sheet, haptics, analytics and the Intl date formats. Tests override these providers.
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/app_languages.dart' show appLanguage;
import '../../../core/i18n/date_utils.dart' show formatDatePattern, formatIntlDateTemplate;
import '../../../core/i18n/generated/intl_data.g.dart' show kDateTemplates;
import '../../../core/i18n/language_controller.dart' show disabledToolsProvider;
import '../../../domain/js_compat.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../native/purchases/purchases.dart' show subscriptionProvider;
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../state/user_store.dart';
import 'package:material_ui/material_ui.dart' show MaterialLocalizations;

import '../../../shell/shell.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, showShadDialog;
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show Child;
import '../baby_tracker/baby_dates.g.dart' show kBabyWeekdayShort;

/// A child as the programme tools read it (`user_children` row / `partner_children_v1` row).
@immutable
class ProgrammeChild {
  const ProgrammeChild({this.id, this.name, this.birthDate, this.dueDate, this.gender, this.countryCode});
  final String? id;
  final String? name;

  /// `YYYY-MM-DD` or null.
  final String? birthDate;

  /// Original due date (corrected age of a preterm baby).
  final String? dueDate;

  /// 'boy' | 'girl' | 'unknown'
  final String? gender;
  final String? countryCode;
}

/// Everything the programme tools read from the app stores.
@immutable
class ProgrammeInputs {
  const ProgrammeInputs({
    this.userId,
    this.lifeStage,
    this.language = 'az',
    this.children = const [],
    this.selectedChild,
    this.isPremium = false,
    this.premiumLoading = false,
    this.profileUserId,
    this.linkedPartnerId,
    this.profileCountryCode,
    this.disabledTools = const [],
    this.weaningSetting,
    this.parentingSetting,
  });

  /// `useAuth().user?.id`.
  final String? userId;

  /// `useUserStore().lifeStage`.
  final String? lifeStage;

  /// `useUserStore().language`.
  final String language;

  /// `useChildren().children`.
  final List<ProgrammeChild> children;

  /// `useChildren().selectedChild`.
  final ProgrammeChild? selectedChild;
  final bool isPremium;

  /// `useSubscription().loading`.
  final bool premiumLoading;

  /// `profile.user_id` / `profile.linked_partner_id`.
  final String? profileUserId;
  final String? linkedPartnerId;

  /// `profile.country_code`.
  final String? profileCountryCode;

  /// `useDisabledTools().disabledTools`.
  final List<String> disabledTools;

  /// `useAppSetting('weaning_tool')` / `useAppSetting('parenting_tool')` (null while loading or missing).
  final Object? weaningSetting;
  final Object? parentingSetting;

  /// `selectedChild ?? children[0] ?? null`.
  ProgrammeChild? get child => selectedChild ?? (children.isEmpty ? null : children.first);

  bool isToolDisabled(String id) => disabledTools.contains(id);
}

String? _date(String? s) => s == null || s.isEmpty ? null : s;

final programmeInputsProvider = Provider.autoDispose<ProgrammeInputs>((ref) {
  final store = ref.watch(userStoreProvider);
  final profile = ref.watch(authProfileProvider);
  final kids = ref.watch(childrenProvider);
  final sub = ref.watch(subscriptionProvider);
  ProgrammeChild map(Child c) => ProgrammeChild(id: c.id, name: c.name, birthDate: _date(c.birthDate), dueDate: _date(c.dueDate), gender: c.gender, countryCode: c.countryCode);
  return ProgrammeInputs(
    userId: ref.watch(authUserProvider)?.id,
    lifeStage: store.lifeStage,
    language: store.language,
    children: [for (final c in kids.children) map(c)],
    selectedChild: kids.selectedChild == null ? null : map(kids.selectedChild!),
    isPremium: sub.isPremium,
    premiumLoading: sub.loading,
    profileUserId: profile?.userId,
    linkedPartnerId: profile?.linkedPartnerId,
    profileCountryCode: profile?.countryCode,
    disabledTools: ref.watch(disabledToolsProvider),
    weaningSetting: ref.watch(appSettingProvider('weaning_tool')),
    parentingSetting: ref.watch(appSettingProvider('parenting_tool')),
  );
}, name: 'programmeInputsProvider');

// ── Local notifications (phase 9) ──────────────────────────────────────────────────────────────

/// `setLocalNotifications(namespace, items, { ask, cancelIds })` and the permission prompt of the nap alerts, as the
/// programme tools use the central local-notification scheduler. Ids: nap alerts 880001–880003 (`nap`), weaning
/// 881100–881111 (`weaning`), Tərbiyə 882200–882207 (`parenting`).
abstract interface class ProgrammeNotifications {
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []});

  /// `requestNapAlertPermission()`: true when notifications may be shown.
  Future<bool> requestPermission();
}

/// Until the central scheduler exists (phase 9): nothing is scheduled (web behaviour).
class NoopProgrammeNotifications implements ProgrammeNotifications {
  const NoopProgrammeNotifications();
  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) async {}
  @override
  Future<bool> requestPermission() async => false;
}

final programmeNotificationsProvider =
    Provider<ProgrammeNotifications>((ref) => const NoopProgrammeNotifications(), name: 'programmeNotificationsProvider');

// ── Share sheet, haptics, analytics ────────────────────────────────────────────────────────────

/// `nativeShare({ title, text })` → shared.
typedef ProgrammeShare = Future<bool> Function({required String title, required String text});

final programmeShareProvider = Provider<ProgrammeShare>((ref) => ({required title, required text}) async {
      try {
        final result = await SharePlus.instance.share(ShareParams(text: text, title: title, subject: title));
        return result.status == ShareResultStatus.success;
      } catch (_) {
        return false;
      }
    });

/// `hapticFeedback.light()`.
final programmeHapticProvider = Provider<Future<void> Function()>((ref) => HapticFeedback.lightImpact);

/// `analytics.logToolUsed(toolId, action, itemId)`.
typedef ProgrammeTrack = void Function(String toolId, String action, [String? itemId]);

final programmeTrackProvider = Provider<ProgrammeTrack>((ref) {
  final sink = ref.watch(analyticsSinkProvider);
  return (toolId, action, [itemId]) {
    try {
      sink.logEvent('tool_used', {'tool_id': toolId, 'action': action, 'item_id': ?itemId});
    } catch (_) {}
  };
});

// ── Navigation ─────────────────────────────────────────────────────────────────────────────────

/// `window.dispatchEvent(PUSH_NAV_EVENT, { tool })` and `openParentingTool(target)` from inside the tools.
class ProgrammeNav {
  const ProgrammeNav({required this.openTool, required this.openParenting});
  final void Function(String toolId) openTool;

  /// The mother's tool or (partner role) the partner's screen, on [target].
  final void Function(ParentingTarget? target) openParenting;
}

final programmeNavProvider = Provider<ProgrammeNav>((ref) => ProgrammeNav(
      openTool: (id) => ref.read(shellProvider.notifier).dispatchPushEvent(PushNavIntent(tool: id)),
      openParenting: (t) => ref.read(shellProvider.notifier).openParentingTool(t),
    ));

/// The pending Tərbiyə target (`peekParentingTarget` / `setParentingTarget` / `clearParentingTarget`).
final programmeParentingTargetProvider = Provider<ParentingTargetStore>((ref) => ref.watch(parentingTargetStoreProvider));

/// Android back inside a tool (`pushBackHandler`): returns the release function.
final programmeBackProvider = Provider<VoidCallback Function(bool Function() handler)>((ref) {
  final back = ref.watch(backDispatcherProvider);
  return (handler) => back.push(handler, BackLayer.screen);
});

/// `confirm(message)` (window.confirm).
final programmeConfirmProvider = Provider<Future<bool> Function(BuildContext context, String message)>((ref) => (context, message) async {
      final ok = await showShadDialog<bool>(
        context,
        builder: (dialog) => ShadDialogFrame(radius: 8, inset: 16, children: [
          Text(message, style: const TextStyle(fontSize: 15, height: 1.45)),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            // The system dialog's own (OS-localized) labels.
            ShadButton(
                variant: ShadButtonVariant.outline,
                onPressed: () => Navigator.of(dialog).pop(false),
                child: Text(MaterialLocalizations.of(dialog).cancelButtonLabel)),
            const SizedBox(width: 8),
            ShadButton(onPressed: () => Navigator.of(dialog).pop(true), child: Text(MaterialLocalizations.of(dialog).okButtonLabel)),
          ]),
        ]),
      );
      return ok == true;
    });

// ── Dates in the app language (Intl) ──────────────────────────────────────────────────────────

String _intlLocale(String language) => appLanguage(language).intlLocale;

String _withLatin(DateFormat f, DateTime d) => (f..useNativeDigits = false).format(d);

/// `date.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long' })`.
String localeDayMonth(DateTime d, String language) {
  if (kDateTemplates[language]?['dm'] != null) return formatIntlDateTemplate(language, 'dm', d);
  try {
    return _withLatin(DateFormat.MMMMd(_intlLocale(language)), d);
  } catch (_) {
    return '${d.day}.${pad2(d.month)}';
  }
}

/// `toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })`.
String localeDayMonthYear(DateTime d, String language) {
  if (kDateTemplates[language]?['dmy'] != null) return formatIntlDateTemplate(language, 'dmy', d);
  try {
    return _withLatin(DateFormat.yMMMMd(_intlLocale(language)), d);
  } catch (_) {
    return '${d.year}-${pad2(d.month)}-${pad2(d.day)}';
  }
}

/// `toLocaleDateString(locale, { day: 'numeric', month: 'short' })`.
String localeDayMonthShort(DateTime d, String language) {
  try {
    return _withLatin(DateFormat.MMMd(_intlLocale(language)), d);
  } catch (_) {
    return '${d.day}.${pad2(d.month)}';
  }
}

/// `toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })`: the locale's hour cycle with two-digit
/// hours.
String localeClock(DateTime d, String language) {
  try {
    final base = DateFormat.jm(_intlLocale(language)).pattern ?? 'HH:mm';
    final pattern = base.replaceAllMapped(RegExp(r'(?<![hHkK])([hHkK])(?![hHkK])'), (m) => '${m[1]}${m[1]}');
    return _withLatin(DateFormat(pattern, _intlLocale(language)), d);
  } catch (_) {
    return '${pad2(d.hour)}:${pad2(d.minute)}';
  }
}

/// `date-fns format(d, 'EEEEEE', { locale: getCurrentDateLocale() })`.
String localeWeekdayShort(DateTime d, String language) => (kBabyWeekdayShort[language] ?? kBabyWeekdayShort['az']!)[d.weekday % 7];

/// `date-fns format(d, 'd MMMM', { locale: getCurrentDateLocale() })`.
String dateFnsDayMonth(DateTime d, String language) {
  try {
    return formatDatePattern(d, 'd MMMM', language: language);
  } catch (_) {
    return '${d.day}.${pad2(d.month)}';
  }
}
