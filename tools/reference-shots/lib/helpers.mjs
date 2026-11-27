// Scenario helper object `h`. Scenarios drive the app by visible interaction (tab bar, tool tiles, buttons);
// `h.deeplink()` uses the app's own in-app deeplink event ('anacan:deeplink', the same path banners use)
// for screens that have no stable visible entry point.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ShotError extends Error {}

/** Browser-level request tracking (covers lazy JS chunks, not only fetch()). */
export function trackRequests(page) {
  const net = { inflight: new Set(), last: Date.now() };
  const bump = () => { net.last = Date.now(); };
  page.on('request', (r) => { net.inflight.add(r); bump(); });
  const done = (r) => { net.inflight.delete(r); bump(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return net;
}

export function createHelpers(page, { outDir, cell, scenario, persona, recorder, results, log, net }) {
  const h = {
    page, persona, scenario, cell,
    lang: cell.lang, theme: cell.theme, viewport: cell.viewport, scrolledTo: 0,

    /** Wait until the app is quiet: no fetch in flight for `quietMs`, fonts loaded, images decoded, no startup screen. */
    async ready({ timeout = 20000, quietMs = 700, allowStartup = false } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const state = await page.evaluate(() => {
          const st = window.__refshots || { inflight: 0, lastChange: 0 };
          const startup = !!document.querySelector('[data-startup-screen]');
          const spinners = [...document.querySelectorAll('.animate-spin')].filter((e) => e.getBoundingClientRect().width > 0).length;
          const imgs = [...document.images].filter((i) => !i.complete).length;
          return { inflight: st.inflight, idleFor: performance.now() - st.lastChange, startup, spinners, imgs, fonts: document.fonts.status };
        }).catch(() => null);
        const netQuiet = !net || (net.inflight.size === 0 && Date.now() - net.last >= quietMs);
        if (state && netQuiet && state.inflight === 0 && state.idleFor >= quietMs && (allowStartup || !state.startup)
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
        lang: cell.lang, file: rel, sha256, stable, scrolled: h.scrolledTo > 0, unmocked: recorder.countFor(scenario.id, persona.name) });
      log(`  ✓ ${rel}${stable ? '' : ' (unstable frames)'}`);
      return rel;
    },

    /** Bottom tab bar (src/components/BottomNav.tsx: data-tour="tab-<id>"). */
    async tab(id) {
      await h.ready();
      const tab = page.locator(`[data-tour="tab-${id}"]`).first();
      // A tap during a screen change can be dropped: retry until the tab reports aria-current="page".
      for (let i = 0; i < 5; i++) {
        await tab.click();
        try { await page.locator(`[data-tour="tab-${id}"][aria-current="page"]`).first().waitFor({ timeout: 3000 }); break; }
        catch { if (i === 4) throw new ShotError(`tab ${id} did not activate`); }
      }
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
        // ToolsHub reads initialTool only when it mounts: leave the Tools tab first.
        await h.tab('home');
      }
      await h.deeplink('tool', { tool_id: id });
    },

    /** In-app deeplink (src/pages/Index.tsx handleDeeplink): action tab|tool|screen|messages|user-profile|community-post. */
    async deeplink(action, params) {
      // The listener lives in the shell (src/pages/Index.tsx); wait until the tab bar is mounted.
      await page.locator('[data-tour^="tab-"]').first().waitFor({ timeout: 30000 });
      await h.ready();
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

    /** Scroll the app's main scroll container (or the window) to y px. Content that arrives after the first
     *  scroll can grow the page (the first scrollTop was clamped) or shift it, so the scroll is re-applied until
     *  the position and the scroll height are both stable. */
    async scroll(y) {
      h.scrolledTo = y;
      let last = null;
      for (let i = 0; i < 6; i++) {
        const now = await page.evaluate((top) => {
          const el = document.querySelector('[data-subscreen] [data-scroll-container]') || document.querySelector('[data-scroll-container]');
          const target = el && el.scrollHeight > el.clientHeight ? el : document.scrollingElement;
          target.scrollTo({ top, behavior: 'instant' });
          return `${Math.round(target.scrollTop)}:${target.scrollHeight}`;
        }, y);
        await sleep(150);
        await h.ready();
        if (now === last) break;
        last = now;
      }
    },

    sleep,
  };
  return h;
}
