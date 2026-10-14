"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { addMonths, carryOver, fixedFor, summarize } from "@/lib/budget";
import { db } from "@/lib/db";
import { useMonth, useMonthData } from "@/lib/hooks";
import { fmt } from "@/lib/money";

const COLORS = [1, 2, 3, 4, 5].map((n) => `var(--chart-${n})`);
const money = (v: unknown) => fmt(Number(v) * 100); // chart data is in euros, fmt wants cents

export default function StatsPage() {
  const month = useMonth();
  const data = useMonthData(month);
  // Whole expense table is small (a student's year); group by month client-side.
  const all = useLiveQuery(() => db.expenses.toArray());
  if (!data || !all) return null;

  const { categories, fixed, expenses, income, allIncome, carry, paid } = data;
  const s = summarize(month, fixed, expenses, income, new Date(), carry, paid);
  const budget = s.income + carry; // what the month can spend, so the line chart's reference includes the rollover

  const cats = s.byCategory
    .map(([id, cents]) => ({ name: categories.find((c) => c.id === id)?.name ?? "?", value: cents / 100 }))
    .sort((a, b) => b.value - a.value)
    .map((c, i) => ({ ...c, fill: COLORS[i % COLORS.length] }));

  const months = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11)).map((m) => ({
    month: m.slice(2),
    spent:
      (fixedFor(fixed, m).reduce((t, f) => t + f.amount, 0) +
        all.filter((e) => e.date.startsWith(m)).reduce((t, e) => t + e.amount, 0)) /
      100,
    income: allIncome.filter((i) => i.date.startsWith(m)).reduce((t, i) => t + i.amount, 0) / 100,
    balance: carryOver(addMonths(m, 1), fixed, all, allIncome) / 100, // end of month
  }));
  const yMax = (vals: number[]) => Math.max(...vals, 1);

  const empty = !cats.length;
  const cfg = {
    value: { label: "Amount" },
    total: { label: "Spent", color: COLORS[0] },
    spent: { label: "Spent", color: COLORS[0] },
    income: { label: "Income", color: COLORS[2] },
    balance: { label: "Balance", color: COLORS[1] },
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="text-sm text-muted-foreground">No data this month.</p>
          ) : (
            <>
              <ChartContainer config={cfg} className="mx-auto aspect-square max-h-56">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, n) => `${n}: ${money(v)}`} />} />
                  <Pie data={cats} dataKey="value" nameKey="name" innerRadius="55%" stroke="none">
                    {cats.map((c) => (
                      <Cell key={c.name} fill={c.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-3 space-y-1">
                {cats.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.fill }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0">{money(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending through the month</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={cfg} className="h-48 w-full">
            <LineChart data={s.daily.map((d) => ({ day: d.day, total: d.total / 100 }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} interval={4} />
              <YAxis hide domain={[0, yMax([budget / 100, s.daily.at(-1)!.total / 100])]} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(v)} />} />
              {budget > 0 && <ReferenceLine y={budget / 100} strokeDasharray="4 4" label={{ value: "Budget", position: "insideTopLeft", fontSize: 11 }} />}
              <Line dataKey="total" type="stepAfter" stroke="var(--color-total)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={cfg} className="h-48 w-full">
            <ComposedChart data={months}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} tickFormatter={(m: string) => m.slice(3)} />
              <YAxis hide domain={[(lo: number) => Math.min(lo, 0), (hi: number) => Math.max(hi, 1)]} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: ${money(v)}`} />} />
              <Bar dataKey="spent" fill="var(--color-spent)" radius={3} />
              <Bar dataKey="income" fill="var(--color-income)" radius={3} />
              <Line dataKey="balance" type="monotone" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
