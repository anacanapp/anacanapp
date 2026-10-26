import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Trash2, Flag, Pencil, EyeOff, Languages, Pin, PinOff, ImagePlus, X, Loader2, Ban, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { CommunityPost, PostComment, useToggleLike, usePostComments, useCreateComment, useEditPost, useDeletePost, useTogglePinPost } from '@/hooks/useCommunity';
import { useAutoGrowTextarea } from '@/hooks/useAutoGrowTextarea';
import { useCommunityBookmark } from '@/hooks/useCommunitySocial';
import { useUserStore } from '@/store/userStore';
import { isFeedLang } from '@/lib/langDetect';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { hapticFeedback, nativeShare } from '@/lib/native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MediaCarousel from './MediaCarousel';
import CommentReply from './CommentReply';
import { UserBadge, VerifiedTick, isVerifiedActive } from './UserBadge';
import { getLifeStageMeta } from '@/lib/lifeStageLabel';
import { tr } from "@/lib/tr";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from
'@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from
'@/components/ui/dialog';
import BlockUserDialog from '@/components/moderation/BlockUserDialog';
import PhotoGalleryViewer from '@/components/PhotoGalleryViewer';
import CommunityBlogCard from './CommunityBlogCard';
import ModeratorActionMenu from '@/components/moderation/ModeratorActionMenu';
import ModeratorActionDialog from '@/components/moderation/ModeratorActionDialog';
import RestrictionNote from '@/components/moderation/RestrictionNote';
import { useMyModerationStatus } from '@/hooks/useModerator';
import { moderatorText } from '@/lib/moderator-i18n';

interface PostCardProps {
  post: CommunityPost;
  groupId: string | null;
  onUserClick?: (userId: string) => void;
  /** Bildiriş/deep-link vasitəsilə açılanda: şərh panelini əvvəlcədən aç (bax SinglePostView.tsx) */
  forceShowComments?: boolean;
  /** Bildiriş/deep-link vasitəsilə açılanda: bu ID-li şərhi/cavabı tapıb vurğula (bax CommentReply.tsx) */
  highlightCommentId?: string | null;
}

const getMediaType = (url: string): 'image' | 'video' => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ? 'video' : 'image';
};

// Sessiya-daxili tərcümə keşi — toggle təkrar sorğu atmır (server keşi ayrıca var)
const postTranslationCache = new Map<string, string>();
// Yaddaş: modul-səviyyəli keş sonsuz böyüməsin — ən köhnə girişləri sil (FIFO).
const POST_TRANSLATION_CACHE_MAX = 200;
const rememberPostTranslation = (key: string, value: string) => {
  postTranslationCache.delete(key);
  postTranslationCache.set(key, value);
  while (postTranslationCache.size > POST_TRANSLATION_CACHE_MAX) {
    const oldest = postTranslationCache.keys().next().value;
    if (oldest === undefined) break;
    postTranslationCache.delete(oldest);
  }
};

// anacan-demo avatar gradient cycle (stable per user)
const AVATAR_GRADS = ['var(--a-grad-peach)', 'var(--a-grad-pink)', 'var(--a-grad-lav)', 'var(--a-grad-blue)', 'var(--a-grad-green)', 'var(--a-grad-yellow)'];
const avatarGradFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADS[Math.abs(h) % AVATAR_GRADS.length];
};

