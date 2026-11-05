import type { ReactNode } from 'react';

/** A round progress ring with something inside. The ring is decoration: the text says the numbers. */
export function GoalRing({
  share,
  size = 76,
  children,
}: {
  share: number;
  size?: number;
  children: ReactNode;
}) {
  const stroke = size * 0.13;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const value = Math.min(1, Math.max(0, share));
  return (
    <div
      className={value >= 1 ? 'goal-ring goal-ring--done' : 'goal-ring'}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="goal-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="goal-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value)}
        />
      </svg>
      {children}
    </div>
  );
}
