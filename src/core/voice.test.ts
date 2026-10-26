import { pickVoice } from './voice';

const v = (
  lang: string,
  name: string,
  extra: { localService?: boolean; default?: boolean } = {},
) => ({
  lang,
  name,
  ...extra,
});

describe('pickVoice', () => {
  it('returns null when no voice speaks the language', () => {
    expect(pickVoice([v('en-US', 'A'), v('de-DE', 'B')], 'uk')).toBeNull();
    expect(pickVoice([], 'en')).toBeNull();
  });

  it('matches a base language code to a regional voice', () => {
    expect(pickVoice([v('de-DE', 'B'), v('en-GB', 'A')], 'en')?.name).toBe('A');
  });

  it('prefers an exact regional match', () => {
    expect(pickVoice([v('pt-PT', 'PT'), v('pt-BR', 'BR')], 'pt-BR')?.name).toBe('BR');
  });

  it('falls back to the base language when the region is missing', () => {
    expect(pickVoice([v('pt-PT', 'PT')], 'pt-BR')?.name).toBe('PT');
  });

  it('prefers on-device voices (they work offline), then the default one', () => {
    const voices = [
      v('en-US', 'online', { localService: false, default: true }),
      v('en-US', 'local', { localService: true }),
      v('en-US', 'local-default', { localService: true, default: true }),
    ];
    expect(pickVoice(voices, 'en')?.name).toBe('local-default');
    expect(pickVoice(voices.slice(0, 2), 'en')?.name).toBe('local');
  });

  it('understands underscores and case in codes (some Android voices use en_US)', () => {
    expect(pickVoice([v('uk_UA', 'U')], 'UK')?.name).toBe('U');
  });
});
