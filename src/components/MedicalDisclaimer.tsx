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

  // banner / compact: the same design-system card, without the home-page top margin
  return (
    <div className={`a-disclaimer flat${variant === 'compact' ? ' compact' : ''} ${className}`}>
      <AlertCircle size={variant === 'compact' ? 14 : 16} />
      <p>{text}</p>
    </div>
  );
};

export default MedicalDisclaimer;
