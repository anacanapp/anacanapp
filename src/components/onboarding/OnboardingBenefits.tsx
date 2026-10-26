import { Check } from 'lucide-react';
import { onboardingFeatures, type OnboardingFeaturePage } from '@/lib/onboarding-features';
import type { OnboardingStage } from '@/lib/onboarding-model';

export function OnboardingBenefits({ stage, page, language }: {
  stage: OnboardingStage; page: OnboardingFeaturePage; language: string;
}) {
  return <ul className="onb-benefits" data-testid="onboarding-benefits" data-feature-page={page}>
    {onboardingFeatures(stage, page, language).map(({ key, label }) => <li key={key} data-feature={key}>
      <span className="onb-benefit-check" aria-hidden="true"><Check size={15} strokeWidth={2.5} /></span><span>{label}</span>
    </li>)}
  </ul>;
}
