import { useState, useLayoutEffect } from 'react';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { cancelScrollRestoration } from '@/lib/scrollMemory';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Clock, Eye, Heart, Bookmark, MessageCircle,
  Send, Trash2, ChevronDown, ChevronUp, Share2, User } from
'lucide-react';
import { BlogPost, BlogCategory } from '@/hooks/useBlog';
import { useBlogInteractions, BlogComment } from '@/hooks/useBlogInteractions';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import RelatedPosts from './RelatedPosts';
import BlogShareDialog from './BlogShareDialog';
import BlogContent from './BlogContent';
import { tr } from "@/lib/tr";
import { followupText } from '@/lib/followup-i18n';
import { AdInlineAnchor, AdSurface, useAdExit } from '@/components/ads/AdExperienceProvider';
import BlogSeo from './BlogSeo';
import BlogEditorialSections, { BlogContents } from './BlogEditorialSections';
import { blogLocale } from '@/lib/blog-editorial';
import { useUserStore } from '@/store/userStore';

interface BlogPostDetailProps {
  post: BlogPost;
  categories: BlogCategory[];
  allPosts: BlogPost[];
  onBack: () => void;
  onSelectPost: (post: BlogPost) => void;
}

const BlogPostDetail = ({ post, categories, allPosts, onBack, onSelectPost }: BlogPostDetailProps) => {
  const leaveArticle = useAdExit('article_exit_interstitial', onBack);
  useLayoutEffect(() => { cancelScrollRestoration(); }, [post.id]);
  useScrollToTop([post.id]);
  const { user } = useAuth();
  const language = useUserStore(state => state.language);
  const locale = blogLocale(post.editorial_metadata, language);
  const { toast } = useToast();
  const {
    isLiked,
    isSaved,
    likesCount,
    comments,
    commentsCount,
    toggleLike,
    toggleSave,
    addComment,
    toggleCommentLike,
    deleteComment
  } = useBlogInteractions(post.id);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleAddComment = async () => {
    if (!user) {
      toast({ title: tr("blogpostdetail_giris_edin_3be3d2", 'Giriş edin'), description: tr("blogpostdetail_serh_yazmaq_ucun_hesabiniza_daxil_olun_409134", 'Şərh yazmaq üçün hesabınıza daxil olun') });
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    const result = await addComment(newComment);
    setSubmitting(false);

    if (!result.error) {
      setNewComment('');
      toast({ title: tr("blogpostdetail_serh_elave_edildi_192ac0", 'Şərh əlavə edildi!') });
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user) {
      toast({ title: tr("blogpostdetail_giris_edin_3be3d2", 'Giriş edin'), description: tr("blogpostdetail_cavab_yazmaq_ucun_hesabiniza_daxil_olun_04a03d", 'Cavab yazmaq üçün hesabınıza daxil olun') });
      return;
    }
    if (!replyContent.trim()) return;

    setSubmitting(true);
    const result = await addComment(replyContent, parentId);
    setSubmitting(false);

    if (!result.error) {
      setReplyContent('');
      setReplyingTo(null);
      toast({ title: tr("blogpostdetail_cavab_elave_edildi_b44ba8", 'Cavab əlavə edildi!') });
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) =>
    prev.includes(commentId) ?
    prev.filter((id) => id !== commentId) :
    [...prev, commentId]
    );
  };

  const handleShare = () => setShareOpen(true);

  const renderComment = (comment: BlogComment, isReply = false) =>
  <motion.div
    key={comment.id}
    className={`${isReply ? 'ms-10 mt-3' : ''}`}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}>
    
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 shrink-0" style={{ border: '2px solid var(--a-line)' }}>
          <AvatarImage src={comment.user_avatar || undefined} />
          <AvatarFallback className="text-sm" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
            {comment.user_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-ss-none p-3" style={{ background: 'var(--a-surface-soft)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-sm" style={{ color: 'var(--a-ink)' }}>{comment.user_name}</span>
              {comment.user_badge &&
            <span className="text-[10px] px-1.5 py-0 rounded-full font-bold" style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>
                  {comment.user_badge === 'admin' ? '👑 Admin' :
              comment.user_badge === 'premium' ? '⭐ Premium' : '🛡️ Mod'}
                </span>
            }
            </div>
            <p className="text-sm" style={{ margin: 0, color: 'var(--a-ink)' }}>{comment.content}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2 px-2">
            <button
            onClick={() => toggleCommentLike(comment.id)}
            className="flex items-center gap-1 text-xs font-semibold transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: comment.is_liked ? 'var(--a-pink-2)' : 'var(--a-ink-soft)' }}>
            
              <Heart className={`w-3.5 h-3.5 ${comment.is_liked ? 'fill-current' : ''}`} />
              <span>{comment.likes_count || ''}</span>
            </button>

            {!isReply &&
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="text-xs font-semibold transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)' }}>
            
                {tr("blogpostdetail_cavab_yaz_2cd434", "Cavab yaz")}
              </button>
          }

            <span className="text-xs" style={{ color: 'var(--a-ink-faint)' }}>
              {format(new Date(comment.created_at), 'd MMM', { locale: getCurrentDateLocale() })}
            </span>

            {user?.id === comment.user_id &&
          <button
            onClick={() => deleteComment(comment.id)}
            className="text-xs ms-auto"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-pink-ink)' }}>
            
                <Trash2 className="w-3.5 h-3.5" />
              </button>
          }
          </div>

          {/* Reply input */}
          {replyingTo === comment.id &&
        <motion.div
          className="mt-3 flex gap-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}>
          
              <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={tr("blogpostdetail_cavabinizi_yazin_2cda33", "Cavabınızı yazın...")}
            className="a-input flex-1 min-w-0 text-sm resize-none"
            style={{ minHeight: 60, height: 'auto', fontFamily: 'inherit' }} />
          
              <div className="flex flex-col gap-1">
                <button
              onClick={() => handleReply(comment.id)}
              disabled={submitting}
              className="a-cta-btn"
              style={{ width: 38, height: 38, padding: 0, justifyContent: 'center', opacity: submitting ? 0.6 : 1 }}>
              
                  <Send className="w-4 h-4" />
                </button>
                <button
              className="a-icon-btn"
              style={{ width: 38, height: 38 }}
              onClick={() => setReplyingTo(null)}>
              
                  ✕
                </button>
              </div>
            </motion.div>
        }

          {/* Replies toggle */}
          {comment.replies && comment.replies.length > 0 &&
        <button
          onClick={() => toggleReplies(comment.id)}
          className="flex items-center gap-1 mt-2 px-2 text-xs font-bold"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)' }}>
          
              {expandedComments.includes(comment.id) ?
          <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  {tr("blogpostdetail_cavablari_gizle_bc19d3", "Cavablar\u0131 gizl\u0259")}
                </> :

          <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  {comment.replies.length} {tr("blogpostdetail_cavab_goster_faef92", "cavab g\xF6st\u0259r")}
                </>
          }
            </button>
        }

          {/* Replies */}
          {expandedComments.includes(comment.id) && comment.replies?.map((reply) =>
        renderComment(reply, true)
        )}
        </div>
      </div>
    </motion.div>;


  return (
    <div className="blog-article a-scope min-h-screen pb-24 overflow-y-auto" style={{ background: 'var(--a-bg)' }} data-blog-post={post.id}>
      <BlogSeo post={post} />
      <AdSurface id="blog_article_banner" />
      {/* Hero Image */}
      <div className="relative">
        {post.cover_image_url ?
        <div className="relative h-64 w-full">
            <img
            src={post.cover_image_url}
            alt={locale?.coverAlt || post.title}
            className="w-full h-full object-cover" />
          
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--a-bg), transparent 60%)' }} />
          </div> :

        <div className="h-40" style={{ background: 'var(--a-grad-peach)' }} />
        }
        
        {/* Floating Back Button */}
        <motion.button
          aria-label={tr('common_geri', 'Geri')}
          onClick={(e) => {
            e.stopPropagation();
            void leaveArticle();
          }}
          className="absolute start-4 z-50 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center cursor-pointer"
          style={{ top: 'calc(env(safe-area-inset-top, 12px) + 12px)', border: 'none' }}
          whileTap={{ scale: 0.95 }}>
          
          <ArrowLeft className="rtl:rotate-180 w-5 h-5 text-white" />
        </motion.button>

        {/* Floating Share Button */}
        <motion.button
          aria-label={followupText('share_blog')}
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="absolute end-4 z-50 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center cursor-pointer"
          style={{ top: 'calc(env(safe-area-inset-top, 12px) + 12px)', border: 'none' }}
          whileTap={{ scale: 0.95 }}>
          
          <Share2 className="w-5 h-5 text-white" />
        </motion.button>
      </div>

      <div className="a-shell -mt-8 relative z-10">
        {/* Main Content Card */}
        <motion.div
          className="a-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>
          
          {/* Category */}
          <span className="a-rank-tag mb-3 inline-flex" style={{ margin: '0 0 12px', background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
            {categories.find((c) => c.slug === post.category)?.icon} {categories.find((c) => c.slug === post.category)?.name || post.category}
          </span>

          {/* Title */}
          <h1 className="text-2xl mb-3 leading-tight a-heading" style={{ margin: '0 0 12px', color: 'var(--a-ink)' }}>
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm mb-4" style={{ color: 'var(--a-ink-soft)' }}>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.reading_time} {tr("blogpostdetail_deq_780a5c", "d\u0259q")}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.view_count} {tr("blogpostdetail_baxis_d4da3e", "bax\u0131\u015F")}
            </span>
            <span>
              {format(new Date(post.created_at), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
            </span>
          </div>

          {/* Actions */}
          <div className="blog-article-actions" style={{ borderBottom: '1px solid var(--a-line)' }}>
            <motion.button
              onClick={toggleLike}
              className="flex-1 flex items-center justify-center gap-2 px-2 py-3 rounded-full font-bold transition-all"
              style={isLiked ?
              { background: 'var(--a-pink-2)', color: '#fff', border: 'none', boxShadow: '0 8px 18px -8px rgba(255, 138, 164, 0.8)', cursor: 'pointer' } :
              { background: 'var(--a-surface-soft)', color: 'var(--a-ink)', border: 'none', cursor: 'pointer' }}
              whileTap={{ scale: 0.98 }}>
              
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span>{likesCount}</span>
            </motion.button>

            <motion.button
              onClick={toggleSave}
              className="flex-1 flex items-center justify-center gap-2 px-2 py-3 rounded-full font-bold transition-all"
              style={isSaved ?
              { background: 'var(--a-yellow-2)', color: '#5a3d00', border: 'none', boxShadow: '0 8px 18px -8px rgba(255, 201, 77, 0.8)', cursor: 'pointer' } :
              { background: 'var(--a-surface-soft)', color: 'var(--a-ink)', border: 'none', cursor: 'pointer' }}
              whileTap={{ scale: 0.98 }}>
              
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? tr("blogpostdetail_saxlanildi_66ffe7", "Saxlan\u0131ld\u0131") : tr("blogpostdetail_saxla_d9cfd1", "Saxla")}</span>
            </motion.button>

            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-full" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
              <MessageCircle className="w-5 h-5" />
              <span className="font-bold">{commentsCount}</span>
            </div>
          </div>
        </motion.div>

        <BlogContents post={post} />
        {/* Content */}
        <motion.div
          className="mt-3 a-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
          <BlogContent content={post.content} className="prose prose-sm dark:prose-invert max-w-none" />
        </motion.div>

        <BlogEditorialSections post={post} />

        {/* Tags */}
        {post.tags && post.tags.length > 0 &&
        <motion.div
          className="flex flex-wrap gap-2 mt-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          
            {post.tags.map((tag) =>
          <span key={tag} className="a-tag" style={{ cursor: 'default' }}>
                #{tag}
              </span>
          )}
          </motion.div>
        }

        {/* Author */}
        <motion.div
          className="mt-3 a-card flex items-center gap-4"
          style={{ background: 'var(--a-peach-1)', border: 'none' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
          <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
            <User className="w-7 h-7" style={{ color: 'var(--a-accent-ink)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{post.author_name}</p>
            <p className="text-sm" style={{ margin: 0, color: 'var(--a-accent-ink)', opacity: 0.75 }}>{tr("blogpostdetail_meqale_muellifi_1bf996", "Məqalə müəllifi")}</p>
          </div>
        </motion.div>

        {/* Comments Section */}
        <AdInlineAnchor id="blog_article_banner" />
        <motion.div
          className="mt-3 a-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}>
          
          <h3 className="font-bold mb-4 flex items-center gap-2 a-heading" style={{ margin: '0 0 16px', color: 'var(--a-ink)' }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
              <MessageCircle className="w-4 h-4" style={{ color: 'var(--a-accent-ink)' }} />
            </span>
            {tr("blogpostdetail_serhler_8b3fc3", "\u015E\u0259rhl\u0259r (")}{commentsCount})
          </h3>

          {/* New comment */}
          <div className="flex gap-3 mb-6">
            <Avatar className="w-10 h-10 shrink-0" style={{ border: '2px solid var(--a-line)' }}>
              <AvatarFallback style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? tr("blogpostdetail_serhinizi_yazin_9d6066", "\u015E\u0259rhinizi yaz\u0131n...") : tr("blogpostdetail_serh_yazmaq_ucun_giris_edin_d02910", "\u015E\u0259rh yazmaq \xFC\xE7\xFCn giri\u015F edin")}
                className="a-input flex-1 min-w-0 resize-none"
                style={{ minHeight: 50, height: 'auto', fontFamily: 'inherit', opacity: !user ? 0.6 : 1 }}
                disabled={!user} />
              
              <button
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim()}
                className="a-cta-btn shrink-0"
                style={{ width: 42, height: 42, padding: 0, justifyContent: 'center', opacity: submitting || !newComment.trim() ? 0.5 : 1 }}>
                
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ?
          <div className="text-center py-8 rounded-2xl" style={{ background: 'var(--a-surface-soft)' }}>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
                <MessageCircle className="w-7 h-7" style={{ color: 'var(--a-accent-ink)' }} />
              </div>
              <p className="a-list-title" style={{ margin: 0 }}>{tr("blogpostdetail_hele_serh_yoxdur_1dfc90", "Hələ şərh yoxdur")}</p>
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("blogpostdetail_ilk_serhi_siz_yazin_00a364", "İlk şərhi siz yazın!")}</p>
            </div> :

          <div className="space-y-4">
              {comments.map((comment) => renderComment(comment))}
            </div>
          }
        </motion.div>

      <BlogShareDialog open={shareOpen} onOpenChange={setShareOpen} slug={post.slug} title={post.title} blog={{ id:post.id,slug:post.slug,title:post.title,excerpt:post.excerpt,cover_image_url:post.cover_image_url }} />
      {/* Related Posts */}
        <RelatedPosts
          currentPost={post}
          allPosts={allPosts}
          onSelectPost={onSelectPost} />
        
      </div>
    </div>);

};

export default BlogPostDetail;
