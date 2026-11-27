// Ported from: src/components/AIChatScreen.tsx (Message, AIChatPartnerContext, PARTNER_QUESTIONS, getWelcomeMessage,
//              the dr-anacan-chat request body, suggestedQuestions fallback)
//
// Pure parts of the AI chat: message model, welcome text, request body and the suggested-question fallback.
import 'dart:typed_data';

import '../../core/i18n/tr.dart';
import '../../domain/cycle/cycle_utils.dart' show getPhaseInfoForDate;
import '../baby/models/child.dart' show Child, ChildAge;
import 'copy/ai_copy.dart';

/// `Message` of the chat screen. [imageUrl] is the chat-media object path (legacy rows: a public URL);
/// [previewBytes] is the just-picked photo shown until the row is reloaded (React: a `blob:` URL).
class AiMessage {
  const AiMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.isStreaming = false,
    this.imageUrl,
    this.previewBytes,
  });

  final String id;

  /// 'user' | 'assistant'.
  final String role;
  final String content;
  final DateTime timestamp;
  final bool isStreaming;
  final String? imageUrl;
  final Uint8List? previewBytes;

  bool get isUser => role == 'user';

  AiMessage copyWith({String? content, bool? isStreaming}) => AiMessage(
        id: id,
        role: role,
        content: content ?? this.content,
        timestamp: timestamp,
        isStreaming: isStreaming ?? this.isStreaming,
        imageUrl: imageUrl,
        previewBytes: previewBytes,
      );
}

/// `AIChatPartnerContext`: the woman's context for the partner persona (Ata AI).
class AiPartnerContext {
  const AiPartnerContext({
    required this.lifeStage,
    this.pregnancyWeek,
    this.womanName,
    this.dueDate,
    this.babyName,
    this.babyBirthDate,
    this.lastPeriodDate,
    this.cycleLength,
  });

  /// 'flow' | 'bump' | 'mommy'.
  final String lifeStage;
  final int? pregnancyWeek;
  final String? womanName;
  final String? dueDate;
  final String? babyName;
  final String? babyBirthDate;
  final String? lastPeriodDate;
  final int? cycleLength;
}

const Map<String, List<String>> kPartnerQuestions = {
  'flow': ['ai_pq_flow_1', 'ai_pq_flow_2', 'ai_pq_support'],
  'bump': ['ai_pq_support', 'ai_pq_birth', 'ai_pq_bag'],
  'mommy': ['ai_pq_crying', 'ai_pq_night', 'ai_pq_postpartum'],
};

/// `getWelcomeMessage()`. [currentWeek] / [fruit] only for a known pregnancy.
String aiWelcomeMessage({
  required String? name,
  required bool partner,
  required String? lifeStage,
  required String language,
  required bool isMultiple,
  int? currentWeek,
  String? fruit,
}) {
  final userName = name != null && name.isNotEmpty ? ', $name' : '';
  if (partner) return aiFeature37Text('ai_partner_welcome').replaceFirst('{name}', userName);
  final hasPregnancy = currentWeek != null;
  if (language == 'en') {
    return switch (lifeStage) {
      'flow' => "Hello$userName. I'm Anacan.AI. I'm ready to professionally answer your questions about menstrual cycles, symptoms, and general health.",
      'bump' =>
        "Hello$userName. I'm Anacan.AI. ${hasPregnancy ? "You're currently in week $currentWeek of pregnancy; ${isMultiple ? 'your babies are' : 'your baby is'} about the size of a $fruit. " : ''}You can ask any questions about your pregnancy.",
      'mommy' => "Hello$userName. I'm Anacan.AI. I'm here to support you with questions about baby care, breastfeeding, sleep routines and postpartum recovery.",
      _ => "Hello$userName. I'm Anacan.AI. How can I help you?",
    };
  }
  switch (lifeStage) {
    case 'flow':
      return '${tr('aichat_welcome_flow_1', 'Salam')}$userName. ${tr('aichat_welcome_flow_2', 'Mən Anacan.AI. Menstrual tsikl, simptomlar və ümumi sağlamlıq üzrə suallarınıza peşəkar cavab verməyə hazıram.')}';
    case 'bump':
      final week = hasPregnancy
          ? (isMultiple
                  ? tr('aichat_welcome_bump_3_multiple', 'Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpələriniz təxminən {1} böyüklüyündədir. ')
                  : tr('aichat_welcome_bump_3', 'Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpəniz təxminən {1} böyüklüyündədir. '))
              .replaceFirst('{0}', '$currentWeek')
              .replaceFirst('{1}', fruit ?? '')
          : '';
      return '${tr('aichat_welcome_bump_1', 'Salam')}$userName. ${tr('aichat_welcome_bump_2', 'Mən Anacan.AI.')} $week${tr('aichat_welcome_bump_4', 'Hamiləlik dövrü ilə bağlı suallarınızı verə bilərsiniz.')}';
    case 'mommy':
      return '${tr('aichat_welcome_mommy_1', 'Salam')}$userName. ${tr('aichat_welcome_mommy_2', 'Mən Anacan.AI. Körpə baxımı, əmizdirmə, yuxu rejimi və doğuşdan sonrakı bərpa ilə bağlı suallarınıza dəstək olmağa hazıram.')}';
    default:
      return '${tr('aichat_welcome_default_1', 'Salam')}$userName. ${tr('aichat_welcome_default_2', 'Mən Anacan.AI. Sizə necə kömək edə bilərəm?')}';
  }
}

