// Ported from: src/types/anacan.ts
//
// Core app model types. JSON keys are the TypeScript field names (these are app-side shapes, camelCase; the
// database rows they are built from live with each feature). Dates serialize as ISO strings.

import '../js_compat.dart';
import '../pregnancy/fetal_size.dart';
import 'data/anacan_data.g.dart';

/// Life stage of the account.
enum LifeStage {
  flow('flow'),
  bump('bump'),
  mommy('mommy'),
  partner('partner');

  const LifeStage(this.value);
  final String value;

  static LifeStage? fromJson(Object? v) {
    for (final s in values) {
      if (s.value == v) return s;
    }
    return null;
  }

  String toJson() => value;
}

enum UserRole {
  woman('woman'),
  partner('partner');

  const UserRole(this.value);
  final String value;

  static UserRole? fromJson(Object? v) {
    for (final s in values) {
      if (s.value == v) return s;
    }
    return null;
  }

  String toJson() => value;
}

/// 'natural' | 'cesarean' | 'assisted'
typedef DeliveryType = String;

DateTime _date(Object? v) => jsDate(v) ?? DateTime.fromMillisecondsSinceEpoch(0);
DateTime? _dateOrNull(Object? v) => v == null ? null : jsDate(v);
String _iso(DateTime d) => jsToIsoString(d);

class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.lifeStage,
    this.avatarUrl,
    this.partnerCode,
    this.linkedPartnerId,
    required this.createdAt,
  });
  final String id;
  final String email;
  final String name;
  final UserRole role;
  final LifeStage lifeStage;
  final String? avatarUrl;
  final String? partnerCode;
  final String? linkedPartnerId;
  final DateTime createdAt;

  factory User.fromJson(Map<String, Object?> j) => User(
        id: j['id']! as String,
        email: j['email']! as String,
        name: j['name']! as String,
        role: UserRole.fromJson(j['role'])!,
        lifeStage: LifeStage.fromJson(j['lifeStage'])!,
        avatarUrl: j['avatarUrl'] as String?,
        partnerCode: j['partnerCode'] as String?,
        linkedPartnerId: j['linkedPartnerId'] as String?,
        createdAt: _date(j['createdAt']),
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role.toJson(),
        'lifeStage': lifeStage.toJson(),
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (partnerCode != null) 'partnerCode': partnerCode,
        if (linkedPartnerId != null) 'linkedPartnerId': linkedPartnerId,
        'createdAt': _iso(createdAt),
      };
}

class CycleData {
  const CycleData({
    required this.lastPeriodDate,
    required this.cycleLength,
    required this.periodLength,
    required this.currentDay,
    required this.phase,
    required this.fertileWindowStart,
    required this.fertileWindowEnd,
    required this.nextPeriodDate,
  });
  final DateTime lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final int currentDay;

  /// 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
  final String phase;
  final DateTime fertileWindowStart;
  final DateTime fertileWindowEnd;
  final DateTime nextPeriodDate;

  factory CycleData.fromJson(Map<String, Object?> j) {
    final fw = (j['fertileWindow']! as Map).cast<String, Object?>();
    return CycleData(
      lastPeriodDate: _date(j['lastPeriodDate']),
      cycleLength: (j['cycleLength']! as num).toInt(),
      periodLength: (j['periodLength']! as num).toInt(),
      currentDay: (j['currentDay']! as num).toInt(),
      phase: j['phase']! as String,
      fertileWindowStart: _date(fw['start']),
      fertileWindowEnd: _date(fw['end']),
      nextPeriodDate: _date(j['nextPeriodDate']),
    );
  }

  Map<String, Object?> toJson() => {
        'lastPeriodDate': _iso(lastPeriodDate),
        'cycleLength': cycleLength,
        'periodLength': periodLength,
        'currentDay': currentDay,
        'phase': phase,
        'fertileWindow': {'start': _iso(fertileWindowStart), 'end': _iso(fertileWindowEnd)},
        'nextPeriodDate': _iso(nextPeriodDate),
      };
}

class BabySize {
  const BabySize({required this.fruit, required this.lengthCm, required this.weightG});
  final String fruit;
  final double lengthCm;
  final double weightG;

  factory BabySize.fromJson(Map<String, Object?> j) =>
      BabySize(fruit: j['fruit']! as String, lengthCm: (j['lengthCm']! as num).toDouble(), weightG: (j['weightG']! as num).toDouble());
  Map<String, Object?> toJson() => {'fruit': fruit, 'lengthCm': lengthCm, 'weightG': weightG};
}

