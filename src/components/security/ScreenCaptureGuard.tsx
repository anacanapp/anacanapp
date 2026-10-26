import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import ScreenshotGuard from '@/plugins/ScreenshotGuard';

export function dashboardCaptureAllowed() {
  const dashboard = document.querySelector('[data-main-dashboard="true"]');
  if (!dashboard || document.querySelector('[role="dialog"], [aria-modal="true"], .chat-screen, [data-onboarding-step]')) return false;
  return ![...document.querySelectorAll<HTMLElement>('.fixed')].some(element => {
    if (element === dashboard || element.dataset.captureCurtain !== undefined || !element.getClientRects().length) return false;
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && Number(style.opacity) !== 0 && Number(style.zIndex) >= 40 && box.width >= innerWidth * .8 && box.height >= innerHeight * .65;
  });
}
export default function ScreenCaptureGuard() {
  const [black, setBlack] = useState(false);
  useEffect(() => {
    let alive = true, allowed = false, captured = false, frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    let queued = Promise.resolve(), generation = 0;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const native = Capacitor.isNativePlatform();
    const apply = (permit: boolean) => {
      if (allowed === permit && document.documentElement.dataset.captureAllowed !== undefined) return;
      allowed = permit; document.documentElement.dataset.captureAllowed = String(permit);
      if (native) { const version = ++generation; queued = queued.catch(() => {}).then(async () => { if (version !== generation || !alive) return; await ScreenshotGuard.setEnabled({ enabled: !permit }); }).catch(() => {}); }
      if (alive) setBlack(captured && !permit);
    };
    // PERF: dashboardCaptureAllowed() scans every `.fixed` node with layout reads.
    // Leading+trailing throttle (~300ms): the first change after a quiet period
    // is evaluated on the next frame (no extra protection latency), a burst of
    // DOM mutations collapses into one trailing re-check.
    const THROTTLE_MS = 300;
    let lastRun = -Infinity, throttle: ReturnType<typeof setTimeout> | undefined;
    const update = () => { frame = 0; lastRun = Date.now(); apply(dashboardCaptureAllowed()); };
    const schedule = () => {
      if (frame || throttle) return;
      const wait = THROTTLE_MS - (Date.now() - lastRun);
      if (wait <= 0) frame = requestAnimationFrame(update);
      else throttle = setTimeout(() => { throttle = undefined; if (alive && !frame) frame = requestAnimationFrame(update); }, wait);
    };
    const flash = () => { if (allowed) return; setBlack(true); clearTimeout(timer); timer = setTimeout(() => { if (alive) setBlack(captured && !allowed); }, 1400); };
    const key = (event: KeyboardEvent) => { if (event.key === 'PrintScreen') flash(); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-main-dashboard','role','aria-modal','data-state','hidden'] });
    // Native protection follows the mounted screen, not the start of a gesture.
    // On iOS setEnabled reparents WKWebView; doing that between pointerdown and
    // pointerup cancels taps and scrolls before their handlers can run.
    document.addEventListener('keydown', key, true);
    apply(false); schedule();
    if (native) {
      void ScreenshotGuard.addListener('screenshotTaken', flash).then(handle => { if (alive) handles.push(handle); else void handle.remove(); }).catch(() => {});
      void ScreenshotGuard.addListener('captureChanged', event => { captured = event.captured; if (alive) setBlack(captured && !allowed); }).then(handle => { if (alive) handles.push(handle); else void handle.remove(); }).catch(() => {});
    }
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); clearTimeout(throttle); handles.forEach(handle => void handle.remove()); document.removeEventListener('keydown', key, true); delete document.documentElement.dataset.captureAllowed; };
  }, []);
  return black ? createPortal(<div data-capture-curtain aria-hidden="true" style={{ position:'fixed', inset:0, background:'#000', opacity:1, zIndex:2147483647, pointerEvents:'auto' }} />, document.body) : null;
}
