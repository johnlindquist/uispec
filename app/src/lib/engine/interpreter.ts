import type {
  Json,
  ActionSpec,
  EffectSpec,
  CompiledUXSpec,
  UXSnapshot,
  UXStore,
  ExprEnv,
} from "../types";
import { evalExpr } from "./eval-expr";
import { executeActions } from "./actions";
import { scheduleEffect, createTimerMap, type TimerMap } from "./effects";

const MAX_ALWAYS_ITERATIONS = 10;
const AUTODISMISS_TIMER_ID = "__uxspec_autoDismiss";

/**
 * Check whether an action/effect entry is an EffectSpec (not an ActionSpec).
 */
function isEffectSpec(item: ActionSpec | EffectSpec): item is EffectSpec {
  return (
    item.kind !== "assign" && item.kind !== "emit" && item.kind !== "log"
  );
}

/**
 * Partition a mixed action/effect list into separate arrays.
 */
function partition(
  items: Array<ActionSpec | EffectSpec>
): { actions: ActionSpec[]; effects: EffectSpec[] } {
  const actions: ActionSpec[] = [];
  const effects: EffectSpec[] = [];
  for (const item of items) {
    if (isEffectSpec(item)) {
      effects.push(item);
    } else {
      actions.push(item);
    }
  }
  return { actions, effects };
}

/**
 * Build the initial context from the contextSchema defaults.
 */
function buildInitialContext(
  schema: CompiledUXSpec["contextSchema"]
): Record<string, Json> {
  const ctx: Record<string, Json> = {};
  for (const [key, field] of Object.entries(schema)) {
    ctx[key] = field.default ?? null;
  }
  return ctx;
}

