import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Download, Image as ImageIcon, Pause, Play, RotateCcw, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { useRecap, RECAP_YEAR } from '@/hooks/useRecap';
import { useToolConfigs } from '@/hooks/useDynamicTools';
import { useBabyMilestonesDB, useSymptoms } from '@/hooks/useDynamicConfig';
import { logEvent } from '@/lib/analytics';
import { buildRecapModel, type RecapLabels } from '@/lib/recap/model';
import { renderRecapFrame, sceneIndexAt, RECAP_H, RECAP_W, type RecapAssets } from '@/lib/recap/render';
import { fillRecap } from '@/lib/recap/copy';
import { loadRecapAssets, recordingSupported, recordRecapVideo, renderRecapImage, shareRecap, RECAP_MUSIC_URL } from '@/lib/recap/export';
import { rt } from '@/lib/recap/recap-i18n';

type Busy = null | { kind: 'video'; progress: number } | { kind: 'image' };

/**
 * Anacan Recap player: full screen, story style. Tap the middle to pause, the sides (or swipe) to move
 * between scenes; music plays along. "Download / Share" records the very frames shown here.
 */
export default function RecapScreen({ onBack }: { onBack: () => void }) {
  const language = useUserStore((s) => s.language);
  const { user } = useAuth();
  const { recap, result, isLoading } = useRecap(RECAP_YEAR);
  const { data: tools = [] } = useToolConfigs();
  const { data: milestones = [] } = useBabyMilestonesDB();
  const { data: symptoms = [] } = useSymptoms();

  const labels = useMemo<RecapLabels>(() => {
    const toolMap = new Map(tools.map((x) => [x.tool_id, ((x as { display_name?: string | null }).display_name || x.name || '').trim()]));
    const msMap = new Map(milestones.map((x) => [x.milestone_key, (x.label || '').trim()]));
    const symMap = new Map(symptoms.map((x) => [x.symptom_key, (x.label || '').trim()]));
    return { tool: (id) => toolMap.get(id) || null, milestone: (id) => msMap.get(id) || null, symptom: (id) => symMap.get(id) || null };
  }, [tools, milestones, symptoms]);

  const model = useMemo(() => (recap ? buildRecapModel(recap, language, rt, { labels, seed: user?.id }) : null), [recap, language, labels, user?.id]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assetsRef = useRef<RecapAssets | null>(null);
  const clock = useRef({ base: 0, wall: 0, playing: false });
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loggedComplete = useRef(false);

  const now = () => {
    const c = clock.current;
    return c.playing ? c.base + (performance.now() - c.wall) / 1000 : c.base;
  };

  const seek = useCallback((t: number, play = clock.current.playing) => {
    if (!model) return;
    const clamped = Math.max(0, Math.min(model.duration, t));
    clock.current = { base: clamped, wall: performance.now(), playing: play && clamped < model.duration };
    setPlaying(clock.current.playing);
    setEnded(clamped >= model.duration);
    const audio = audioRef.current;
    if (audio) {
      try { audio.currentTime = clamped; } catch { /* not loaded yet */ }
      if (clock.current.playing && !muted) void audio.play().catch(() => setMuted(true));
      else audio.pause();
    }
  }, [model, muted]);

  // Assets (fonts + logo) once, then start.
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    void loadRecapAssets(model).then((assets) => {
      if (cancelled) return;
      assetsRef.current = assets;
      setReady(true);
      void logEvent('recap_opened', { year: model.year, stage: model.stage ?? 'none', scenes: model.scenes.length });
      seek(0, true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Render loop.
  useEffect(() => {
    if (!ready || !model) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      const t = now();
      if (t >= model.duration && clock.current.playing) {
        clock.current = { base: model.duration, wall: performance.now(), playing: false };
        setPlaying(false);
        setEnded(true);
        if (!loggedComplete.current) { loggedComplete.current = true; void logEvent('recap_completed', { year: model.year, stage: model.stage ?? 'none' }); }
      }
      renderRecapFrame(ctx, Math.min(t, model.duration), model, assetsRef.current ?? {});
      // Keep the music on the picture's clock.
      const audio = audioRef.current;
      if (audio && clock.current.playing && !audio.paused && Math.abs(audio.currentTime - t) > 0.3) { try { audio.currentTime = t; } catch { /* ignore */ } }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, model]);

  useEffect(() => () => { audioRef.current?.pause(); abortRef.current?.abort(); }, []);

  const togglePlay = () => {
    if (!model) return;
    if (ended) { loggedComplete.current = loggedComplete.current || false; seek(0, true); return; }
    seek(now(), !clock.current.playing);
  };
  const step = (dir: 1 | -1) => {
    if (!model) return;
    const t = now();
    const i = sceneIndexAt(model, t);
    const s = model.scenes[i];
    if (dir > 0) seek(s.end + 0.001, true);
    else seek(t - s.start > 1.2 || i === 0 ? s.start : model.scenes[i - 1].start, true);
  };

  // Tap zones and horizontal swipe, like stories.
  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => { down.current = { x: e.clientX, y: e.clientY, at: performance.now() }; };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || busy) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { step(dx < 0 ? 1 : -1); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    if (fx < 0.28) step(-1);
    else if (fx > 0.72) step(1);
    else togglePlay();
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    const next = !muted;
    setMuted(next);
    if (!audio) return;
    if (next) audio.pause();
    else if (clock.current.playing) { try { audio.currentTime = now(); } catch { /* ignore */ } void audio.play().catch(() => setMuted(true)); }
  };

  const canRecord = recordingSupported();
  const brandLabel = ['Anacan Recap', model?.year ?? RECAP_YEAR].join(' ');
  const baseName = `anacan-recap-${model?.year ?? RECAP_YEAR}`;
  const shareText = fillRecap(rt('recap_share_text'), { year: model?.year ?? RECAP_YEAR });

  const exportVideo = async (mode: 'share' | 'download') => {
    if (!model || !assetsRef.current || busy) return;
    if (!recordingSupported()) { setNotice(rt('recap_error')); return; }
    seek(now(), false);
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy({ kind: 'video', progress: 0 });
    setNotice(null);
    try {
      const blob = await recordRecapVideo(model, assetsRef.current, { musicUrl: RECAP_MUSIC_URL, signal: abort.signal, onProgress: (p) => setBusy({ kind: 'video', progress: p }) });
      void logEvent('recap_exported', { year: model.year, format: blob.type.includes('mp4') ? 'mp4' : 'webm', mode });
      setBusy(null);
      const outcome = await shareRecap(blob, baseName, shareText, mode);
      if (outcome !== 'cancelled') { setNotice(rt('recap_saved')); void logEvent('recap_shared', { year: model.year, kind: 'video', outcome }); }
    } catch (error) {
      setBusy(null);
      const code = (error as { code?: string })?.code;
      if (code === 'INTERRUPTED') setNotice(rt('recap_rendering_hint'));
      else if (code !== 'ABORTED') setNotice(rt('recap_error'));
    } finally { abortRef.current = null; }
  };

  const exportImage = async () => {
    if (!model || !assetsRef.current || busy) return;
    setBusy({ kind: 'image' });
    try {
      const blob = await renderRecapImage(model, assetsRef.current);
      setBusy(null);
      const outcome = await shareRecap(blob, `${baseName}-card`, shareText, 'share');
      if (outcome !== 'cancelled') void logEvent('recap_shared', { year: model.year, kind: 'image', outcome });
    } catch { setBusy(null); setNotice(rt('recap_error')); }
  };

  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, padding: '0 16px', borderRadius: 999, border: 0, fontWeight: 800, fontSize: 14, cursor: 'pointer' } as const;
  const iconBtn = { width: 40, height: 40, borderRadius: 999, border: 0, background: 'rgba(0,0,0,0.35)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;

  return (
    <div data-testid="recap-screen" style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#12040C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <audio ref={audioRef} src={RECAP_MUSIC_URL} preload="auto" muted={muted} playsInline />
      <div style={{ position: 'relative', flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {model ? (
          <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ position: 'relative', height: '100%', maxHeight: 'calc(100vh - 120px)', aspectRatio: '9 / 16', maxWidth: '100%', touchAction: 'pan-y', userSelect: 'none' }}>
            <canvas ref={canvasRef} width={RECAP_W} height={RECAP_H} aria-label={brandLabel} style={{ width: '100%', height: '100%', borderRadius: 18, display: 'block', background: '#12040C' }} />
            {!playing && ready && !busy && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ ...iconBtn, width: 72, height: 72, background: 'rgba(0,0,0,0.4)' }}>{ended ? <RotateCcw size={30} /> : <Play size={30} />}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#fff', fontWeight: 800, textAlign: 'center', padding: 24 }}>
            {isLoading ? rt('recap_loading') : result && !result.available ? rt('recap_unavailable') : rt('recap_loading')}
          </div>
        )}
        <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10, display: 'flex', gap: 8 }}>
          {model && <button type="button" style={iconBtn} onClick={toggleMute} aria-label={muted ? rt('recap_unmute') : rt('recap_mute')}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
          {model && <button type="button" style={iconBtn} onClick={togglePlay} aria-label={playing ? rt('recap_pause') : rt('recap_replay')}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>}
          <button type="button" style={iconBtn} onClick={onBack} aria-label={rt('recap_close')}><X size={20} /></button>
        </div>
        {recap?.preview && (
          <span style={{ position: 'absolute', top: 14, insetInlineStart: 12, fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: '4px 10px' }}>{rt('recap_preview_badge')}</span>
        )}
      </div>
      {model && (
        <div style={{ width: '100%', maxWidth: 520, padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notice && <div role="status" style={{ color: '#fff', fontSize: 13, textAlign: 'center', opacity: 0.9 }}>{notice}</div>}
          {canRecord && <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...btn, flex: 1, background: '#FF5A5F', color: '#fff' }} disabled={!ready || !!busy} onClick={() => void exportVideo('download')}>
              <Download size={18} />{rt('recap_download')}
            </button>
            <button type="button" style={{ ...btn, flex: 1, background: '#fff', color: '#E63E4B' }} disabled={!ready || !!busy} onClick={() => void exportVideo('share')}>
              <Share2 size={18} />{rt('recap_share')}
            </button>
          </div>}
          {/* Phones that cannot record video (old iOS without MediaRecorder) still share the summary card. */}
          <button type="button" style={canRecord ? { ...btn, minHeight: 38, background: 'transparent', color: 'rgba(255,255,255,0.85)', fontSize: 13 } : { ...btn, background: '#FF5A5F', color: '#fff' }} disabled={!ready || !!busy} onClick={() => void exportImage()}>
            <ImageIcon size={16} />{rt('recap_share_image')}
          </button>
        </div>
      )}
      {busy?.kind === 'video' && (
        <div role="dialog" aria-modal="true" style={{ position: 'absolute', inset: 0, background: 'rgba(18,4,12,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff', padding: 24, textAlign: 'center' }}>
          <b style={{ fontSize: 18 }}>{fillRecap(rt('recap_rendering'), { pct: `${Math.round(busy.progress * 100)}%` })}</b>
          <div style={{ width: '70%', maxWidth: 320, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(busy.progress * 100)}%`, height: '100%', background: '#FF5A5F', transition: 'width .2s linear' }} />
          </div>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{rt('recap_rendering_hint')}</span>
          <button type="button" style={{ ...btn, background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => abortRef.current?.abort()}>{rt('recap_cancel')}</button>
        </div>
      )}
    </div>
  );
}
