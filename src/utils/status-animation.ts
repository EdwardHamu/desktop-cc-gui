/** Status animations expose at most one new visual sample per 200ms. */
export const STATUS_ANIMATION_FPS = 5;
export const STATUS_FRAME_MS = 1000 / STATUS_ANIMATION_FPS;

/** A single held frame for animations lasting STATUS_FRAME_MS (Motion easing). */
export function statusStepEnd(progress: number): number {
  return progress >= 1 ? 1 : 0;
}
