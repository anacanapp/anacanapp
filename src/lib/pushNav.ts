/**
 * Push bildirişi → tətbiq-daxili naviqasiya körpüsü.
 *
 * Problem: köhnə handler `window.location.hash = '#/?tab=...'` yazırdı,
 * amma naviqasiya state-əsaslıdır və heç nə hash-ı oxumurdu →
 * push toxunuşları HEÇ YERƏ aparmırdı.
 *
 * Həll: data.type → intent; Index CustomEvent ilə tətbiq edir.
 * Soyuq başlanğıc üçün pending saxlanılır (Index mount olanda istehlak edir).
 *
 * DÜZƏLİŞ (Community bildirişləri): əvvəllər `community_reply`/`comment_like`/
 * `story_like`/`story_reply` bu switch-də HEÇ olmadığı üçün toxunuşları HEÇ
 * YERƏ aparmırdı (default: null). Digər community tiplər (`community_like`/
 * `community_comment`) isə YALNIZ ümumi Community tab-ına keçirdi — postId/
 * commentId/storyId FCM data-sında artıq gəlirdi (bax send-push-notification
 * edge function-un fcmData tərtibi), sadəcə oxunmurdu. İndi `communityTarget`
 * sahəsi ilə bu ID-lər Index.tsx-ə qədər aparılır (bax CommunityScreen.tsx-in
 * `deepLinkTarget` prop-u, SinglePostView.tsx).
 */

import { validate as isUuid } from 'uuid';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import type { CommunityDeepLinkTarget } from '@/components/community/CommunityScreen';

export interface PushNavIntent {
  tab?: string;
  screen?: string;
  /** Qadın tərəfdə partner söhbəti (MessagesScreen) */
  motherChat?: boolean;
  shoppingList?: boolean;
  /** Community-yə keçəndə MƏHZ hansı post/şərh/story-nin açılacağı (bax CommunityDeepLinkTarget) */
  communityTarget?: CommunityDeepLinkTarget;
}

export const PUSH_NAV_EVENT = 'anacan-push-nav';

let pending: PushNavIntent | null = null;

/** data.type → intent xəritəsi. Bilinməyən tip = sadəcə tətbiqi aç. */
export function intentFromPushData(data: Record<string, any>): PushNavIntent | null {
  const type = String(data?.type || '');

  switch (type) {
    case 'message':
    case 'partner_message':
    case 'love':
    case 'thank_you':
      return { motherChat: true }; // Index rola görə partner chat tab-ına çevirir
    case 'direct_message':
      return {
        tab: 'community',
        communityTarget: typeof data.sender_id === 'string' && isUuid(data.sender_id)
          ? { dmUserId: data.sender_id.toLowerCase() }
          : { conversations: true },
      };
    case 'shopping_list':
      return { shoppingList: true };
    case 'group_message':
    case 'group_invite':
    case 'group_join_request':
      return typeof data.groupId === 'string' && isUuid(data.groupId)
        ? { tab: 'community', communityTarget: { groupId: data.groupId.toLowerCase() } }
        : { tab: 'community' };
    case 'community_like':
    case 'community_comment':
      return { tab: 'community', communityTarget: { postId: data?.postId } };
    case 'community_moderation':
      return typeof data.postId === 'string' && isUuid(data.postId)
        ? { tab: 'community', communityTarget: { postId: data.postId.toLowerCase() } }
        : { tab: 'community' };
    case 'moderation_action':
      return { screen: 'moderation-history' };
    case 'community_reply':
      return { tab: 'community', communityTarget: { postId: data?.postId,
        commentId: typeof data.interactionId === 'string' && isUuid(data.interactionId) ? data.interactionId : data?.commentId } };
    case 'comment_like':
      return { tab: 'community', communityTarget: { postId: data?.postId, commentId: data?.commentId } };
    case 'story_like':
    case 'story_reply':
      return { tab: 'community', communityTarget: { storyId: data?.storyId } };
    case 'like':
    case 'comment':
    case 'community':
      return { tab: 'community' };
    case 'premium_expired':
    case 'subscription':
      return { screen: 'billing' };
    case 'contraction_511':
      return { screen: 'live-contractions' }; // partner tərəf
    case 'appointment':
    case 'appointment_reminder':
      return { screen: 'calendar' };
    case 'flow_reminder':
    case 'period_reminder':
    case 'pill_reminder':
      return { tab: 'home' };
    case 'sos':
    case 'sos_alert':
    case 'birth':
    case 'birth_alert':
      // Home mounts AlertReceiver even when a sub-screen was open.
      return { tab: 'home' };
    default:
      return null;
  }
}

/** Push toxunuşunda çağırılır (useDeviceToken). */
export function navigateFromPush(data: Record<string, any>): void {
  // Preserve explicit links only within the app's registered schemes/origins.
  if (typeof data?.deeplink === 'string' && data.deeplink.trim()) {
    try {
      const url = new URL(data.deeplink, window.location.href);
      const trustedOrigins = [
        window.location.origin,
        'https://anacan.az',
        'https://www.anacan.az',
        'https://app.anacan.az',
        'https://anacanapp.lovable.app',
      ];
      try {
        const configured = new URL(getBackendConfig().url);
        if (configured.protocol === 'https:' && !configured.username && !configured.password) {
          trustedOrigins.push(configured.origin);
        }
      } catch { /* An absent/invalid build URL grants no extra origin. */ }

      const appScheme = ['anacan:', 'com.atlasoon.anacan:'].includes(url.protocol)
        && url.href.startsWith(`${url.protocol}//`);
      if (!url.username && !url.password && (appScheme ||
        (url.protocol === 'https:' && trustedOrigins.includes(url.origin)))) {
        window.location.href = url.href;
        pending = null;
        return;
      }
    } catch {/* aşağıdakı intent yolu ilə davam */}
  }

  const intent = intentFromPushData(data);
  if (!intent) return;

  pending = intent;
  try {
    window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: intent }));
  } catch (e) {
    console.warn('[pushNav] dispatch failed:', e);
  }
}

/** Index mount olanda soyuq başlanğıc intentini götürür. */
export function consumePendingPushNav(): PushNavIntent | null {
  const p = pending;
  pending = null;
  return p;
}
