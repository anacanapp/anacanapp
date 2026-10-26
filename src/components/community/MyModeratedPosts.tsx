import { useEffect, useState } from 'react';
import { Clock3, Loader2, Pencil, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useMyAdReviews } from '@/hooks/useCommunityModeration';
import { useDeletePost, useEditPost } from '@/hooks/useCommunity';
import { useUserStore } from '@/store/userStore';
import { moderationText } from '@/lib/community-moderation-i18n';
import { moderationError, moderationReason, type OwnAdReview } from '@/lib/community-moderation';

function ReviewCard({ review, onRemoved }: { review: OwnAdReview; onRemoved?: () => void }) {
  const language = useUserStore(state => state.language), t = (key: Parameters<typeof moderationText>[0]) => moderationText(key, language);
  const [editing, setEditing] = useState(false), [content, setContent] = useState(review.content);
  const edit = useEditPost(), remove = useDeletePost();
  const pending = edit.isPending || remove.isPending;
  const prefix = review.state === 'checking' ? 'checking' : review.state === 'rejected' ? 'rejected' : review.state === 'approved' ? 'approved' : review.technical ? 'technical' : 'review';
  return <article className="a-card space-y-3" data-testid="own-moderated-post" data-review-state={review.state}>
    <div className="flex items-start gap-3"><ShieldCheck size={22} className="shrink-0 text-primary" /><div className="min-w-0">
      <h3 className="font-bold text-sm leading-relaxed">{t(`${prefix}_title`)}</h3>
      <p className="text-sm mt-1 leading-relaxed text-muted-foreground">{t(`${prefix}_body`)}</p>
    </div></div>
    {review.decision_reason && <p className="rounded-xl bg-muted p-3 text-sm"><strong>{t('reason')}: </strong>{moderationReason(review.decision_reason, language)}</p>}
    {editing ? <div className="space-y-2"><textarea aria-label={t('content')} value={content} onChange={event => setContent(event.target.value)} maxLength={20000}
      className="w-full min-h-32 rounded-xl border bg-background p-3 text-base" />
      <div className="flex flex-wrap gap-2"><button type="button" disabled={pending || !content.trim() || content === review.content} className="a-btn-soft min-h-11"
        onClick={() => edit.mutate({ postId: review.post_id, content: content.trim(), currentLanguage: review.language, expectedRevision: review.revision }, { onSuccess: () => setEditing(false) })}>
        {edit.isPending && <Loader2 size={15} className="animate-spin" />}{t('edit')}</button>
        <button type="button" disabled={pending} className="a-btn-soft min-h-11" onClick={() => setEditing(false)}>{t('cancel')}</button></div>
    </div> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{review.content}</p>}
    {review.media_urls?.length > 0 && <p className="text-xs text-muted-foreground">{t('media')}: {review.media_urls.length}</p>}
    {!editing && review.state !== 'approved' && <div className="flex flex-wrap gap-2">
      <button type="button" className="a-btn-soft min-h-11" disabled={pending} onClick={() => { setContent(review.content); setEditing(true); }}><Pencil size={15} />{t('edit')}</button>
      <button type="button" className="a-btn-soft min-h-11" disabled={pending} onClick={() => { if (window.confirm(t('withdraw_confirm'))) remove.mutate(review.post_id, { onSuccess: onRemoved }); }}><Trash2 size={15} />{t('withdraw')}</button>
    </div>}
    {review.state !== 'approved' && <p className="text-xs text-muted-foreground flex gap-2 leading-relaxed"><Clock3 size={14} className="shrink-0" />{t('private_status')}</p>}
  </article>;
}

export default function MyModeratedPosts({ postId = null, onRemoved, onPresenceChange }: { postId?: string | null; onRemoved?: () => void; onPresenceChange?: (present: boolean) => void }) {
  const language = useUserStore(state => state.language), [page, setPage] = useState(0);
  const query = useMyAdReviews(postId, page), t = (key: Parameters<typeof moderationText>[0]) => moderationText(key, language);
  useEffect(() => { onPresenceChange?.(!!query.data?.length); }, [query.data, onPresenceChange]);
  if (query.isError) return <div className="a-card text-sm space-y-3" role="alert"><p>{moderationError(query.error, language)}</p>
    <button className="a-btn-soft min-h-11" onClick={() => void query.refetch()}><RefreshCw size={15} />{t('refresh')}</button></div>;
  if (query.isPending) return postId ? <div className="a-card flex items-center gap-2" role="status"><Loader2 className="animate-spin" size={18} />{t('loading')}</div> : null;
  if (!query.data?.length && page === 0) return null;
  return <section className="space-y-3" aria-label={t('my_reviews')}>
    {!postId && <h2 className="font-bold text-sm flex items-center gap-2"><ShieldCheck size={18} />{t('my_reviews')}</h2>}
    {query.data?.map(review => <ReviewCard key={`${review.id}:${review.state}`} review={review} onRemoved={() => { void query.refetch(); onRemoved?.(); }} />)}
    {!postId && (page > 0 || query.data?.length === 30) && <div className="flex justify-between gap-3">
      <button className="a-btn-soft min-h-11" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('previous')}</button>
      <button className="a-btn-soft min-h-11" disabled={query.data?.length !== 30} onClick={() => setPage(value => value + 1)}>{t('next')}</button>
    </div>}
  </section>;
}
