import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, carryOver, daysIn, fixedFor, isPaid, summarize } from "./budget.ts";
import { toCents } from "./money.ts";

const fixed = [
  { id: 1, title: "Rent", amount: 40000, categoryId: 1, day: 1, from: "2026-01" },
  { id: 2, title: "Gym", amount: 2000, categoryId: 2, day: 31, from: "2026-01" },
];
const inc = (amount: number, date: string) => ({ id: 1, title: "pay", amount, date });
const expenses = [
  { id: 1, title: "Rewe", amount: 1250, categoryId: 3, date: "2026-02-03" },
  { id: 2, title: "Aldi", amount: 750, categoryId: 3, date: "2026-02-10" },
];

test("totals, remaining and category grouping", () => {
  const s = summarize("2026-02", fixed, expenses, [inc(80000, "2026-02-01")], new Date(2026, 5, 1));
  assert.equal(s.fixedTotal, 42000);
  assert.equal(s.variableTotal, 2000);
  assert.equal(s.remaining, 36000);
  assert.deepEqual(s.byCategory, [[1, 40000], [2, 2000], [3, 2000]]);
  assert.equal(s.safePerDay, null); // not the current month
});

test("daily cumulative ends at total; day 31 clamps to month end", () => {
  const s = summarize("2026-02", fixed, expenses, [inc(80000, "2026-02-01")], new Date(2026, 5, 1));
  assert.equal(s.daily.length, 28);
  assert.equal(s.daily[0].total, 40000);
  assert.equal(s.daily[27].total, 44000);
});

test("safe per day in the current month", () => {
  const s = summarize("2026-02", fixed, expenses, [inc(80000, "2026-02-01")], new Date(2026, 1, 15)); // 14 days left incl. today
  assert.equal(s.safePerDay, 2571);
});

test("fixed payments only count inside their from/until window", () => {
  const f = [
    { id: 1, title: "Old rent", amount: 30000, categoryId: 1, day: 1, from: "2025-01", until: "2026-01" },
    { id: 2, title: "New rent", amount: 40000, categoryId: 1, day: 1, from: "2026-02" },
  ];
  assert.deepEqual(fixedFor(f, "2026-01").map((x) => x.id), [1]);
  assert.deepEqual(fixedFor(f, "2026-02").map((x) => x.id), [2]);
  assert.equal(summarize("2026-01", f, [], [], new Date(2030, 0, 1)).fixedTotal, 30000);
});

test("carry-over chains income, fixed and expenses from the first month with data", () => {
  const f = [{ id: 1, title: "Rent", amount: 40000, categoryId: 1, day: 1, from: "0000-00" }];
  const income = [inc(100000, "2026-02-01"), inc(50000, "2026-03-10")];
  const e = [
    { id: 1, title: "a", amount: 10000, categoryId: 3, date: "2026-02-05" }, // Feb nets 100000-40000-10000 = 50000
    { id: 2, title: "b", amount: 80000, categoryId: 3, date: "2026-03-05" }, // Mar nets 50000-40000-80000 = -70000
  ];
  assert.equal(carryOver("2026-02", f, e, income), 0); // first month, nothing before it
  assert.equal(carryOver("2026-03", f, e, income), 50000);
  assert.equal(carryOver("2026-04", f, e, income), -20000);
  assert.equal(carryOver("2026-06", f, e, income), -100000); // empty months still pay fixed
  assert.equal(carryOver("2026-01", f, e, income), 0); // before the data starts
  assert.equal(carryOver("2026-04", [], [], []), 0);
});

test("carry-over feeds remaining and safe-per-day", () => {
  const s = summarize("2026-02", fixed, expenses, [inc(80000, "2026-02-01")], new Date(2026, 1, 15), 14000);
  assert.equal(s.carry, 14000);
  assert.equal(s.remaining, 52000); // gym (due the 28th) isn't paid yet, so only 40000 + 2000 of expenses left
  assert.equal(s.safePerDay, 3571); // 50000 / 14 days left
});

test("fixed payments count once due or ticked; the unpaid ones still reduce safe-per-day", () => {
  const today = new Date(2026, 1, 15);
  assert.equal(isPaid(fixed[0], "2026-02", today, new Set()), true); // rent, day 1
  assert.equal(isPaid(fixed[1], "2026-02", today, new Set()), false); // gym, day 31 -> 28
  assert.equal(isPaid(fixed[1], "2026-02", today, new Set([2])), true); // ticked by hand
  assert.equal(isPaid(fixed[1], "2026-01", today, new Set()), true); // past month
  assert.equal(isPaid(fixed[0], "2026-03", today, new Set()), false); // future month
  const s = summarize("2026-02", fixed, expenses, [], today);
  assert.equal(s.fixedTotal, 40000);
  assert.equal(s.pendingTotal, 2000);
});

test("month helpers", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(daysIn("2024-02"), 29);
});

test("toCents", () => {
  assert.equal(toCents("12,50"), 1250);
  assert.equal(toCents("0.1") + toCents("0.2"), 30);
  assert.ok(Number.isNaN(toCents("abc")));
});