class PregnancyData {
  const PregnancyData({
    required this.dueDate,
    required this.lastPeriodDate,
    required this.currentWeek,
    required this.currentDay,
    required this.trimester,
    required this.babySize,
  });
  final DateTime dueDate;
  final DateTime lastPeriodDate;
  final int currentWeek;
  final int currentDay;

  /// 1 | 2 | 3
  final int trimester;
  final BabySize babySize;

  factory PregnancyData.fromJson(Map<String, Object?> j) => PregnancyData(
        dueDate: _date(j['dueDate']),
        lastPeriodDate: _date(j['lastPeriodDate']),
        currentWeek: (j['currentWeek']! as num).toInt(),
        currentDay: (j['currentDay']! as num).toInt(),
        trimester: (j['trimester']! as num).toInt(),
        babySize: BabySize.fromJson((j['babySize']! as Map).cast<String, Object?>()),
      );

  Map<String, Object?> toJson() => {
        'dueDate': _iso(dueDate),
        'lastPeriodDate': _iso(lastPeriodDate),
        'currentWeek': currentWeek,
        'currentDay': currentDay,
        'trimester': trimester,
        'babySize': babySize.toJson(),
      };
}

class BabyData {
  const BabyData({
    required this.id,
    required this.name,
    required this.birthDate,
    required this.gender,
    required this.ageInDays,
    required this.ageInMonths,
    this.avatarUrl,
  });
  final String id;
  final String name;
  final DateTime birthDate;

  /// 'boy' | 'girl'
  final String gender;
  final int ageInDays;
  final int ageInMonths;
  final String? avatarUrl;

  factory BabyData.fromJson(Map<String, Object?> j) => BabyData(
        id: j['id']! as String,
        name: j['name']! as String,
        birthDate: _date(j['birthDate']),
        gender: j['gender']! as String,
        ageInDays: (j['ageInDays']! as num).toInt(),
        ageInMonths: (j['ageInMonths']! as num).toInt(),
        avatarUrl: j['avatarUrl'] as String?,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'birthDate': _iso(birthDate),
        'gender': gender,
        'ageInDays': ageInDays,
        'ageInMonths': ageInMonths,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      };
}

class PostpartumData {
  const PostpartumData({required this.birthDate, required this.daysSinceBirth, required this.week, required this.deliveryType});
  final DateTime birthDate;
  final int daysSinceBirth;
  final int week;
  final DeliveryType? deliveryType;

  factory PostpartumData.fromJson(Map<String, Object?> j) => PostpartumData(
        birthDate: _date(j['birthDate']),
        daysSinceBirth: (j['daysSinceBirth']! as num).toInt(),
        week: (j['week']! as num).toInt(),
        deliveryType: j['deliveryType'] as String?,
      );

  Map<String, Object?> toJson() => {'birthDate': _iso(birthDate), 'daysSinceBirth': daysSinceBirth, 'week': week, 'deliveryType': deliveryType};
}

class DailyLog {
  const DailyLog({
    required this.id,
    required this.userId,
    required this.date,
    this.mood,
    this.symptoms,
    this.waterIntake,
    this.temperature,
    this.notes,
    this.bleeding,
  });
  final String id;
  final String userId;
  final DateTime date;

  /// 1-5
  final int? mood;
  final List<String>? symptoms;
  final num? waterIntake;
  final num? temperature;
  final String? notes;

  /// 'light' | 'medium' | 'heavy' | 'spotting'
  final String? bleeding;

  factory DailyLog.fromJson(Map<String, Object?> j) => DailyLog(
        id: j['id']! as String,
        userId: j['userId']! as String,
        date: _date(j['date']),
        mood: (j['mood'] as num?)?.toInt(),
        symptoms: (j['symptoms'] as List?)?.cast<String>(),
        waterIntake: j['waterIntake'] as num?,
        temperature: j['temperature'] as num?,
        notes: j['notes'] as String?,
        bleeding: j['bleeding'] as String?,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'userId': userId,
        'date': _iso(date),
        if (mood != null) 'mood': mood,
        if (symptoms != null) 'symptoms': symptoms,
        if (waterIntake != null) 'waterIntake': waterIntake,
        if (temperature != null) 'temperature': temperature,
        if (notes != null) 'notes': notes,
        if (bleeding != null) 'bleeding': bleeding,
      };
}

