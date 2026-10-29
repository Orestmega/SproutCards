import {
  EXCHANGE_VERSION,
  parseExchange,
  remapBundleIds,
  serializeBackup,
  serializeDeck,
} from './exchange';
import type { DeckBundle } from './exchange';
import { makeCard } from './testUtils';
import type { Deck, Progress } from './types';

const NOW = 1_700_000_000_000;

function bundle(): DeckBundle {
  const deck: Deck = {
    id: 'deck-1',
    name: 'Travel',
    learningLang: 'en',
    translationLang: 'uk',
    description: 'Words for trips',
    createdAt: 5,
  };
  const cards = [
    makeCard('ticket', ['квиток'], {
      id: 'c1',
      deckId: 'deck-1',
      examples: [{ text: 'One ticket, please.', translation: 'Один квиток, будь ласка.' }],
      notes: 'noun',
    }),
    makeCard('train', ['потяг', 'поїзд'], { id: 'c2', deckId: 'deck-1', reviewed: false }),
  ];
  const progress: Progress[] = [
    {
      id: 'c1:forward',
      cardId: 'c1',
      deckId: 'deck-1',
      direction: 'forward',
      reps: 2,
      intervalDays: 3,
      dueAt: 9_000,
      lapses: 1,
      lastReviewedAt: 8_000,
    },
  ];
  return { deck, cards, progress };
}

describe('serialize + parse round trip', () => {
  it('restores a single deck exactly', () => {
    const original = bundle();
    const parsed = parseExchange(serializeDeck(original, NOW), NOW);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual([original]);
    expect(parsed.warnings).toEqual([]);
  });

  it('restores a backup of several decks', () => {
    const a = bundle();
    const b = {
      ...bundle(),
      deck: { ...bundle().deck, id: 'deck-2', name: 'Food' },
      cards: [],
      progress: [],
    };
    const parsed = parseExchange(serializeBackup([a, b], NOW), NOW);
    expect(parsed.ok && parsed.value.map((x) => x.deck.name)).toEqual(['Travel', 'Food']);
  });

  it('writes the format marker and version', () => {
    const json = JSON.parse(serializeDeck(bundle(), NOW));
    expect(json).toMatchObject({
      format: 'sproutcards-deck',
      version: EXCHANGE_VERSION,
      exportedAt: new Date(NOW).toISOString(),
    });
    expect(json.cards[0]).not.toHaveProperty('deckId');
  });

  it('accepts a file that starts with a byte-order mark', () => {
    const text = String.fromCharCode(0xfeff) + serializeDeck(bundle(), NOW);
    expect(parseExchange(text, NOW).ok).toBe(true);
  });

  it('keeps Ukrainian text and emoji intact', () => {
    const b = bundle();
    b.cards[0] = makeCard('п’ять 🖐', 'five', { id: 'c1', deckId: 'deck-1' });
    const parsed = parseExchange(serializeDeck(b, NOW), NOW);
    expect(parsed.ok && parsed.value[0]?.cards[0]?.term).toBe('п’ять 🖐');
  });
});

