import { motion } from 'framer-motion';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { useSinglePost } from '@/hooks/useCommunity';
import PostCard from './PostCard';
import PostSeenObserver from './PostSeenObserver';
import { Skeleton } from '@/components/ui/skeleton';
import { tr } from '@/lib/tr';
import { isHeldPost } from '@/lib/community-moderation';
import MyModeratedPosts from './MyModeratedPosts';
import { moderatorText } from '@/lib/moderator-i18n';
import { moderatorReason } from '@/lib/moderator';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';

interface SinglePostViewProps {
  postId: string;
  /** Bildirişin aid olduğu konkret şərh/cavab — verilibsə, panel açılıb ona sürüşür + vurğulanır */
  commentId?: string | null;
  onBack: () => void;
  onUserClick?: (userId: string) => void;
}

/**
 * Bildiriş/deep-link vasitəsilə "MƏHZ bu paylaşımı" açmaq üçün xüsusi ekran.
 *
 * NİYƏ AYRICA EKRAN (adi feed-də scroll/highlight YOX): `useGroupPosts` cəmi
 * son 150 paylaşımı (dil/pin sırasına görə) gətirir — bildirişin aid olduğu
 * paylaşım bu 150-ə düşməyə bilər (daha köhnə, ya da başqa qrup/istifadəçi).
 * `useSinglePost` isə ID-yə görə TƏK bu paylaşımı, üst siyahıdan asılı olmadan
 * çəkir — RLS (is_same_country/is_group_member) burada da eyni tətbiq olunur,
 * yəni görə bilmədiyin bir paylaşımı açmaq cəhdi sadəcə "tapılmadı" göstərər.
 */
const SinglePostView = ({ postId, commentId, onBack, onUserClick }: SinglePostViewProps) => {
  const { data: post, isLoading } = useSinglePost(postId);

  return (
    <div className="a-scope community-native-text min-h-screen pb-24" style={{ background: 'var(--a-bg)' }}>
      <div className="sticky top-0 z-40 bg-background">
        <div className="px-5 py-3 flex items-center gap-3">
          <motion.button onClick={onBack} aria-label={tr('common_geri', 'Geri')} className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center" whileTap={{ scale: 0.9 }}>
            <ArrowLeft className="rtl:rotate-180 w-4 h-4 text-foreground" />
          </motion.button>
          <h1 className="text-[16px] font-black text-foreground truncate leading-tight">
            {tr('singlepostview_title', 'Paylaşım')}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-3">
        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : !post ? (
          <motion.div
            className="a-card text-center"
            style={{ padding: '36px 18px' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-surface-soft)' }}>
              <FileQuestion className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>
              {tr('singlepostview_not_found_title', 'Paylaşım tapılmadı')}
            </h3>
            <p className="a-list-sub" style={{ margin: '0 auto', maxWidth: 280, whiteSpace: 'normal', lineHeight: 1.5 }}>
              {tr('singlepostview_not_found_subtitle', 'Bu paylaşım silinmiş ola bilər, ya da onu görmək üçün icazəniz yoxdur.')}
            </p>
          </motion.div>
        ) : post.moderation_removed_at ? (
          <section className="a-card space-y-3"><h2 className="font-bold">{moderatorText('removed_marker')}</h2><p className="text-sm">{moderatorText('removed_body')}</p><p className="text-sm font-medium">{moderatorReason(post.moderation_reason)}</p>
            <button className="a-btn-soft min-h-11" onClick={() => window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: { screen: 'moderation-history' } }))}>{moderatorText('appeal')}</button>
          </section>
        ) : isHeldPost(post.ad_moderation_state) ? (
          <MyModeratedPosts postId={post.id} onRemoved={onBack} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <PostSeenObserver postId={post.id} createdAt={post.created_at} postUserId={post.user_id}>
              <PostCard
                post={post}
                groupId={post.group_id ?? null}
                onUserClick={onUserClick}
                forceShowComments
                highlightCommentId={commentId}
              />
            </PostSeenObserver>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SinglePostView;
