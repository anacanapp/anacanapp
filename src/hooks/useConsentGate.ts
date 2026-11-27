import { useCallback, useEffect, useState } from 'react';
import {
  decideConsentGate, fetchConsentState, flushPendingConsents, readAcceptedVersion, rememberAcceptedVersion,
  type ConsentState,
} from '@/lib/consentGate';

export type ConsentGateStatus = 'loading' | 'show' | 'skip';

/**
 * Decides whether the consent gate must be shown for the signed-in user.
 * - No user → skip. A version already accepted on this device → skip at once (offline-safe), then the server
 *   is checked in the background (a new document version can still bring the gate back).
 * - Otherwise 'loading' until my_consents_v1 answers (bounded timeout); any failure → skip, never a lock-out.
 */
export function useConsentGate(userId: string | null | undefined, backend: string) {
  const [state, setState] = useState<{ key: string; status: ConsentGateStatus; consent: ConsentState | null }>(
    { key: '', status: 'loading', consent: null });
  const key = userId ? `${backend}:${userId}` : '';

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const local = readAcceptedVersion(backend, userId);
    setState({ key, status: local ? 'skip' : 'loading', consent: null });
    void (async () => {
      if (local) await flushPendingConsents(backend, userId);
      const consent = await fetchConsentState();
      if (cancelled) return;
      const localNow = readAcceptedVersion(backend, userId);
      const decision = decideConsentGate({ state: consent, localAcceptedVersion: localNow });
      const terms = consent?.consents.terms;
      if (consent?.gate.version && terms?.granted && terms.document_version === consent.gate.version) {
        rememberAcceptedVersion(backend, userId, consent.gate.version);
      }
      setState({ key, status: decision, consent });
    })();
    return () => { cancelled = true; };
  }, [userId, backend, key]);

  const markAccepted = useCallback(() => setState(prev => ({ ...prev, status: 'skip' })), []);

  if (!userId) return { status: 'skip' as ConsentGateStatus, consent: null, markAccepted };
  const current = state.key === key ? state
    : { status: (readAcceptedVersion(backend, userId) ? 'skip' : 'loading') as ConsentGateStatus, consent: null };
  return { status: current.status, consent: current.consent, markAccepted };
}
