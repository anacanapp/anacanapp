// Ported from: src/components/AIChatScreen.tsx (hook calls: useSubscription().checkAndConsume, supabase.auth.getSession,
//              getBackendConfig, supabase.storage chat-media upload, useBabyLogs / useDailyLogs / useChildren /
//              useMealLogs / useWeightEntries / useKickSessions, WeaningAiCard / ParentingAiCard, PremiumModal,
//              <input type="file" accept="image/*">), src/hooks/useDynamicTools.ts (useAISuggestedQuestions),
//              src/components/partner/PartnerAIPremiumGate.tsx (usePartnerData → AIChatPartnerContext)
//
// Seams of the AI chat. Every provider has a working default over the ported core / features; the ones whose
// feature is not ported yet keep a neutral value (listed in docs/flutter/WIRING.md).
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../core/net/backend_client.dart' show BootstrapOpened;
import '../../core/net/backend_providers.dart';
import '../../domain/billing/usage_limits.dart' show UsageDecision;
import '../../native/purchases/subscription.dart' show subscriptionUsageProvider;
import '../../state/user_store.dart';
import '../baby/hooks/use_baby_logs.dart' show babyLogsProvider;
import '../baby/hooks/use_children.dart' show childrenProvider, getChildAge;
import '../home/data/daily_logs.dart' show dailyLogsProvider;
import '../premium/premium_modal.dart' show showPremiumModal;
import 'ai_chat_logic.dart';

/// `getBackendConfig()`: url + publishable key of the admitted backend (null before startup opened it).
final aiChatBackendProvider = Provider<({String url, String publishableKey})?>((ref) {
  final result = ref.watch(backendBootstrapProvider).value;
  return result is BootstrapOpened ? (url: result.backend.url, publishableKey: result.backend.publishableKey) : null;
});

/// `supabase.auth.getSession()` → `session.access_token` (refreshed first when it has expired, as supabase-js
/// does inside getSession).
final aiChatAccessTokenProvider = Provider<Future<String?> Function()>((ref) {
  return () async {
    final auth = ref.read(supabaseClientProvider).auth;
    var session = auth.currentSession;
    if (session != null && session.isExpired) {
      try {
        session = (await auth.refreshSession()).session ?? auth.currentSession;
      } catch (_) {
        session = auth.currentSession;
      }
    }
    final token = session?.accessToken;
    return token == null || token.isEmpty ? null : token;
  };
});

/// Plain http client for the streaming request (supabase `functions.invoke` buffers the whole answer).
final aiChatHttpClientProvider = Provider<http.Client>((ref) {
  final client = http.Client();
  ref.onDispose(client.close);
  return client;
});

/// `checkAndConsume('ai_chat')`.
final aiChatConsumeProvider = Provider<Future<UsageDecision> Function()>((ref) {
  return () => ref.read(subscriptionUsageProvider).checkAndConsume('ai_chat');
});

/// `supabase.storage.from('chat-media').upload(path, blob, { contentType: 'image/jpeg' })`: the path, or null.
final aiChatUploadProvider = Provider<Future<String?> Function(String path, Uint8List bytes)>((ref) {
  return (path, bytes) async {
    final r = await ref.read(dbProvider).upload('chat-media', path, bytes, contentType: 'image/jpeg');
    return r.ok ? path : null;
  };
});

/// A picked photo, already reduced to ≤ 1280 px JPEG 0.85 (`compressImageForAI`). [originalBytes] is the size
/// the 15 MB limit is checked against.
class AiPickedImage {
  const AiPickedImage({required this.bytes, required this.originalBytes, this.mimeType = 'image/jpeg'});
  final Uint8List bytes;
  final int originalBytes;
  final String mimeType;
}

/// The file input: image_picker resizes on the device (maxWidth/maxHeight 1280, quality 85).
final aiImagePickerProvider = Provider<Future<AiPickedImage?> Function()>((ref) {
  return () async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1280, maxHeight: 1280, imageQuality: 85);
    if (file == null) return null;
    final mime = file.mimeType ?? 'image/jpeg';
    final bytes = await file.readAsBytes();
    return AiPickedImage(bytes: bytes, originalBytes: bytes.length, mimeType: mime);
  };
});

/// `<PremiumModal isOpen feature="ai_chat" />`.
final aiPremiumModalProvider = Provider<Future<void> Function(BuildContext context, {String? analyticsSource})>((ref) {
  return (context, {analyticsSource}) => showPremiumModal(context, feature: 'ai_chat', analyticsSource: analyticsSource);
});

/// `useMealLogs().todayLogs` (meal_type, food_name, calories). Not ported yet (nutrition tool): empty.
final aiMotherMealsProvider = Provider.autoDispose<List<Map<String, dynamic>>>((ref) => const []);

