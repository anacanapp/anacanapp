import { moderatorText, type ModeratorTextKey } from './moderator-i18n';
export const MODERATOR_REASONS = ['advertising', 'spam', 'harassment', 'misinformation', 'privacy', 'inappropriate', 'impersonation', 'other'] as const;
export const MODERATOR_SCOPES = ['community', 'post', 'story', 'comment', 'message', 'full'] as const;
export type ModeratorScope = typeof MODERATOR_SCOPES[number];
export type ModeratorKind = 'post' | 'comment' | 'story' | 'user';
export type ModeratorAction = 'warn' | 'restrict' | 'unrestrict' | 'edit' | 'remove' | 'restore' | 'pin' | 'unpin' | 'lock_comments' | 'unlock_comments';
export interface ModeratorTarget { kind: ModeratorKind; id: string; userId: string; name?: string | null; content?: string; version?: number; restrictionId?: string; legacy?: boolean; isPinned?: boolean; removed?: boolean; commentsLocked?: boolean }
export interface ModeratorContent { id: string; user_id: string; user_name?: string; kind: ModeratorKind; version: number; moderation_version?: number | null; moderation_removed_at?: string | null; moderation_reason?: string | null; moderation_action_id?: string | null; moderation_edited_at?: string | null; moderation_edited_by?: string | null; comments_locked?: boolean | null; is_pinned?: boolean | null; content?: string; text_overlay?: string | null; media_urls?: string[] | null; image_url?: string | null; media_url?: string; media_type?: string; created_at: string; language?: string | null; post_id?: string; }
export interface ModeratorRestriction { id: string; scope: ModeratorScope; reason: string; detail: string | null; created_at: string; expires_at: string | null; legacy: boolean }
export interface ModerationStatus { user_id: string; checked_at: string; language: string; restrictions: ModeratorRestriction[]; full: boolean; community: boolean; post: boolean; story: boolean; comment: boolean; message: boolean; pending_warnings: number }
export interface ModeratorAccess { protocol: string; user_id: string; role: 'admin' | 'moderator' | null; allowed: boolean; network_mode: 'off' | 'observe' | 'enforce' | null }
export interface ModeratorWarning { id: string; claim_id: string; reason: string; detail: string; created_at: string; language: string }
export interface ModeratorPage<T = Record<string, any>> { items: T[]; total: number }
export function isModeratorSignupError(error: unknown): boolean {
  return /MODERATOR_(SIGNUP_NETWORK_RESTRICTED|REGISTRATION_IP_UNAVAILABLE)/i.test(String((error as { message?: string })?.message || ''));
}
export function moderatorReason(value: string | null | undefined, language?: string, body = false) {
  const reason = MODERATOR_REASONS.includes(value as typeof MODERATOR_REASONS[number]) ? value : 'other';
  return moderatorText(`reason_${reason}${body ? '_body' : ''}` as ModeratorTextKey, language);
}
export function moderatorError(error: unknown, language?: string) {
  const value = error as { code?: string; message?: string }; const message = `${value?.code || ''} ${value?.message || ''}`;
  const key: ModeratorTextKey = /PGRST202|42883/.test(message) ? 'unavailable'
    : /PROTECTED_ACCOUNT/.test(message) ? 'protected_account' : /ADMIN_DECISION/.test(message) ? 'admin_decision'
    : /CONFLICT|40001|ALREADY_ASSIGNED/.test(message) ? 'conflict' : /NETWORK_NOT_READY/.test(message) ? 'ip_unavailable'
    : /IP_OBSERVATION_REQUIRED/.test(message) ? 'ip_no_observation' : /SIGNUP_NETWORK_RESTRICTED|REGISTRATION_IP_UNAVAILABLE/.test(message) ? 'signup_restricted'
    : /MODERATOR_REQUIRED|MODERATOR_AUTH_REQUIRED/.test(message) ? 'moderator_required' : /STORY_EXPIRED/.test(message) ? 'restore_expired_story'
    : /COMMENTS_LOCKED/.test(message) ? 'comments_closed' : /APP_RESTRICTED/.test(message) ? 'full_restricted'
    : /ACTIVITY_RESTRICTED|COMMUNITY_RESTRICTED/.test(message) ? 'restriction_notice' : 'error';
  return moderatorText(key, language);
}
