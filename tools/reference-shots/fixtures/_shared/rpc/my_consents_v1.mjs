// src/lib/consentGate.ts parseConsentState. persona.consents: 'accepted' (default) | 'none' (gate shows) | 'off' (gate disabled).
export default (ctx) => {
  const mode = ctx.persona.consents || 'accepted';
  if (mode === 'off') return { gate: { enabled: false, version: null }, consents: {} };
  const row = (granted) => ({ granted, document_version: '2.0', source: 'app', created_at: ctx.iso('-30d') });
  return { gate: { enabled: true, version: '2.0' },
    consents: mode === 'accepted' ? { terms: row(true), privacy: row(true), health_data: row(true), age_16: row(true), marketing: row(false), ai_assistant: row(true) } : {} };
};