class BabyLog {
  const BabyLog({
    required this.id,
    required this.babyId,
    required this.type,
    required this.startTime,
    this.endTime,
    this.feedSide,
    this.diaperType,
    this.notes,
  });
  final String id;
  final String babyId;

  /// 'sleep' | 'feed' | 'diaper'
  final String type;
  final DateTime startTime;
  final DateTime? endTime;

  /// 'left' | 'right' | 'bottle'
  final String? feedSide;

  /// 'wet' | 'dirty' | 'both'
  final String? diaperType;
  final String? notes;

  factory BabyLog.fromJson(Map<String, Object?> j) => BabyLog(
        id: j['id']! as String,
        babyId: j['babyId']! as String,
        type: j['type']! as String,
        startTime: _date(j['startTime']),
        endTime: _dateOrNull(j['endTime']),
        feedSide: j['feedSide'] as String?,
        diaperType: j['diaperType'] as String?,
        notes: j['notes'] as String?,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'babyId': babyId,
        'type': type,
        'startTime': _iso(startTime),
        if (endTime != null) 'endTime': _iso(endTime!),
        if (feedSide != null) 'feedSide': feedSide,
        if (diaperType != null) 'diaperType': diaperType,
        if (notes != null) 'notes': notes,
      };
}

class PartnerMission {
  const PartnerMission({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.completed,
    this.basedOn,
  });
  final String id;
  final String title;
  final String description;
  final String icon;
  final bool completed;

  /// Symptom that triggered this mission.
  final String? basedOn;

  factory PartnerMission.fromJson(Map<String, Object?> j) => PartnerMission(
        id: j['id']! as String,
        title: j['title']! as String,
        description: j['description']! as String,
        icon: j['icon']! as String,
        completed: j['completed'] == true,
        basedOn: j['basedOn'] as String?,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'icon': icon,
        'completed': completed,
        if (basedOn != null) 'basedOn': basedOn,
      };
}

class Tool {
  const Tool({required this.id, required this.name, required this.description, required this.icon, required this.route, required this.stages});
  final String id;
  final String name;
  final String description;
  final String icon;
  final String route;
  final List<LifeStage> stages;

  factory Tool.fromJson(Map<String, Object?> j) => Tool(
        id: j['id']! as String,
        name: j['name']! as String,
        description: j['description']! as String,
        icon: j['icon']! as String,
        route: j['route']! as String,
        stages: [for (final s in j['stages']! as List) ?LifeStage.fromJson(s)],
      );

  Map<String, Object?> toJson() =>
      {'id': id, 'name': name, 'description': description, 'icon': icon, 'route': route, 'stages': [for (final s in stages) s.toJson()]};
}

String _text(Object v, Tr tr) => v is Map ? tr(v['key'] as String, v['az'] as String) : v as String;

/// SYMPTOMS: id, translated label, icon.
List<({String id, String label, String icon})> symptoms({Tr tr = azTr}) =>
    [for (final s in symptomsData) (id: s['id']! as String, label: _text(s['label']!, tr), icon: s['icon']! as String)];

/// MOODS: value 1-5, translated label, emoji.
List<({int value, String label, String emoji})> moods({Tr tr = azTr}) =>
    [for (final m in moodsData) (value: (m['value']! as num).toInt(), label: _text(m['label']!, tr), emoji: m['emoji']! as String)];

/// FRUIT_SIZES: fallback size per completed week (4-42), fruit names translated where a UI key exists.
Map<int, ({String fruit, String emoji, double lengthCm, double weightG})> fruitSizes({Tr tr = azTr}) => {
      for (final e in fruitSizesData.entries)
        e.key: (
          fruit: _text(e.value['fruit']!, tr),
          emoji: e.value['emoji']! as String,
          lengthCm: (e.value['lengthCm']! as num).toDouble(),
          weightG: (e.value['weightG']! as num).toDouble(),
        ),
    };

/// FRUIT_SIZES and FETAL_SIZE_BY_WEEK share one source (fetal-size.ts).
bool fruitSizesMatchFetalSizes() => fruitSizesData.keys.every((w) {
      final f = fetalSizeByWeek[w];
      return f != null && f.lengthCm == (fruitSizesData[w]!['lengthCm']! as num) && f.weightG == (fruitSizesData[w]!['weightG']! as num);
    });
