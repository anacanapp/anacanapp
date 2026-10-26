import { useBlog } from '@/hooks/useBlog';
import { useUserStore } from '@/store/userStore';
import { blogEditorial, blogMatchesStage, type BlogModule } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import { blogLinks, openAppBlog } from '@/lib/blog-links';

export default function ModuleArticles({ module }: { module: BlogModule }) {
  const { posts } = useBlog();
  const language = useUserStore(state => state.language), stage = useUserStore(state => state.lifeStage);
  const relevant = posts.filter(post => blogEditorial(post.editorial_metadata)?.modules.includes(module) && blogMatchesStage(post, stage)).slice(0, 3);
  if (!relevant.length) return null;
  return <section className="mt-3" data-module-articles={module}>
    <h3 className="a-list-title mb-2 text-sm">{blogText('related', language)}</h3>
    <div className="space-y-2">{relevant.map(post => <button key={post.id} className="text-start w-full flex gap-2 items-center text-sm"
      onClick={() => openAppBlog(blogLinks(post.slug, language).app)}>
      <span aria-hidden="true">📖</span><span className="underline">{post.title}</span>
    </button>)}</div>
  </section>;
}
