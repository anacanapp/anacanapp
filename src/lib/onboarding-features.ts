import copy from '../../scripts/i18n/onboarding-features-copy.json';
import { normalizeAppLanguage } from './app-languages';
import type { OnboardingStage } from './onboarding-model';

export type OnboardingFeatureKey = keyof typeof copy.languages.en;
export type OnboardingFeaturePage = 'results' | 'features' | 'paywall' | 'offer';

const premium = (mental: 'mental_exercises' | 'mental_fitness'): readonly OnboardingFeatureKey[] =>
  ['anacan_ai', 'doctor_pdf', 'partner_account', mental, 'ad_free'];
const mommyPremium = premium('mental_exercises'), otherPremium = premium('mental_fitness');

const features: Record<OnboardingStage, Record<OnboardingFeaturePage, readonly OnboardingFeatureKey[]>> = {
  mommy: {
    results: ['sleep_tracking', 'feeding_tracking', 'milestones', 'cry_analysis', 'weather_clothing'],
    features: ['anacan_ai', 'doctor_pdf', 'partner_account', 'sounds_stories', 'vaccine_calendar', 'healthy_recipes', 'teething_tracker', 'mental_exercises', 'ad_free'],
    paywall: mommyPremium, offer: mommyPremium,
  },
  bump: {
    results: ['fetal_growth', 'nutrition_control', 'safety_lookup', 'kicks_contractions', 'body_measurements'],
    features: ['anacan_ai', 'doctor_pdf', 'partner_account', 'healthy_recipes', 'hospital_bag_shopping', 'pregnancy_album_vitamins', 'mental_fitness', 'ad_free'],
    paywall: otherPremium, offer: otherPremium,
  },
  flow: {
    results: ['mood_journal', 'nutrition_control', 'vitamin_tracker', 'healthy_recipes', 'mental_fitness'],
    features: ['anacan_ai', 'doctor_pdf', 'partner_account', 'healthy_recipes', 'nutrition_control', 'vitamin_tracker', 'mental_fitness', 'ad_free'],
    paywall: otherPremium, offer: otherPremium,
  },
};

/** Page-specific copy ships in every locale. Older remote onboarding translations
 * cannot replace these reviewed labels or mix a different stage's feature list. */
export function onboardingFeatures(stage: OnboardingStage, page: OnboardingFeaturePage, language: string) {
  const labels: Record<OnboardingFeatureKey, string> = copy.languages[normalizeAppLanguage(language)];
  return features[stage][page].map(key => ({ key, label: labels[key] }));
}
