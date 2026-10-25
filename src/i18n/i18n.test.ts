import { en } from './en';
import { translate, translatePlural } from './index';
import { uk } from './uk';

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'form.languageCodePlaceholder')).toBe('For example: pt-BR');
    expect(translate('uk', 'settings.newCardsHint', { max: 200 })).toBe('Число від 0 до 200.');
  });

  it('leaves unknown placeholders visible instead of crashing', () => {
    expect(translate('en', 'settings.newCardsHint')).toBe('A number from 0 to {max}.');
  });
});

describe('translatePlural', () => {
  it('uses the three Ukrainian forms correctly', () => {
    const forms = [1, 2, 5, 11, 12, 21, 22, 25, 100, 101, 0].map((n) =>
      translatePlural('uk', 'count.cards', n),
    );
    expect(forms).toEqual([
      '1 картка',
      '2 картки',
      '5 карток',
      '11 карток',
      '12 карток',
      '21 картка',
      '22 картки',
      '25 карток',
      '100 карток',
      '101 картка',
      '0 карток',
    ]);
  });

  it('uses English one/other', () => {
    expect(translatePlural('en', 'count.cards', 1)).toBe('1 card');
    expect(translatePlural('en', 'count.cards', 0)).toBe('0 cards');
    expect(translatePlural('en', 'count.cards', 2)).toBe('2 cards');
  });
});

describe('dictionaries', () => {
  it('Ukrainian has every English key, with non-empty text', () => {
    for (const key of Object.keys(en)) {
      expect(uk[key], `missing uk translation for ${key}`).toBeTruthy();
    }
  });

  it('has no empty English text', () => {
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toBe('');
  });

  it('Ukrainian plural messages have all four forms', () => {
    const bases = Object.keys(en)
      .filter((k) => k.endsWith('_other'))
      .map((k) => k.slice(0, -'_other'.length));
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(uk[`${base}_${form}`], `${base}_${form}`).toBeTruthy();
      }
    }
  });

  it('placeholders match between languages', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of Object.entries(en)) {
      expect(names(uk[key] as string), key).toEqual(names(value));
    }
  });
});
