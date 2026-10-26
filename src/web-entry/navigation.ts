import { entryDecision } from './policy.mjs';

/** Recovery/payment/provider pages may use the consumer router. Leaving that
 * exception must re-enter the public launcher or staff gate, rather than mount
 * the dashboard through an in-memory router transition. */
export function guardSystemEntryNavigation(navigate = (url: string) => window.location.replace(url)) {
  const push = history.pushState, replace = history.replaceState;
  const reenter = (input: string | URL | null | undefined) => {
    if (input == null) return false;
    let target: URL;
    try { target = new URL(String(input), location.href); } catch { return false; }
    if (target.origin !== location.origin || entryDecision(target.href) === 'system') return false;
    navigate(target.href);
    return true;
  };
  history.pushState = function (data, unused, url) {
    if (!reenter(url)) push.call(this, data, unused, url);
  };
  history.replaceState = function (data, unused, url) {
    if (!reenter(url)) replace.call(this, data, unused, url);
  };
  const pop = () => { if (entryDecision(location.href) !== 'system') navigate(location.href); };
  window.addEventListener('popstate', pop);
  return () => {
    history.pushState = push; history.replaceState = replace;
    window.removeEventListener('popstate', pop);
  };
}
