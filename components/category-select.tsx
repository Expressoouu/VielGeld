import type { Category } from "@/lib/db";

// Native select: accessible, mobile-friendly, and styled to match <Input>.
export function CategorySelect({
  categories,
  ...props
}: { categories: Category[] } & React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
    >
      {categories.map((c) => (
        <option key={c.id} value={c.id} className="bg-background">
          {c.name}
        </option>
      ))}
    </select>
  );
}
