import type { Json, ActionSpec, EffectSpec, ExprEnv } from "../types";
import { evalExpr } from "./eval-expr";

/**
 * Deep-clone a JSON-compatible value.
 */
function cloneJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneJson) as unknown as T;
  const out: Record<string, any> = {};
  for (const key of Object.keys(value as Record<string, any>)) {
    out[key] = cloneJson((value as Record<string, any>)[key]);
  }
  return out as T;
}

/**
 * Set a value at a dot-separated path on an object, creating intermediate
 * objects as needed. Mutates `obj` in place.
 */
function setPath(obj: Record<string, any>, path: string, value: Json): void {
  const segments = path.split(".");
  let current: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] == null || typeof current[seg] !== "object") {
      current[seg] = {};
    }
    current = current[seg];
  }
  current[segments[segments.length - 1]] = value;
}

/**
 * Check whether an action/effect object is an ActionSpec (assign | emit | log)
 * rather than an EffectSpec.
 */
function isActionSpec(item: ActionSpec | EffectSpec): item is ActionSpec {
  return (
    item.kind === "assign" || item.kind === "emit" || item.kind === "log"
  );
}

/**
 * Execute a list of actions against the current context and event, returning
 * the (potentially updated) context and any emitted event names.
 *
 * Only ActionSpec items (assign / emit / log) are processed here.
 * EffectSpec items are silently skipped — they should be handled by
 * `scheduleEffect` in the effects module.
 */
export function executeActions(
  actions: Array<ActionSpec | EffectSpec>,
  context: Record<string, Json>,
  event: Record<string, Json> | null
): { context: Record<string, Json>; emitted: string[] } {
  let ctx = cloneJson(context);
  const emitted: string[] = [];

  const env: ExprEnv = { context: ctx, event };

  for (const action of actions) {
    if (!isActionSpec(action)) continue;

    switch (action.kind) {
      case "assign": {
        if (!action.path || action.value === undefined) break;
        // Paths always start with "context." — strip that prefix
        const rawPath = action.path.startsWith("context.")
          ? action.path.slice("context.".length)
          : action.path;
        const resolved = evalExpr(action.value, env);
        setPath(ctx, rawPath, resolved);
        // Keep the env in sync so later actions see updated values
        env.context = ctx;
        break;
      }

      case "emit": {
        if (action.event) {
          emitted.push(action.event);
        }
        break;
      }

      case "log": {
        const level = (action.level ?? "info") as
          | "debug"
          | "info"
          | "warn"
          | "error";
        const msg = action.message ?? "";
        console[level]("[uxspec]", msg);
        break;
      }
    }
  }

  return { context: ctx, emitted };
}
