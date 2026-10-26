import { BookOpen, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { blogCardUrl, blogImageUrl, validSharedBlog, type SharedBlog } from '@/lib/community-blog';
import { openAppBlog } from '@/lib/blog-links';
import { feature37Text } from '@/lib/feature37-i18n';

export function BlogCardPreview({ blog, onRemove, onSelect }: { blog: SharedBlog; onRemove?: () => void; onSelect?: () => void }) {
  const language = useUserStore(state => state.language), image = blogImageUrl(blog.cover_image_url);
  return <article className="relative rounded-2xl overflow-hidden border text-start" style={{ borderColor: 'var(--a-line)', background: 'var(--a-surface)' }} data-shared-blog={blog.id}>
    <button type="button" className="block w-full text-start" onClick={event => { event.stopPropagation(); onSelect ? onSelect() : openAppBlog(blogCardUrl(blog)); }}>
      {image ? <img src={image} alt="" className="w-full aspect-[1.91] object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <div className="h-24 flex items-center justify-center" style={{ background: 'var(--a-lav-1)' }}><BookOpen size={28} /></div>}
      <div className="p-3"><p className="a-eyebrow">{feature37Text('blog_label', language)}</p><h3 className="a-list-title mt-1">{blog.title}</h3>{blog.excerpt && <p className="a-list-sub mt-1 line-clamp-2">{blog.excerpt}</p>}</div>
    </button>
    {onRemove && <button type="button" aria-label={feature37Text('blog_remove', language)} className="absolute end-2 top-2 rounded-full bg-black/75 text-white p-1.5" onClick={event => { event.stopPropagation(); onRemove(); }}><X size={16} /></button>}
  </article>;
}
export default function CommunityBlogCard({ id }: { id: string }) {
  const language = useUserStore(state => state.language), { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['community-blog-card', getBackendConfig().url, user?.id, language, id], enabled: !!user && !!id, staleTime: 30000,
    queryFn: async () => { const { data, error } = await (supabase as any).rpc('search_share_blogs_v1', { p_language: language, p_search: '', p_ids: [id], p_limit: 1 }); if (error) throw error; return Array.isArray(data) && validSharedBlog(data[0]) ? data[0] as SharedBlog : null; } });
  if (!data) return <p className="a-list-sub py-3" role="status">{feature37Text(isLoading ? 'blog_searching' : 'blog_unavailable', language)}</p>;
  return <div className="my-3"><BlogCardPreview blog={data} /></div>;
}
