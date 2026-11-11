import { useState } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { updateText } from '@/lib/appUpdate-i18n';
import type { AppUpdateDecision } from '@/hooks/useAppUpdate';

/** Home-screen strip for banner rules and soft rules after "Later". Closing hides it until the next launch. */
export default function AppUpdateBanner({ decision, onUpdate }: { decision: AppUpdateDecision; onUpdate: () => void }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className="app-update-banner" role="status">
      <span className="app-update-banner-icon" aria-hidden><ArrowUp size={16} strokeWidth={2.8} /></span>
      <span className="app-update-banner-text">{decision.title || updateText('banner')}</span>
      <button type="button" className="app-update-banner-go" onClick={onUpdate}>{decision.button || updateText('update')}</button>
      <button type="button" className="app-update-banner-x" onClick={() => setClosed(true)} aria-label={updateText('later')}><X size={16} /></button>
    </div>
  );
}
