import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dayPart } from '../../core/cheer';
import type { MascotMood } from '../../core/cheer';
import { growthCounts } from '../../core/garden';
import { gardenFields } from '../../core/gardenBeds';
import {
  canGrowAs,
  GOLDEN_REPS,
  isUnlocked,
  nextVariety,
  rarityOf,
  SHOWCASE_SIZE,
  VARIETIES,
  wateringState,
} from '../../core/gardenLife';
import type { ShowcasePlot, Unlock, VarietyId } from '../../core/gardenLife';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button, ButtonLink } from '../components/Button';
import { DecorationIcon } from '../components/Decoration';
import { GardenScene } from '../components/GardenScene';
import { GrowthLegend } from '../components/GrowthBar';
import { PageHeader } from '../components/Layout';
import { Mascot } from '../components/Mascot';
import { EmptyState, Notice } from '../components/Notice';
import { Plant } from '../components/Plant';
import { SearchField } from '../components/Fields';
import { ProgressBar } from '../components/ProgressBar';
import { SpeakButton } from '../components/SpeakButton';
import { useCue } from '../cues';
import { showcasePlants, useGarden, useWatering } from '../garden';
import type { GardenPlant } from '../garden';

const RAIN_MS = 2600;
/** Plants shown per bed; a huge deck shows the most grown ones and a count of the rest. */
const BED_LIMIT = 60;
const MOOD: Record<string, MascotMood> = {
  new: 'normal',
  fresh: 'happy',
  thirsty: 'encouraging',
  wilted: 'oops',
};

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
  const [reaction, setReaction] = useState(0);
  const [selected, setSelected] = useState<GardenPlant | null>(null);
  /** The plot being planted (an index; one past the last plot means a new one). */
  const [planting, setPlanting] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lang, setLang] = useState('all');

  useEffect(() => {
    if (!raining) return;
    const timer = setTimeout(() => setRaining(false), RAIN_MS);
    return () => clearTimeout(timer);
  }, [raining]);

  if (!garden) return null;
  const { plants, decks, health, answersToday, decorations, unlocked, facts } = garden;
  const part = dayPart(new Date(now).getHours());
  const watering = wateringState(answersToday, dailyGoal, wateredDay, now);
  const earned = decorations.filter((d) => d.earned).map((d) => d.id);
  const studyDeck = decks.find((d) => plants.some((p) => p.deck.id === d.id));
  const fields = gardenFields(plants);
  // a language that is no longer learned falls back to "all"
  const shownLang = fields.some((field) => field.lang === lang) ? lang : 'all';
  const shownFields = shownLang === 'all' ? fields : fields.filter((x) => x.lang === shownLang);
  // the plots of the picture: what the user planted, or the most grown words to begin with
  const plotted = showcasePlants(garden, SHOWCASE_SIZE);
  const plots: (GardenPlant | null)[] = Array.from(
    { length: SHOWCASE_SIZE },
    (_, i) => plotted[i] ?? null,
  );
  const plotIndex = (plant: GardenPlant) => plotted.findIndex((p) => p.card.id === plant.card.id);
  const next = nextVariety(facts);

  /** Saves the plots; the first change turns the automatic picture into the user's own. */
  function savePlots(list: ShowcasePlot[]) {
    setSaveFailed(false);
    updateSettings({ gardenShowcase: list.slice(0, SHOWCASE_SIZE) }).catch(() =>
      setSaveFailed(true),
    );
  }
  const currentPlots = (): ShowcasePlot[] =>
    plotted.map((p) => ({ cardId: p.card.id, variety: p.variety }));

  function plant(cardId: string, at: number) {
    const target = plants.find((p) => p.card.id === cardId);
    if (!target) return;
    const list = currentPlots().filter((p) => p.cardId !== cardId);
    const item = { cardId, variety: target.variety };
    if (at < list.length) list.splice(at, 1, item);
    else list.push(item);
    savePlots(list);
    setPlanting(null);
    setSelected(null);
  }

  function setVariety(cardId: string, variety: VarietyId) {
    const list = currentPlots();
    const plot = list.find((p) => p.cardId === cardId);
    if (plot) plot.variety = variety;
    else list.push({ cardId, variety });
    savePlots(list);
  }

  function unplant(cardId: string) {
    savePlots(currentPlots().filter((p) => p.cardId !== cardId));
    setSelected(null);
  }

  function onWater() {
    water(now);
    setRaining(true);
    setReaction((r) => r + 1);
    cue('finish');
  }

  return (
    <>
      <PageHeader title={t('garden.title')} />
      {saveFailed && <Notice kind="error">{t('common.saveFailed')}</Notice>}

      <GardenScene
        part={part}
        plants={plots}
        onPlot={(i) => {
          const there = plots[i];
          if (there) setSelected(there);
          else setPlanting(Math.min(i, plotted.length));
        }}
        plotLabel={(i) => {
          const there = plots[i];
          return there
            ? `${there.card.term}: ${plantName(there, t)}`
            : t('garden.plot.empty', { n: i + 1 });
        }}
        label={t('garden.plots')}
        decorations={earned}
        health={raining ? 'fresh' : health}
        raining={raining}
        big
      >
        <div className="garden__sprout">
          <Mascot mood={raining ? 'celebrate' : MOOD[health]} size={112} reaction={reaction} />
        </div>
        <p className={`garden__health garden__health--${health}`}>{t(`garden.health.${health}`)}</p>
      </GardenScene>
      {plants.length > 0 && <p className="muted">{t('garden.plotsHint', { n: SHOWCASE_SIZE })}</p>}

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
            {t('stats.achievementsCount', { done: unlocked.length, total: VARIETIES.length })}
          </span>
        </div>
        <p className="muted">{t('garden.collectionHint')}</p>
        {next && (
          <p className="next-flower">
            <Plant stage="bloom" variety={next.id} size={36} />
            <span>
              {t('garden.nextFlower', { flower: t(`flower.${next.id}`) })}{' '}
              <strong>{unlockText(next.unlock, facts, t, tp)}</strong>
            </span>
          </p>
        )}
        <ul className="ach-grid">
          {VARIETIES.map((v) => {
            const has = isUnlocked(v.unlock, facts);
            return (
              <li key={v.id}>
                <div className={has ? 'ach ach--done flower' : 'ach flower flower--locked'}>
                  <Plant stage="bloom" variety={v.id} size={56} />
                  <span className="ach__name">{t(`flower.${v.id}`)}</span>
                  <span className={`badge rarity rarity--${v.rarity}`}>
                    {t(`rarity.${v.rarity}`)}
                  </span>
                  <span className="muted">
                    {has ? t('garden.opened') : unlockText(v.unlock, facts, t, tp)}
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
            {t('stats.achievementsCount', { done: earned.length, total: decorations.length })}
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
                {d.earned && <span className="badge">{t('stats.achievementDone')}</span>}
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

      {selected && (
        <PlantDialog
          plant={selected}
          now={now}
          unlocked={unlocked}
          planted={plotIndex(selected) >= 0}
          canPlant={plotted.length < SHOWCASE_SIZE}
          onVariety={(variety) => setVariety(selected.card.id, variety)}
          onPlant={() => plant(selected.card.id, plotted.length)}
          onReplace={() => {
            setPlanting(plotIndex(selected));
            setSelected(null);
          }}
          onRemove={() => unplant(selected.card.id)}
          onClose={() => setSelected(null)}
        />
      )}
      {planting !== null && (
        <PlantPicker
          plants={plants.filter((p) => plotIndex(p) < 0)}
          onPick={(cardId) => plant(cardId, planting)}
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

/** What is still needed to open a kind of flower, e.g. "learn 3 more words". */
function unlockText(
  unlock: Unlock,
  facts: { blooms: number; bestStreak: number },
  t: T,
  tp: TP,
): string {
  if (unlock.golden) return t('garden.unlock.golden', { reps: GOLDEN_REPS });
  if (unlock.streak !== undefined) {
    return tp('garden.unlock.streak', unlock.streak, { now: facts.bestStreak });
  }
  return tp('garden.unlock.blooms', Math.max(0, (unlock.blooms ?? 0) - facts.blooms));
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

/** Choose a word to grow on a plot: the most grown first; a search for big gardens. */
function PlantPicker({
  plants,
  onPick,
  onClose,
}: {
  plants: GardenPlant[];
  onPick: (cardId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useModal();
  const [query, setQuery] = useState('');
  const order = { bloom: 0, leaf: 1, sprout: 2, seed: 3 } as const;
  const wanted = query.trim().toLowerCase();
  const list = plants
    .filter(
      (p) =>
        wanted === '' ||
        p.card.term.toLowerCase().includes(wanted) ||
        p.card.translations.some((x) => x.toLowerCase().includes(wanted)),
    )
    .sort((a, b) => order[a.stage] - order[b.stage] || a.card.term.localeCompare(b.card.term))
    .slice(0, 60);
  return (
    <dialog
      ref={ref}
      className="dialog plant-picker"
      aria-labelledby="picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="picker-title">{t('garden.picker.title')}</h2>
      <p className="muted">{t('garden.picker.hint')}</p>
      <SearchField label={t('deck.search')} value={query} onChange={setQuery} />
      {list.length === 0 ? (
        <p className="muted">{t('common.nothingFound')}</p>
      ) : (
        <ul className="picker-list">
          {list.map((p) => (
            <li key={p.card.id}>
              <button type="button" className="picker-item" onClick={() => onPick(p.card.id)}>
                <Plant stage={p.stage} variety={p.variety} size={36} />
                <span className="list-row__main">
                  <span className="list-row__title">{p.card.term}</span>
                  <span className="muted">{plantName(p, t)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="dialog__actions">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </dialog>
  );
}

/** The card behind a plant: the word, its stage, its flower and when it comes back. */
function PlantDialog({
  plant,
  now,
  unlocked,
  planted,
  canPlant,
  onVariety,
  onPlant,
  onReplace,
  onRemove,
  onClose,
}: {
  plant: GardenPlant;
  now: number;
  unlocked: readonly VarietyId[];
  /** The word grows on a plot of the picture. */
  planted: boolean;
  /** There is a free plot for it. */
  canPlant: boolean;
  onVariety: (variety: VarietyId) => void;
  onPlant: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const ref = useModal();
  const { card, deck } = plant;
  const kinds = unlocked.filter((id) => canGrowAs(id, plant.reps));

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
      {plant.stage === 'bloom' ? (
        <div className="field">
          <span className="field__label" id="kind-title">
            {t('garden.kind')}
          </span>
          <div className="kind-grid" role="radiogroup" aria-labelledby="kind-title">
            {kinds.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={plant.variety === id}
                aria-label={t(`flower.${id}`)}
                className="avatar-choice"
                onClick={() => onVariety(id)}
              >
                <Plant stage="bloom" variety={id} size={40} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted">{t('garden.kindLater')}</p>
      )}
      <div className="row plant-dialog__plot">
        {planted ? (
          <>
            <Button small variant="secondary" onClick={onReplace}>
              {t('garden.plot.replace')}
            </Button>
            <Button small variant="danger" onClick={onRemove}>
              {t('garden.plot.remove')}
            </Button>
          </>
        ) : (
          canPlant && (
            <Button small variant="secondary" onClick={onPlant}>
              {t('garden.plot.plant')}
            </Button>
          )
        )}
      </div>
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
