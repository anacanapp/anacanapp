import { beforeEach, describe, expect, it } from 'vitest';
import { APP_LINK_TTL_MS, appLinkForPath, rememberAppLink, takeAppLink } from './app-path-links';
import { parseDeeplink } from './deeplink';

describe('appLinkForPath', () => {
  it.each([
    ['/tools', 'anacan://tools', { action: 'tab', params: { tab: 'tools' } }],
    ['/tools/', 'anacan://tools', { action: 'tab', params: { tab: 'tools' } }],
    ['/premium', 'anacan://premium', { action: 'screen', params: { screen: 'billing' } }],
    ['/tool/kick-counter', 'anacan://tool/kick-counter', { action: 'tool', params: { tool_id: 'kick-counter' } }],
    ['/community/post/7f1c2d9e-1b2a-4c3d-9e8f-001122334455', 'anacan://community/post/7f1c2d9e-1b2a-4c3d-9e8f-001122334455',
      { action: 'community-post', params: { post_id: '7f1c2d9e-1b2a-4c3d-9e8f-001122334455' } }],
    ['/community', 'anacan://community', { action: 'tab', params: { tab: 'community' } }],
    ['/books', 'anacan://books', { action: 'screen', params: { screen: 'books' } }],
    ['/parenting/sos/shop-tantrum', 'anacan://parenting/sos/shop-tantrum',
      { action: 'tool', params: { tool_id: 'parenting', parenting_kind: 'sos', parenting_id: 'shop-tantrum' } }],
    ['/user/abc-123', 'anacan://user/abc-123', { action: 'user-profile', params: { user_id: 'abc-123' } }],
  ])('%s opens the app screen', (path, href, parsed) => {
    expect(appLinkForPath(path)).toBe(href);
    expect(parseDeeplink(href!)).toEqual(parsed);
  });

  it('keeps a supported language and drops every other query value', () => {
    expect(appLinkForPath('/tools', '?language=ru&next=https://evil.example')).toBe('anacan://tools?language=ru');
    expect(appLinkForPath('/tools', '?language=xx')).toBe('anacan://tools');
  });

  it.each([
    '/', '', '/nope', '/tool', '/tool/a/b', '/community/post', '/community/post/a/b', '/tools/extra',
    '/blog', '/legal/privacy', '/tool/%3Cscript%3E', '/tool/..', '/community/post/a.b', '/wp-admin.php',
    `/tool/${'a'.repeat(101)}`,
  ])('%s stays a 404', (path) => {
    expect(appLinkForPath(path)).toBeNull();
  });
});

describe('remembered app link', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('is handed over once', () => {
    rememberAppLink('anacan://tools', 1000);
    expect(takeAppLink(2000)).toBe('anacan://tools');
    expect(takeAppLink(2000)).toBeNull();
  });

  it('expires and ignores tampered values', () => {
    rememberAppLink('anacan://premium', 0);
    expect(takeAppLink(APP_LINK_TTL_MS + 1)).toBeNull();
    sessionStorage.setItem('anacan_pending_app_link', JSON.stringify({ href: 'https://evil.example', at: 0 }));
    expect(takeAppLink(1)).toBeNull();
    sessionStorage.setItem('anacan_pending_app_link', '{');
    expect(takeAppLink(1)).toBeNull();
  });
});
