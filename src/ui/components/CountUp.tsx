import { useEffect, useRef } from 'react';

const DURATION_MS = 800;

/**
 * A number that counts up when it appears ("85%" runs from 0). The real text is always in the page for
 * screen readers; the moving digits are only painted (see `.count__shown`). Text that does not start
 * with a whole number is shown as it is.
 */
export function CountUp({ text }: { text: string }) {
  const shown = useRef<HTMLSpanElement>(null);
  const match = /^(\d+)(.*)$/.exec(text);
  const target = match ? Number(match[1]) : null;
  const rest = match?.[2] ?? '';

  useEffect(() => {
    const element = shown.current;
    if (!element) return;
    const paint = (value: string) => element.setAttribute('data-text', value);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (target === null || target === 0 || still) {
      paint(text);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      paint(`${Math.round(target * eased)}${rest}`);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, target, rest]);

  return (
    <span className="count">
      <span className="visually-hidden">{text}</span>
      <span className="count__shown" ref={shown} aria-hidden="true" data-text={text} />
    </span>
  );
}
