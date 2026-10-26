import { useState, useRef, useEffect, useCallback, type MutableRefObject, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { useIsRtl, rtlX } from '@/lib/rtl';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface LazyVideoProps {
  src: string;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onToggle: () => void;
  onPlayingChange: (playing: boolean) => void;
  children?: ReactNode;
}

/**
 * PERF/yaddaş: <video> yalnız element viewport-a ~200px yaxın olanda mount
 * olunur (preload="metadata" — yalnız ekrana yaxın olanlar, ilk kadr görünsün); uzaqlaşanda/unmount-da dekoder açıq şəkildə
 * buraxılır (pause + src sil + load) — əks halda feed-dəki hər video post
 * WebView-da ayrıca dekoder/bufer saxlayırdı.
 */
const LazyVideo = ({ src, videoRef, onToggle, onPlayingChange, children }: LazyVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setNear(entry.isIntersecting);
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) onPlayingChange(false);
  }, [near, onPlayingChange]);

  const setVideo = useCallback((element: HTMLVideoElement | null) => {
    const previous = elementRef.current;
    if (!element && previous) {
      // Dekoder/şəbəkə buferini dərhal burax.
      try {
        previous.pause();
        previous.removeAttribute('src');
        previous.load();
      } catch { /* jsdom / köhnə WebView */ }
      if (videoRef.current === previous) videoRef.current = null;
    }
    elementRef.current = element;
    if (element) videoRef.current = element;
  }, [videoRef]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {near && (
        <video
          ref={setVideo}
          src={src}
          preload="metadata"
          playsInline
          className="w-full h-full object-cover"
          onClick={onToggle}
          onPlay={() => onPlayingChange(true)}
          onPause={() => onPlayingChange(false)}
        />
      )}
      {children}
    </div>
  );
};

interface MediaCarouselProps {
  media: MediaItem[];
  onOpenFullscreen?: (index: number) => void;
}

const MediaCarousel = ({ media, onOpenFullscreen }: MediaCarouselProps) => {
  const isRtl = useIsRtl();
  const [currentIndex, setCurrentIndex] = useState(0);
  // Naviqasiya istiqaməti (1=irəli, -1=geri) — slayd animasiyasının hansı tərəfdən
  // girib-çıxacağını təyin edir (RTL-də əlavə olaraq güzgülənir, aşağıda bax).
  const [direction, setDirection] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);


  if (media.length === 0) return null;

  const goToPrevious = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const currentMedia = media[currentIndex];

  // Standard fixed height for all media - covers without distortion
  const mediaContainerClass = "h-[360px]";

  // Single media item
  if (media.length === 1) {
    return (
      <>
        <div className={`relative ${mediaContainerClass} bg-muted/30 rounded-2xl overflow-hidden`}>
          {currentMedia.type === 'video' ? (
            <LazyVideo src={currentMedia.url} videoRef={videoRef} onToggle={togglePlay} onPlayingChange={setIsPlaying}>
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
              >
                {!isPlaying && (
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-foreground ms-1" fill="currentColor" />
                  </div>
                )}
              </button>
            </LazyVideo>
          ) : (
            <img
              src={currentMedia.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onOpenFullscreen?.(0)}
            />
          )}
        </div>

      </>
    );
  }

  // Multiple media items - Carousel
  return (
    <>
      <div className={`relative ${mediaContainerClass} bg-muted/30 rounded-2xl overflow-hidden`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: rtlX(direction * 50, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(direction * -50, isRtl) }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {currentMedia.type === 'video' ? (
              <LazyVideo src={currentMedia.url} videoRef={videoRef} onToggle={togglePlay} onPlayingChange={setIsPlaying}>
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-8 h-8 text-foreground ms-1" fill="currentColor" />
                    </div>
                  </button>
                )}
              </LazyVideo>
            ) : (
              <img
                src={currentMedia.url}
                alt=""
                loading="lazy"
                decoding="async"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onOpenFullscreen?.(currentIndex)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          className="absolute start-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="rtl:rotate-180 w-5 h-5" />
        </button>
        <button
          onClick={goToNext}
          className="absolute end-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <ChevronRight className="rtl:rotate-180 w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-4' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {/* Counter */}
        <div className="absolute top-2 end-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
          {currentIndex + 1} / {media.length}
        </div>

      </div>

    </>
  );
};

export default MediaCarousel;
