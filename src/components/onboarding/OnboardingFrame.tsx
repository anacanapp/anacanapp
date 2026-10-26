import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAdSafetyBlock } from '@/components/ads/AdExperienceProvider';
import { onboardingText, onboardingNumber } from '@/lib/onboarding-i18n';
import '@/styles/onboarding.css';
import logoImage from '@/assets/brand-mark.png';

export function OnboardingButton({ children, onClick, disabled = false, busy = false, secondary = false, ...props }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; 'data-testid'?: string;
}) {
  return <button type="button" className={secondary ? 'onb-secondary' : 'onb-primary'} onClick={onClick} disabled={disabled || busy} {...props}>
    {busy && <Loader2 size={18} className="onb-spinner" aria-hidden="true" />}{children}
  </button>;
}

export function OnboardingFrame({ children, footer, language, step, current = 0, total = 0, onBack, busy = false }: {
  children: ReactNode; footer?: ReactNode; language: string; step: string; current?: number; total?: number; onBack?: () => void; busy?: boolean;
}) {
  useAdSafetyBlock(true);
  const scroll = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 }));
  useEffect(() => {
    const resize = () => setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    window.visualViewport?.addEventListener('resize', resize); window.visualViewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    const element = scroll.current;
    if (element) { element.scrollTop = 0; element.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true }); }
  }, [step]);
  return <section className="onboarding" data-onboarding-step={step} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}
    data-ad-block="true" data-no-swipe style={{ height: viewport.height, top: viewport.top }}>
    <div className="onb-container">
      <header className="onb-header">
        {onBack ? <button type="button" className="onb-icon" onClick={onBack} disabled={busy} aria-label={onboardingText(language, 'back')}>
          <ArrowLeft size={21} className="rtl:rotate-180" />
        </button> : <img className="onb-brand-logo" src={logoImage} width={44} height={44} alt="Anacan" />}
        {total > 0 && <><div className="onb-progress" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}
          aria-label={onboardingText(language, 'step', { current: onboardingNumber(language, current), total: onboardingNumber(language, total) })}>
          <i style={{ width: `${Math.min(100, current / total * 100)}%` }} />
        </div><span className="onb-step-count">{onboardingNumber(language, current)}/{onboardingNumber(language, total)}</span></>}
      </header>
      <div className="onb-content" ref={scroll} data-scroll-ignore>{children}</div>
      {footer && <footer className="onb-footer">{footer}</footer>}
    </div>
  </section>;
}
