"use client";

import { useEffect } from "react";

/** Registra o service worker (modo PWA para Smart TVs, tablets e mini PCs). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
