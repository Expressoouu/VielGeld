// Turns a touch gesture into a tab step: swipe left = +1 (next), right = -1, otherwise 0.
// Mostly-vertical gestures are scrolling, not swipes.
export function swipeStep(dx: number, dy: number, min = 60) {
  if (Math.abs(dx) < min || Math.abs(dx) < 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
