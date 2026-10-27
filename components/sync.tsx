"use client";

import { useObservable } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

// Only rendered when NEXT_PUBLIC_DEXIE_CLOUD_URL is set (see the Plan page).
export function Sync() {
  const user = useObservable(db.cloud.currentUser);
  return user?.isLoggedIn ? (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-sm">{user.email}</span>
      <Button className="shrink-0" variant="outline" onClick={() => db.cloud.logout()}>
        Sign out
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={() => db.cloud.login()}>
      Sign in to sync
    </Button>
  );
}
