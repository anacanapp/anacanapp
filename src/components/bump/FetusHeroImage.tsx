import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { isConstrainedNetwork, isImageReady, preloadImage } from '@/lib/illustration-image';

interface FetusHeroImageProps {
  /** Admin-managed remote image (already resolved), or null when the month has none. */
  remoteSrc: string | null;
  /** Bundled SVG for the same month; always available offline. */
  fallbackSrc: string;
  /** Neighbouring months' remote images, loaded quietly after the current one. */
  preloadSrcs?: Array<string | null>;
  alt: string;
  style?: CSSProperties;
}

// The bundled illustration renders immediately, so the hero is never empty on
// slow networks, offline or when a remote image is missing. The remote image
// is loaded in the background (with retries) and swapped in only once it is
// fully decoded; a remote image that has loaded once is shown right away.
const FetusHeroImage = ({ remoteSrc, fallbackSrc, preloadSrcs = [], alt, style }: FetusHeroImageProps) => {
  const [readySrc, setReadySrc] = useState<string | null>(() => (isImageReady(remoteSrc) ? remoteSrc : null));
  const shownSrc = remoteSrc && readySrc === remoteSrc ? remoteSrc : fallbackSrc;
  const preloadKey = preloadSrcs.filter(Boolean).join('\n');

  useEffect(() => {
    let active = true;
    if (!remoteSrc) return;
    if (isImageReady(remoteSrc)) {
      setReadySrc(remoteSrc);
    } else {
      void preloadImage(remoteSrc, 'high').then((ok) => {
        if (active && ok) setReadySrc(remoteSrc);
      });
    }
    return () => { active = false; };
  }, [remoteSrc]);

  useEffect(() => {
    if (!preloadKey || isConstrainedNetwork()) return;
    let cancelled = false;
    const neighbours = preloadKey.split('\n');
    // Neighbours wait for the current image so they never compete with it.
    void preloadImage(remoteSrc, 'high').finally(() => {
      if (cancelled) return;
      const run = () => { if (!cancelled) neighbours.forEach((src) => { void preloadImage(src, 'low'); }); };
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (idle) idle(run); else setTimeout(run, 1500);
    });
    return () => { cancelled = true; };
  }, [preloadKey, remoteSrc]);

  return (
    <motion.img
      src={shownSrc}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => {
        // A cached remote image that later fails (e.g. evicted while offline) drops back to the bundled one.
        if (shownSrc !== fallbackSrc) setReadySrc(null);
      }}
      style={style}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        scale: { delay: 0.2, type: 'spring' },
        opacity: { delay: 0.2 },
      }} />
  );
};

export default FetusHeroImage;
