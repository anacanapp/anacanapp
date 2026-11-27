// Ported from: src/hooks/useChildren.ts (Child, getChildAge)
//
// A `user_children` row as the mommy home uses it, plus the age bundle `getChildAge` returns.
import '../../../domain/pregnancy/pregnancy_utils.dart';
import '../../../core/i18n/tr.dart' as i18n;

/// `Child` (`user_children` row).
class Child {
  const Child({
    required this.id,
    required this.userId,
    required this.name,
    required this.birthDate,
    this.dueDate,
    required this.gender,
    this.countryCode,
    this.vaccineCountryCode,
    required this.avatarEmoji,
    required this.isActive,
    required this.sortOrder,
    this.notes,
    required this.createdAt,
  });

  factory Child.fromRow(Map<String, dynamic> row) => Child(
        id: row['id'] as String,
        userId: row['user_id'] as String? ?? '',
        name: row['name'] as String? ?? '',
        birthDate: row['birth_date'] as String? ?? '',
        dueDate: row['due_date'] as String?,
        gender: row['gender'] as String? ?? 'unknown',
        countryCode: row['country_code'] as String?,
        vaccineCountryCode: row['vaccine_country_code'] as String?,
        avatarEmoji: row['avatar_emoji'] as String? ?? '',
        isActive: row['is_active'] as bool? ?? true,
        sortOrder: (row['sort_order'] as num?)?.toInt() ?? 0,
        notes: row['notes'] as String?,
        createdAt: row['created_at'] as String? ?? '',
      );

  final String id;
  final String userId;
  final String name;

  /// `YYYY-MM-DD`.
  final String birthDate;

  /// Original expected due date (EDD); null = unknown. Drives prematurity and the corrected age.
  final String? dueDate;

  /// 'boy' | 'girl' | 'unknown'.
  final String gender;
  final String? countryCode;
  final String? vaccineCountryCode;
  final String avatarEmoji;
  final bool isActive;
  final int sortOrder;
  final String? notes;
  final String createdAt;

  Map<String, dynamic> toRow() => {
        'id': id,
        'user_id': userId,
        'name': name,
        'birth_date': birthDate,
        'due_date': dueDate,
        'gender': gender,
        'country_code': countryCode,
        'vaccine_country_code': vaccineCountryCode,
        'avatar_emoji': avatarEmoji,
        'is_active': isActive,
        'sort_order': sortOrder,
        'notes': notes,
        'created_at': createdAt,
      };

  Child copyWith({String? name, String? birthDate, String? gender, String? avatarEmoji, String? dueDate}) => Child(
        id: id,
        userId: userId,
        name: name ?? this.name,
        birthDate: birthDate ?? this.birthDate,
        dueDate: dueDate ?? this.dueDate,
        gender: gender ?? this.gender,
        countryCode: countryCode,
        vaccineCountryCode: vaccineCountryCode,
        avatarEmoji: avatarEmoji ?? this.avatarEmoji,
        isActive: isActive,
        sortOrder: sortOrder,
        notes: notes,
        createdAt: createdAt,
      );
}

/// Return value of `getChildAge(child)`.
class ChildAge {
  const ChildAge({
    required this.days,
    required this.dayNumber,
    required this.weeks,
    required this.months,
    required this.years,
    required this.remainingMonths,
    required this.remainingDays,
    required this.displayText,
    required this.correctedDays,
    required this.correctedDayNumber,
    required this.correctedWeeks,
    required this.correctedMonths,
    required this.correctedDisplayText,
    required this.correctionApplied,
    required this.isPremature,
    required this.gestationalWeeksAtBirth,
    required this.gestationalExtraDays,
  });

  final int days;
  final int dayNumber;
  final int weeks;
  final int months;
  final int years;
  final int remainingMonths;
  final int remainingDays;
  final String displayText;
  final int correctedDays;
  final int correctedDayNumber;
  final int correctedWeeks;
  final int correctedMonths;
  final String correctedDisplayText;
  final bool correctionApplied;
  final bool isPremature;
  final int? gestationalWeeksAtBirth;
  final int? gestationalExtraDays;
}

String _tr(String key, String az) => i18n.tr(key, az);

/// `getChildAge(child)`: chronological age plus the corrected age (identical unless the correction applies).
ChildAge getChildAge(Child child) {
  final age = getRealCalendarAge(child.birthDate, tr: _tr);
  final weeks = (age.totalDays / 7).floor();
  final prematurity = getPrematurityInfo(child.birthDate, child.dueDate, tr: _tr);
  final useCorrected = prematurity.correctionApplies && prematurity.corrected != null;
  final corrected = useCorrected ? prematurity.corrected! : age;
  return ChildAge(
    days: age.totalDays,
    dayNumber: age.dayNumber,
    weeks: weeks,
    months: age.months,
    years: age.years,
    remainingMonths: age.remainingMonths,
    remainingDays: age.days,
    displayText: age.displayText,
    correctedDays: corrected.totalDays,
    correctedDayNumber: corrected.dayNumber,
    correctedWeeks: (corrected.totalDays / 7).floor(),
    correctedMonths: corrected.months,
    correctedDisplayText: corrected.displayText,
    correctionApplied: useCorrected,
    isPremature: prematurity.isPremature,
    gestationalWeeksAtBirth: prematurity.gestationalWeeksAtBirth,
    gestationalExtraDays: prematurity.gestationalExtraDays,
  );
}
