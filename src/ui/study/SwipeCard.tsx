import { useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';

/** How far the card must travel to count as an answer, and when a move starts counting at all. */
const SWIPE_PX = 110;
const START_PX = 10;
const AWAY_MS = 220;

/**
 * A card that can be dragged sideways: right means "know", left "still learning". It is only a
 * shortcut, the answer buttons do the same. A mostly vertical move is left alone so the page scrolls.
 */
export function SwipeCard({
  enabled,
  onSwipe,
  knowLabel,
  learnLabel,
  children,
}: {
  enabled: boolean;
  onSwipe: (known: boolean) => void;
  knowLabel: string;
  learnLabel: string;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<'rest' | 'drag' | 'settle' | 'away'>('rest');
  const start = useRef<{ x: number; y: number } | null>(null);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (enabled && phase !== 'away') start.current = { x: event.clientX, y: event.clientY };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (phase !== 'drag') {
      if (Math.abs(dy) > START_PX && Math.abs(dy) > Math.abs(dx)) {
        start.current = null; // the user is scrolling
        return;
      }
      if (Math.abs(dx) < START_PX) return;
      setPhase('drag');
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setOffset(dx);
  }

  function up() {
    start.current = null;
    if (phase !== 'drag') return;
    if (Math.abs(offset) >= SWIPE_PX) {
      const known = offset > 0;
      setPhase('away');
      setOffset(known ? window.innerWidth : -window.innerWidth);
      window.setTimeout(() => onSwipe(known), AWAY_MS);
    } else {
      setPhase('settle');
      setOffset(0);
    }
  }

  const strength = Math.min(1, Math.abs(offset) / SWIPE_PX);
  const classes = ['fc', phase === 'drag' && 'fc--drag', phase === 'settle' && 'fc--settle'];
  if (phase === 'away') classes.push('fc--drag', 'fc--away');
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      style={{
        transform: offset === 0 ? undefined : `translateX(${offset}px) rotate(${offset / 22}deg)`,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {offset > 0 && (
        <span className="stamp stamp--know" style={{ opacity: strength }} aria-hidden="true">
          {knowLabel}
        </span>
      )}
      {offset < 0 && (
        <span className="stamp stamp--learn" style={{ opacity: strength }} aria-hidden="true">
          {learnLabel}
        </span>
      )}
      {children}
    </div>
  );
}
