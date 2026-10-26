import { companionSrc, COMPANIONS, type CompanionPose } from '@/components/onboarding/OnboardingCompanion';
import type { OnboardingStage } from '@/lib/onboarding-model';

interface MascotProps {
  stage: OnboardingStage;
  pose?: CompanionPose;
  width?: number;
  bob?: boolean;
  /** Decorative by default; pass a label when the mascot carries meaning. */
  label?: string;
  className?: string;
}

/** Brand companions: Tumurcuq (bump), Qucaq (mommy), Ritm (flow). */
export function Mascot({ stage, pose = 'mode', width = 120, bob, label, className = '' }: MascotProps) {
  const src = companionSrc(stage, pose);
  if (!src) return null;
  return (
    <img
      className={`a3-mascot${bob ? ' bob' : ''} ${className}`}
      src={src}
      width={width}
      style={{ width }}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
      data-character={COMPANIONS[stage].name}
      decoding="async"
      draggable={false}
    />
  );
}
