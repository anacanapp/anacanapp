import { useEffect, useRef } from 'react';
import { useIsRtl } from '@/lib/rtl';

interface SwipeNavigationOptions {
  onSwipeBack?: () => void;
  onSwipeForward?: () => void;
  edgeWidth?: number;
  threshold?: number;
  enabled?: boolean;
}

/**
 * iOS-style edge swipe navigation.
 * Tracks touchmove continuously and also supports fast flicks where touchmove may not fire.
 * RTL (ərəb): real iOS özü edge-swipe-back jestini RTL-də güzgüləyir (sağ kənardan sola
 * sürüşdürmə = geri) — biz də eyni konvensiyanı tətbiq edirik.
 */
export const useSwipeNavigation = ({
  onSwipeBack,
  onSwipeForward,
  edgeWidth = 50,
  threshold = 40,
  enabled = true,
}: SwipeNavigationOptions = {}) => {
  const isRtl = useIsRtl();
  const onSwipeBackRef = useRef(onSwipeBack);
  const onSwipeForwardRef = useRef(onSwipeForward);

  useEffect(() => {
    onSwipeBackRef.current = onSwipeBack;
    onSwipeForwardRef.current = onSwipeForward;
  }, [onSwipeBack, onSwipeForward]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let maxDeltaX = 0;
    let edge: 'left' | 'right' | null = null;
    let settled = false;

    const resetGesture = () => {
      edge = null;
      settled = false;
      maxDeltaX = 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      const screenW = window.innerWidth;

      if (x <= edgeWidth) {
        edge = 'left';
      } else if (x >= screenW - edgeWidth) {
        edge = 'right';
      } else {
        resetGesture();
        return;
      }

      startX = x;
      startY = e.touches[0].clientY;
      maxDeltaX = 0;
      settled = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!edge) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const deltaX = Math.abs(x - startX);
      const deltaY = Math.abs(y - startY);

      // Jest istiqaməti yalnız AYDIN üfüqi üstünlükdə qəbul edilir.
      // Əvvəlki qayda (deltaY > deltaX * 1.2 olduqda ləğv) 45°-lik diaqonal
      // scroll-u belə "üfüqi swipe" sayırdı — kənara yaxın şaquli scroll
      // naviqasiyaya çevrilib "scroll işləmir" hissi yaradırdı.
      if (!settled && (deltaX > 10 || deltaY > 10)) {
        if (deltaY >= deltaX) {
          // Şaquli üstünlük → bu, scroll-dur; jesti tamamilə burax
          resetGesture();
          return;
        }
        if (deltaX > deltaY * 1.5) {
          settled = true;
        }
        // Aralıq zona (nə aydın üfüqi, nə şaquli) — hələ qərar vermə
      }

      if (deltaX > maxDeltaX) {
        maxDeltaX = deltaX;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!edge) {
        resetGesture();
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Fast flick fallback: resolve direction at touchend even if touchmove never settled.
      if (!settled) {
        if (absDeltaX < 12 && maxDeltaX < 12) {
          resetGesture();
          return;
        }
        if (absDeltaX <= absDeltaY * 1.5) {
          resetGesture();
          return;
        }
        settled = true;
      }

      // Son yoxlama: jest "settled" olsa belə, yekunda şaquli komponent
      // üstündürsə bu scroll-dur — naviqasiya etmə.
      if (absDeltaY > absDeltaX) {
        resetGesture();
        return;
      }

      if (absDeltaX < threshold && maxDeltaX < threshold) {
        resetGesture();
        return;
      }

      const effectiveDelta = absDeltaX >= threshold ? deltaX : (edge === 'left' ? maxDeltaX : -maxDeltaX);

      // LTR: sol kənardan sağa = geri, sağ kənardan sola = irəli.
      // RTL: güzgülənir — sağ kənardan sola = geri, sol kənardan sağa = irəli (real iOS konvensiyası).
      const backEdge = isRtl ? 'right' : 'left';
      const forwardEdge = isRtl ? 'left' : 'right';
      const backDelta = isRtl ? effectiveDelta < 0 : effectiveDelta > 0;
      const forwardDelta = isRtl ? effectiveDelta > 0 : effectiveDelta < 0;

      if (edge === backEdge && backDelta) {
        onSwipeBackRef.current?.();
      } else if (edge === forwardEdge && forwardDelta) {
        onSwipeForwardRef.current?.();
      }

      resetGesture();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', resetGesture);
    };
  }, [edgeWidth, threshold, enabled, isRtl]);
};

export default useSwipeNavigation;
