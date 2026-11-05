import type { GrowthCounts } from '../../core/garden';
import { GROWTH_STAGES } from '../../core/garden';
import { useI18n } from '../../i18n';
import { Plant } from './Plant';

/** A thin bar: how many words of a deck are blooms, leaves, sprouts. The text next to it gives the numbers. */
export function GrowthBar({ growth }: { growth: GrowthCounts }) {
  return (
    <div className="growth-bar" aria-hidden="true">
      <span className="growth-bar__bloom" style={{ flexGrow: growth.bloom }} />
      <span className="growth-bar__leaf" style={{ flexGrow: growth.leaf }} />
      <span className="growth-bar__sprout" style={{ flexGrow: growth.sprout }} />
      <span style={{ flexGrow: growth.seed }} />
    </div>
  );
}

/** The four stages with a plant and the number of words in each. */
export function GrowthLegend({ growth }: { growth: GrowthCounts }) {
  const { t } = useI18n();
  return (
    <ul className="growth-legend">
      {[...GROWTH_STAGES].reverse().map((stage) => (
        <li key={stage}>
          <Plant stage={stage} size={36} />
          <strong>{growth[stage]}</strong>
          <span className="muted">{t(`growth.${stage}`)}</span>
        </li>
      ))}
    </ul>
  );
}
