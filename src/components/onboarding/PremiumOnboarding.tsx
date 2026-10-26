import OnboardingJourney from './OnboardingJourney';

// Read only for users who were part-way through a pre-v3 onboarding. New drafts
// and completion/last-chance state are account-and-backend scoped.
export const PENDING_FUNNEL_KEY = 'anacan_pending_funnel';
export default OnboardingJourney;
