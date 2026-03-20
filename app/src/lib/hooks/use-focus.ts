"use client";

import { useEffect } from "react";

export function useFocus(
  onEnter: Record<string, any> | undefined,
  statePath: string
) {
  useEffect(() => {
    if (!onEnter?.focus) return;
    const target = onEnter.focus as string;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-testid="${target}"], [name="${target}"]`
      );
      el?.focus();
    });
  }, [statePath, onEnter?.focus]);
}
