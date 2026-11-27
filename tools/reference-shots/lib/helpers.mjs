// Scenario helper object `h`. Scenarios drive the app by visible interaction (tab bar, tool tiles, buttons);
// `h.deeplink()` uses the app's own in-app deeplink event ('anacan:deeplink', the same path banners use)
// for screens that have no stable visible entry point.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ShotError extends Error {}

export function createHelpers(page, { outDir, cell, scenario, persona, recorder, results, log }) {
  const h = {
    page, persona, scenario, cell,
    lang: cell.lang, theme: cell.theme, viewport: cell.viewport,

    /** Wait until the app is quiet: no fetch in flight for `quietMs`, fonts loaded, images decoded, no startup screen. */
    async ready({ timeout = 20000, quietMs = 500, allowStartup = false } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const state = await page.evaluate(() => {
          const st = window.__refshots || { inflight: 0, lastChange: 0 };
          const startup = !!document.querySelector('[data-startup-screen]');
          const spinners = [...document.querySelectorAll('.animate-spin')].filter((e) => e.getBoundingClientRect().width > 0).length;
          const imgs = [...document.images].filter((i) => !i.complete).length;
          return { inflight: st.inflight, idleFor: performance.now() - st.lastChange, startup, spinners, imgs, fonts: document.fonts.status };
        }).catch(() => null);
        if (state && state.inflight === 0 && state.idleFor >= quietMs && (allowStartup || !state.startup)
          && state.imgs === 0 && state.fonts === 'loaded' && state.spinners === 0) {
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }).catch(() => {});
          return true;
        }
        await sleep(100);
      }
      log(`  ! ready() timed out on ${scenario.id}`);
      return false;
    },

    /** Screenshot once the page renders two identical frames in a row (framer-motion/JS animations settled). */
    async shot(name, { fullPage = false, maxTries = 12, locator = null } = {}) {
      await h.ready();
      await page.mouse.move(0, 0).catch(() => {});
      let prev = null, buf = null, stable = false;
      for (let i = 0; i < maxTries; i++) {
        buf = await (locator ? page.locator(locator).screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' })
          : page.screenshot({ fullPage, animations: 'disabled', caret: 'hide', scale: 'device' }));
        if (prev && prev.equals(buf)) { stable = true; break; }
        prev = buf;
        await sleep(i < 3 ? 150 : 350);
      }
      const rel = join(cell.viewport, cell.theme, cell.lang, `${scenario.id}__${name}.png`);
      const file = join(outDir, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buf);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      results.push({ scenario: scenario.id, shot: name, persona: persona.name, viewport: cell.viewport, theme: cell.theme,
        lang: cell.lang, file: rel, sha256, stable, unmocked: recorder.countFor(scenario.id, persona.name) });
      log(`  ✓ ${rel}${stable ? '' : ' (unstable frames)'}`);
      return rel;
    },

    /** Bottom tab bar (src/components/BottomNav.tsx: data-tour="tab-<id>"). */
    async tab(id) {
      await h.ready();
      await page.locator(`[data-tour="tab-${id}"]`).first().click();
      await h.ready();
    },

    /** Open a tool from the Tools tab tile (data-tour="tool-<id>"); falls back to the in-app tool deeplink. */
    async openTool(id, { viaDeeplink = false } = {}) {
      if (!viaDeeplink) {
        if (!(await page.locator(`[data-tour="tool-${id}"]`).count())) await h.tab('tools');
        const tile = page.locator(`[data-tour="tool-${id}"]`).first();
        if (await tile.count()) {
          await tile.scrollIntoViewIfNeeded();
          await tile.click();
          await h.ready();
          return;
        }
        log(`  · tile tool-${id} not visible, using deeplink`);
      }
      await h.deeplink('tool', { tool_id: id });
    },

    /** In-app deeplink (src/pages/Index.tsx handleDeeplink): action tab|tool|screen|messages|user-profile|community-post. */
    async deeplink(action, params) {
      await page.evaluate(([a, p]) => window.dispatchEvent(new CustomEvent('anacan:deeplink', { detail: { action: a, params: p } })), [action, params]);
      await sleep(50);
      await h.ready();
    },
    screen: (name) => h.deeplink('screen', { screen: name }),

    /** The screen's own back button (first icon button in the top bar). */
    async back() {
      const candidates = ['header.a-topbar button', '.a-topbar button', 'header button', '[aria-label="Geri"]'];
      for (const sel of candidates) {
        const btn = page.locator(sel).first();
        if (await btn.count() && await btn.isVisible()) { await btn.click(); await h.ready(); return; }
      }
      throw new ShotError('no back button found');
    },

    /** Click by visible text, role name or CSS selector. */
    async tap(target, { exact = false, nth = 0 } = {}) {
      const loc = typeof target === 'string' && /^[.#[]|^[a-z]+\[/.test(target) ? page.locator(target)
        : typeof target === 'string' ? page.getByText(target, { exact }) : target;
      await loc.nth(nth).click();
      await h.ready();
    },

    /** Scroll the app's main scroll container (or the window) to y px. */
    async scroll(y) {
      await page.evaluate((top) => {
        const el = document.querySelector('[data-subscreen] [data-scroll-container]') || document.querySelector('[data-scroll-container]');
        if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top, behavior: 'instant' });
        else window.scrollTo({ top, behavior: 'instant' });
      }, y);
      await sleep(100);
      await h.ready();
    },

    sleep,
  };
  return h;
}
