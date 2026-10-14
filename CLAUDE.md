# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

VielGeld is a minimal budget PWA for one person: a running balance with dated income, fixed monthly payments, quick expense logging by category, and per-month stats. All data lives in the browser (IndexedDB); there is no backend.

## Commands

```bash
pnpm dev                          # dev server (service worker is NOT registered in dev)
pnpm build                        # static export to out/ (also type-checks)
npx serve out                     # preview the production build; needed to test PWA/offline
pnpm lint
node --test lib/                  # unit tests (Node strips TS types natively, no runner install)
node --test --test-name-pattern="toCents" lib/   # single test
```

Add shadcn components with `pnpm dlx shadcn@latest add <name>`.

## Next.js version caveat

This is Next 16 with breaking changes from older versions (see `AGENTS.md`). Check `node_modules/next/dist/docs/` before using a Next API you are unsure about.

## Architecture

- **Static export** (`output: "export"` in `next.config.ts`). No server components with dynamic data, no route handlers, no `cacheComponents` (the scaffold default was removed because this app is fully client-side). Every page is `"use client"` and reads from IndexedDB.
- **Selected month lives in the URL** as `?m=YYYY-MM`, read by `useMonth()` in `lib/hooks.ts` (falls back to the current month). `components/shell.tsx` builds all nav and month-arrow links with the param so it survives navigation. `useSearchParams` requires the `<Suspense>` boundary around `<Shell>` in `app/layout.tsx`; keep it or the static build fails.
- **Data layer**: `lib/db.ts` is the Dexie schema (`categories`, `fixed`, `expenses`, `income`, `settings`). Pages read through `useLiveQuery` (`useMonthData` in `lib/hooks.ts`), so writes via `db.*` update the UI with no state plumbing. The first-run `populate` hook seeds the default categories.
- **Pure logic**: `lib/budget.ts` (`summarize`, month helpers) has no React/Dexie imports (type-only import from `db.ts`) so `node --test` can run it. Keep it that way, and import with explicit `.ts` extensions in `lib/` files that tests touch (`allowImportingTsExtensions` is on).
- **Money is integer cents everywhere** in storage and logic. Convert only at the edges: `toCents` (input) and `fmt` (display) in `lib/money.ts`. Chart data in `app/stats/page.tsx` is converted to euros because Recharts wants plain numbers.
- **History is per-month, not overwritten.** A fixed payment is active from `from` through optional `until` (`fixedFor` in `lib/budget.ts`); editing or deleting one at month M ends the old entry at M-1 and (for edits) adds a new one from M, so earlier months keep their numbers. Income is not recurring: nothing is credited automatically. Money in is a dated `income` row (v3 dropped `salaries`); the Plan tab's "Current balance" just adds a "Balance correction" income row for the difference. `summarize` takes *all* fixed payments and filters itself; a due day like 31 is clamped to the last day of shorter months. Schema changes need a new `db.version(n)` with an `upgrade` (v2 migrated the old single fixed rows to `"0000-00"`).
- **Fixed payments are not auto-deducted.** `isPaid` (`lib/budget.ts`) counts one once its due day has passed (earlier months: always) or it was ticked by hand; manual ticks are `settings` rows `paid:YYYY-MM:<fixedId>`, read into `paid` by `useMonthData` and passed to `summarize(..., carry, paid)`. Only paid ones reduce `remaining`; unpaid ones reduce safe-per-day. The home page's "Upcoming payments" card does the ticking behind a lock that re-locks after each tick. Editing a fixed payment mid-month gives it a new id, so a manual tick on it is lost.
- **Rollover**: `carryOver` (`lib/budget.ts`) sums every earlier month's income − fixed − expenses starting at the first month with real data (first expense, income, or fixed entry that isn't the migrated `"0000-00"`). It is the balance at the start of the month, computed on the fly, never stored, in `useMonthData` (which therefore loads all expenses and income), and passed to `summarize(month, fixed, expenses, income, today, carry)` so `remaining` and safe-per-day include it. Future months project forward with fixed payments only. The stats 12-month chart plots income, spent and end-of-month balance.
- **Currency** is a setting (`settings` table, default EUR). `useMonthData` calls `setCurrency` before returning data, so the module-level `fmt` in `lib/money.ts` is always current; number formatting uses the browser locale.
- **Backup**: `components/backup.tsx` mirrors the WorkoutLog repo: Export downloads every Dexie table as pretty JSON; Import picks a file, then a red "Restore <file>" button opens a confirm `AlertDialog` before all data is replaced. The shadcn `AlertDialogAction` does not close the dialog by itself in this base-nova version, so the dialog's `open` state is controlled. This is the only way to move data between devices; there is no sync.
- **Dates** are `YYYY-MM-DD` strings; a month is fetched with `where("date").startsWith(month)`. Use `isoDate` (local time), not `toISOString`, to avoid timezone off-by-one.
- **UI conventions**: shadcn `base-nova` style (Base UI primitives, not Radix, so use `render`, not `asChild`). Category pickers are a native `<select>` (`components/category-select.tsx`) on purpose. Monospace font (JetBrains Mono) is wired via `--font-body` in `app/layout.tsx` and `--font-sans` in `app/globals.css`; monospace is wide, so give flex rows `min-w-0`/`truncate` on text and `shrink-0` on amounts and buttons. Turbopack can serve stale CSS after edits to `globals.css`: `rm -rf .next out` and rebuild if a style change does not show up. Dark mode is class-based via `next-themes`.
- **Tab swipe**: `components/shell.tsx` listens for touch gestures on the whole page and uses `swipeStep` (`lib/swipe.ts`, same thresholds as the WorkoutLog repo) to move between the bottom tabs; swipes starting on inputs are ignored. Page content in the shell is remounted via `key` on tab/month change so a `tw-animate-css` fade + slide-in plays (direction derived from tab order or month order, computed during render). Bottom-nav and header safe-area padding only work because `app/layout.tsx` sets `viewportFit: "cover"`.
- **PWA**: hand-written `public/sw.js` (network-first, cache fallback with `ignoreSearch` since all `?m=` URLs are the same file), `public/manifest.webmanifest`, registered only in production by `components/sw-register.tsx`. Bump `CACHE` in `sw.js` if you change its strategy.
