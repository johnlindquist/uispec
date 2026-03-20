"use client";

import { useEffect } from "react";
import type { Json } from "../types";

function extractMs(autoDismiss: Json): number | null {
  if (typeof autoDismiss === "number") return autoDismiss;
  if (
    autoDismiss &&
    typeof autoDismiss === "object" &&
    !Array.isArray(autoDismiss) &&
    "value" in autoDismiss
  ) {
    return (autoDismiss as any).value as number;
  }
  return null;
}

export function useAutoDismiss(
  autoDismiss: Json | undefined,
  statePath: string,
  send: (type: string) => void
) {
  useEffect(() => {
    if (!autoDismiss) return;
    const ms = extractMs(autoDismiss);
    if (ms == null || ms <= 0) return;

    const handle = setTimeout(() => {
      send("AUTO_DISMISS");
    }, ms);
    return () => clearTimeout(handle);
  }, [statePath, autoDismiss, send]);
}
