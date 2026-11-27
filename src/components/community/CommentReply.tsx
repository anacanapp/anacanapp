import { useState, useRef, useEffect, useMemo } from 'react';
import { StickerImage } from '@/components/stickers/StickerPicker';
import { stickerFromImageUrl } from '@/lib/stickers';
import { motion } from 'framer-motion';
import { X, Heart, Trash2, Pencil, Pin, MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { PostComment, useToggleCommentLike, useEditComment, useDeleteComment } from '@/hooks/useCommunity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { hapticFeedback } from '@/lib/native';
import { useAuth } from '@/hooks/useAuth';
import PhotoGalleryViewer from '@/components/PhotoGalleryViewer';
import { UserBadge, VerifiedTick, isVerifiedActive } from './UserBadge';
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
  // Instagram: replies start folded ("N cavaba bax"); a deep-linked reply opens its thread.
  const [showReplies, setShowReplies] = useState(() => !!highlightCommentId && allComments.some((c) => c.id === highlightCommentId && !!c.parent_comment_id));
  const [actionsOpen, setActionsOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const canManage = isAdmin || isOwnComment;
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  // Long press (touch) opens the actions sheet, like Instagram; right-click does the same on desktop.
  const startPress = (e: React.PointerEvent) => {
    if (!canManage || e.pointerType === 'mouse' || isEditing) return;
    cancelPress();
    pressTimer.current = setTimeout(() => { hapticFeedback.light(); setActionsOpen(true); }, 480);
  };
  useEffect(() => cancelPress, []);

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
  // Instagram shows a bare short distance ("3 saat", "2 gün") without "əvvəl".
  const timeAgo = formatDistanceToNowStrict(new Date(comment.created_at), { locale: getCurrentDateLocale() });
  const authorBadge = (comment.author?.badge_type as 'admin' | 'premium' | 'moderator' | null) || null;
  const authorVerified = isVerifiedActive(comment.author?.is_verified, comment.author?.verified_until);

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
      {/* Instagram comment row (owner request 2026-11-11): avatar · [name time] / text / "Cavab ver" · heart+count on
          the right. Own/admin edit and delete sit behind a long press or the small "…", not in the row. */}
      <div className="ig-cmt" onContextMenu={(e) => { if (canManage) { e.preventDefault(); setActionsOpen(true); } }}
        onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}>
        <motion.button onClick={handleAvatarClick} disabled={comment.is_anonymous && !isAdmin} whileTap={{ scale: 0.94 }} className="ig-cmt-avatar" tabIndex={-1} aria-hidden>
          <Avatar className={isReply ? 'w-6 h-6' : 'w-8 h-8'}>
            <AvatarImage src={comment.author?.avatar_url || undefined} />
            <AvatarFallback className={`bg-primary/10 text-primary font-bold ${isReply ? 'text-[9px]' : 'text-[11px]'}`}>
              {comment.author?.name?.charAt(0) || tr("common_initial_i", "İ")}
            </AvatarFallback>
          </Avatar>
        </motion.button>

        <div className="ig-cmt-body">
          <div className="ig-cmt-head">
            <motion.button onClick={handleAvatarClick} disabled={comment.is_anonymous && !isAdmin} whileTap={{ scale: 0.98 }} className="ig-cmt-name">
              {comment.author?.name || tr("commentreply_i_stifadeci_b6bdd6", "İstifadə\xE7i")}
            </motion.button>
            {authorVerified && <span className="inline-flex"><VerifiedTick size={11} /></span>}
            {!comment.is_anonymous && (authorBadge || comment.author?.is_premium) &&
            <span className="inline-flex ig-cmt-badge"><UserBadge type={authorBadge} premium={comment.author?.is_premium} /></span>}
            <span className="ig-cmt-time">{timeAgo}</span>
            {comment.is_pinned && <span className="ig-cmt-pinned"><Pin size={10} />{moderatorText('pinned_comment', language)}</span>}
            {comment.moderation_edited_at && <span className="ig-cmt-time">· {moderatorText('edited_marker', language)}</span>}
          </div>
          {isEditing ?
          <div className="space-y-1.5 mt-1">
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
              {(comment.content || repliedToName) &&
              <p className="ig-cmt-text" dir="auto">
                {repliedToName && <span className="ig-cmt-mention">@{repliedToName} </span>}
                <CommentText content={comment.content} allowLinks={comment.author?.can_share_links === true || ['admin', 'moderator'].includes(authorBadge || '')} />
              </p>
              }
              {comment.image_url && stickerFromImageUrl(comment.image_url) ?
            <div style={{ marginTop: 4 }}><StickerImage id={stickerFromImageUrl(comment.image_url)!} size={96} /></div> :
            comment.image_url &&
            <img loading="lazy" decoding="async" src={comment.image_url} alt="" className="ig-cmt-photo" onClick={() => setImageViewerOpen(true)} />
            }
              <div className="ig-cmt-meta">
                <button onClick={() => onReply(comment)} disabled={comment.id.startsWith('optimistic-')} aria-label={tr("commentreply_action_reply", "Cavab")} className="disabled:opacity-50">
                  {tr("commentreply_action_reply", "Cavab")}
                </button>
                {canManage &&
                <button onClick={() => setActionsOpen(true)} aria-label={tr('adminepoint_emeliyyatlar_54d70c', 'Əməliyyatlar')} className="ig-cmt-more"><MoreHorizontal size={15} /></button>}
                <span className="ig-cmt-mod">
                  <ModeratorActionMenu target={{ kind: 'comment', id: comment.id, userId: comment.user_id, name: comment.author?.name, content: comment.content,
                    version: comment.moderation_version || 0, isPinned: !!comment.is_pinned, removed: !!comment.moderation_removed_at }} onDone={onRefetch} />
                </span>
              </div>
            </>
          }
        </div>

        <motion.button onClick={handleLikeComment} whileTap={{ scale: 0.75 }} className={`ig-cmt-like${comment.is_liked ? ' on' : ''}`}
          aria-label={tr("commentreply_beyen", "Bəyən")} aria-pressed={!!comment.is_liked}>
          <Heart size={14} fill={comment.is_liked ? 'currentColor' : 'none'} strokeWidth={2} />
          {(comment.likes_count || 0) > 0 && <span>{comment.likes_count}</span>}
        </motion.button>
      </div>

      {/* "—— N cavaba bax" / "—— Cavabları gizlə" */}
      {!isReply && replies.length > 0 &&
      <button onClick={() => setShowReplies(!showReplies)} className="ig-cmt-toggle">
          <span aria-hidden />
          {showReplies ?
        tr("commentreply_cavablari_gizle", "Cavabları gizlə") :
        tr("commentreply_n_cavab_goster", "{n} cavab göstər").replace('{n}', String(replies.length))
        }
        </button>
      }

      {moderatorRemove && <ModeratorActionDialog target={{ kind: 'comment', id: comment.id, userId: comment.user_id, name: comment.author?.name, content: comment.content }}
        action="remove" onClose={() => setModeratorRemove(false)} onDone={onRefetch} />}
      {!isReply && showReplies && replies.length > 0 &&
      <div className="ig-cmt-replies">
          {replies.map((reply) =>
        <CommentReply key={reply.id} comment={reply} postId={postId} allComments={allComments} onReply={onReply} onRefetch={onRefetch} onUserClick={onUserClick} isReply rootId={effectiveRootId} highlightCommentId={highlightCommentId} />
        )}
        </div>
      }

      {/* Long-press actions: own comment edit/delete; admin delete */}
      {actionsOpen && createPortal(
        <div className="ig-actions-backdrop" onClick={() => setActionsOpen(false)}>
          <div className="ig-actions" role="menu" onClick={(e) => e.stopPropagation()}>
            {isOwnComment && !stickerFromImageUrl(comment.image_url) &&
            <button role="menuitem" onClick={() => { setActionsOpen(false); setEditContent(comment.content); setEditImageUrl(comment.image_url); setIsEditing(true); }}>
                <Pencil size={18} />{tr('postcard_redakte_et_66cf3b', 'Redaktə et')}
              </button>}
            <button role="menuitem" className="danger" onClick={() => { setActionsOpen(false); void handleDelete(); }}>
              <Trash2 size={18} />{tr('untranslated_sil_zwa7lz', 'Sil')}
            </button>
            <button role="menuitem" className="cancel" onClick={() => setActionsOpen(false)}>{tr('postcard_legv_et_b5e49c', 'Ləğv et')}</button>
          </div>
        </div>, document.body)}

      {/* Şərh şəkli — in-app lightbox */}
      {imageViewerOpen && comment.image_url && !stickerFromImageUrl(comment.image_url) &&
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
