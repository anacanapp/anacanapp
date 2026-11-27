// Ported from: src/lib/recovery.ts (pure part), src/data/recovery/index.ts, src/lib/feature-text.ts (createFeatureText,
//              fill)
//
// Postpartum recovery: week after birth, program constants, Kegel levels and warning-sign severity, plus the
// per-language copy (generated from src/data/recovery/*.json by app/tool/mommy/gen_mommy_data.mjs). The
// postpartum_checkins / birth_type writes belong to RecoveryScreen (not on the home; tools/screens phase).
import '../../core/i18n/app_languages.dart';
import '../../domain/js_compat.dart';
import 'recovery_text.g.dart';

/// 'vaginal' | 'cesarean'.
typedef BirthType = String;

const List<String> recoveryFlags = ['heavy_bleeding', 'fever', 'wound', 'leg', 'chest', 'headache', 'smell', 'breast', 'harm', 'sad'];

/// Signs that need emergency help now; the others need a doctor today.
const List<String> urgentRecoveryFlags = ['heavy_bleeding', 'chest', 'headache', 'leg', 'harm'];

const int programWeeks = 6;

/// The mommy home shows the recovery card only in the first 8 weeks after birth.
const int homeCardWeeks = 8;
const int kegelDailyGoal = 3;

/// `isoDay(date)`.
String isoDay(DateTime d) => '${d.year}-${pad2(d.month)}-${pad2(d.day)}';

/// Week after birth, 1-based (days 0–6 → week 1). Null without a birth date or before birth.
int? weekAfterBirth(String? birthDate, [DateTime? now]) {
  if (birthDate == null || birthDate.isEmpty) return null;
  final head = birthDate.length >= 10 ? birthDate.substring(0, 10) : birthDate;
  final parts = head.split('-').map((p) => int.tryParse(p) ?? 0).toList();
  if (parts.length < 3 || parts[0] == 0 || parts[1] == 0 || parts[2] == 0) return null;
  final n = now ?? DomainClock.now();
  final birth = DateTime(parts[0], parts[1], parts[2]);
  final today = DateTime(n.year, n.month, n.day);
  final days = jsRoundInt((today.millisecondsSinceEpoch - birth.millisecondsSinceEpoch) / 86400000);
  if (days < 0) return null;
  return (days / 7).floor() + 1;
}

/// The 6-week check-up date (birth + 42 days).
DateTime checkupDate(String birthDate) {
  final p = birthDate.substring(0, 10).split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2] + 42);
}

class KegelLevel {
  const KegelLevel(this.level, this.hold, this.rest, this.reps);
  final int level;
  final int hold;
  final int rest;
  final int reps;
}

/// Gentle start in weeks 1–2, then longer holds.
KegelLevel kegelLevel(int? week) {
  if (week == null || week <= 2) return const KegelLevel(0, 3, 6, 8);
  if (week <= 4) return const KegelLevel(1, 5, 5, 10);
  return const KegelLevel(2, 8, 8, 10);
}

int kegelMinutes(KegelLevel l) {
  final m = jsRoundInt(l.reps * (l.hold + l.rest) / 60);
  return m < 1 ? 1 : m;
}

/// 'urgent' | 'doctor' | null.
String? flagSeverity(List<String> flags, int? bleeding) {
  if (flags.any(urgentRecoveryFlags.contains)) return 'urgent';
  if (flags.isNotEmpty || bleeding == 3) return 'doctor';
  return null;
}

/// `useRecoveryText(language)`: own file, else en, else az.
Map<String, Object?> recoveryText(String language) =>
    kRecoveryText[normalizeAppLanguage(language)] ?? kRecoveryText['en'] ?? kRecoveryText['az']!;

/// `fill(template, values)`: replaces `{name}` placeholders present in [values].
String fill(String template, Map<String, Object?> values) => template.replaceAllMapped(
      RegExp(r'\{(\w+)\}'),
      (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!,
    );
