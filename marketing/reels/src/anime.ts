import { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { createTimeline, type Timeline } from 'animejs';

/**
 * anime.js drives the motion, Remotion owns the clock: the timeline never autoplays, it is seeked to the current
 * frame's time on every render. That keeps every frame deterministic (Remotion renders frames in parallel tabs).
 * `build` adds tweens on plain numeric objects; the returned snapshot holds their values at this frame.
 */
export function useAnime<T extends Record<string, Record<string, number>>>(initial: T, build: (tl: Timeline, v: T) => void): T {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = useMemo(() => {
    const values = JSON.parse(JSON.stringify(initial)) as T;
    const tl = createTimeline({ autoplay: false });
    build(tl, values);
    return { tl, values };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  state.tl.seek((frame / fps) * 1000);
  return JSON.parse(JSON.stringify(state.values)) as T;
}

/** Milliseconds for a frame count at 30 fps (timelines are authored in frames for readability). */
export const f = (frames: number) => (frames / 30) * 1000;
