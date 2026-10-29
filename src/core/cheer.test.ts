import { dayPart, isComboMilestone, moodForScore, nextCombo, nextLine, reactTo } from './cheer';

describe('combo', () => {
  it('grows with correct answers, keeps on "almost", resets on a mistake', () => {
    expect(nextCombo(0, 'correct')).toBe(1);
    expect(nextCombo(4, 'correct')).toBe(5);
    expect(nextCombo(4, 'almost')).toBe(4);
    expect(nextCombo(4, 'wrong')).toBe(0);
  });

  it('cheers at 3, 5 and every 5 after that', () => {
    const cheered = Array.from({ length: 21 }, (_, i) => i).filter(isComboMilestone);
    expect(cheered).toEqual([3, 5, 10, 15, 20]);
  });
});

describe('reactTo', () => {
  it('is happy about a correct answer and celebrates a milestone', () => {
    expect(reactTo(0, 'correct')).toEqual({ mood: 'happy', combo: 1, milestone: false });
    expect(reactTo(2, 'correct')).toEqual({ mood: 'celebrate', combo: 3, milestone: true });
    expect(reactTo(3, 'correct')).toEqual({ mood: 'happy', combo: 4, milestone: false });
  });

  it('encourages after "almost" without breaking the combo', () => {
    expect(reactTo(2, 'almost')).toEqual({ mood: 'encouraging', combo: 2, milestone: false });
  });

  it('says "oops" after a wrong answer, but encourages an honest "I don\'t know"', () => {
    expect(reactTo(5, 'wrong')).toEqual({ mood: 'oops', combo: 0, milestone: false });
    expect(reactTo(5, 'wrong', true)).toEqual({ mood: 'encouraging', combo: 0, milestone: false });
  });

  it('a milestone is reached only by a correct answer', () => {
    // "almost" at combo 3 keeps 3 but is not a new milestone
    expect(reactTo(3, 'almost').milestone).toBe(false);
  });
});

describe('moodForScore', () => {
  it('celebrates from 90%, is happy from 70%, encourages below', () => {
    expect(moodForScore(1)).toBe('celebrate');
    expect(moodForScore(0.9)).toBe('celebrate');
    expect(moodForScore(0.89)).toBe('happy');
    expect(moodForScore(0.7)).toBe('happy');
    expect(moodForScore(0.69)).toBe('encouraging');
    expect(moodForScore(0)).toBe('encouraging');
  });
});

describe('dayPart', () => {
  it('splits the day into four parts', () => {
    expect(dayPart(4)).toBe('night');
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(11)).toBe('morning');
    expect(dayPart(12)).toBe('afternoon');
    expect(dayPart(16)).toBe('afternoon');
    expect(dayPart(17)).toBe('evening');
    expect(dayPart(22)).toBe('evening');
    expect(dayPart(23)).toBe('night');
    expect(dayPart(0)).toBe('night');
  });
});

describe('nextLine', () => {
  it('goes round the list', () => {
    expect(nextLine(0, 3)).toBe(1);
    expect(nextLine(2, 3)).toBe(0);
    expect(nextLine(0, 0)).toBe(0);
  });
});
