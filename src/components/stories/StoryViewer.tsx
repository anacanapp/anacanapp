import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { companionSrc } from '@/components/onboarding/OnboardingCompanion';
import { renderStorySlide } from '@/lib/story-export';
import { STORY_MODULE_LABEL, STORY_THEMES, fillStory, parseStoryText, type Story, type StorySlide } from '@/lib/stories';
import { illustration } from './illustrations';
import { pushBackHandler } from '@/lib/backButton';

const SLIDE_MS = 6500;

function Rich({ text, vars }: { text?: string; vars: Record<string, string> }) {
  if (!text) return null;
  return <>{parseStoryText(fillStory(text, vars)).map((p, i) =>
    p.kind === 'mark' ? <span key={i} className="as-mark">{p.text}</span>
      : p.kind === 'hl' ? <span key={i} className="as-hl">{p.text}</span>
        : p.kind === 'bold' ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>)}</>;
}

/** Our own static SVG markup (src/components/stories/illustrations.ts); never user content. */
const Art = ({ name, c, a, className }: { name: string; c: string; a: string; className?: string }) =>
  <div className={className ?? 'as-art'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: illustration(name, c, a) }} />;

interface Props {
  stories: Story[];
  startIndex: number;
  vars: Record<string, string>;
  onClose: () => void;
  onSeen: (id: string) => void;
  onCta: (story: Story, slide: StorySlide) => void;
  onEvent?: (action: string, storyId: string) => void;
}

