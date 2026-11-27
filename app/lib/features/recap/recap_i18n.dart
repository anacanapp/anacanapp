// Ported from: src/lib/recap/recap-i18n.ts
import '../../core/i18n/tr.dart';
import '../../domain/recap/data/recap_data.g.dart' show recapCopy;

/// Translated Recap string (tr with the Azerbaijani source as fallback).
String rt(String key) => tr(key, recapCopy[key] ?? key);
