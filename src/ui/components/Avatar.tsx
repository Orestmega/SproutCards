import type { VarietyId } from '../../core/gardenLife';
import { Mascot } from './Mascot';
import { Plant } from './Plant';

/** A profile picture: Sprout, or one of the flowers the user has found in the garden. */
export type AvatarId = 'sprout' | VarietyId;

export function Avatar({ avatar, size = 56 }: { avatar: AvatarId; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      {avatar === 'sprout' ? (
        <Mascot size={size * 0.92} />
      ) : (
        <Plant stage="bloom" variety={avatar} size={size * 0.8} />
      )}
    </span>
  );
}
