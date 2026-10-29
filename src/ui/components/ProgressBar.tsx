interface ProgressBarProps {
  /** 0..1 */
  value: number;
  /** Accessible name, e.g. "Session progress". */
  label: string;
  /** Stick to the top of the screen (learning screens). */
  top?: boolean;
}

export function ProgressBar({ value, label, top }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={top ? 'progress progress--top' : 'progress'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="progress__fill" data-empty={percent === 0} style={{ width: `${percent}%` }} />
    </div>
  );
}
