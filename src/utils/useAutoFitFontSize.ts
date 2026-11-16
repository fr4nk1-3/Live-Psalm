import { useLayoutEffect, useState, RefObject } from 'react';

/**
 * Dynamically scales down font size (starting from a generous target) so that
 * `textRef` always fits inside `containerRef` without vertical or horizontal clipping.
 */
export function useAutoFitFontSize(
  containerRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  deps: unknown[],
  options: { minPx?: number; maxPx?: number; startVw?: number } = {}
): number | null {
  const { minPx = 16, maxPx = 160, startVw = 6.5 } = options;
  const [fittedPx, setFittedPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const fit = () => {
      const availW = container.clientWidth;
      const availH = container.clientHeight;
      if (availW <= 0 || availH <= 0) return;

      const startPx = Math.min(maxPx, Math.max(minPx, Math.round((window.innerWidth * startVw) / 100)));

      // Binary search for the largest font size (in px) that fits inside availW x availH
      let lo = minPx;
      let hi = startPx;
      let best = minPx;

      const prevSize = textEl.style.fontSize;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        textEl.style.fontSize = `${mid}px`;
        const fits = textEl.scrollHeight <= availH && textEl.scrollWidth <= availW;
        if (fits) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      textEl.style.fontSize = prevSize;
      setFittedPx(best);
    };

    fit();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(container);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return fittedPx;
}
