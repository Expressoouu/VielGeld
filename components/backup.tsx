"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { isoDate } from "@/lib/budget";
import { db } from "@/lib/db";

async function exportData() {
  const dump = Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()])));
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `vielgeld-${isoDate(new Date())}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// Replaces all data with the backup's contents.
async function importData(file: File) {
  const dump = JSON.parse(await file.text());
  // a table missing from the file (e.g. income in a pre-v3 backup) just ends up empty
  if (!Array.isArray(dump?.expenses) || !db.tables.every((t) => dump?.[t.name] === undefined || Array.isArray(dump[t.name]))) throw new Error("Not a valid backup file");
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      await t.bulkAdd(dump[t.name] ?? []);
    }
  });
}

export function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const restore = async () => {
    try {
      await importData(pending!);
      toast.success("Backup restored");
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : err}`);
    }
    setOpen(false);
    setPending(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportData}>
        <Download />
        Export
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload />
        Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          setPending(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {pending && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" className="max-w-full min-w-0" />}>
            <span className="truncate">Restore {pending.name}</span>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace all data?</AlertDialogTitle>
              <AlertDialogDescription>Everything on this device will be replaced with {pending.name}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={restore}>
                Replace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
