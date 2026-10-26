import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { tr, mapRowsTranslation, mapRowTranslation } from '@/lib/tr';
import { useLanguage } from '@/hooks/useLanguage';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { blogLocale, blogCoverUrl } from '@/lib/blog-editorial';

export type BlogLifeStage = 'flow' | 'bump' | 'mommy' | 'all';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  title_az?: string;
  title_en?: string;
  title_ru?: string;
  title_tr?: string;
  excerpt_az?: string;
  excerpt_en?: string;
  excerpt_ru?: string;
  excerpt_tr?: string;
  content_az?: string;
  content_en?: string;
  content_ru?: string;
  content_tr?: string;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  author_name: string;
  author_avatar_url: string | null;
  reading_time: number;
  is_featured: boolean;
  is_published: boolean;
  /** Ölkə hədəfləməsi: include boş deyilsə yalnız o ölkələrə görünür */
  countries_include?: string[] | null;
  /** exclude siyahısındakı ölkələrdə gizlənir */
  countries_exclude?: string[] | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category_ids?: string[]; // For multi-category support
  life_stage: BlogLifeStage;
  editorial_metadata?: unknown;
  category_slugs?: string[];
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BlogPostCategory {
  id: string;
  post_id: string;
  category_id: string;
  created_at: string;
}

/** Ölkə filtri: include boş deyilsə ölkə siyahıda OLMALIdır;
    exclude boş deyilsə ölkə siyahıda OLMAMALIdır. null/boş = hamıya görünür. */
const passesCountryFilter = (post: any, country: string | null): boolean => {
  const inc: string[] = Array.isArray(post.countries_include) ? post.countries_include : [];
  const exc: string[] = Array.isArray(post.countries_exclude) ? post.countries_exclude : [];
  if (inc.length > 0 && (!country || !inc.includes(country))) return false;
  if (exc.length > 0 && country && exc.includes(country)) return false;
  return true;
};

export function localizeBlogPost(post: BlogPost, language: string): BlogPost {
  const localized = mapRowTranslation(post, language, ['title', 'content', 'excerpt'])!;
  const locale = blogLocale(post.editorial_metadata, language);
  return { ...localized, tags: locale?.tags || post.tags || [],
    author_name: post.author_name || 'Anacan', reading_time: post.reading_time || 5,
    view_count: post.view_count || 0, cover_image_url: blogCoverUrl(post.cover_image_url) || null };
}

