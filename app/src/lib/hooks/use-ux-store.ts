"use client";

import { useSyncExternalStore, useMemo, useCallback } from "react";
import type { CompiledUXSpec, UXSnapshot, UXStore } from "../types";
import { createStore } from "../engine/interpreter";

export function useUXStore(spec: CompiledUXSpec): {
  snapshot: UXSnapshot;
  send: UXStore["send"];
  forceState: UXStore["forceState"];
  store: UXStore;
} {
  const store = useMemo(() => createStore(spec), [spec]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { snapshot, send: store.send, forceState: store.forceState, store };
}
