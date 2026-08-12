"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }, []);

  return null;
}
