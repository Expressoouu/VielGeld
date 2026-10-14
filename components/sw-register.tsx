"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    navigator.storage?.persist?.(); // ask the browser not to evict IndexedDB under storage pressure
    if (process.env.NODE_ENV === "production") navigator.serviceWorker?.register("/sw.js");
  }, []);
  return null;
}
