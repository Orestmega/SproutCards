import {
  buildExampleCandidates,
  buildExampleIndex,
  buildPairs,
  chooseUnused,
  countWords,
  isGoodExample,
  parseSentences,
  pickExample,
  tokenize,
} from './tatoeba';
import type { SentencePair } from './tatoeba';

const pair = (enId: string, en: string, uk: string, author = 'a'): SentencePair => ({
  en: { id: enId, text: en, author },
  uk: { id: `u${enId}`, text: uk, author: 'b' },
});

describe('parseSentences / buildPairs', () => {
  const eng = parseSentences(
    '1\teng\tHello there.\tCK\t2020\t2021\n2\teng\tBye.\t\\N\t\\N\t\\N\n\n',
  );
  const ukr = parseSentences('10\tukr\tПривіт.\tdeniko\t2020\t2021\n');

  it('reads id, text and author; a missing author becomes "unknown"', () => {
    expect(eng.get('1')).toEqual({ id: '1', text: 'Hello there.', author: 'CK' });
    expect(eng.get('2')?.author).toBe('unknown');
    expect(eng.size).toBe(2);
  });

  it('pairs sentences through links, in either column order, without duplicates', () => {
    const pairs = buildPairs('1\t10\n10\t1\n2\t99\n3\t10\n', eng, ukr);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.en.text).toBe('Hello there.');
    expect(pairs[0]?.uk.text).toBe('Привіт.');
  });
});

describe('tokenize', () => {
  it('keeps contractions as one word and ignores punctuation', () => {
    expect(tokenize("I don't know, do you?")).toEqual(['I', "don't", 'know', 'do', 'you']);
  });
});

describe('countWords', () => {
  const counts = countWords([
    'The cat sat.',
    'I saw the cat.',
    'Tom saw Mary.',
    'Mary and Tom saw the dog.',
    'Where is Tom?',
    'The end.',
  ]);
  const get = (w: string) => counts.find((c) => c.word === w)?.count;

  it('folds sentence-initial capitals into the lower-case word', () => {
    expect(get('the')).toBe(4);
  });

  it('leaves out proper names but keeps "I"', () => {
    expect(get('tom')).toBeUndefined();
    expect(get('mary')).toBeUndefined();
    expect(get('i')).toBe(1);
  });

  it('sorts by frequency, then alphabetically', () => {
    const words = counts.map((c) => c.word);
    expect(words[0]).toBe('the');
    expect(words.indexOf('cat')).toBeLessThan(words.indexOf('dog'));
  });

  it('drops one-letter tokens other than a and i', () => {
    expect(countWords(['x y z a b c']).map((c) => c.word)).toEqual(['a']);
  });
});

describe('isGoodExample / pickExample', () => {
  const good = pair('1', 'The weather is nice today.', 'Сьогодні гарна погода.');

  it('accepts a clean, short, closely translated pair', () => {
    expect(isGoodExample(good)).toBe(true);
  });

  it('rejects too short, too long, digits, names, mixed alphabets and missing punctuation', () => {
    expect(isGoodExample(pair('2', 'Go now.', 'Йди зараз.'))).toBe(false);
    expect(
      isGoodExample(
        pair('3', 'x'.repeat(80) + '.', 'Довге речення, яке не підходить для прикладу.'),
      ),
    ).toBe(false);
    expect(isGoodExample(pair('4', 'I have 3 apples in my bag.', 'У мене 3 яблука в сумці.'))).toBe(
      false,
    );
    expect(
      isGoodExample(pair('5', 'I met Alice at the station.', 'Я зустрів Алісу на станції.')),
    ).toBe(false);
    expect(isGoodExample(pair('6', 'Tom is here at the station.', 'Том тут, на станції.'))).toBe(
      false,
    );
    expect(isGoodExample(pair('7', 'The weather is nice today.', 'Сьогодні гарна weather.'))).toBe(
      false,
    );
    expect(isGoodExample(pair('8', 'The weather is nice today', 'Сьогодні гарна погода'))).toBe(
      false,
    );
  });

  it('rejects vulgar or disturbing sentences', () => {
    expect(
      isGoodExample(pair('9', 'He is going to kill the plan.', 'Він збирається вбити план.')),
    ).toBe(false);
  });

  it('rejects translations whose length is very different', () => {
    expect(isGoodExample(pair('10', 'The weather is nice today.', 'Так.'))).toBe(false);
  });

  it('picks the shortest good example containing the word, ties broken by id', () => {
    const longer = pair(
      '5',
      'The weather is really very nice today.',
      'Сьогодні справді дуже гарна погода.',
    );
    const same1 = pair('9', 'The weather is cold today.', 'Сьогодні холодна погода.');
    const same2 = pair('7', 'The weather is warm today.', 'Сьогодні тепла погода.');
    expect(pickExample('weather', [longer, good, same1, same2])?.en.id).toBe('1');
    expect(pickExample('weather', [same1, same2])?.en.id).toBe('7');
    expect(pickExample('absent', [good])).toBeNull();
  });

  it('matches whole words only', () => {
    expect(pickExample('weath', [good])).toBeNull();
  });
});

describe('buildExampleIndex', () => {
  it('gives the same answer as pickExample for every word', () => {
    const pairs = [
      pair('1', 'The weather is nice today.', 'Сьогодні гарна погода.'),
      pair('5', 'The weather is really very nice today.', 'Сьогодні справді дуже гарна погода.'),
      pair('9', 'The weather is cold today.', 'Сьогодні холодна погода.'),
      pair('2', 'Go now.', 'Йди зараз.'),
    ];
    const index = buildExampleIndex(pairs);
    for (const word of ['weather', 'nice', 'cold', 'really', 'today', 'go']) {
      expect(index.get(word)?.en.id).toBe(pickExample(word, pairs)?.en.id);
    }
    expect(index.get('go')).toBeUndefined(); // only in a too-short sentence
  });
});

describe('stricter content filter', () => {
  it('rejects sentences about death, crime, bodily jokes and hating family', () => {
    expect(
      isGoodExample(
        pair('21', 'He died of cancer last year.', 'Він помер від раку минулого року.'),
      ),
    ).toBe(false);
    expect(
      isGoodExample(
        pair('22', 'Oh, he broke wind in the room.', 'О, він зіпсував повітря в кімнаті.'),
      ),
    ).toBe(false);
    expect(
      isGoodExample(pair('23', 'I hate my parents very much.', 'Я дуже ненавиджу своїх батьків.')),
    ).toBe(false);
    expect(
      isGoodExample(pair('24', 'I hate this place so much.', 'Я дуже ненавиджу це місце.')),
    ).toBe(true);
  });
});

describe('buildExampleCandidates / chooseUnused', () => {
  const a = pair('1', 'The weather is nice today.', 'Сьогодні гарна погода.');
  const b = pair('2', 'The weather is cold today.', 'Сьогодні холодна погода.');

  it('lists candidates best first', () => {
    const list = buildExampleCandidates([b, a]).get('weather') as SentencePair[];
    expect(list.map((p) => p.en.id)).toEqual(['1', '2']);
  });

  it('prefers a sentence nobody used, falls back to the best one when all are used', () => {
    const list = buildExampleCandidates([a, b]).get('weather');
    expect(chooseUnused(list, new Set())?.en.id).toBe('1');
    expect(chooseUnused(list, new Set(['1']))?.en.id).toBe('2');
    expect(chooseUnused(list, new Set(['1', '2']))?.en.id).toBe('1');
    expect(chooseUnused(undefined, new Set())).toBeNull();
  });
});
