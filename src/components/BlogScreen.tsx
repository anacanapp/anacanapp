import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Clock, Eye, ChevronRight,
  BookOpen, Sparkles, Bookmark, Heart, TrendingUp,
  Filter, Star } from
'lucide-react';
import { useBlog, BlogPost, BlogCategory } from '@/hooks/useBlog';
import { useSavedPosts } from '@/hooks/useBlogInteractions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { saveScroll, restoreScroll, cancelScrollRestoration } from '@/lib/scrollMemory';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import BlogPostDetail from '@/components/blog/BlogPostDetail';
import { tr } from "@/lib/tr";
import { AdInlineAnchor, AdSurface } from '@/components/ads/AdExperienceProvider';
import { followupText } from '@/lib/followup-i18n';
import { blogMatchesStage } from '@/lib/blog-editorial';
import BlogSeo from '@/components/blog/BlogSeo';

interface BlogScreenProps {
  onBack: () => void;
  initialSlug?: string;
  lifeStage?: string;
}

const BlogScreen = ({ onBack, initialSlug, lifeStage }: BlogScreenProps) => {
  useScrollToTop();
  useScreenAnalytics('Blog', 'Content');

  const { user } = useAuth();
  const { posts, categories, featuredPosts, loading, searchPosts, getPostsByCategory, getPostBySlug } = useBlog();
  const { savedPosts } = useSavedPosts();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [openedFromHome, setOpenedFromHome] = useState(false);
  const handledSlug = useRef<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(!!initialSlug), [linkMissing, setLinkMissing] = useState(false);

  // Set initial post when posts load and initialSlug is provided
  // Also increment view count when opening a post
  useEffect(() => {
    const incrementView = async (postId: string) => {
      try {
        await supabase.rpc('increment_blog_view_count', { post_id: postId });
      } catch (error) {
        console.error('Failed to increment view count:', error);
      }
    };

    if (!initialSlug) return;
    let cancelled = false; setLinkLoading(true); setLinkMissing(false);
    void getPostBySlug(initialSlug).then(post => {
      if (cancelled) return;
      setLinkLoading(false); setLinkMissing(!post);
      if (!post) { setSelectedPost(null); return; }
      if (handledSlug.current !== initialSlug) { handledSlug.current = initialSlug; void incrementView(post.id); }
      cancelScrollRestoration(); setSelectedPost(post); setOpenedFromHome(true);
    });
    return () => { cancelled = true; };
  }, [initialSlug, getPostBySlug]);
  useEffect(() => {
    if (!initialSlug) setSelectedPost(previous => posts.find(post => post.id === previous?.id) || previous);
  }, [posts, initialSlug]);

  // Increment view count when selecting a post from list
  const handleSelectPost = async (post: BlogPost, fromList = true) => {
    if (fromList) saveScroll('blog');
    cancelScrollRestoration();
    setSelectedPost(post);
    try {
      await supabase.rpc('increment_blog_view_count', { post_id: post.id });
    } catch (error) {
      console.error('Failed to increment view count:', error);
    }
  };

  const savedPostsList = posts.filter((p) => savedPosts.includes(p.id));

  // Sort posts: current life stage first, then others
  const sortedPosts = lifeStage ?
  [...posts].sort((a, b) => {
    const aMatch = blogMatchesStage(a, lifeStage) ? 0 : 1;
    const bMatch = blogMatchesStage(b, lifeStage) ? 0 : 1;
    return aMatch - bMatch;
  }) :
  posts;

  const filteredPosts = showSaved ?
  savedPostsList :
  searchQuery ?
  searchPosts(searchQuery) :
  selectedCategory ?
  getPostsByCategory(selectedCategory) :
  sortedPosts;

  // Handle back from post detail
  const handleBackFromPost = () => {
    // If opened directly from home screen, go back to home
    if (openedFromHome) {
      onBack();
    } else {
      // Otherwise, just close the post and show blog list
      setSelectedPost(null);
      restoreScroll('blog');
    }
  };

  if (loading || linkLoading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden relative" style={{ background: 'var(--a-bg)' }}>
        <button className="a-icon-btn absolute start-4 top-4" aria-label={tr('common_geri', 'Geri')} onClick={onBack}><ArrowLeft className="rtl:rotate-180" size={18} /></button>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: 'var(--a-grad-lav)' }}>
            <BookOpen size={28} style={{ color: 'var(--a-lav-ink)' }} />
          </div>
          <p className="a-list-sub" style={{ margin: 0 }}>{tr("blogscreen_meqaleler_yuklenir_3f3d01", "Məqalələr yüklənir...")}</p>
        </div>
      </div>);

  }

  if (linkMissing) return <div className="a-scope a-shell py-8"><button className="a-icon-btn" onClick={onBack}><ArrowLeft className="rtl:rotate-180" size={18} /></button>
    <p role="status" className="a-list-title mt-4">{followupText('blog_unavailable')}</p></div>;

  if (selectedPost) {
    return (
      <BlogPostDetail
        key={selectedPost.id}
        post={selectedPost}
        categories={categories}
        allPosts={posts}
        onBack={handleBackFromPost}
        onSelectPost={(post) => {
          handleSelectPost(post, false);
          setOpenedFromHome(false);
        }} />);


  }

  return (
    <div className="a-scope pb-24 overflow-y-auto" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <BlogSeo />
      <AdSurface id="blog_list_banner" />
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar safe-area-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              className="a-icon-btn"
              whileTap={{ scale: 0.9 }}>
              
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{posts.length} {tr("blogscreen_meqale_63f1b2", "m\u0259qal\u0259")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("blogscreen_ana_bloqu_28124b", "Qadın Bloqları")}</p>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="a-search">
          <Search size={15} strokeWidth={2} color="var(--a-ink-faint)" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSaved(false);
            }}
            placeholder={tr("blogscreen_meqale_axtar_0441c1", "Məqalə axtar...")} />
          
        </div>

        {/* Categories */}
        <motion.div
          className="a-tag-row hide-scrollbar"
          style={{ flexWrap: 'nowrap', overflowX: 'auto', marginTop: 12, marginBottom: 0, paddingBottom: 4 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          
          <button
            onClick={() => {setSelectedCategory(null);setShowSaved(false);}}
            className={`a-tag${!selectedCategory && !showSaved ? ' on' : ''}`}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            
            <Sparkles size={12} />
            {tr('blogscreen_all_filter', 'Hamısı')}
          </button>

          {user &&
          <button
            onClick={() => {setShowSaved(true);setSelectedCategory(null);setSearchQuery('');}}
            className={`a-tag${showSaved ? ' on' : ''}`}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            
              <Bookmark size={12} />
              {tr("blogscreen_saxlanilanlar_8882c1", "Saxlan\u0131lanlar")}
              {savedPosts.length > 0 && <span style={{ fontWeight: 800 }}>· {savedPosts.length}</span>}
            </button>
          }

          {categories.map((category) =>
          <button
            key={category.id}
            onClick={() => {setSelectedCategory(category.slug);setShowSaved(false);}}
            className={`a-tag${selectedCategory === category.slug && !showSaved ? ' on' : ''}`}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            
              <span>{category.icon}</span>
              {category.name}
            </button>
          )}
        </motion.div>

        {/* Featured Posts */}
        <AdInlineAnchor id="blog_list_banner" />
        {!selectedCategory && !searchQuery && !showSaved && featuredPosts.length > 0 &&
        <motion.section
          className="a-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
            <div className="a-section-head">
              <h2 className="a-section-title a-heading">⭐ {tr("blogscreen_one_cixan_648e68", "Önə Çıxan")}</h2>
            </div>
            
            <div className="a-hscroll hide-scrollbar">
              {featuredPosts.slice(0, 3).map((post, index) =>
            <motion.button
              key={post.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + index * 0.08 }}
              onClick={() => handleSelectPost(post)}
              className="a-hscroll-card"
              style={{ width: 240, padding: 0, overflow: 'hidden' }}>
              
                  <div className="relative">
                    {post.cover_image_url ?
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: 120, objectFit: 'cover' }} /> :


                <div style={{ width: '100%', height: 120, background: 'var(--a-grad-lav)', display: 'grid', placeItems: 'center' }}>
                        <BookOpen size={32} style={{ color: 'color-mix(in srgb, var(--a-lav-ink) 50%, transparent)' }} />
                      </div>
                }
                    <span className="a-cta-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, padding: '4px 9px', fontSize: 9.5 }}>
                      ⭐ {tr("blogscreen_secilmis_1fa6ef", "Se\xE7ilmi\u015F")}
                    </span>
                  </div>
                  <div style={{ padding: 12 }}>
                    <p className="a-hscroll-title" style={{ margin: '0 0 4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</p>
                    <p className="a-hscroll-text" style={{ WebkitLineClamp: 2 }}>{post.excerpt}</p>
                    <div className="a-article-meta" style={{ marginTop: 8 }}>
                      <span><Clock size={10} /> {post.reading_time} {tr("blogscreen_deq_780a5c", "d\u0259q")}</span>
                      <span><Eye size={10} /> {post.view_count}</span>
                    </div>
                  </div>
                </motion.button>
            )}
            </div>
          </motion.section>
        }

        {/* All Posts */}
        <motion.section
          className="a-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}>
          
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">
              {showSaved ? tr("blogscreen_saxlanilan_meqaleler_7e3136", "Saxlan\u0131lan M\u0259qal\u0259l\u0259r") :

              selectedCategory ?
              categories.find((c) => c.slug === selectedCategory)?.name :
              searchQuery ?
              tr("blogscreen_x_ucun_neticeler_b1a2c3", '"{query}" üçün nəticələr').replace('{query}', searchQuery) : tr("blogscreen_butun_meqaleler_df9384", "B\xFCt\xFCn M\u0259qal\u0259l\u0259r")

              }
            </h2>
            <span className="a-section-link">
              {filteredPosts.length} {tr("blogscreen_meqale_63f1b2", "m\u0259qal\u0259")}
            </span>
          </div>

          {filteredPosts.length === 0 ?
          <div className="a-card" style={{ textAlign: 'center', padding: '32px 18px' }}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-lav-1)' }}>
                <BookOpen size={26} style={{ color: 'var(--a-lav-ink)' }} />
              </div>
              <h3 className="a-list-title" style={{ marginBottom: 4 }}>
                {showSaved ? tr("blogscreen_saxlanilmis_meqale_yoxdur_a9cc59", "Saxlan\u0131lm\u0131\u015F m\u0259qal\u0259 yoxdur") : tr("blogscreen_meqale_tapilmadi_746d12", "M\u0259qal\u0259 tap\u0131lmad\u0131")}
              </h3>
              <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
                {showSaved ? tr("blogscreen_beyendiyiniz_meqaleleri_saxlay_a35db1", "B\u0259y\u0259ndiyiniz m\u0259qal\u0259l\u0259ri saxlay\u0131n") :

              searchQuery ? tr("blogscreen_ferqli_acar_sozlerle_axtarin_cb3a83", "F\u0259rqli a\xE7ar s\xF6zl\u0259rl\u0259 axtar\u0131n") : tr("blogscreen_tezlikle_yeni_meqaleler_elave__20524a", "Tezlikl\u0259 yeni m\u0259qal\u0259l\u0259r \u0259lav\u0259 olunacaq")


              }
              </p>
            </div> :

          <div className="a-card" style={{ padding: '6px 18px' }}>
              {filteredPosts.map((post, index) =>
            <motion.button
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.35 + index * 0.03, 0.6) }}
              onClick={() => handleSelectPost(post)}
              className="a-article-row">
              
                  <span className="a-article-thumb" style={{ background: 'var(--a-lav-1)', position: 'relative' }}>
                    {post.cover_image_url ?
                <img src={post.cover_image_url} alt={post.title} loading="lazy" /> :

                <BookOpen size={20} style={{ color: 'var(--a-lav-ink)' }} />
                }
                    {savedPosts.includes(post.id) &&
                <span style={{ position: 'absolute', top: 3, insetInlineEnd: 3, width: 18, height: 18, borderRadius: 999, background: 'var(--a-yellow-2)', display: 'grid', placeItems: 'center' }}>
                        <Bookmark size={9} style={{ color: '#fff', fill: '#fff' }} />
                      </span>
                }
                  </span>
                  
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="a-list-value" style={{ color: 'var(--a-peach-2)', marginBottom: 2 }}>
                      {categories.find((c) => c.slug === post.category)?.icon} {categories.find((c) => c.slug === post.category)?.name || post.category}
                    </p>
                    <p className="a-article-title">{post.title}</p>
                    <div className="a-article-meta">
                      <span><Clock size={10} /> {post.reading_time} {tr("blogscreen_deq_780a5c", "d\u0259q")}</span>
                      <span><Eye size={10} /> {post.view_count}</span>
                    </div>
                  </div>
                  
                  <ChevronRight size={15} className="rtl:rotate-180 a-list-chevron" />
                </motion.button>
            )}
            </div>
          }
        </motion.section>
      </div>
    </div>);

};

export default BlogScreen;
