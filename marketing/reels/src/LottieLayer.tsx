import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { DotLottie } from '@lottiefiles/dotlottie-web';

DotLottie.setWasmUrl(staticFile('dotlottie-player.wasm'));

/**
 * dotLottie (ThorVG/WASM) on a canvas, frame-locked to Remotion: no autoplay, every Remotion frame sets the Lottie
 * frame and holds the render until dotLottie has painted it.
 */
export function LottieLayer({ data, size, fromFrame = 0, speed = 1, loop = false, style }: {
  data: object; size: number; fromFrame?: number; speed?: number; loop?: boolean; style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [loadHandle] = useState(() => delayRender('dotlottie load'));
  const frame = useCurrentFrame();
  const total = (data as { op: number }).op;

  useEffect(() => {
    if (!canvasRef.current) return;
    const p = new DotLottie({ canvas: canvasRef.current, data: JSON.stringify(data), autoplay: false, loop: false,
      renderConfig: { devicePixelRatio: 1, autoResize: false } });
    const ready = () => { setPlayer(p); continueRender(loadHandle); };
    p.addEventListener('load', ready);
    p.addEventListener('loadError', () => continueRender(loadHandle));
    return () => p.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raw = (frame - fromFrame) * speed;
  const local = raw < 0 ? 0 : loop ? raw % (total - 1) : Math.min(total - 1, raw);
  useEffect(() => {
    if (!player) return;
    const handle = delayRender(`dotlottie frame ${local}`);
    let done = false;
    const finish = () => { if (!done) { done = true; continueRender(handle); } };
    player.addEventListener('render', finish);
    player.setFrame(local);
    const t = setTimeout(finish, 120);
    return () => { clearTimeout(t); player.removeEventListener('render', finish); finish(); };
  }, [player, local]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size, ...style }} />;
}
