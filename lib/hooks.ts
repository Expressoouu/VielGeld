"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { carryOver, thisMonth } from "./budget";
import { db } from "./db";
import { setCurrency } from "./money";

/** Selected month from ?m=YYYY-MM, defaulting to the current one. */
export function useMonth() {
  const m = useSearchParams().get("m") ?? "";
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : thisMonth();
}

/** Live data for one month; undefined while IndexedDB is loading. `fixed` is all history, `income` and `expenses` are this month's, `all*` are every month's, `carry` is the balance at the start of the month. */
export function useMonthData(month: string) {
  return useLiveQuery(async () => {
    const currency = (await db.settings.get("currency"))?.value ?? "EUR";
    setCurrency(currency); // set before consumers render, so fmt() already uses it
    const fixed = await db.fixed.toArray();
    const all = await db.expenses.toArray(); // small tables; carry-over needs every earlier month
    const allIncome = await db.income.toArray();
    // fixed payments ticked off by hand this month live in settings as "paid:YYYY-MM:<fixedId>"
    const paid = new Set((await db.settings.where("key").startsWith(`paid:${month}:`).toArray()).map((s) => Number(s.key.split(":")[2])));
    return {
      currency,
      categories: await db.categories.toArray(),
      fixed,
      expenses: all.filter((e) => e.date.startsWith(month)),
      income: allIncome.filter((i) => i.date.startsWith(month)),
      paid,
      all,
      allIncome,
      carry: carryOver(month, fixed, all, allIncome),
    };
  }, [month]);
}
