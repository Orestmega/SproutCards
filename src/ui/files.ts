// Browser file helpers (download a file, read a chosen file).

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

/** Starts a download of `text` as a file. Works offline: no network is involved. */
export function downloadText(fileName: string, text: string, mime: string): void {
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
