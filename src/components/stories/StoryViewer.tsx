import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, ChevronRight } from 'lucide-react';
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
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const paused = useRef(false);
  const elapsed = useRef(0);
  const last = useRef<number | null>(null);
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  const story = stories[si];
  const sl = story?.slides[slide];

  useEffect(() => { if (story) onEvent?.('story_open', story.id); }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { elapsed.current = 0; setProgress(0); setAnswer(null); }, [si, slide]);

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
    if (si > 0) { setSi((i) => i - 1); setSlide(0); } else { elapsed.current = 0; setProgress(0); }
  }, [slide, si]);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (last.current !== null && !paused.current && document.visibilityState === 'visible') elapsed.current += t - last.current;
      last.current = t;
      const p = Math.min(1, elapsed.current / SLIDE_MS);
      setProgress(p);
      if (p >= 1) { last.current = null; next(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, [next]);

  // Android hardware back closes the viewer first.
  useEffect(() => pushBackHandler(() => { onClose(); return true; }), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  if (!story || !sl) return null;
  const th = STORY_THEMES[story.theme] ?? STORY_THEMES.coral;
  const artInk = th.light ? th.ink : '#fff';
  const style = { background: th.bg, color: th.ink, '--as-pop': th.pop, '--as-pop-ink': th.popInk, '--as-chip': th.chip, '--as-ink2': th.ink2, '--as-bg2': th.bg2 } as CSSProperties;

  // Tap left third = back, elsewhere = forward; press and hold pauses; swipe down closes.
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    paused.current = true;
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = downAt.current;
    downAt.current = null;
    if (!d) return;
    if (answer === null || sl.t !== 'quiz') paused.current = false;
    const dy = e.clientY - d.y;
    const dx = e.clientX - d.x;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
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
      body = <>{kick}{title}{sl.illus && <Art name={sl.illus} c={th.pop} a={artInk} className="as-art as-art-peek" />}</>;
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
          onClick={() => { setAnswer(i); paused.current = true; onEvent?.(i === sl.correct ? 'story_quiz_ok' : 'story_quiz_no', story.id);
            window.setTimeout(() => { paused.current = false; }, 2600); }}>
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
      <div className="as-story" style={style} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { paused.current = false; downAt.current = null; }}>
        <div className="as-bars" aria-hidden="true">{story.slides.map((_, i) =>
          <i key={i}><b style={{ width: `${i < slide ? 100 : i === slide ? progress * 100 : 0}%` }} /></i>)}</div>
        <div className="as-who">
          <span className="as-av">A</span><span className="as-name">Anacan</span><span className="as-tag">· {STORY_MODULE_LABEL[story.module]}</span>
          <button type="button" className="as-x" aria-label="Bağla" onClick={onClose}><X size={22} strokeWidth={2.4} /></button>
        </div>
        <div className="as-slide" key={`${story.id}-${slide}`}>{body}</div>
      </div>
    </div>,
    document.body,
  );
}