/// `suggestedQuestions`: the admin list, else the partner / stage fallback.
List<String> aiSuggestedQuestions({required List<String> dynamicQuestions, required AiPartnerContext? partner, required String? lifeStage}) {
  if (dynamicQuestions.isNotEmpty) return dynamicQuestions;
  if (partner != null) return [for (final k in kPartnerQuestions[partner.lifeStage] ?? const <String>[]) aiFeature37Text(k)];
  if (lifeStage == 'bump') {
    return [
      tr('aichatscreen_bu_hefte_korpem_nece_inkisaf_e_7ffbca', 'Bu həftə körpəm necə inkişaf edir?'),
      tr('aichatscreen_hamilelikde_hansi_qidalar_fayd_cfee1a', 'Hamiləlikdə hansı qidalar faydalıdır?'),
      tr('aichatscreen_urek_bulanmasina_qarsi_ne_ede__39caf3', 'Ürək bulanmasına qarşı nə edə bilərəm?'),
    ];
  }
  if (lifeStage == 'mommy') {
    return [
      tr('aichatscreen_korpemi_nece_duzgun_emizdirmel_05cf51', 'Körpəmi necə düzgün əmizdirməliyəm?'),
      tr('aichatscreen_yenidoganin_yuxu_qrafiki_nece__9e1277', 'Yenidoğanın yuxu qrafiki necə olmalıdır?'),
      tr('aichatscreen_korpem_niye_aglayir_b5dc07', 'Körpəm niyə ağlayır?'),
    ];
  }
  return [
    tr('aichatscreen_menstrual_tsiklim_haqqinda_mel_0616ab', 'Menstrual tsiklim haqqında məlumat ver'),
    tr('aichatscreen_pms_simptomlari_ile_nece_mubar_4c2325', 'PMS simptomları ilə necə mübarizə aparım?'),
    tr('aichatscreen_fertil_pencerem_ne_vaxtdir_7a0f65', 'Fertil pəncərəm nə vaxtdır?'),
  ];
}

/// `getChildAge(child)` as JSON (same keys and order as the React object).
Map<String, Object?> childAgeJson(ChildAge a) => {
      'days': a.days,
      'dayNumber': a.dayNumber,
      'weeks': a.weeks,
      'months': a.months,
      'years': a.years,
      'remainingMonths': a.remainingMonths,
      'remainingDays': a.remainingDays,
      'displayText': a.displayText,
      'correctedDays': a.correctedDays,
      'correctedDayNumber': a.correctedDayNumber,
      'correctedWeeks': a.correctedWeeks,
      'correctedMonths': a.correctedMonths,
      'correctedDisplayText': a.correctedDisplayText,
      'correctionApplied': a.correctionApplied,
      'isPremature': a.isPremature,
      'gestationalWeeksAtBirth': a.gestationalWeeksAtBirth,
      'gestationalExtraDays': a.gestationalExtraDays,
    };

/// What the woman's own assistant sends about her day (`useBabyLogs`, `useDailyLogs`, `useChildren`,
/// `useMealLogs`, `useWeightEntries`, `useKickSessions`).
class AiWomanContext {
  const AiWomanContext({
    this.selectedChild,
    this.childAge,
    this.motherTodayLog,
    this.babyTodayLogs = const [],
    this.motherMeals = const [],
    this.weightEntries = const [],
    this.kickSessions = const [],
  });

  final Child? selectedChild;
  final ChildAge? childAge;
  final Map<String, dynamic>? motherTodayLog;
  final List<Map<String, dynamic>> babyTodayLogs;
  final List<Map<String, dynamic>> motherMeals;

  /// Newest first (`weightEntries[0].weight`).
  final List<Map<String, dynamic>> weightEntries;
  final List<Map<String, dynamic>> kickSessions;
}

/// The user store / profile fields of the request.
class AiProfileInput {
  const AiProfileInput({
    this.name,
    this.dueDate,
    this.babyName,
    this.babyBirthDate,
    this.lastPeriodDate,
    required this.cycleLength,
    required this.periodLength,
    this.multiplesType,
    this.babyCount,
  });

  final String? name;

  /// `storedDateKey(...)` (YYYY-MM-DD) values.
  final String? dueDate;
  final String? babyName;
  final String? babyBirthDate;
  final String? lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final String? multiplesType;
  final int? babyCount;
}

String? _orUndefined(String? v) => v == null || v.isEmpty ? null : v;

/// JSON.stringify drops `undefined`: keys whose value is [_undefined] are left out.
const Object _undefined = Object();
Map<String, Object?> _clean(Map<String, Object?> m) => {
      for (final e in m.entries)
        if (!identical(e.value, _undefined)) e.key: e.value,
    };

