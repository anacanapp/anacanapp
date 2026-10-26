import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { moderationText } from '@/lib/community-moderation-i18n';
import { useUserStore } from '@/store/userStore';
import type { ModeratorContent } from '@/lib/moderator';
function safeUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password
    && [new URL(getBackendConfig().url).origin, 'https://tntbjulojatnrqmylorp.supabase.co'].includes(url.origin)
    && /^\/storage\/v1\/object\/(public|sign)\/community-media\//.test(url.pathname) ? url.href : null; } catch { return null; }
}
export default function ModeratorMedia({ content }: { content: Partial<ModeratorContent> }) {
  const language = useUserStore(state => state.language);
  const urls = content.media_urls?.length ? content.media_urls : content.media_url ? [content.media_url] : content.image_url ? [content.image_url] : [];
  if (!urls.length) return null;
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">{urls.map((raw, index) => {
    const url = safeUrl(raw);
    return <div key={index} className="min-w-0 rounded-xl border overflow-hidden bg-muted/30">{!url ? <p className="p-3 text-sm">{moderationText('media_unavailable', language)}</p>
      : /\.(mp4|mov|webm)(?:\?|$)/i.test(url) ? <video controls preload="metadata" src={url} className="max-h-72 w-full" />
        : <img src={url} alt={`${moderationText('media', language)} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" className="max-h-72 w-full object-contain" />}</div>;
  })}</div>;
}
