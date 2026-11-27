// Ported from: src/lib/onboarding-features.ts
//
// Premium/coffee pages lead with the stage outcome and list only features that are Premium in code
// (freemium.dart, PremiumGate/PremiumBlurGate). Free users keep 10 AI questions a day; ad-free stays last.
// Labels ship in every locale (an older remote onboarding translation cannot replace them).

import '../../core/i18n/app_languages.dart' show normalizeAppLanguage;
import 'data/onboarding_features_copy.g.dart';

/// 'results' | 'features' | 'paywall' | 'offer'
typedef OnboardingFeaturePage = String;

List<String> _premium(String first, String second) => [first, second, 'ai_daily_unlimited', 'doctor_pdf', 'ad_free'];

final Map<String, Map<String, List<String>>> onboardingFeatureLists = {
  'mommy': {
    'results': ['sleep_tracking', 'feeding_tracking', 'milestones', 'cry_analysis', 'weather_clothing'],
    'features': ['anacan_ai', 'doctor_pdf', 'partner_account', 'sounds_stories', 'vaccine_calendar', 'healthy_recipes', 'teething_tracker', 'mental_exercises', 'ad_free'],
    'paywall': _premium('baby_care_tracking', 'growth_curves'),
    'offer': _premium('baby_care_tracking', 'growth_curves'),
  },
  'bump': {
    'results': ['fetal_growth', 'nutrition_control', 'safety_lookup', 'kicks_contractions', 'body_measurements'],
    'features': ['anacan_ai', 'doctor_pdf', 'partner_account', 'healthy_recipes', 'hospital_bag_shopping', 'pregnancy_album_vitamins', 'mental_fitness', 'ad_free'],
    'paywall': _premium('kicks_contractions', 'body_measurements'),
    'offer': _premium('kicks_contractions', 'body_measurements'),
  },
  'flow': {
    'results': ['mood_journal', 'nutrition_control', 'vitamin_tracker', 'healthy_recipes', 'mental_fitness'],
    'features': ['anacan_ai', 'doctor_pdf', 'partner_account', 'healthy_recipes', 'nutrition_control', 'vitamin_tracker', 'mental_fitness', 'ad_free'],
    'paywall': _premium('symptom_analysis', 'cycle_stats'),
    'offer': _premium('symptom_analysis', 'cycle_stats'),
  },
};

/// `onboardingFeatures(stage, page, language)` → `[{key, label}]`.
List<({String key, String label})> onboardingFeatures(String stage, OnboardingFeaturePage page, String language) {
  final labels = kOnboardingFeatureCopy[normalizeAppLanguage(language)] ?? kOnboardingFeatureCopy['az']!;
  return [for (final key in onboardingFeatureLists[stage]![page]!) (key: key, label: labels[key] ?? key)];
}
