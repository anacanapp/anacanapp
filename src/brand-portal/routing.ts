export const BRAND_PORTAL_PATH = '/brands';
export function isBrandPortalPath(pathname: string) {
  return pathname === BRAND_PORTAL_PATH || pathname.startsWith(BRAND_PORTAL_PATH + '/');
}
