import { gardenFields } from './gardenBeds';
import type { BedPlant } from './gardenBeds';

const en1 = { id: 'en1', name: 'Travel', learningLang: 'en' };
const en2 = { id: 'en2', name: 'Food', learningLang: 'en' };
const de = { id: 'de', name: 'Basics', learningLang: 'de' };

const plant = (
  deck: BedPlant['deck'],
  stage: BedPlant['stage'],
  rank = 0,
): BedPlant & { id: string } => ({
  id: `${deck.id}-${stage}-${rank}`,
  deck,
  stage,
  rank,
});

describe('gardenFields', () => {
  it('one field per language, one bed per deck', () => {
    const fields = gardenFields([plant(en1, 'bloom'), plant(en2, 'seed'), plant(de, 'leaf')]);
    // one growing word each: the order is by language code
    expect(fields.map((f) => f.lang)).toEqual(['de', 'en']);
    const en = fields.find((f) => f.lang === 'en');
    expect(en?.beds.map((b) => b.deckName)).toEqual(['Travel', 'Food']);
  });

  it('a bed shows only what grows, most grown and rarest first; new words are a bag of seeds', () => {
    const [field] = gardenFields([
      plant(en1, 'sprout'),
      plant(en1, 'bloom', 0),
      plant(en1, 'bloom', 2),
      plant(en1, 'leaf'),
      ...Array.from({ length: 50 }, () => plant(en1, 'seed')),
    ]);
    const bed = field?.beds[0];
    expect(bed?.growing.map((p) => `${p.stage}${p.rank}`)).toEqual([
      'bloom2',
      'bloom0',
      'leaf0',
      'sprout0',
    ]);
    expect(bed?.seeds).toBe(50);
    expect(bed?.blooms).toBe(2);
    expect(field).toMatchObject({ growing: 4, seeds: 50, blooms: 2 });
  });

  it('the field where most grows comes first', () => {
    const fields = gardenFields([plant(en1, 'seed'), plant(de, 'leaf'), plant(de, 'bloom')]);
    expect(fields[0]?.lang).toBe('de');
  });

  it('no words, no fields', () => {
    expect(gardenFields([])).toEqual([]);
  });
});
