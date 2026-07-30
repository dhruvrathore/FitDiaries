/**
 * Layered body-art registry.
 *
 * The body overview renders a base image plus one overlay per body part at its
 * growth level (1..3; level 0 = base only). To add real art, drop transparent,
 * pixel-aligned PNGs into `src/assets/body/front/` following this naming:
 *
 *   base.png
 *   chest_1.png  chest_2.png  chest_3.png
 *   back_1.png   ...          legs_3.png   (parts: chest, back, shoulders, arms, abs, legs)
 *
 * then fill in the `require(...)` calls below. Until an entry exists, BodyAvatar
 * falls back to a drawn (react-native-svg) figure, so the screen works with no art.
 *
 * NOTE: React Native requires *static* `require()` literals — they cannot be built
 * from variables, which is why this is an explicit map rather than a path helper.
 */
import type { PartKey, PartLevel } from '@/lib/physique';

export type BodyView = 'front';

/** require() result (a number) once art is added, or null to use the drawn fallback. */
type AssetRef = number | null;

const FRONT_BASE: AssetRef = null;
// e.g. const FRONT_BASE = require('./front/base.png');

const FRONT_OVERLAYS: Record<PartKey, [AssetRef, AssetRef, AssetRef]> = {
  // [level1, level2, level3] — e.g. [require('./front/chest_1.png'), ...]
  chest: [null, null, null],
  back: [null, null, null],
  shoulders: [null, null, null],
  neck: [null, null, null],
  arms: [null, null, null],
  abs: [null, null, null],
  legs: [null, null, null],
};

/** Base body image for a view, or null if no art is present yet. */
export function baseAsset(_view: BodyView = 'front'): AssetRef {
  return FRONT_BASE;
}

/** Overlay image for a part at a level (1..3), or null if absent. Level 0 has no overlay. */
export function overlayAsset(part: PartKey, level: PartLevel, _view: BodyView = 'front'): AssetRef {
  if (level < 1) return null;
  return FRONT_OVERLAYS[part]?.[level - 1] ?? null;
}

/** True once a full front image set has been supplied (base + all overlays). */
export function hasFrontArt(): boolean {
  if (FRONT_BASE == null) return false;
  return (Object.keys(FRONT_OVERLAYS) as PartKey[]).every((p) =>
    FRONT_OVERLAYS[p].every((a) => a != null)
  );
}
