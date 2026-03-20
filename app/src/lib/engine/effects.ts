import type { Json, EffectSpec } from "../types";

export interface TimerMap {
  set(id: string, handle: ReturnType<typeof setTimeout>): void;
  cancel(id: string): void;
  cancelAll(): void;
}

export function createTimerMap(): TimerMap {
  const map = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    set(id: string, handle: ReturnType<typeof setTimeout>): void {
      // Cancel any existing timer with the same id before replacing
      const existing = map.get(id);
      if (existing != null) {
        clearTimeout(existing);
      }
      map.set(id, handle);
    },

    cancel(id: string): void {
      const handle = map.get(id);
      if (handle != null) {
        clearTimeout(handle);
        map.delete(id);
      }
    },

    cancelAll(): void {
      for (const handle of map.values()) {
        clearTimeout(handle);
      }
      map.clear();
    },
  };
}

export function scheduleEffect(
  effect: EffectSpec,
  send: (type: string, payload?: Record<string, Json>) => void,
  timers: TimerMap
): void {
  switch (effect.kind) {
    case "timer.start": {
      if (!effect.id || !effect.event || effect.ms == null) break;
      const handle = setTimeout(() => send(effect.event!), effect.ms);
      timers.set(effect.id, handle);
      break;
    }

    case "timer.cancel": {
      if (!effect.id) break;
      timers.cancel(effect.id);
      break;
    }

    case "focus": {
      if (!effect.target) break;
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-testid="${effect.target}"]`)
          ?.focus();
      });
      break;
    }

    case "navigate": {
      console.log("[uxspec] navigate ->", effect.to);
      break;
    }

    case "http": {
      console.log("[uxspec] http request:", effect.request);
      break;
    }

    case "storage.write": {
      if (!effect.key) break;
      try {
        localStorage.setItem(effect.key, JSON.stringify(effect.value));
      } catch {
        // storage may be unavailable (SSR, quota exceeded, etc.)
      }
      break;
    }
  }
}
