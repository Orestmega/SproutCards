/** Random unique id. `crypto.randomUUID` exists in all supported browsers and in Node. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export type IdFactory = () => string;
