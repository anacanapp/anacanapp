/**
 * Links to the app itself inside user text (chat messages, comments): https://app.anacan.az/... and anacan://...
 * that parseDeeplink understands open in the app through the existing `anacan:deeplink` event (Index.tsx routes it
 * like a banner or a universal link). Anything else (other hosts, unknown paths) stays an ordinary link.
 */
import { parseDeeplink, type ParsedDeeplink } from './deeplink';

export const APP_DEEPLINK_EVENT = 'anacan:deeplink';
const APP_ORIGIN = 'https://app.anacan.az';

/** The in-app route of a link, or null when the link is not an app link the router knows. */
export function inAppDeeplink(href: string): ParsedDeeplink | null {
  try {
    const url = new URL(href);
    if (url.username || url.password || url.port) return null;
    const ours = url.protocol === 'anacan:' || (url.protocol === 'https:' && url.origin === APP_ORIGIN);
    return ours ? parseDeeplink(url.href) : null;
  } catch { return null; }
}

/** Route a parsed app link in-app (same path as banners and universal links). */
export function openInAppDeeplink(parsed: ParsedDeeplink) {
  window.dispatchEvent(new CustomEvent<ParsedDeeplink>(APP_DEEPLINK_EVENT, { detail: parsed }));
}