export const useBlog = () => {
  const { language } = useLanguage();
  const countryCode = useUserStore((s) => s.countryCode);
  const { profile } = useAuth();
  const userCountry = (profile as any)?.country_code || countryCode || null;
  const backend = getBackendConfig().url;
  const postQuery = useQuery({
    queryKey: ['blog-posts-v2', backend, language, userCountry], staleTime: 60_000,
    queryFn: async () => {
      // Sərhədsiz idi (bütün nəşr olunmuş məqalələr) — təhlükəsizlik həddi
      // əlavə olunub; ölkə/kateqoriya/axtarış filtri hələ də client-side-dır
      // (bu cədvəl admin-idarəli məzmundur, community_posts kimi istifadəçi
      // sayı ilə mütənasib böyümür, ona görə server-side array-overlap
      // filtrinə keçid bu keçiddə prioritet deyil).
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*, blog_post_categories(category_id, blog_categories(slug))')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      let typedPosts = (data || []) as BlogPost[];
      // Ölkə hədəfləməsi (admin include/exclude)
      typedPosts = typedPosts.filter((p) => passesCountryFilter(p, userCountry));
      // QEYD: 'category'/'tags' mapRowsTranslation-a verilmir — bu sahələr azure-translate.cjs
      // REGISTRY-də tərcümə üçün qeydiyyatdan keçməyib (yalnız title/content/excerpt var);
      // əvvəllər 'category' burda verildikdə mövcud olan stray category_en sütunu post-un
      // slug-ını əvəz edirdi (yalnız EN istifadəçiləri üçün) və kateqoriya filtri/uyğunlaşması sınırdı.
      return typedPosts.map(post => ({ ...localizeBlogPost(post, language),
        category_slugs: [...new Set([post.category, ...((post as any).blog_post_categories || []).map((item: any) => item.blog_categories?.slug).filter(Boolean)])] }));
    },
  });
  const categoryQuery = useQuery({
    queryKey: ['blog-categories-v2', backend, language], staleTime: 300_000,
    queryFn: async () => {
      const data = await fetchAllRows((from, to) =>
        supabase
          .from('blog_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .range(from, to)
      );
      let typedCategories = (data || []) as BlogCategory[];
      typedCategories = mapRowsTranslation(typedCategories, language, ['name', 'description']);
      return typedCategories;
    },
  });
  const posts = postQuery.data || [], categories = categoryQuery.data || [];
  const featuredPosts = posts.filter(post => post.is_featured);
  const loading = postQuery.isLoading || categoryQuery.isLoading;

  const getPostBySlug = useCallback(async (slug: string): Promise<BlogPost | null> => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      
      if (data && !passesCountryFilter(data, userCountry)) return null;
      return data ? localizeBlogPost(data as BlogPost, language) : null;
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  }, [language, userCountry]);

  const getPostsByCategory = useCallback((categorySlug: string) => {
    return posts.filter(p => p.category === categorySlug || p.category_slugs?.includes(categorySlug));
  }, [posts]);

  const searchPosts = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return posts.filter(p => 
      p.title.toLowerCase().includes(lowerQuery) ||
      (p.excerpt && p.excerpt.toLowerCase().includes(lowerQuery)) ||
      (p.tags || []).some(t => t.toLowerCase().includes(lowerQuery))
    );
  }, [posts]);

  return {
    posts,
    categories,
    featuredPosts,
    loading,
    getPostBySlug,
    getPostsByCategory,
    searchPosts,
    error: postQuery.error || categoryQuery.error,
    refetch: () => Promise.all([postQuery.refetch(), categoryQuery.refetch()])
  };
};

