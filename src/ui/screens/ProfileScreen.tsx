import { useState } from 'react';
import {
  activeDays,
  cleanName,
  gardenRank,
  learnedLanguages,
  MAX_NAME,
  memberSince,
} from '../../core/profile';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Avatar } from '../components/Avatar';
import type { AvatarId } from '../components/Avatar';
import { ButtonLink } from '../components/Button';
import { TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { ProgressBar } from '../components/ProgressBar';
import { useGarden } from '../garden';

/**
 * The user's profile: a name, a picture, the gardener rank and the main numbers. It lives only on this
 * device (in the settings); there is no account.
 */
export function ProfileScreen() {
  const { t, tp, language, languageName } = useI18n();
  const { settings, updateSettings } = useApp();
  const [now] = useState(() => Date.now());
  const garden = useGarden(now);
  const [name, setName] = useState(settings.profileName);
  const [saveFailed, setSaveFailed] = useState(false);
  if (!garden) return null;

  const { decks, times, achievements } = garden;
  // learned words (plus the cheat panel's bonus), the same number that earns flowers
  const blooms = garden.facts.blooms;
  const rank = gardenRank(blooms);
  // every kind of flower found in the garden can be the picture
  const choices: AvatarId[] = ['sprout', ...garden.found];
  const since = memberSince(
    times,
    decks.map((d) => d.createdAt),
  );
  const languages = learnedLanguages(decks);
  const shownName = settings.profileName || t('profile.noName');

  const save = (patch: Parameters<typeof updateSettings>[0]) => {
    setSaveFailed(false);
    updateSettings(patch).catch(() => setSaveFailed(true));
  };

  return (
    <>
      <PageHeader title={t('profile.title')} />
      {saveFailed && <Notice kind="error">{t('common.saveFailed')}</Notice>}

      <section className="card profile-head" aria-labelledby="profile-name">
        <Avatar avatar={settings.avatar} size={96} />
        <div className="profile-head__main">
          <h2 id="profile-name" className="profile-head__name">
            {shownName}
          </h2>
          <p className="badge profile-head__rank">{t(`rank.${rank.id}`)}</p>
          {since !== null && (
            <p className="muted">
              {t('profile.since', {
                date: new Date(since).toLocaleDateString(language, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          )}
        </div>
      </section>

      <section className="card stack" aria-labelledby="profile-rank">
        <h2 className="section__title" id="profile-rank">
          {t('profile.rankTitle')}
        </h2>
        {rank.next ? (
          <>
            <p>
              {tp('profile.rankNext', rank.next.at - blooms, { rank: t(`rank.${rank.next.id}`) })}
            </p>
            <ProgressBar value={rank.share} label={t('profile.rankTitle')} />
          </>
        ) : (
          <p>{t('profile.rankTop')}</p>
        )}
        <p className="muted">{t('profile.rankHint')}</p>
      </section>

      <div className="stats stats--two" role="group" aria-label={t('stats.numbers')}>
        <Stat value={blooms} label={t('profile.learned')} />
        <Stat value={garden.streak.current} label={t('stats.streak')} />
        <Stat value={garden.streak.best} label={t('stats.bestStreak')} />
        <Stat value={activeDays(times)} label={t('profile.days')} />
        <Stat value={times.length} label={t('stats.reviews')} />
        <Stat value={achievements.filter((a) => a.done).length} label={t('stats.achievements')} />
      </div>

      {languages.length > 0 && (
        <section className="section" aria-labelledby="profile-languages">
          <h2 className="section__title" id="profile-languages">
            {t('profile.languages')}
          </h2>
          <ul className="chips profile-langs">
            {languages.map((lang) => (
              <li key={lang} className="chip" lang={lang}>
                {languageName(lang)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section" aria-labelledby="profile-edit">
        <h2 className="section__title" id="profile-edit">
          {t('profile.edit')}
        </h2>
        <div className="setting-group">
          <TextField
            label={t('profile.name')}
            hint={t('profile.nameHint', { max: MAX_NAME })}
            value={name}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const clean = cleanName(name);
              setName(clean);
              if (clean !== settings.profileName) save({ profileName: clean });
            }}
          />
          <div className="field">
            <span className="field__label" id="profile-avatar">
              {t('profile.avatar')}
            </span>
            <div className="avatar-grid" role="radiogroup" aria-labelledby="profile-avatar">
              {choices.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={settings.avatar === id}
                  aria-label={id === 'sprout' ? 'Sprout' : t(`flower.${id}`)}
                  className="avatar-choice"
                  onClick={() => save({ avatar: id })}
                >
                  <Avatar avatar={id} size={52} />
                </button>
              ))}
            </div>
            <p className="field__hint">{t('profile.avatarHint')}</p>
          </div>
        </div>
      </section>

      <div className="row">
        <ButtonLink to="/garden" variant="secondary">
          {t('garden.open')}
        </ButtonLink>
        <ButtonLink to="/stats" variant="secondary">
          {t('garden.toProgress')}
        </ButtonLink>
      </div>
      <p className="muted">{t('profile.local')}</p>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}
