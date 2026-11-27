// Gates after sign-up: consent gate (+ privacy sheet), mandatory country gate, onboarding journey first step.
export default [
  { id: 'gate.consent', persona: 'new-signup',
    async steps(page, h) { await h.ready(); await h.shot('consent'); } },
  { id: 'gate.country', persona: 'signup-country', async steps(page, h) { await h.ready(); await h.shot('country'); } },
  { id: 'gate.onboarding', persona: 'signup-onboarding', async steps(page, h) { await h.ready(); await h.shot('onboarding'); } },
];
