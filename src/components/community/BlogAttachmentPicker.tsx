import { useUserStore } from '@/store/userStore';
import { feature37Text } from '@/lib/feature37-i18n';
import type { useBlogAttachment } from '@/hooks/useBlogAttachment';
import { BlogCardPreview } from './CommunityBlogCard';
export default function BlogAttachmentPicker({ attachment }: { attachment: ReturnType<typeof useBlogAttachment> }) {
  const language = useUserStore(state => state.language);
  return <div className="space-y-3" data-blog-attachment-picker>
    {attachment.command && <section className="a-card space-y-2" role="region" aria-label={feature37Text('blog_search', language)}>
      <p className="a-list-title">{feature37Text('blog_search', language)}</p>
      {attachment.results.isLoading ? <p role="status">{feature37Text('blog_searching', language)}</p> : attachment.results.isError ? <button type="button" onClick={() => void attachment.results.refetch()}>{feature37Text('blog_search_failed', language)}</button> : <div className="max-h-80 overflow-y-auto space-y-2">
        {!attachment.results.data?.length && <p role="status">{feature37Text('blog_no_results', language)}</p>}
        {attachment.results.data?.map(blog => <BlogCardPreview key={blog.id} blog={blog} onSelect={() => attachment.choose(blog)} />)}
      </div>}
    </section>}
    {attachment.selected && <BlogCardPreview blog={attachment.selected} onRemove={() => attachment.setSelected(null)} />}
    <p className="a-list-sub">{feature37Text('blog_command_hint', language)}</p>
  </div>;
}
