import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumePendingPushNav, intentFromPushData, navigateFromPush, PUSH_NAV_EVENT } from './pushNav';

const SENDER = '01234567-89ab-4cde-8fab-0123456789ab';
const CURRENT = 'https://current-app.example.test';
const AZURE = 'https://anacan-gateway.example.azurecontainerapps.io';

describe('push type mapping', () => {
  it.each(['message', 'partner_message', 'love', 'thank_you'])('preserves %s partner navigation', (type) => {
    expect(intentFromPushData({ type })).toEqual({ motherChat: true });
  });

  it('uses only the server sender UUID for a direct message', () => {
    expect(intentFromPushData({
      type: 'direct_message', sender_id: SENDER.toUpperCase(), userId: 'not-the-sender',
      userName: 'Forged name', avatar_url: 'https://untrusted.example/avatar.png',
    })).toEqual({ tab: 'community', communityTarget: { dmUserId: SENDER } });
  });

  it.each([
    undefined, null, '', 'not-a-uuid', 42, [SENDER], { user_id: SENDER },
    `${SENDER} `, `${SENDER},receiver_id.eq.other`, '01234567-89ab-4cde-0fab-0123456789ab',
  ])('falls back to conversations for an invalid sender (%j)', (sender_id) => {
    expect(intentFromPushData({ type: 'direct_message', sender_id, senderId: SENDER, user_id: SENDER }))
      .toEqual({ tab: 'community', communityTarget: { conversations: true } });
  });

  it('maps shopping without guessing the recipient role', () => {
    expect(intentFromPushData({ type: 'shopping_list' })).toEqual({ shoppingList: true });
  });

  it.each(['sos', 'sos_alert', 'birth', 'birth_alert'])('returns Home for %s', (type) => {
    expect(intentFromPushData({ type })).toEqual({ tab: 'home' });
  });

  it.each([
    ['community_like', { postId: 'post' }],
    ['community_comment', { postId: 'post' }],
    ['community_reply', { postId: 'post', commentId: 'comment' }],
    ['comment_like', { postId: 'post', commentId: 'comment' }],
    ['story_like', { storyId: 'story' }],
    ['story_reply', { storyId: 'story' }],
  ])('preserves the exact %s target', (type, communityTarget) => {
    expect(intentFromPushData({ type, postId: 'post', commentId: 'comment', storyId: 'story' }))
      .toEqual({ tab: 'community', communityTarget });
  });

  it.each(['like', 'comment', 'community'])('preserves generic %s navigation', (type) => {
    expect(intentFromPushData({ type })).toEqual({ tab: 'community' });
  });

  it.each([
    ['premium_expired', { screen: 'billing' }], ['subscription', { screen: 'billing' }],
    ['contraction_511', { screen: 'live-contractions' }],
    ['appointment', { screen: 'calendar' }], ['appointment_reminder', { screen: 'calendar' }],
    ['flow_reminder', { tab: 'home' }], ['period_reminder', { tab: 'home' }], ['pill_reminder', { tab: 'home' }],
  ])('preserves %s navigation', (type, intent) => {
    expect(intentFromPushData({ type })).toEqual(intent);
  });

  it.each([{}, { type: 'unknown' }, { type: '' }])('ignores unknown types (%j)', (data) => {
    expect(intentFromPushData(data)).toBeNull();
  });
});

describe('push link trust boundary and pending intents', () => {
  const navigate = vi.fn();
  const dispatch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    consumePendingPushNav();
    vi.stubEnv('VITE_SUPABASE_URL', AZURE);
    // Never give any test URL to a real browser/location setter.
    vi.stubGlobal('window', {
      location: {
        origin: CURRENT,
        get href() { return `${CURRENT}/`; },
        set href(url: string) { navigate(url); },
      },
      dispatchEvent: dispatch,
    });
  });

  afterEach(() => {
    consumePendingPushNav();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    'anacan://tool/shopping', 'com.atlasoon.anacan://messages',
    'https://anacan.az/community', 'https://www.anacan.az/',
    'https://app.anacan.az/tool/shopping', 'https://anacanapp.lovable.app/messages',
    `${CURRENT}/community`, `${AZURE}/messages`,
  ])('accepts the exact app destination %s', (deeplink) => {
    navigateFromPush({ type: 'shopping_list', deeplink });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(deeplink);
    expect(dispatch).not.toHaveBeenCalled();
    expect(consumePendingPushNav()).toBeNull();
  });

  it('resolves an existing relative-path convention against the current app, not another origin', () => {
    navigateFromPush({ deeplink: '/tool/shopping' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(`${CURRENT}/tool/shopping`);
  });

  it.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' \tjava\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd',
    `blob:${CURRENT}/id`, 'about:blank', 'intent://messages', 'otherapp://messages',
    'capacitor://app.anacan.az/messages', 'anacan:messages', 'tel:12345',
    'http://app.anacan.az/messages', `http://${new URL(CURRENT).host}/messages`,
    'https://attacker.example/messages', '//attacker.example/messages',
    'https://app.anacan.az.attacker.example/', 'https://notanacan.az/',
    'https://unknown.anacan.az/', 'https://another-project.lovable.app/',
    'https://another-gateway.example.azurecontainerapps.io/',
    'https://attacker.example/?next=https://app.anacan.az/',
    'https://app.anacan.az@attacker.example/', 'https://user:password@app.anacan.az/',
    'anacan://user:password@messages', 'https://app.anacan.az:444/messages',
    'https://[invalid',
  ])('rejects %s and still applies a mapped type', (deeplink) => {
    navigateFromPush({ type: 'direct_message', sender_id: SENDER, deeplink });
    expect(navigate).not.toHaveBeenCalled();
    const event = dispatch.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(PUSH_NAV_EVENT);
    expect(event.detail).toEqual({ tab: 'community', communityTarget: { dmUserId: SENDER } });
    expect(consumePendingPushNav()).toEqual(event.detail);
    expect(consumePendingPushNav()).toBeNull();
  });

  it.each([undefined, '', 'not-a-url', 'http://configured.example', 'javascript:alert(1)'])
    ('does not widen trust for an invalid configured origin (%s)', (configured) => {
      vi.stubEnv('VITE_SUPABASE_URL', configured);
      navigateFromPush({ deeplink: `${AZURE}/messages` });
      expect(navigate).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      navigateFromPush({ deeplink: 'https://app.anacan.az/messages' });
      expect(navigate).toHaveBeenCalledExactlyOnceWith('https://app.anacan.az/messages');
    });

  it('uses only the configured origin, not its entire shared hosting domain', () => {
    vi.stubEnv('VITE_SUPABASE_URL', `${AZURE}/api/`);
    navigateFromPush({ deeplink: `${AZURE}/messages` });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(`${AZURE}/messages`);
  });

  it('keeps only the latest pending intent and consumes it once', () => {
    navigateFromPush({ type: 'appointment' });
    navigateFromPush({ type: 'birth_alert' });
    expect(consumePendingPushNav()).toEqual({ tab: 'home' });
    expect(consumePendingPushNav()).toBeNull();
  });

  it('clears an older pending intent when an approved URL takes precedence', () => {
    navigateFromPush({ type: 'appointment' });
    navigateFromPush({ deeplink: 'anacan://community' });
    expect(consumePendingPushNav()).toBeNull();
  });

  it('falls back to the mapped intent if opening a trusted URL fails', () => {
    navigate.mockImplementation(() => { throw new Error('Navigation unavailable'); });
    navigateFromPush({ type: 'shopping_list', deeplink: 'anacan://tool/shopping' });
    expect(consumePendingPushNav()).toEqual({ shoppingList: true });
  });
});
