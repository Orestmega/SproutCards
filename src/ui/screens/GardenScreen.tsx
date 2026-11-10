import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dayPart } from '../../core/cheer';
import { growthCounts } from '../../core/garden';
import { gardenFields } from '../../core/gardenBeds';
import {
  firstRewardOf,
  gardenPlotsOf,
  GOLDEN_REPS,
  nextRewards,
  PLOT_COUNT,
  rarityOf,
  VARIETIES,
  wateringState,
} from '../../core/gardenLife';
import type { Reward, RewardFacts, VarietyId } from '../../core/gardenLife';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button, ButtonLink } from '../components/Button';
import { DecorationIcon } from '../components/Decoration';
import { GardenScene } from '../components/GardenScene';
import { GrowthLegend } from '../components/GrowthBar';
import { PageHeader } from '../components/Layout';
import { EmptyState, Notice } from '../components/Notice';
import { Plant } from '../components/Plant';
import { ProgressBar } from '../components/ProgressBar';
import { SpeakButton } from '../components/SpeakButton';
import { useCue } from '../cues';
import { useGarden, useWatering } from '../garden';
import type { GardenPlant } from '../garden';

const RAIN_MS = 2600;
/** Plants shown per bed; a huge deck shows the most grown ones and a count of the rest. */
const BED_LIMIT = 60;

