import { CalendarDays, LayoutGrid, HeartHandshake } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { onboardingText } from '@/lib/onboarding-i18n';
import { OnboardingFamily } from '@/components/onboarding/OnboardingCompanion';
import { OnboardingFrame, OnboardingButton } from '@/components/onboarding/OnboardingFrame';

export default function AppIntroduction({ onComplete }: { onComplete: () => void }) {
  const language = useUserStore(state => state.language);
  const t = (key: Parameters<typeof onboardingText>[1]) => onboardingText(language, key);
  return <OnboardingFrame language={language} step="introduction" footer={<OnboardingButton onClick={onComplete}>{t('start')}</OnboardingButton>}>
    <OnboardingFamily language={language} />
    <div className="onb-center"><p className="onb-eyebrow">{t('welcome_eyebrow')}</p><h1 tabIndex={-1}>{t('welcome_title')}</h1><p className="onb-sub">{t('welcome_sub')}</p></div>
    <div className="onb-feature-grid"><div><CalendarDays size={22} /><span>{t('feature_tracking')}</span></div>
      <div><LayoutGrid size={22} /><span>{t('feature_tools')}</span></div><div><HeartHandshake size={22} /><span>{t('feature_community')}</span></div></div>
    <p className="onb-note">{t('own_pace')}</p>
  </OnboardingFrame>;
}
