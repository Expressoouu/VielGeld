"use client";

import { Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { daysIn, fixedFor, isoDate, isPaid, summarize } from "@/lib/budget";
import { db, type Expense } from "@/lib/db";
import { useMonth, useMonthData } from "@/lib/hooks";
import { fmt, toCents } from "@/lib/money";

export default function MonthPage() {
  const month = useMonth();
  const data = useMonthData(month);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [unlocked, setUnlocked] = useState(false); // ticking a payment needs an unlock first, and it re-locks after each tick
  if (!data) return null;

  const { categories, fixed, expenses, income, carry, paid } = data;
  const s = summarize(month, fixed, expenses, income, new Date(), carry, paid);
  const due = fixedFor(fixed, month).sort((a, b) => a.day - b.day);
  const name = (id: number) => categories.find((c) => c.id === id)?.name ?? "?";
  const today = isoDate(new Date());
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = new FormData(f);
    const title = String(v.get("title")).trim();
    const amount = toCents(String(v.get("amount")));
    if (!title || !(amount > 0)) return toast.error("Enter a title and an amount above 0");
    const row = { title, amount, categoryId: Number(v.get("category")), date: String(v.get("date")) };
    if (editing) {
      await db.expenses.update(editing.id, row);
      return setEditing(null); // changes the form key, which remounts it empty
    }
    await db.expenses.add(row);
    f.reset();
    (f.elements.namedItem("title") as HTMLInputElement).focus();
  }

  async function togglePaid(id: number, isOn: boolean) {
    const key = `paid:${month}:${id}`;
    await (isOn ? db.settings.delete(key) : db.settings.put({ key, value: "1" }));
    setUnlocked(false);
  }

  async function addIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = new FormData(f);
    const title = String(v.get("title")).trim();
    const amount = toCents(String(v.get("amount")));
    if (!title || !(amount > 0)) return toast.error("Enter a source and an amount above 0");
    await db.income.add({ title, amount, date: String(v.get("date")) });
    f.reset();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Income", s.income],
          ["Fixed", s.fixedTotal],
          ["Spent", s.variableTotal],
          ["Left", s.remaining],
        ].map(([label, v]) => (
          <Card key={label} size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className={`text-lg font-semibold ${label === "Left" && s.remaining < 0 ? "text-destructive" : ""}`}>
                {fmt(v as number)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {due.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Upcoming payments</CardTitle>
            <CardAction>
              <Button variant="ghost" size="icon" aria-label={unlocked ? "Lock payments" : "Unlock to tick payments"} onClick={() => setUnlocked(!unlocked)}>
                {unlocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {due.map((f) => {
              const done = isPaid(f, month, new Date(), paid);
              const auto = done && !paid.has(f.id); // date passed: can't be un-ticked
              return (
                <label key={f.id} className={`flex items-center gap-2 ${done ? "text-muted-foreground line-through" : ""}`}>
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={done}
                    disabled={!unlocked || auto}
                    onChange={() => togglePaid(f.id, done)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.title}</span>
                    <span className="block text-xs">due {Math.min(f.day, daysIn(month))}.</span>
                  </span>
                  <span className="shrink-0">{fmt(f.amount)}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}
      {carry !== 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Carried over: <b className={carry < 0 ? "text-destructive" : "text-foreground"}>{fmt(carry)}</b>
        </p>
      )}
      {s.safePerDay !== null && (
        <p className="text-center text-sm text-muted-foreground">
          Safe to spend: <b className="text-foreground">{fmt(s.safePerDay)}</b> / day
        </p>
      )}
      {!carry && !income.length && !expenses.length && (
        <p className="text-center text-sm text-muted-foreground">Set your current balance on the Plan tab.</p>
      )}

      {/* key remounts the form when switching between add/edit or months so defaults reset */}
      <form key={`${month}-${editing?.id ?? "new"}`} onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <Input name="title" placeholder="What?" className="col-span-2" autoComplete="off" defaultValue={editing?.title} />
        <Input
          name="amount"
          placeholder="Amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={editing ? editing.amount / 100 : undefined}
        />
        <CategorySelect name="category" categories={categories} defaultValue={editing?.categoryId ?? categories.at(-1)?.id} />
        <Input name="date" type="date" className="col-span-2 min-w-0 appearance-none text-left" defaultValue={editing?.date ?? defaultDate} />
        <div className="col-span-2 flex min-w-0 gap-2">
          <Button type="submit" className="min-w-0 flex-1 px-2">
            {editing ? "Save" : "Add expense"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...income]
            .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
            .map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.date.slice(8)}.</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {fmt(i.amount)}
                  <Button variant="ghost" size="icon" aria-label={`Delete ${i.title}`} onClick={() => db.income.delete(i.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          <form key={`${month}-income`} onSubmit={addIncome} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <Input name="title" placeholder="Source (e.g. Salary)" className="col-span-2" autoComplete="off" />
            <Input name="amount" placeholder="Amount" inputMode="decimal" autoComplete="off" />
            <Input name="date" type="date" className="min-w-0 appearance-none text-left" defaultValue={defaultDate} />
            <Button type="submit" className="col-span-2">
              Add income
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...expenses]
            .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.date.slice(8)}. · {name(e.categoryId)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {fmt(e.amount)}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${e.title}`}
                    onClick={() => {
                      setEditing(e);
                      window.scrollTo({ top: 0 });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${e.title}`}
                    onClick={() => {
                      if (editing?.id === e.id) setEditing(null);
                      db.expenses.delete(e.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          {!expenses.length && <p className="text-sm text-muted-foreground">Nothing yet this month.</p>}
        </CardContent>
      </Card>

    </>
  );
}
