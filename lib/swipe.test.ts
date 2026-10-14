import assert from "node:assert/strict";
import { test } from "node:test";
import { swipeStep } from "./swipe.ts";

test("horizontal swipes step the tab, small or vertical gestures do not", () => {
  assert.equal(swipeStep(-120, 10), 1);
  assert.equal(swipeStep(120, -10), -1);
  assert.equal(swipeStep(40, 0), 0);
  assert.equal(swipeStep(-100, 80), 0);
});
