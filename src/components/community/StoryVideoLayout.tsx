import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { drawStoryScene, parseStoryScene, storyMediaBox, STORY_HEIGHT, STORY_WIDTH } from '@/lib/story-editor';

interface Props {
  src: string;
  layout: unknown;
  videoRef: RefObject<HTMLVideoElement>;
  muted: boolean;
  onDuration: (duration: number) => void;
  onEnded: () => void;
  renderText?: boolean;
  loop?: boolean;
  onError?: () => void;
}

export default function StoryVideoLayout({ src, layout, videoRef, muted, onDuration, onEnded, renderText = true, loop = false, onError }: Props) {
  const scene = useMemo(() => parseStoryScene(layout), [layout]);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!root.current) return;
    const resize = () => {
      const bounds = root.current?.getBoundingClientRect();
      if (bounds) setWidth(Math.min(bounds.width, bounds.height * 9 / 16));
    };
    const observer = new ResizeObserver(resize); observer.observe(root.current); resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (scene && ctx) drawStoryScene(ctx, null, scene, { textOnly: true });
  }, [scene, width]);
  const box = scene ? storyMediaBox(scene) : null;
  return <div ref={root} className="absolute inset-0 flex items-center justify-center" style={{ background: scene?.background || '#000' }}>
    <div className="relative overflow-hidden" style={scene ? { width, height: width * 16 / 9, background: scene.background } : { width: '100%', height: '100%' }}>
      <video ref={videoRef} src={src} autoPlay muted={muted} playsInline loop={loop}
        className={box ? 'absolute max-w-none' : 'w-full h-full object-contain'}
        style={box ? { left: `${box.x / STORY_WIDTH * 100}%`, top: `${box.y / STORY_HEIGHT * 100}%`, width: `${box.width / STORY_WIDTH * 100}%`, height: `${box.height / STORY_HEIGHT * 100}%`, transform: `translate(-50%, -50%) rotate(${box.rotation}deg)` } : undefined}
        onLoadedMetadata={event => onDuration(event.currentTarget.duration)} onEnded={onEnded} onError={onError} />
      {scene && renderText && <canvas ref={canvas} width={540} height={960} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />}
    </div>
  </div>;
}
