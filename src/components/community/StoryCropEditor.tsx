import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Check, Expand, Image as ImageIcon, Loader2, RotateCw, Trash2, Type, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';
import StoryVideoLayout from './StoryVideoLayout';
import {
  applyStoryGesture, drawStoryScene, exportStoryImage, fitStoryMedia, hitStoryText, initialStoryScene,
  STORY_HEIGHT, STORY_MAX_ZOOM, STORY_MIN_ZOOM, STORY_WIDTH,
  type StoryPoint, type StoryScene, type StoryTextBox, type StoryTextLayer,
} from '@/lib/story-editor';

export interface StoryEditorResult { image: Blob | null; scene: StoryScene; }
interface StoryCropEditorProps {
  imageUrl: string;
  mediaType?: 'image' | 'video';
  onConfirm: (result: StoryEditorResult) => Promise<void>;
  onCancel: () => void;
}
const COLORS = ['#ffffff', '#111827', '#ff658b', '#ffd166', '#6ee7b7', '#60a5fa', '#c4b5fd'];
const BACKGROUNDS = ['#18181b', '#000000', '#ffffff', '#f5d8ce', '#b9d6e5', '#cbbde2'];
const iconButton = 'story-editor-icon';

export default function StoryCropEditor({ imageUrl, mediaType = 'image', onConfirm, onCancel }: StoryCropEditorProps) {
  const { toast } = useToast();
  const [scene, setScene] = useState<StoryScene | null>(null);
  const sceneRef = useRef<StoryScene | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [stageWidth, setStageWidth] = useState(270);
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height || window.innerHeight, top: window.visualViewport?.offsetTop || 0 }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const boxesRef = useRef<StoryTextBox[]>([]);
  const dirtyRef = useRef(true);
  const pointers = useRef(new Map<number, StoryPoint>());
  const gesture = useRef<{ scene: StoryScene; points: StoryPoint[]; target: string | null } | null>(null);
  const selected = scene?.texts.find(text => text.id === selectedId);

  const update = useCallback((change: (scene: StoryScene) => StoryScene) => {
    if (!sceneRef.current || savingRef.current) return;
    sceneRef.current = change(sceneRef.current);
    setScene(sceneRef.current); dirtyRef.current = true;
  }, []);
  const selectText = (id: string | null) => { if (savingRef.current) return; selectedRef.current = id; setSelectedId(id); dirtyRef.current = true; };
  const updateText = (change: Partial<StoryTextLayer>) => update(current => ({ ...current, texts: current.texts.map(text => text.id === selectedRef.current ? { ...text, ...change } : text) }));

  useEffect(() => {
    const sync = () => setViewport({ height: window.visualViewport?.height || window.innerHeight, top: window.visualViewport?.offsetTop || 0 });
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => { window.visualViewport?.removeEventListener('resize', sync); window.visualViewport?.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); };
  }, []);
  useEffect(() => {
    if (!slotRef.current) return;
    const resize = () => {
      const box = slotRef.current?.getBoundingClientRect();
      if (box) setStageWidth(Math.max(1, Math.min(box.width - 24, (box.height - 8) * 9 / 16)));
      dirtyRef.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(slotRef.current); resize();
    return () => observer.disconnect();
  }, [!!scene, selectedId, viewport.height]);

  useEffect(() => {
    let disposed = false;
    mountedRef.current = true;
    const media = mediaType === 'image' ? new Image() : null;
    mediaRef.current = media;
    setLoadError(false);
    const ready = () => {
      if (disposed) return;
      const width = media?.naturalWidth || 0;
      const height = media?.naturalHeight || 0;
      if (!width || !height) { setLoadError(true); return; }
      const initial = initialStoryScene(width, height);
      sceneRef.current = initial; setScene(initial); dirtyRef.current = true;
    };
    if (media) {
      media.onload = ready;
      media.onerror = () => { if (!disposed) setLoadError(true); };
      media.src = imageUrl;
    }
    let raf = 0;
    const paint = (now: number) => {
      const current = sceneRef.current, canvas = canvasRef.current;
      if (current && canvas && dirtyRef.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          boxesRef.current = drawStoryScene(ctx, media, current, { textOnly: mediaType === 'video', selectedId: selectedRef.current, placeholder: tr('story_editor_text_placeholder', 'Mətn yaz...') });
          dirtyRef.current = false;
        }
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      disposed = true; mountedRef.current = false; cancelAnimationFrame(raf);
      if (media) { media.onload = null; media.onerror = null; media.removeAttribute('src'); }
      videoRef.current?.pause();
      mediaRef.current = null; sceneRef.current = null;
    };
  }, [imageUrl, mediaType]);

  const point = (event: { clientX: number; clientY: number }): StoryPoint => {
    const box = stageRef.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * STORY_WIDTH, y: (event.clientY - box.top) / box.height * STORY_HEIGHT };
  };
  const restartGesture = (target = selectedRef.current) => {
    gesture.current = sceneRef.current && pointers.current.size ? { scene: sceneRef.current, points: [...pointers.current.values()], target } : null;
  };
  const addText = () => {
    if (!scene || scene.texts.length >= 8 || saving) return;
    const id = crypto.randomUUID();
    flushSync(() => {
      update(current => ({ ...current, texts: [...current.texts, { id, text: '', x: 0.5, y: 0.5, size: 60, rotation: 0, color: '#ffffff', font: 'sans', align: 'center', background: 'none' }] }));
      selectText(id);
    });
    textInputRef.current?.focus({ preventScroll: true });
  };
  const confirm = async () => {
    if (!sceneRef.current || (mediaType === 'image' && !mediaRef.current) || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const current = { ...sceneRef.current, texts: sceneRef.current.texts.filter(text => text.text.trim()) };
      const image = mediaType === 'image' ? await exportStoryImage(mediaRef.current!, current) : null;
      if (!mountedRef.current) return;
      await onConfirm({ image, scene: current });
    } catch {
      toast({ title: tr('story_editor_save_error', 'Story paylaşıla bilmədi. Düzəlişləriniz saxlanılıb, yenidən cəhd edin.'), variant: 'destructive' });
    } finally { savingRef.current = false; if (mountedRef.current) setSaving(false); }
  };
  const cancel = () => onCancel();

  return <Dialog open onOpenChange={open => { if (!open) cancel(); }}>
    <DialogContent className="story-editor p-0 border-0 rounded-none max-w-none gap-0 [&>button:last-child]:hidden"
      style={{ left: 0, top: viewport.top, transform: 'none', width: '100vw', height: viewport.height, maxWidth: 'none', zIndex: 200, backgroundColor: '#09090b', color: '#ffffff' }}
      onOpenAutoFocus={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
      <DialogTitle className="sr-only">{tr('story_editor_title', 'Story redaktoru')}</DialogTitle>
      <DialogDescription className="sr-only">{tr('story_editor_help', 'Şəkli sürüşdürün, iki barmaqla yaxınlaşdırın və mətn əlavə edin.')}</DialogDescription>
      <div className="story-editor-layout">
        <header className="story-editor-toolbar">
          <button className={iconButton} onClick={cancel} aria-label={tr('common_close', 'Bağla')}><X size={23} /></button>
          <button className={iconButton} onClick={addText} disabled={!scene || saving || scene.texts.length >= 8} aria-label={tr('story_editor_add_text', 'Mətn əlavə et')}><Type size={24} /></button>
          <span className="flex-1" />
          <button className="story-editor-share" disabled={!scene || saving || loadError} onClick={() => void confirm()}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {saving ? tr('story_editor_saving', 'Paylaşılır...') : tr('story_editor_share', 'Paylaş')}
          </button>
        </header>
        <div ref={slotRef} className="story-editor-slot">
          {loadError ? <p role="alert" className="text-white text-center p-6">{tr('story_editor_load_error', 'Bu fayl açıla bilmədi. Başqa şəkil və ya video seçin.')}</p> : <div ref={stageRef} className="story-editor-stage" data-story-stage
            style={{ width: stageWidth, height: stageWidth * 16 / 9 }} tabIndex={0}
            onPointerDown={event => {
              if (saving || !sceneRef.current || pointers.current.size >= 2) return;
              if (document.activeElement === textInputRef.current) { textInputRef.current?.blur(); return; }
              event.preventDefault();
              const p = point(event);
              if (!pointers.current.size) selectText(hitStoryText(boxesRef.current, p));
              pointers.current.set(event.pointerId, p);
              event.currentTarget.setPointerCapture(event.pointerId); restartGesture();
            }}
            onPointerMove={event => {
              if (!pointers.current.has(event.pointerId) || !gesture.current) return;
              pointers.current.set(event.pointerId, point(event));
              const start = gesture.current;
              update(() => applyStoryGesture(start.scene, start.target, start.points, [...pointers.current.values()]));
            }}
            onPointerUp={event => { pointers.current.delete(event.pointerId); restartGesture(); }}
            onPointerCancel={event => { pointers.current.delete(event.pointerId); restartGesture(); }}
            onDoubleClick={event => { const id = hitStoryText(boxesRef.current, point(event)); if (id) { selectText(id); textInputRef.current?.focus(); } }}
            onWheel={event => {
              if (saving || !sceneRef.current || selectedRef.current) return;
              const p = point(event), factor = event.deltaY < 0 ? 1.08 : 0.92;
              update(current => applyStoryGesture(current, null, [{ x: p.x - 50, y: p.y }, { x: p.x + 50, y: p.y }], [{ x: p.x - 50 * factor, y: p.y }, { x: p.x + 50 * factor, y: p.y }]));
            }}
            onKeyDown={event => {
              const delta = event.shiftKey ? 40 : 12;
              const movement: Record<string, StoryPoint> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } };
              if (movement[event.key]) { event.preventDefault(); update(current => applyStoryGesture(current, selectedRef.current, [{ x: 0, y: 0 }], [movement[event.key]])); }
            }}>
            {mediaType === 'video' && <StoryVideoLayout src={imageUrl} layout={scene} videoRef={videoRef} muted renderText={false} loop onEnded={() => {}} onError={() => setLoadError(true)}
              onDuration={() => {
                const media = videoRef.current;
                if (!sceneRef.current && media?.videoWidth && media.videoHeight) {
                  const initial = initialStoryScene(media.videoWidth, media.videoHeight);
                  sceneRef.current = initial; setScene(initial); dirtyRef.current = true;
                }
              }} />}
            <canvas ref={canvasRef} width={540} height={960} className="relative z-10 h-full w-full" role="img" aria-label={tr('story_editor_preview', 'Story önizləməsi')} />
            {!scene && <Loader2 className="absolute inset-0 m-auto animate-spin text-white" size={28} />}
          </div>}
        </div>
        <fieldset key={selectedId || 'media'} disabled={saving} className="story-editor-controls">
          {selected ? <>
            <div className="flex items-center gap-2">
              <textarea ref={textInputRef} value={selected.text} disabled={saving} maxLength={280} rows={2} dir="auto"
                aria-label={tr('story_editor_text', 'Story mətni')} placeholder={tr('story_editor_text_placeholder', 'Mətn yaz...')}
                onChange={event => updateText({ text: event.target.value })} className="story-editor-text-input" />
              <button className={iconButton} disabled={saving} aria-label={tr('common_hazir', 'Hazır')} onClick={() => { textInputRef.current?.blur(); selectText(null); }}><Check size={22} /></button>
            </div>
            <div className="story-editor-options">
              {(['sans', 'serif', 'mono'] as const).map(font => <button key={font} aria-pressed={selected.font === font} onClick={() => updateText({ font })} className="story-editor-choice">{font === 'sans' ? 'Aa' : font === 'serif' ? 'Serif' : 'Mono'}</button>)}
              <button className={iconButton} aria-label={tr('story_editor_align', 'Mətn düzülüşü')} onClick={() => updateText({ align: selected.align === 'left' ? 'center' : selected.align === 'center' ? 'right' : 'left' })}>{selected.align === 'left' ? <AlignLeft size={19} /> : selected.align === 'center' ? <AlignCenter size={19} /> : <AlignRight size={19} />}</button>
              <button className="story-editor-choice" aria-label={tr('story_editor_text_background', 'Mətn fonu')} onClick={() => {
                const background = selected.background === 'none' ? 'dark' : selected.background === 'dark' ? 'light' : 'none';
                updateText({ background, color: background === 'light' ? '#111827' : '#ffffff' });
              }}>A▣</button>
              <button className={iconButton} aria-label={tr('community_delete_text', 'Mətni sil')} onClick={() => { update(current => ({ ...current, texts: current.texts.filter(text => text.id !== selectedId) })); selectText(null); }}><Trash2 size={18} /></button>
            </div>
            <div className="story-editor-swatches">{COLORS.map(color => <button key={color} onClick={() => updateText({ color })} aria-label={`${tr('story_editor_color', 'Rəng')} ${color}`} aria-pressed={selected.color === color} style={{ backgroundColor: color }} />)}</div>
            <input type="range" min={28} max={120} step={1} value={selected.size} aria-label={tr('story_editor_text_size', 'Mətn ölçüsü')} onChange={event => updateText({ size: +event.target.value })} className="w-full accent-white" />
          </> : <>
            <div className="flex items-center gap-3">
              <ZoomOut size={18} /><input type="range" min={STORY_MIN_ZOOM} max={STORY_MAX_ZOOM} step={0.01} value={scene?.media.zoom || 1}
                aria-label={tr('story_editor_zoom', 'Yaxınlaşdırma')} disabled={!scene || saving} onChange={event => update(current => ({ ...current, media: { ...current.media, zoom: +event.target.value } }))} className="w-full accent-white" /><ZoomIn size={18} />
            </div>
            <div className="story-editor-options justify-between">
              <button className="story-editor-choice" onClick={() => update(current => fitStoryMedia(current))}><ImageIcon size={16} />{tr('story_editor_fit', 'Tam şəkil')}</button>
              <button className="story-editor-choice" onClick={() => update(current => fitStoryMedia(current, 'cover'))}><Expand size={16} />{tr('story_editor_fill', 'Doldur')}</button>
              <button className={iconButton} aria-label={tr('story_editor_rotate', 'Döndər')} onClick={() => update(current => fitStoryMedia({ ...current, media: { ...current.media, rotation: (current.media.rotation + 90) % 360 } }))}><RotateCw size={20} /></button>
            </div>
            <div className="story-editor-swatches">{BACKGROUNDS.map(background => <button key={background} onClick={() => update(current => ({ ...current, background }))} aria-label={`${tr('story_editor_background', 'Story fonu')} ${background}`} aria-pressed={scene?.background === background} style={{ backgroundColor: background }} />)}</div>
            <p className="text-[11px] text-white/70 text-center">{tr('story_editor_gesture_hint', 'Sürüşdürün · İki barmaqla ölçünü və bucağı dəyişin')}</p>
          </>}
        </fieldset>
      </div>
    </DialogContent>
  </Dialog>;
}
