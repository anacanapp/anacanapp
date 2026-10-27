import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Trash2, Pencil, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { PostComment, useToggleCommentLike, useEditComment, useDeleteComment } from '@/hooks/useCommunity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { hapticFeedback } from '@/lib/native';
import { useAuth } from '@/hooks/useAuth';
import PhotoGalleryViewer from '@/components/PhotoGalleryViewer';
import { UserBadge, VerifiedTick, isVerifiedActive } from './UserBadge';
import { getLifeStageMeta } from '@/lib/lifeStageLabel';
import { tr } from "@/lib/tr";
import CommentText from './CommentText';
import { useAutoGrowTextarea } from '@/hooks/useAutoGrowTextarea';
import ModeratorActionMenu from '@/components/moderation/ModeratorActionMenu';
import ModeratorActionDialog from '@/components/moderation/ModeratorActionDialog';
import { moderatorText } from '@/lib/moderator-i18n';
import { useUserStore } from '@/store/userStore';

interface CommentReplyProps {
  comment: PostComment;
  postId: string;
  allComments: PostComment[];
  onReply: (comment: PostComment) => void;
  onRefetch: () => void;
  onUserClick?: (userId: string) => void;
  /** true = bu sətir kök şərhin DÜZLƏŞDİRİLMİŞ cavablar siyahısında göstərilir */
  isReply?: boolean;
  /** cavablar üçün: bu nəslin aid olduğu kök şərhin id-si */
  rootId?: string;
  /** Bildiriş/deep-link vasitəsilə açılanda: bu ID-li şərhi/cavabı tapıb vurğula + ekrana sürüşdür */
  highlightCommentId?: string | null;
}

/**
 * Instagram-tipli DÜZ (flat) cavab görünüşü.
 *
 * ƏVVƏLKİ PROBLEM: hər cavab-səviyyəsi əlavə 38px indent alırdı (rekursiv,
 * limitsiz) — 3-4 səviyyəli mövzularda mətn sütunu 40-50px-ə qədər daralıb
 * hərf-bəhərf sətirlərə bölünürdü, "N bəyənmə" də kəsilib "bəyər" görünürdü.
 *
 * HƏLL: kök şərh özünün BÜTÜN nəslini (istənilən dərinlikdə cavaba-cavab
 * daxil) yığıb VAXTA GÖRƏ düzləşdirir, TƏK sabit indent səviyyəsi ilə göstərir
 * (Instagram/Threads məntiqi) — nə qədər dərin cavablansa da sütun genişliyi
 * DƏYİŞMİR. Verilənlər bazasında əsl parent_comment_id (kim kimə cavab verib)
 * toxunulmaz qalır — yalnız GÖRÜNÜŞ düzləşdirilir. Kökə deyil, başqa cavaba
 * cavab verilibsə, "@Ad" prefiksi ilə kontekst itirilmir.
 */
