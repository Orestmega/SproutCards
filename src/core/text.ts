/** Removes a leading byte-order mark (files saved by Excel/Notepad often start with one). */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
