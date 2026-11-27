import { AlertTriangle, Phone } from 'lucide-react';
import { useEmergencyNumber } from '@/hooks/useEmergencyNumber';
import { tr } from '@/lib/tr';

interface SafetyStripProps {
  /** One short, already-translated line of tool-specific danger signs ("Zəng edin: …"). */
  signs: string;
  className?: string;
}

/**
 * Minimal "danger signs + call" row shown at the bottom of a tool: a small warning icon, one line of
 * signs and a compact tel: pill with the user's country emergency number (never hard-coded).
 * Styles: `.a-safety-strip*` in src/styles/anacan-design.css (dark mode + RTL via logical properties).
 */
export function SafetyStrip({ signs, className = '' }: SafetyStripProps) {
  const number = useEmergencyNumber();
  return (
    <aside className={`a-safety-strip ${className}`.trim()} role="note">
      <AlertTriangle className="a-safety-strip-icon" size={15} strokeWidth={2.2} aria-hidden="true" />
      <p className="a-safety-strip-text">{signs}</p>
      <a className="a-safety-strip-call" href={`tel:${number}`}>
        <Phone size={13} strokeWidth={2.4} aria-hidden="true" />
        <bdi>{tr('safety_call_number', 'Zəng et {number}').replace('{number}', number)}</bdi>
      </a>
    </aside>
  );
}

/** One collapsed line under the strip for "check with your doctor first" style notes (native <details>, no JS state). */
export function SafetyMore({ summary, text }: { summary: string; text: string }) {
  return (
    <details className="a-safety-more">
      <summary>{summary}</summary>
      <p>{text}</p>
    </details>
  );
}

export default SafetyStrip;
