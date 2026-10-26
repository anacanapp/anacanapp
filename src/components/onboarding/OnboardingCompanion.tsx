import { onboardingText } from '@/lib/onboarding-i18n';
import type { OnboardingStage } from '@/lib/onboarding-model';
import { lifeStageName } from '@/lib/stage-names';

const images = import.meta.glob<string>('../../assets/onboarding/*.webp', { eager: true, query: '?url', import: 'default' });
export const COMPANIONS = { flow: { file: 'cycle', name: 'Ritm' }, bump: { file: 'pregnancy', name: 'Tumurcuq' }, mommy: { file: 'mother', name: 'Qucaq' } } as const;
export type CompanionPose = 'welcome' | 'mode' | 'name' | 'data' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  | 'sproof' | 'privacy' | 'value' | 'analysis' | 'results' | 'proof' | 'paywall' | 'exit' | 'freemode' | 'success';

export function OnboardingCompanion({ stage, pose = 'welcome', language, size = 'hero' }: {
  stage: OnboardingStage; pose?: CompanionPose; language: string; size?: 'hero' | 'compact' | 'tiny' | 'option';
}) {
  const character = COMPANIONS[stage];
  const src = images[`../../assets/onboarding/${character.file}-${pose}.webp`];
  return <div className={`onb-companion onb-companion-${size}`} data-character={character.name}>
    <img src={src} width={512} height={512} alt={onboardingText(language, 'companion', { name: lifeStageName(stage, language) })} decoding="async" />
  </div>;
}

export function OnboardingFamily({ language }: { language: string }) {
  return <div className="onb-family">{(['flow', 'bump', 'mommy'] as const).map(stage => <figure key={stage}>
    <OnboardingCompanion stage={stage} language={language} />
    <figcaption>{lifeStageName(stage, language)}</figcaption>
  </figure>)}</div>;
}
