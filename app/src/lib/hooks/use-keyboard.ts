"use client";

import { useEffect } from "react";

export function useKeyboard(
  keyboardMap: Record<string, string> | undefined,
  send: (type: string) => void
) {
  useEffect(() => {
    if (!keyboardMap || Object.keys(keyboardMap).length === 0) return;

    function handleKeydown(e: KeyboardEvent) {
      const eventType = keyboardMap![e.key];
      if (eventType) {
        e.preventDefault();
        send(eventType);
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [keyboardMap, send]);
}
