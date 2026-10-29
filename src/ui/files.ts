// File helpers (save/share a file, read a chosen file). In the browser a file is downloaded; in the
// Android/iOS app the system share sheet is used ("Save to Files", Drive, e-mail...), because a WebView
// cannot download blobs.
import { isNativeApp } from './native';

/** Largest file we are willing to read into memory (a backup of a big collection is a few MB). */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** File-name-safe version of a title; keeps letters of any alphabet. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned === '' ? 'sproutcards' : cleaned;
}

/** Starts a download of `text` as a file. Works offline: no network is involved. Rejects if it fails. */
export async function downloadText(fileName: string, text: string, mime: string): Promise<void> {
  if (isNativeApp()) return shareText(fileName, text);
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Writes the text to the app's cache and opens the share sheet so the user chooses where it goes. */
async function shareText(fileName: string, text: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: fileName, url: uri });
  } catch (error) {
    // closing the share sheet without choosing anything is not a failure
    if (!/cancel/i.test(String(error instanceof Error ? error.message : error))) throw error;
  }
}

export type ReadResult =
  { ok: true; text: string } | { ok: false; reason: 'too_large' | 'unreadable' };

export async function readTextFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, reason: 'too_large' };
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