// memo(): community feed hər post üçün ayrıca bu komponenti render edir —
// props (post/groupId/onUserClick) dəyişməyəndə belə, valideynin (GroupFeed)
// istənilən re-render-i bütün görünən postları yenidən render edirdi.
// Effektiv olması üçün onUserClick CommunityScreen-də useCallback ilə sabitlənib,
// post obyekt referansı isə react-query-nin struktur paylaşımı ilə sabitdir.
const PostCard = memo(({ post, groupId, onUserClick, forceShowComments, highlightCommentId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(!!forceShowComments);

  // Bildiriş/deep-link ilə açılan post gec (asinxron) yüklənə bilər — prop
  // mount-dan SONRA `true` olsa belə (SinglePostView post-u çəkdikdən sonra
  // render edir), panel yenə açılsın.
  useEffect(() => {
    if (forceShowComments) setShowComments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShowComments]);
  const [commentText, setCommentText] = useState('');
  const { ref: commentTextareaRef } = useAutoGrowTextarea(commentText, 180);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const submittingComment = useRef(false);
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  // Şərhə şəkil əlavə etmə — post composer-indəki uploadMedia (CreatePostScreen.tsx)
  // ilə eyni bucket/pattern (community-media, ${user.id}/... yolu).
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showModeratorRemove, setShowModeratorRemove] = useState(false);
  // Post şəkillərini app daxilində açan lightbox (brauzerə yönləndirmə YOXDUR)
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const lastTapRef = useRef(0);
  const { isAdmin, user, profile } = useAuth();
  const { toast } = useToast();
  const uiLang = useUserStore((s) => s.language) || 'az';
  const { data: moderationStatus } = useMyModerationStatus();

  const toggleLike = useToggleLike();
  // showComments ötürülür — panel açılmayınca sorğu/realtime kanal yaranmır
  // (əvvəllər feed-dəki HƏR post üçün qeyd-şərtsiz çağırılırdı, 150 posta
  // qədər paralel sorğu/kanal — N+1 performans problemi idi).
  const { data: comments = [], isLoading: commentsLoading, refetch: refetchComments } = usePostComments(post.id, showComments);
  const createComment = useCreateComment();
  const editPost = useEditPost();
  const deletePost = useDeletePost();
  const togglePin = useTogglePinPost();
  const bookmark = useCommunityBookmark(post.id);

  useEffect(() => () => {
    if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
  }, [commentImagePreview]);

  const handleReply = useCallback((comment: PostComment) => {
    if (!user || submittingComment.current) return;
    setReplyTo({ id: comment.id, name: comment.author?.name || tr('usecommunity_anonim', 'Anonim') });
    commentTextareaRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [user, commentTextareaRef]);

  const isOwnPost = user?.id === post.user_id;
  const isAnonymous = (post as any).is_anonymous === true;

  const handleLike = useCallback(() => {
    // Uçuşda ikinci toxunuşu udmaq — köhnə isLiked ilə yarışın (duplicate 23505) qarşısını alır
    if (toggleLike.isPending) return;
    hapticFeedback.light();
    toggleLike.mutate({ postId: post.id, isLiked: post.is_liked || false, groupId });
  }, [post.id, post.is_liked, groupId, toggleLike.isPending]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.is_liked) handleLike();
      setShowHeartBurst(true);
      hapticFeedback.medium();
      setTimeout(() => setShowHeartBurst(false), 900);
    }
    lastTapRef.current = now;
  }, [post.is_liked, handleLike]);

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: tr("createpostscreen_fayl_cox_boyukdur_f5cf61", 'Fayl çox böyükdür'), description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setCommentImageFile(file);
    setCommentImagePreview(URL.createObjectURL(file));
  };

  const uploadCommentImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('community-media').upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(`${tr("community_file_upload_failed", "Fayl yüklənə bilmədi:")} ${error.message}`);
    const { data: { publicUrl } } = supabase.storage.from('community-media').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleComment = async () => {
    if (moderationStatus?.comment || post.comments_locked) return;
    const content = commentText.trim();
    if ((!content && !commentImageFile) || !user || submittingComment.current) return;
    submittingComment.current = true;
    hapticFeedback.light();

    let imageUrl: string | null = null;
    if (commentImageFile) {
      setUploadingCommentImage(true);
      try {
        imageUrl = await uploadCommentImage(commentImageFile);
      } catch (e: any) {
        setUploadingCommentImage(false);
        submittingComment.current = false;
        toast({ title: tr("postcard_xeta_3cdbb6", 'Xəta'), description: e?.message, variant: 'destructive' });
        return;
      }
      setUploadingCommentImage(false);
    }

    try {
      await createComment.mutateAsync({
        postId: post.id, content, imageUrl, postAuthorId: post.user_id,
        expectedUserId: user.id,
        parentCommentId: replyTo?.id ?? null,
        commenterName: profile?.name || user.user_metadata?.name || tr('postcard_i_stifadeci_b6bdd6', 'İstifadəçi'),
        isAnonymous: commentAnonymous,
      });
      setCommentText('');
      setCommentImageFile(null);
      setCommentImagePreview(null);
      setCommentAnonymous(false);
      setReplyTo(null);
    } catch {
      // The mutation reports the error. Keep the complete draft and reply target.
    } finally {
      submittingComment.current = false;
    }
  };

  const handleDeletePost = () => {
    if (isAdmin && !isOwnPost) { setShowModeratorRemove(true); return; }
    if (!confirm(tr("postcard_bu_postu_silmek_isteyirsiniz_2fbc75", "Bu postu silm\u0259k ist\u0259yirsiniz?"))) return;
    hapticFeedback.medium();
    deletePost.mutate(post.id);
  };

  const handleTogglePin = () => {
    hapticFeedback.light();
    togglePin.mutate({ postId: post.id, pin: !post.is_pinned });
  };

  const handleEditPost = () => {
    const content = editContent.trim();
    if (!content) return;
    hapticFeedback.light();
    // Redaktədən sonra köhnə tərcümə göstərilməsin (server keşini DB trigger silir)
    setShowTranslation(false);
    setTranslation(null);
    postTranslationCache.delete(`${post.id}:${uiLang}`);
    editPost.mutate({ postId: post.id, content, currentLanguage: post.language, expectedRevision: post.ad_moderation_revision }, { onSuccess: () => setIsEditing(false) });
  };

  // ── Tərcümə: post dili ≠ UI dili olduqda "Tərcüməni gör" düyməsi ──
  const postLang = post.language || 'az';
  const hasTranslatableText = /[A-Za-zА-Яа-яЁёƏəĞğIıİÖöŞşÜüÇç]/.test(post.content);
  const canTranslate = hasTranslatableText && isFeedLang(uiLang) && postLang !== uiLang;

  const handleTranslate = async () => {
    hapticFeedback.light();
    // Artıq göstərilirsə → orijinala qayıt (sorğusuz)
    if (showTranslation) { setShowTranslation(false); return; }

    const cacheKey = `${post.id}:${uiLang}`;
    const cached = translation || postTranslationCache.get(cacheKey);
    if (cached) { setTranslation(cached); setShowTranslation(true); return; }

    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-post', {
        body: { post_id: post.id, target_lang: uiLang }
      });
      if (error || !data?.success || !data?.content) {
        throw new Error(data?.error || error?.message || 'translate failed');
      }
      rememberPostTranslation(cacheKey, data.content);
      setTranslation(data.content);
      setShowTranslation(true);
    } catch (e) {
      console.error('Post translate error:', e);
      toast({ title: tr("postcard_tercume_xetasi", "Tərcümə alınmadı — yenidən cəhd edin"), variant: 'destructive' });
    } finally {
      setTranslating(false);
    }
  };

  const handleReportPost = async () => {
    if (!reportReason.trim()) {toast({ title: tr("postcard_xeta_3cdbb6", 'Xəta'), description: tr("postcard_sikayet_sebebini_qeyd_edin_9d11b9", 'Şikayət səbəbini qeyd edin'), variant: 'destructive' });return;}
    if (!user) {toast({ title: tr("postcard_xeta_3cdbb6", 'Xəta'), description: tr("postcard_giris_etmelisiniz_6c2220", 'Giriş etməlisiniz'), variant: 'destructive' });return;}
    const { error } = await (supabase as any).from('post_reports').insert({ post_id: post.id, reporter_id: user.id, reason: reportReason, status: 'pending' });
    if (error) {toast({ title: tr("postcard_xeta_3cdbb6", 'Xəta'), description: error.message, variant: 'destructive' });} else
    {toast({ title: tr("postcard_sikayet_gonderildi_b7b528", 'Şikayət göndərildi'), description: tr("postcard_sikayetiniz_yoxlanilacaq_ad512c", 'Şikayətiniz yoxlanılacaq') });setShowReportDialog(false);setReportReason('');}
  };

  const handleShare = async () => {
    hapticFeedback.medium();
    await nativeShare({ title: tr("postcard_anacan_paylasim_9618d9", 'Anacan - Paylaşım'), text: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') });
  };



  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: getCurrentDateLocale() });
  const mediaItems = (post.media_urls || []).map((url) => ({ url, type: getMediaType(url) }));
  // In-app şəkil viewer: media indeksini yalnız-şəkillər siyahısındakı indeksə çevir
  const imageItems = mediaItems.filter((m) => m.type === 'image');
  const openImageViewer = (mediaIndex: number) => {
    const item = mediaItems[mediaIndex];
    if (!item || item.type !== 'image') return;
    const imgIdx = imageItems.findIndex((m) => m.url === item.url);
    setImageViewerIndex(Math.max(0, imgIdx));
    setImageViewerOpen(true);
  };
  const authorBadge = post.author?.badge_type as 'admin' | 'premium' | 'moderator' | null;
  const authorVerified = isVerifiedActive(post.author?.is_verified, post.author?.verified_until);
  // Hamilə/Ana/Flow — anonim postlarda göstərilmir (enrichPosts() onsuz da null verir, əlavə qoruma)
  const authorLifeStage = isAnonymous ? null : getLifeStageMeta(post.author?.life_stage);
  const handleAvatarClick = () => {if (post.user_id && onUserClick && (!isAnonymous || isAdmin)) onUserClick(post.user_id);};
  const commentIds = new Set(comments.map((comment) => comment.id));
  const topLevelComments = comments.filter((c) => !c.parent_comment_id || !commentIds.has(c.parent_comment_id));

  return (
    <>
      <motion.article
        className="a-post a-fade-in community-native-text"
        data-post-id={post.id}
        transition={{ duration: 0.1 }}>
        
        {/* Pinlənmiş göstəricisi — yalnız feed-in ən üstündə görünən postlarda */}
        {post.is_pinned &&
        <div className="a-post-pinned-strip">
            <Pin size={11} strokeWidth={2.4} fill="currentColor" />
            {tr("postcard_pinlenmis_post", "Pinlənmiş")}
          </div>
        }

        {/* Author row */}
        <div className="a-post-head">
          <motion.button
            onClick={handleAvatarClick}
            whileTap={{ scale: 0.9 }}
            disabled={isAnonymous && !isAdmin}
            style={{ background: 'none', border: 'none', padding: 0, cursor: isAnonymous && !isAdmin ? 'default' : 'pointer' }}>
            
            <span
              className="a-post-avatar"
              style={{ background: isAnonymous && !isAdmin ? 'linear-gradient(135deg, #d8d3c6, #b3ac9a)' : avatarGradFor(post.user_id || post.id) }}>
              
              {isAnonymous && !isAdmin ?
              <EyeOff size={15} /> :
              post.author?.avatar_url ?
              <img src={post.author.avatar_url} alt="" loading="lazy" decoding="async" /> :

              (post.author?.name?.charAt(0) || tr("common_initial_i", "İ")).toUpperCase()
              }
            </span>
          </motion.button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="a-post-name-row">
              <motion.button
                onClick={handleAvatarClick}
                className="a-post-name"
                style={{ background: 'none', border: 'none', padding: 0, cursor: isAnonymous && !isAdmin ? 'default' : 'pointer', fontStyle: isAnonymous && !isAdmin ? 'italic' : 'normal', color: isAnonymous && !isAdmin ? 'var(--a-ink-soft)' : 'var(--a-ink)' }}
                whileTap={{ scale: 0.98 }}
                disabled={isAnonymous && !isAdmin}>
                
                {isAnonymous ?
                isAdmin ?
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontStyle: 'italic', color: 'var(--a-ink-soft)' }}>{tr("untranslated_anonim_89j5l6", "Anonim")}</span>
                      <span style={{ fontSize: 11, color: 'var(--a-peach-2)', fontWeight: 600 }}>({post.author?.name || tr("postcard_i_stifadeci_b6bdd6", "İstifadəçi")})</span>
                    </span> :
                tr("untranslated_anonim_89j5l6", "Anonim") :
                post.author?.name || tr("postcard_i_stifadeci_b6bdd6", "İstifadəçi")}
              </motion.button>
              {!isAnonymous && authorVerified && <VerifiedTick />}
              {!isAnonymous && <UserBadge type={authorBadge} premium={post.author?.is_premium} />}
              {isAnonymous && <span className="a-post-anon">({tr("untranslated_anonim_89j5l6", "Anonim")})</span>}
            </div>
            <span className="a-post-time">
              · {authorLifeStage &&
              <span style={{ color: authorLifeStage.ink, fontWeight: 700 }}>{authorLifeStage.label} · </span>
              }{timeAgo}
            </span>
          </div>
          {/* modal={false}: hər postda olan bu menyu modal rejimdə bütün sənədə
              scroll kilidi (react-remove-scroll) qoyur; feed refetch nəticəsində
              post remount olanda kilid asılı qalıb bütün app-ın scroll-unu dondura
              bilirdi. Non-modal menyu üçün kilidə ehtiyac yoxdur. */}
          <ModeratorActionMenu target={{ kind: 'post', id: post.id, userId: post.user_id, name: post.author?.name, content: post.content,
            version: post.moderation_version || 0, isPinned: post.is_pinned, removed: !!post.moderation_removed_at, commentsLocked: !!post.comments_locked }} />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-faint)', flexShrink: 0 }}>
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="community-post-menu bg-popover border-border/20 z-50 rounded-xl shadow-xl min-w-[150px]">
              {isOwnPost &&
              <DropdownMenuItem onClick={() => {setEditContent(post.content);setIsEditing(true);}} className="text-foreground text-[11px] rounded-lg">
                  <Pencil className="w-3 h-3 me-2" /> {tr("postcard_redakte_et_66cf3b", "Redakt\u0259 et")}
                </DropdownMenuItem>
              }
              {!isOwnPost &&
              <DropdownMenuItem onClick={() => setShowReportDialog(true)} className="text-amber-600 text-[11px] rounded-lg">
                  <Flag className="w-3 h-3 me-2" /> {tr("postcard_sikayet_et_e8b63a", "\u015Eikay\u0259t et")}
                </DropdownMenuItem>
              }
              {isAdmin &&
              <DropdownMenuItem onClick={handleTogglePin} className="text-foreground text-[11px] rounded-lg">
                  {post.is_pinned ?
                <><PinOff className="w-3 h-3 me-2" />{tr("postcard_pini_gotur", "Pini götür")}</> :
                <><Pin className="w-3 h-3 me-2" />{tr("postcard_pinle", "Pinlə")}</>
                }
                </DropdownMenuItem>
              }
              {isAdmin && !isOwnPost &&
              <DropdownMenuItem onClick={() => setShowBlockDialog(true)} className="text-destructive text-[11px] rounded-lg">
                  <Ban className="w-3 h-3 me-2" /> {tr("postcard_istifadecini_blokla", "İstifadəçini blokla")}
                </DropdownMenuItem>
              }
              {(isAdmin || isOwnPost) && <DropdownMenuSeparator className="bg-border/10" />}
              {(isAdmin || isOwnPost) &&
              <DropdownMenuItem onClick={handleDeletePost} className="text-destructive text-[11px] rounded-lg">
                  <Trash2 className="w-3 h-3 me-2" />{tr("untranslated_sil_zwa7lz", "Sil")}</DropdownMenuItem>
              }
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.moderation_edited_at && <p className="text-xs text-muted-foreground mb-2">{moderatorText('edited_marker', uiLang)}</p>}
        {post.comments_locked && <p className="rounded-xl bg-muted/50 p-3 mb-3 text-xs">{moderatorText('comments_closed', uiLang)}</p>}
        {showComments && <RestrictionNote scope="comment" />}
        {isEditing ?
        <div className="space-y-2" style={{ paddingBottom: 4 }}>
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[70px] rounded-xl resize-none text-[13px]" style={{ background: 'var(--a-surface-soft)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }} autoFocus />
            <div className="flex gap-1.5 justify-end">
              <button onClick={() => setIsEditing(false)} className="a-tag" style={{ cursor: 'pointer' }}>{tr("postcard_legv_et_b5e49c", "Ləğv et")}</button>
              <button onClick={handleEditPost} disabled={!editContent.trim() || editPost.isPending} className="a-btn-solid">
                {editPost.isPending ? '...' : tr("common_saxla", "Saxla")}
              </button>
            </div>
          </div> :

        <div onClick={handleDoubleTap} className="relative">
            <p className="a-post-text" dir="auto">
              {(showTranslation && translation ? translation : post.content).split(/(\s+)/).map((word, index) => {
              if (word.startsWith('#')) return <span key={index} className="a-post-tag">{word}</span>;
              if (word.startsWith('@')) return <span key={index} style={{ color: 'var(--a-blue-2)', fontWeight: 700 }}>{word}</span>;
              if (/^(?:https?:\/\/|anacan:\/\/)\S+/.test(word)) return <CommentText key={index} content={word} allowLinks />;
              return word;
            })}
            </p>
            {canTranslate &&
          <button
            onClick={(e) => { e.stopPropagation(); void handleTranslate(); }}
            disabled={translating}
            style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--a-blue-2)', opacity: translating ? 0.6 : 1 }}>
                <Languages size={12} strokeWidth={2.2} />
                {translating ?
            tr("postcard_tercume_olunur", "Tərcümə olunur…") :
            showTranslation ?
            tr("postcard_orijinali_goster", "Orijinalı göstər") :
            tr("postcard_tercumeni_gor", "Tərcüməni gör")}
                {showTranslation && !translating &&
            <span style={{ color: 'var(--a-ink-faint)', fontWeight: 600 }}>· {postLang.toUpperCase()} → {uiLang.toUpperCase()}</span>
            }
              </button>
          }
            {mediaItems.length > 0 &&
          <div style={{ marginTop: 12, borderRadius: 'var(--a-radius-md)', overflow: 'hidden' }}>
                <MediaCarousel media={mediaItems} onOpenFullscreen={openImageViewer} />
              </div>
          }
            {/* Heart burst animation */}
            <AnimatePresence>
              {showHeartBurst &&
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              
                  <Heart className="w-20 h-20 drop-shadow-lg" style={{ color: '#e05575', fill: '#e05575' }} />
                </motion.div>
            }
            </AnimatePresence>
          </div>
        }

        {!!post.tagged_group_ids?.length && <GroupPostTags ids={post.tagged_group_ids}/>}
        {post.blog_post_id && <CommunityBlogCard id={post.blog_post_id} />}

        {/* Actions (anacan-demo post footer) */}
        <div className="a-post-footer">
          <motion.button onClick={handleLike} aria-label={tr('commentreply_beyen', 'Bəyən')} aria-pressed={!!post.is_liked} className={`a-post-action${post.is_liked ? ' liked' : ''}`} whileTap={{ scale: 0.8 }}>
            <motion.span animate={post.is_liked ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }} style={{ display: 'inline-flex' }}>
              <Heart size={19} strokeWidth={2} fill={post.is_liked ? 'currentColor' : 'none'} />
            </motion.span>
            {post.likes_count > 0 && <span>{post.likes_count}</span>}
          </motion.button>
          <motion.button onClick={() => setShowComments(!showComments)} aria-label={tr('community_comments', 'Şərhlər')} aria-expanded={showComments} className="a-post-action" style={showComments ? { color: 'var(--a-accent-ink)' } : undefined} whileTap={{ scale: 0.8 }}>
            <MessageCircle size={19} strokeWidth={2} />
            {post.comments_count > 0 && <span>{post.comments_count}</span>}
          </motion.button>
          <motion.button onClick={handleShare} aria-label={tr('community_share', 'Paylaş')} className="a-post-action" whileTap={{ scale: 0.8 }}>
            <Share2 size={18} strokeWidth={2} />
          </motion.button>
          <motion.button type="button" className="a-post-action ms-auto" disabled={!user || bookmark.isPending}
            aria-pressed={!!post.is_saved} aria-busy={bookmark.isPending}
            aria-label={post.is_saved ? tr('community_unsave_post', 'Saxlanmışlardan çıxar') : tr('community_save_post', 'Paylaşımı saxla')}
            style={post.is_saved ? { color: 'var(--a-accent-ink)' } : undefined}
            onClick={() => { hapticFeedback.light(); bookmark.setSaved(!post.is_saved); }} whileTap={{ scale: 0.9 }}>
            <Bookmark size={19} strokeWidth={2} fill={post.is_saved ? 'currentColor' : 'none'} />
          </motion.button>
        </div>

        {/* Comments section */}
        <AnimatePresence>
          {showComments &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid var(--a-line)', marginTop: 12 }}>
            
              <div className="space-y-3" style={{ paddingTop: 12 }}>
                <div ref={composerRef} className="community-comment-composer" data-reply-to={replyTo?.id || ''}>
                  {replyTo && <div className="community-reply-target">
                    <span>{tr('community_replying_to', '{name} üçün cavab').replace('{name}', replyTo.name)}</span>
                    <button type="button" onClick={() => setReplyTo(null)} disabled={createComment.isPending || uploadingCommentImage} aria-label={tr('community_cancel_reply', 'Cavabı ləğv et')}><X size={16} /></button>
                  </div>}
                {commentImagePreview &&
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                    <img src={commentImagePreview} alt="" decoding="async" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                    <button
                  type="button"
                  onClick={() => { setCommentImageFile(null); setCommentImagePreview(null); }}
                  style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 20, height: 20, borderRadius: 999, background: 'var(--a-ink)', color: 'var(--a-bg)', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer' }}>
                      <X size={11} />
                    </button>
                  </div>
              }
                  <textarea
                  ref={commentTextareaRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  aria-label={tr('community_comment_text', 'Şərh və ya cavab yaz')}
                  disabled={createComment.isPending || uploadingCommentImage}
                  placeholder={replyTo ? tr('community_reply_placeholder', 'Cavabınızı yazın...') : commentAnonymous ? tr("postcard_anonim_serh_yaz_9af1ca", "Anonim \u015F\u0259rh yaz...") : tr("postcard_serh_yaz_54a89a", "Şərh yaz...")}
                  className="a-input"
                   rows={1}
                  dir="auto"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleComment();
                    }
                  }} />
                
                <div className="community-composer-actions">
                  <input type="file" accept="image/*" ref={commentFileInputRef} onChange={handleCommentImageSelect} style={{ display: 'none' }} />
                  <button type="button" onClick={() => commentFileInputRef.current?.click()} disabled={uploadingCommentImage || createComment.isPending} className="a-icon-btn" aria-label={tr('postcard_sekil_elave_et', 'Şəkil əlavə et')}>
                    <ImagePlus size={18} />
                  </button>
                  <button type="button" onClick={() => setCommentAnonymous((v) => !v)} disabled={uploadingCommentImage || createComment.isPending} aria-pressed={commentAnonymous} className={`a-tag${commentAnonymous ? ' on' : ''}`}>
                    <EyeOff size={14} />{tr('postcard_anonim_olaraq_yaz_abc123', 'Anonim olaraq yaz')}
                  </button>
                  <button
                  onClick={handleComment}
                  aria-label={tr('postcard_gonder_3f11bd', 'Göndər')}
                  disabled={(!commentText.trim() && !commentImageFile) || createComment.isPending || uploadingCommentImage}
                  className="a-icon-btn ms-auto disabled:opacity-40"
                  style={{ background: 'var(--a-accent-ink)', color: 'var(--a-bg)' }}>
                    {uploadingCommentImage || createComment.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                </div>
                {commentsLoading ?
              <div className="text-center py-4">
                    <div className="w-5 h-5 rounded-full animate-spin mx-auto" style={{ border: '2px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
                  </div> :
              topLevelComments.length === 0 ?
              <p className="a-list-sub text-center" style={{ padding: '16px 0', margin: 0 }}>{tr("postcard_hele_serh_yoxdur_89ce09", "Hələ şərh yoxdur 💭")}</p> :

              <div className="space-y-2">
                    {topLevelComments.map((comment) =>
                <CommentReply key={comment.id} comment={comment} postId={post.id} allComments={comments} onReply={handleReply} onRefetch={refetchComments} onUserClick={onUserClick} highlightCommentId={highlightCommentId} />
                )}
                  </div>
              }
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </motion.article>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md max-w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{tr("postcard_postu_sikayet_et_fd45d9", "Postu Şikayət Et")}</DialogTitle>
            <DialogDescription className="text-xs">{tr("postcard_bu_postun_niye_uygunsuz_oldugunu_bildiri_b86b7c", "Bu postun niyə uyğunsuz olduğunu bildirin")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder={tr("postcard_sikayet_sebebi_a49b6b", "Şikayət səbəbi...")} className="rounded-xl text-sm" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowReportDialog(false)} className="rounded-lg text-xs h-8">{tr("postcard_legv_et_b5e49c", "Ləğv et")}</Button>
            <Button onClick={handleReportPost} className="gradient-primary rounded-lg text-xs h-8">{tr("postcard_gonder_3f11bd", "Göndər")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin: istifadəçini blokla (yalnız açılanda mount olunur — feed performansı) */}
      {showModeratorRemove && <ModeratorActionDialog target={{ kind: 'post', id: post.id, userId: post.user_id, name: post.author?.name, content: post.content }}
        action="remove" onClose={() => setShowModeratorRemove(false)} />}
      {showBlockDialog &&
      <BlockUserDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        userId={post.user_id}
        userName={post.author?.name || null} />
      }

      {/* Post şəkilləri — in-app lightbox (yalnız açılanda mount olunur) */}
      {imageViewerOpen && imageItems.length > 0 &&
      <PhotoGalleryViewer
        photos={imageItems.map((m, i) => ({ id: `${post.id}-img-${i}`, url: m.url }))}
        initialIndex={imageViewerIndex}
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)} />
      }
    </>);

});

PostCard.displayName = 'PostCard';

export default PostCard;
import GroupPostTags from './GroupPostTags';
import CommentText from './CommentText';
