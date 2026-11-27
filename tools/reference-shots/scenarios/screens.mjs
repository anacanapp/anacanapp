// Sub-screens reached from the shell. Settings is opened with its visible gear button on Profile; the rest use the
// app's own in-app deeplink event (the path banners and pushes use), because their entry points are deep in lists.
const SCREENS = ['notifications', 'calendar', 'edit-profile', 'appearance', 'privacy', 'help', 'billing', 'referral', 'widgets'];

export default [
  {
    id: 'bump.settings', persona: 'bump-week24',
    async steps(page, h) {
      await h.tab('profile');
      await h.tap('.a-topbar-actions .a-icon-btn');
      await h.shot('settings');
      await h.scroll(700); await h.shot('settings-2');
    },
  },
  ...SCREENS.map((screen) => ({
    id: `bump.screen.${screen}`, persona: 'bump-week24',
    async steps(page, h) { await h.screen(screen); await h.shot(screen); },
  })),
  { id: 'mommy.screen.calendar', persona: 'mommy-6m', async steps(page, h) { await h.screen('calendar'); await h.shot('calendar'); } },
  { id: 'flow.screen.calendar', persona: 'flow-day12', async steps(page, h) { await h.screen('calendar'); await h.shot('calendar'); } },
  { id: 'partner.screen.notifications', persona: 'partner-linked', async steps(page, h) { await h.screen('notifications'); await h.shot('notifications'); } },
];
