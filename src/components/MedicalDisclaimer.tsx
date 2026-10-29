import { AlertCircle, Stethoscope } from 'lucide-react';
import { tr } from '@/lib/tr';

interface MedicalDisclaimerProps {
  variant?: 'banner' | 'compact' | 'inline' | 'anacan';
  className?: string;
}

/**
 * Reusable medical disclaimer used across AI/health features
 * to comply with Google Play Health Content policy.
 */
const MedicalDisclaimer = ({ variant = 'banner', className = '' }: MedicalDisclaimerProps) => {
  const text = tr(
    'medical_disclaimer_full',
    tr("medical_disclaimer_text", 'Bu məlumat yalnız maarifləndirmə məqsədi daşıyır və tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda 103-ə zəng edin.')
  );

  // Anacan redesign (anacan-demo) frosted disclaimer card
  if (variant === 'anacan') {
    return (
      <div className={`a-disclaimer ${className}`}>
        <Stethoscope size={15} />
        <p>{text}</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <p className={`text-[11px] text-muted-foreground leading-relaxed ${className}`}>
        ⚕️ {text}
      </p>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">{text}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">{text}</p>
    </div>
  );
};

export default MedicalDisclaimer;
