import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';

/**
 * Textarea-nı yazılan mətnin uzunluğuna görə avtomatik AŞAĞI doğru böyüdür
 * (WhatsApp/iMessage/Instagram-tipli mesaj qutuları kimi) — istifadəçi uzun
 * mətn yazanda sətir tək bir sətirdə sıxılıb üfüqi görünməz qalmır, əvəzinə
 * qutu şaquli böyüyür. `maxHeightPx`-ə çatanda daxili scroll işə düşür ki,
 * çox uzun mətnlər ekranı doldurmasın.
 *
 * İstifadə:
 *   const { ref } = useAutoGrowTextarea(text);
 *   <textarea ref={ref} value={text} onChange={...} rows={1} style={{ resize: 'none' }} />
 */
export function useAutoGrowTextarea(value: string, maxHeightPx = 120) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const measured = useRef<{ node: HTMLTextAreaElement | null; value: string; maximum: number }>();

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    const border = style.boxSizing === 'border-box' ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0) : 0;
    const next = Math.min(el.scrollHeight + border, maxHeightPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  }, [maxHeightPx]);

  // A composer can mount while its value remains empty (opening comments).
  // Measure after that commit too; resize must also shrink after send/delete.
  useLayoutEffect(() => {
    if (measured.current?.node !== ref.current || measured.current?.value !== value || measured.current?.maximum !== maxHeightPx) {
      resize(); measured.current = { node: ref.current, value, maximum: maxHeightPx };
    }
  });
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    let width = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = node.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  });

  return { ref, resize };
}