export default function StoryViewer({ stories, startIndex, vars, onClose, onSeen, onCta, onEvent }: Props) {
  const [si, setSi] = useState(startIndex);
  const [slide, setSlide] = useState(0);
  const [restart, setRestart] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [saving, setSaving] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  // The progress bar is a CSS animation (no per-frame React renders); its end advances the story once.
  // Pausing toggles a class on the story element, so holding, quizzes and saving never re-render the slide.
  const storyEl = useRef<HTMLDivElement | null>(null);
  const holds = useRef(new Set<string>());
  const setPaused = useCallback((reason: string, on: boolean) => {
    if (on) holds.current.add(reason); else holds.current.delete(reason);
    storyEl.current?.classList.toggle('is-paused', holds.current.size > 0);
  }, []);
  const lastNav = useRef(0);
  const navAllowed = () => { const now = performance.now(); if (now - lastNav.current < 300) return false; lastNav.current = now; return true; };
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  const story = stories[si];
  const sl = story?.slides[slide];

  useEffect(() => { if (story) onEvent?.('story_open', story.id); }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAnswer(null); setSaving('idle'); setPaused('hold', false); setPaused('quiz', false); }, [si, slide, setPaused]);
  useEffect(() => {
    const onVis = () => setPaused('hidden', document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setPaused]);

  // Lock page scroll while the viewer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const next = useCallback(() => {
    if (!story) return;
    if (slide < story.slides.length - 1) { setSlide((s) => s + 1); return; }
    onSeen(story.id);
    onEvent?.('story_complete', story.id);
    if (si < stories.length - 1) { setSi((i) => i + 1); setSlide(0); } else onClose();
  }, [story, slide, si, stories.length, onSeen, onClose, onEvent]);
  const prev = useCallback(() => {
    if (slide > 0) { setSlide((s) => s - 1); return; }
    if (si > 0) { setSi((i) => i - 1); setSlide(0); } else setRestart((r) => r + 1);
  }, [slide, si]);

  // Android hardware back closes the viewer first.
  useEffect(() => pushBackHandler(() => { onClose(); return true; }), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && navAllowed()) next();
      else if (e.key === 'ArrowLeft' && navAllowed()) prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  if (!story || !sl) return null;
  const mascot = sl.mascot ? companionSrc(sl.mascot, 'success') : undefined;

  // Saves the current slide as a 1080x1920 story image (share sheet on the phone, download on the web).
  const save = async () => {
    if (saving === 'busy') return;
    setPaused('save', true);
    setSaving('busy');
    onEvent?.('story_download', story.id);
    try {
      const blob = await renderStorySlide(story, slide, vars, { mascotSrc: mascot });
      const { shareMedia } = await import('@/lib/baby-chat-share');
      await shareMedia(blob, `anacan-story-${story.id}-${slide + 1}`, 'Anacan');
      setSaving('done');
    } catch {
      setSaving('error');
    } finally {
      setPaused('save', false);
    }
  };
  const th = STORY_THEMES[story.theme] ?? STORY_THEMES.coral;
  const artInk = th.light ? th.ink : '#fff';
  const style = { background: th.bg, color: th.ink, '--as-pop': th.pop, '--as-pop-ink': th.popInk, '--as-chip': th.chip, '--as-ink2': th.ink2, '--as-bg2': th.bg2 } as CSSProperties;

  // Tap left third = back, elsewhere = forward; press and hold pauses; swipe down closes.
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setPaused('hold', true);
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = downAt.current;
    downAt.current = null;
    if (!d) return;
    setPaused('hold', false);
    const dy = e.clientY - d.y;
    const dx = e.clientX - d.x;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
    if (!navAllowed()) return; // one step per tap, even when the device is slow
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Date.now() - d.t > 250) return; // a hold, not a tap
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev(); else next();
  };

  const src = story.source && ['list', 'alert', 'myth', 'fact'].includes(sl.t) ? <div className="as-src">Mənbə: {story.source}</div> : null;
  const small = <Art name={story.illus} c={th.pop} a={artInk} className="as-art as-art-small" />;
  const kick = sl.kicker ? <div className="as-kick"><Rich text={sl.kicker} vars={vars} /></div> : null;
  const title = sl.title ? <h2 className={`as-h as-h-${sl.size ?? (sl.t === 'cover' ? 'xl' : 'l')}`}><Rich text={sl.title} vars={vars} /></h2> : null;

  let body: JSX.Element;
  switch (sl.t) {
    case 'cover':
      body = <>{kick}{title}{mascot ? <div className="as-mascot" aria-hidden="true"><img src={mascot} alt="" draggable={false} /></div>
        : sl.illus && <Art name={sl.illus} c={th.pop} a={artInk} className="as-art as-art-peek" />}</>;
      break;
    case 'fact':
      body = <>{kick}<div className="as-num-row"><span className="as-num">{fillStory(sl.value, vars)}</span>{sl.unit && <span className="as-unit">{fillStory(sl.unit, vars)}</span>}</div>
        <p className="as-body"><Rich text={sl.body} vars={vars} /></p>{src}<Art name={sl.illus ?? story.illus} c={th.pop} a={artInk} /></>;
      break;
    case 'list':
      body = <>{kick}{title}<ul className="as-list">{(sl.items ?? []).map((x, i) => <li key={i}><em>{i + 1}</em><span><Rich text={x} vars={vars} /></span></li>)}</ul>{src}{(sl.items?.length ?? 0) <= 3 && small}</>;
      break;
    case 'myth':
      body = <><div className="as-kick">Mif və fakt</div>
        <div className="as-myth"><span className="as-lbl">MİF</span><p><Rich text={sl.myth} vars={vars} /></p></div>
        <div className="as-myth as-fact"><span className="as-lbl">FAKT</span><p><Rich text={sl.fact} vars={vars} /></p></div>{src}{small}</>;
      break;
    case 'quiz':
      body = <>{kick}{title}<div className="as-quiz">{(sl.options ?? []).map((o, i) => {
        const state = answer === null ? '' : i === sl.correct ? ' is-ok' : ' is-no';
        return <button key={i} type="button" className={`as-opt${state}`} disabled={answer !== null}
          onClick={() => { setAnswer(i); setPaused('quiz', true); onEvent?.(i === sl.correct ? 'story_quiz_ok' : 'story_quiz_no', story.id);
            window.setTimeout(() => setPaused('quiz', false), 2600); }}>
          <span><Rich text={o} vars={vars} /></span>{answer !== null && i === sl.correct && <span aria-hidden>✓</span>}
        </button>;
      })}</div>
        <p className="as-reveal" aria-live="polite">{answer !== null && <>{answer === sl.correct ? 'Düzdür! ' : 'Əslində: '}<Rich text={sl.explain} vars={vars} /></>}</p></>;
      break;
    case 'alert':
      body = <>{kick}{title}<div className="as-alert">{(sl.items ?? []).map((x, i) => <div key={i}><Rich text={x} vars={vars} /></div>)}</div>{src}
        {sl.illus && <Art name={sl.illus} c={th.pop} a={artInk} />}</>;
      break;
    case 'quote':
      body = <>{sl.badge && <span className="as-badge">✦ {sl.badge}</span>}<p className="as-quote"><Rich text={sl.quote} vars={vars} /></p>
        {sl.src && <div className="as-src">{sl.src}</div>}<Art name="blob" c={th.pop} a={artInk} /></>;
      break;
    case 'cta':
      body = <>{kick}{title}<p className="as-body"><Rich text={sl.body} vars={vars} /></p>
        {sl.cta && <button type="button" className="as-cta" onClick={() => onCta(story, sl)}>
          {sl.cta.premium && <Crown size={15} strokeWidth={2.6} aria-hidden />}{sl.cta.label}<ChevronRight size={16} strokeWidth={2.6} aria-hidden /></button>}
        {sl.illus && <Art name={sl.illus} c={th.pop} a={artInk} />}</>;
      break;
    default:
      body = <>{kick}{title}</>;
  }

  return createPortal(
    <div className={`as-viewer${th.light ? ' is-light' : ''}`} role="dialog" aria-modal="true" aria-label={fillStory(story.title, vars)}>
      <div className="as-story" ref={storyEl} style={style} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { setPaused('hold', false); downAt.current = null; }}>
        <div className="as-bars" aria-hidden="true">{story.slides.map((_, i) =>
          <i key={i}>{i < slide ? <b className="is-done" /> : i === slide
            ? <b key={`${story.id}-${slide}-${restart}`} className="as-run" style={{ animationDuration: `${SLIDE_MS}ms` }} onAnimationEnd={next} /> : <b />}</i>)}</div>
        <div className="as-who">
          <span className="as-av">A</span><span className="as-name">Anacan</span><span className="as-tag">· {STORY_MODULE_LABEL[story.module]}</span>
          <button type="button" className="as-dl" aria-label="Story-ni yüklə" onClick={save} disabled={saving === 'busy'}>
            {saving === 'busy' ? <Loader2 size={18} strokeWidth={2.4} className="as-spin" /> : <Download size={18} strokeWidth={2.4} />}
            <span>{saving === 'done' ? 'Hazırdır' : saving === 'error' ? 'Alınmadı' : 'Yüklə'}</span>
          </button>
          <button type="button" className="as-x" aria-label="Bağla" onClick={onClose}><X size={22} strokeWidth={2.4} /></button>
        </div>
        <div className="as-slide" key={`${story.id}-${slide}`}>{body}</div>
      </div>
    </div>,
    document.body,
  );
}
