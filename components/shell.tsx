"use client";

import { BarChart3, ChevronLeft, ChevronRight, ListChecks, Moon, Receipt, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addMonths } from "@/lib/budget";
import { useMonth } from "@/lib/hooks";
import { swipeStep } from "@/lib/swipe";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const tabs = [
  { href: "/", label: "Month", Icon: Receipt },
  { href: "/plan", label: "Plan", Icon: ListChecks },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const month = useMonth();
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  const go = (href: string, mo = month) => `${href}?m=${mo}`;

  // Slide direction for the page-change animation, derived during render from what changed:
  // switching tabs follows tab order, stepping months follows time (>0 = came from the right).
  const idx = tabs.findIndex((t) => t.href === path);
  const [nav, setNav] = useState({ path, month, idx, dir: 0 });
  if (nav.path !== path || nav.month !== month) {
    setNav({ path, month, idx, dir: nav.path !== path ? Math.sign(idx - nav.idx) : month > nav.month ? 1 : -1 });
  }

  // Swipe left/right anywhere on the page to move between tabs (not when starting on a form field, so text selection still works).
  const router = useRouter();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const onField = (e.target as HTMLElement).closest("input, select, textarea");
    touch.current = e.touches.length === 1 && !onField ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = touch.current;
    touch.current = null;
    if (!t0) return;
    const step = swipeStep(e.changedTouches[0].clientX - t0.x, e.changedTouches[0].clientY - t0.y);
    const next = tabs[tabs.findIndex((t) => t.href === path) + step];
    if (step && next) router.push(go(next.href));
  };

  return (
    // flex-1 main below, so the whole screen is swipeable, not just the content.
    <div className="flex min-h-dvh touch-pan-y flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="sticky top-0 z-10 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 p-2">
          <div className="flex min-w-0 items-center">
            <Link href={go(path, addMonths(month, -1))} aria-label="Previous month" className="shrink-0 p-2">
              <ChevronLeft className="size-5" />
            </Link>
            <span className="w-40 truncate text-center font-semibold">{label}</span>
            <Link href={go(path, addMonths(month, 1))} aria-label="Next month" className="shrink-0 p-2">
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {/* Remounting on tab/month change replays the slide-in, like WorkoutLog's day swipe. */}
        <div
          key={`${path}${month}`}
          className={cn(
            "animate-in space-y-6 fade-in duration-200 motion-reduce:animate-none",
            nav.dir > 0 && "slide-in-from-right-8",
            nav.dir < 0 && "slide-in-from-left-8",
          )}
        >
          {children}
        </div>
      </main>
      {/* Same bar as WorkoutLog: equal-width tabs, 10px uppercase labels, accent bar on the current tab. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {tabs.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={go(href)}
              aria-current={path === href ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground",
                path === href && "text-primary before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:bg-primary",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