// Admin hook for managing blog
export const useBlogAdmin = () => {
  const { language } = useLanguage();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [postCategories, setPostCategories] = useState<BlogPostCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllPosts = useCallback(async () => {
    try {
      // DÜZƏLİŞ: limitsiz idi — blog_posts 1000-i keçəndə Admin Blog
      // panelində ən köhnə yazılar görünmürdü (redaktə/silmək mümkün deyildi).
      const data = await fetchAllRows((from, to) =>
        supabase
          .from('blog_posts')
          .select('*')
          .setHeader('X-Anacan-Blog-Format', 'source-v1')
          .order('created_at', { ascending: false })
          .range(from, to)
      );
      let typedPosts = (data || []) as BlogPost[];
      typedPosts = mapRowsTranslation(typedPosts, language, ['title', 'content', 'excerpt']);
      setPosts(typedPosts);
      return typedPosts;
    } catch (error) {
      console.error('Error fetching posts by category:', error);
      return [];
    }
  }, [language]);

  const fetchAllCategories = useCallback(async () => {
    try {
      const data = await fetchAllRows((from, to) =>
        supabase
          .from('blog_categories')
          .select('*')
          .order('sort_order', { ascending: true })
          .range(from, to)
      );
      let typedCategories = (data || []) as BlogCategory[];
      typedCategories = mapRowsTranslation(typedCategories, language, ['name', 'description']);
      setCategories(typedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const fetchPostCategories = useCallback(async () => {
    try {
      // DÜZƏLİŞ: limitsiz idi — join cədvəli blog_posts-dan da böyük ola bilər,
      // 1000-dən sonrakı yazılar kateqoriyasız görünürdü.
      const data = await fetchAllRows((from, to) =>
        supabase
          .from('blog_post_categories')
          .select('*')
          .range(from, to)
      );
      setPostCategories((data || []) as BlogPostCategory[]);
    } catch (error) {
      console.error('Error fetching post categories:', error);
    }
  }, []);

  // Get category IDs for a specific post
  const getPostCategoryIds = useCallback((postId: string): string[] => {
    return postCategories
      .filter(pc => pc.post_id === postId)
      .map(pc => pc.category_id);
  }, [postCategories]);

  // Set categories for a post (replace all)
  const setPostCategoriesForPost = async (postId: string, categoryIds: string[]) => {
    try {
      // First delete existing categories for this post
      await supabase
        .from('blog_post_categories')
        .delete()
        .eq('post_id', postId);

      // Then insert new categories
      if (categoryIds.length > 0) {
        const inserts = categoryIds.map(categoryId => ({
          post_id: postId,
          category_id: categoryId
        }));

        const { error } = await supabase
          .from('blog_post_categories')
          .insert(inserts);

        if (error) throw error;
      }

      await fetchPostCategories();
      return { error: null };
    } catch (error) {
      console.error('Error setting post categories:', error);
      return { error };
    }
  };

  const createPost = async (post: Partial<Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'view_count'>> & { title: string; content: string; slug: string }, categoryIds?: string[]) => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert({ ...post, editorial_metadata: post.editorial_metadata as Json | undefined })
        .select()
        .single();

      if (error) throw error;
      
      // If category IDs provided, set them
      if (data && categoryIds && categoryIds.length > 0) {
        await setPostCategoriesForPost(data.id, categoryIds);
      }

      await fetchAllPosts();
      return { data: data as BlogPost, error: null };
    } catch (error) {
      console.error('Error creating post:', error);
      return { data: null, error };
    }
  };

  const updatePost = async (id: string, updates: Partial<BlogPost>, categoryIds?: string[]) => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .update({ ...updates, editorial_metadata: updates.editorial_metadata as Json | undefined })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // If category IDs provided, update them
      if (categoryIds !== undefined) {
        await setPostCategoriesForPost(id, categoryIds);
      }

      await fetchAllPosts();
      return { data: data as BlogPost, error: null };
    } catch (error) {
      console.error('Error updating post:', error);
      return { data: null, error };
    }
  };

  const deletePost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchAllPosts();
      return { error: null };
    } catch (error) {
      console.error('Error deleting post:', error);
      return { error };
    }
  };

  const createCategory = async (category: Omit<BlogCategory, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      await fetchAllCategories();
      return { data: data as BlogCategory, error: null };
    } catch (error) {
      console.error('Error creating category:', error);
      return { data: null, error };
    }
  };

  const updateCategory = async (id: string, updates: Partial<BlogCategory>) => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchAllCategories();
      return { data: data as BlogCategory, error: null };
    } catch (error) {
      console.error('Error updating category:', error);
      return { data: null, error };
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      // First check if category is used
      const postsUsingCategory = postCategories.filter(pc => pc.category_id === id);
      if (postsUsingCategory.length > 0) {
        return { error: new Error(`${tr("useblog_bu_kateqoriya", "Bu kateqoriya")} ${postsUsingCategory.length} ${tr("useblog_meqalede_istifade_olunur", "məqalədə istifadə olunur. Əvvəlcə məqalələrdən çıxarın.")}`) };
      }

      const { error } = await supabase
        .from('blog_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchAllCategories();
      return { error: null };
    } catch (error) {
      console.error('Error deleting category:', error);
      return { error };
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAllPosts(), fetchAllCategories(), fetchPostCategories()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAllPosts, fetchAllCategories, fetchPostCategories]);

  return {
    posts,
    categories,
    postCategories,
    loading,
    getPostCategoryIds,
    setPostCategoriesForPost,
    createPost,
    updatePost,
    deletePost,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: () => Promise.all([fetchAllPosts(), fetchAllCategories(), fetchPostCategories()])
  };
};
