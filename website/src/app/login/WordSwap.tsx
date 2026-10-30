"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Switches between "Tareeq" and "طريق" forever.
 * English letters rise in one by one out of a blur; Arabic is revealed
 * right-to-left (its reading direction) as one word, so its joined letters
 * never break apart. The box smoothly resizes to fit each word.
 */
export function WordSwap({ en, ar, interval = 2800 }: { en: string; ar: string; interval?: number }) {
  const [showAr, setShowAr] = useState(false);
  const [started, setStarted] = useState(false);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const enRef = useRef<HTMLSpanElement>(null);
  const arRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setStarted(true);
      setShowAr((v) => !v);
    }, interval);
    return () => clearInterval(t);
  }, [interval]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = showAr ? arRef.current : enRef.current;
      if (el) setWidth(el.scrollWidth);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [showAr]);

  return (
    <span className="word-swap relative inline-grid h-[1.35em] items-center justify-items-start overflow-visible align-middle" style={{ width }} aria-label={`${en} — ${ar}`}>
      <span ref={enRef} aria-hidden dir="ltr" className={`ws-en col-start-1 row-start-1 whitespace-nowrap ${showAr ? "ws-out" : "ws-in"}`}>
        {en.split("").map((c, i) => (
          <span key={i} className="ws-letter inline-block" style={{ "--i": i } as React.CSSProperties}>{c}</span>
        ))}
      </span>
      <span ref={arRef} aria-hidden lang="ar" dir="rtl" className={`ws-ar col-start-1 row-start-1 whitespace-nowrap text-lime ${!started ? "ws-hidden" : showAr ? "ws-in" : "ws-out"}`}>
        {ar}
      </span>
    </span>
  );
}
