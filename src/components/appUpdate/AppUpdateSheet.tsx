import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowUp, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { updateText } from '@/lib/appUpdate-i18n';
import type { AppUpdateDecision } from '@/hooks/useAppUpdate';

/** Soft update: a bottom sheet with the rule's title, what's new and Update / Later. */
export default function AppUpdateSheet({ decision, currentVersion, onUpdate, onLater }: {
  decision: AppUpdateDecision; currentVersion: string | null; onUpdate: () => void; onLater: () => void;
}) {
  const store = Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play';
  const items = (decision.whats_new || []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 6);
  return createPortal(
    <div className="app-update-backdrop" onClick={onLater}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-update-title"
        className="app-update-sheet a-scope"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
        <span className="app-update-handle" aria-hidden />
        <div className="app-update-head">
          <span className="app-update-icon"><ArrowUp size={22} strokeWidth={2.6} /></span>
          <div className="min-w-0">
            <h2 id="app-update-title">{decision.title || updateText('newVersion')}</h2>
            <p>{currentVersion ? `${currentVersion} → ` : ''}{decision.target_version} · {store}</p>
          </div>
        </div>
        {decision.body && <p className="app-update-body">{decision.body}</p>}
        {items.length > 0 && <>
          <p className="app-update-what">{updateText('whatsNew')}</p>
          <ul className="app-update-list">
            {items.map((item) => <li key={item}><span aria-hidden><Check size={11} strokeWidth={3.2} /></span>{item}</li>)}
          </ul>
        </>}
        <button type="button" className="app-update-cta" onClick={onUpdate}>{decision.button || updateText('update')}</button>
        <button type="button" className="app-update-later" onClick={onLater}>{decision.later || updateText('later')}</button>
      </motion.div>
    </div>,
    document.body,
  );
}
