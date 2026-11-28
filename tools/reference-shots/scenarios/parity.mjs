// Main screens used for the Flutter visual-parity pass that the tab/screen scenarios do not reach: the bump home
// (its first frame can still be loading on a cold dev server), the chat inbox, the mini-games hub and the blog list.
export default [
  {
    id: 'bump.parity', persona: 'bump-week24',
    async steps(page, h) {
      await page.locator('[data-tour^="tab-"]').first().waitFor({ timeout: 30000 });
      await h.sleep(4000);
      await h.shot('home');
      await h.deeplink('messages', {});
      await h.sleep(1500);
      await h.shot('chat-inbox');
    },
  },
  {
    id: 'mommy.parity', persona: 'mommy-6m',
    async steps(page, h) {
      await h.deeplink('tool', { tool_id: 'mini-games' });
      await h.sleep(1500);
      await h.shot('mini-games');
      await h.deeplink('tab', { tab: 'home' });
      await h.screen('blog');
      await h.sleep(1500);
      await h.shot('blog');
    },
  },
];
