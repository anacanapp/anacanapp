import { moderationText, type ModerationCopyKey } from './community-moderation-i18n';

export type AdReviewState = 'checking' | 'review' | 'approved' | 'rejected' | 'superseded' | 'withdrawn';
export const AD_REASONS = ['commercial_offer', 'contact_solicitation', 'referral', 'recruitment', 'external_group', 'deceptive_promotion',
  'media_review', 'uncertain', 'check_unavailable', 'not_advertising', 'other', 'blocked_account'] as const;
export const isHeldPost = (state?: string | null) => ['checking', 'review', 'rejected'].includes(state || '');
export function moderationReason(reason: string | null | undefined, language?: string) {
  return moderationText(`reason_${AD_REASONS.includes(reason as typeof AD_REASONS[number]) ? reason : 'uncertain'}` as ModerationCopyKey, language);
}
export function moderationError(error: unknown, language?: string) {
  const value = error as { code?: string; message?: string };
  if (/MODERATION_MEDIA_/.test(value?.message || '')) return moderationText('media_reupload', language);
  if (['PGRST202', '42883'].includes(value?.code || '') || /MODERATION_REQUIRED/.test(value?.message || '')) return moderationText('unavailable', language);
  if (/CONFLICT|40001/.test(`${value?.code} ${value?.message}`)) return moderationText('conflict', language);
  return moderationText('save_failed', language);
}
export interface OwnAdReview {
  id: string; post_id: string; revision: number; state: AdReviewState; language: string | null;
  created_at: string; reviewed_at: string | null; decision_reason: string | null; content: string; media_urls: string[]; technical: boolean;
}
export interface AdReviewItem {
  id: string; post_id: string | null; author_id: string; revision: number; state: AdReviewState; language: string | null;
  created_at: string; updated_at: string; reviewed_at: string | null; decision_reason: string | null; attempts: number;
  preview: string; is_anonymous: boolean; media_count: number; score: number | null; reasons: string[] | null; author_name: string | null; last_error: string | null;
}
export interface AdReviewDetail extends Omit<AdReviewItem, 'preview' | 'media_count' | 'is_anonymous' | 'score' | 'reasons'> {
  current: boolean; moderator_note: string | null; reviewed_by: string | null;
  payload: { content: string; media_urls: string[]; is_anonymous: boolean; blog_post_id?: string | null };
  assessment: { score: number | null; reasons: string[]; evidence: string[]; visualEvidence?: string[]; confidence: number | null; policyVersion: string; model?: string; mediaComplete: boolean } | null;
  events: { id: string; event: string; actor_id: string | null; detail: { reason?: string; note?: string }; created_at: string }[];
  deliveries: { id: string; channel: 'admin_email' | 'author_push'; event: string; state: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'skipped'; attempts: number; error_code: string | null; finished_at: string | null }[];
}
export interface AdReviewQueue {
  items: AdReviewItem[]; total: number; stats: Record<'checking' | 'review' | 'approved' | 'rejected', number>;
  worker: { last_seen_at: string; report: { providerConfigured: boolean; emailConfigured: boolean; pushConfigured: boolean } } | null;
}