/// `useWeightEntries().entries` newest first (weight). Not ported yet (weight tool): empty.
final aiWeightEntriesProvider = Provider.autoDispose<List<Map<String, dynamic>>>((ref) => const []);

/// `useKickSessions().todaySessions` (kick_count, duration_seconds). Not ported yet (kick counter): empty.
final aiKickSessionsProvider = Provider.autoDispose<List<Map<String, dynamic>>>((ref) => const []);

/// The woman's context of the request (today's baby logs, daily log, selected child, meals, weight, kicks).
final aiWomanContextProvider = Provider.autoDispose<AiWomanContext>((ref) {
  final child = ref.watch(childrenProvider).selectedChild;
  return AiWomanContext(
    selectedChild: child,
    childAge: child == null ? null : getChildAge(child),
    motherTodayLog: ref.watch(dailyLogsProvider).todayLog,
    babyTodayLogs: [for (final l in ref.watch(babyLogsProvider).todayLogs) l.toRow()],
    motherMeals: ref.watch(aiMotherMealsProvider),
    weightEntries: ref.watch(aiWeightEntriesProvider),
    kickSessions: ref.watch(aiKickSessionsProvider),
  );
});

/// The partner's view of the woman (`usePartnerData()`): stage, name, dates and sharing. Not ported yet
/// (partner feature): no profile → Ata AI talks about stage `bump` with no shared data.
class AiPartnerSource {
  const AiPartnerSource({this.lifeStage, this.name, this.dueDate, this.babyName, this.babyBirthDate, this.lastPeriodDate, this.cycleLength, this.shareCycle = false, this.pregnancyWeek = 0});
  final String? lifeStage;
  final String? name;
  final String? dueDate;
  final String? babyName;
  final String? babyBirthDate;
  final String? lastPeriodDate;
  final int? cycleLength;
  final bool shareCycle;

  /// `getPregnancyWeek()` (0 when unknown).
  final int pregnancyWeek;
}

final aiPartnerSourceProvider = Provider<AiPartnerSource>((ref) => const AiPartnerSource());

/// PartnerAIPremiumGate's `partnerContext`: the woman's stage and only what she shares (cycle dates need
/// share_cycle).
AiPartnerContext partnerContextFrom(AiPartnerSource p) {
  final stage = p.lifeStage;
  return AiPartnerContext(
    lifeStage: stage == 'flow' || stage == 'mommy' ? stage! : 'bump',
    pregnancyWeek: stage == 'bump' && p.pregnancyWeek != 0 ? p.pregnancyWeek : null,
    womanName: p.name,
    dueDate: p.dueDate,
    babyName: p.babyName,
    babyBirthDate: p.babyBirthDate,
    lastPeriodDate: stage == 'flow' && !p.shareCycle ? null : p.lastPeriodDate,
    cycleLength: p.cycleLength,
  );
}

/// The tool card under an answer: `<WeaningAiCard />` for a weaning question (mother persona,
/// `isWeaningQuestion`), else `<ParentingAiCard question partner />`. Null = no card (tools not ported yet).
typedef AiAnswerCardBuilder = Widget? Function(BuildContext context, {required String question, required AiPartnerContext? partner});

final aiAnswerCardProvider = Provider<AiAnswerCardBuilder?>((ref) => null);

/// `ai_suggested_questions` rows (active, stage, user type, by sort_order).
final aiSuggestedQuestionsFetcherProvider = Provider<Future<List<Map<String, dynamic>>> Function(String lifeStage, String userType)>((ref) {
  return (lifeStage, userType) async => List<Map<String, dynamic>>.from(await ref
      .read(dbProvider)
      .from('ai_suggested_questions')
      .select()
      .eq('is_active', true)
      .eq('life_stage', lifeStage)
      .eq('user_type', userType)
      .order('sort_order'));
});

/// `useAISuggestedQuestions(lifeStage, userType)` — key `['ai-suggested-questions', lifeStage, userType, language]`.
final aiSuggestedQuestionsQuery = queryProviderFamily<List<Map<String, dynamic>>, (String, String)>((ref, arg) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['ai-suggested-questions', arg.$1, arg.$2, language],
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(aiSuggestedQuestionsFetcherProvider)(arg.$1, arg.$2), language, const ['question']),
  );
});

/// A prompt handed to the AI tab (`/ai-chat?prompt=` of PeriodDelayBanner): put into the input once.
final aiChatPendingPromptProvider = NotifierProvider<AiChatPendingPrompt, String?>(AiChatPendingPrompt.new);

class AiChatPendingPrompt extends Notifier<String?> {
  @override
  String? build() => null;
  void set(String? prompt) => state = prompt;

  /// Returns the prompt and clears it.
  String? take() {
    final p = state;
    if (p != null) state = null;
    return p;
  }
}
