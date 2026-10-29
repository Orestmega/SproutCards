import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppDatabase } from '../db/db';
import { AppProviders } from './AppProviders';
import { downloadText } from './files';
import { INERT_PWA, PwaContext } from './pwa';
import { AppRoutes } from './routes';
import { speak } from './speech';

// The phone's plugins are replaced by fakes; these tests check how the app talks to them.
const native = vi.hoisted(() => ({ on: true }));
vi.mock('./native', () => ({ isNativeApp: () => native.on }));

const writeFile = vi.hoisted(() => vi.fn());
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
const share = vi.hoisted(() => vi.fn());
vi.mock('@capacitor/share', () => ({ Share: { share } }));
const tts = vi.hoisted(() => ({
  isLanguageSupported: vi.fn(),
  speak: vi.fn(),
}));
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: tts }));

beforeEach(() => {
  native.on = true;
  writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/backup.json' });
  share.mockReset().mockResolvedValue({});
  tts.isLanguageSupported.mockReset().mockResolvedValue({ supported: true });
  tts.speak.mockReset().mockResolvedValue(undefined);
});

describe('saving a file in the phone app', () => {
  it('writes the file to the cache and opens the share sheet (a WebView cannot download blobs)', async () => {
    await downloadText('backup.json', '{"a":1}', 'application/json');
    expect(writeFile).toHaveBeenCalledWith({
      path: 'backup.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(share).toHaveBeenCalledWith({ title: 'backup.json', url: 'file:///cache/backup.json' });
  });

  it('closing the share sheet without choosing is not an error', async () => {
    share.mockRejectedValue(new Error('Share canceled'));
    await expect(downloadText('b.json', '{}', 'application/json')).resolves.toBeUndefined();
  });

  it('reports a real failure so the screen can show a message', async () => {
    writeFile.mockRejectedValue(new Error('disk full'));
    await expect(downloadText('b.json', '{}', 'application/json')).rejects.toThrow('disk full');
    share.mockRejectedValue(new Error('no apps'));
    writeFile.mockResolvedValue({ uri: 'file:///x' });
    await expect(downloadText('b.json', '{}', 'application/json')).rejects.toThrow('no apps');
  });
});

describe('speech in the phone app', () => {
  it('uses the phone speech engine', async () => {
    await expect(speak('apple', 'en')).resolves.toBe('ok');
    expect(tts.speak).toHaveBeenCalledWith({ text: 'apple', lang: 'en' });
  });

  it('says so when the phone has no voice for the language', async () => {
    tts.isLanguageSupported.mockResolvedValue({ supported: false });
    await expect(speak('яблуко', 'uk')).resolves.toBe('no_voice');
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('reports an engine failure', async () => {
    tts.speak.mockRejectedValue(new Error('engine'));
    await expect(speak('apple', 'en')).resolves.toBe('error');
  });
});

describe('settings in the phone app', () => {
  it('describes the installed app instead of install and offline instructions', async () => {
    const db = new AppDatabase('native-test');
    render(
      <AppProviders db={db}>
        <PwaContext.Provider
          value={{ ...INERT_PWA, native: true, installed: true, offlineActive: true }}
        >
          <MemoryRouter initialEntries={['/settings']}>
            <AppRoutes />
          </MemoryRouter>
        </PwaContext.Provider>
      </AppProviders>,
    );
    expect(await screen.findByText(/This is the installed app/)).toBeInTheDocument();
    expect(screen.queryByText(/Offline mode/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reminders/)).not.toBeInTheDocument();
    db.close();
    await AppDatabase.delete('native-test');
  });
});