export function createStore(spec: CompiledUXSpec): UXStore {
  let context: Record<string, Json> = buildInitialContext(spec.contextSchema);
  let statePath: string = spec.initial;
  const timers: TimerMap = createTimerMap();
  const listeners = new Set<() => void>();

  // ── Helpers ──

  function currentState() {
    return spec.states[statePath];
  }

  function notify(): void {
    cachedSnapshot = buildSnapshot();
    for (const listener of listeners) {
      listener();
    }
  }

  function buildEnv(
    event: Record<string, Json> | null
  ): ExprEnv {
    return { context, event };
  }

  /**
   * Run a list of entry/exit items: execute ActionSpecs for context changes,
   * schedule EffectSpecs for side effects. Returns emitted event names.
   */
  function runItems(
    items: Array<ActionSpec | EffectSpec>,
    event: Record<string, Json> | null
  ): string[] {
    const { actions, effects } = partition(items);

    // Execute pure actions
    const result = executeActions(actions, context, event);
    context = result.context;

    // Schedule effects
    for (const effect of effects) {
      scheduleEffect(effect, send, timers);
    }

    return result.emitted;
  }

  /**
   * Enter a state: run its entry actions/effects and set up autoDismiss.
   */
  function enterState(event: Record<string, Json> | null): string[] {
    const state = currentState();
    if (!state) return [];

    const emitted = runItems(state.entry, event);

    // autoDismiss: schedule a timer to fire the first available transition
    if (state.visual?.autoDismiss != null) {
      const ms = state.visual.autoDismiss;
      if (typeof ms === "number" && ms > 0) {
        // Find the first non-null-event transition to use as the dismiss event,
        // or fall back to a synthetic DISMISS event
        const dismissTransition = state.transitions.find(
          (t) => t.event != null
        );
        const dismissEvent = dismissTransition?.event ?? "DISMISS";
        const handle = setTimeout(() => send(dismissEvent), ms);
        timers.set(AUTODISMISS_TIMER_ID, handle);
      }
    }

    return emitted;
  }

  /**
   * Exit the current state: run exit actions/effects.
   */
  function exitState(event: Record<string, Json> | null): string[] {
    const state = currentState();
    if (!state) return [];
    timers.cancel(AUTODISMISS_TIMER_ID);
    return runItems(state.exit, event);
  }

  /**
   * Process always (eventless) transitions up to MAX_ALWAYS_ITERATIONS.
   */
  function processAlwaysTransitions(
    event: Record<string, Json> | null
  ): string[] {
    const allEmitted: string[] = [];

    for (let i = 0; i < MAX_ALWAYS_ITERATIONS; i++) {
      const state = currentState();
      if (!state) break;

      const alwaysTransition = state.transitions.find((t) => {
        if (t.event !== null) return false;
        if (t.guard != null) {
          return !!evalExpr(t.guard, buildEnv(event));
        }
        return true;
      });

      if (!alwaysTransition) break;

      // Exit current state
      allEmitted.push(...exitState(event));

      // Run transition actions
      const { actions: tActions, effects: tEffects } = partition(
        alwaysTransition.actions
      );
      const tResult = executeActions(tActions, context, event);
      context = tResult.context;
      allEmitted.push(...tResult.emitted);
      for (const eff of tEffects) {
        scheduleEffect(eff, send, timers);
      }

      // Move to target
      statePath = alwaysTransition.target;

      // Enter new state
      allEmitted.push(...enterState(event));
    }

    return allEmitted;
  }

  // ── Cached snapshot (must be referentially stable for useSyncExternalStore) ──

  let cachedSnapshot: UXSnapshot = buildSnapshot();

  function buildSnapshot(): UXSnapshot {
    const state = currentState();
    return {
      statePath,
      context: { ...context },
      visual: state?.visual ?? {},
      transitions: state?.transitions ?? [],
    };
  }

  // ── Public API ──

  function getSnapshot(): UXSnapshot {
    return cachedSnapshot;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function send(type: string, payload?: Record<string, Json>): void {
    const state = currentState();
    if (!state) return;

    const event: Record<string, Json> = { type: type as Json, ...(payload ?? {}) };

    // Find the first matching transition for this event
    const transition = state.transitions.find((t) => {
      if (t.event !== type) return false;
      if (t.guard != null) {
        return !!evalExpr(t.guard, buildEnv(event));
      }
      return true;
    });

    if (!transition) return;

    // 1. Exit current state
    const exitEmitted = exitState(event);

    // 2. Run transition actions
    const { actions: tActions, effects: tEffects } = partition(
      transition.actions
    );
    const tResult = executeActions(tActions, context, event);
    context = tResult.context;
    const transitionEmitted = tResult.emitted;
    for (const eff of tEffects) {
      scheduleEffect(eff, send, timers);
    }

    // 3. Move to target state
    statePath = transition.target;

    // 4. Enter new state
    const entryEmitted = enterState(event);

    // 5. Process always transitions
    const alwaysEmitted = processAlwaysTransitions(event);

    // 6. Notify listeners
    notify();

    // 7. Process emitted events (these may trigger further transitions)
    const allEmitted = [
      ...exitEmitted,
      ...transitionEmitted,
      ...entryEmitted,
      ...alwaysEmitted,
    ];
    for (const emittedEvent of allEmitted) {
      send(emittedEvent);
    }
  }

  function forceState(path: string): void {
    if (!spec.states[path]) return;

    // Exit current state without event context
    exitState(null);

    // Move
    statePath = path;

    // Enter new state
    enterState(null);

    // Process always transitions
    processAlwaysTransitions(null);

    // Notify
    notify();
  }

  // ── Initialize: run entry actions for the initial state ──
  enterState(null);

  // ── Auto-simulate: fire success-like transitions for states that are waiting
  // on async events (http effects, or empty visuals waiting for SHOW/LOADED).
  // This simulates async responses for the reference app.
  const initialState = currentState();
  if (initialState) {
    const slots = initialState.visual?.slots;
    const hasVisualContent = slots && Object.values(slots).some(
      (arr: any) => Array.isArray(arr) && arr.some((el: any) => el.type)
    );
    const hasHttpEntry = initialState.entry.some(
      (e: any) => e.kind === "http"
    );
    const isLoadingState = statePath.includes("loading") || statePath === "hidden" || statePath === "idle";
    const allTransitionsAreNetwork = initialState.transitions.length > 0 &&
      initialState.transitions.every((t) => {
        if (t.event === null) return true; // always transitions don't count
        const eventSpec = spec.eventSchema[t.event];
        return eventSpec?.source === "network" || eventSpec?.source === "timer";
      });
    const needsAutoSim = !hasVisualContent || hasHttpEntry || isLoadingState || allTransitionsAreNetwork;

    if (needsAutoSim) {
      // Find success-like transition (prefer OK/SUCCESS/LOADED/SHOW, skip ERROR)
      const successTransition = initialState.transitions.find(
        (t) => t.event !== null && !t.event.includes("ERROR") && !t.event.includes("EMPTY")
      ) ?? initialState.transitions.find((t) => t.event !== null);

      if (successTransition?.event) {
        const event = successTransition.event;
        const mockPayload: Record<string, Json> = {};
        const eventSpec = spec.eventSchema[event];
        if (eventSpec?.payload) {
          for (const [key, field] of Object.entries(eventSpec.payload)) {
            const f = field as any;
            if (f.type === "string") mockPayload[key] = "Mock " + key;
            else if (f.type === "number") mockPayload[key] = 42;
            else if (f.type === "boolean") mockPayload[key] = true;
            else if (f.type === "object") mockPayload[key] = { name: "Acme Project", email: "team@acme.dev", description: "Auto-generated mock data for the reference app", title: "Acme Project", status: "active" } as Json;
            else if (f.type === "array") mockPayload[key] = [] as Json;
          }
        }
        setTimeout(() => {
          send(event, mockPayload);
          // After transition, populate empty string context fields with mock data
          // so bound text elements have something to show
          const MOCK_STRINGS: Record<string, string> = {
            draftName: "Acme Project",
            draftEmail: "team@acme.dev",
            name: "Acme Project",
            email: "team@acme.dev",
            title: "Media Title",
            artist: "Artist Name",
          };
          let changed = false;
          for (const [key, val] of Object.entries(context)) {
            if (val === "" && MOCK_STRINGS[key]) {
              context[key] = MOCK_STRINGS[key];
              changed = true;
            }
          }
          if (changed) {
            cachedSnapshot = buildSnapshot();
            notify();
          }
        }, 800);
      }
    }
  }

  return { getSnapshot, subscribe, send, forceState };
}
