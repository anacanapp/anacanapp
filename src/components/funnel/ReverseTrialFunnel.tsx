import OnboardingJourney from '@/components/onboarding/OnboardingJourney';

/** Compatibility entry point for a pre-v3 pending funnel; no trial is offered. */
export default function ReverseTrialFunnel({ onComplete }: { onComplete: () => void }) {
  return <OnboardingJourney legacyPending onComplete={onComplete} />;
}
