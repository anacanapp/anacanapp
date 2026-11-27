// The five bottom tabs of each woman persona (home also scrolled), and the partner shell's tabs.
const WOMEN = { 'bump-week24': 'bump', 'flow-day12': 'flow', 'mommy-6m': 'mommy' };

const womanTabs = (persona, short) => ({
  id: `${short}.tabs`, persona,
  async steps(page, h) {
    await h.shot('home');
    await h.scroll(700); await h.shot('home-2');
    await h.scroll(1400); await h.shot('home-3');
    await h.scroll(0);
    for (const tab of ['tools', 'community', 'profile']) { await h.tab(tab); await h.shot(tab); }
    // Profile's segmented control (Mən / Ailə / Ayarlar) remembers its tab in sessionStorage.
    for (const seg of ['family', 'settings']) {
      await page.evaluate((v) => sessionStorage.setItem('anacan_profile_tab', v), seg);
      await h.tab('home'); await h.tab('profile'); await h.shot(`profile-${seg}`);
    }
    await page.evaluate(() => sessionStorage.removeItem('anacan_profile_tab'));
    // Last: for a free user the AI tab opens the Premium paywall sheet over the shell.
    await h.tab('ai'); await h.shot('ai');
  },
});

export default [
  ...Object.entries(WOMEN).map(([persona, short]) => womanTabs(persona, short)),
  {
    id: 'partner.tabs', persona: 'partner-linked',
    async steps(page, h) {
      await h.shot('home');
      await h.scroll(700); await h.shot('home-2');
      await h.scroll(0);
      for (const tab of ['together', 'chat', 'ai', 'profile']) { await h.tab(tab); await h.shot(tab); }
    },
  },
];
