import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '@/lib/chat-i18n';

const seconds = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
const VOICE_PLAY_EVENT = 'anacan:voice-message-play';

export default function VoiceMessage({ src, own = false, onRenew }: {
  src: string; own?: boolean; onRenew?: () => Promise<string | null>;
}) {
  const id = useId(), audio = useRef<HTMLAudioElement>(null), alive = useRef(true);
  const [url, setUrl] = useState(src), [playing, setPlaying] = useState(false), [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(0), [failed, setFailed] = useState(false);
  const attemptedRenewal = useRef<string | null>(null);
  const lease = useRef(src), resumeAt = useRef(0);
  useEffect(() => {
    // A new lease need not interrupt a currently playing stream. It is adopted
    // on pause/next playback, before a new range request can use an old token.
    lease.current = src;
    if (audio.current?.paused !== false) { resumeAt.current = audio.current?.ended ? 0 : audio.current?.currentTime || 0; setUrl(src); setFailed(false); }
  }, [src]);
  useEffect(() => {
    alive.current = true;
    const pauseOther = (event: Event) => { if ((event as CustomEvent).detail !== id) audio.current?.pause(); };
    window.addEventListener(VOICE_PLAY_EVENT, pauseOther);
    const element = audio.current;
    return () => {
      alive.current = false; window.removeEventListener(VOICE_PLAY_EVENT, pauseOther);
      element?.pause();
    };
  }, [id]);
  const toggle = async () => {
    const element = audio.current;
    if (!element || loading) return;
    if (!element.paused) { element.pause(); return; }
    setLoading(true); setFailed(false);
    try {
      if (url !== lease.current) { resumeAt.current = element.ended ? 0 : element.currentTime; element.src = lease.current; setUrl(lease.current); element.load(); }
      // Call play in the user gesture; state follows native events, not a guessed toggle.
      await element.play();
      if (alive.current) window.dispatchEvent(new CustomEvent(VOICE_PLAY_EVENT, { detail: id }));
    } catch {
      if (alive.current) { setFailed(true); setPlaying(false); }
    } finally { if (alive.current) setLoading(false); }
  };
  const retry = async () => {
    if (onRenew) {
      setLoading(true);
      try { const renewed = await onRenew(); if (alive.current && renewed) { lease.current = renewed; setUrl(renewed); if (audio.current) { audio.current.src = renewed; audio.current.load(); } setFailed(false); } }
      catch { /* Retain the visible retry state; never claim playback succeeded. */ }
      finally { if (alive.current) setLoading(false); }
    } else { audio.current?.load(); setFailed(false); }
  };
  const mediaError = () => {
    setPlaying(false); setLoading(false); setFailed(true);
    if (!onRenew || attemptedRenewal.current !== null) return;
    attemptedRenewal.current = url;
    setLoading(true);
    void onRenew().then(renewed => {
      if (alive.current && renewed) { lease.current = renewed; setUrl(renewed); if (audio.current) { audio.current.src = renewed; audio.current.load(); } setFailed(false); }
    }).catch(() => {}).finally(() => { if (alive.current) setLoading(false); });
  };
  const updateTime = () => {
    const element = audio.current;
    if (!element) return;
    setElapsed(Number.isFinite(element.currentTime) ? Math.max(0, element.currentTime) : 0);
    if (Number.isFinite(element.duration) && element.duration > 0) setDuration(element.duration);
  };
  return <div className={`chat-voice ${own ? 'chat-voice-own' : ''}`}>
    <audio ref={audio} src={url} preload="metadata" onLoadedMetadata={() => { if (audio.current && resumeAt.current > 0) { audio.current.currentTime = Number.isFinite(audio.current.duration) ? Math.min(resumeAt.current, audio.current.duration) : resumeAt.current; resumeAt.current = 0; } updateTime(); }} onDurationChange={updateTime}
      onTimeUpdate={updateTime} onPlay={() => { attemptedRenewal.current = null; setPlaying(true); }} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setElapsed(0); }} onError={mediaError} />
    <button type="button" className="chat-voice-toggle" onClick={failed ? retry : toggle} disabled={loading}
      aria-label={failed ? tr('chat_audio_retry', 'Səsi yenidən yüklə') : playing ? tr('chat_audio_pause', 'Səsi dayandır') : tr('chat_audio_play', 'Səsi dinlə')}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : failed ? <RotateCcw size={18} /> : playing ? <Pause size={18} /> : <Play size={18} />}
    </button>
    <div className="min-w-0 flex-1">
      <input type="range" aria-label={tr('chat_audio_seek', 'Səsin vaxtı')} min={0} max={duration || 1} step={0.1}
        value={Math.min(elapsed, duration || 1)} disabled={!duration || failed}
        onChange={event => { if (audio.current && duration) { audio.current.currentTime = Number(event.target.value); updateTime(); } }} />
      <div className="chat-voice-caption"><span>{seconds(playing || elapsed ? elapsed : duration)}</span>
        {failed && <span role="status">{tr('chat_audio_failed', 'Səs açılmadı. Yenidən yoxlayın.')}</span>}</div>
    </div>
  </div>;
}
