import type { Expense, Fixed, Income } from "./db.ts";

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const thisMonth = () => isoDate(new Date()).slice(0, 7);

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return isoDate(new Date(y, m - 1 + n, 1)).slice(0, 7);
};

export const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const fixedFor = (fixed: Fixed[], month: string) =>
  fixed.filter((f) => f.from <= month && (!f.until || month <= f.until));

/** A fixed payment counts once its due day has passed (day 31 clamps to month end) or it was ticked off by hand (`manual` = ids). Earlier months are fully paid. */
export const isPaid = (f: Fixed, month: string, today: Date, manual: Set<number>) => {
  const now = isoDate(today).slice(0, 7);
  return month < now || manual.has(f.id) || (month === now && Math.min(f.day, daysIn(month)) <= today.getDate());
};

/**
 * The balance at the start of `month` (negative = overspent): every earlier month's income minus fixed minus expenses.
 * Counting starts at the first month that has real data; "0000-00" fixed rows are the migrated "since forever" rows
 * and don't define a start. Pass ALL expenses and ALL income, not just one month's.
 */
export function carryOver(month: string, fixed: Fixed[], expenses: Expense[], income: Income[]) {
  const starts = [...expenses.map((e) => e.date), ...income.map((i) => i.date)].map((d) => d.slice(0, 7));
  starts.push(...fixed.map((f) => f.from).filter((m) => m !== "0000-00"));
  if (!starts.length) return 0;
  const net = new Map<string, number>();
  for (const e of expenses) net.set(e.date.slice(0, 7), (net.get(e.date.slice(0, 7)) ?? 0) - e.amount);
  for (const i of income) net.set(i.date.slice(0, 7), (net.get(i.date.slice(0, 7)) ?? 0) + i.amount);
  let carry = 0;
  for (let m = starts.reduce((a, b) => (a < b ? a : b)); m < month; m = addMonths(m, 1)) {
    carry += (net.get(m) ?? 0) - fixedFor(fixed, m).reduce((t, f) => t + f.amount, 0);
  }
  return carry;
}

/** Everything for one month. Pass all fixed payments; the ones active in `month` are picked here. `carry` is from carryOver(). */
export function summarize(month: string, allFixed: Fixed[], expenses: Expense[], income: Income[], today = new Date(), carry = 0, manual = new Set<number>()) {
  const days = daysIn(month);
  const fixed = fixedFor(allFixed, month);
  const unpaid = fixed.filter((f) => !isPaid(f, month, today, manual));
  const pendingTotal = unpaid.reduce((s, f) => s + f.amount, 0);
  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0) - pendingTotal; // only paid ones leave the balance
  const variableTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const incomeTotal = income.reduce((s, i) => s + i.amount, 0);
  const remaining = incomeTotal + carry - fixedTotal - variableTotal;

  const byCat = new Map<number, number>();
  for (const x of [...fixed, ...expenses]) byCat.set(x.categoryId, (byCat.get(x.categoryId) ?? 0) + x.amount);

  const perDay = Array<number>(days + 1).fill(0);
  for (const e of expenses) perDay[Number(e.date.slice(8, 10))] += e.amount;
  for (const f of fixed) perDay[Math.min(f.day, days)] += f.amount; // day 31 in a 30-day month lands on the last day
  let run = 0;
  const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, total: (run += perDay[i + 1]) }));

  // Spendable per day for the rest of the month; only meaningful for the current month.
  const isCurrent = isoDate(today).slice(0, 7) === month;
  const daysLeft = days - today.getDate() + 1;
  const safePerDay = isCurrent ? Math.floor((remaining - pendingTotal) / daysLeft) : null;

  return { income: incomeTotal, carry, fixedTotal, pendingTotal, variableTotal, remaining, byCategory: [...byCat], daily, safePerDay };
}
