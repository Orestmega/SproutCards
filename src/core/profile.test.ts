import {
  activeDays,
  cleanName,
  gardenRank,
  learnedLanguages,
  MAX_NAME,
  memberSince,
  RANKS,
} from './profile';

describe('gardenRank', () => {
  it('starts as a seedling and moves up with learned words', () => {
    expect(gardenRank(0)).toEqual({ id: 'seedling', next: { id: 'gardener', at: 5 }, share: 0 });
    expect(gardenRank(4).share).toBeCloseTo(0.8);
    expect(gardenRank(5).id).toBe('gardener');
    expect(gardenRank(15)).toMatchObject({ id: 'gardener', share: 0.5 });
  });

  it('the top rank has nothing next', () => {
    const top = RANKS[RANKS.length - 1];
    expect(gardenRank((top?.at ?? 0) + 100)).toEqual({ id: top?.id, next: null, share: 1 });
  });
});

describe('profile facts', () => {
  const day = (n: number, hour = 10) => new Date(2026, 0, 1 + n, hour).getTime();

  it('counts different days only once', () => {
    expect(activeDays([day(0), day(0, 20), day(3)])).toBe(2);
    expect(activeDays([])).toBe(0);
  });

  it('member since: the first deck or answer, whichever came first', () => {
    expect(memberSince([day(5)], [day(2), day(9)])).toBe(day(2));
    expect(memberSince([day(1)], [])).toBe(day(1));
    expect(memberSince([], [])).toBeNull();
  });

  it('languages being learned, each once', () => {
    expect(
      learnedLanguages([{ learningLang: 'en' }, { learningLang: 'de' }, { learningLang: 'en' }]),
    ).toEqual(['en', 'de']);
  });
});

describe('cleanName', () => {
  it('trims, joins spaces and keeps at most the allowed length', () => {
    expect(cleanName('  Олена   Петрівна ')).toBe('Олена Петрівна');
    expect(Array.from(cleanName('я'.repeat(80)))).toHaveLength(MAX_NAME);
    expect(cleanName('   ')).toBe('');
  });
});
