import type { DecorationId } from '../../core/gardenLife';

/**
 * The drawings of the garden decorations, each in a 48×48 box standing on the bottom edge. Used in the
 * garden picture and, as icons, in the list of decorations. All decoration (no meaning of their own).
 */
export function DecorationArt({ id }: { id: DecorationId }) {
  switch (id) {
    case 'butterflies':
      return (
        <g className="decor__flutter">
          {[
            [14, 18, '#ff8fa8'],
            [32, 10, '#8fb4ff'],
          ].map(([x, y, color]) => (
            <g key={String(x)} transform={`translate(${x} ${y})`}>
              <ellipse
                cx="-3"
                cy="0"
                rx="3.4"
                ry="4.4"
                fill={String(color)}
                stroke="#5c3a52"
                strokeWidth="0.6"
              />
              <ellipse
                cx="3"
                cy="0"
                rx="3.4"
                ry="4.4"
                fill={String(color)}
                stroke="#5c3a52"
                strokeWidth="0.6"
              />
              <rect x="-0.6" y="-4" width="1.2" height="8" rx="0.6" fill="#3a2a2a" />
            </g>
          ))}
        </g>
      );
    case 'birdhouse':
      return (
        <g>
          <rect x="22.5" y="24" width="3" height="24" fill="#8a6041" />
          <path
            d="M12 18 L24 8 L36 18 Z"
            fill="#d1453b"
            stroke="#9c2d25"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <rect
            x="14"
            y="17"
            width="20"
            height="15"
            rx="1.5"
            fill="#f2c27b"
            stroke="#b07d3a"
            strokeWidth="1"
          />
          <circle cx="24" cy="24" r="3" fill="#5a3a22" />
        </g>
      );
    case 'fence':
      return (
        <g fill="#f3e3c6" stroke="#b9925a" strokeWidth="1">
          <rect x="2" y="30" width="44" height="3" />
          <rect x="2" y="39" width="44" height="3" />
          {[4, 15, 26, 37].map((x) => (
            <path key={x} d={`M${x} 48 V26 l3.5 -4 l3.5 4 V48 Z`} />
          ))}
        </g>
      );
    case 'pond':
      return (
        <g>
          <ellipse cx="24" cy="42" rx="22" ry="6" fill="#5fb3e8" stroke="#3a86b8" strokeWidth="1" />
          <ellipse cx="18" cy="41" rx="6" ry="1.4" fill="#ffffff" opacity="0.5" />
          <ellipse cx="32" cy="43" rx="4" ry="1.6" fill="#58a83c" />
          <circle cx="32" cy="42" r="1.2" fill="#ff8fa8" />
        </g>
      );
    case 'tree':
      return (
        <g>
          <rect x="21.5" y="28" width="5" height="20" rx="1" fill="#8a6041" />
          <circle cx="24" cy="18" r="13" fill="#4f9a36" />
          <circle cx="17" cy="22" r="8" fill="#5fae45" />
          <circle cx="31" cy="21" r="8" fill="#5fae45" />
          {[
            [18, 16],
            [29, 14],
            [25, 24],
            [33, 25],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#e8384f" />
          ))}
        </g>
      );
    case 'beehive':
      return (
        <g>
          <rect x="23" y="0" width="2" height="12" fill="#8a6041" />
          <g fill="#ffc83d" stroke="#c99400" strokeWidth="1">
            <ellipse cx="24" cy="16" rx="8" ry="4.5" />
            <ellipse cx="24" cy="22.5" rx="11" ry="4.5" />
            <ellipse cx="24" cy="29" rx="12" ry="4.5" />
            <ellipse cx="24" cy="35" rx="10" ry="4.5" />
          </g>
          <ellipse cx="24" cy="34" rx="2.6" ry="2" fill="#5a3a22" />
          <g className="decor__flutter">
            <ellipse
              cx="38"
              cy="18"
              rx="2.4"
              ry="1.8"
              fill="#ffc83d"
              stroke="#3a2a2a"
              strokeWidth="0.6"
            />
          </g>
        </g>
      );
    case 'rainbow':
      return (
        <g fill="none" strokeWidth="3">
          {['#ff6b6b', '#ffb03d', '#ffe24d', '#6fd45a', '#4fa6ff', '#a678e3'].map((color, i) => (
            <path
              key={color}
              d={`M${4 + i * 3} 46 A${20 - i * 3} ${20 - i * 3} 0 0 1 ${44 - i * 3} 46`}
              stroke={color}
            />
          ))}
        </g>
      );
  }
}

/** A decoration as an icon. */
export function DecorationIcon({ id, size = 48 }: { id: DecorationId; size?: number }) {
  return (
    <svg
      className="decor"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <DecorationArt id={id} />
    </svg>
  );
}
