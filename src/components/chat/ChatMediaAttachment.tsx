import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { followupText } from '@/lib/followup-i18n';
import { tr } from '@/lib/chat-i18n';
import VoiceMessage from './VoiceMessage';

export default function ChatMediaAttachment({ src, type, own, onRenew, onPhoto }: {
  src: string; type: 'image' | 'video' | 'audio'; own: boolean;
  onRenew: () => Promise<string | null>; onPhoto: (url: string) => void;
}) {
  const [url, setUrl] = useState(src), [failed, setFailed] = useState(false), [loading, setLoading] = useState(false), [reload, setReload] = useState(0);
  const video = useRef<HTMLVideoElement>(null), latest = useRef(src), automaticRetry = useRef(false), alive = useRef(true), resumeAt = useRef(0);
  latest.current = src;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (video.current && !video.current.paused) return;
    resumeAt.current = video.current?.currentTime || 0;
    setUrl(src); setFailed(false);
  }, [src]);
  const renew = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const next = await onRenew();
      if (alive.current && next) { resumeAt.current = video.current?.currentTime || 0; setUrl(next); setReload(value => value + 1); setFailed(false); }
    } catch { /* Keep the retry control visible. */ }
    finally { if (alive.current) setLoading(false); }
  };
  const fail = () => {
    setFailed(true);
    if (!automaticRetry.current) { automaticRetry.current = true; void renew(); }
  };
  if (type === 'audio') return <VoiceMessage src={src} own={own} onRenew={onRenew} />;
  return <div className="min-w-0">
    {type === 'image' ? <img key={reload} src={url} className="chat-message-media cursor-pointer" alt={tr('chat_image', 'Şəkil')}
      loading="lazy" referrerPolicy="no-referrer" onLoad={() => setFailed(false)} onError={fail} onClick={() => !failed && onPhoto(url)} />
      : <video key={reload} ref={video} src={url} className="chat-message-media" controls playsInline preload="metadata" onError={fail}
        onLoadedMetadata={() => { if (video.current && resumeAt.current > 0) video.current.currentTime = Math.min(resumeAt.current, video.current.duration || resumeAt.current); }}
        onPause={() => { if (latest.current !== url) { resumeAt.current = video.current?.currentTime || 0; setUrl(latest.current); } }} />}
    {failed && <div className="chat-notice" role="status"><p>{followupText('media_failed')}</p>
      <button type="button" onClick={() => void renew()} disabled={loading} className="inline-flex items-center gap-2">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}{followupText('media_retry')}
      </button>
    </div>}
  </div>;
}
