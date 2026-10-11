/** Pure maths for the wheel, shared by the game and the odds test. */
export const SLICE_DEG = 30; // 12 slices

/** Final rotation (degrees, clockwise) so that slice `index` sits under the top pointer. */
export function targetRotation(current: number, index: number, turns: number, jitter: number): number {
  const base = -index * SLICE_DEG + jitter;
  const delta = (((base - current) % 360) + 360) % 360;
  return current + turns * 360 + delta;
}

/** Which slice is under the pointer for a given rotation. */
export function indexForRotation(deg: number, count = 12): number {
  const norm = (((-deg + SLICE_DEG / 2) % 360) + 360) % 360;
  return Math.floor(norm / SLICE_DEG) % count;
}
