// Ported from: src/components/tools/mood-diary-form.ts
import 'package:flutter/foundation.dart';

@immutable
class MoodDiaryForm {
  const MoodDiaryForm({this.mood, this.symptoms = const [], this.bleeding, this.notes = ''});
  final int? mood;
  final List<String> symptoms;
  final String? bleeding;
  final String notes;
}

MoodDiaryForm emptyMoodDiaryForm() => const MoodDiaryForm();

/// The diary form for a saved day, so reopening the diary shows (and re-saving keeps) what was entered earlier.
MoodDiaryForm moodDiaryFormFromLog(Map<String, dynamic>? log) {
  if (log == null) return emptyMoodDiaryForm();
  final mood = log['mood'];
  final symptoms = log['symptoms'];
  final bleeding = log['bleeding'];
  final notes = log['notes'];
  return MoodDiaryForm(
    mood: mood is num ? mood.toInt() : null,
    symptoms: symptoms is List ? [for (final s in symptoms) if (s is String) s] : const [],
    bleeding: bleeding is String ? bleeding : null,
    notes: notes is String ? notes : '',
  );
}

/// Only the fields the diary shows. Water, temperature, sleep (and bleeding when its card is hidden) are left out so
/// the upsert keeps what other screens saved for the day.
Map<String, Object?> moodDiaryPatch(MoodDiaryForm form, String logDate, bool showBleeding) => {
      'log_date': logDate,
      'mood': form.mood,
      'symptoms': form.symptoms,
      'notes': form.notes.trim().isNotEmpty ? form.notes : null,
      if (showBleeding) 'bleeding': form.bleeding,
    };
