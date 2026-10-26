import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { Clock, ChevronRight } from 'lucide-react';
import { BlogPost } from '@/hooks/useBlog';
import { blogEditorial } from '@/lib/blog-editorial';

interface RelatedPostsProps {
  currentPost: BlogPost;
  allPosts: BlogPost[];
  onSelectPost: (post: BlogPost) => void;
}

const RelatedPosts = ({ currentPost, allPosts, onSelectPost }: RelatedPostsProps) => {
  // Find related posts based on category and tags
  const getRelatedPosts = () => {
    const scored = allPosts.
    filter((post) => post.id !== currentPost.id && post.is_published).
    map((post) => {
      let score = 0;
      const editorial = blogEditorial(currentPost.editorial_metadata), other = blogEditorial(post.editorial_metadata);
      if (editorial?.relatedSlugs.includes(post.slug)) score += 20;
      if (editorial && other) score += editorial.modules.filter(module => other.modules.includes(module)).length * 2;

      // Same category = +3 points
      if (post.category === currentPost.category) {
        score += 3;
      }

      // Matching tags = +1 point each
      const currentTags = currentPost.tags || [];
      const postTags = post.tags || [];
      const matchingTags = currentTags.filter((tag) =>
      postTags.some((t) => t.toLowerCase() === tag.toLowerCase())
      );
      score += matchingTags.length;

      // Same author = +1 point
      if (post.author_name === currentPost.author_name) {
        score += 1;
      }

      return { post, score };
    }).
    filter((item) => item.score > 0).
    sort((a, b) => b.score - a.score).
    slice(0, 4).
    map((item) => item.post);

    // If not enough related posts, add recent posts
    if (scored.length < 3) {
      const recentPosts = allPosts.
      filter((post) =>
      post.id !== currentPost.id &&
      post.is_published &&
      !scored.some((s) => s.id === post.id)
      ).
      slice(0, 3 - scored.length);

      return [...scored, ...recentPosts];
    }

    return scored;
  };

  const relatedPosts = getRelatedPosts();

  if (relatedPosts.length === 0) return null;

  return (
    <div className="mt-6 pt-2">
      <div className="a-section-head">
        <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>
          {tr("relatedposts_oxsar_meqaleler_c3c8cf", "\uD83D\uDCDA Ox\u015Far M\u0259qal\u0259l\u0259r")}
        </h3>
      </div>
      
      <div className="a-list-card">
        {relatedPosts.map((post, index) =>
        <motion.button
          key={post.id}
          onClick={() => onSelectPost(post)}
          className="a-list-row w-full text-start"
          style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileTap={{ scale: 0.98 }}>
          
            {post.cover_image_url ?
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-14 h-14 rounded-xl object-cover shrink-0" /> :


          <span className="a-list-icon" style={{ background: 'var(--a-illus-grad)', fontSize: 20 }}>
                📖
              </span>
          }
            
            <div className="flex-1 min-w-0">
              <p className="a-list-title line-clamp-2" style={{ whiteSpace: 'normal' }}>
                {post.title}
              </p>
              <p className="a-list-sub flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>{post.reading_time} {tr("relatedposts_deq_780a5c", "d\u0259q")}</span>
                <span>•</span>
                <span>{post.view_count} {tr("relatedposts_baxis_d4da3e", "bax\u0131\u015F")}</span>
              </p>
            </div>
            
            <ChevronRight size={16} className="rtl:rotate-180 a-list-chevron" />
          </motion.button>
        )}
      </div>
    </div>);

};

export default RelatedPosts;
