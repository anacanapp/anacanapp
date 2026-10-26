import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { ChevronRight, Clock, Eye, BookOpen } from 'lucide-react';
import { useBlog, BlogPost, BlogLifeStage } from '@/hooks/useBlog';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { blogMatchesStage } from '@/lib/blog-editorial';

interface RecentBlogPostsProps {
  onNavigate: (screen: string) => void;
  lifeStage?: BlogLifeStage;
  /** 'anacan' renders the redesigned (anacan-demo) article rows */
  variant?: 'default' | 'anacan';
}

const BlogPostCard = ({ post, index, onClick }: {post: BlogPost;index: number;onClick: () => void;}) => {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: getCurrentDateLocale()
  });

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="flex gap-3 p-3 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all text-start w-full group">
      
      {/* Thumbnail */}
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
        {post.cover_image_url ?
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> :


        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary/50" />
          </div>
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {post.title}
          </h4>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{post.reading_time} {tr("recentblogposts_deq_780a5c", "d\u0259q")}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span className="text-[10px]">{post.view_count}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center">
        <ChevronRight className="rtl:rotate-180 w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </motion.button>);

};

const RecentBlogPosts = ({ onNavigate, lifeStage, variant = 'default' }: RecentBlogPostsProps) => {
  const { posts, loading } = useBlog();

  // Filter posts strictly by life stage - only show posts for the current stage
  const filteredByStage = lifeStage ?
  posts.filter((p) => blogMatchesStage(p, lifeStage)) :
  posts;

  // Get only the 3 most recent filtered posts
  const recentPosts = filteredByStage.slice(0, 4);

  // ——— Anacan redesign (anacan-demo) article rows ———
  if (variant === 'anacan') {
    if (loading) {
      return (
        <section className="a-section">
          <div className="a-card animate-pulse" style={{ height: 180 }} />
        </section>);

    }

    if (recentPosts.length === 0) {
      return null;
    }

    return (
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("recentblogposts_son_meqaleler_0618a6", "Son Məqalələr")}</h2>
          <button type="button" className="a-section-link" onClick={() => onNavigate('blog')}>
            {tr('blogscreen_all_filter', 'Hamısı')} <ChevronRight className="rtl:rotate-180" size={13} />
          </button>
        </div>
        <div className="a-card a-fade-in" style={{ padding: '6px 18px' }}>
          {recentPosts.map((post) => {
            const timeAgo = formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
              locale: getCurrentDateLocale()
            });
            return (
              <button
                key={post.id}
                type="button"
                className="a-article-row"
                onClick={() => onNavigate(`blog/${post.slug}`)}>
                
                <span className="a-article-thumb" style={{ background: 'var(--a-peach-1)' }}>
                  {post.cover_image_url ?
                  <img src={post.cover_image_url} alt={post.title} loading="lazy" /> :

                  <BookOpen size={20} style={{ color: 'var(--a-accent-ink)' }} />
                  }
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="a-article-title">{post.title}</p>
                  <div className="a-article-meta">
                    <span>
                      <Clock size={10} /> {post.reading_time} {tr("recentblogposts_deq_780a5c", "d\u0259q")}
                    </span>
                    <span>
                      <Eye size={10} /> {post.view_count}
                    </span>
                    <span>{timeAgo}</span>
                  </div>
                </div>
              </button>);

          })}
        </div>
      </section>);

  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-5">
        
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-24 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) =>
          <div key={i} className="flex gap-3 p-3 bg-card rounded-2xl border border-border/50">
              <div className="w-20 h-20 rounded-xl bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </motion.div>);

  }

  if (recentPosts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">{tr("recentblogposts_son_meqaleler_0618a6", "Son Məqalələr")}</h3>
        </div>
        <motion.button
          onClick={() => onNavigate('blog')}
          className="flex items-center gap-1 text-primary text-sm font-semibold hover:gap-2 transition-all"
          whileTap={{ scale: 0.95 }}>
          
          {tr('blogscreen_all_filter', 'Hamısı')}
          <ChevronRight className="rtl:rotate-180 w-4 h-4" />
        </motion.button>
      </div>

      {/* Posts List */}
      <div className="space-y-2.5">
        {recentPosts.map((post, index) =>
        <BlogPostCard
          key={post.id}
          post={post}
          index={index}
          onClick={() => onNavigate(`blog/${post.slug}`)} />

        )}
      </div>
    </motion.div>);

};

export default RecentBlogPosts;
