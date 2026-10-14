"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Backup } from "@/components/backup";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addMonths, fixedFor, isoDate, summarize } from "@/lib/budget";
import { db, type Fixed } from "@/lib/db";
import { useMonth, useMonthData } from "@/lib/hooks";
import { CURRENCIES, fmt, toCents } from "@/lib/money";

export default function PlanPage() {
  const month = useMonth();
  const data = useMonthData(month);
  const [editing, setEditing] = useState<Fixed | null>(null);
  if (!data) return null;
  const { categories, fixed, expenses, income, carry, paid, currency } = data;
  const left = summarize(month, fixed, expenses, income, new Date(), carry, paid).remaining;

  const form = (fn: (v: FormData) => Promise<unknown> | string | void) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const err = await fn(new FormData(f));
    if (typeof err === "string") return toast.error(err);
    f.reset();
  };

  // Logs the difference as income, so history stays intact and the balance rolls forward from here.
  const saveBalance = form(async (v) => {
    const target = toCents(String(v.get("balance")));
    if (Number.isNaN(target)) return "Enter a valid balance";
    const today = isoDate(new Date());
    if (target === left) return;
    await db.income.add({ title: "Balance correction", amount: target - left, date: today.startsWith(month) ? today : `${month}-01` });
    toast.success("Balance saved");
  });

  // Ending an entry (edit or delete) never touches earlier months: it stops the day before the selected month.
  const endFixed = (f: Fixed) => (f.from >= month ? db.fixed.delete(f.id) : db.fixed.update(f.id, { until: addMonths(month, -1) }));

  const saveFixed = form(async (v) => {
    const title = String(v.get("title")).trim();
    const amount = toCents(String(v.get("amount")));
    const day = Number(v.get("day"));
    if (!title || !(amount > 0) || !(day >= 1 && day <= 31)) return "Need a title, an amount above 0 and a day 1–31";
    if (editing) await endFixed(editing);
    await db.fixed.add({ title, amount, day, categoryId: Number(v.get("category")), from: month, until: editing?.until });
    setEditing(null);
  });

  const addCategory = form(async (v) => {
    const name = String(v.get("name")).trim();
    if (name) await db.categories.add({ name });
  });

  async function removeCategory(id: number) {
    const used = (await db.fixed.where({ categoryId: id }).count()) + (await db.expenses.filter((e) => e.categoryId === id).count());
    if (used) return toast.error("Category is in use");
    await db.categories.delete(id);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Current balance</CardTitle>
          <p className="text-xs text-muted-foreground">What you have left in {month}. Saving adds a correction to income; it rolls into next month.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveBalance} className="flex gap-2">
            <Input key={`${month}-${left}`} name="balance" inputMode="decimal" defaultValue={left ? left / 100 : ""} placeholder="0,00" />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fixed payments</CardTitle>
          <p className="text-xs text-muted-foreground">Changes and deletions apply from this month onward; earlier months keep their numbers.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixedFor(fixed, month).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate">{f.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  day {f.day} · {categories.find((c) => c.id === f.categoryId)?.name}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                {fmt(f.amount)}
                <Button variant="ghost" size="icon" aria-label={`Edit ${f.title}`} onClick={() => setEditing(f)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${f.title}`}
                  onClick={() => {
                    if (editing?.id === f.id) setEditing(null);
                    endFixed(f);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </div>
          ))}
          <form key={`${month}-${editing?.id ?? "new"}`} onSubmit={saveFixed} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <Input name="title" placeholder="Title (e.g. Rent)" className="col-span-2" autoComplete="off" defaultValue={editing?.title} />
            <Input name="amount" placeholder="Amount" inputMode="decimal" autoComplete="off" defaultValue={editing ? editing.amount / 100 : undefined} />
            <Input name="day" placeholder="Day (1–31)" inputMode="numeric" autoComplete="off" defaultValue={editing?.day} />
            <CategorySelect name="category" categories={categories} defaultValue={editing?.categoryId} />
            <div className="col-span-2 flex min-w-0 gap-2">
              <Button type="submit" className="min-w-0 flex-1 px-2">
                {editing ? "Save" : "Add"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map((c) => (
            <div key={`${c.id}-${c.name}`} className="flex gap-2">
              <Input
                defaultValue={c.name}
                aria-label="Category name"
                onBlur={(e) => db.categories.update(c.id, { name: e.target.value.trim() || c.name })}
              />
              <Button className="shrink-0" variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => removeCategory(c.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <form onSubmit={addCategory} className="flex gap-2">
            <Input name="name" placeholder="New category" autoComplete="off" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={currency}
            onChange={(e) => db.settings.put({ key: "currency", value: e.target.value })}
            aria-label="Currency"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} className="bg-background">
                {c}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>Data lives only on this device. Export regularly.</CardDescription>
        </CardHeader>
        <CardContent>
          <Backup />
        </CardContent>
      </Card>
    </>
  );
}
