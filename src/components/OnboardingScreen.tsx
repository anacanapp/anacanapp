import OnboardingJourney from '@/components/onboarding/OnboardingJourney';

/** The basic setting uses the same data-safe design, without the Premium offer. */
export default function OnboardingScreen() {
  return <OnboardingJourney offerEnabled={false} />;
}
