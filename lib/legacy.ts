import Dexie from "dexie";

// Fixed ids so every device seeds the same defaults instead of duplicating them once synced.
const DEFAULTS: Record<string, string> = { Rent: "cat-rent", Subscriptions: "cat-subscriptions", Groceries: "cat-groceries", Other: "cat-other" };
const TABLES = ["categories", "fixed", "expenses", "income", "settings"];

/** First run: copy the old numeric-id "vielgeld" database if there is one, else seed the default categories. */
export async function initData(db: Dexie) {
  if (await db.table("settings").get("init")) return;
  const rows = (await Dexie.exists("vielgeld")) ? await readLegacy() : null;
  await db.transaction("rw", TABLES, async () => {
    if (rows) await copy(db, rows);
    else await db.table("categories").bulkPut(Object.entries(DEFAULTS).map(([name, id]) => ({ id, name })));
    await db.table("settings").put({ key: "init", value: "1" });
  });
}

type Row = Record<string, any>;

async function readLegacy() {
  const old = new Dexie("vielgeld");
  await old.open();
  const read = (t: string): Promise<Row[]> => (old.tables.some((x) => x.name === t) ? old.table(t).toArray() : Promise.resolve([]));
  const rows = await Promise.all(TABLES.map(read));
  old.close(); // the old database stays on disk as a backup
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
}

async function copy(db: Dexie, old: Record<string, Row[]>) {
  const catIds = new Map(old.categories.map((c) => [c.id, DEFAULTS[c.name] ?? crypto.randomUUID()]));
  const fixedIds = new Map(old.fixed.map((f) => [f.id, crypto.randomUUID()]));
  await db.table("categories").bulkPut(old.categories.map((c) => ({ ...c, id: catIds.get(c.id) })));
  await db.table("fixed").bulkAdd(old.fixed.map((f) => ({ ...f, id: fixedIds.get(f.id), categoryId: catIds.get(f.categoryId) })));
  await db.table("expenses").bulkAdd(old.expenses.map((e) => ({ ...e, id: crypto.randomUUID(), categoryId: catIds.get(e.categoryId) })));
  await db.table("income").bulkAdd(old.income.map((i) => ({ ...i, id: crypto.randomUUID() })));
  // manual ticks are keyed "paid:YYYY-MM:<fixedId>", so the id inside has to follow the new one
  const settings = old.settings.flatMap((s) => {
    const [tag, month, id] = String(s.key).split(":");
    if (tag !== "paid") return [s];
    const next = fixedIds.get(Number(id));
    return next ? [{ ...s, key: `paid:${month}:${next}` }] : [];
  });
  await db.table("settings").bulkPut(settings);
}
