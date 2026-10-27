import Dexie, { type EntityTable } from "dexie";
import dexieCloud from "dexie-cloud-addon";
import { initData } from "./legacy";

// Ids are random strings: Dexie Cloud can't sync auto-increment numbers, and "id" would force its own "ctg…" prefixes on custom ids.
export const newId = () => crypto.randomUUID();
export type Category = { id: string; name: string };
// A fixed payment is active in every month from `from` through `until` (both "YYYY-MM"; until is open-ended when absent).
export type Fixed = { id: string; title: string; amount: number; categoryId: string; day: number; from: string; until?: string };
export type Expense = { id: string; title: string; amount: number; categoryId: string; date: string };
// Money that came in on `date`. A balance correction is an income row too (negative if the balance was lower than tracked).
export type Income = { id: string; title: string; amount: number; date: string };
export type Setting = { key: string; value: string };

// "vielgeld2" replaces the old numeric-id "vielgeld" database; see lib/legacy.ts.
export const db = new Dexie("vielgeld2", { addons: [dexieCloud] }) as Dexie & {
  categories: EntityTable<Category, "id">;
  fixed: EntityTable<Fixed, "id">;
  expenses: EntityTable<Expense, "id">;
  income: EntityTable<Income, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  categories: "id",
  fixed: "id",
  expenses: "id, date", // date is YYYY-MM-DD, so a month is a startsWith("YYYY-MM") query
  income: "id, date",
  settings: "key",
});

// Without a URL the app stays local-only. requireAuth false: works signed out, syncs once signed in.
const cloudUrl = process.env.NEXT_PUBLIC_DEXIE_CLOUD_URL;
if (cloudUrl) db.cloud.configure({ databaseUrl: cloudUrl, requireAuth: false });

db.on("ready", initData);