describe('rejecting bad files', () => {
  function errorsOf(text: string) {
    const r = parseExchange(text, NOW);
    if (r.ok) throw new Error('expected a failure');
    return r.errors;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at arbitrary JSON
  function edited(change: (json: Record<string, any>) => void): string {
    const json = JSON.parse(serializeDeck(bundle(), NOW));
    change(json);
    return JSON.stringify(json);
  }

  it('not JSON', () => {
    expect(errorsOf('hello')[0]?.code).toBe('not_json');
    expect(errorsOf('')[0]?.code).toBe('not_json');
  });

  it('JSON that is not an object', () => {
    expect(errorsOf('[1,2]')[0]?.code).toBe('not_object');
    expect(errorsOf('null')[0]?.code).toBe('not_object');
  });

  it('a foreign JSON file', () => {
    expect(errorsOf('{"name":"x"}')[0]?.code).toBe('wrong_format');
  });

  it('a file from a newer app version', () => {
    expect(errorsOf(edited((j) => (j.version = EXCHANGE_VERSION + 1)))[0]?.code).toBe(
      'unsupported_version',
    );
  });

  it('a missing or invalid version', () => {
    expect(errorsOf(edited((j) => delete j.version))[0]?.code).toBe('invalid_value');
    expect(errorsOf(edited((j) => (j.version = 1.5)))[0]?.code).toBe('invalid_value');
  });

  it('a deck without a name or with a bad language code', () => {
    const errors = errorsOf(
      edited((j) => {
        j.deck.name = '  ';
        j.deck.learningLang = 'english!';
      }),
    );
    expect(errors.map((e) => e.path)).toEqual(['deck.name', 'deck.learningLang']);
  });

  it('a missing deck', () => {
    expect(errorsOf(edited((j) => delete j.deck))[0]).toMatchObject({
      code: 'missing_field',
      path: 'deck',
    });
  });

  it('reports every broken card with its position, and imports nothing', () => {
    const errors = errorsOf(
      edited((j) => {
        j.cards[0].term = '';
        j.cards[1].translations = [];
        j.cards.push({ id: 'c2', term: 'dup', translations: ['x'] });
      }),
    );
    const paths = errors.map((e) => e.path);
    expect(paths).toContain('cards[0].term');
    expect(paths).toContain('cards[1].translations');
    expect(errors.some((e) => e.code === 'duplicate_id' && e.path === 'cards[2].id')).toBe(true);
  });

  it('wrong types inside a card', () => {
    const errors = errorsOf(
      edited((j) => {
        j.cards[0].translations = 'квиток';
        j.cards[1].examples = [{ translation: 'no text' }];
        j.cards[1].reviewed = 'yes';
      }),
    );
    expect(errors.map((e) => e.path)).toEqual(
      expect.arrayContaining([
        'cards[0].translations',
        'cards[1].examples[0].text',
        'cards[1].reviewed',
      ]),
    );
  });

  it('a missing cards list', () => {
    expect(errorsOf(edited((j) => delete j.cards))[0]?.path).toBe('cards');
  });

  it('invalid progress numbers and duplicate progress', () => {
    const errors = errorsOf(
      edited((j) => {
        j.progress[0].dueAt = -1;
        j.progress.push({ ...j.progress[0], dueAt: 1 }, { ...j.progress[0], dueAt: 1 });
      }),
    );
    expect(errors[0]?.path).toBe('progress[0].dueAt');
  });

  it('too long text', () => {
    expect(errorsOf(edited((j) => (j.cards[0].term = 'x'.repeat(5000))))[0]?.path).toBe(
      'cards[0].term',
    );
  });

  it('a backup without a deck list, or with a broken deck inside', () => {
    expect(errorsOf('{"format":"sproutcards-backup","version":1}')[0]?.path).toBe('decks');
    const backup = JSON.parse(serializeBackup([bundle()], NOW));
    backup.decks[0].cards[0].term = '';
    expect(errorsOf(JSON.stringify(backup))[0]?.path).toBe('decks[0].cards[0].term');
  });

  it('caps the number of reported issues', () => {
    const errors = errorsOf(
      edited((j) => {
        j.cards = Array.from({ length: 500 }, () => ({}));
      }),
    );
    expect(errors.length).toBeLessThanOrEqual(50);
  });
});

describe('lenient parts', () => {
  it('fills defaults: unverified cards, current time, no progress', () => {
    const text = JSON.stringify({
      format: 'sproutcards-deck',
      version: 1,
      deck: { id: 'd', name: 'N', learningLang: 'de', translationLang: 'en' },
      cards: [{ id: 'a', term: 'Haus', translations: ['house'] }],
    });
    const r = parseExchange(text, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0]?.deck.createdAt).toBe(NOW);
    expect(r.value[0]?.cards[0]).toMatchObject({ reviewed: false, examples: [], createdAt: NOW });
    expect(r.value[0]?.progress).toEqual([]);
  });

  it('drops progress for unknown cards with a warning instead of failing', () => {
    const json = JSON.parse(serializeDeck(bundle(), NOW));
    json.progress.push({ ...json.progress[0], cardId: 'ghost' });
    const r = parseExchange(JSON.stringify(json), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0]?.progress).toHaveLength(1);
    expect(r.warnings[0]).toMatchObject({ code: 'unknown_card', path: 'progress[1]' });
  });

  it('an empty deck (no cards) is valid', () => {
    const b = { ...bundle(), cards: [], progress: [] };
    expect(parseExchange(serializeDeck(b, NOW), NOW).ok).toBe(true);
  });
});

describe('remapBundleIds', () => {
  it('gives everything fresh, consistent ids', () => {
    let n = 0;
    const out = remapBundleIds(bundle(), () => `new-${++n}`);
    expect(out.deck.id).toBe('new-1');
    expect(out.cards.map((c) => c.id)).toEqual(['new-2', 'new-3']);
    expect(out.cards.every((c) => c.deckId === 'new-1')).toBe(true);
    expect(out.progress[0]).toMatchObject({
      id: 'new-2:forward',
      cardId: 'new-2',
      deckId: 'new-1',
    });
  });

  it('does not modify its input', () => {
    const b = bundle();
    const snapshot = JSON.stringify(b);
    remapBundleIds(b, () => 'x');
    expect(JSON.stringify(b)).toBe(snapshot);
  });
});

describe('starred cards', () => {
  it('a star survives export and import; an unstarred card stays without the field', () => {
    const original = bundle();
    original.cards[0] = { ...original.cards[0]!, starred: true };
    const parsed = parseExchange(serializeDeck(original), NOW);
    if (!parsed.ok) throw new Error('should parse');
    expect(parsed.value[0]!.cards[0]!.starred).toBe(true);
    expect('starred' in parsed.value[0]!.cards[1]!).toBe(false);
  });

  it('files from before stars existed still import', () => {
    const parsed = parseExchange(serializeDeck(bundle()), NOW);
    expect(parsed.ok).toBe(true);
  });

  it('a star that is not true or false is refused', () => {
    const json = JSON.parse(serializeDeck(bundle()));
    json.cards[0].starred = 'yes';
    const parsed = parseExchange(JSON.stringify(json), NOW);
    expect(parsed.ok).toBe(false);
  });
});