const CommentReply = ({ comment, postId, allComments, onReply, onRefetch, onUserClick, isReply = false, rootId, highlightCommentId }: CommentReplyProps) => {
  const isHighlighted = !!highlightCommentId && comment.id === highlightCommentId;
  const rowRef = useRef<HTMLDivElement>(null);

  // Bildiriş/deep-link ilə açılan konkret şərhə avtomatik sürüşdür — istifadəçi
  // uzun bir mövzuda hansı şərhin nəzərdə tutulduğunu axtarmasın.
  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      const t = setTimeout(() => {
        rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isHighlighted]);
  const [showReplies, setShowReplies] = useState(true);
  // Şərh şəkli in-app lightbox-da açılır (əvvəl window.open ilə brauzerə çıxırdı)
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  // Öz şərhini redaktə etmə — PostCard.tsx-in post-redaktə pattern-i ilə eyni
  const [isEditing, setIsEditing] = useState(false);
  const [moderatorRemove, setModeratorRemove] = useState(false);
  const language = useUserStore(state => state.language);
  const [editContent, setEditContent] = useState(comment.content);
  const { ref: editTextareaRef } = useAutoGrowTextarea(editContent, 180);
  const [editImageUrl, setEditImageUrl] = useState<string | null | undefined>(comment.image_url);
  const { isAdmin, user } = useAuth();
  const editComment = useEditComment();
  const deleteComment = useDeleteComment();
  const toggleCommentLike = useToggleCommentLike();

  const isOwnComment = user?.id === comment.user_id;
  const effectiveRootId = rootId ?? comment.id;

  // Kökün bütün nəsli (istənilən dərinlikdə) — TƏK düzləşdirilmiş siyahı, vaxta görə sıralı
  const replies = useMemo(() => {
    if (isReply) return [];
    const children = new Map<string, PostComment[]>();
    allComments.forEach((item) => {
      if (item.parent_comment_id) children.set(item.parent_comment_id, [...(children.get(item.parent_comment_id) || []), item]);
    });
    const descendants: PostComment[] = [];
    const pending = [comment.id], visited = new Set(pending);
    while (pending.length) {
      for (const child of children.get(pending.pop()!) || []) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        descendants.push(child);
        pending.push(child.id);
      }
    }
    return descendants.sort(
      (a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [isReply, allComments, comment.id]);

  // Kökə yox, başqa cavaba cavabdırsa (köhnə dərin zəncirlər daxil) — "@Ad" göstər
  const repliedToName = useMemo(() => {
    if (!isReply || comment.parent_comment_id === effectiveRootId) return null;
    return allComments.find((c) => c.id === comment.parent_comment_id)?.author?.name || null;
  }, [isReply, comment.parent_comment_id, effectiveRootId, allComments]);

  // Optimistic — ürək dərhal dolur, tam refetch YOXDUR (əvvəllər hər like bütün şərhləri yenidən çəkirdi)
  const handleLikeComment = () => {
    if (!user || toggleCommentLike.isPending) return;
    hapticFeedback.light();
    toggleCommentLike.mutate({ commentId: comment.id, isLiked: comment.is_liked || false, postId });
  };

  // DÜZƏLİŞ: əvvəllər burada xam supabase.delete() (sahiblik yoxlaması olmadan)
  // çağırılırdı və düymə YALNIZ admin üçün göstərilirdi — adi istifadəçi öz
  // şərhini silə bilmirdi. İndi useDeleteComment (RLS-ə əsaslanan) istifadə
  // olunur, düymə həm admin, həm də şərhin sahibi üçün göstərilir.
  const handleDelete = async () => {
    if (isAdmin && !isOwnComment) { setModeratorRemove(true); return; }
    if (!confirm(tr("commentreply_bu_serhi_silmek_isteyirsiniz_fc50c9", "Bu \u015F\u0259rhi silm\u0259k ist\u0259yirsiniz?"))) return;
    deleteComment.mutate({ commentId: comment.id, postId }, { onSuccess: onRefetch });
  };

  const handleEditComment = () => {
    const content = editContent.trim();
    if (!content) return;
    hapticFeedback.light();
    editComment.mutate(
      { commentId: comment.id, content, postId, imageUrl: editImageUrl },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const handleAvatarClick = () => {
    if (comment.user_id && onUserClick && (!comment.is_anonymous || isAdmin)) onUserClick(comment.user_id);
  };
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: getCurrentDateLocale() });
  const authorBadge = (comment.author?.badge_type as 'admin' | 'premium' | 'moderator' | null) || null;
  const authorVerified = isVerifiedActive(comment.author?.is_verified, comment.author?.verified_until);
  const authorLifeStage = comment.is_anonymous ? null : getLifeStageMeta(comment.author?.life_stage);
  const avatarSize = isReply ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <div
      ref={rowRef}
      data-comment-id={comment.id}
      className="min-w-0"
      style={isHighlighted ? {
        background: 'var(--a-peach-1)',
        borderRadius: 14,
        padding: '8px 8px',
        margin: '-8px -8px 0',
        transition: 'background 1.5s ease-out',
      } : undefined}
    >
      <div className="flex gap-2.5 items-start">
        {/* Avatar */}
        <motion.button onClick={handleAvatarClick} disabled={comment.is_anonymous && !isAdmin} whileTap={{ scale: 0.94 }} className="flex-shrink-0">
          <Avatar className={`${avatarSize} cursor-pointer`}>
            <AvatarImage src={comment.author?.avatar_url || undefined} />
            <AvatarFallback className={`bg-primary/8 text-primary font-bold ${isReply ? 'text-[9px]' : 'text-[11px]'}`}>
              {comment.author?.name?.charAt(0) || tr("common_initial_i", "İ")}
            </AvatarFallback>
          </Avatar>
        </motion.button>

        {/* Content column: name+text flow together, meta row below */}
        <div className="flex-1 min-w-0">
          {comment.is_pinned && <p className="flex items-center gap-1 text-xs text-primary font-semibold mb-1"><Pin size={11} />{moderatorText('pinned_comment', language)}</p>}
          {comment.moderation_edited_at && <p className="text-[11px] text-muted-foreground mb-1">{moderatorText('edited_marker', language)}</p>}
          {isEditing ?
          <div className="space-y-1.5">
              {editImageUrl &&
            <div style={{ position: 'relative', width: 56, height: 56 }}>
                  <img src={editImageUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
                  <button
                type="button"
                onClick={() => setEditImageUrl(null)}
                style={{ position: 'absolute', top: -5, insetInlineEnd: -5, width: 18, height: 18, borderRadius: 999, background: 'var(--a-ink)', color: 'var(--a-bg)', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer' }}>
                    <X size={10} />
                  </button>
                </div>
            }
              <Textarea
              ref={editTextareaRef}
              rows={1}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
               className="min-h-[44px] w-full min-w-0 rounded-xl resize-none text-base"
              style={{ background: 'var(--a-surface-soft)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}
              autoFocus />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => { setIsEditing(false); setEditContent(comment.content); setEditImageUrl(comment.image_url); }} className="a-tag" style={{ cursor: 'pointer' }}>
                  {tr("postcard_legv_et_b5e49c", "Ləğv et")}
                </button>
                <button onClick={handleEditComment} disabled={!editContent.trim() || editComment.isPending} className="a-btn-solid">
                  {editComment.isPending ? '...' : tr("common_saxla", "Saxla")}
                </button>
              </div>
            </div> :

          <>
              <p className="community-comment-text" dir="auto">
                <motion.button
                onClick={handleAvatarClick}
                disabled={comment.is_anonymous && !isAdmin}
                whileTap={{ scale: 0.98 }}
                className="font-bold text-foreground align-baseline">
                  {comment.author?.name || tr("commentreply_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}
                </motion.button>
                {authorVerified &&
              <span className="inline-flex align-middle mx-1" style={{ transform: 'translateY(-1px)' }}>
                  <VerifiedTick size={11} />
                </span>
              }
                {!comment.is_anonymous && (authorBadge || comment.author?.is_premium) &&
              <span className="inline-flex align-middle ms-1 mb-0.5">
                  <UserBadge type={authorBadge} premium={comment.author?.is_premium} />
                </span>
              }
                {' '}
                {repliedToName &&
              <span className="text-primary font-semibold">@{repliedToName} </span>
              }
                <span className="text-foreground/85"><CommentText content={comment.content} allowLinks={comment.author?.can_share_links === true || ['admin', 'moderator'].includes(authorBadge || '')} /></span>
              </p>
              {comment.image_url &&
            <img loading="lazy" decoding="async"
              src={comment.image_url}
              alt=""
              style={{ maxWidth: 160, maxHeight: 160, borderRadius: 12, objectFit: 'cover', marginTop: 6, display: 'block', cursor: 'pointer' }}
              onClick={() => setImageViewerOpen(true)} />
            }
            </>
          }

          {/* Meta row: time · likes · reply · (own) edit · (admin/own) delete */}
          {!isEditing &&
          <div className="community-comment-meta">
              <ModeratorActionMenu target={{ kind: 'comment', id: comment.id, userId: comment.user_id, name: comment.author?.name, content: comment.content,
                version: comment.moderation_version || 0, isPinned: !!comment.is_pinned, removed: !!comment.moderation_removed_at }} onDone={onRefetch} />
              {authorLifeStage &&
              <span className="font-semibold" style={{ color: authorLifeStage.ink }}>
                  {authorLifeStage.label}
                </span>
              }
              <span>{timeAgo}</span>
              {(comment.likes_count || 0) > 0 &&
            <span className="font-semibold">
                  {comment.likes_count} {tr("commentreply_beyenme_sayi", "bəyənmə")}
                </span>
            }
              <button onClick={() => onReply(comment)} disabled={comment.id.startsWith('optimistic-')} className="font-bold active:text-primary disabled:opacity-50">
                {tr("commentreply_action_reply", "Cavab")}
              </button>
              {isOwnComment &&
            <button
              onClick={() => { setEditContent(comment.content); setEditImageUrl(comment.image_url); setIsEditing(true); }}
              aria-label={tr('postcard_redakte_et_66cf3b', 'Redaktə et')}
              className="active:text-primary font-bold flex items-center gap-1">
                  <Pencil size={13} />
                </button>
            }
              {(isAdmin || isOwnComment) &&
            <button onClick={handleDelete} aria-label={tr('untranslated_sil_zwa7lz', 'Sil')} className="text-destructive font-bold ms-auto flex items-center gap-1">
                  <Trash2 size={13} />
                </button>
            }
            </div>
          }

        </div>

        {/* Like heart — sağda, Instagram məntiqi */}
        <motion.button
          onClick={handleLikeComment}
          whileTap={{ scale: 0.8 }}
          className="flex-shrink-0 pt-1"
          aria-label={tr("commentreply_beyen", "Bəyən")}>
          <Heart
            className={`w-4 h-4 transition-colors ${comment.is_liked ? 'text-[color:var(--a-pink-ink)] fill-current' : 'text-muted-foreground active:text-[color:var(--a-pink-ink)]'}`} />
        </motion.button>
      </div>

      {/* "N cavab göstər/gizlə" — TƏK dəfə, kök şərh üçün (cavab sətirlərinin öz alt-mövzusu yoxdur) */}
      {!isReply && replies.length > 0 &&
      <button onClick={() => setShowReplies(!showReplies)} className="ms-5 flex items-center gap-2.5 mt-2.5 text-xs text-muted-foreground font-bold">
          <span className="w-6 h-px bg-border/40" />
          {showReplies ?
        tr("commentreply_cavablari_gizle", "Cavabları gizlə") :
        tr("commentreply_n_cavab_goster", "{n} cavab göstər").replace('{n}', String(replies.length))
        }
        </button>
      }

      {/* Düzləşdirilmiş cavablar — TƏK sabit indent + bağlayıcı xətt (mövzunu qruplaşdırır) */}
      {moderatorRemove && <ModeratorActionDialog target={{ kind: 'comment', id: comment.id, userId: comment.user_id, name: comment.author?.name, content: comment.content }}
        action="remove" onClose={() => setModeratorRemove(false)} onDone={onRefetch} />}
      <AnimatePresence>
        {!isReply && showReplies && replies.length > 0 &&
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="ms-2 ps-3 min-w-0 border-s-2 border-border/30 space-y-4 mt-3">
              {replies.map((reply) =>
            <CommentReply key={reply.id} comment={reply} postId={postId} allComments={allComments} onReply={onReply} onRefetch={onRefetch} onUserClick={onUserClick} isReply rootId={effectiveRootId} highlightCommentId={highlightCommentId} />
            )}
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Şərh şəkli — in-app lightbox */}
      {imageViewerOpen && comment.image_url &&
      <PhotoGalleryViewer
        photos={[{ id: comment.id, url: comment.image_url }]}
        initialIndex={0}
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)} />
      }
    </div>
  );
};

export default CommentReply;
