import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { usePrivacyPreferences } from '@/hooks/usePrivacyPreferences';
import { setPrivacyConsent, usePrivacyConsent } from '@/lib/privacyConsent';
import ConsentControls, { type ConsentChoice } from './ConsentControls';
import { usePrivacyText } from './privacyCopy';

/**
 * First-run consent sheet. Shown once per install to a signed-in person who has not
 * decided yet. "Accept all" and "Essential only" have equal weight (GDPR); nothing
 * optional runs until a choice is saved.
 */
export default function PrivacyConsentSheet() {
  const { user } = useAuth();
  const consent = usePrivacyConsent();
  const { updatePref } = usePrivacyPreferences();
  const t = usePrivacyText();
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<ConsentChoice>({ analytics: false, ads: false, attribution: false });
  const [busy, setBusy] = useState(false);
  const open = !!user && consent.decidedAt === null;

  const save = async (choice: ConsentChoice) => {
    if (busy) return;
    setBusy(true);
    try {
      await setPrivacyConsent(choice);
      void updatePref('privacy_share_analytics', choice.analytics); // keeps Customer.io in step
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="a-scope fixed inset-0 flex items-end justify-center" style={{ zIndex: 300, background: 'rgba(29,21,18,.45)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="privacy-consent-title">
          <motion.div className="w-full max-w-[480px] safe-bottom overflow-y-auto"
            style={{ background: 'var(--a-bg)', borderRadius: '28px 28px 0 0', padding: '22px 20px 20px', maxHeight: '92vh' }}
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <img src="/brand-mark-coral.png" alt="" width={36} height={36} style={{ objectFit: 'contain' }} />
              <h2 id="privacy-consent-title" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>{t('sheet_title')}</h2>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--a-ink-soft)' }}>{t('sheet_body')}</p>

            {custom && (
              <div className="a-card" style={{ marginTop: 14, padding: 10 }}>
                <ConsentControls value={draft} onChange={setDraft} disabled={busy} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 16 }}>
              {custom ? (
                <button type="button" disabled={busy} onClick={() => save(draft)} className="col-span-2"
                  style={{ height: 50, borderRadius: 16, background: 'var(--a-coral)', color: '#fff', fontWeight: 800, fontSize: 14 }}>{t('save')}</button>
              ) : (<>
                <button type="button" disabled={busy} onClick={() => save({ analytics: false, ads: false, attribution: false })}
                  style={{ height: 50, borderRadius: 16, background: 'var(--a-surface-soft)', color: 'var(--a-ink)', fontWeight: 800, fontSize: 14, boxShadow: 'inset 0 0 0 1.5px var(--a-line)' }}>{t('reject_all')}</button>
                <button type="button" disabled={busy} onClick={() => save({ analytics: true, ads: true, attribution: true })}
                  style={{ height: 50, borderRadius: 16, background: 'var(--a-coral)', color: '#fff', fontWeight: 800, fontSize: 14 }}>{t('accept_all')}</button>
              </>)}
            </div>
            {!custom && (
              <button type="button" onClick={() => setCustom(true)} className="w-full"
                style={{ marginTop: 10, height: 40, fontSize: 13, fontWeight: 700, color: 'var(--a-accent-ink)' }}>{t('customize')}</button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
