import { useState } from 'react';
import { Copy, Globe, Smartphone, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { followupText } from '@/lib/followup-i18n';
import { blogLinks, copyBlogLink, validBlogSlug } from '@/lib/blog-links';
import { nativeShare } from '@/lib/native';
import type { SharedBlog } from '@/lib/community-blog';
import { feature37Text } from '@/lib/feature37-i18n';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';

export default function BlogShareDialog({ open, onOpenChange, slug, title, blog }: { open: boolean; onOpenChange: (value: boolean) => void; slug: string; title: string; blog?: SharedBlog }) {
  const [kind, setKind] = useState<'website' | 'app'>('app'), [busy, setBusy] = useState(false);
  const language = useUserStore(state => state.language), { toast } = useToast();
  const links = validBlogSlug(slug) ? blogLinks(slug, language) : null, t = (key: Parameters<typeof followupText>[0]) => followupText(key, language);
  if (!links) return null;
  const copy = async () => {
    setBusy(true);
    try { await copyBlogLink(links[kind]); toast({ title: t('link_copied') }); onOpenChange(false); }
    catch { toast({ title: t('copy_failed'), variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md" data-blog-share>
    <DialogHeader><DialogTitle>{t('share_blog')}</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader>
    <div className="grid grid-cols-2 gap-3">{(['website','app'] as const).map(value => <button type="button" key={value} data-share-kind={value}
      aria-pressed={kind === value} onClick={() => setKind(value)} className="rounded-xl border p-3 text-start"
      style={{ background: kind === value ? 'var(--a-peach-1)' : 'var(--a-surface)', color: 'var(--a-ink)', borderColor: kind === value ? 'var(--a-accent-ink)' : 'var(--a-line)' }}>
      {value === 'website' ? <Globe size={20} /> : <Smartphone size={20} />}<strong className="block mt-2 text-sm">{t(value === 'website' ? 'share_website' : 'share_app')}</strong>
      <span className="block mt-1 text-xs">{t(value === 'website' ? 'share_website_description' : 'share_app_description')}</span>
    </button>)}</div>
    <p className="text-xs break-all" dir="ltr" data-share-url>{links[kind]}</p>
    {blog && <Button variant="outline" data-share-community onClick={() => { onOpenChange(false); window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: { tab:'community', communityTarget:{ composeBlog:blog } } })); }}>{feature37Text('blog_community_share', language)}</Button>}
    <Button onClick={() => void copy()} disabled={busy}><Copy size={16} className="me-2" />{t('copy_link')}</Button>
    <Button variant="outline" onClick={() => void nativeShare({ title, url: links[kind] })}><Share2 size={16} className="me-2" />{t('share_send')}</Button>
  </DialogContent></Dialog>;
}
