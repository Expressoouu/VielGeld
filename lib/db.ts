import Dexie, { type EntityTable } from "dexie";

export type Category = { id: number; name: string };
// A fixed payment is active in every month from `from` through `until` (both "YYYY-MM"; until is open-ended when absent).
export type Fixed = { id: number; title: string; amount: number; categoryId: number; day: number; from: string; until?: string };
export type Expense = { id: number; title: string; amount: number; categoryId: number; date: string };
// Money that came in on `date`. A balance correction is an income row too (negative if the balance was lower than tracked).
export type Income = { id: number; title: string; amount: number; date: string };
export type Setting = { key: string; value: string };

export const db = new Dexie("vielgeld") as Dexie & {
  categories: EntityTable<Category, "id">;
  fixed: EntityTable<Fixed, "id">;
  expenses: EntityTable<Expense, "id">;
  income: EntityTable<Income, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  categories: "++id",
  fixed: "++id",
  expenses: "++id, date", // date is YYYY-MM-DD, so a month is a startsWith("YYYY-MM") query
  settings: "key",
});

// v2: salary and fixed payments become per-month so editing them no longer rewrites history.
db.version(2)
  .stores({ salaries: "month" })
  .upgrade(async (tx) => {
    const old = await tx.table("settings").get("salary");
    if (old) await tx.table("salaries").add({ month: "0000-00", amount: old.value });
    await tx.table("settings").delete("salary");
    await tx.table("fixed").toCollection().modify((f) => void (f.from = "0000-00"));
  });

// v3: no more automatic monthly salary; money in is logged as dated income. Old salary rows are dropped.
db.version(3).stores({ salaries: null, income: "++id, date" });

db.on("populate", (tx) => {
  tx.table("categories").bulkAdd(["Rent", "Subscriptions", "Groceries", "Other"].map((name) => ({ name })));
});
