/** Small line icons drawn in SVG (24×24). They are decoration: the text next to them says the same. */
const PATHS = {
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  flame:
    'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.6 2.2 2.8C10.6 9 11.2 6 12 3z',
  cards: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4',
  learn: 'M4 18c4-1 6 0 8 2 2-2 4-3 8-2V6c-4-1-6 0-8 2-2-2-4-3-8-2zM12 8v12',
  flip: 'M4 8a3 3 0 0 1 3-3h7l-3-3M20 16a3 3 0 0 1-3 3h-7l3 3M8 9h8v6H8z',
  test: 'M9 4h6l1 2h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM8.5 13l2.5 2.5 4.5-5',
  match: 'M13 3 5 14h6l-1 7 8-11h-6z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  undo: 'M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3',
  medal:
    'M8 3h8l-2 6h-4zM12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