/** The garden in full: the picture, today's watering, every word as a plant, flowers and decorations. */
export function GardenScreen() {
  const { t, tp, languageName } = useI18n();
  const { settings, updateSettings } = useApp();
  const { dailyGoal } = settings;
  const cue = useCue();
  const [now] = useState(() => Date.now());
  const garden = useGarden(now);
  const [wateredDay, water] = useWatering();
  const [raining, setRaining] = useState(false);
  const [selected, setSelected] = useState<GardenPlant | null>(null);
  /** The plot whose flower is being chosen. */
  const [planting, setPlanting] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lang, setLang] = useState('all');

  useEffect(() => {
    if (!raining) return;
    const timer = setTimeout(() => setRaining(false), RAIN_MS);
    return () => clearTimeout(timer);
  }, [raining]);

  if (!garden) return null;
  const { plants, decks, health, answersToday, decorations, earned, found, facts } = garden;
  const part = dayPart(new Date(now).getHours());
  const watering = wateringState(answersToday, dailyGoal, wateredDay, now);
  const earnedDecor = decorations.filter((d) => d.earned).map((d) => d.id);
  const studyDeck = decks.find((d) => plants.some((p) => p.deck.id === d.id));
  const fields = gardenFields(plants);
  // a language that is no longer learned falls back to "all"
  const shownLang = fields.some((field) => field.lang === lang) ? lang : 'all';
  const shownFields = shownLang === 'all' ? fields : fields.filter((x) => x.lang === shownLang);
  // the plots hold earned flowers: each one can grow on one plot, so the garden shows what was earned
  const plots = gardenPlotsOf(settings.gardenPlots, earned);
  const planted = plots.filter((p): p is Reward => p !== null);
  const goals = nextRewards(facts).slice(0, 2);

  function savePlots(list: (string | null)[]) {
    setSaveFailed(false);
    updateSettings({ gardenPlots: list }).catch(() => setSaveFailed(true));
  }

  function plantAt(index: number, reward: Reward | null) {
    const list = plots.map((p) => p?.id ?? null);
    list[index] = reward?.id ?? null;
    savePlots(list);
    setPlanting(null);
    if (reward) cue('correct');
  }

  function onWater() {
    water(now);
    setRaining(true);
    cue('finish');
  }

  return (
    <>
      <PageHeader title={t('garden.title')} />
      {saveFailed && <Notice kind="error">{t('common.saveFailed')}</Notice>}

      <GardenScene
        part={part}
        plants={plots.map((r) => (r ? { stage: 'bloom' as const, variety: r.variety } : null))}
        onPlot={(i) => setPlanting(i)}
        plotLabel={(i) => {
          const reward = plots[i];
          return reward
            ? t('garden.plot.flower', { n: i + 1, flower: t(`flower.${reward.variety}`) })
            : t('garden.plot.empty', { n: i + 1 });
        }}
        label={t('garden.plots')}
        decorations={earnedDecor}
        health={raining ? 'fresh' : health}
        raining={raining}
        big
      >
        <p className={`garden__health garden__health--${health}`}>{t(`garden.health.${health}`)}</p>
      </GardenScene>
      <p className="muted">
        {t('garden.plotsCount', { planted: planted.length, earned: earned.length, n: PLOT_COUNT })}{' '}
        {t('garden.plotsHint')}
      </p>
      {goals.length > 0 && (
        <ul className="next-flowers">
          {goals.map(({ reward }) => (
            <li className="next-flower" key={reward.id}>
              <Plant stage="bloom" variety={reward.variety} size={36} />
              <span>
                {t('garden.nextFlower', { flower: t(`flower.${reward.variety}`) })}{' '}
                <strong>{goalText(reward, facts, tp)}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}

      {plants.length === 0 ? (
        <EmptyState title={t('garden.empty.title')} text={t('garden.empty.text')}>
          <ButtonLink to="/catalog">{t('decks.catalog')}</ButtonLink>
        </EmptyState>
      ) : (
        <>
          <section className="card water" aria-labelledby="water-title">
            <span className="water__can" aria-hidden="true">
              <WateringCan />
            </span>
            <div className="water__main">
              <h2 className="today__title" id="water-title">
                {t('garden.water.title')}
              </h2>
              <div aria-live="polite">
                {watering === 'done' && <p>{t('garden.water.done')}</p>}
                {watering === 'ready' && <p>{t('garden.water.ready')}</p>}
                {watering === 'notYet' && (
                  <>
                    <p>
                      {tp('garden.water.notYet', dailyGoal - answersToday, {
                        done: answersToday,
                        goal: dailyGoal,
                      })}
                    </p>
                    <ProgressBar
                      value={answersToday / dailyGoal}
                      label={t('home.goal.count', { count: answersToday, goal: dailyGoal })}
                    />
                  </>
                )}
              </div>
              {watering === 'ready' && (
                <Button onClick={onWater}>{t('garden.water.button')}</Button>
              )}
              {watering === 'notYet' && studyDeck && (
                <ButtonLink to={`/decks/${studyDeck.id}/learn`} variant="secondary" small>
                  {t('garden.water.study')}
                </ButtonLink>
              )}
            </div>
          </section>

          <section className="section" aria-labelledby="beds-title">
            <h2 className="section__title" id="beds-title">
              {t('garden.beds')}
            </h2>
            <p className="muted">{t('garden.bedsHint')}</p>
            {fields.length > 1 && (
              <div className="chips" role="group" aria-label={t('garden.languages')}>
                {['all', ...fields.map((field) => field.lang)].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className="chip"
                    aria-pressed={shownLang === lang}
                    onClick={() => setLang(lang)}
                  >
                    {lang === 'all' ? t('garden.allLanguages') : languageName(lang)}
                  </button>
                ))}
              </div>
            )}
            {shownFields.map((field) => (
              <div className="field-group" key={field.lang}>
                <h3 className="field-group__name">
                  {t('garden.field', { language: languageName(field.lang) })}
                  <span className="muted">
                    {' '}
                    · {tp('garden.blooms', field.blooms)} · {tp('garden.growing', field.growing)}
                  </span>
                </h3>
                {field.beds.map((bed) => (
                  <div className="card bed" key={bed.deckId}>
                    <div className="section__head">
                      <h4 className="bed__name">{bed.deckName}</h4>
                      <span className="muted">{tp('garden.blooms', bed.blooms)}</span>
                    </div>
                    {bed.growing.length > 0 ? (
                      <ul className="bed__plants">
                        {bed.growing.slice(0, BED_LIMIT).map((plant) => (
                          <li key={plant.card.id}>
                            <button
                              type="button"
                              className="bed__plant"
                              aria-label={`${plant.card.term}: ${plantName(plant, t)}`}
                              onClick={() => setSelected(plant)}
                            >
                              <Plant stage={plant.stage} variety={plant.variety} size={40} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">{t('garden.bedEmpty')}</p>
                    )}
                    {bed.growing.length > BED_LIMIT && (
                      <p className="muted">{tp('garden.more', bed.growing.length - BED_LIMIT)}</p>
                    )}
                    {bed.seeds > 0 && (
                      <div className="seed-bag">
                        <Plant stage="seed" size={36} />
                        <span className="seed-bag__text">{tp('garden.seeds', bed.seeds)}</span>
                        <ButtonLink to={`/decks/${bed.deckId}/learn`} variant="secondary" small>
                          {t('garden.plantSeeds')}
                        </ButtonLink>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        </>
      )}

      <section className="section" aria-labelledby="flowers-title">
        <div className="section__head">
          <h2 className="section__title" id="flowers-title">
            {t('garden.collection')}
          </h2>
          <span className="muted">
            {t('stats.achievementsCount', { done: found.length, total: VARIETIES.length })}
          </span>
        </div>
        <p className="muted">{t('garden.collectionHint')}</p>
        <ul className="ach-grid">
          {VARIETIES.map((v) => {
            const count = earned.filter((r) => r.variety === v.id).length;
            const has = count > 0;
            const first = firstRewardOf(v.id);
            return (
              <li key={v.id}>
                <div className={has ? 'ach ach--done flower' : 'ach flower flower--locked'}>
                  <Plant stage="bloom" variety={v.id} size={56} />
                  <span className="ach__name">{t(`flower.${v.id}`)}</span>
                  <span className={`badge rarity rarity--${v.rarity}`}>
                    {t(`rarity.${v.rarity}`)}
                  </span>
                  <span className="muted">
                    {has
                      ? tp('garden.earnedCount', count)
                      : first
                        ? goalText(first, facts, tp)
                        : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section" aria-labelledby="decor-title">
        <div className="section__head">
          <h2 className="section__title" id="decor-title">
            {t('garden.decorations')}
          </h2>
          <span className="muted">
            {t('stats.achievementsCount', { done: earnedDecor.length, total: decorations.length })}
          </span>
        </div>
        <ul className="ach-grid">
          {decorations.map((d) => (
            <li key={d.id}>
              <div
                className={
                  d.earned ? 'ach ach--done decor-card' : 'ach decor-card decor-card--locked'
                }
              >
                <DecorationIcon id={d.id} size={56} />
                <span className="ach__name">{t(`decor.${d.id}`)}</span>
                <span className="muted">{t(`achievement.${d.achievement}.how`)}</span>
                {d.earned && <span className="visually-hidden">{t('stats.achievementDone')}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack prose" aria-labelledby="garden-how">
        <h2 className="section__title" id="garden-how">
          {t('garden.howTitle')}
        </h2>
        <GrowthLegend growth={growthCounts([], [])} />
        <ul className="garden-rules">
          {(['stages', 'water', 'wilt', 'flowers', 'golden', 'decor'] as const).map((rule) => (
            <li key={rule}>{t(`garden.rule.${rule}`, { reps: GOLDEN_REPS })}</li>
          ))}
        </ul>
        <Link to="/stats">{t('garden.toProgress')}</Link>
      </section>

      {selected && <PlantDialog plant={selected} now={now} onClose={() => setSelected(null)} />}
      {planting !== null && (
        <PlotDialog
          index={planting}
          current={plots[planting] ?? null}
          available={earned.filter((r) => !planted.some((p) => p.id === r.id))}
          goal={
            goals[0]
              ? { reward: goals[0].reward, text: goalText(goals[0].reward, facts, tp) }
              : null
          }
          onPlant={(reward) => plantAt(planting, reward)}
          onClose={() => setPlanting(null)}
        />
      )}
    </>
  );
}

type T = ReturnType<typeof useI18n>['t'];

function plantName(plant: GardenPlant, t: T): string {
  if (plant.stage !== 'bloom') return t(`growth.one.${plant.stage}`);
  return `${t('growth.one.bloom')} (${t(`flower.${plant.variety}`)})`;
}

function rarityLabel(variety: VarietyId, t: T): string {
  return t(`rarity.${rarityOf(variety)}`);
}

type TP = ReturnType<typeof useI18n>['tp'];

/** What is still needed for a reward, e.g. "learn 3 more words". */
function goalText(reward: Reward, facts: RewardFacts, tp: TP): string {
  const { kind, at } = reward.goal;
  if (kind === 'streak') return tp('garden.unlock.streak', at, { now: facts.bestStreak });
  if (kind === 'challenges') {
    return tp('garden.unlock.challenges', Math.max(0, at - facts.challenges));
  }
  if (kind === 'golden') {
    return tp('garden.unlock.goldenWords', Math.max(0, at - facts.goldenWords), {
      reps: GOLDEN_REPS,
    });
  }
  return tp('garden.unlock.blooms', Math.max(0, at - facts.blooms));
}

/** Opens a native dialog once it is in the page. */
function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }, []);
  return ref;
}

/**
 * Choose what grows on a plot: one of the earned flowers not planted yet (each grows on one plot).
 * Flowers of the same kind are grouped with a count. The choice shows at once; "Plant" puts it in.
 */
function PlotDialog({
  index,
  current,
  available,
  goal,
  onPlant,
  onClose,
}: {
  index: number;
  current: Reward | null;
  /** Earned flowers that grow on no plot yet. */
  available: readonly Reward[];
  /** The closest next flower, to show what to aim for. */
  goal: { reward: Reward; text: string } | null;
  onPlant: (reward: Reward | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useModal();
  // the kinds that can go on this plot: its own flower and the free ones, each kind once with a count
  const pool = current ? [current, ...available] : [...available];
  const kinds = VARIETIES.map((v) => v.id).filter((id) => pool.some((r) => r.variety === id));
  const [choice, setChoice] = useState<VarietyId | null>(current?.variety ?? kinds[0] ?? null);
  const chosen =
    choice === current?.variety ? current : (available.find((r) => r.variety === choice) ?? null);
  return (
    <dialog
      ref={ref}
      className="dialog plot-dialog"
      aria-labelledby="plot-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="plot-title">{t('garden.plot.title', { n: index + 1 })}</h2>
      <div className="plot-dialog__preview" aria-hidden="true">
        {choice ? (
          <span className="plot-dialog__grow" key={choice}>
            <Plant stage="bloom" variety={choice} size={96} />
          </span>
        ) : (
          <Plant stage="seed" size={96} />
        )}
      </div>
      <p className="plot-dialog__name" aria-live="polite">
        {choice ? t(`flower.${choice}`) : t('garden.plot.nothing')}
      </p>
      {kinds.length > 0 ? (
        <div className="kind-grid" role="radiogroup" aria-labelledby="plot-title">
          {kinds.map((id) => {
            const free = available.filter((r) => r.variety === id).length;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={choice === id}
                aria-label={`${t(`flower.${id}`)} (${t('garden.plot.free', { count: free })})`}
                className="kind-choice"
                // the keyboard focus starts on the chosen kind, so focus and choice never look like two picks
                autoFocus={id === (current?.variety ?? kinds[0])}
                onClick={(event) => {
                  setChoice(id);
                  event.currentTarget.focus(); // focus follows the choice
                }}
              >
                <Plant stage="bloom" variety={id} size={44} />
                {free > 1 && (
                  <span className="kind-choice__count" aria-hidden="true">
                    ×{free}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p>{t('garden.plot.allPlanted')}</p>
      )}
      {goal && (
        <p className="muted">
          {t('garden.plot.more', { flower: t(`flower.${goal.reward.variety}`) })} {goal.text}
        </p>
      )}
      <div className="dialog__actions">
        {current && (
          <Button variant="danger" onClick={() => onPlant(null)}>
            {t('garden.plot.remove')}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        {kinds.length > 0 && (
          <Button disabled={!chosen || chosen.id === current?.id} onClick={() => onPlant(chosen)}>
            {t('garden.plot.plantIt')}
          </Button>
        )}
      </div>
    </dialog>
  );
}

/** The card behind a plant: the word, its stage, its flower and when it comes back. */
function PlantDialog({
  plant,
  now,
  onClose,
}: {
  plant: GardenPlant;
  now: number;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const ref = useModal();
  const { card, deck } = plant;

  const due =
    plant.dueAt === null
      ? t('garden.plant.notStudied')
      : plant.dueAt <= now
        ? t('garden.plant.dueNow')
        : t('garden.plant.dueOn', {
            date: new Date(plant.dueAt).toLocaleDateString(language, {
              day: 'numeric',
              month: 'long',
            }),
          });
  return (
    <dialog
      ref={ref}
      className="dialog plant-dialog"
      aria-labelledby="plant-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="plant-dialog__top">
        <Plant stage={plant.stage} variety={plant.variety} size={88} />
        <div>
          <h2 id="plant-title" className="wotd__word">
            <span lang={deck.learningLang}>{card.term}</span>
            <SpeakButton text={card.term} lang={deck.learningLang} />
          </h2>
          <p lang={deck.translationLang}>{card.translations.join('; ')}</p>
        </div>
      </div>
      <ul className="plant-dialog__facts">
        <li>{plantName(plant, t)}</li>
        {plant.stage === 'bloom' && <li>{rarityLabel(plant.variety, t)}</li>}
        {plant.stage !== 'seed' && <li>{due}</li>}
        <li className="muted">{deck.name}</li>
      </ul>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={onClose} autoFocus>
          {t('garden.plant.close')}
        </Button>
        <ButtonLink to={`/decks/${deck.id}/learn`}>{t('garden.plant.study')}</ButtonLink>
      </div>
    </dialog>
  );
}

function WateringCan() {
  return (
    <svg width="56" height="56" viewBox="0 0 48 48" focusable="false">
      <path
        d="M8 18 h22 l-2 22 h-18 z"
        fill="#4fa6ff"
        stroke="#2d6fb8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M30 22 l12 -8 l2 3 l-12 10"
        fill="#4fa6ff"
        stroke="#2d6fb8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 18 q7 -10 14 0" fill="none" stroke="#2d6fb8" strokeWidth="2.5" />
      <ellipse cx="44" cy="14" rx="2.5" ry="1.4" fill="#2d6fb8" />
    </svg>
  );
}
