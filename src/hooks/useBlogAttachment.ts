import { useEffect, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import { useUserStore } from '@/store/userStore';
import { blogCommand, validSharedBlog, type SharedBlog } from '@/lib/community-blog';

export function useBlogAttachment(content: string, setContent: (value: string) => void, textarea: RefObject<HTMLTextAreaElement>, enabled = true) {
  const language = useUserStore(state => state.language), { user } = useAuth();
  const [cursor, setCursor] = useState(0), [selected, setSelected] = useState<SharedBlog | null>(null);
  const command = enabled ? blogCommand(content, cursor) : null;
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(command?.search || ''), 150); return () => clearTimeout(timer); }, [command?.search]);
  const results = useQuery({ queryKey: ['share-blog-search', getBackendConfig().url, user?.id, language, search], enabled: !!command && !!user,
    staleTime: 30000, queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('search_share_blogs_v1', { p_language: language, p_search: search, p_limit: 12 });
      if (error) throw error;
      if (!Array.isArray(data) || data.some(item => !validSharedBlog(item))) throw new Error('BLOG_SEARCH_INVALID');
      return data as SharedBlog[];
    } });
  const choose = (blog: SharedBlog) => {
    if (!command || !validSharedBlog(blog)) return;
    const next = content.slice(0, command.start) + content.slice(command.end);
    setSelected(blog); setContent(next); setCursor(command.start);
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(command.start, command.start); });
  };
  return { selected, setSelected, command, setCursor, results, choose };
}