Object? _u(Object? v) => v ?? _undefined;

/// `(l as any).<key>`: present keys only.
Object? _field(Map<String, dynamic> row, String key) => row.containsKey(key) ? row[key] : _undefined;

DateTime? _parseDay(String? key) {
  if (key == null) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(key);
  if (m == null) return DateTime.tryParse(key);
  return DateTime(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
}

/// The dr-anacan-chat request body.
Map<String, Object?> buildDrAnacanBody({
  required List<Map<String, String>> conversation,
  required String? lifeStage,
  required int? pregnancyWeek,
  required AiPartnerContext? partner,
  required String language,
  required AiProfileInput profile,
  AiWomanContext woman = const AiWomanContext(),
  String? imageBase64,
  DateTime? now,
}) {
  final lastPeriodDate = partner != null ? partner.lastPeriodDate : profile.lastPeriodDate;
  final cycleLength = partner != null ? (partner.cycleLength ?? 28) : profile.cycleLength;
  Map<String, Object?> cycle = const {};
  if (lifeStage == 'flow' && lastPeriodDate != null && lastPeriodDate.isNotEmpty) {
    try {
      final lpd = _parseDay(lastPeriodDate);
      if (lpd != null) {
        final info = getPhaseInfoForDate(now ?? DateTime.now(), lpd, cycleLength == 0 ? 28 : cycleLength, profile.periodLength == 0 ? 5 : profile.periodLength);
        cycle = {'cyclePhase': info.phase, 'cycleDay': info.dayInCycle};
      }
    } catch (_) {}
  }
  final child = woman.selectedChild;
  final log = woman.motherTodayLog;
  final userProfile = partner != null
      ? _clean({
          'name': _u(_orUndefined(profile.name)),
          'partnerName': _u(_orUndefined(partner.womanName)),
          'dueDate': _u(_orUndefined(partner.dueDate)),
          'babyName': _u(_orUndefined(partner.babyName)),
          'babyBirthDate': _u(_orUndefined(partner.babyBirthDate)),
          'lastPeriodDate': _u(_orUndefined(partner.lastPeriodDate)),
          'cycleLength': partner.cycleLength == null || partner.cycleLength == 0 ? _undefined : partner.cycleLength,
        })
      : _clean({
          'name': _u(_orUndefined(profile.name)),
          'dueDate': _u(profile.dueDate),
          'babyName': _u(_orUndefined(profile.babyName)),
          'babyBirthDate': _u(profile.babyBirthDate),
          'lastPeriodDate': _u(profile.lastPeriodDate),
          'cycleLength': profile.cycleLength,
          'multiplesType': _u(_orUndefined(profile.multiplesType)),
          'babyCount': profile.babyCount == null || profile.babyCount == 0 ? _undefined : profile.babyCount,
          'selectedChildDetails': child == null
              ? null
              : {
                  'name': child.name,
                  'gender': child.gender,
                  'birthDate': child.birthDate,
                  'exactAge': woman.childAge == null ? null : childAgeJson(woman.childAge!),
                },
          'recentMotherLog': log == null ? null : _clean({'mood': _field(log, 'mood'), 'waterIntake': _field(log, 'water_intake'), 'symptoms': _field(log, 'symptoms')}),
          'recentBabyLogs': [
            for (final l in woman.babyTodayLogs)
              _clean({
                'type': _field(l, 'log_type'),
                'amount': _field(l, 'amount_ml'),
                'food': _field(l, 'food_name'),
                'duration': _field(l, 'duration_mins'),
                'quality': _field(l, 'sleep_quality'),
                'poop': _field(l, 'poop_type'),
                'feedType': _field(l, 'feed_type'),
                'diaperType': _field(l, 'diaper_type'),
                'notes': _field(l, 'notes'),
                'startTime': _field(l, 'start_time'),
              }),
          ],
          'recentMotherMeals': [
            for (final m in woman.motherMeals) _clean({'type': _field(m, 'meal_type'), 'food': _field(m, 'food_name'), 'calories': _field(m, 'calories')}),
          ],
          'latestWeight': woman.weightEntries.isNotEmpty ? woman.weightEntries.first['weight'] : null,
          'todayKickSessions': [
            for (final k in woman.kickSessions) _clean({'kicks': _field(k, 'kick_count'), 'duration': _field(k, 'duration_seconds')}),
          ],
        });
  return _clean({
    'messages': conversation,
    'lifeStage': lifeStage == null || lifeStage.isEmpty ? 'bump' : lifeStage,
    'pregnancyWeek': _u(partner != null ? partner.pregnancyWeek : pregnancyWeek),
    'isPartner': partner != null,
    'stream': true,
    'language': language.isEmpty ? 'az' : language,
    'imageBase64': ?imageBase64,
    if (imageBase64 != null) 'imageMime': 'image/jpeg',
    ...cycle,
    'userProfile': userProfile,
  });
}
